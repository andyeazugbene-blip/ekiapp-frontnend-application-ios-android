"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import AdminLayout from "@/components/AdminLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Badge, Button, Card, ErrorPanel, LoadingPanel, PageHeader } from "@/components/AdminUI";
import { Banner, DataTable, Pagination, QueueTile, SearchInput, StatusTabs, formatDate, formatMinor, type Column } from "@/components/AdminKit";
import { NoAccess } from "@/components/PageStates";
import { FREQUENCY_LABEL, paymentBadge, statusBadge } from "@/components/SubscriptionBits";
import { APIError } from "@/lib/api";
import { usePermissions } from "@/lib/hooks/usePermissions";
import {
  subscriptionsAdminAPI,
  type SubscriptionCounts,
  type SubscriptionReports,
  type SubscriptionRow,
} from "@/lib/services/regularDeliveries.api";

const TABS: Array<{ key: string; label: string; countKey: keyof SubscriptionCounts }> = [
  { key: "", label: "All", countKey: "all" },
  { key: "active", label: "Active", countKey: "active" },
  { key: "renewal-due", label: "Renewal due", countKey: "renewal-due" },
  { key: "skip-requested", label: "Skip requested", countKey: "skip-requested" },
  { key: "paused", label: "Paused", countKey: "paused" },
  { key: "payment-failed", label: "Payment failed", countKey: "payment-failed" },
  { key: "stock-exception", label: "Stock exception", countKey: "stock-exception" },
  { key: "cancelled", label: "Cancelled", countKey: "cancelled" },
];

function basketSummary(basket: SubscriptionRow["basket"]): string {
  if (basket.length === 0) return "Empty basket";
  const first = basket.slice(0, 2).map((b) => `${b.title} x${b.quantity}`).join(", ");
  return basket.length > 2 ? `${first} +${basket.length - 2} more` : first;
}

function ReportsView() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<SubscriptionReports | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    try { setLoading(true); setError(""); setData(await subscriptionsAdminAPI.reports(days)); }
    catch (e) { setError(e instanceof APIError ? e.message : "Failed to load reports"); }
    finally { setLoading(false); }
  }, [days]);
  useEffect(() => { void load(); }, [load]);

  const pct = (v: number | null | undefined) => (v == null ? "Not available" : `${v}%`);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm font-bold text-slate-600" htmlFor="rep-days">Period</label>
        <select id="rep-days" value={days} onChange={(e) => setDays(Number(e.target.value))} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold">
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
          <option value={365}>Last 12 months</option>
        </select>
      </div>
      {error ? <ErrorPanel message={error} onRetry={() => void load()} /> : null}
      {loading && !data ? <LoadingPanel label="Loading reports…" /> : null}
      {data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <QueueTile label="Active subscriptions" value={data.activeSubscriptions} tone="green" hint="Right now" />
            <QueueTile
              label={`Recurring revenue (${data.periodDays}d)`}
              value={data.recurringRevenue.length === 0 ? "—" : data.recurringRevenue.map((r) => formatMinor(r.amountMinor, r.currency)).join(" · ")}
              hint="Paid cycles, original currency"
            />
            <QueueTile label="Churn" value={data.churn.cancelledInPeriod} tone={data.churn.cancelledInPeriod > 0 ? "amber" : "gray"} hint={`Rate ${pct(data.churn.ratePct)} (${data.churn.rateBasis})`} />
            <QueueTile label="Payment recovery rate" value={pct(data.paymentRecovery.ratePct)} tone="blue" hint={`${data.paymentRecovery.recovered} of ${data.paymentRecovery.cyclesWithFailedPayment} cycles with a failed charge later paid`} />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <h2 className="text-xl font-black">Fulfilment success</h2>
              <p className="mt-1 text-3xl font-black">{pct(data.fulfilment.successRatePct)}</p>
              <p className="mt-2 text-sm text-slate-600">
                {data.fulfilment.ordersCreated} orders created out of {data.fulfilment.cyclesDue} cycles that came due
                ({data.fulfilment.failedOrCancelled} failed or cancelled). {data.fulfilment.skipped} skipped cycles are not counted as failures.
              </p>
            </Card>
            <Card>
              <h2 className="text-xl font-black">Cancellation reasons</h2>
              {data.cancellationReasons.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">No cancellations in this period.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {data.cancellationReasons.map((r) => (
                    <li key={r.reason} className="flex items-center justify-between text-sm">
                      <span className="font-semibold text-slate-700">{r.reason}</span>
                      <Badge tone="gray">{r.count}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
}

function SubscriptionsInner() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const q = params.get("q") ?? "";
  const status = params.get("status") ?? "";
  const vendorId = params.get("vendorId") ?? "";
  const renewalFrom = params.get("renewalFrom") ?? "";
  const renewalTo = params.get("renewalTo") ?? "";
  const view = params.get("view") === "reports" ? "reports" : "queue";

  const setParams = useCallback((patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) { if (v == null || v === "") next.delete(k); else next.set(k, v); }
    router.replace(`${pathname}?${next.toString()}`);
  }, [params, pathname, router]);

  const [rows, setRows] = useState<SubscriptionRow[]>([]);
  const [counts, setCounts] = useState<SubscriptionCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cursor, setCursor] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const stack = useRef<Array<string | null>>([]);

  const key = `${q}|${status}|${vendorId}|${renewalFrom}|${renewalTo}`;
  useEffect(() => { stack.current = []; setCursor(null); }, [key]);

  const load = useCallback(async () => {
    try {
      setLoading(true); setError("");
      const res = await subscriptionsAdminAPI.list({ q, status, vendorId, renewalFrom, renewalTo, cursor });
      setRows(res.items); setNextCursor(res.nextCursor); setCounts(res.counts);
    } catch (e) { setError(e instanceof APIError ? e.message : "Failed to load Foodstuffs Subscriptions"); }
    finally { setLoading(false); }
  }, [q, status, vendorId, renewalFrom, renewalTo, cursor]);
  useEffect(() => { if (view === "queue") void load(); }, [load, view]);

  const columns: Column<SubscriptionRow>[] = [
    { key: "buyer", header: "Buyer", render: (s) => <div><p className="font-black text-slate-900">{s.buyer.name || "Name not provided"}</p><p className="text-xs font-semibold text-slate-500">{s.buyer.email}</p></div> },
    { key: "vendor", header: "Vendor", render: (s) => <div><p className="font-bold text-slate-800">{s.vendor.storeName}</p><p className="text-xs font-semibold text-slate-500">{s.offerTitle}</p></div> },
    { key: "basket", header: "Basket", render: (s) => <span className="text-sm font-semibold text-slate-700">{basketSummary(s.basket)}</span> },
    { key: "freq", header: "Frequency", render: (s) => <span className="text-sm font-semibold">{FREQUENCY_LABEL[s.frequency] ?? s.frequency}</span> },
    { key: "next", header: "Next renewal", render: (s) => <span className="text-sm font-semibold">{s.status === "ACTIVE" || s.status === "PAYMENT_ATTENTION" ? formatDate(s.nextRenewalAt) : s.pausedUntil ? `Resumes ${formatDate(s.pausedUntil)}` : "—"}</span> },
    { key: "status", header: "Status", render: (s) => statusBadge(s) },
    { key: "pay", header: "Payment", render: (s) => paymentBadge(s.paymentState) },
    { key: "act", header: "", className: "text-right", render: (s) => <Link href={`/subscriptions/${s.id}`} className="text-sm font-bold text-[#096B4A] hover:underline" onClick={(e) => e.stopPropagation()}>View</Link> },
  ];

  const activeTab = TABS.some((t) => t.key === status) ? status : "";

  return (
    <div className="space-y-5">
      <PageHeader
        title="Foodstuffs Subscriptions"
        subtitle="Buyer baskets that renew on a schedule. Monitor every subscription, understand why a renewal is stuck and step in with an audited action."
        actions={<Link href="/subscription-exceptions" className="inline-flex h-11 items-center rounded-xl border border-[#096B4A] bg-white px-5 text-sm font-bold text-[#096B4A] hover:bg-emerald-50">Renewal exceptions queue</Link>}
      />
      <div className="flex gap-2" role="tablist" aria-label="View">
        <button role="tab" aria-selected={view === "queue"} onClick={() => setParams({ view: null })} className={`rounded-xl border px-4 py-2 text-sm font-bold ${view === "queue" ? "border-[#101820] bg-[#101820] text-white" : "border-slate-200 bg-white text-slate-700"}`}>Subscriptions</button>
        <button role="tab" aria-selected={view === "reports"} onClick={() => setParams({ view: "reports" })} className={`rounded-xl border px-4 py-2 text-sm font-bold ${view === "reports" ? "border-[#101820] bg-[#101820] text-white" : "border-slate-200 bg-white text-slate-700"}`}>Reports</button>
      </div>

      {view === "reports" ? <ReportsView /> : (
        <>
          {error ? <ErrorPanel message={error} onRetry={() => void load()} /> : null}
          <Card className="space-y-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <SearchInput value={q} onChange={(v) => setParams({ q: v })} placeholder="Search buyer name, email, vendor store or subscription ID" />
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-600">
                Next renewal from
                <input type="date" value={renewalFrom} onChange={(e) => setParams({ renewalFrom: e.target.value })} className="h-11 rounded-xl border border-slate-200 px-3 text-sm" />
              </label>
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-600">
                to
                <input type="date" value={renewalTo} onChange={(e) => setParams({ renewalTo: e.target.value })} className="h-11 rounded-xl border border-slate-200 px-3 text-sm" />
              </label>
            </div>
            {vendorId ? (
              <Banner tone="info">
                Filtered to one vendor. <button className="font-black underline" onClick={() => setParams({ vendorId: null })}>Clear vendor filter</button>
              </Banner>
            ) : null}
            <StatusTabs
              tabs={TABS.map((t) => ({ key: t.key, label: t.label, count: counts ? counts[t.countKey] : null }))}
              active={activeTab}
              onChange={(k) => setParams({ status: k })}
            />
            {loading && rows.length === 0 ? <LoadingPanel label="Loading Foodstuffs Subscriptions…" /> : (
              <>
                <DataTable columns={columns} rows={rows} rowKey={(s) => s.id} onRowClick={(s) => router.push(`/subscriptions/${s.id}`)} loading={loading} emptyTitle="No subscriptions match these filters" />
                <Pagination
                  hasPrev={stack.current.length > 0} hasNext={Boolean(nextCursor)} shown={rows.length} total={counts ? counts[(activeTab || "all") as keyof SubscriptionCounts] : null} loading={loading}
                  onPrev={() => setCursor(stack.current.pop() ?? null)}
                  onNext={() => { stack.current.push(cursor); setCursor(nextCursor); }}
                />
              </>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

export default function SubscriptionsPage() {
  const { has, loading } = usePermissions();
  return (
    <ProtectedRoute>
      <AdminLayout>
        {loading ? <LoadingPanel label="Checking access…" /> : !has("subscriptions.read") ? <NoAccess what="Foodstuffs Subscriptions" /> : (
          <Suspense fallback={<LoadingPanel label="Loading…" />}><SubscriptionsInner /></Suspense>
        )}
      </AdminLayout>
    </ProtectedRoute>
  );
}
