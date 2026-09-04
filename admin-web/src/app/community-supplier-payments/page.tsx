"use client";

import { useCallback, useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Card, ErrorPanel, LoadingPanel } from "@/components/AdminUI";
import ProtectedRoute from "@/components/ProtectedRoute";
import { APIError } from "@/lib/api";
import { communityBuyAdminAPI, SupplierPaymentAggregate, SupplierPaymentStatus } from "@/lib/services/communityBuy.api";

const STATUS_OPTIONS: { value: SupplierPaymentStatus | ""; label: string }[] = [
  { value: "", label: "All statuses" },
  { value: "NOT_RELEASED", label: "Pending" },
  { value: "PROCESSING", label: "Processing" },
  { value: "PAID", label: "Released" },
  { value: "ON_HOLD", label: "Held" },
  { value: "FAILED", label: "Failed" },
];

function money(amountMinor: number, currency: string): string {
  return `${currency} ${(amountMinor / 100).toLocaleString("en-GB", { minimumFractionDigits: 2 })}`;
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3.5">
      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{label}</p>
      <p className="mt-1 text-xl font-black text-[#101820]">{value}</p>
    </div>
  );
}

/**
 * Real cross-campaign/cross-supplier aggregate view (architecture doc gap
 * closure) — every figure comes straight from CampaignSupplierPayment rows
 * via the backend's getSupplierPaymentAggregate(). Currencies are never
 * summed together.
 */
export default function CommunitySupplierPaymentsPage() {
  const [data, setData] = useState<SupplierPaymentAggregate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<SupplierPaymentStatus | "">("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      setData(await communityBuyAdminAPI.getSupplierPaymentAggregate({
        status: status || undefined,
        from: from || undefined,
        to: to || undefined,
      }));
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Failed to load supplier payment totals");
    } finally {
      setLoading(false);
    }
  }, [status, from, to]);

  useEffect(() => { void loadData(); }, [loadData]);

  return (
    <ProtectedRoute>
      <AdminLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-[#101820]">Supplier Payments — Aggregate</h1>
            <p className="text-[13px] text-slate-400">Real totals from actual supplier payment records. Currencies are never combined.</p>
          </div>

          <Card>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Status</label>
                <select value={status} onChange={(e) => setStatus(e.target.value as SupplierPaymentStatus | "")} className="mt-1 rounded-xl border border-slate-200 px-3 py-2 text-sm">
                  {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider">From</label>
                <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 rounded-xl border border-slate-200 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider">To</label>
                <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 rounded-xl border border-slate-200 px-3 py-2 text-sm" />
              </div>
            </div>
          </Card>

          {error && <ErrorPanel message={error} onRetry={() => void loadData()} />}

          {loading ? (
            <LoadingPanel label="Loading supplier payment totals..." />
          ) : !data || data.totalsByCurrency.length === 0 ? (
            <Card><p className="p-4 text-center text-sm text-slate-400">No supplier payments match these filters.</p></Card>
          ) : (
            <>
              {data.totalsByCurrency.map((c) => (
                <Card key={c.currency}>
                  <h2 className="text-base font-black text-[#101820]">{c.currency} totals ({c.count} payment{c.count === 1 ? "" : "s"})</h2>
                  <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
                    <StatCard label="Total" value={money(c.totalAmount, c.currency)} />
                    <StatCard label="Released" value={money(c.totalReleased, c.currency)} />
                    <StatCard label="Pending" value={money(c.totalPending, c.currency)} />
                    <StatCard label="Held" value={money(c.totalHeld, c.currency)} />
                    <StatCard label="Failed" value={money(c.totalFailed, c.currency)} />
                  </div>
                </Card>
              ))}

              <Card>
                <h2 className="text-base font-black text-[#101820]">By supplier</h2>
                <div className="mt-3 overflow-x-auto">
                  <table className="min-w-full text-left text-[12px]">
                    <thead>
                      <tr className="border-b border-slate-100 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        <th className="px-3 py-2">Supplier</th>
                        <th className="px-3 py-2">Currency</th>
                        <th className="px-3 py-2">Payments</th>
                        <th className="px-3 py-2">Total</th>
                        <th className="px-3 py-2">Released</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.bySupplier.map((s) => (
                        <tr key={`${s.supplierId}:${s.currency}`} className="border-b border-slate-50">
                          <td className="px-3 py-2 font-medium text-slate-700">{s.supplierName}</td>
                          <td className="px-3 py-2 text-slate-500">{s.currency}</td>
                          <td className="px-3 py-2 text-slate-500">{s.count}</td>
                          <td className="px-3 py-2 font-semibold text-slate-800">{money(s.totalAmount, s.currency)}</td>
                          <td className="px-3 py-2 text-emerald-600">{money(s.totalReleased, s.currency)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

              <Card>
                <h2 className="text-base font-black text-[#101820]">By campaign</h2>
                <div className="mt-3 overflow-x-auto">
                  <table className="min-w-full text-left text-[12px]">
                    <thead>
                      <tr className="border-b border-slate-100 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        <th className="px-3 py-2">Campaign</th>
                        <th className="px-3 py-2">Amount</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2">Released</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.byCampaign.map((c) => (
                        <tr key={c.campaignId} className="border-b border-slate-50">
                          <td className="px-3 py-2 font-medium text-slate-700">{c.campaignTitle}</td>
                          <td className="px-3 py-2 text-slate-700">{money(c.amount, c.currency)}</td>
                          <td className="px-3 py-2 text-slate-500">{c.status.replace(/_/g, " ")}</td>
                          <td className="px-3 py-2 text-slate-500">{c.releasedAt ? new Date(c.releasedAt).toLocaleDateString("en-GB") : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          )}
        </div>
      </AdminLayout>
    </ProtectedRoute>
  );
}
