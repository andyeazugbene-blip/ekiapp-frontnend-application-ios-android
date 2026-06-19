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

export const giftCardService = {
  async getActive(): Promise<GiftCard[]> {
    const res = await apiClient.get<{ giftCards?: any[]; data?: any[] } | any[]>("/api/gift-cards/active");
    const list = Array.isArray(res) ? res : (res as any).giftCards ?? (res as any).data ?? [];
    return list.map(normalize);
  },
};
