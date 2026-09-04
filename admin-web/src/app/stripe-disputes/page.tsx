"use client";

import { useCallback, useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Card, ErrorPanel, LoadingPanel } from "@/components/AdminUI";
import ProtectedRoute from "@/components/ProtectedRoute";
import { APIError } from "@/lib/api";
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
  const [reviewing, setReviewing] = useState<StripeDispute | null>(null);
  const [note, setNote] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reviewError, setReviewError] = useState("");

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

  const confirmReview = async () => {
    if (!reviewing || !note.trim()) return;
    try {
      setBusyId(reviewing.id);
      setReviewError("");
      await stripeDisputesAPI.markReviewed(reviewing.id, note.trim());
      setReviewing(null);
      setNote("");
      await loadData();
    } catch (err) {
      setReviewError(err instanceof APIError ? err.message : "Failed to save");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <ProtectedRoute>
      <AdminLayout>
        {loading ? (
          <LoadingPanel label="Loading chargebacks..." />
        ) : (
          <div className="space-y-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-2xl font-black tracking-tight text-[#101820]">Chargebacks</h1>
                <p className="text-[13px] text-slate-400">Real Stripe disputes — respond to evidence deadlines directly in the Stripe Dashboard.</p>
              </div>
              <label className="flex items-center gap-2 text-[13px] text-slate-600">
                <input type="checkbox" checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)} />
                Show reviewed
              </label>
            </div>

            {error && <ErrorPanel message={error} onRetry={() => void loadData()} />}

            <Card>
              {visible.length === 0 ? (
                <p className="p-4 text-center text-sm text-slate-400">No open chargebacks.</p>
              ) : (
                <div className="space-y-3">
                  {visible.map((d) => (
                    <div key={d.id} className="rounded-xl border border-slate-100 p-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-bold text-[#101820]">{(d.amount / 100).toLocaleString("en-GB", { minimumFractionDigits: 2 })} {d.currency.toUpperCase()}</p>
                            <StatusBadge status={d.status} />
                          </div>
                          <p className="mt-1 text-[12px] text-slate-500">Reason: {d.reason.replace(/_/g, " ")}</p>
                          <p className="text-[12px] text-slate-500">Payment intent: {d.paymentIntentId ?? "unknown"}</p>
                          <p className="text-[11px] text-slate-400">{new Date(d.createdAt).toLocaleString("en-GB")}</p>
                          {d.note && <p className="mt-1 text-[12px] italic text-slate-500">Note: {d.note}</p>}
                        </div>
                        {!d.resolvedAt && (
                          <button onClick={() => { setReviewing(d); setNote(""); setReviewError(""); }} className="rounded-lg bg-[#096B4A]/10 px-3 py-1.5 text-[11px] font-bold text-[#096B4A] hover:bg-[#096B4A]/20">Mark reviewed</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        )}

        {reviewing && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4">
            <Card className="w-full max-w-md">
              <h3 className="text-xl font-black text-[#101820]">Mark chargeback reviewed</h3>
              <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What action was taken?" className="mt-3 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none" />
              {reviewError && <p className="mt-2 text-[12px] text-red-500">{reviewError}</p>}
              <div className="mt-4 flex gap-3">
                <button disabled={busyId === reviewing.id || !note.trim()} onClick={() => void confirmReview()} className="flex-1 rounded-xl bg-[#096B4A] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">Confirm</button>
                <button onClick={() => setReviewing(null)} className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600">Cancel</button>
              </div>
            </Card>
          </div>
        )}
      </AdminLayout>
    </ProtectedRoute>
  );
}
