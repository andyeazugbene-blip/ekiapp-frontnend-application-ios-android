"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AdminLayout from "@/components/AdminLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Badge, Button, Card, ErrorPanel, LoadingPanel, PageHeader, TextLink } from "@/components/AdminUI";
import { ExternalLink, KeyValue, formatDateTime, stripeDashboardUrl } from "@/components/AdminKit";
import { MoneyBreakdown, PaymentOutcomeBanner, RefundsTable, WebhookTable } from "@/components/MoneyParts";
import { APIError } from "@/lib/api";
import { moneyAPI, paymentStatusTone, type PaymentDetail } from "@/lib/services/money.api";

export default function PaymentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [p, setP] = useState<PaymentDetail | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try { setLoading(true); setError(""); setP(await moneyAPI.getPayment(id)); }
    catch (e) { setError(e instanceof APIError ? e.message : "Failed to load payment"); }
    finally { setLoading(false); }
  }, [id]);
  useEffect(() => { void load(); }, [load]);

  if (loading && !p) return <ProtectedRoute><AdminLayout><LoadingPanel label="Loading payment…" /></AdminLayout></ProtectedRoute>;
  if (error || !p) return <ProtectedRoute><AdminLayout><ErrorPanel message={error || "Payment not found"} onRetry={() => void load()} /></AdminLayout></ProtectedRoute>;

  const refunded = p.refunds.filter((r) => r.status !== "FAILED").reduce((n, r) => n + r.amountMinor, 0);
  const stripeUrl = p.provider === "stripe" ? stripeDashboardUrl("payment", p.stripePaymentIntentId, p.stripeLivemode) : null;

  return (
    <ProtectedRoute>
      <AdminLayout>
        <div className="space-y-6">
          <PageHeader
            title={`Payment · ${p.order?.orderNumber ?? p.id}`}
            subtitle={`${p.order?.buyer?.name || p.order?.buyer?.email || "Buyer not provided"} → ${p.vendorName ?? "vendor not provided"}`}
            actions={
              <>
                <Button variant="ghost" onClick={() => router.push("/payments")}>← All payments</Button>
                {p.order ? <Button variant="secondary" onClick={() => router.push(`/orders/${p.order!.id}`)}>Open order</Button> : null}
              </>
            }
          />

          <PaymentOutcomeBanner payment={p} />

          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={paymentStatusTone(p.status)}>Payment: {p.status.toLowerCase()}</Badge>
            {p.order ? <Badge tone="blue">Order: {p.order.status.toLowerCase().replace(/_/g, " ")}</Badge> : null}
            {p.refunds.length > 0 ? <Badge tone="gray">{p.refunds.length} refund(s)</Badge> : null}
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card>
              <h3 className="mb-4 text-lg font-black text-[#101820]">Provider details</h3>
              <KeyValue items={[
                { label: "Provider", value: <span className="capitalize">{p.provider}</span> },
                { label: "Provider status", value: p.providerStatus ?? "Not recorded" },
                { label: "Payment method", value: p.paymentMethodType ?? "Not recorded" },
                { label: "Payment ID", value: <span className="font-mono text-xs">{p.stripePaymentIntentId ?? "Not recorded"}</span> },
                { label: "Failure code", value: p.failureCode ?? "None" },
                { label: "Processed", value: p.processedAt ? formatDateTime(p.processedAt) : "Not yet" },
              ]} />
              <div className="mt-4"><ExternalLink href={stripeUrl}>Open payment in Stripe</ExternalLink></div>
            </Card>
            <MoneyBreakdown
              currency={p.currency} total={p.amount} subtotal={null} delivery={null}
              platformFee={p.platformFeeAmount} vendorEarnings={p.vendorEarningsAmount} collected={p.moneyCollected}
              commissionBps={p.commissionBps} refundedMinor={refunded}
            />
          </div>

          <Card>
            <h3 className="mb-3 text-lg font-black text-[#101820]">Refunds</h3>
            <RefundsTable refunds={p.refunds} />
            <div className="mt-3"><TextLink href="/refunds">All refunds →</TextLink></div>
          </Card>

          <Card>
            <h3 className="mb-1 text-lg font-black text-[#101820]">Provider webhook receipts</h3>
            <p className="mb-3 text-xs text-slate-500">Payment truth is decided by these events, not by an admin control.</p>
            <WebhookTable events={p.webhookEvents} />
          </Card>
        </div>
      </AdminLayout>
    </ProtectedRoute>
  );
}
