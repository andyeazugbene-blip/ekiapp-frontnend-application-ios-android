"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import AdminLayout from "@/components/AdminLayout";
import { Badge, Card, EmptyState, ErrorPanel, LoadingPanel, PageHeader } from "@/components/AdminUI";
import {
  Banner, Pagination, SearchInput, StatusTabs, formatDateTime, formatMajor, formatMinor, sumByCurrency, useConfirm,
} from "@/components/AdminKit";
import ProtectedRoute from "@/components/ProtectedRoute";
import { APIError } from "@/lib/api";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { payoutRequestsAPI } from "@/lib/services/payout-requests.api";
import { AdminPayoutRequest } from "@/types";

type TabKey = "pending" | "approved" | "attention" | "paid" | "rejected";
const PER_PAGE = 20;

const TAB_STATUSES: Record<TabKey, Array<AdminPayoutRequest["status"]>> = {
  pending: ["PENDING"],
  approved: ["APPROVED"],
  attention: ["ON_HOLD", "PROCESSING"],
  paid: ["PAID"],
  rejected: ["REJECTED"],
};

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3.5">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className={`mt-1 text-xl font-black ${color ?? "text-[#101820]"}`}>{value}</p>
      {sub ? <p className="mt-0.5 text-[11px] font-semibold text-slate-400">{sub}</p> : null}
    </div>
  );
}

function PayoutStatusBadge({ status }: { status: string }) {
  if (status === "PENDING") return <Badge tone="amber">Pending</Badge>;
  if (status === "APPROVED") return <Badge tone="green">Approved - not yet sent</Badge>;
  // A real provider transfer is in flight (or was interrupted mid-flight) - never PAID until confirmed.
  if (status === "PROCESSING") return <Badge tone="blue">Processing</Badge>;
  if (status === "ON_HOLD") return <Badge tone="red">Needs attention</Badge>;
  if (status === "PAID") return <Badge tone="green">Paid</Badge>;
  if (status === "REJECTED") return <Badge tone="red">Rejected</Badge>;
  return <Badge tone="gray">{status}</Badge>;
}

function PayoutRequestsInner() {
  const params = useSearchParams();
  const vendorIdFilter = params.get("vendorId") ?? "";
  const { has, loading: permLoading } = usePermissions();
  const canMutate = has("payouts.mutate");

  const [items, setItems] = useState<AdminPayoutRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [activeTab, setActiveTab] = useState<TabKey>("pending");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const confirm = useConfirm();

  const loadData = useCallback(async () => {
    try {
      setLoading(true); setError("");
      setItems(await payoutRequestsAPI.getPayoutRequests());
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Failed to load payout requests");
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { void loadData(); }, [loadData]);

  const scoped = useMemo(() => (vendorIdFilter ? items.filter((i) => i.vendorId === vendorIdFilter) : items), [items, vendorIdFilter]);

  // Per-currency totals only: payout requests are in each vendor's own currency and are never summed across currencies.
  const stats = useMemo(() => {
    const by = (s: AdminPayoutRequest["status"][]) => scoped.filter((i) => s.includes(i.status));
    const totals = (list: AdminPayoutRequest[]) => sumByCurrency(list, (i) => Math.round(i.amount * 100), (i) => i.currency);
    const fmt = (list: AdminPayoutRequest[]) => totals(list).map((t) => formatMinor(t.amountMinor, t.currency)).join(" · ") || "—";
    return {
      pending: by(["PENDING"]), approved: by(["APPROVED"]), attention: by(["ON_HOLD", "PROCESSING"]), paid: by(["PAID"]), rejected: by(["REJECTED"]),
      fmt,
    };
  }, [scoped]);

  const filtered = useMemo(() => {
    let list = scoped.filter((i) => TAB_STATUSES[activeTab].includes(i.status));
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter((i) => (i.vendorName ?? "").toLowerCase().includes(q) || i.id.toLowerCase().includes(q));
    }
    return list;
  }, [scoped, activeTab, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const paged = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  // Every money action records a reason (also enforced server-side) and shows up in the audit log.
  const handleApprove = (item: AdminPayoutRequest) => confirm.ask(
    {
      title: "Approve this payout?",
      tone: "primary",
      confirmLabel: "Approve payout",
      description: `Approving ${formatMajor(item.amount, item.currency)} for ${item.vendorName ?? "this vendor"} does not send money by itself - Mark paid triggers the actual provider transfer.`,
      reasonLabel: "Reason / what you checked (recorded in the audit log)",
    },
    async (reason) => {
      await payoutRequestsAPI.approvePayoutRequest(item.id, reason);
      setNotice("Payout approved. It is recorded in the audit log.");
      await loadData();
    },
  );

  const handleReject = (item: AdminPayoutRequest) => confirm.ask(
    {
      title: "Reject this payout?",
      confirmLabel: "Reject payout",
      description: `The vendor will see the reason. ${formatMajor(item.amount, item.currency)} for ${item.vendorName ?? "this vendor"}.`,
      reasonLabel: "Rejection reason (shown to the vendor, recorded in the audit log)",
    },
    async (reason) => {
      await payoutRequestsAPI.rejectPayoutRequest(item.id, reason);
      setNotice("Payout rejected. It is recorded in the audit log.");
      await loadData();
    },
  );

  const askMarkPaid = (item: AdminPayoutRequest, retry = false) => confirm.ask(
    {
      title: retry ? "Retry the transfer?" : "Send this payout?",
      tone: "primary",
      confirmLabel: retry ? "Retry transfer" : "Send payout",
      description: retry
        ? "A duplicate transfer cannot be created - the same provider request is safely replayed."
        : `This asks the provider to transfer ${formatMajor(item.amount, item.currency)} to ${item.vendorName ?? "the vendor"}. The payout only shows Paid once the transfer succeeds.`,
      reasonLabel: "Reason / reference (recorded in the audit log)",
    },
    async (reason) => {
      await payoutRequestsAPI.markPayoutRequestPaid(item.id, reason);
      setNotice("Transfer requested. The status below updates once the provider confirms.");
      await loadData();
    },
  );

  const tabs = [
    { key: "pending", label: "Pending", count: stats.pending.length },
    { key: "approved", label: "Approved", count: stats.approved.length },
    { key: "attention", label: "Needs attention", count: stats.attention.length },
    { key: "paid", label: "Paid", count: stats.paid.length },
    { key: "rejected", label: "Rejected", count: stats.rejected.length },
  ];

  if (loading && items.length === 0) return <LoadingPanel label="Loading payout requests..." />;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Payout Requests"
        subtitle="Amounts are shown in each vendor's own currency and are never added together across currencies."
      />

      {error ? <ErrorPanel message={error} onRetry={() => void loadData()} /> : null}
      {notice ? <Banner tone="success">{notice}</Banner> : null}
      {!permLoading && !canMutate ? <Banner tone="info">Your role can view payout requests but cannot approve, reject or send them.</Banner> : null}
      {vendorIdFilter ? (
        <Banner tone="info">Filtered to one vendor{scoped[0]?.vendorName ? `: ${scoped[0].vendorName}` : ""}. <Link className="underline" href="/payout-requests">Clear</Link></Banner>
      ) : null}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        <StatCard label="Pending" value={stats.pending.length} sub={stats.fmt(stats.pending)} color="text-amber-600" />
        <StatCard label="Approved, not yet sent" value={stats.approved.length} sub={stats.fmt(stats.approved)} color="text-emerald-600" />
        <StatCard label="Needs attention" value={stats.attention.length} sub={stats.fmt(stats.attention)} color={stats.attention.length > 0 ? "text-red-500" : "text-slate-400"} />
        <StatCard label="Paid" value={stats.paid.length} sub={stats.fmt(stats.paid)} color="text-emerald-600" />
        <StatCard label="Rejected" value={stats.rejected.length} color="text-red-500" />
      </div>
      <p className="-mt-2 text-xs text-slate-400">Counts and totals cover the requests loaded from the server, all dates.</p>

      <Card className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <StatusTabs tabs={tabs} active={activeTab} onChange={(k) => { setActiveTab(k as TabKey); setPage(1); }} />
          <SearchInput value={searchQuery} onChange={(v) => { setSearchQuery(v); setPage(1); }} placeholder="Search vendor or payout reference" />
        </div>

        {paged.length === 0 ? (
          <EmptyState title="No payout requests in this view" />
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-100">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  <th className="px-4 py-3.5">Reference</th>
                  <th className="px-4 py-3.5">Vendor</th>
                  <th className="px-4 py-3.5">Amount</th>
                  <th className="px-4 py-3.5">Method</th>
                  <th className="px-4 py-3.5">Requested</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((item) => (
                  <tr key={item.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="px-4 py-3.5 text-[12px] font-medium text-slate-700" title={item.id}>PAY-{item.id.slice(-8).toUpperCase()}</td>
                    <td className="px-4 py-3.5 text-[12px] text-slate-700">
                      {item.vendorName ?? "Vendor name not provided"}
                      {item.status === "ON_HOLD" && item.holdReason ? (
                        <p className="mt-0.5 max-w-[240px] text-[11px] text-red-500" title={item.holdReason}>{item.holdReason}</p>
                      ) : null}
                      {item.status === "REJECTED" && item.rejectionReason ? (
                        <p className="mt-0.5 max-w-[240px] text-[11px] text-slate-500" title={item.rejectionReason}>Reason: {item.rejectionReason}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3.5 text-[12px] font-bold text-slate-800">{formatMajor(item.amount, item.currency)}</td>
                    <td className="px-4 py-3.5 text-[12px] text-slate-600">{item.payoutMethod?.label || (item.payoutMethod?.type === "BANK_TRANSFER" ? "Bank transfer" : item.payoutMethod?.type?.replace(/_/g, " ").toLowerCase()) || "Not provided"}</td>
                    <td className="px-4 py-3.5 text-[12px] text-slate-500">{formatDateTime(item.createdAt)}</td>
                    <td className="px-4 py-3.5"><PayoutStatusBadge status={item.status} /></td>
                    <td className="px-4 py-3.5">
                      {!canMutate ? <span className="text-[11px] text-slate-300">View only</span> : (
                        <div className="flex gap-2">
                          {item.status === "PENDING" && (
                            <>
                              <button onClick={() => handleApprove(item)} className="rounded-lg bg-emerald-50 px-3 py-1.5 text-[11px] font-bold text-emerald-600 transition hover:bg-emerald-100">Approve</button>
                              <button onClick={() => handleReject(item)} className="rounded-lg bg-red-50 px-3 py-1.5 text-[11px] font-bold text-red-500 transition hover:bg-red-100">Reject</button>
                            </>
                          )}
                          {item.status === "APPROVED" && (
                            <button onClick={() => askMarkPaid(item)} className="rounded-lg bg-blue-50 px-3 py-1.5 text-[11px] font-bold text-blue-600 transition hover:bg-blue-100">Mark paid</button>
                          )}
                          {(item.status === "ON_HOLD" || item.status === "PROCESSING") && (
                            <button onClick={() => askMarkPaid(item, true)} className="rounded-lg bg-amber-50 px-3 py-1.5 text-[11px] font-bold text-amber-600 transition hover:bg-amber-100">Retry transfer</button>
                          )}
                          {(item.status === "PAID" || item.status === "REJECTED") && <span className="text-[11px] text-slate-300">—</span>}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Pagination
          hasPrev={page > 1} hasNext={page < totalPages} shown={paged.length} total={filtered.length} loading={loading}
          onPrev={() => setPage((p) => Math.max(1, p - 1))} onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
        />
      </Card>
      {confirm.dialog}
    </div>
  );
}

export default function PayoutRequestsPage() {
  return (
    <ProtectedRoute>
      <AdminLayout>
        <Suspense fallback={<LoadingPanel label="Loading payout requests..." />}>
          <PayoutRequestsInner />
        </Suspense>
      </AdminLayout>
    </ProtectedRoute>
  );
}
