import { apiClient } from "./api";

export interface GiftCard {
  id: string;
  title: string;
  description: string | null;
  priceAmount: number;
  priceFormatted: string;
  currency: string;
  imageUrl: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface PurchasedGiftCard {
  id: string;
  giftCardId: string;
  title: string;
  imageUrl: string | null;
  recipientEmail: string | null;
  recipientName: string | null;
  message: string | null;
  amount: number;
  currency: string;
  isRedeemed: boolean;
  redeemedAt: string | null;
  createdAt: string;
}

export interface GiftCardPurchaseIntent {
  clientSecret: string;
  paymentIntentId: string;
  purchasedId: string;
  amount: number;
}

function normalize(raw: any): GiftCard {
  return {
    id: raw.id ?? "",
    title: raw.title ?? "Gift Card",
    description: raw.description ?? null,
    priceAmount: typeof raw.priceAmount === "number" ? raw.priceAmount : 0,
    priceFormatted: raw.priceFormatted ?? "0.00",
    currency: (raw.currency ?? "GBP").toUpperCase(),
    imageUrl: raw.imageUrl ?? null,
    isActive: raw.isActive ?? true,
    createdAt: raw.createdAt ?? "",
  };
}

function normalizePurchased(raw: any): PurchasedGiftCard {
  return {
    id: raw.id ?? "",
    giftCardId: raw.giftCardId ?? "",
    title: raw.title ?? "Gift Card",
    imageUrl: raw.imageUrl ?? null,
    recipientEmail: raw.recipientEmail ?? null,
    recipientName: raw.recipientName ?? null,
    message: raw.message ?? null,
    amount: typeof raw.amount === "number" ? raw.amount : 0,
    currency: (raw.currency ?? "GBP").toUpperCase(),
    isRedeemed: raw.isRedeemed ?? false,
    redeemedAt: raw.redeemedAt ?? null,
    createdAt: raw.createdAt ?? "",
  };
}

export const giftCardService = {
  async getActive(): Promise<GiftCard[]> {
    const res = await apiClient.get<{ giftCards?: any[]; data?: any[] } | any[]>("/api/gift-cards/active");
    const list = Array.isArray(res) ? res : (res as any).giftCards ?? (res as any).data ?? [];
    return list.map(normalize);
  },

  async purchase(giftCardId: string, options?: { recipientEmail?: string; recipientName?: string; message?: string }): Promise<GiftCardPurchaseIntent> {
    const res = await apiClient.post<any>("/api/gift-cards/purchase", {
      giftCardId,
      recipientEmail: options?.recipientEmail,
      recipientName: options?.recipientName,
      message: options?.message,
    });
    return {
      clientSecret: res.clientSecret,
      paymentIntentId: res.paymentIntentId,
      purchasedId: res.purchasedId,
      amount: typeof res.amount === "number" ? res.amount : 0,
    };
  },

  async getPurchased(): Promise<PurchasedGiftCard[]> {
    const res = await apiClient.get<{ giftCards?: any[] } | any[]>("/api/gift-cards/me");
    const list = Array.isArray(res) ? res : (res as any).giftCards ?? [];
    return list.map(normalizePurchased);
  },
};
