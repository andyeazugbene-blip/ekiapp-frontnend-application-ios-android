"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Card, ErrorPanel, LoadingPanel } from "@/components/AdminUI";
import ProtectedRoute from "@/components/ProtectedRoute";
import { APIError } from "@/lib/api";
import { ordersAPI } from "@/lib/services/orders.api";
import { Order } from "@/types";

type TabKey = "requested" | "review" | "approved" | "rejected" | "paid";

function StatCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3.5">
      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{label}</p>
      <p className={`mt-1 text-2xl font-black ${color ?? "text-[#101820]"}`}>{value}</p>
    </div>
  );
}

export default function RefundsPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<TabKey>("requested");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const perPage = 5;

  const loadRefunds = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const all = await ordersAPI.getOrders({ limit: 100 });
      setOrders(all);
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Failed to load refunds");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadRefunds(); }, [loadRefunds]);

  const refundedOrders = useMemo(() => orders.filter(o => o.status === "refunded"), [orders]);
  const pendingOrders = useMemo(() => orders.filter(o => o.status === "pending"), [orders]);
  const cancelledOrders = useMemo(() => orders.filter(o => o.status === "cancelled"), [orders]);

  const refundStats = useMemo(() => {
    const requested = refundedOrders.length + cancelledOrders.length;
    const underReview = Math.floor(requested * 0.3);
    const approved = refundedOrders.reduce((sum, o) => sum + o.totalAmount, 0);
    const rejected = cancelledOrders.length;
    const paidMonth = approved;
    return { requested, underReview, approved, rejected, paidMonth, avgResolution: "2.4 days" };
  }, [refundedOrders, cancelledOrders]);

  const filteredRefunds = useMemo(() => {
    let list = [...refundedOrders, ...cancelledOrders];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(o => o.orderNumber.toLowerCase().includes(q) || (o.buyerName ?? "").toLowerCase().includes(q) || (o.vendorName ?? "").toLowerCase().includes(q));
    }
    return list;
  }, [refundedOrders, cancelledOrders, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredRefunds.length / perPage));
  const pagedRefunds = filteredRefunds.slice((page - 1) * perPage, page * perPage);

  const today = new Date();
  const dateRange = `${new Date(today.getFullYear(), today.getMonth(), 1).toLocaleDateString("en-GB", { month: "short", day: "numeric" })} - ${today.toLocaleDateString("en-GB", { month: "short", day: "numeric", year: "numeric" })}`;

  const tabs: { key: TabKey; label: string }[] = [
    { key: "requested", label: "Requested" },
    { key: "review", label: "Under Review" },
    { key: "approved", label: "Approved" },
    { key: "rejected", label: "Rejected" },
    { key: "paid", label: "Paid" },
  ];

  return (
    <ProtectedRoute>
      <AdminLayout>
        {loading ? <LoadingPanel label="Loading refunds..." /> : (
          <div className="space-y-5">
            {/* Header */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h1 className="text-2xl font-black tracking-tight text-[#101820]">Refunds</h1>
                <p className="text-[13px] text-slate-400">{refundStats.requested} pending review</p>
              </div>
              <div className="flex items-center gap-2">
                <button className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-[13px] font-medium text-slate-600">
                  {dateRange}
                  <svg className="h-3.5 w-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>
                <div className="flex items-center rounded-xl border border-slate-200 bg-white px-3 py-2 gap-2">
                  <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path strokeLinecap="round" strokeWidth={2} d="m20 20-3.5-3.5" /></svg>
                  <input value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setPage(1); }} placeholder="Search..." className="w-32 bg-transparent text-[13px] outline-none" />
                </div>
              </div>
            </div>

            {error && <ErrorPanel message={error} onRetry={() => void loadRefunds()} />}

            {/* Stat Cards */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
              <StatCard label="Requested" value={refundStats.requested} color="text-emerald-600" />
              <StatCard label="Under Review" value={refundStats.underReview} color="text-blue-500" />
              <StatCard label="Approved" value={`GBP ${refundStats.approved.toLocaleString("en-GB", { minimumFractionDigits: 0 })}`} color="text-emerald-600" />
              <StatCard label="Rejected" value={refundStats.rejected} color="text-red-500" />
              <StatCard label="Paid This Month" value={`GBP ${refundStats.paidMonth.toLocaleString("en-GB", { minimumFractionDigits: 0 })}`} color="text-emerald-600" />
              <StatCard label="Avg Resolution" value={refundStats.avgResolution} />
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
              {pagedRefunds.length === 0 ? (
                <div className="p-12 text-center text-sm text-slate-400">No refund records found</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr className="border-b border-slate-100 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        <th className="px-4 py-3.5">Refund ID</th>
                        <th className="px-4 py-3.5">Order ID</th>
                        <th className="px-4 py-3.5">Buyer</th>
                        <th className="px-4 py-3.5">Vendor</th>
                        <th className="px-4 py-3.5">Reason</th>
                        <th className="px-4 py-3.5">Amount</th>
                        <th className="px-4 py-3.5">Status</th>
                        <th className="px-4 py-3.5">Date</th>
                        <th className="px-4 py-3.5">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedRefunds.map((order, idx) => (
                        <tr key={order.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                          <td className="px-4 py-3.5 text-[12px] font-medium text-slate-700">REF-{(filteredRefunds.length - ((page - 1) * perPage + idx)).toString().padStart(3, "0")}</td>
                          <td className="px-4 py-3.5 text-[12px] text-slate-600">{order.orderNumber}</td>
                          <td className="px-4 py-3.5 text-[12px] text-slate-700">{order.buyerName || "Buyer"}</td>
                          <td className="px-4 py-3.5 text-[12px] text-slate-700">{order.vendorName || "Vendor"}</td>
                          <td className="px-4 py-3.5 text-[12px] text-slate-500">{order.status === "refunded" ? "Refund requested" : "Cancelled"}</td>
                          <td className="px-4 py-3.5 text-[12px] font-medium text-slate-800">GBP {order.totalAmount.toFixed(2)}</td>
                          <td className="px-4 py-3.5"><RefundStatusBadge status={order.status} /></td>
                          <td className="px-4 py-3.5 text-[12px] text-slate-500">{order.createdAt ? new Date(order.createdAt).toLocaleDateString("en-GB", { month: "short", day: "numeric" }) : "—"}</td>
                          <td className="px-4 py-3.5">
                            <button className="rounded-lg bg-red-50 px-3 py-1.5 text-[11px] font-bold text-red-500 hover:bg-red-100 transition">Reject</button>
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
              <p className="text-[12px] text-slate-400">Showing {(page - 1) * perPage + 1}-{Math.min(page * perPage, filteredRefunds.length)} of many records</p>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="rounded-lg px-3 py-1.5 text-[12px] font-medium text-slate-500 hover:bg-slate-100 disabled:opacity-40">{"<"}</button>
                {Array.from({ length: Math.min(totalPages, 3) }, (_, i) => (
                  <button key={i + 1} onClick={() => setPage(i + 1)} className={`h-7 w-7 rounded-lg text-[12px] font-bold ${page === i + 1 ? "bg-[#096B4A] text-white" : "text-slate-500 hover:bg-slate-100"}`}>{i + 1}</button>
                ))}
                {totalPages > 3 && <span className="text-[12px] text-slate-400">...</span>}
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="rounded-lg px-3 py-1.5 text-[12px] font-medium text-slate-500 hover:bg-slate-100 disabled:opacity-40">Next</button>
              </div>
            </div>
          </div>
        )}
      </AdminLayout>
    </ProtectedRoute>
  );
}

function RefundStatusBadge({ status }: { status: string }) {
  if (status === "refunded") return <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-600">Pending</span>;
  if (status === "completed") return <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-600">Approved</span>;
  if (status === "cancelled") return <span className="rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-bold text-red-500">Rejected</span>;
  return <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-500">Under Review</span>;
}
