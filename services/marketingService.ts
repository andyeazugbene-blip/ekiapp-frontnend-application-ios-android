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
  code?: string;
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
  bundlePriceMinor: number;
  regularPriceMinor: number;
  isActive: boolean;
  shareUrl?: string;
  createdAt: string;
}

export type FlashSaleStatus = "UPCOMING" | "ACTIVE" | "EXPIRED" | "INACTIVE";

export interface FlashSaleInput {
  productId: string;
  salePrice: number;
  currency: string;
  startsAt: string;
  endsAt: string;
}

export interface FlashSale extends FlashSaleInput {
  id: string;
  salePriceMinor: number;
  regularPriceMinor: number;
  isActive: boolean;
  status: FlashSaleStatus;
  shareUrl?: string;
  createdAt: string;
}

export type OfferAudience =
  | "all_buyers"
  | "last_30_days"
  | "repeat_buyers"
  | "inactive_buyers"
  | "bought_specific_product"
  | "first_time_buyers"
  | "top_customers"
  | "specific_buyer";

export interface OfferInput {
  audience: OfferAudience;
  buyerId?: string;
  message: string;
  productId?: string;
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

function generatePromoCode(prefix = "EKI"): string {
  const date = new Date();
  return `${prefix}${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${Math.random()
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

function normalizeBundle(raw: any): Bundle {
  return {
    id: String(raw?.id ?? ""),
    name: typeof raw?.name === "string" ? raw.name : "",
    productIds: Array.isArray(raw?.items)
      ? raw.items.map((item: any) => String(item?.productId ?? item?.product?.id ?? "")).filter(Boolean)
      : [],
    bundlePriceMinor: Number(raw?.bundlePriceMinor ?? 0),
    bundlePrice: Number(raw?.bundlePriceMinor ?? 0) / 100,
    regularPriceMinor: Number(raw?.regularPriceMinor ?? 0),
    currency: typeof raw?.currency === "string" ? raw.currency : "",
    isActive: raw?.isActive !== false,
    shareUrl: typeof raw?.shareUrl === "string" ? raw.shareUrl : undefined,
    createdAt: raw?.createdAt ?? new Date().toISOString(),
  };
}

function normalizeFlashSale(raw: any): FlashSale {
  const status: FlashSaleStatus =
    raw?.status === "UPCOMING" || raw?.status === "ACTIVE" || raw?.status === "EXPIRED" || raw?.status === "INACTIVE"
      ? raw.status
      : "ACTIVE";
  return {
    id: String(raw?.id ?? ""),
    productId: String(raw?.productId ?? ""),
    salePriceMinor: Number(raw?.salePriceMinor ?? 0),
    salePrice: Number(raw?.salePriceMinor ?? 0) / 100,
    regularPriceMinor: Number(raw?.regularPriceMinor ?? raw?.product?.priceInCents ?? 0),
    currency: typeof raw?.currency === "string" ? raw.currency : "",
    startsAt: raw?.startsAt instanceof Date ? raw.startsAt.toISOString() : String(raw?.startsAt ?? ""),
    endsAt: raw?.endsAt instanceof Date ? raw.endsAt.toISOString() : String(raw?.endsAt ?? ""),
    isActive: raw?.isActive !== false,
    status,
    shareUrl: typeof raw?.shareUrl === "string" ? raw.shareUrl : undefined,
    createdAt: raw?.createdAt ?? new Date().toISOString(),
  };
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

async function resolveOfferRecipients(input: OfferInput): Promise<Array<{ buyerId: string; orderId?: string }>> {
  if (input.audience === "specific_buyer") {
    if (!input.buyerId) {
      throw new Error("Choose a buyer before sending this offer.");
    }
    const buyers = await buyerService.listMyBuyers();
    const buyer = buyers.find((item) => item.id === input.buyerId);
    return [{ buyerId: input.buyerId, orderId: buyer?.lastOrderId }];
  }

  const buyers = await buyerService.listMyBuyers();
  if (input.audience === "all_buyers") {
    return buyers.map((buyer) => ({ buyerId: buyer.id, orderId: buyer.lastOrderId }));
  }

  const last30DaysCutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  if (input.audience === "last_30_days") {
    return buyers
      .filter((buyer) => buyer.lastOrderAt && Date.parse(buyer.lastOrderAt) >= last30DaysCutoff)
      .map((buyer) => ({ buyerId: buyer.id, orderId: buyer.lastOrderId }));
  }

  if (input.audience === "repeat_buyers") {
    return buyers
      .filter((buyer) => buyer.totalOrders >= 2)
      .map((buyer) => ({ buyerId: buyer.id, orderId: buyer.lastOrderId }));
  }

  if (input.audience === "inactive_buyers") {
    return buyers
      .filter((buyer) => !buyer.lastOrderAt || Date.parse(buyer.lastOrderAt) < last30DaysCutoff)
      .map((buyer) => ({ buyerId: buyer.id, orderId: buyer.lastOrderId }));
  }

  if (input.audience === "first_time_buyers") {
    return buyers
      .filter((buyer) => buyer.totalOrders === 1)
      .map((buyer) => ({ buyerId: buyer.id, orderId: buyer.lastOrderId }));
  }

  if (input.audience === "top_customers") {
    const topCustomerLimit = Math.max(1, Math.min(25, Math.ceil(buyers.length * 0.2)));
    return [...buyers]
      .filter((buyer) => buyer.totalSpent > 0 || buyer.totalOrders > 0)
      .sort((left, right) => right.totalSpent - left.totalSpent || right.totalOrders - left.totalOrders)
      .slice(0, topCustomerLimit)
      .map((buyer) => ({ buyerId: buyer.id, orderId: buyer.lastOrderId }));
  }

  if (input.audience === "bought_specific_product") {
    if (!input.productId) {
      throw new Error("Choose a product before sending this offer.");
    }

    const buyerProfiles = await Promise.all(
      buyers.map(async (buyer) => {
        try {
          return await buyerService.getBuyer(buyer.id);
        } catch {
          return null;
        }
      }),
    );

    return buyerProfiles
      .flatMap((profile) => {
        if (!profile) return [];
        const matchingOrder = profile.recentOrders.find((order) =>
          order.items.some((item) => item.product.id === input.productId),
        );
        return matchingOrder ? [{ buyerId: profile.id, orderId: matchingOrder.id }] : [];
      });
  }

  return [];
}

export const marketingService = {
  async createDiscount(input: DiscountInput): Promise<Discount> {
    const code = (input.code ?? generatePromoCode()).trim().toUpperCase();
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

  async createBundle(input: BundleInput): Promise<Bundle> {
    const res = await apiClient.post<{ bundle: any }>("/api/bundles/me", {
      name: input.name,
      productIds: input.productIds,
      bundlePriceMinor: Math.round(input.bundlePrice * 100),
      currency: input.currency,
    });
    return normalizeBundle(res.bundle);
  },

  async listBundles(): Promise<Bundle[]> {
    const res = await apiClient.get<{ items?: any[] }>("/api/bundles/me");
    return (res.items ?? []).map(normalizeBundle);
  },

  async deleteBundle(id: string): Promise<void> {
    await apiClient.delete(`/api/bundles/me/${id}`);
  },

  async createFlashSale(input: FlashSaleInput): Promise<FlashSale> {
    const res = await apiClient.post<{ flashSale: any }>("/api/flash-sales/me", {
      productId: input.productId,
      salePriceMinor: Math.round(input.salePrice * 100),
      currency: input.currency,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
    });
    return normalizeFlashSale(res.flashSale);
  },

  async listFlashSales(): Promise<FlashSale[]> {
    const res = await apiClient.get<{ items?: any[] }>("/api/flash-sales/me");
    return (res.items ?? []).map(normalizeFlashSale);
  },

  async deleteFlashSale(id: string): Promise<void> {
    await apiClient.delete(`/api/flash-sales/me/${id}`);
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

    for (const recipient of recipientIds) {
      const conversation = await messageService.createConversation(recipient.buyerId, recipient.orderId);
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

  async deleteDiscount(id: string): Promise<void> {
    await apiClient.delete(`/api/promo-codes/me/${id}`);
  },

  async getPublicDeals(): Promise<{
    bundles: Array<{ id: string; vendorId: string; code: string; value: number; type: string; storeName: string; productIds: string[] }>;
    flashSales: Array<{ id: string; vendorId: string; code: string; value: number; type: string; storeName: string; productId: string; endsAt: string | null }>;
  }> {
    return apiClient.get("/api/promo-codes/deals", { skipAuth: true });
  },
};
