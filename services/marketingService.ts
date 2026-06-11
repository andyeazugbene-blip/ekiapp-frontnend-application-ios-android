/**
 * Marketing service for vendor promotional actions.
 */
import { apiClient } from "./api";
import { buyerService } from "./buyerService";
import { messageService } from "./messageService";
import { productService } from "./productService";

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
    const products = await productService.getMyVendorProducts();
    const selected = products.filter((product) => input.productIds.includes(product.id));
    const regularTotal = selected.reduce((sum, product) => sum + product.price, 0);
    const discountValue = Math.max(0, regularTotal - input.bundlePrice);

    if (selected.length < 2 || discountValue <= 0) {
      throw new Error("Bundle price must be lower than the selected products' regular total.");
    }

    const discount = await this.createDiscount({
      productIds: input.productIds,
      audience: "all",
      kind: "fixed_amount",
      value: discountValue,
      code: generatePromoCode("BUNDLE"),
    });

    return {
      ...input,
      id: discount.id,
      shareUrl: discount.shareUrl,
      createdAt: discount.createdAt,
    };
  },

  async listBundles(): Promise<Bundle[]> {
    return [];
  },

  async createFlashSale(input: FlashSaleInput): Promise<FlashSale> {
    const products = await productService.getMyVendorProducts();
    const product = products.find((item) => item.id === input.productId);
    if (!product) {
      throw new Error("Selected product was not found in your store.");
    }

    const discountValue = Math.max(0, product.price - input.salePrice);
    if (discountValue <= 0) {
      throw new Error("Flash sale price must be lower than the product price.");
    }

    const discount = await this.createDiscount({
      productIds: [input.productId],
      audience: "all",
      kind: "fixed_amount",
      value: discountValue,
      code: generatePromoCode("FLASH"),
      startsAt: input.startsAt,
      endsAt: input.endsAt,
    });

    return {
      ...input,
      id: discount.id,
      shareUrl: discount.shareUrl,
      createdAt: discount.createdAt,
    };
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
};
