"use client";

import { Fragment, useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Badge, Button, Card, downloadCsv, ErrorPanel, LoadingPanel, MetricCard, PageHeader } from "@/components/AdminUI";
import ProtectedRoute from "@/components/ProtectedRoute";
import { APIError } from "@/lib/api";
import { communityBuyAdminAPI, type CampaignLedger, type LedgerSummaryRow } from "@/lib/services/communityBuy.api";

function centsToUnit(value: unknown): number {
  return typeof value === "number" ? value / 100 : 0;
}

function money(valueMinor: number, currency: string): string {
  return `${centsToUnit(valueMinor).toFixed(2)} ${currency}`;
}

export default function CommunityLedgerPage() {
  const [rows, setRows] = useState<LedgerSummaryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<CampaignLedger | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      setRows(await communityBuyAdminAPI.getLedgerSummary());
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Could not load the ledger.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const toggleExpand = async (campaignId: string) => {
    if (expandedId === campaignId) {
      setExpandedId(null);
      setDetail(null);
      return;
    }
    setExpandedId(campaignId);
    setDetail(null);
    setDetailLoading(true);
    try {
      setDetail(await communityBuyAdminAPI.getCampaignLedger(campaignId));
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Could not load campaign ledger detail.");
    } finally {
      setDetailLoading(false);
    }
  };

  const exportCsv = () => {
    downloadCsv(
      `community-buy-ledger-${new Date().toISOString().slice(0, 10)}.csv`,
      rows.map((r) => ({
        campaign: r.title,
        currency: r.currency,
        contributions: r.contributionCount,
        total_contributed: centsToUnit(r.totalContributed).toFixed(2),
        total_refunded: centsToUnit(r.totalRefunded).toFixed(2),
        total_paid_to_supplier: centsToUnit(r.totalPaidToSupplier).toFixed(2),
        net_position: centsToUnit(r.netPosition).toFixed(2),
      })),
    );
  };

  const totalContributed = rows.reduce((sum, r) => sum + r.totalContributed, 0);
  const totalRefunded = rows.reduce((sum, r) => sum + r.totalRefunded, 0);
  const totalPaidToSupplier = rows.reduce((sum, r) => sum + r.totalPaidToSupplier, 0);
  const displayCurrency = rows[0]?.currency ?? "GBP";
  const singleCurrency = rows.every((r) => r.currency === displayCurrency);

  return (
    <ProtectedRoute>
      <AdminLayout>
        <div className="space-y-8">
          <PageHeader
            title="Community Buy Financial Ledger"
            subtitle="A read-only reconciliation of money that has actually moved through Community Buy — contributions received, refunds issued, and supplier payments released. Eki holds no custody of these funds; Stripe settles every row shown here."
            actions={
              <Button variant="secondary" onClick={exportCsv} disabled={rows.length === 0}>
                Export CSV
              </Button>
            }
          />

          {error ? <ErrorPanel message={error} onRetry={() => void load()} /> : null}

          {loading ? (
            <LoadingPanel label="Loading ledger..." />
          ) : rows.length === 0 ? (
            <Card className="py-12 text-center">
              <p className="text-base font-semibold text-slate-700">No financial activity yet.</p>
              <p className="mt-2 text-sm text-slate-500">Rows appear here once a campaign has a paid contribution, a completed refund, or a released supplier payment.</p>
            </Card>
          ) : (
            <>
              {singleCurrency ? (
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
                  <MetricCard icon="money" label="Total contributed" value={money(totalContributed, displayCurrency)} tone="green" />
                  <MetricCard icon="refresh" label="Total refunded" value={money(totalRefunded, displayCurrency)} tone="amber" />
                  <MetricCard icon="cash" label="Total paid to suppliers" value={money(totalPaidToSupplier, displayCurrency)} tone="blue" />
                </div>
              ) : null}

              <Card>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead>
                      <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        <th className="px-4 py-3">Campaign</th>
                        <th className="px-4 py-3">Contributions</th>
                        <th className="px-4 py-3">Contributed</th>
                        <th className="px-4 py-3">Refunded</th>
                        <th className="px-4 py-3">Paid to supplier</th>
                        <th className="px-4 py-3">Net position</th>
                        <th className="px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {rows.map((r) => (
                        <Fragment key={r.campaignId}>
                          <tr className="text-sm text-slate-700">
                            <td className="px-4 py-3 font-semibold text-[#101820]">{r.title}</td>
                            <td className="px-4 py-3">{r.contributionCount}</td>
                            <td className="px-4 py-3">{money(r.totalContributed, r.currency)}</td>
                            <td className="px-4 py-3">{money(r.totalRefunded, r.currency)}</td>
                            <td className="px-4 py-3">{money(r.totalPaidToSupplier, r.currency)}</td>
                            <td className="px-4 py-3 font-semibold">{money(r.netPosition, r.currency)}</td>
                            <td className="px-4 py-3">
                              <Button variant="ghost" onClick={() => void toggleExpand(r.campaignId)}>
                                {expandedId === r.campaignId ? "Hide" : "View entries"}
                              </Button>
                            </td>
                          </tr>
                          {expandedId === r.campaignId ? (
                            <tr>
                              <td colSpan={7} className="bg-slate-50 px-4 py-4">
                                {detailLoading ? (
                                  <p className="text-sm text-slate-500">Loading entries...</p>
                                ) : detail && detail.campaign.id === r.campaignId ? (
                                  detail.entries.length === 0 ? (
                                    <p className="text-sm text-slate-500">No itemized entries.</p>
                                  ) : (
                                    <ul className="space-y-2">
                                      {detail.entries.map((e) => (
                                        <li key={e.id} className="flex items-center justify-between text-sm">
                                          <span className="flex items-center gap-3">
                                            <Badge tone={e.direction === "CREDIT" ? "green" : "amber"}>{e.direction === "CREDIT" ? "Credit" : "Debit"}</Badge>
                                            <span className="text-slate-700">{e.description}</span>
                                            <span className="text-xs text-slate-400">{new Date(e.occurredAt).toLocaleString()}</span>
                                          </span>
                                          <span className="font-semibold text-[#101820]">{money(e.amount, r.currency)}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  )
                                ) : null}
                              </td>
                            </tr>
                          ) : null}
                        </Fragment>
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
