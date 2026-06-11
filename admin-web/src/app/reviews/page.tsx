"use client";

import { useCallback, useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import { reviewsAPI, AdminReview } from "@/lib/services/reviews.api";
import { APIError } from "@/lib/api";

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | "flagged" | "moderated">("all");

  const loadReviews = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      setReviews(await reviewsAPI.getReviews({ status: filter }));
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Failed to load reviews");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void loadReviews();
  }, [loadReviews]);

  const handleModerate = async (reviewId: string, action: "approve" | "reject") => {
    if (!confirm(`Are you sure you want to ${action} this review?`)) return;
    try {
      await reviewsAPI.moderateReview(reviewId, action);
      await loadReviews();
    } catch (err) {
      alert(err instanceof APIError ? err.message : `Failed to ${action} review`);
    }
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <AdminLayout>
          <div className="flex h-64 items-center justify-center">
            <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-primary-600 mx-auto"></div>
          </div>
        </AdminLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <AdminLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Reviews</h1>
            <p className="mt-1 text-sm text-gray-600">Monitor and moderate buyer reviews across the platform.</p>
          </div>

          {error && (
            <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-red-700">
              {error}
              <button onClick={loadReviews} className="ml-4 underline">Retry</button>
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            {(["all", "flagged", "moderated"] as const).map((option) => (
              <button
                key={option}
                onClick={() => setFilter(option)}
                className={`rounded-lg px-5 py-2.5 text-sm font-semibold transition ${
                  filter === option ? "bg-[#096B4A] text-white" : "bg-white text-gray-700 shadow-sm hover:bg-emerald-50"
                }`}
              >
                {option === "all" ? "All reviews" : option === "flagged" ? "Flagged (≤2★)" : "Moderated"}
              </button>
            ))}
          </div>

          <div className="overflow-hidden rounded-lg bg-white shadow">
            {reviews.length === 0 ? (
              <div className="py-12 text-center text-gray-500">No reviews found.</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {reviews.map((review) => (
                  <div key={review.id} className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <span className="text-lg font-bold text-gray-900">{review.rating}★</span>
                          <span className="text-sm font-bold text-gray-700">{review.buyerName}</span>
                          <span className="text-xs text-gray-400">→</span>
                          <span className="text-sm font-bold text-gray-700">{review.vendorName}</span>
                          {review.isModerated && (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                              Moderated ({review.moderationAction})
                            </span>
                          )}
                        </div>
                        {review.title && <p className="mt-2 text-sm font-semibold text-gray-800">{review.title}</p>}
                        {review.body && <p className="mt-1 text-sm text-gray-600">{review.body}</p>}
                        <p className="mt-2 text-xs text-gray-400">{new Date(review.createdAt).toLocaleString()}</p>
                      </div>
                      {!review.isModerated && (
                        <div className="ml-4 flex gap-2">
                          <button
                            onClick={() => handleModerate(review.id, "approve")}
                            className="rounded-md bg-green-100 px-3 py-1.5 text-xs font-semibold text-green-800 hover:bg-green-200"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleModerate(review.id, "reject")}
                            className="rounded-md bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-800 hover:bg-red-200"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <p className="text-sm text-gray-500">Showing {reviews.length} reviews</p>
        </div>
      </AdminLayout>
    </ProtectedRoute>
  );
}
