"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Card, ErrorPanel, LoadingPanel } from "@/components/AdminUI";
import ProtectedRoute from "@/components/ProtectedRoute";
import { API2FARequiredError, APIError } from "@/lib/api";
import { formatDisplayMoney, useAdminDisplayCurrency } from "@/lib/displayCurrency";
import { payoutRequestsAPI } from "@/lib/services/payout-requests.api";
import { vendorsAPI } from "@/lib/services/vendors.api";
import { AdminPayoutRequest, Vendor } from "@/types";

type TabKey = "pending" | "approved" | "paid" | "failed" | "rejected";

function StatCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3.5">
      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{label}</p>
      <p className={`mt-1 text-2xl font-black ${color ?? "text-[#101820]"}`}>{value}</p>
    </div>
  );
}

export default function PayoutRequestsPage() {
  const [items, setItems] = useState<AdminPayoutRequest[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<TabKey>("pending");
  const [searchQuery, setSearchQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pendingPaidRequest, setPendingPaidRequest] = useState<AdminPayoutRequest | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [transferProofUrl, setTransferProofUrl] = useState("");
  const [rejectingRequest, setRejectingRequest] = useState<AdminPayoutRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [page, setPage] = useState(1);
  const perPage = 6;
  const { selectedCurrency } = useAdminDisplayCurrency(items[0]?.currency ?? "GBP");

  const vendorMap = useMemo(() => new Map(vendors.map(v => [v.id, v.storeName])), [vendors]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true); setError("");
      const [payouts, vendorList] = await Promise.all([
        payoutRequestsAPI.getPayoutRequests(),
        vendorsAPI.getVendors().catch(() => []),
      ]);
      setItems(payouts); setVendors(vendorList);
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Failed to load payout requests");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  const handleApprove = async (item: AdminPayoutRequest) => {
    try { setBusyId(item.id); await payoutRequestsAPI.approvePayoutRequest(item.id); await loadData(); }
    catch (err) { alert(err instanceof APIError ? err.message : "Failed to approve"); }
    finally { setBusyId(null); }
  };

  const handleReject = async () => {
    if (!rejectingRequest) return;
    try { setBusyId(rejectingRequest.id); await payoutRequestsAPI.rejectPayoutRequest(rejectingRequest.id, rejectionReason || undefined); setRejectingRequest(null); setRejectionReason(""); await loadData(); }
    catch (err) { alert(err instanceof APIError ? err.message : "Failed to reject"); }
    finally { setBusyId(null); }
  };

  const handleMarkPaid = async (item: AdminPayoutRequest, code?: string, proof?: string) => {
    try { setBusyId(item.id); await payoutRequestsAPI.markPayoutRequestPaid(item.id, code, proof); setPendingPaidRequest(null); setTwoFactorCode(""); setTransferProofUrl(""); await loadData(); }
    catch (err) { if (err instanceof API2FARequiredError) setPendingPaidRequest(item); else alert(err instanceof APIError ? err.message : "Failed to mark paid"); }
    finally { setBusyId(null); }
  };

  const stats = useMemo(() => {
    const pending = items.filter(i => i.status === "PENDING");
    const approved = items.filter(i => i.status === "APPROVED");
    const paid = items.filter(i => i.status === "PAID");
    const rejected = items.filter(i => i.status === "REJECTED");
    return {
      pendingAmount: pending.reduce((s, i) => s + i.amount, 0),
      count: pending.length,
      approvedToday: approved.reduce((s, i) => s + i.amount, 0),
      paidToday: paid.reduce((s, i) => s + i.amount, 0),
      failed: 0,
      rejected: rejected.length,
    };
  }, [items]);

  const filteredItems = useMemo(() => {
    let list = items;
    if (activeTab === "pending") list = list.filter(i => i.status === "PENDING");
    else if (activeTab === "approved") list = list.filter(i => i.status === "APPROVED");
    else if (activeTab === "paid") list = list.filter(i => i.status === "PAID");
    else if (activeTab === "rejected") list = list.filter(i => i.status === "REJECTED");
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(i => (vendorMap.get(i.vendorId) ?? "").toLowerCase().includes(q) || i.id.includes(q));
    }
    return list;
  }, [items, activeTab, searchQuery, vendorMap]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / perPage));
  const pagedItems = filteredItems.slice((page - 1) * perPage, page * perPage);

  const today = new Date();
  const dateRange = `${new Date(today.getFullYear(), today.getMonth(), 1).toLocaleDateString("en-GB", { month: "short", day: "numeric" })} - ${today.toLocaleDateString("en-GB", { month: "short", day: "numeric", year: "numeric" })}`;

  const tabs: { key: TabKey; label: string }[] = [
    { key: "pending", label: `Pending (${items.filter(i => i.status === "PENDING").length})` },
    { key: "approved", label: "Approved" },
    { key: "paid", label: "Paid" },
    { key: "failed", label: "Failed" },
    { key: "rejected", label: "Rejected" },
  ];

  const fmtAmt = (v: number, cur: string) => formatDisplayMoney(v, cur, selectedCurrency);

  return (
    <ProtectedRoute>
      <AdminLayout>
        {loading ? <LoadingPanel label="Loading payout requests..." /> : (
          <div className="space-y-5">
            {/* Header */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h1 className="text-2xl font-black tracking-tight text-[#101820]">Payout Requests</h1>
                <p className="text-[13px] text-slate-400">GBP {stats.pendingAmount.toLocaleString("en-GB")} pending payouts</p>
              </div>
              <div className="flex items-center gap-2">
                <button className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-[13px] font-medium text-slate-600">
                  {dateRange} <svg className="h-3.5 w-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>
                <div className="flex items-center rounded-xl border border-slate-200 bg-white px-3 py-2 gap-2">
                  <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path strokeLinecap="round" strokeWidth={2} d="m20 20-3.5-3.5" /></svg>
                  <input value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setPage(1); }} placeholder="Search..." className="w-32 bg-transparent text-[13px] outline-none" />
                </div>
              </div>
            </div>

            {error && <ErrorPanel message={error} onRetry={() => void loadData()} />}

            {/* Stat Cards */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
              <StatCard label="Pending" value={`GBP ${stats.pendingAmount.toLocaleString("en-GB")}`} color="text-emerald-600" />
              <StatCard label="Count" value={stats.count} color="text-blue-500" />
              <StatCard label="Approved Today" value={`GBP ${stats.approvedToday.toLocaleString("en-GB")}`} color="text-emerald-600" />
              <StatCard label="Paid Today" value={`GBP ${stats.paidToday.toLocaleString("en-GB")}`} color="text-emerald-600" />
              <StatCard label="Failed" value={stats.failed} color="text-red-500" />
              <StatCard label="Rejected" value={stats.rejected} color="text-red-500" />
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
              {pagedItems.length === 0 ? (
                <div className="p-12 text-center text-sm text-slate-400">No payout requests found</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr className="border-b border-slate-100 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        <th className="px-4 py-3.5">Payout ID</th>
                        <th className="px-4 py-3.5">Vendor</th>
                        <th className="px-4 py-3.5">Amount</th>
                        <th className="px-4 py-3.5">Method</th>
                        <th className="px-4 py-3.5">Country</th>
                        <th className="px-4 py-3.5">Requested</th>
                        <th className="px-4 py-3.5">Status</th>
                        <th className="px-4 py-3.5">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedItems.map((item, idx) => (
                        <tr key={item.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                          <td className="px-4 py-3.5 text-[12px] font-medium text-slate-700">PAY-{(filteredItems.length - ((page - 1) * perPage + idx)).toString().padStart(4, "0")}</td>
                          <td className="px-4 py-3.5 text-[12px] text-slate-700">{vendorMap.get(item.vendorId) ?? "Unknown"}</td>
                          <td className="px-4 py-3.5 text-[12px] font-medium text-slate-800">GBP {item.amount.toFixed(2)}</td>
                          <td className="px-4 py-3.5 text-[12px] text-slate-600">{item.payoutMethod?.type === "BANK_TRANSFER" ? "Bank Transfer" : item.payoutMethod?.details?.provider === "stripe" ? "Stripe Payout" : "Bank Transfer"}</td>
                          <td className="px-4 py-3.5 text-[12px] text-slate-600">{item.payoutMethod?.details?.country ?? "—"}</td>
                          <td className="px-4 py-3.5 text-[12px] text-slate-500">{item.createdAt ? new Date(item.createdAt).toLocaleDateString("en-GB", { month: "short", day: "numeric" }) : "—"}</td>
                          <td className="px-4 py-3.5"><PayoutStatusBadge status={item.status} /></td>
                          <td className="px-4 py-3.5">
                            <div className="flex gap-2">
                              {item.status === "PENDING" && (
                                <>
                                  <button disabled={busyId === item.id} onClick={() => void handleApprove(item)} className="rounded-lg bg-emerald-50 px-3 py-1.5 text-[11px] font-bold text-emerald-600 hover:bg-emerald-100 transition disabled:opacity-50">Approve</button>
                                  <button disabled={busyId === item.id} onClick={() => setRejectingRequest(item)} className="rounded-lg bg-red-50 px-3 py-1.5 text-[11px] font-bold text-red-500 hover:bg-red-100 transition disabled:opacity-50">Reject</button>
                                </>
                              )}
                              {item.status === "APPROVED" && (
                                <button disabled={busyId === item.id} onClick={() => void handleMarkPaid(item)} className="rounded-lg bg-blue-50 px-3 py-1.5 text-[11px] font-bold text-blue-600 hover:bg-blue-100 transition disabled:opacity-50">Mark Paid</button>
                              )}
                              {(item.status === "PAID" || item.status === "REJECTED") && (
                                <span className="rounded-lg bg-red-50 px-3 py-1.5 text-[11px] font-bold text-red-500">Reject</span>
                              )}
                            </div>
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
              <p className="text-[12px] text-slate-400">Showing {(page - 1) * perPage + 1}-{Math.min(page * perPage, filteredItems.length)} of many records</p>
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

        {/* Mark Paid Modal */}
        {pendingPaidRequest && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4">
            <Card className="w-full max-w-md">
              <h3 className="text-xl font-black text-[#101820]">Confirm Payout</h3>
              <p className="mt-2 text-sm text-slate-500">Confirm payout of <span className="font-bold">{fmtAmt(pendingPaidRequest.amount, pendingPaidRequest.currency)}</span> for <span className="font-bold">{vendorMap.get(pendingPaidRequest.vendorId) ?? "vendor"}</span>.</p>
              <input value={transferProofUrl} onChange={e => setTransferProofUrl(e.target.value)} placeholder="Transfer proof URL (optional)" className="mt-3 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none" />
              <input value={twoFactorCode} onChange={e => setTwoFactorCode(e.target.value)} placeholder="2FA code" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none" />
              <div className="mt-4 flex gap-3">
                <button onClick={() => void handleMarkPaid(pendingPaidRequest, twoFactorCode, transferProofUrl || undefined)} className="flex-1 rounded-xl bg-[#096B4A] px-4 py-2.5 text-sm font-bold text-white">Confirm</button>
                <button onClick={() => { setPendingPaidRequest(null); setTwoFactorCode(""); setTransferProofUrl(""); }} className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600">Cancel</button>
              </div>
            </Card>
          </div>
        )}

        {/* Reject Modal */}
        {rejectingRequest && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4">
            <Card className="w-full max-w-md">
              <h3 className="text-xl font-black text-[#101820]">Reject Payout</h3>
              <textarea rows={3} value={rejectionReason} onChange={e => setRejectionReason(e.target.value)} placeholder="Rejection reason..." className="mt-3 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none" />
              <div className="mt-4 flex gap-3">
                <button onClick={() => void handleReject()} className="flex-1 rounded-xl bg-red-500 px-4 py-2.5 text-sm font-bold text-white">Reject</button>
                <button onClick={() => { setRejectingRequest(null); setRejectionReason(""); }} className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600">Cancel</button>
              </div>
            </Card>
          </div>
        )}
      </AdminLayout>
    </ProtectedRoute>
  );
}

function PayoutStatusBadge({ status }: { status: string }) {
  if (status === "PENDING") return <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-600">Pending</span>;
  if (status === "APPROVED") return <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-600">Approved</span>;
  if (status === "PAID") return <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-600">Paid</span>;
  if (status === "REJECTED") return <span className="rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-bold text-red-500">Rejected</span>;
  return <span className="rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-bold text-red-500">Failed</span>;
}
