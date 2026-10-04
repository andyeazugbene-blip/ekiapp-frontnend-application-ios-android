"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AdminLayout from "@/components/AdminLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Badge, Button, Card, ErrorPanel, LoadingPanel, PageHeader, TextLink, TwoFactorModal } from "@/components/AdminUI";
import {
  Banner, ConfirmDialog, DataTable, ExternalLink, KeyValue, formatDateTime, formatMinor, stripeDashboardUrl, useConfirm, type Column,
} from "@/components/AdminKit";
import { MoneyBreakdown, PaymentOutcomeBanner, RefundsTable, WebhookTable } from "@/components/MoneyParts";
import { APIError } from "@/lib/api";
import { useTwoFactorAction } from "@/lib/hooks/useTwoFactorAction";
import { moneyAPI, orderStatusLabel, orderStatusTone, paymentStatusTone, type OrderDetail } from "@/lib/services/money.api";

type Item = OrderDetail["items"][number];

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [o, setO] = useState<OrderDetail | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const twoFactor = useTwoFactorAction();
  const confirm = useConfirm();

  const [refundOpen, setRefundOpen] = useState(false);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundErr, setRefundErr] = useState("");
  const [refundBusy, setRefundBusy] = useState(false);
  const [refundNotice, setRefundNotice] = useState("");
  // One key per dialog opening: a double click can never create two refunds.
  const [idemKey, setIdemKey] = useState("");

  const load = useCallback(async () => {
    try { setLoading(true); setError(""); setO(await moneyAPI.getOrder(id)); }
    catch (e) { setError(e instanceof APIError ? e.message : "Failed to load order"); }
    finally { setLoading(false); }
  }, [id]);
  useEffect(() => { void load(); }, [load]);

  const refundedMinor = useMemo(() => (o?.refunds ?? []).filter((r) => r.status !== "FAILED").reduce((n, r) => n + r.amountMinor, 0), [o]);

  if (loading && !o) return <ProtectedRoute><AdminLayout><LoadingPanel label="Loading order…" /></AdminLayout></ProtectedRoute>;
  if (error || !o) return <ProtectedRoute><AdminLayout><ErrorPanel message={error || "Order not found"} onRetry={() => void load()} /></AdminLayout></ProtectedRoute>;

  const cur = o.currency;
  const remaining = Math.max(o.totalAmount - refundedMinor, 0);
  const paid = o.payment?.status === "SUCCEEDED";
  const canRefund = paid && remaining > 0 && !["REFUNDED", "CANCELLED"].includes(o.status.toUpperCase());
  const canRepair = o.payment?.status === "PENDING" && o.payment.provider === "stripe" && Boolean(o.payment.stripePaymentIntentId);

  const openRefund = () => {
    setRefundAmount(""); setRefundErr(""); setRefundNotice("");
    setIdemKey(typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now()));
    setRefundOpen(true);
  };

  const submitRefund = async (reason: string) => {
    let amountMinor: number | undefined;
    if (refundAmount.trim()) {
      const n = Number(refundAmount);
      if (!Number.isFinite(n) || n <= 0) { setRefundErr("Amount must be a positive number"); return; }
      amountMinor = Math.round(n * 100);
      if (amountMinor > remaining) { setRefundErr(`At most ${formatMinor(remaining, cur)} can still be refunded`); return; }
    }
    setRefundBusy(true); setRefundErr("");
    await twoFactor.run(async (code) => {
      const res = await moneyAPI.refundOrder(id, { amountMinor, reason, idempotencyKey: idemKey }, code);
      setRefundOpen(false);
      setRefundNotice(res.pendingApproval
        ? res.message ?? "This refund needs a second admin's approval before it executes."
        : `Refund requested - awaiting Stripe confirmation (${formatMinor(res.amount ?? 0, cur)}). Its status below updates when Stripe confirms.`);
      await load();
    });
    setRefundBusy(false);
  };

  const repair = () => confirm.ask(
    {
      title: "Re-check this payment with Stripe?",
      tone: "primary",
      confirmLabel: "Verify and repair",
      description: "Only use if the payment succeeded in Stripe but this order never updated (a missed webhook). Eki asks Stripe first and changes nothing unless Stripe reports the payment as succeeded.",
      minReasonLength: 10,
    },
    async (reason) => {
      await twoFactor.run(async (code) => { await moneyAPI.forceProcess(id, reason, code); await load(); });
    },
  );

  const itemCols: Column<Item>[] = [
    { key: "p", header: "Product", render: (i) => <span className="font-bold">{i.productTitle ?? "—"}</span> },
    { key: "q", header: "Qty", render: (i) => i.quantity },
    { key: "u", header: "Unit price", render: (i) => formatMinor(i.unitAmount, cur) },
    { key: "t", header: "Total", render: (i) => <span className="font-black">{formatMinor(i.totalAmount, cur)}</span> },
  ];

  // Timeline: only things that actually happened and are recorded.
  const timeline: Array<{ at: string; label: string; tone: "green" | "red" | "amber" | "gray" }> = [
    { at: o.createdAt, label: "Order placed", tone: "gray" },
  ];
  if (o.payment?.processedAt) timeline.push({ at: o.payment.processedAt, label: o.payment.status === "SUCCEEDED" ? "Payment confirmed by provider" : o.payment.status === "FAILED" ? "Payment failed" : "Payment updated", tone: o.payment.status === "SUCCEEDED" ? "green" : "red" });
  for (const r of o.refunds) timeline.push({ at: r.createdAt, label: `Refund ${formatMinor(r.amountMinor, r.currency)} - ${r.status.toLowerCase()}`, tone: r.status === "FAILED" ? "red" : "amber" });
  if (o.dispute) timeline.push({ at: o.dispute.createdAt, label: `Dispute opened (${o.dispute.status.toLowerCase().replace(/_/g, " ")})`, tone: "red" });
  timeline.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  return (
    <ProtectedRoute>
      <AdminLayout>
        <div className="space-y-6">
          <PageHeader
            title={`Order ${o.orderNumber}`}
            subtitle={`${o.buyer?.name || o.buyer?.email || "Buyer not provided"} → ${o.vendorName ?? "vendor not provided"}`}
            actions={
              <>
                <Button variant="ghost" onClick={() => router.push("/orders")}>← All orders</Button>
                {canRepair ? <Button variant="secondary" onClick={repair}>Re-check with Stripe</Button> : null}
                {canRefund ? <Button variant="danger" onClick={openRefund}>Refund buyer…</Button> : null}
              </>
            }
          />

          {refundNotice ? <Banner tone="info">{refundNotice}</Banner> : null}
          {twoFactor.error ? <Banner tone="danger">{twoFactor.error}</Banner> : null}
          <PaymentOutcomeBanner payment={o.payment} />

          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={orderStatusTone(o.status)}>Order: {orderStatusLabel(o.status)}</Badge>
            {o.payment ? <Badge tone={paymentStatusTone(o.payment.status)}>Payment: {o.payment.status.toLowerCase()}</Badge> : null}
            {o.refunds.length > 0 ? <Badge tone={refundedMinor >= o.totalAmount ? "gray" : "amber"}>Refunded {formatMinor(refundedMinor, cur)} of {formatMinor(o.totalAmount, cur)}</Badge> : <Badge tone="gray">No refund</Badge>}
            {o.dispute ? <Badge tone="red">Dispute: {o.dispute.status.toLowerCase().replace(/_/g, " ")}</Badge> : null}
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card>
              <h3 className="mb-4 text-lg font-black text-[#101820]">Order</h3>
              <KeyValue items={[
                { label: "Placed", value: formatDateTime(o.createdAt) },
                { label: "Buyer", value: o.buyer ? <TextLink href={`/users/${o.buyer.id}`}>{o.buyer.name || o.buyer.email} →</TextLink> : "Not provided" },
                { label: "Buyer email", value: o.buyer?.email ?? "Not provided" },
                { label: "Vendor", value: o.vendorId ? <TextLink href={`/vendors/${o.vendorId}`}>{o.vendorName ?? "Open vendor"} →</TextLink> : "Not provided" },
                { label: "Delivery address", value: o.deliveryAddress ?? "Not provided" },
                { label: "Delivery zone", value: o.deliveryZone ? `${o.deliveryZone.name} (${o.deliveryZone.country})` : "Not provided" },
              ]} />
              <p className="mt-3 text-xs text-slate-400">Courier, tracking number and delivery proof are not recorded on regular orders yet.</p>
            </Card>
            <MoneyBreakdown
              currency={cur} total={o.totalAmount} subtotal={o.subtotalAmount} delivery={o.deliveryFeeAmount}
              platformFee={o.payment?.platformFeeAmount ?? null} vendorEarnings={o.payment?.vendorEarningsAmount ?? null}
              collected={Boolean(o.payment?.moneyCollected)} commissionBps={o.payment?.commissionBps} refundedMinor={refundedMinor}
            />
          </div>

          <Card>
            <h3 className="mb-3 text-lg font-black text-[#101820]">Items</h3>
            <DataTable columns={itemCols} rows={o.items} rowKey={(i) => i.id} emptyTitle="No items" />
          </Card>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card>
              <h3 className="mb-3 text-lg font-black text-[#101820]">Related records</h3>
              <ul className="space-y-2 text-sm">
                <li><span className="font-bold">Payment:</span> {o.payment ? <TextLink href={`/payments/${o.payment.id}`}>{o.payment.status.toLowerCase()} · {formatMinor(o.payment.amount, o.payment.currency)} →</TextLink> : "none"}</li>
                <li><span className="font-bold">Dispute:</span> {o.dispute ? <TextLink href={`/disputes/${o.dispute.id}`}>{o.dispute.status.toLowerCase().replace(/_/g, " ")} →</TextLink> : "none"}</li>
                <li><span className="font-bold">Vendor payouts:</span> {o.payoutRequests.length === 0 ? "none recent" : <TextLink href={`/payout-requests?vendorId=${o.vendorId}`}>{o.payoutRequests.length} recent request(s) →</TextLink>}</li>
                {o.payment?.provider === "stripe" ? <li><ExternalLink href={stripeDashboardUrl("payment", o.payment.stripePaymentIntentId, o.stripeLivemode)}>Open payment in Stripe</ExternalLink></li> : null}
              </ul>
            </Card>
            <Card>
              <h3 className="mb-3 text-lg font-black text-[#101820]">Timeline</h3>
              <ol className="space-y-3 border-l-2 border-slate-100 pl-4">
                {timeline.map((t, i) => (
                  <li key={i} className="relative">
                    <span className={`absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full ${t.tone === "green" ? "bg-emerald-500" : t.tone === "red" ? "bg-red-500" : t.tone === "amber" ? "bg-amber-500" : "bg-slate-400"}`} />
                    <p className="text-sm font-bold text-slate-900">{t.label}</p>
                    <p className="text-xs font-semibold text-slate-500">{formatDateTime(t.at)}</p>
                  </li>
                ))}
              </ol>
              <p className="mt-3 text-xs text-slate-400">Only recorded events are shown. Vendor accept / dispatch times are not stored per step.</p>
            </Card>
          </div>

          <Card>
            <h3 className="mb-3 text-lg font-black text-[#101820]">Refunds</h3>
            <RefundsTable refunds={o.refunds} />
          </Card>

          <Card>
            <h3 className="mb-1 text-lg font-black text-[#101820]">Provider webhook receipts</h3>
            <p className="mb-3 text-xs text-slate-500">Money state is confirmed by these events.</p>
            <WebhookTable events={o.webhookEvents} />
          </Card>

          <ConfirmDialog
            open={refundOpen}
            title={`Refund order ${o.orderNumber}`}
            confirmLabel="Request refund"
            minReasonLength={10}
            reasonLabel="Reason (recorded in the audit log, min. 10 characters)"
            description={`Still refundable: ${formatMinor(remaining, cur)}. Leave the amount blank to refund all of it. A refund at or above the configured threshold needs a second admin's approval. The refund is only final once Stripe confirms it.`}
            loading={refundBusy}
            error={refundErr}
            onCancel={() => setRefundOpen(false)}
            onConfirm={(reason) => void submitRefund(reason)}
          >
            <label className="block">
              <span className="text-xs font-black uppercase tracking-wide text-slate-500">Amount in {cur.toUpperCase()} (blank = everything left)</span>
              <input
                value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} inputMode="decimal" placeholder={`up to ${(remaining / 100).toFixed(2)}`}
                className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-[#096B4A]"
              />
            </label>
          </ConfirmDialog>
          {confirm.dialog}
          <TwoFactorModal
            open={twoFactor.show2FAModal} code={twoFactor.code} onCodeChange={twoFactor.setCode}
            onSubmit={() => void twoFactor.submit2FA()} onCancel={twoFactor.cancel2FA} loading={twoFactor.loading} error={twoFactor.error}
          />
        </div>
      </AdminLayout>
    </ProtectedRoute>
  );
}
