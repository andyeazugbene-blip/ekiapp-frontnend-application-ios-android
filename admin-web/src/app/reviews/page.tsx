"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { ErrorPanel, LoadingPanel } from "@/components/AdminUI";
import ProtectedRoute from "@/components/ProtectedRoute";
import { reviewsAPI, AdminReview } from "@/lib/services/reviews.api";
import { APIError } from "@/lib/api";

type TabKey = "all" | "published" | "pending" | "flagged" | "removed";

function StatCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3.5">
      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{label}</p>
      <p className={`mt-1 text-2xl font-black ${color ?? "text-[#101820]"}`}>{value}</p>
    </div>
  );
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="text-[13px] tracking-wide">
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={i < rating ? "text-amber-400" : "text-slate-200"}>★</span>
      ))}
    </span>
  );
}

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<TabKey>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const perPage = 7;

  const loadReviews = useCallback(async () => {
    try {
      setLoading(true); setError("");
      setReviews(await reviewsAPI.getReviews({ status: "all" }));
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Failed to load reviews");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void loadReviews(); }, [loadReviews]);

  const handleModerate = async (reviewId: string, action: "approve" | "reject") => {
    if (!confirm(`${action} this review?`)) return;
    try {
      await reviewsAPI.moderateReview(reviewId, action);
      await loadReviews();
    } catch (err) {
      alert(err instanceof APIError ? err.message : `Failed to ${action} review`);
    }
  };

  const stats = useMemo(() => {
    const total = reviews.length;
    const published = reviews.filter(r => r.moderationAction === "APPROVED" || (!r.isModerated && r.rating >= 3)).length;
    const pending = reviews.filter(r => !r.isModerated && r.rating >= 3).length;
    const flagged = reviews.filter(r => r.rating <= 2 && !r.isModerated).length;
    const removed = reviews.filter(r => r.moderationAction === "REJECTED").length;
    const avgRating = total > 0 ? (reviews.reduce((s, r) => s + r.rating, 0) / total) : 0;
    const lowStar = reviews.filter(r => r.rating <= 2).length;
    return { total, published, pending, flagged, removed, avgRating, lowStar };
  }, [reviews]);

  const filteredReviews = useMemo(() => {
    let list = [...reviews];
    if (activeTab === "published") list = list.filter(r => r.moderationAction === "APPROVED" || (!r.isModerated && r.rating >= 3));
    else if (activeTab === "pending") list = list.filter(r => !r.isModerated);
    else if (activeTab === "flagged") list = list.filter(r => r.rating <= 2 && !r.isModerated);
    else if (activeTab === "removed") list = list.filter(r => r.moderationAction === "REJECTED");
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(r => r.buyerName.toLowerCase().includes(q) || r.vendorName.toLowerCase().includes(q) || (r.body ?? "").toLowerCase().includes(q));
    }
    return list;
  }, [reviews, activeTab, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredReviews.length / perPage));
  const pagedReviews = filteredReviews.slice((page - 1) * perPage, page * perPage);

  const tabs: { key: TabKey; label: string }[] = [
    { key: "all", label: "All" },
    { key: "published", label: "Published" },
    { key: "pending", label: "Pending Moderation" },
    { key: "flagged", label: "Flagged" },
    { key: "removed", label: "Removed" },
  ];

  return (
    <ProtectedRoute>
      <AdminLayout>
        {loading ? <LoadingPanel label="Loading reviews..." /> : (
          <div className="space-y-5">
            {/* Header */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h1 className="text-2xl font-black tracking-tight text-[#101820]">Reviews</h1>
                <p className="text-[13px] text-slate-400">Platform review moderation</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center rounded-xl border border-slate-200 bg-white px-3 py-2 gap-2">
                  <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path strokeLinecap="round" strokeWidth={2} d="m20 20-3.5-3.5" /></svg>
                  <input value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setPage(1); }} placeholder="Search..." className="w-40 bg-transparent text-[13px] outline-none" />
                </div>
              </div>
            </div>

            {error && <ErrorPanel message={error} onRetry={() => void loadReviews()} />}

            {/* Stat Cards */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
              <StatCard label="Total Reviews" value={stats.total.toLocaleString()} />
              <StatCard label="Published" value={stats.published.toLocaleString()} color="text-emerald-600" />
              <StatCard label="Pending" value={stats.pending} color="text-emerald-600" />
              <StatCard label="Flagged" value={stats.flagged} color="text-amber-500" />
              <StatCard label="Removed" value={stats.removed} color="text-red-500" />
              <StatCard label="Avg Rating" value={`${stats.avgRating.toFixed(1)} ★`} color="text-amber-500" />
              <StatCard label="1-2 Star" value={stats.lowStar} color="text-red-500" />
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-6 border-b border-slate-100">
              {tabs.map(tab => (
                <button key={tab.key} onClick={() => { setActiveTab(tab.key); setPage(1); }} className={`relative pb-3 text-[13px] font-semibold transition ${activeTab === tab.key ? "text-[#096B4A]" : "text-slate-400 hover:text-slate-600"}`}>
                  {tab.label}
                  {activeTab === tab.key && <span className="absolute bottom-0 left-0 right-0 h-[3px] rounded-full bg-[#096B4A]" />}
                </button>
              ))}
            </div>

            {/* Table */}
            <div className="rounded-2xl border border-slate-100 bg-white overflow-hidden">
              {pagedReviews.length === 0 ? (
                <div className="p-12 text-center text-sm text-slate-400">No reviews found</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr className="border-b border-slate-100 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        <th className="px-4 py-3.5">Reviewer</th>
                        <th className="px-4 py-3.5">Vendor</th>
                        <th className="px-4 py-3.5">Product</th>
                        <th className="px-4 py-3.5">Rating</th>
                        <th className="px-4 py-3.5">Review</th>
                        <th className="px-4 py-3.5">Status</th>
                        <th className="px-4 py-3.5">Date</th>
                        <th className="px-4 py-3.5">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedReviews.map(review => (
                        <tr key={review.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                          <td className="px-4 py-3.5 text-[12px] font-medium text-slate-700">{review.buyerName || "Anonymous"}</td>
                          <td className="px-4 py-3.5 text-[12px] text-slate-600">{review.vendorName || "—"}</td>
                          <td className="px-4 py-3.5 text-[12px] text-slate-600">{review.title || "Product"}</td>
                          <td className="px-4 py-3.5"><Stars rating={review.rating} /></td>
                          <td className="px-4 py-3.5 max-w-[200px]"><p className="text-[12px] text-slate-600 truncate">{review.body || "—"}</p></td>
                          <td className="px-4 py-3.5"><ReviewStatusBadge review={review} /></td>
                          <td className="px-4 py-3.5 text-[12px] text-slate-500">{review.createdAt ? new Date(review.createdAt).toLocaleDateString("en-GB", { month: "short", day: "numeric" }) : "—"}</td>
                          <td className="px-4 py-3.5">
                            <button onClick={() => void handleModerate(review.id, "reject")} className="rounded-lg bg-red-50 px-3 py-1.5 text-[11px] font-bold text-red-500 hover:bg-red-100 transition">Remove</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between">
              <p className="text-[12px] text-slate-400">{filteredReviews.length === 0 ? "No records" : `Showing ${(page - 1) * perPage + 1}-${Math.min(page * perPage, filteredReviews.length)} of ${filteredReviews.length}`}</p>
              <div className="flex items-center gap-1">
                {totalPages > 1 && Array.from({ length: Math.min(totalPages, 3) }, (_, i) => (
                  <button key={i + 1} onClick={() => setPage(i + 1)} className={`h-7 w-7 rounded-lg text-[12px] font-bold ${page === i + 1 ? "bg-[#096B4A] text-white" : "text-slate-500 hover:bg-slate-100"}`}>{i + 1}</button>
                ))}
              </div>
            </div>
          </div>
        )}
      </AdminLayout>
    </ProtectedRoute>
  );
}

function ReviewStatusBadge({ review }: { review: AdminReview }) {
  if (review.moderationAction === "REJECTED") return <span className="rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-bold text-red-500">Removed</span>;
  if (review.moderationAction === "APPROVED") return <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-500">Published</span>;
  if (review.rating <= 2) return <span className="rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-bold text-red-500">Flagged</span>;
  if (!review.isModerated) return <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-600">Pending</span>;
  return <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-500">Published</span>;
}
