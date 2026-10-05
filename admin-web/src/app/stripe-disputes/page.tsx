"use client";

import { useCallback, useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Card, EmptyState, ErrorPanel, LoadingPanel, PageHeader } from "@/components/AdminUI";
import { Banner, formatDateTime, formatMinor, useConfirm } from "@/components/AdminKit";
import ProtectedRoute from "@/components/ProtectedRoute";
import { APIError } from "@/lib/api";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { stripeDisputesAPI, StripeDispute } from "@/lib/services/stripe-disputes.api";

function StatusBadge({ status }: { status: string }) {
  const lost = status === "lost";
  const won = status === "won";
  const cls = lost ? "bg-red-50 text-red-500" : won ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600";
  return <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${cls}`}>{status.replace(/_/g, " ")}</span>;
}

export default function StripeDisputesPage() {
  const [items, setItems] = useState<StripeDispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showResolved, setShowResolved] = useState(false);
  const { has, loading: permLoading } = usePermissions();
  const canMutate = has("disputes.mutate");
  const confirm = useConfirm();

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      setItems(await stripeDisputesAPI.list());
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Failed to load chargebacks");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  const visible = items.filter((d) => (showResolved ? true : !d.resolvedAt));

  const markReviewed = (d: StripeDispute) => confirm.ask(
    {
      title: "Mark chargeback reviewed",
      tone: "primary",
      confirmLabel: "Mark reviewed",
      description: `${formatMinor(d.amount, d.currency)} - ${d.reason.replace(/_/g, " ")}. This only records that Eki reviewed it; the evidence response is still made in the Stripe Dashboard.`,
      reasonLabel: "What action was taken? (recorded in the audit log)",
    },
    async (reason) => { await stripeDisputesAPI.markReviewed(d.id, reason); await loadData(); },
  );

  return (
    <ProtectedRoute>
      <AdminLayout>
        <div className="space-y-5">
          <PageHeader
            title="Chargebacks"
            subtitle="Real Stripe disputes. Respond to evidence deadlines directly in the Stripe Dashboard."
            actions={
              <label className="flex items-center gap-2 text-[13px] text-slate-600">
                <input type="checkbox" checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)} />
                Show reviewed
              </label>
            }
          />

          {error && <ErrorPanel message={error} onRetry={() => void loadData()} />}
          {!permLoading && !canMutate ? <Banner tone="info">Your role can view chargebacks but cannot mark them reviewed.</Banner> : null}

          {loading ? (
            <LoadingPanel label="Loading chargebacks..." />
          ) : visible.length === 0 ? (
            <EmptyState title={showResolved ? "No chargebacks recorded." : "No open chargebacks."} />
          ) : (
            <Card>
              <div className="space-y-3">
                {visible.map((d) => (
                  <div key={d.id} className="rounded-xl border border-slate-100 p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-[#101820]">{formatMinor(d.amount, d.currency)}</p>
                          <StatusBadge status={d.status} />
                        </div>
                        <p className="mt-1 text-[12px] text-slate-500">Reason: {d.reason.replace(/_/g, " ")}</p>
                        <p className="text-[12px] text-slate-500">Stripe payment reference: {d.paymentIntentId ?? "not recorded"}</p>
                        <p className="text-[11px] text-slate-400">Opened {formatDateTime(d.createdAt)}</p>
                        {d.note && <p className="mt-1 text-[12px] italic text-slate-500">Note: {d.note}</p>}
                      </div>
                      {!d.resolvedAt && canMutate && (
                        <button onClick={() => markReviewed(d)} className="rounded-lg bg-[#096B4A]/10 px-3 py-1.5 text-[11px] font-bold text-[#096B4A] hover:bg-[#096B4A]/20">Mark reviewed</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
        {confirm.dialog}
      </AdminLayout>
    </ProtectedRoute>
  );
}
