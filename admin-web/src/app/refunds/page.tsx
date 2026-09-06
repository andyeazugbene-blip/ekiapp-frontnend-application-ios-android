"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AdminLayout from "@/components/AdminLayout";
import { ErrorPanel, LoadingPanel } from "@/components/AdminUI";
import ProtectedRoute from "@/components/ProtectedRoute";
import { APIError } from "@/lib/api";
import { ordersAPI, AdminRefundListItem } from "@/lib/services/orders.api";

type TabKey = "all" | "requested" | "completed" | "rejected";

function StatCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3.5">
      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{label}</p>
      <p className={`mt-1 text-2xl font-black ${color ?? "text-[#101820]"}`}>{value}</p>
    </div>
  );
}

function RefundStatusBadge({ status }: { status: AdminRefundListItem["status"] }) {
  if (status === "REQUESTED") return <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-600">Awaiting 2nd admin</span>;
  if (status === "COMPLETED") return <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-600">Completed</span>;
  return <span className="rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-bold text-red-500">Rejected</span>;
}

/**
 * Real refund history — every row here comes from either a real AuditLog
 * "ORDER_REFUNDED" entry (a refund that actually executed against the
 * payment provider) or a real, still-open AdminApproval four-eyes request
 * (see GET /api/admin/refunds). No client-side stat is invented: there is
 * no "under review" percentage, no synthetic "REF-001" id, no fixed
 * "avg resolution" string — only counts and figures the backend actually
 * returns. A REQUESTED row can only be decided from the Approvals queue
 * (a second, different admin) — that decision flow lives at /approvals,
 * not duplicated here.
 */
export default function RefundsPage() {
  const [items, setItems] = useState<AdminRefundListItem[]>([]);
  const [counts, setCounts] = useState({ requested: 0, rejected: 0, completed: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<TabKey>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const perPage = 10;

  const loadRefunds = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const res = await ordersAPI.listRefunds();
      setItems(res.items);
      setCounts(res.counts);
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Failed to load refunds");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadRefunds(); }, [loadRefunds]);

  const filtered = useMemo(() => {
    let list = items;
    if (activeTab !== "all") {
      const statusFor: Record<Exclude<TabKey, "all">, AdminRefundListItem["status"]> = {
        requested: "REQUESTED", completed: "COMPLETED", rejected: "REJECTED",
      };
      list = list.filter((i) => i.status === statusFor[activeTab]);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter((i) =>
        i.orderNumber.toLowerCase().includes(q) ||
        (i.buyerName ?? "").toLowerCase().includes(q) ||
        (i.vendorName ?? "").toLowerCase().includes(q),
      );
    }
    return list;
  }, [items, activeTab, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paged = filtered.slice((page - 1) * perPage, page * perPage);

  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: "all", label: "All", count: items.length },
    { key: "requested", label: "Requested", count: counts.requested },
    { key: "completed", label: "Completed", count: counts.completed },
    { key: "rejected", label: "Rejected", count: counts.rejected },
  ];

  return (
    <ProtectedRoute>
      <AdminLayout>
        {loading ? <LoadingPanel label="Loading refunds..." /> : (
          <div className="space-y-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h1 className="text-2xl font-black tracking-tight text-[#101820]">Refunds</h1>
                <p className="text-[13px] text-slate-400">
                  {counts.requested > 0 ? `${counts.requested} awaiting a second admin's decision` : "Nothing awaiting approval"}
                </p>
              </div>
              <div className="flex items-center rounded-xl border border-slate-200 bg-white px-3 py-2 gap-2">
                <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path strokeLinecap="round" strokeWidth={2} d="m20 20-3.5-3.5" /></svg>
                <input value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }} placeholder="Search order, buyer, vendor..." className="w-48 bg-transparent text-[13px] outline-none" />
              </div>
            </div>

            {error && <ErrorPanel message={error} onRetry={() => void loadRefunds()} />}

            {counts.requested > 0 && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-700">
                {counts.requested} refund{counts.requested === 1 ? "" : "s"} need{counts.requested === 1 ? "s" : ""} a second admin&apos;s decision.{" "}
                <Link href="/approvals" className="font-bold underline">Review in Approvals →</Link>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <StatCard label="Requested" value={counts.requested} color="text-amber-600" />
              <StatCard label="Completed" value={counts.completed} color="text-emerald-600" />
              <StatCard label="Rejected" value={counts.rejected} color="text-red-500" />
            </div>

            <div className="flex items-center gap-6 border-b border-slate-100">
              {tabs.map((tab) => (
                <button key={tab.key} onClick={() => { setActiveTab(tab.key); setPage(1); }} className={`relative pb-3 text-[13px] font-semibold transition ${activeTab === tab.key ? "text-[#096B4A]" : "text-slate-400 hover:text-slate-600"}`}>
                  {tab.label} ({tab.count})
                  {activeTab === tab.key && <span className="absolute bottom-0 left-0 right-0 h-[3px] rounded-full bg-[#096B4A]" />}
                </button>
              ))}
            </div>

            <div className="rounded-2xl border border-slate-100 bg-white overflow-hidden">
              {paged.length === 0 ? (
                <div className="p-12 text-center text-sm text-slate-400">No refund records found</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr className="border-b border-slate-100 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        <th className="px-4 py-3.5">Order</th>
                        <th className="px-4 py-3.5">Buyer</th>
                        <th className="px-4 py-3.5">Vendor</th>
                        <th className="px-4 py-3.5">Reason</th>
                        <th className="px-4 py-3.5">Amount</th>
                        <th className="px-4 py-3.5">Status</th>
                        <th className="px-4 py-3.5">Date</th>
                        <th className="px-4 py-3.5">Requested by</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paged.map((item) => (
                        <tr key={item.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                          <td className="px-4 py-3.5 text-[12px] font-medium text-slate-700">
                            <Link href={`/orders/${item.orderId}`} className="hover:underline">{item.orderNumber}</Link>
                          </td>
                          <td className="px-4 py-3.5 text-[12px] text-slate-700">{item.buyerName || "—"}</td>
                          <td className="px-4 py-3.5 text-[12px] text-slate-700">{item.vendorName || "—"}</td>
                          <td className="px-4 py-3.5 text-[12px] text-slate-500">{item.reason || "—"}</td>
                          <td className="px-4 py-3.5 text-[12px] font-medium text-slate-800">
                            {item.amount != null ? `${(item.currency ?? "").toUpperCase()} ${(item.amount / 100).toFixed(2)}` : "—"}
                          </td>
                          <td className="px-4 py-3.5"><RefundStatusBadge status={item.status} /></td>
                          <td className="px-4 py-3.5 text-[12px] text-slate-500">{new Date(item.createdAt).toLocaleDateString("en-GB", { month: "short", day: "numeric" })}</td>
                          <td className="px-4 py-3.5 text-[12px] text-slate-500">{item.requestedBy?.name ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {filtered.length > 0 && (
              <div className="flex items-center justify-between">
                <p className="text-[12px] text-slate-400">Showing {(page - 1) * perPage + 1}-{Math.min(page * perPage, filtered.length)} of {filtered.length}</p>
                <div className="flex items-center gap-1">
                  <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="rounded-lg px-3 py-1.5 text-[12px] font-medium text-slate-500 hover:bg-slate-100 disabled:opacity-40">{"<"}</button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).slice(0, 5).map((n) => (
                    <button key={n} onClick={() => setPage(n)} className={`h-7 w-7 rounded-lg text-[12px] font-bold ${page === n ? "bg-[#096B4A] text-white" : "text-slate-500 hover:bg-slate-100"}`}>{n}</button>
                  ))}
                  <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="rounded-lg px-3 py-1.5 text-[12px] font-medium text-slate-500 hover:bg-slate-100 disabled:opacity-40">Next</button>
                </div>
              </div>
            )}
          </div>
        )}
      </AdminLayout>
    </ProtectedRoute>
  );
}
