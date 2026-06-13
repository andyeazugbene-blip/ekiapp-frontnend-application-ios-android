import { apiClient } from "../api";

export interface AdminReview {
  id: string;
  orderId: string;
  vendorId: string;
  vendorName: string;
  buyerId: string;
  buyerName: string;
  rating: number;
  title: string | null;
  body: string | null;
  isModerated: boolean;
  moderationAction: string | null;
  moderationReason: string | null;
  createdAt: string;
}

function normalizeReview(raw: any): AdminReview {
  return {
    id: raw.id,
    orderId: raw.orderId ?? "",
    vendorId: raw.vendorId ?? raw.vendor?.id ?? "",
    vendorName: raw.vendor?.storeName ?? "",
    buyerId: raw.buyerId ?? raw.buyer?.id ?? "",
    buyerName: raw.buyer?.name ?? "",
    rating: raw.rating ?? 0,
    title: raw.title ?? null,
    body: raw.body ?? null,
    isModerated: raw.isModerated ?? false,
    moderationAction: raw.moderationAction ?? null,
    moderationReason: raw.moderationReason ?? null,
    createdAt: raw.createdAt ?? "",
  };
}

export const reviewsAPI = {
  async getReviews(params?: { status?: "all" | "flagged" | "moderated" }): Promise<AdminReview[]> {
    const query = new URLSearchParams();
    query.set("limit", "100");
    const res = await apiClient.get<any>(`/admin/reviews?${query.toString()}`);
    let items = (res.items ?? res.reviews ?? []).map(normalizeReview);
    if (params?.status === "flagged") {
      items = items.filter((r: AdminReview) => r.rating <= 2 && !r.isModerated);
    } else if (params?.status === "moderated") {
      items = items.filter((r: AdminReview) => r.isModerated);
    }
    return items;
  },

  async moderateReview(reviewId: string, action: "approve" | "reject", reason?: string): Promise<void> {
    // Backend expects status (APPROVED/REJECTED), not action
    await apiClient.patch(`/admin/reviews/${reviewId}/moderate`, {
      status: action === "approve" ? "APPROVED" : "REJECTED",
      reason: reason ?? null,
    });
  },
};
