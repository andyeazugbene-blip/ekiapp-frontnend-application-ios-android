"use client";

import { useCallback, useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { ErrorPanel, LoadingPanel } from "@/components/AdminUI";
import ProtectedRoute from "@/components/ProtectedRoute";
import { reviewsAPI, AdminReview, ReviewStatus } from "@/lib/services/reviews.api";
import { APIError } from "@/lib/api";

type TabKey = "all" | ReviewStatus;

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

/**
 * Real backend-driven admin reviews console. Previously this fetched a
 * single limit=100 batch and did every tab/search/pagination/stat entirely
 * client-side over that one capped fetch — reviews beyond the first 100
 * were simply invisible, "Flagged"/"Published" tabs were guessed from
 * rating+moderation state rather than a real status, and there was no
 * Approve action at all despite the backend supporting it. Tabs now map
 * 1:1 to the real ReviewStatus enum, search/pagination hit the real
 * backend, and counts come from a real per-status aggregate independent of
 * the current page.
 */
export default function ReviewsPage() {
  const [items, setItems] = useState<AdminReview[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<TabKey>("all");
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [cursorStack, setCursorStack] = useState<(string | null)[]>([null]);
  const [pageIndex, setPageIndex] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const perPage = 20;

  const load = useCallback(async (cursor: string | null) => {
    try {
      setLoading(true);
      setError("");
      const res = await reviewsAPI.getReviews({
        status: activeTab === "all" ? undefined : activeTab,
        q: appliedSearch || undefined,
        cursor: cursor ?? undefined,
        limit: perPage,
      });
      setItems(res.items);
      setCounts(res.counts);
      setNextCursor(res.nextCursor);
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Failed to load reviews");
    } finally {
      setLoading(false);
    }
  }, [activeTab, appliedSearch]);

  useEffect(() => {
    setCursorStack([null]);
    setPageIndex(0);
    void load(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, appliedSearch]);

  const goNext = () => {
    if (!nextCursor) return;
    const nextStack = [...cursorStack.slice(0, pageIndex + 1), nextCursor];
    setCursorStack(nextStack);
    setPageIndex(pageIndex + 1);
    void load(nextCursor);
  };

  const goPrevious = () => {
    if (pageIndex === 0) return;
    setPageIndex(pageIndex - 1);
    void load(cursorStack[pageIndex - 1]);
  };

  const handleModerate = async (reviewId: string, status: "APPROVED" | "HIDDEN" | "REJECTED") => {
    const verb = status === "APPROVED" ? "approve" : status === "HIDDEN" ? "hide" : "reject";
    if (!confirm(`${verb.charAt(0).toUpperCase() + verb.slice(1)} this review?`)) return;
    try {
      setBusyId(reviewId);
      await reviewsAPI.moderateReview(reviewId, status);
      await load(cursorStack[pageIndex]);
    } catch (err) {
      alert(err instanceof APIError ? err.message : `Failed to ${verb} review`);
    } finally {
      setBusyId(null);
    }
  };

  const totalCount = Object.values(counts).reduce((s, n) => s + n, 0);

  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: "all", label: "All", count: totalCount },
    { key: "PENDING", label: "Pending", count: counts.PENDING ?? 0 },
    { key: "APPROVED", label: "Approved", count: counts.APPROVED ?? 0 },
    { key: "HIDDEN", label: "Hidden", count: counts.HIDDEN ?? 0 },
    { key: "REJECTED", label: "Rejected", count: counts.REJECTED ?? 0 },
  ];

  return (
    <ProtectedRoute>
      <AdminLayout>
        <div className="space-y-5">
          {/* Header */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-2xl font-black tracking-tight text-[#101820]">Reviews</h1>
              <p className="text-[13px] text-slate-400">Platform review moderation</p>
            </div>
            <form
              className="flex items-center rounded-xl border border-slate-200 bg-white px-3 py-2 gap-2"
              onSubmit={(e) => { e.preventDefault(); setAppliedSearch(searchInput.trim()); }}
            >
              <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path strokeLinecap="round" strokeWidth={2} d="m20 20-3.5-3.5" /></svg>
              <input value={searchInput} onChange={e => setSearchInput(e.target.value)} placeholder="Search review text..." className="w-48 bg-transparent text-[13px] outline-none" />
              {appliedSearch && (
                <button type="button" onClick={() => { setSearchInput(""); setAppliedSearch(""); }} className="text-[11px] font-bold text-slate-400 hover:text-slate-600">Clear</button>
              )}
            </form>
          </div>

          {error && <ErrorPanel message={error} onRetry={() => void load(cursorStack[pageIndex])} />}

          {/* Stat Cards — real per-status counts, independent of the current page/filter */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Total Reviews" value={totalCount.toLocaleString()} />
            <StatCard label="Pending" value={counts.PENDING ?? 0} color="text-amber-500" />
            <StatCard label="Approved" value={counts.APPROVED ?? 0} color="text-emerald-600" />
            <StatCard label="Rejected" value={counts.REJECTED ?? 0} color="text-red-500" />
          </div>

          {/* Tabs — real ReviewStatus values, each a real server-side filter */}
          <div className="flex items-center gap-6 border-b border-slate-100">
            {tabs.map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={`relative pb-3 text-[13px] font-semibold transition ${activeTab === tab.key ? "text-[#096B4A]" : "text-slate-400 hover:text-slate-600"}`}>
                {tab.label} ({tab.count})
                {activeTab === tab.key && <span className="absolute bottom-0 left-0 right-0 h-[3px] rounded-full bg-[#096B4A]" />}
              </button>
            ))}
          </div>

          {/* Table */}
          <div className="rounded-2xl border border-slate-100 bg-white overflow-hidden">
            {loading ? <LoadingPanel label="Loading reviews..." /> : items.length === 0 ? (
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
                    {items.map(review => (
                      <tr key={review.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                        <td className="px-4 py-3.5 text-[12px] font-medium text-slate-700">{review.buyerName || "Anonymous"}</td>
                        <td className="px-4 py-3.5 text-[12px] text-slate-600">{review.vendorName || "—"}</td>
                        <td className="px-4 py-3.5 text-[12px] text-slate-600">{review.productTitle || "—"}</td>
                        <td className="px-4 py-3.5"><Stars rating={review.rating} /></td>
                        <td className="px-4 py-3.5 max-w-[200px]"><p className="text-[12px] text-slate-600 truncate">{review.body || "—"}</p></td>
                        <td className="px-4 py-3.5"><ReviewStatusBadge status={review.status} /></td>
                        <td className="px-4 py-3.5 text-[12px] text-slate-500">{review.createdAt ? new Date(review.createdAt).toLocaleDateString("en-GB", { month: "short", day: "numeric" }) : "—"}</td>
                        <td className="px-4 py-3.5">
                          <div className="flex gap-1.5">
                            <button disabled={busyId === review.id || review.status === "APPROVED"} onClick={() => void handleModerate(review.id, "APPROVED")} className="rounded-lg bg-emerald-50 px-2.5 py-1.5 text-[11px] font-bold text-emerald-600 hover:bg-emerald-100 transition disabled:opacity-40">Approve</button>
                            <button disabled={busyId === review.id || review.status === "HIDDEN"} onClick={() => void handleModerate(review.id, "HIDDEN")} className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-[11px] font-bold text-slate-600 hover:bg-slate-200 transition disabled:opacity-40">Hide</button>
                            <button disabled={busyId === review.id || review.status === "REJECTED"} onClick={() => void handleModerate(review.id, "REJECTED")} className="rounded-lg bg-red-50 px-2.5 py-1.5 text-[11px] font-bold text-red-500 hover:bg-red-100 transition disabled:opacity-40">Reject</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Pagination — real cursor-based, from the backend */}
          <div className="flex items-center justify-between">
            <p className="text-[12px] text-slate-400">Page {pageIndex + 1}{items.length > 0 ? ` — ${items.length} shown` : ""}</p>
            <div className="flex items-center gap-2">
              <button onClick={goPrevious} disabled={pageIndex === 0 || loading} className="rounded-lg px-3 py-1.5 text-[12px] font-medium text-slate-500 hover:bg-slate-100 disabled:opacity-40">Previous</button>
              <button onClick={goNext} disabled={!nextCursor || loading} className="rounded-lg px-3 py-1.5 text-[12px] font-medium text-slate-500 hover:bg-slate-100 disabled:opacity-40">Next</button>
            </div>
          </div>
        </div>
      </AdminLayout>
    </ProtectedRoute>
  );
}

function ReviewStatusBadge({ status }: { status: ReviewStatus }) {
  if (status === "REJECTED") return <span className="rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-bold text-red-500">Rejected</span>;
  if (status === "HIDDEN") return <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-500">Hidden</span>;
  if (status === "APPROVED") return <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-600">Approved</span>;
  return <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-600">Pending</span>;
}
