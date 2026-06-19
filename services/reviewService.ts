/**
 * Review service for buyer reviews and admin moderation.
 */
import { Review } from "../types/product";
import { apiClient } from "./api";

export type ReviewStatus = "pending" | "approved" | "hidden" | "removed";

export interface AdminReview extends Review {
  vendorId?: string;
  vendorName?: string;
  productName?: string;
  status: ReviewStatus;
  reportedCount?: number;
}

export interface SubmitReviewInput {
  orderId: string;
  productId?: string;
  vendorId?: string;
  rating: number;
  comment: string;
}

interface ReviewListResponse {
  reviews?: any[];
  items?: any[];
  averageRating?: number;
  totalReviews?: number;
}

export interface ReviewsWithStats {
  reviews: Review[];
  averageRating: number;
  totalReviews: number;
}

interface SingleReviewResponse {
  review: any;
}

function normalizeReview(raw: any): Review {
  return {
    id: raw.id,
    userId: raw.userId ?? raw.buyerId ?? "",
    userName: raw.userName ?? raw.buyer?.name ?? "",
    userAvatar: raw.userAvatar ?? raw.buyer?.avatar,
    productId: raw.productId,
    vendorId: raw.vendorId,
    rating: raw.rating ?? 0,
    comment: raw.comment ?? "",
    createdAt: raw.createdAt ?? "",
  };
}

function normalizeAdminReview(raw: any): AdminReview {
  return {
    ...normalizeReview(raw),
    vendorId: raw.vendorId,
    vendorName: raw.vendorName ?? raw.vendor?.storeName,
    productName: raw.productName ?? raw.product?.title,
    status: (raw.status ?? "pending").toString().toLowerCase(),
    reportedCount: raw.reportedCount,
  } as AdminReview;
}

export const reviewService = {
  async getForVendor(vendorId: string): Promise<ReviewsWithStats> {
    const res = await apiClient.get<ReviewListResponse>(
      `/api/reviews?vendorId=${encodeURIComponent(vendorId)}&limit=50`,
      { skipAuth: true },
    );
    return {
      reviews: (res.reviews ?? res.items ?? []).map(normalizeReview),
      averageRating: res.averageRating ?? 0,
      totalReviews: res.totalReviews ?? 0,
    };
  },

  async getForProduct(productId: string): Promise<ReviewsWithStats> {
    const res = await apiClient.get<ReviewListResponse>(
      `/api/reviews?productId=${encodeURIComponent(productId)}&limit=50`,
      { skipAuth: true },
    );
    return {
      reviews: (res.reviews ?? res.items ?? []).map(normalizeReview),
      averageRating: res.averageRating ?? 0,
      totalReviews: res.totalReviews ?? 0,
    };
  },

  async submitReview(input: SubmitReviewInput): Promise<Review> {
    const res = await apiClient.post<SingleReviewResponse>("/api/reviews", input);
    return normalizeReview(res.review);
  },

  async listForAdmin(status?: ReviewStatus): Promise<AdminReview[]> {
    const query = status ? `?status=${encodeURIComponent(status.toUpperCase())}` : "";
    const res = await apiClient.get<ReviewListResponse>(`/api/admin/reviews${query}`);
    return (res.reviews ?? res.items ?? []).map(normalizeAdminReview);
  },

  async moderate(reviewId: string, decision: ReviewStatus, note?: string): Promise<AdminReview> {
    const res = await apiClient.patch<SingleReviewResponse>(
      `/api/admin/reviews/${encodeURIComponent(reviewId)}/moderate`,
      { decision: decision.toUpperCase(), note },
    );
    return normalizeAdminReview(res.review);
  },
};
