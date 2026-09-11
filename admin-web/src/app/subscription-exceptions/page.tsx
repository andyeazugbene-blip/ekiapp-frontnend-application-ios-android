"use client";

import { useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Badge, Button, Card, ErrorPanel, LoadingPanel, MetricCard, PageHeader } from "@/components/AdminUI";
import ProtectedRoute from "@/components/ProtectedRoute";
import { APIError } from "@/lib/api";
import { subscriptionExceptionsAPI, type SubscriptionException } from "@/lib/services/regularDeliveries.api";

function centsToUnit(value: unknown): number {
  return typeof value === "number" ? value / 100 : 0;
}

function statusTone(status: SubscriptionException["status"]): "amber" | "red" {
  return status === "PAYMENT_FAILED" ? "red" : "amber";
}

function statusLabel(status: SubscriptionException["status"]): string {
  if (status === "AWAITING_PRICE_APPROVAL") return "Awaiting buyer price approval";
  if (status === "PAYMENT_FAILED") return "Payment failed";
  return "Awaiting vendor stock confirmation";
}

export default function SubscriptionExceptionsPage() {
  const [items, setItems] = useState<SubscriptionException[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      setItems(await subscriptionExceptionsAPI.getExceptions());
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Failed to load subscription exceptions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const withAction = async (key: string, action: () => Promise<void>) => {
    setActionBusy(key);
    setActionError("");
    setActionSuccess("");
    try {
      await action();
      setActionSuccess("Action completed.");
      await load();
    } catch (err) {
      setActionError(err instanceof APIError ? err.message : "Action failed. Please try again.");
    } finally {
      setActionBusy(null);
    }
  };

  const handleRetryPayment = (renewalId: string) => {
    if (!confirm("Retry payment? Idempotent — cannot produce duplicate charge.")) return;
    void withAction(`retry-${renewalId}`, () => subscriptionExceptionsAPI.retryPayment(renewalId).then(() => {}));
  };

  const handleResendPriceChange = (renewalId: string) => {
    if (!confirm("Resend the price approval notification to the buyer?")) return;
    void withAction(`resend-${renewalId}`, () => subscriptionExceptionsAPI.resendPriceChangeNotification(renewalId));
  };

  const handleCancelPriceChange = (renewalId: string) => {
    const reason = window.prompt("Reason for cancelling this price-change (required):");
    if (!reason?.trim()) return;
    void withAction(`cancel-price-${renewalId}`, () => subscriptionExceptionsAPI.cancelInvalidPriceChange(renewalId, reason));
  };

  const handleSkipRenewal = (renewalId: string) => {
    const reason = window.prompt("Reason for skipping this renewal (required):");
    if (!reason?.trim()) return;
    void withAction(`skip-${renewalId}`, () => subscriptionExceptionsAPI.skipRenewal(renewalId, reason));
  };

  const handleContactBuyerFromRenewal = (renewalId: string) => {
    const message = window.prompt("Message to send buyer via Eki support notification:");
    if (!message?.trim()) return;
    void withAction(`contact-r-${renewalId}`, () => subscriptionExceptionsAPI.contactBuyerFromRenewal(renewalId, message).then(() => {}));
  };

  const handleContactBuyerFromSubscription = (subscriptionId: string) => {
    const message = window.prompt("Message to send buyer via Eki support notification:");
    if (!message?.trim()) return;
    void withAction(`contact-s-${subscriptionId}`, () => subscriptionExceptionsAPI.contactBuyerFromSubscription(subscriptionId, message).then(() => {}));
  };

  const handleForceCancel = (subscriptionId: string) => {
    if (!confirm("FORCE CANCEL subscription? Exceptional only. Only future unpaid renewals cancelled — paid/dispatched orders never touched.")) return;
    const reason = window.prompt("Reason (support / fraud / compliance / safety — required):");
    if (!reason?.trim()) return;
    const internalNote = window.prompt("Internal note for audit trail (required):");
    if (!internalNote?.trim()) return;
    void withAction(`force-cancel-${subscriptionId}`, () => subscriptionExceptionsAPI.forceCancel(subscriptionId, reason, internalNote));
  };

  const handleEscalate = (renewalId: string) => {
    if (
      !confirm(
        "Escalate this case for higher-tier support review? " +
          "This flags it internally for supervisor attention — it does NOT change the renewal's status, retry payment, or cancel anything, and does NOT notify the buyer (use Message buyer for that). " +
          "Escalation cannot be undone from this screen.",
      )
    )
      return;
    const reason = window.prompt("Reason for escalating (required):");
    if (!reason?.trim()) return;
    void withAction(`escalate-${renewalId}`, () => subscriptionExceptionsAPI.escalate(renewalId, reason).then(() => {}));
  };

  const priceApprovals = items.filter((i) => i.status === "AWAITING_PRICE_APPROVAL").length;
  const paymentFailures = items.filter((i) => i.status === "PAYMENT_FAILED").length;
  const stockWaits = items.filter((i) => i.status === "AWAITING_STOCK").length;

  return (
    <ProtectedRoute>
      <AdminLayout>
        {loading ? <LoadingPanel label="Loading Regular Delivery exceptions..." /> : (
          <div className="space-y-8">
            <PageHeader title="Subscription exceptions" subtitle="Regular Delivery renewals that need attention — stuck payments, price approvals, and stock waits." />
            {error ? <ErrorPanel message={error} onRetry={() => void load()} /> : null}
            {actionError ? <ErrorPanel message={actionError} /> : null}
            {actionSuccess ? <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{actionSuccess}</p> : null}

            <div className="grid gap-6 md:grid-cols-3">
              <MetricCard icon="warning" label="Payment failures" value={paymentFailures} tone={paymentFailures > 0 ? "red" : "green"} />
              <MetricCard icon="money" label="Price approvals pending" value={priceApprovals} tone="amber" />
              <MetricCard icon="clock" label="Awaiting stock" value={stockWaits} tone="amber" />
            </div>

            <Card>
              <h2 className="text-2xl font-black">Exception queue</h2>
              <p className="mt-1 text-sm text-slate-500">All admin actions are audit-logged. Admin may never accept a price change on behalf of a buyer.</p>
              {items.length === 0 ? (
                <p className="mt-8 text-slate-500">No renewals need attention right now.</p>
              ) : (
                <div className="mt-6 space-y-4">
                  {items.map((item) => (
                    <div key={item.id} className="rounded-2xl border border-slate-200 p-5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone={statusTone(item.status)}>{statusLabel(item.status)}</Badge>
                          {item.escalated ? <Badge tone="red">Escalated</Badge> : null}
                        </div>
                        <span className="text-sm text-slate-500">{new Date(item.updatedAt).toLocaleString()}</span>
                      </div>
                      <div className="mt-4 grid gap-4 md:grid-cols-[0.3fr_1fr] md:items-start">
                        <div className="space-y-2 text-sm text-slate-500">
                          <p>Buyer:</p><p>Items:</p>{item.failureReason ? <p>Reason:</p> : null}{item.escalated ? <p>Escalation:</p> : null}
                        </div>
                        <div className="space-y-2 text-sm font-semibold text-[#101820]">
                          <p>{item.subscription.buyer?.name ?? "Unknown buyer"} ({item.subscription.buyer?.email ?? "—"})</p>
                          <p>
                            {item.items.map((i) => `${i.product.title} x${i.quantity}`).join(", ")}
                            {item.subtotalAmount ? ` — ${item.currency} ${centsToUnit(item.subtotalAmount).toFixed(2)}` : ""}
                          </p>
                          {item.failureReason ? <p className="text-red-600">{item.failureReason}</p> : null}
                          {item.escalated ? (
                            <p className="text-red-600">
                              {item.escalatedReason ?? "Escalated for support review"}
                              {item.escalatedAt ? ` — ${new Date(item.escalatedAt).toLocaleString()}` : ""}
                            </p>
                          ) : null}
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {item.status === "PAYMENT_FAILED" ? (
                          <Button variant="secondary" disabled={!!actionBusy} onClick={() => handleRetryPayment(item.id)}>
                            {actionBusy === `retry-${item.id}` ? "Retrying…" : "Retry payment"}
                          </Button>
                        ) : null}
                        {item.status === "AWAITING_PRICE_APPROVAL" ? (
                          <>
                            <Button variant="secondary" disabled={!!actionBusy} onClick={() => handleResendPriceChange(item.id)}>
                              {actionBusy === `resend-${item.id}` ? "Sending…" : "Resend price notification"}
                            </Button>
                            <Button variant="secondary" disabled={!!actionBusy} onClick={() => handleCancelPriceChange(item.id)}>
                              {actionBusy === `cancel-price-${item.id}` ? "Cancelling…" : "Cancel price change"}
                            </Button>
                          </>
                        ) : null}
                        <Button variant="secondary" disabled={!!actionBusy} onClick={() => handleSkipRenewal(item.id)}>
                          {actionBusy === `skip-${item.id}` ? "Skipping…" : "Skip renewal"}
                        </Button>
                        <Button variant="secondary" disabled={!!actionBusy} onClick={() => handleContactBuyerFromRenewal(item.id)}>
                          {actionBusy === `contact-r-${item.id}` ? "Sending…" : "Message buyer (renewal)"}
                        </Button>
                        <Button variant="secondary" disabled={!!actionBusy} onClick={() => handleContactBuyerFromSubscription(item.subscriptionId)}>
                          {actionBusy === `contact-s-${item.subscriptionId}` ? "Sending…" : "Message buyer (subscription)"}
                        </Button>
                        <Button variant="secondary" disabled={!!actionBusy} onClick={() => handleForceCancel(item.subscriptionId)}>
                          {actionBusy === `force-cancel-${item.subscriptionId}` ? "Cancelling…" : "Force cancel subscription"}
                        </Button>
                        <Button variant="secondary" disabled={!!actionBusy || item.escalated} onClick={() => handleEscalate(item.id)}>
                          {item.escalated ? "Escalated" : actionBusy === `escalate-${item.id}` ? "Escalating…" : "Escalate case"}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        )}
      </AdminLayout>
    </ProtectedRoute>
  );
}
