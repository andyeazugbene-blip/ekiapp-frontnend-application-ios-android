import { apiClient } from "../api";

export interface GiftCardTemplate {
  id: string;
  title: string;
  description: string | null;
  /** Minor units. */
  priceAmount: number;
  currency: string;
  imageUrl: string | null;
  isActive: boolean;
  archivedAt: string | null;
  purchasedCount?: number;
  createdAt: string;
}

export type PurchasedStatus = "PENDING_PAYMENT" | "ACTIVE" | "PAUSED" | "REDEEMED" | "EXPIRED" | "CANCELLED";

export interface PurchasedGiftCardRow {
  id: string;
  title: string;
  purchaser: { id: string; name: string | null; email: string | null } | null;
  recipientEmail: string | null;
  recipientName: string | null;
  originalValue: number;
  remainingBalance: number;
  currency: string;
  status: PurchasedStatus;
  statusReason: string | null;
  purchasedAt: string;
  paidAt: string | null;
  expiresAt: string | null;
  paymentReference: string | null;
  maskedCode: string | null;
  redemptionCount?: number;
}

export interface PurchasedGiftCardDetail extends PurchasedGiftCardRow {
  message: string | null;
  statusChangedAt: string | null;
  redemptions: Array<{
    id: string;
    amountMinor: number;
    currency: string;
    balanceAfter: number;
    orderId: string | null;
    createdAt: string;
    redeemer: { id: string; name: string | null; email: string | null };
  }>;
}

export const giftCardsAPI = {
  async listCatalogue(includeArchived = true): Promise<GiftCardTemplate[]> {
    const res = await apiClient.get<{ giftCards: GiftCardTemplate[] }>(`/admin/gift-cards?includeArchived=${includeArchived}`, { bypassCache: true });
    return res.giftCards ?? [];
  },
  async create(input: { title: string; description?: string; priceAmount: number; currency: string; imageUrl?: string }) {
    return apiClient.post<{ giftCard: GiftCardTemplate }>("/admin/gift-cards", input);
  },
  async update(id: string, input: Partial<{ title: string; description: string; priceAmount: number; currency: string; imageUrl: string }>, reason: string) {
    return apiClient.patch<{ giftCard: GiftCardTemplate }>(`/admin/gift-cards/${id}`, { ...input, reason });
  },
  async setState(id: string, action: "pause" | "resume" | "archive", reason: string) {
    return apiClient.post<{ giftCard: GiftCardTemplate }>(`/admin/gift-cards/${id}/${action}`, { reason });
  },

  async listPurchased(params: { q?: string; status?: string; cursor?: string | null; limit?: number }) {
    const qs = new URLSearchParams();
    if (params.q) qs.set("q", params.q);
    if (params.status) qs.set("status", params.status);
    if (params.cursor) qs.set("cursor", params.cursor);
    qs.set("limit", String(params.limit ?? 20));
    return apiClient.get<{ items: PurchasedGiftCardRow[]; nextCursor: string | null }>(`/admin/gift-cards/purchased?${qs.toString()}`, { bypassCache: true });
  },
  async getPurchased(id: string): Promise<PurchasedGiftCardDetail> {
    const res = await apiClient.get<{ purchasedGiftCard: PurchasedGiftCardDetail }>(`/admin/gift-cards/purchased/${id}`, { bypassCache: true });
    return res.purchasedGiftCard;
  },
  async changePurchasedStatus(id: string, action: "cancel" | "pause" | "resume", reason: string): Promise<PurchasedGiftCardDetail> {
    const res = await apiClient.post<{ purchasedGiftCard: PurchasedGiftCardDetail }>(`/admin/gift-cards/purchased/${id}/${action}`, { reason });
    return res.purchasedGiftCard;
  },
};
