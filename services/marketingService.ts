/**
 * Marketing service for vendor promotional actions.
 */
import { apiClient } from "./api";
import { buyerService } from "./buyerService";
import { messageService } from "./messageService";

export type DiscountAudience = "all" | "repeat" | "new" | "country";
export type DiscountKind = "percentage" | "fixed_amount";

export interface DiscountInput {
  productIds: string[];
  audience: DiscountAudience;
  audienceCountry?: string;
  kind: DiscountKind;
  value: number;
  startsAt?: string;
  endsAt?: string;
}

export interface Discount extends DiscountInput {
  id: string;
  code?: string;
  shareUrl?: string;
  createdAt: string;
}

export interface BundleInput {
  name: string;
  productIds: string[];
  bundlePrice: number;
  currency: string;
}

export interface Bundle extends BundleInput {
  id: string;
  shareUrl?: string;
  createdAt: string;
}

export interface FlashSaleInput {
  productId: string;
  salePrice: number;
  currency: string;
  startsAt: string;
  endsAt: string;
}

export interface FlashSale extends FlashSaleInput {
  id: string;
  shareUrl?: string;
  createdAt: string;
}

export type OfferAudience = "all_buyers" | "last_30_days" | "specific_buyer";

export interface OfferInput {
  audience: OfferAudience;
  buyerId?: string;
  message: string;
  productIds?: string[];
  expiresAt?: string;
}

export interface Offer {
  id: string;
  audience: OfferAudience;
  buyerId?: string;
  message: string;
  shareUrl?: string;
  createdAt: string;
}

function generatePromoCode(): string {
  const date = new Date();
  return `EKI${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${Math.random()
    .toString(36)
    .slice(2, 6)
    .toUpperCase()}`;
}

function toIsoDateOrThrow(value?: string): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;

  const slashMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{2}|\d{4})$/);
  if (slashMatch) {
    const day = Number(slashMatch[1]);
    const month = Number(slashMatch[2]);
    const year = Number(slashMatch[3].length === 2 ? `20${slashMatch[3]}` : slashMatch[3]);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    if (
      parsed.getUTCFullYear() !== year ||
      parsed.getUTCMonth() !== month - 1 ||
      parsed.getUTCDate() !== day
    ) {
      throw new Error("Use a valid start and end date.");
    }
    return parsed.toISOString();
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Use a valid start and end date.");
  }

  return parsed.toISOString();
}

function normalizeDiscount(raw: any): Discount {
  const backendType = (raw?.type ?? "PERCENTAGE").toString().toUpperCase();
  const kind: DiscountKind = backendType === "FIXED_AMOUNT" ? "fixed_amount" : "percentage";
  const value = kind === "fixed_amount" ? Number(raw?.value ?? 0) / 100 : Number(raw?.value ?? 0);

  return {
    id: String(raw?.id ?? raw?.code ?? ""),
    code: typeof raw?.code === "string" ? raw.code : undefined,
    productIds: Array.isArray(raw?.productIds) ? raw.productIds.filter((item: unknown): item is string => typeof item === "string") : [],
    audience:
      raw?.audience === "repeat" || raw?.audience === "new" || raw?.audience === "country"
        ? raw.audience
        : "all",
    audienceCountry: typeof raw?.audienceCountry === "string" ? raw.audienceCountry : undefined,
    kind,
    value,
    startsAt: raw?.validFrom ?? undefined,
    endsAt: raw?.validUntil ?? undefined,
    createdAt: raw?.createdAt ?? new Date().toISOString(),
    shareUrl: typeof raw?.shareUrl === "string" ? raw.shareUrl : undefined,
  };
}

async function resolveOfferRecipients(input: OfferInput): Promise<string[]> {
  if (input.audience === "specific_buyer") {
    if (!input.buyerId) {
      throw new Error("Choose a buyer before sending this offer.");
    }
    return [input.buyerId];
  }

  const buyers = await buyerService.listMyBuyers();
  if (input.audience === "all_buyers") {
    return buyers.map((buyer) => buyer.id);
  }

  const last30DaysCutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  return buyers
    .filter((buyer) => buyer.lastOrderAt && Date.parse(buyer.lastOrderAt) >= last30DaysCutoff)
    .map((buyer) => buyer.id);
}

export const marketingService = {
  async createDiscount(input: DiscountInput): Promise<Discount> {
    const code = generatePromoCode();
    const payload = {
      code,
      type: input.kind === "fixed_amount" ? "FIXED_AMOUNT" : "PERCENTAGE",
      value: input.kind === "fixed_amount" ? Math.round(input.value * 100) : Math.round(input.value),
      productIds: input.productIds,
      audience: input.audience,
      audienceCountry: input.audienceCountry,
      validFrom: toIsoDateOrThrow(input.startsAt),
      validUntil: toIsoDateOrThrow(input.endsAt),
    };

    const res = await apiClient.post<{ promoCode?: any }>("/api/promo-codes/me", payload);
    return normalizeDiscount(res.promoCode ?? payload);
  },

  async listDiscounts(): Promise<Discount[]> {
    const res = await apiClient.get<{ promoCodes?: any[] }>("/api/promo-codes/me");
    return (res.promoCodes ?? []).map(normalizeDiscount);
  },

  async createBundle(_input: BundleInput): Promise<Bundle> {
    throw new Error("Bundles are not exposed by the backend yet.");
  },

  async listBundles(): Promise<Bundle[]> {
    return [];
  },

  async createFlashSale(_input: FlashSaleInput): Promise<FlashSale> {
    throw new Error("Flash sales are not exposed by the backend yet.");
  },

  async listFlashSales(): Promise<FlashSale[]> {
    return [];
  },

  async sendOffer(input: OfferInput): Promise<Offer> {
    const message = input.message.trim();
    if (!message) {
      throw new Error("Write a message before sending an offer.");
    }

    const recipientIds = await resolveOfferRecipients(input);
    if (recipientIds.length === 0) {
      throw new Error("No matching buyers were found for this audience yet.");
    }

    for (const buyerId of recipientIds) {
      const conversation = await messageService.createConversation(buyerId);
      await messageService.sendMessage(conversation.id, { text: message });
    }

    return {
      id: `offer_${Date.now()}`,
      audience: input.audience,
      buyerId: input.buyerId,
      message,
      createdAt: new Date().toISOString(),
    };
  },

  async listOffers(): Promise<Offer[]> {
    return [];
  },
};
