"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AdminLayout from "@/components/AdminLayout";
import { Badge, Button, Card, ErrorPanel, Icon, LoadingPanel } from "@/components/AdminUI";
import ProtectedRoute from "@/components/ProtectedRoute";
import { APIError, API2FARequiredError } from "@/lib/api";
import { disputesAPI } from "@/lib/services/disputes.api";
import { Dispute } from "@/types";

export default function DisputeDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [dispute, setDispute] = useState<Dispute | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [resolution, setResolution] = useState<"buyer" | "vendor" | "partial">("buyer");
  const [note, setNote] = useState("");
  const [refundAmount, setRefundAmount] = useState("");
  const [resolving, setResolving] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [show2FA, setShow2FA] = useState(false);

  const load = useCallback(async () => {
    if (!params.id) return;
    try {
      setLoading(true);
      setError("");
      setDispute(await disputesAPI.getDispute(params.id));
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Failed to load dispute");
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => { void load(); }, [load]);

  const handleResolve = async (code?: string) => {
    if (!dispute || !note.trim()) { setError("Add a resolution note."); return; }
    try {
      setResolving(true);
      setError("");
      await disputesAPI.resolveDispute(dispute.id, {
        resolution,
        note: note.trim(),
        refundAmount: refundAmount ? Number(refundAmount) : undefined,
        twoFactorCode: code,
      });
      await load();
      setNote("");
      setRefundAmount("");
    } catch (err) {
      if (err instanceof API2FARequiredError) { setShow2FA(true); return; }
      setError(err instanceof APIError ? err.message : "Failed to resolve");
    } finally { setResolving(false); }
  };

  return (
    <ProtectedRoute>
      <AdminLayout>
        {loading ? <LoadingPanel label="Loading dispute..." /> : !dispute ? (
          <div className="p-12 text-center text-slate-500">Dispute not found. <button onClick={() => router.back()} className="text-[#096B4A] underline">Go back</button></div>
        ) : (
          <div className="space-y-8">
            <button onClick={() => router.back()} className="flex items-center gap-2 text-sm font-bold text-[#096B4A]"><Icon name="arrow" className="h-4 w-4 rotate-90" /> Back to disputes</button>

            {error && <ErrorPanel message={error} onRetry={() => setError("")} />}

            {/* Header */}
            <div className="rounded-3xl bg-[#101820] p-8 text-white">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-emerald-200">Dispute #{dispute.order?.orderNumber || dispute.orderId.slice(0, 8)}</p>
                  <h1 className="mt-2 text-3xl font-black">{dispute.reason}</h1>
                </div>
                <StatusBadge status={dispute.status} />
              </div>
              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                <div><p className="text-sm text-emerald-200">Buyer ID</p><p className="mt-1 font-bold">{dispute.buyerId?.slice(0, 12) || "N/A"}</p></div>
                <div><p className="text-sm text-emerald-200">Vendor ID</p><p className="mt-1 font-bold">{dispute.vendorId?.slice(0, 12) || "N/A"}</p></div>
                <div><p className="text-sm text-emerald-200">Created</p><p className="mt-1 font-bold">{dispute.createdAt ? new Date(dispute.createdAt).toLocaleString() : "N/A"}</p></div>
              </div>
              {dispute.fraudulent && <div className="mt-4 rounded-xl bg-red-500/20 px-4 py-3 text-sm font-bold text-red-200">⚠ Flagged as potentially fraudulent</div>}
            </div>

            {/* Order details */}
            {dispute.order && (
              <Card>
                <h2 className="text-xl font-black">Order details</h2>
                <div className="mt-4 space-y-3">
                  <div className="flex justify-between"><span className="text-slate-500">Order number</span><span className="font-bold">{dispute.order.orderNumber}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Total</span><span className="font-bold">{dispute.order.currency} {dispute.order.totalAmount.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Status</span><StatusBadge status={dispute.order.status} /></div>
                  {dispute.order.items?.map((item: any) => (
                    <div key={item.id} className="flex justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                      <span>{item.productTitle} x{item.quantity}</span>
                      <span className="font-bold">{dispute.order?.currency} {item.totalAmount.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Resolution form */}
            {dispute.status !== "RESOLVED" && (
              <Card>
                <h2 className="text-xl font-black">Resolve dispute</h2>
                <div className="mt-6 space-y-4">
                  <div>
                    <label className="mb-2 block text-sm font-bold text-gray-700">Resolution decision</label>
                    <div className="flex flex-wrap gap-3">
                      {(["buyer", "vendor", "partial"] as const).map((opt) => (
                        <button key={opt} onClick={() => setResolution(opt)}
                          className={`rounded-xl border px-5 py-3 text-sm font-bold transition ${resolution === opt ? "border-[#096B4A] bg-emerald-50 text-[#096B4A]" : "border-slate-200 text-slate-600"}`}>
                          {opt === "buyer" ? "Refund buyer" : opt === "vendor" ? "Release to vendor" : "Partial refund"}
                        </button>
                      ))}
                    </div>
                  </div>
                  {resolution === "partial" && (
                    <div>
                      <label className="mb-2 block text-sm font-bold text-gray-700">Refund amount</label>
                      <input type="number" min="0" step="0.01" value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-[#096B4A]" />
                    </div>
                  )}
                  <div>
                    <label className="mb-2 block text-sm font-bold text-gray-700">Resolution note *</label>
                    <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Explain the resolution decision. This will be visible to both buyer and vendor." className="w-full rounded-xl border border-slate-300 p-4 outline-none focus:border-[#096B4A]" />
                  </div>
                  <Button disabled={resolving || !note.trim()} onClick={() => void handleResolve()} className="w-full">{resolving ? "Resolving..." : "Resolve dispute"}</Button>
                </div>
              </Card>
            )}

            {dispute.resolution && (
              <Card>
                <h2 className="text-xl font-black">Resolution</h2>
                <div className="mt-4 rounded-xl bg-emerald-50 p-4">
                  <p className="font-bold text-[#096B4A]">Decided: {dispute.resolution === "buyer" ? "Refund buyer" : dispute.resolution === "vendor" ? "Release to vendor" : "Partial refund"}</p>
                  {dispute.refundAmount ? <p className="mt-1 text-sm text-slate-600">Amount: {dispute.order?.currency} {dispute.refundAmount.toFixed(2)}</p> : null}
                  {dispute.fraudulent ? <p className="mt-1 text-sm font-bold text-red-600">Flagged as fraudulent</p> : null}
                  {dispute.resolvedAt ? <p className="mt-1 text-sm text-slate-500">Resolved: {new Date(dispute.resolvedAt).toLocaleString()}</p> : null}
                </div>
              </Card>
            )}

            {/* 2FA Modal */}
            {show2FA && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4">
                <Card className="w-full max-w-md">
                  <h3 className="text-2xl font-black">2FA Required</h3>
                  <p className="mt-2 text-sm text-slate-500">Enter your 2FA code to resolve this dispute.</p>
                  <input value={twoFactorCode} onChange={(e) => setTwoFactorCode(e.target.value)} placeholder="000000" className="mt-4 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-[#096B4A]" />
                  <div className="mt-6 flex gap-3">
                    <Button className="flex-1" onClick={() => void handleResolve(twoFactorCode)}>Submit</Button>
                    <Button className="flex-1" variant="ghost" onClick={() => setShow2FA(false)}>Cancel</Button>
                  </div>
                </Card>
              </div>
            )}
          </div>
        )}
      </AdminLayout>
    </ProtectedRoute>
  );
}

function StatusBadge({ status }: { status: string }) {
  const s = status?.toLowerCase() || "";
  if (s === "resolved" || s === "completed") return <Badge tone="green">{status}</Badge>;
  if (s === "open" || s === "investigation") return <Badge tone="red">{status}</Badge>;
  return <Badge tone="amber">{status}</Badge>;
}
