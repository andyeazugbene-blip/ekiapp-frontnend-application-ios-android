"use client";

import { useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Badge, Card, ErrorPanel, LoadingPanel, MetricCard, PageHeader } from "@/components/AdminUI";
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

            <div className="grid gap-6 md:grid-cols-3">
              <MetricCard icon="warning" label="Payment failures" value={paymentFailures} tone={paymentFailures > 0 ? "red" : "green"} />
              <MetricCard icon="money" label="Price approvals pending" value={priceApprovals} tone="amber" />
              <MetricCard icon="clock" label="Awaiting stock" value={stockWaits} tone="amber" />
            </div>

            <Card>
              <h2 className="text-2xl font-black">Exception queue</h2>
              {items.length === 0 ? (
                <p className="mt-8 text-slate-500">No renewals need attention right now.</p>
              ) : (
                <div className="mt-6 space-y-4">
                  {items.map((item) => (
                    <div key={item.id} className="rounded-2xl border border-slate-200 p-5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <Badge tone={statusTone(item.status)}>{statusLabel(item.status)}</Badge>
                        <span className="text-sm text-slate-500">{new Date(item.updatedAt).toLocaleString()}</span>
                      </div>
                      <div className="mt-4 grid gap-4 md:grid-cols-[0.3fr_1fr] md:items-start">
                        <div className="space-y-2 text-sm text-slate-500"><p>Buyer:</p><p>Items:</p>{item.failureReason ? <p>Reason:</p> : null}</div>
                        <div className="space-y-2 text-sm font-semibold text-[#101820]">
                          <p>{item.subscription.buyer?.name ?? "Unknown buyer"} ({item.subscription.buyer?.email ?? "—"})</p>
                          <p>{item.items.map((i) => `${i.product.title} x${i.quantity}`).join(", ")}{item.subtotalAmount ? ` — ${centsToUnit(item.subtotalAmount).toFixed(2)} ${item.currency}` : ""}</p>
                          {item.failureReason ? <p className="text-red-600">{item.failureReason}</p> : null}
                        </div>
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
