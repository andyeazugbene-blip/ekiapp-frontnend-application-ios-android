"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import AdminLayout from "@/components/AdminLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Badge, Button, Card, ErrorPanel, LoadingPanel, PageHeader } from "@/components/AdminUI";
import { Banner, KeyValue, formatDate, formatDateTime, formatMinor, useConfirm } from "@/components/AdminKit";
import { NoAccess } from "@/components/PageStates";
import { FREQUENCY_LABEL, paymentBadge, statusBadge } from "@/components/SubscriptionBits";
import { APIError } from "@/lib/api";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { subscriptionsAdminAPI, type SubscriptionDetail, type SubscriptionTimelineEvent } from "@/lib/services/regularDeliveries.api";

const KIND_TONE: Record<SubscriptionTimelineEvent["kind"], "green" | "amber" | "red" | "blue" | "gray"> = {
  action: "blue", renewal: "gray", payment_attempt: "amber", order: "green", refund: "red", audit: "gray",
};
const KIND_LABEL: Record<SubscriptionTimelineEvent["kind"], string> = {
  action: "Subscription", renewal: "Cycle", payment_attempt: "Payment", order: "Order", refund: "Refund", audit: "Audit",
};

function DetailInner({ id }: { id: string }) {
  const { has } = usePermissions();
  const canMutate = has("subscriptions.mutate");
  const [data, setData] = useState<SubscriptionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const confirm = useConfirm();
  // Uncontrolled inputs rendered inside the confirm dialog (read on confirm).
  const dateRef = useRef<HTMLInputElement>(null);
  const freqRef = useRef<HTMLSelectElement>(null);

  const load = useCallback(async () => {
    try { setLoading(true); setError(""); setData(await subscriptionsAdminAPI.get(id)); }
    catch (e) { setError(e instanceof APIError ? e.message : "Failed to load this subscription"); }
    finally { setLoading(false); }
  }, [id]);
  useEffect(() => { void load(); }, [load]);

  const done = (msg: string) => async () => { setNotice(msg); await load(); };

  if (loading && !data) return <LoadingPanel label="Loading subscription…" />;
  if (error && !data) return <ErrorPanel message={error} onRetry={() => void load()} />;
  if (!data) return null;
  const { subscription: s, buyer, vendor, canAct, money } = data;
  const when = (v: string | null) => (v ? formatDateTime(v) : "—");

  const actions: Array<{ label: string; show: boolean; danger?: boolean; run: () => void }> = [
    {
      label: "Pause", show: canAct.pause,
      run: () => confirm.ask({
        title: "Pause this subscription?", confirmLabel: "Pause subscription", tone: "primary",
        description: "Not-yet-charged cycles are cancelled so the buyer is not billed while paused. The buyer is notified.",
        children: (
          <label className="block text-sm font-semibold text-slate-600">Resume automatically on (optional)
            <input ref={dateRef} type="date" className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3" />
          </label>
        ),
      }, async (reason) => { await subscriptionsAdminAPI.pause(id, reason, dateRef.current?.value ? new Date(dateRef.current.value + "T09:00:00").toISOString() : undefined); await done("Subscription paused. The buyer was notified.")(); }),
    },
    {
      label: "Resume", show: canAct.resume,
      run: () => confirm.ask({
        title: "Resume this subscription?", confirmLabel: "Resume subscription", tone: "primary",
        description: s.pausedReason === "payment_failed"
          ? "The failed cycle is gone, so the next cycle is prepared right away. The buyer needs a working saved card."
          : "The next cycle starts a full frequency from today.",
      }, async (reason) => { await subscriptionsAdminAPI.resume(id, reason); await done("Subscription resumed. The buyer was notified.")(); }),
    },
    {
      label: "Skip next delivery", show: canAct.skipNext,
      run: () => confirm.ask({
        title: "Skip the next delivery?", confirmLabel: "Skip delivery", tone: "primary",
        description: `The cycle due ${formatDate(s.nextRenewalAt)} is skipped without charge and the following one stays on schedule.`,
      }, async (reason) => { await subscriptionsAdminAPI.skipNext(id, reason); await done("Next delivery skipped. The buyer was notified.")(); }),
    },
    {
      label: "Correct next date", show: canAct.setNextDate,
      run: () => confirm.ask({
        title: "Correct the next billing and delivery date", confirmLabel: "Save date", tone: "primary",
        description: "Moves the next cycle to a new date (within 90 days). Later cycles continue from it.",
        children: (
          <label className="block text-sm font-semibold text-slate-600">New date
            <input ref={dateRef} type="date" required className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3" />
          </label>
        ),
      }, async (reason) => {
        const v = dateRef.current?.value;
        if (!v) throw new Error("Choose the new date");
        await subscriptionsAdminAPI.setNextDate(id, new Date(v + "T09:00:00").toISOString(), reason);
        await done("Next date updated. The buyer was notified.")();
      }),
    },
    {
      label: "Change frequency", show: canAct.changeFrequency,
      run: () => confirm.ask({
        title: "Change frequency (support action)", confirmLabel: "Change frequency", tone: "primary",
        description: "Only on the buyer's request. The next date is recalculated from the current one.",
        children: (
          <label className="block text-sm font-semibold text-slate-600">New frequency
            <select ref={freqRef} defaultValue={s.frequency} className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3">
              {data.offer.frequencies.map((f) => <option key={f} value={f}>{FREQUENCY_LABEL[f] ?? f}</option>)}
            </select>
          </label>
        ),
      }, async (reason) => {
        const f = freqRef.current?.value;
        if (!f || f === s.frequency) throw new Error("Choose a different frequency");
        await subscriptionsAdminAPI.changeFrequency(id, f as string, reason);
        await done("Frequency changed. The buyer was notified.")();
      }),
    },
    {
      label: "Retry payment", show: canAct.retryPayment,
      run: () => confirm.ask({
        title: "Retry the failed payment?", confirmLabel: "Retry payment", tone: "primary",
        description: "Uses the same safe charge flow as the automatic retries: it can never charge the buyer twice for one cycle.",
      }, async (reason) => { await subscriptionsAdminAPI.retryPayment(id, reason); await done("Payment retried. Check the timeline for the result.")(); }),
    },
    {
      label: "Cancel subscription", show: canAct.cancel, danger: true,
      run: () => confirm.ask({
        title: "Cancel this subscription?", confirmLabel: "Cancel subscription",
        description: "Exceptional support action. Only future unpaid cycles are cancelled; paid or dispatched orders are never touched. The buyer and vendor are notified.",
      }, async (reason) => { await subscriptionsAdminAPI.cancel(id, reason); await done("Subscription cancelled. Buyer and vendor were notified.")(); }),
    },
  ];
  const visible = actions.filter((a) => a.show);

  return (
    <div className="space-y-5">
      <Link href="/subscriptions" className="text-sm font-bold text-[#096B4A] hover:underline">Back to Foodstuffs Subscriptions</Link>
      <PageHeader
        title={`${buyer.name || "Buyer"} · ${vendor.storeName}`}
        subtitle={`${data.offer.title} · ${FREQUENCY_LABEL[s.frequency] ?? s.frequency} · started ${formatDate(s.createdAt)}`}
        actions={<>{statusBadge(s)}{paymentBadge(money.paymentState)}</>}
      />
      {notice ? <Banner tone="success">{notice}</Banner> : null}
      {error ? <ErrorPanel message={error} onRetry={() => void load()} /> : null}
      {s.status === "PAUSED" && s.pausedReason === "payment_failed" ? (
        <Banner tone="danger" title="Paused after payment retries were used up">
          The buyer was asked to update their payment method. Resume it once they have a working card, or contact them first.
        </Banner>
      ) : null}
      {money.nextRetryAt && money.paymentState === "failed" ? (
        <Banner tone="warning" title="Automatic retry scheduled">Next attempt: {formatDateTime(money.nextRetryAt)}. {money.latestFailureReason ?? ""}</Banner>
      ) : null}

      <Card>
        <h2 className="text-xl font-black">Actions</h2>
        {!canMutate ? <p className="mt-2 text-sm text-slate-500">You can view this subscription but your role cannot change it.</p> : visible.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No actions are available in this state.</p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            {visible.map((a) => <Button key={a.label} variant={a.danger ? "danger" : "secondary"} onClick={a.run}>{a.label}</Button>)}
          </div>
        )}
        <p className="mt-3 text-xs font-semibold text-slate-500">Every action needs a reason, asks for your 2FA code when enabled, is written to the audit log and notifies the buyer.</p>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-xl font-black">Parties</h2>
          <KeyValue items={[
            { label: "Buyer", value: <Link className="text-[#096B4A] hover:underline" href={`/users/${buyer.id}`}>{buyer.name || "Name not provided"}</Link> },
            { label: "Buyer email", value: buyer.email },
            { label: "Vendor", value: <Link className="text-[#096B4A] hover:underline" href={`/vendors/${vendor.id}`}>{vendor.storeName}</Link> },
            { label: "Vendor location", value: [vendor.city, vendor.country].filter(Boolean).join(", ") || "Not provided" },
            { label: "Delivery recipient address", value: `${data.recipient.line1}, ${data.recipient.city}, ${data.recipient.country}` },
            { label: "Fulfilment", value: data.offer.fulfilmentMethod === "DELIVERY" ? "Delivery" : "Collection" },
            { label: "Saved card", value: data.paymentMethod ? `${data.paymentMethod.brand ?? "Card"} ending ${data.paymentMethod.last4 ?? "????"}` : "No saved card" },
          ]} />
        </Card>
        <Card>
          <h2 className="mb-3 text-xl font-black">Cadence and money</h2>
          <KeyValue items={[
            { label: "Frequency", value: FREQUENCY_LABEL[s.frequency] ?? s.frequency },
            { label: "Next renewal", value: s.status === "CANCELLED" ? "Cancelled" : when(s.nextRenewalAt) },
            { label: "Paused until", value: s.pausedUntil ? when(s.pausedUntil) : s.status === "PAUSED" ? "Until resumed" : "—" },
            { label: "Price-approval limit", value: `${(s.priceChangeApprovalLimitBps / 100).toFixed(1)}%` },
            { label: "Basket subtotal (current prices)", value: formatMinor(money.basketSubtotal, money.currency) },
            { label: "Last cycle subtotal", value: formatMinor(money.latestSubtotal, money.currency) },
            { label: "Last cycle delivery fee", value: formatMinor(money.latestDeliveryFee, money.currency) },
            { label: "Payment state", value: paymentBadge(money.paymentState) },
            ...(s.cancelledAt ? [{ label: "Cancelled", value: `${formatDate(s.cancelledAt)}${s.cancelReason ? ` · ${s.cancelReason}` : ""}` }] : []),
          ]} />
        </Card>
      </div>

      <Card>
        <h2 className="mb-3 text-xl font-black">Basket</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs font-black uppercase tracking-wide text-slate-500"><tr><th className="py-2 pr-4">Item</th><th className="pr-4">Qty</th><th className="pr-4">Unit price</th><th className="pr-4">Line</th><th>Stock</th></tr></thead>
            <tbody>
              {data.basket.map((b) => (
                <tr key={b.id} className="border-t border-slate-100">
                  <td className="py-2 pr-4 font-bold">{b.title}</td>
                  <td className="pr-4">{b.quantity}</td>
                  <td className="pr-4">{formatMinor(b.unitAmount, b.currency)}</td>
                  <td className="pr-4">{formatMinor(b.lineAmount, b.currency)}</td>
                  <td>{b.stockAvailable ? <Badge tone="green">In stock</Badge> : <Badge tone="red">{b.productActive ? `Only ${b.stock} left` : "Unavailable"}</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs font-semibold text-slate-500">When an item is out of stock the offer setting applies: {data.offer.substitutionMode.replace(/_/g, " ").toLowerCase()}.</p>
      </Card>

      <Card>
        <h2 className="mb-3 text-xl font-black">Cycles and linked orders</h2>
        {data.renewals.length === 0 ? <p className="text-sm text-slate-500">No cycle has been prepared yet.</p> : (
          <ul className="divide-y divide-slate-100">
            {data.renewals.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-bold">{formatDate(r.cycleDate)} · <span className="text-slate-600">{r.status.replace(/_/g, " ").toLowerCase()}</span></p>
                  <p className="text-xs font-semibold text-slate-500">
                    {r.items.map((i) => `${i.title} x${i.quantity}`).join(", ")} · {formatMinor((r.subtotalAmount ?? 0) + (r.deliveryFeeAmount ?? 0) || null, r.currency)}
                    {r.attempts.length ? ` · ${r.attempts.length} payment attempt${r.attempts.length > 1 ? "s" : ""}` : ""}
                  </p>
                  {r.failureReason ? <p className="text-xs font-semibold text-red-600">{r.failureReason}</p> : null}
                </div>
                {r.order ? <Link className="text-sm font-bold text-[#096B4A] hover:underline" href={`/orders/${r.order.id}`}>Order {r.order.orderNumber}</Link> : null}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h2 className="mb-3 text-xl font-black">History</h2>
        {data.timeline.length === 0 ? <p className="text-sm text-slate-500">Nothing recorded yet.</p> : (
          <ol className="space-y-3">
            {data.timeline.map((e, i) => (
              <li key={`${e.at}-${i}`} className="flex gap-3">
                <Badge tone={KIND_TONE[e.kind]}>{KIND_LABEL[e.kind]}</Badge>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900">
                    {e.ref?.type === "order" ? <Link className="hover:underline" href={`/orders/${e.ref.id}`}>{e.title}</Link> : e.title}
                  </p>
                  {e.detail ? <p className="text-sm text-slate-600">{e.detail}</p> : null}
                  <p className="text-xs font-semibold text-slate-500">{formatDateTime(e.at)}{e.actor ? ` · ${e.actor}` : ""}</p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </Card>
      {confirm.dialog}
    </div>
  );
}

export default function SubscriptionDetailPage() {
  const params = useParams<{ id: string }>();
  const { has, loading } = usePermissions();
  return (
    <ProtectedRoute>
      <AdminLayout>
        {loading ? <LoadingPanel label="Checking access…" /> : !has("subscriptions.read") ? <NoAccess what="Foodstuffs Subscriptions" /> : <DetailInner id={params.id} />}
      </AdminLayout>
    </ProtectedRoute>
  );
}
