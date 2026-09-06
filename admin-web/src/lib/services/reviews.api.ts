import { apiClient } from "../api";

export type ReviewStatus = "PENDING" | "APPROVED" | "HIDDEN" | "REJECTED";

export interface AdminReview {
  id: string;
  orderId: string;
  vendorId: string;
  vendorName: string;
  buyerId: string;
  buyerName: string;
  productTitle: string | null;
  rating: number;
  body: string | null;
  status: ReviewStatus;
  moderatedBy: string | null;
  createdAt: string;
}

function normalizeReview(raw: any): AdminReview {
  return {
    id: raw.id,
    orderId: raw.orderId ?? "",
    vendorId: raw.vendorId ?? "",
    vendorName: raw.vendorName ?? "",
    buyerId: raw.buyerId ?? "",
    buyerName: raw.buyerName ?? "",
    productTitle: raw.productTitle ?? null,
    rating: raw.rating ?? 0,
    body: raw.comment ?? null,
    status: raw.status ?? "PENDING",
    moderatedBy: raw.moderatedBy ?? null,
    createdAt: raw.createdAt ?? "",
  };
}

export const reviewsAPI = {
  /**
   * Real backend cursor pagination + status/search filtering — this used
   * to fetch a single flat limit=100 batch and do every filter/tab/
   * pagination/stat client-side over that one capped fetch (so any review
   * past the first 100 was invisible, and pagination was fake).
   */
  async getReviews(params: { status?: ReviewStatus; q?: string; cursor?: string; limit?: number }): Promise<{
    items: AdminReview[];
    nextCursor: string | null;
    counts: Record<string, number>;
  }> {
    const query = new URLSearchParams();
    query.set("limit", String(params.limit ?? 20));
    if (params.status) query.set("status", params.status);
    if (params.q) query.set("q", params.q);
    if (params.cursor) query.set("cursor", params.cursor);
    const res = await apiClient.get<any>(`/admin/reviews?${query.toString()}`);
    return {
      items: (res.items ?? []).map(normalizeReview),
      nextCursor: res.nextCursor ?? null,
      counts: res.counts ?? {},
    };
  },

  async moderateReview(reviewId: string, status: "APPROVED" | "HIDDEN" | "REJECTED"): Promise<void> {
    await apiClient.patch(`/admin/reviews/${reviewId}/moderate`, { status });
  },
};
