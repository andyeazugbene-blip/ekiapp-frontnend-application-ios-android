"use client";

import { Badge, Card } from "@/components/AdminUI";
import { Banner, DataTable, formatDateTime, formatMinor, type Column } from "@/components/AdminKit";
import { failureCopy, type PaymentSummary, type RefundRow, type WebhookReceipt } from "@/lib/services/money.api";

/** Handbook 14.8 L585: a failed/pending payment collected no funds. */
export function PaymentOutcomeBanner({ payment }: { payment: PaymentSummary | null }) {
  if (!payment) return <Banner tone="warning" title="No payment record">This order has no payment record.</Banner>;
  if (payment.status === "SUCCEEDED") {
    return <Banner tone="success" title="Payment confirmed by the provider">{payment.processedAt ? `Confirmed ${formatDateTime(payment.processedAt)}.` : "Confirmed."}</Banner>;
  }
  if (payment.status === "FAILED") {
    const c = failureCopy(payment.failureCode, payment.failureMessage);
    return (
      <Banner tone="danger" title="No funds were collected. No vendor earnings or payout were created.">
        <p className="font-bold">{c.title}</p>
        <p>{c.hint}</p>
        {payment.failureCode ? <p className="mt-1 text-xs opacity-80">Provider code: {payment.failureCode}</p> : null}
      </Banner>
    );
  }
  return (
    <Banner tone="warning" title="Payment pending">
      Waiting for the provider to confirm. No funds are counted until the provider confirms; nothing here is a completed money movement.
    </Banner>
  );
}

/** Subtotal / delivery / buyer total / fee / vendor amount - in the ORDER's currency. */
export function MoneyBreakdown({
  currency, subtotal, delivery, total, platformFee, vendorEarnings, collected, commissionBps, refundedMinor,
}: {
  currency: string; subtotal?: number | null; delivery?: number | null; total: number;
  platformFee: number | null; vendorEarnings: number | null; collected: boolean; commissionBps?: number | null; refundedMinor: number;
}) {
  const row = (label: string, value: React.ReactNode, strong = false) => (
    <div className="flex items-center justify-between gap-4 py-1.5">
      <span className="text-sm font-semibold text-slate-500">{label}</span>
      <span className={`text-sm ${strong ? "font-black text-slate-900" : "font-semibold text-slate-800"}`}>{value}</span>
    </div>
  );
  const notCollected = <span className="font-semibold text-slate-400">Not applicable - no funds collected</span>;
  return (
    <Card>
      <h3 className="mb-2 text-lg font-black text-[#101820]">Money breakdown</h3>
      <div className="divide-y divide-slate-100">
        {row("Subtotal", subtotal != null ? formatMinor(subtotal, currency) : "Not recorded")}
        {row("Delivery", delivery != null ? formatMinor(delivery, currency) : "Not recorded")}
        {row("Tax / discount", <span className="text-slate-400">Not recorded</span>)}
        {row("Buyer total", formatMinor(total, currency), true)}
        {row(
          commissionBps ? `Eki fee (${(commissionBps / 100).toFixed(2).replace(/\.00$/, "")}%)` : "Eki fee",
          collected ? (platformFee ? formatMinor(platformFee, currency) : "Subscription model - no commission") : notCollected,
        )}
        {row("Vendor amount", collected ? formatMinor(vendorEarnings ?? 0, currency) : notCollected)}
        {row("Refunded so far", refundedMinor > 0 ? formatMinor(refundedMinor, currency) : "None")}
      </div>
      {collected && platformFee ? (
        <p className="mt-3 text-xs text-amber-700">
          A commission was applied because this vendor&apos;s seller plan sets a fee. The agreed ordinary model is subscription-only, so confirm the plan setting is approved (Seller plans).
        </p>
      ) : null}
      <p className="mt-2 text-xs text-slate-400">Processing fee: not recorded by Eki - see the Stripe balance transaction.</p>
    </Card>
  );
}

const refundTone = { COMPLETED: "green", PROCESSING: "amber", REQUESTED: "amber", FAILED: "red" } as const;
const refundLabel = { COMPLETED: "Completed", PROCESSING: "Processing at Stripe", REQUESTED: "Requested", FAILED: "Failed" } as const;

export function RefundsTable({ refunds, emptyTitle = "No refunds" }: { refunds: RefundRow[]; emptyTitle?: string }) {
  const columns: Column<RefundRow>[] = [
    { key: "amt", header: "Amount", render: (r) => <span className="font-black">{formatMinor(r.amountMinor, r.currency)}</span> },
    { key: "st", header: "Status", render: (r) => <Badge tone={refundTone[r.status]}>{refundLabel[r.status]}</Badge> },
    { key: "why", header: "Reason", render: (r) => <span className="text-xs text-slate-600">{r.reason}{r.failureReason ? ` - ${r.failureReason}` : ""}</span> },
    { key: "ref", header: "Provider ref", render: (r) => <span className="font-mono text-[11px] text-slate-500">{r.providerRefundId ?? "-"}</span> },
    { key: "at", header: "When", render: (r) => <span className="text-xs">{formatDateTime(r.createdAt)}</span> },
  ];
  return <DataTable columns={columns} rows={refunds} rowKey={(r) => r.id} emptyTitle={emptyTitle} />;
}

export function WebhookTable({ events }: { events: WebhookReceipt[] }) {
  const columns: Column<WebhookReceipt>[] = [
    { key: "t", header: "Event", render: (e) => <span className="font-mono text-xs font-bold">{e.eventType}</span> },
    { key: "s", header: "Outcome", render: (e) => <Badge tone={e.status === "PROCESSED" ? "green" : e.status === "IGNORED" ? "gray" : "amber"}>{e.status.toLowerCase()}</Badge> },
    { key: "r", header: "Received", render: (e) => <span className="text-xs">{formatDateTime(e.createdAt)}</span> },
    { key: "p", header: "Processed", render: (e) => <span className="text-xs">{e.processedAt ? formatDateTime(e.processedAt) : "-"}</span> },
  ];
  return <DataTable columns={columns} rows={events} rowKey={(e) => e.id} emptyTitle="No provider events recorded for this record yet" />;
}
