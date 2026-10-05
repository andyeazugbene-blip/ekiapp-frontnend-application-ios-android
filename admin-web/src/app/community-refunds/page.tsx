"use client";

import { useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Badge, Button, Card, EmptyState, ErrorPanel, Icon, LoadingPanel, MetricCard, PageHeader, TextLink } from "@/components/AdminUI";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Banner, Pagination, formatDateTime, formatMinor, useConfirm } from "@/components/AdminKit";
import { APIError } from "@/lib/api";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { communityBuyAdminAPI, type AdminCampaignRefund } from "@/lib/services/communityBuy.api";
import { countryDisplayName } from "@/lib/countries";

const PER_PAGE = 25;

function tone(status: AdminCampaignRefund["status"]): "green" | "amber" | "red" {
  if (status === "REFUNDED") return "green";
  if (status === "REFUND_FAILED") return "red";
  return "amber";
}

const REFUND_STATUS_LABEL: Record<AdminCampaignRefund["status"], string> = {
  REFUND_PENDING: "Pending", REFUND_PROCESSING: "Processing", REFUNDED: "Refunded", REFUND_FAILED: "Failed",
};

export default function CommunityRefundsPage() {
  const [items, setItems] = useState<AdminCampaignRefund[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [escalatedIds, setEscalatedIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const confirm = useConfirm();
  // Backend: list = community_buy.read; recheck / escalate = community_buy.mutate (+2FA, prompted globally).
  const { has, loading: permLoading } = usePermissions();
  const canMutate = has("community_buy.mutate");

  const load = async (bypassCache = false) => {
    try {
      bypassCache ? setRefreshing(true) : setLoading(true);
      setError("");
      setItems(await communityBuyAdminAPI.getRefunds(bypassCache ? { bypassCache: true } : undefined));
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Failed to load refunds");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const askRecheck = (r: AdminCampaignRefund) => confirm.ask(
    {
      title: "Recheck this refund with the payment provider?",
      tone: "primary",
      confirmLabel: "Recheck refund",
      description: `${formatMinor(r.amount, r.currency)} for ${r.contribution.participant.user.name}. This re-attempts the refund if it has not completed yet. Requires a 2FA code.`,
      requireReason: false,
    },
    async () => {
      const updated = await communityBuyAdminAPI.requeryRefund(r.id);
      setItems((prev) => prev.map((x) => (x.id === r.id ? updated : x)));
      setNotice("Refund rechecked with the payment provider.");
    },
  );

  const askEscalate = (r: AdminCampaignRefund) => confirm.ask(
    {
      title: "Escalate this refund?",
      confirmLabel: "Escalate refund",
      description: `A support case is opened for ${r.contribution.participant.user.name}. Requires a 2FA code.`,
      reasonLabel: "Escalation note (recorded on the support case and in the audit log)",
    },
    async (note) => {
      await communityBuyAdminAPI.escalateRefund(r.id, note);
      setEscalatedIds((prev) => new Set(prev).add(r.id));
      setNotice("Escalated. A support case has been opened for this refund.");
    },
  );

  const pending = items.filter((i) => i.status === "REFUND_PENDING" || i.status === "REFUND_PROCESSING").length;
  const failed = items.filter((i) => i.status === "REFUND_FAILED").length;
  const completed = items.filter((i) => i.status === "REFUNDED").length;
  const totalPages = Math.max(1, Math.ceil(items.length / PER_PAGE));
  const paged = items.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  return (
    <ProtectedRoute>
      <AdminLayout>
        {loading ? <LoadingPanel label="Loading refunds..." /> : (
          <div className="space-y-8">
            <PageHeader
              title="Community Buy refunds"
              subtitle="Every refund record created when a campaign fails to reach its target."
              actions={<Button variant="ghost" disabled={refreshing} onClick={() => void load(true)}><Icon name="refresh" className="h-4 w-4" />{refreshing ? "Refreshing..." : "Refresh"}</Button>}
            />
            {error ? <ErrorPanel message={error} onRetry={() => void load()} /> : null}
            {notice ? <Banner tone="success">{notice}</Banner> : null}
            {!permLoading && !canMutate ? <Banner tone="info">Your role can view refunds but cannot recheck or escalate them.</Banner> : null}

            <div className="grid gap-6 md:grid-cols-3">
              <MetricCard icon="clock" label="Pending / processing" value={pending} tone="amber" />
              <MetricCard icon="check" label="Completed" value={completed} tone="green" />
              <MetricCard icon="warning" label="Failed" value={failed} tone={failed > 0 ? "red" : "green"} />
            </div>

            <Card>
              <h2 className="text-2xl font-black">Refund records</h2>
              {items.length === 0 ? (
                <div className="mt-6"><EmptyState title="No refunds have been created yet." /></div>
              ) : (
                <div className="mt-6 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
                        <th className="pb-3">Campaign</th>
                        <th className="pb-3">Participant</th>
                        <th className="pb-3">Amount</th>
                        <th className="pb-3">Status</th>
                        <th className="pb-3">Created</th>
                        <th className="pb-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {paged.map((r) => (
                        <tr key={r.id} className="border-b border-slate-100">
                          <td className="py-3 font-semibold text-[#101820]">
                            {r.contribution.campaign.title} <span className="text-slate-400">({countryDisplayName(r.contribution.campaign.country)})</span>
                            <div><TextLink href={`/activity-logs?entityId=${r.id}`}>Audit history</TextLink></div>
                          </td>
                          <td className="py-3 text-slate-600">{r.contribution.participant.user.name} <span className="text-slate-400">({r.contribution.participant.user.email})</span></td>
                          <td className="py-3 font-semibold">{formatMinor(r.amount, r.currency)}</td>
                          <td className="py-3">
                            <Badge tone={tone(r.status)}>{REFUND_STATUS_LABEL[r.status]}</Badge>
                            {escalatedIds.has(r.id) ? <Badge tone="blue">Escalated</Badge> : null}
                            {r.failureReason ? <p className="mt-1 text-xs text-red-500">{r.failureReason}</p> : null}
                          </td>
                          <td className="py-3 text-slate-500">{formatDateTime(r.createdAt)}</td>
                          <td className="py-3">
                            {canMutate && r.status !== "REFUNDED" ? (
                              <div className="flex gap-2">
                                <Button variant="ghost" onClick={() => askRecheck(r)}>Recheck</Button>
                                <Button variant="ghost" disabled={escalatedIds.has(r.id)} onClick={() => askEscalate(r)}>Escalate</Button>
                              </div>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <Pagination
                    hasPrev={page > 1} hasNext={page < totalPages} shown={paged.length} total={items.length}
                    onPrev={() => setPage((p) => Math.max(1, p - 1))} onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
                  />
                </div>
              )}
            </Card>
          </div>
        )}
        {confirm.dialog}
      </AdminLayout>
    </ProtectedRoute>
  );
}
