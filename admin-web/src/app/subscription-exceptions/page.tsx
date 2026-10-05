"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import AdminLayout from "@/components/AdminLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Badge, Button, Card, ErrorPanel, LoadingPanel, PageHeader } from "@/components/AdminUI";
import { Banner, Pagination, SearchInput, StatusTabs, formatDateTime, formatMinor, useConfirm } from "@/components/AdminKit";
import { NoAccess } from "@/components/PageStates";
import { APIError } from "@/lib/api";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { apiClient } from "@/lib/api";
import { subscriptionExceptionsAPI, type SubscriptionException } from "@/lib/services/regularDeliveries.api";

type Counts = Record<string, number>;
interface ExceptionRow extends SubscriptionException {
  subscription: SubscriptionException["subscription"] & { offer?: { title: string; vendor?: { id: string; storeName: string } } };
}

const TABS = [
  { key: "", label: "All", count: "all" },
  { key: "PAYMENT_FAILED", label: "Payment failed", count: "PAYMENT_FAILED" },
  { key: "AWAITING_PRICE_APPROVAL", label: "Price approval", count: "AWAITING_PRICE_APPROVAL" },
  { key: "AWAITING_STOCK", label: "Awaiting stock", count: "AWAITING_STOCK" },
];

function statusTone(status: SubscriptionException["status"]): "amber" | "red" {
  return status === "PAYMENT_FAILED" ? "red" : "amber";
}
function statusLabel(status: SubscriptionException["status"]): string {
  if (status === "AWAITING_PRICE_APPROVAL") return "Awaiting buyer price approval";
  if (status === "PAYMENT_FAILED") return "Payment failed";
  return "Awaiting vendor stock confirmation";
}

function ExceptionsInner() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const q = params.get("q") ?? "";
  const status = params.get("status") ?? "";
  const { has } = usePermissions();
  const canMutate = has("subscriptions.mutate");
  const confirm = useConfirm();

  const setParams = useCallback((patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) { if (v == null || v === "") next.delete(k); else next.set(k, v); }
    router.replace(`${pathname}?${next.toString()}`);
  }, [params, pathname, router]);

  const [items, setItems] = useState<ExceptionRow[]>([]);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [cursor, setCursor] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const stack = useRef<Array<string | null>>([]);

  const key = `${q}|${status}`;
  useEffect(() => { stack.current = []; setCursor(null); }, [key]);

  const load = useCallback(async () => {
    try {
      setLoading(true); setError("");
      const qs = new URLSearchParams();
      if (q) qs.set("q", q);
      if (status) qs.set("status", status);
      if (cursor) qs.set("cursor", cursor);
      const res = await apiClient.get<{ items: ExceptionRow[]; nextCursor: string | null; counts: Counts }>(
        `/admin/subscriptions/exceptions${qs.toString() ? `?${qs}` : ""}`, { bypassCache: true },
      );
      setItems(res.items); setNextCursor(res.nextCursor); setCounts(res.counts);
    } catch (e) { setError(e instanceof APIError ? e.message : "Failed to load renewal exceptions"); }
    finally { setLoading(false); }
  }, [q, status, cursor]);
  useEffect(() => { void load(); }, [load]);

  const after = (msg: string) => async () => { setNotice(msg); await load(); };

  const retry = (r: ExceptionRow) => confirm.ask(
    { title: "Retry this payment?", confirmLabel: "Retry payment", tone: "primary", description: "Same safe charge flow as the automatic retries: it can never charge the buyer twice for one cycle." },
    async (reason) => { await subscriptionExceptionsAPI.retryPayment(r.id, reason); await after("Payment retried.")(); },
  );
  const resend = (r: ExceptionRow) => confirm.ask(
    { title: "Resend the price approval notification?", confirmLabel: "Resend", tone: "primary", requireReason: false, description: "The buyer gets the same request again. Nothing about the renewal changes." },
    async () => { await subscriptionExceptionsAPI.resendPriceChangeNotification(r.id); await after("Notification resent.")(); },
  );
  const cancelPrice = (r: ExceptionRow) => confirm.ask(
    { title: "Cancel this price change?", confirmLabel: "Cancel price change", description: "Voids the vendor price change; the delivery proceeds at the original price. The buyer is notified." },
    async (reason) => { await subscriptionExceptionsAPI.cancelInvalidPriceChange(r.id, reason); await after("Price change cancelled.")(); },
  );
  const skip = (r: ExceptionRow) => confirm.ask(
    { title: "Skip this renewal?", confirmLabel: "Skip renewal", description: "The cycle is skipped without charge and the next one stays on schedule." },
    async (reason) => { await subscriptionExceptionsAPI.skipRenewal(r.id, reason); await after("Renewal skipped.")(); },
  );
  const message = (r: ExceptionRow) => confirm.ask(
    { title: "Message the buyer", confirmLabel: "Send message", tone: "primary", reasonLabel: "Message (sent as an Eki support notification)", minReasonLength: 5, description: "Never include card details or secrets." },
    async (text) => { await subscriptionExceptionsAPI.contactBuyerFromRenewal(r.id, text); await after("Message sent.")(); },
  );
  const forceCancel = (r: ExceptionRow) => confirm.ask(
    { title: "Force cancel this subscription?", confirmLabel: "Force cancel", description: "Exceptional support action. Only future unpaid cycles are cancelled; paid or dispatched orders are never touched. Buyer and vendor are notified." },
    async (reason) => { await subscriptionExceptionsAPI.forceCancel(r.subscriptionId, reason); await after("Subscription cancelled.")(); },
  );
  const escalate = (r: ExceptionRow) => confirm.ask(
    { title: "Escalate this case?", confirmLabel: "Escalate", tone: "primary", description: "Flags the case for supervisor attention. It does not change the renewal, retry payment or notify the buyer." },
    async (reason) => { await subscriptionExceptionsAPI.escalate(r.id, reason); await after("Case escalated.")(); },
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Renewal exceptions"
        subtitle="Foodstuffs Subscription renewals that need attention: failed payments, price approvals waiting on the buyer and stock waiting on the vendor."
        actions={<Link href="/subscriptions" className="inline-flex h-11 items-center rounded-xl border border-[#096B4A] bg-white px-5 text-sm font-bold text-[#096B4A] hover:bg-emerald-50">All Foodstuffs Subscriptions</Link>}
      />
      {error ? <ErrorPanel message={error} onRetry={() => void load()} /> : null}
      {notice ? <Banner tone="success">{notice}</Banner> : null}

      <Card className="space-y-4">
        <SearchInput value={q} onChange={(v) => setParams({ q: v })} placeholder="Search buyer, vendor store or renewal ID" />
        <StatusTabs tabs={TABS.map((t) => ({ key: t.key, label: t.label, count: counts ? counts[t.count] ?? 0 : null }))} active={status} onChange={(k) => setParams({ status: k })} />

        {loading && items.length === 0 ? <LoadingPanel label="Loading renewal exceptions…" /> : items.length === 0 ? (
          <p className="py-10 text-center font-semibold text-slate-500">No renewals need attention for these filters.</p>
        ) : (
          <div className={`space-y-4 ${loading ? "opacity-60" : ""}`}>
            {items.map((item) => (
              <div key={item.id} className="rounded-2xl border border-slate-200 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={statusTone(item.status)}>{statusLabel(item.status)}</Badge>
                    {item.escalated ? <Badge tone="red">Escalated</Badge> : null}
                    {item.status === "PAYMENT_FAILED" && item.nextRetryAt ? <Badge tone="blue">Auto retry {formatDateTime(item.nextRetryAt)}</Badge> : null}
                  </div>
                  <span className="text-sm text-slate-500">Updated {formatDateTime(item.updatedAt)}</span>
                </div>
                <dl className="mt-4 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
                  <div><dt className="text-xs font-black uppercase tracking-wide text-slate-500">Buyer</dt><dd className="font-semibold">{item.subscription.buyer?.name || "Name not provided"} <span className="text-slate-500">({item.subscription.buyer?.email ?? "no email"})</span></dd></div>
                  <div><dt className="text-xs font-black uppercase tracking-wide text-slate-500">Vendor</dt><dd className="font-semibold">{item.subscription.offer?.vendor?.storeName ?? "Not provided"}</dd></div>
                  <div className="sm:col-span-2"><dt className="text-xs font-black uppercase tracking-wide text-slate-500">Basket</dt><dd className="font-semibold">{item.items.map((i) => `${i.product.title} x${i.quantity}`).join(", ")}{item.subtotalAmount ? ` · ${formatMinor(item.subtotalAmount, item.currency)}` : ""}</dd></div>
                  {item.failureReason ? <div className="sm:col-span-2"><dt className="text-xs font-black uppercase tracking-wide text-slate-500">Reason</dt><dd className="font-semibold text-red-600">{item.failureReason}</dd></div> : null}
                  {item.escalated ? <div className="sm:col-span-2"><dt className="text-xs font-black uppercase tracking-wide text-slate-500">Escalation</dt><dd className="font-semibold text-red-600">{item.escalatedReason ?? "Escalated for support review"}{item.escalatedAt ? ` · ${formatDateTime(item.escalatedAt)}` : ""}</dd></div> : null}
                </dl>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link href={`/subscriptions/${item.subscriptionId}`} className="inline-flex h-11 items-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 hover:bg-slate-50">Open subscription</Link>
                  {canMutate ? (
                    <>
                      {item.status === "PAYMENT_FAILED" ? <Button variant="secondary" onClick={() => retry(item)}>Retry payment</Button> : null}
                      {item.status === "AWAITING_PRICE_APPROVAL" ? (
                        <>
                          <Button variant="secondary" onClick={() => resend(item)}>Resend price notification</Button>
                          <Button variant="secondary" onClick={() => cancelPrice(item)}>Cancel price change</Button>
                        </>
                      ) : null}
                      <Button variant="secondary" onClick={() => skip(item)}>Skip renewal</Button>
                      <Button variant="secondary" onClick={() => message(item)}>Message buyer</Button>
                      <Button variant="secondary" disabled={item.escalated} onClick={() => escalate(item)}>{item.escalated ? "Escalated" : "Escalate case"}</Button>
                      <Button variant="ghost" className="text-red-600" onClick={() => forceCancel(item)}>Force cancel subscription</Button>
                    </>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
        <Pagination
          hasPrev={stack.current.length > 0} hasNext={Boolean(nextCursor)} shown={items.length} total={counts ? counts[status || "all"] ?? null : null} loading={loading}
          onPrev={() => setCursor(stack.current.pop() ?? null)}
          onNext={() => { stack.current.push(cursor); setCursor(nextCursor); }}
        />
      </Card>
      {confirm.dialog}
    </div>
  );
}

export default function SubscriptionExceptionsPage() {
  const { has, loading } = usePermissions();
  return (
    <ProtectedRoute>
      <AdminLayout>
        {loading ? <LoadingPanel label="Checking access…" /> : !has("subscriptions.read") ? <NoAccess what="renewal exceptions" /> : (
          <Suspense fallback={<LoadingPanel label="Loading…" />}><ExceptionsInner /></Suspense>
        )}
      </AdminLayout>
    </ProtectedRoute>
  );
}
