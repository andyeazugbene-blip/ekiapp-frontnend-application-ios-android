"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AdminLayout from "@/components/AdminLayout";
import { ErrorPanel, LoadingPanel } from "@/components/AdminUI";
import ProtectedRoute from "@/components/ProtectedRoute";
import { ordersAPI } from "@/lib/services/orders.api";
import { APIError } from "@/lib/api";
import { Card } from "@/components/AdminUI";

function fmt(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(d: string | undefined, withTime = true) {
  if (!d) return "—";
  const date = new Date(d);
  const opts: Intl.DateTimeFormatOptions = withTime
    ? { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }
    : { month: "short", day: "numeric", year: "numeric" };
  return date.toLocaleDateString("en-GB", opts).replace(",", "");
}

function StatusBadge({ status }: { status: string }) {
  const s = (status ?? "").toLowerCase();
  const map: Record<string, string> = {
    pending: "bg-amber-50 text-amber-600", confirmed: "bg-blue-50 text-blue-600", processing: "bg-purple-50 text-purple-600",
    shipped: "bg-sky-50 text-sky-600", delivered: "bg-emerald-50 text-emerald-600", completed: "bg-emerald-50 text-emerald-600",
    cancelled: "bg-red-50 text-red-500", refunded: "bg-slate-100 text-slate-600", failed: "bg-red-50 text-red-500",
    paid: "bg-emerald-50 text-emerald-600", succeeded: "bg-emerald-50 text-emerald-600", released: "bg-emerald-50 text-emerald-600",
  };
  return <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${map[s] ?? "bg-slate-100 text-slate-500"}`}>{s || "—"}</span>;
}

function InfoRow({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5">
      <span className="text-[12px] text-slate-400 whitespace-nowrap">{label}</span>
      <span className={`text-[12px] font-medium text-slate-700 text-right ${mono ? "font-mono text-[11px]" : ""}`}>{value}</span>
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5">
      <h3 className="text-[14px] font-bold text-[#101820] mb-3">{title}</h3>
      {children}
    </div>
  );
}

// Not yet wired to a real backend action — shown disabled with an honest
// label rather than as a clickable control that would silently do nothing.
function ActionItem({ label, color }: { label: string; color: string }) {
  const colorMap: Record<string, string> = {
    green: "bg-emerald-50 text-emerald-700",
    orange: "bg-amber-50 text-amber-700",
    slate: "bg-slate-50 text-slate-700",
    red: "bg-red-50 text-red-600",
  };
  const dotMap: Record<string, string> = {
    green: "bg-emerald-500", orange: "bg-amber-500", slate: "bg-slate-400", red: "bg-red-500",
  };
  return (
    <button disabled title="Not yet available" className={`flex items-center gap-2.5 w-full rounded-lg px-3.5 py-2 text-[12px] font-semibold opacity-50 cursor-not-allowed ${colorMap[color] ?? colorMap.slate}`}>
      <span className={`h-[6px] w-[6px] rounded-full ${dotMap[color] ?? dotMap.slate}`} />
      {label}
      <span className="ml-auto text-[10px] font-normal text-slate-400">Coming soon</span>
    </button>
  );
}

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notes, setNotes] = useState("");

  const [showRefundModal, setShowRefundModal] = useState(false);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [refundTwoFactorCode, setRefundTwoFactorCode] = useState("");
  const [refundError, setRefundError] = useState("");
  const [refundResult, setRefundResult] = useState<{ pending: boolean; message: string } | null>(null);
  const [refundBusy, setRefundBusy] = useState(false);

  const load = useCallback(async () => {
    try { setLoading(true); setError(""); setOrder(await ordersAPI.getOrder(id)); }
    catch (err) { setError(err instanceof APIError ? err.message : "Failed"); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  const openRefundModal = () => {
    setRefundAmount("");
    setRefundReason("");
    setRefundTwoFactorCode("");
    setRefundError("");
    setRefundResult(null);
    setShowRefundModal(true);
  };

  const submitRefund = async () => {
    if (!refundReason.trim()) { setRefundError("A reason is required"); return; }
    try {
      setRefundBusy(true);
      setRefundError("");
      const amount = refundAmount.trim() ? Number(refundAmount) : undefined;
      if (refundAmount.trim() && (!Number.isFinite(amount) || (amount as number) <= 0)) {
        setRefundError("Amount must be a positive number");
        return;
      }
      const res = await ordersAPI.refundOrder(id, { amount, reason: refundReason.trim(), twoFactorCode: refundTwoFactorCode || undefined });
      if (res.pendingApproval) {
        setRefundResult({ pending: true, message: res.message ?? "This refund requires a second admin's approval before it executes." });
      } else {
        setRefundResult({ pending: false, message: `Refund issued: ${(res.currency ?? "").toUpperCase()} ${((res.amount ?? 0) / 100).toFixed(2)}` });
        await load();
      }
    } catch (err) {
      setRefundError(err instanceof APIError ? err.message : "Failed to issue refund");
    } finally {
      setRefundBusy(false);
    }
  };

  if (loading) return <ProtectedRoute><AdminLayout><LoadingPanel label="Loading order..." /></AdminLayout></ProtectedRoute>;
  if (error || !order) return <ProtectedRoute><AdminLayout><ErrorPanel message={error || "Not found"} onRetry={() => router.push("/orders")} /></AdminLayout></ProtectedRoute>;

  const items = order.items ?? [];
  const payment = order.payment ?? {};
  const dz = order.deliveryZone ?? {};
  const cur = order.currency ?? "GBP";
  const gross = order.totalAmount ?? 0;
  const platformFee = order.platformFeeAmount ?? 0;
  const vendorAmount = order.vendorEarnings ?? 0;
  const deliveryFee = order.deliveryFeeAmount ?? 0;
  const feePercent = gross > 0 ? Math.round((platformFee / gross) * 100) : 0;

  const timeline: { label: string; time: string; color: string }[] = [];
  if (order.createdAt) timeline.push({ label: "Order Placed", time: fmtDate(order.createdAt), color: "bg-emerald-500" });
  if (payment.processedAt) timeline.push({ label: "Payment Received", time: fmtDate(payment.processedAt), color: "bg-emerald-500" });
  if (order.status !== "pending" && order.status !== "cancelled") timeline.push({ label: "Vendor Accepted", time: fmtDate(order.confirmedAt ?? order.createdAt), color: "bg-emerald-500" });
  if (order.status === "processing" || order.status === "shipped" || order.status === "delivered" || order.status === "completed")
    timeline.push({ label: "Processing", time: fmtDate(order.processingAt ?? order.createdAt), color: "bg-blue-500" });
  if (order.status === "shipped" || order.status === "delivered" || order.status === "completed")
    timeline.push({ label: "Shipped", time: fmtDate(order.shippedAt ?? order.createdAt), color: "bg-emerald-500" });
  if (order.status === "delivered" || order.status === "completed")
    timeline.push({ label: "Delivered", time: fmtDate(order.deliveredAt), color: "bg-emerald-500" });
  if (order.payoutReleasedAt) timeline.push({ label: "Payout Released", time: fmtDate(order.payoutReleasedAt), color: "bg-emerald-500" });

  return (
    <ProtectedRoute>
      <AdminLayout>
        <div className="space-y-5">
          {/* Breadcrumb + Header */}
          <div>
            <button onClick={() => router.push("/orders")} className="text-[12px] text-slate-400 hover:text-slate-600 transition mb-1 flex items-center gap-1">
              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              Orders / {order.orderNumber}
            </button>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h1 className="text-xl font-black tracking-tight text-[#101820]">Order {order.orderNumber}</h1>
              <div className="flex items-center gap-2 flex-wrap">
                <button disabled title="Not yet available" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-[12px] font-semibold text-slate-400 cursor-not-allowed transition">Release Payout</button>
                {order.status === "refunded" ? (
                  <span className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-[12px] font-bold text-slate-500">Already refunded</span>
                ) : (
                  <button onClick={openRefundModal} className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-[12px] font-bold text-red-500 hover:bg-red-100 transition">Refund Buyer</button>
                )}
                <button disabled title="Not yet available" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-[12px] font-semibold text-slate-400 cursor-not-allowed transition">Message Vendor</button>
                <button disabled title="Not yet available" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-[12px] font-semibold text-slate-400 cursor-not-allowed transition">Message Buyer</button>
              </div>
            </div>
          </div>

          {/* 3-column layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Column 1 */}
            <div className="space-y-4">
              <SectionCard title="Order Summary">
                <div className="divide-y divide-slate-50">
                  <InfoRow label="Order ID" value={order.orderNumber} />
                  <InfoRow label="Date" value={fmtDate(order.createdAt)} />
                  <InfoRow label="Buyer" value={order.buyerName || order.buyer?.name || "—"} />
                  <InfoRow label="Vendor" value={order.vendorName || "—"} />
                  <InfoRow label="Payment" value={payment.stripePaymentIntentId ? `Paid via ${payment.provider ?? "Stripe"} ****${(payment.last4 ?? "")}` : (payment.provider ?? "—")} />
                  <InfoRow label="Escrow" value={order.escrowReleasedAt ? `Released ${fmtDate(order.escrowReleasedAt, false)}` : (order.escrowStatus ?? "—")} />
                  <InfoRow label="Delivery" value={order.deliveredAt ? `Delivered ${fmtDate(order.deliveredAt, false)}` : (order.status ?? "—")} />
                  <InfoRow label="Total" value={<span className="text-[#096B4A] font-bold">{fmt(gross, cur)}</span>} />
                </div>
              </SectionCard>

              <SectionCard title="Items Ordered">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-100">
                      <th className="pb-2">Product</th>
                      <th className="pb-2 text-center">Qty</th>
                      <th className="pb-2 text-right">Unit Price</th>
                      <th className="pb-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item: any, i: number) => (
                      <tr key={item.id ?? i} className="border-b border-slate-50">
                        <td className="py-2 text-[12px] text-slate-700">{item.productTitle ?? item.product?.title ?? "—"}</td>
                        <td className="py-2 text-[12px] text-slate-600 text-center">{item.quantity}</td>
                        <td className="py-2 text-[12px] text-slate-600 text-right">{fmt(item.unitAmount ?? 0, cur)}</td>
                        <td className="py-2 text-[12px] font-semibold text-slate-800 text-right">{fmt(item.totalAmount ?? 0, cur)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </SectionCard>
            </div>

            {/* Column 2 */}
            <div className="space-y-4">
              <SectionCard title="Payment Details">
                <div className="divide-y divide-slate-50">
                  <InfoRow label="Stripe Payment ID" value={payment.stripePaymentIntentId ? `${payment.stripePaymentIntentId.slice(0, 18)}...` : "—"} mono />
                  <InfoRow label="Gross Amount" value={fmt(gross, cur)} />
                  <InfoRow label={`Platform Fee (${feePercent}%)`} value={fmt(platformFee, cur)} />
                  <InfoRow label="Vendor Amount" value={fmt(vendorAmount, cur)} />
                  <InfoRow label="Delivery Fee" value={fmt(deliveryFee, cur)} />
                  <InfoRow label="Escrow Status" value={order.escrowReleasedAt ? `Released ${fmtDate(order.escrowReleasedAt, false)}` : (order.escrowStatus ?? "—")} />
                  <InfoRow label="Payout Status" value={order.payoutStatus ?? payment.payoutStatus ?? "—"} />
                  <InfoRow label="Refund Status" value={order.refundStatus ?? "None"} />
                </div>
              </SectionCard>

              <SectionCard title="Delivery">
                <div className="divide-y divide-slate-50">
                  <InfoRow label="Address" value={order.deliveryAddress ?? "—"} />
                  <InfoRow label="Courier" value={order.courierName ?? dz.courier ?? "—"} />
                  <InfoRow label="Tracking No." value={order.trackingNumber ?? "—"} mono />
                  <InfoRow label="Status" value={order.deliveredAt ? `Delivered ${fmtDate(order.deliveredAt)}` : (order.deliveryStatus ?? order.status ?? "—")} />
                  <InfoRow label="Notes" value={order.deliveryNotes ?? "—"} />
                </div>
              </SectionCard>

              <SectionCard title="Order Timeline">
                <div className="space-y-0">
                  {timeline.map((event, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="flex flex-col items-center">
                        <span className={`h-[8px] w-[8px] rounded-full mt-1.5 ${event.color}`} />
                        {i < timeline.length - 1 && <span className="w-px flex-1 bg-slate-200 min-h-[24px]" />}
                      </div>
                      <div className="flex items-center justify-between w-full pb-3">
                        <span className="text-[12px] font-medium text-slate-700">{event.label}</span>
                        <span className="text-[11px] text-slate-400">{event.time}</span>
                      </div>
                    </div>
                  ))}
                  {timeline.length === 0 && <p className="text-[12px] text-slate-400">No timeline events</p>}
                </div>
              </SectionCard>
            </div>

            {/* Column 3 */}
            <div className="space-y-4">
              <SectionCard title="Quick Actions">
                <div className="space-y-1.5">
                  <ActionItem label="Update Status" color="green" />
                  <ActionItem label="Assign Courier" color="orange" />
                  <ActionItem label="Message Buyer" color="slate" />
                  <ActionItem label="Message Vendor" color="slate" />
                  <ActionItem label="Open Dispute" color="red" />
                  <ActionItem label="Cancel Order" color="red" />
                </div>
              </SectionCard>

              <SectionCard title="Order Notes">
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Admin notes..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[12px] text-slate-700 outline-none focus:border-[#096B4A] focus:ring-1 focus:ring-[#096B4A] transition resize-none"
                  rows={4}
                />
                <button disabled title="Not yet available — admin notes aren't persisted yet" className="mt-2 rounded-lg bg-slate-200 px-4 py-2 text-[11px] font-bold text-slate-500 cursor-not-allowed transition">
                  Save Note (coming soon)
                </button>
              </SectionCard>
            </div>
          </div>
        </div>

        {showRefundModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4">
            <Card className="w-full max-w-md">
              {refundResult ? (
                <>
                  <h3 className="text-xl font-black text-[#101820]">{refundResult.pending ? "Approval required" : "Refund issued"}</h3>
                  <p className="mt-2 text-sm text-slate-500">{refundResult.message}</p>
                  {refundResult.pending && (
                    <p className="mt-2 text-[12px] text-slate-400">A second, different admin can decide this from the <a href="/approvals" className="font-bold text-[#096B4A] underline">Approvals</a> queue.</p>
                  )}
                  <button onClick={() => setShowRefundModal(false)} className="mt-4 w-full rounded-xl bg-[#096B4A] px-4 py-2.5 text-sm font-bold text-white">Close</button>
                </>
              ) : (
                <>
                  <h3 className="text-xl font-black text-[#101820]">Refund order {order.orderNumber}</h3>
                  <p className="mt-2 text-sm text-slate-500">Leave amount blank for a full refund of {fmt(gross, cur)}. A refund at or above the configured threshold will require a second admin&apos;s approval before it executes.</p>
                  <input value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} placeholder={`Amount in ${cur} (blank = full)`} className="mt-3 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none" />
                  <textarea rows={2} value={refundReason} onChange={(e) => setRefundReason(e.target.value)} placeholder="Reason (required)" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none" />
                  <input value={refundTwoFactorCode} onChange={(e) => setRefundTwoFactorCode(e.target.value)} placeholder="2FA code (if enabled)" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none" />
                  {refundError && <p className="mt-2 text-[12px] text-red-500">{refundError}</p>}
                  <div className="mt-4 flex gap-3">
                    <button disabled={refundBusy} onClick={() => void submitRefund()} className="flex-1 rounded-xl bg-red-500 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{refundBusy ? "Processing..." : "Confirm refund"}</button>
                    <button onClick={() => setShowRefundModal(false)} className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600">Cancel</button>
                  </div>
                </>
              )}
            </Card>
          </div>
        )}
      </AdminLayout>
    </ProtectedRoute>
  );
}
