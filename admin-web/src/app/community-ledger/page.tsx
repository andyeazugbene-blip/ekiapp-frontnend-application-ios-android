"use client";

import { Fragment, useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Badge, Button, Card, downloadCsv, ErrorPanel, Icon, LoadingPanel, MetricCard, PageHeader, TextLink } from "@/components/AdminUI";
import ProtectedRoute from "@/components/ProtectedRoute";
import { APIError } from "@/lib/api";
import { communityBuyAdminAPI, type CampaignLedger, type CampaignStatus, type FundingOutcome, type LedgerSummaryRow } from "@/lib/services/communityBuy.api";

function centsToUnit(value: unknown): number {
  return typeof value === "number" ? value / 100 : 0;
}

function money(valueMinor: number, currency: string): string {
  return `${centsToUnit(valueMinor).toFixed(2)} ${currency}`;
}

const STATUS_LABEL: Record<CampaignStatus, string> = {
  DRAFT: "Draft", UNDER_REVIEW: "Under review", CHANGES_REQUIRED: "Changes requested", APPROVED: "Approved",
  REJECTED: "Rejected", LIVE: "Live", PAUSED: "Paused", RESCUE_WINDOW: "Needs more participants",
  SUCCEEDED: "Succeeded", FAILED: "Did not reach minimum", REFUNDING: "Refunding", FULFILLING: "Proceeding",
  COMPLETED: "Completed", FINANCIALLY_CLOSED: "Financially closed", CANCELLED: "Ended",
};
const STATUS_TONE: Record<CampaignStatus, "green" | "amber" | "red" | "blue" | "gray"> = {
  DRAFT: "gray", UNDER_REVIEW: "amber", CHANGES_REQUIRED: "amber", APPROVED: "blue", REJECTED: "red",
  LIVE: "blue", PAUSED: "gray", RESCUE_WINDOW: "amber", SUCCEEDED: "green", FAILED: "amber",
  REFUNDING: "amber", FULFILLING: "blue", COMPLETED: "green", FINANCIALLY_CLOSED: "gray", CANCELLED: "red",
};
const FUNDING_OUTCOME_LABEL: Record<FundingOutcome, string> = {
  PENDING: "Not yet decided", GOAL_REACHED: "Goal reached", MINIMUM_REACHED: "Minimum reached", BELOW_MINIMUM: "Below minimum",
};
const ENTRY_TYPE_LABEL: Record<string, string> = {
  CONTRIBUTION: "Contribution", REFUND: "Refund", SUPPLIER_PAYMENT: "Supplier payment",
};

export default function CommunityLedgerPage() {
  const [rows, setRows] = useState<LedgerSummaryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<CampaignLedger | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = async (bypassCache = false) => {
    try {
      bypassCache ? setRefreshing(true) : setLoading(true);
      setError("");
      setRows(await communityBuyAdminAPI.getLedgerSummary(bypassCache ? { bypassCache: true } : undefined));
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Could not load the ledger.");
    } finally {
      setLoading(false);
      setRefreshing(false);
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
              <>
                <Button variant="ghost" disabled={refreshing} onClick={() => void load(true)}><Icon name="refresh" className="h-4 w-4" />{refreshing ? "Refreshing..." : "Refresh"}</Button>
                <Button variant="secondary" onClick={exportCsv} disabled={rows.length === 0}>
                  Export CSV
                </Button>
              </>
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
                        <th className="px-4 py-3">Status</th>
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
                            <td className="px-4 py-3 font-semibold text-[#101820]">
                              {r.title}
                              <div><TextLink href={`/activity-logs?entityId=${r.campaignId}`}>Audit history</TextLink></div>
                            </td>
                            <td className="px-4 py-3">
                              {r.status ? <Badge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Badge> : <span className="text-slate-400">—</span>}
                              {r.fundingOutcome && r.fundingOutcome !== "PENDING" ? <p className="mt-1 text-xs text-slate-400">{FUNDING_OUTCOME_LABEL[r.fundingOutcome]}</p> : null}
                            </td>
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
                              <td colSpan={8} className="bg-slate-50 px-4 py-4">
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
                                            <Badge tone="gray">{ENTRY_TYPE_LABEL[e.type] ?? e.type}</Badge>
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
