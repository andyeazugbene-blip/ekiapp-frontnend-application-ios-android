"use client";

import { useCallback, useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Card, ErrorPanel, LoadingPanel } from "@/components/AdminUI";
import ProtectedRoute from "@/components/ProtectedRoute";
import { APIError } from "@/lib/api";
import { paymentAnomaliesAPI, PaymentAnomaly } from "@/lib/services/payment-anomalies.api";

const KIND_LABEL: Record<string, string> = {
  DUPLICATE_PROVIDER_REF: "Duplicate provider reference",
  MULTIPLE_SUCCESSFUL_ATTEMPTS: "Multiple successful charges",
  MISSING_LEDGER_ENTRY: "Missing ledger entry",
};

export default function PaymentAnomaliesPage() {
  const [items, setItems] = useState<PaymentAnomaly[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");
  const [showResolved, setShowResolved] = useState(false);
  const [acting, setActing] = useState<{ id: string; kind: "review" | "escalate" } | null>(null);
  const [note, setNote] = useState("");
  const [actionError, setActionError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      setItems(await paymentAnomaliesAPI.list());
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Failed to load payment anomalies");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  const runScan = async () => {
    try {
      setScanning(true);
      await paymentAnomaliesAPI.scan();
      await loadData();
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Scan failed");
    } finally {
      setScanning(false);
    }
  };

  const confirmAction = async () => {
    if (!acting || !note.trim()) return;
    try {
      setBusyId(acting.id);
      setActionError("");
      if (acting.kind === "review") await paymentAnomaliesAPI.review(acting.id, note.trim());
      else await paymentAnomaliesAPI.escalate(acting.id, note.trim());
      setActing(null);
      setNote("");
      await loadData();
    } catch (err) {
      setActionError(err instanceof APIError ? err.message : "Failed to save");
    } finally {
      setBusyId(null);
    }
  };

  const visible = items.filter((a) => (showResolved ? true : a.status === "OPEN"));

  return (
    <ProtectedRoute>
      <AdminLayout>
        <div className="space-y-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-black tracking-tight text-[#101820]">Payment Anomalies</h1>
              <p className="text-[13px] text-slate-400">Real findings from actual payment/ledger rows — duplicate references, double charges, and missing ledger entries.</p>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-[13px] text-slate-600">
                <input type="checkbox" checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)} />
                Show reviewed/escalated
              </label>
              <button onClick={() => void runScan()} disabled={scanning} className="rounded-xl bg-[#096B4A] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
                {scanning ? "Scanning..." : "Run scan"}
              </button>
            </div>
          </div>

          {error && <ErrorPanel message={error} onRetry={() => void loadData()} />}

          {loading ? (
            <LoadingPanel label="Loading payment anomalies..." />
          ) : (
            <Card>
              {visible.length === 0 ? (
                <p className="p-4 text-center text-sm text-slate-400">No {showResolved ? "" : "open "}anomalies found. Run a scan to check for new ones.</p>
              ) : (
                <div className="space-y-3">
                  {visible.map((a) => (
                    <div key={a.id} className="rounded-xl border border-slate-100 p-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-bold text-[#101820]">{KIND_LABEL[a.kind] ?? a.kind}</p>
                            <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${a.status === "OPEN" ? "bg-amber-50 text-amber-600" : a.status === "ESCALATED" ? "bg-red-50 text-red-500" : "bg-emerald-50 text-emerald-600"}`}>{a.status}</span>
                          </div>
                          <p className="mt-1 text-[12px] text-slate-500">{a.businessRefType}: {a.businessRefId}</p>
                          <pre className="mt-2 max-w-xl overflow-x-auto rounded-lg bg-slate-50 p-2 text-[11px] text-slate-600">{JSON.stringify(a.evidence, null, 1)}</pre>
                          <p className="mt-1 text-[11px] text-slate-400">Last seen {new Date(a.lastSeenAt).toLocaleString("en-GB")}</p>
                          {a.note && <p className="mt-1 text-[12px] italic text-slate-500">Note: {a.note}</p>}
                        </div>
                        {a.status === "OPEN" && (
                          <div className="flex gap-2">
                            <button onClick={() => { setActing({ id: a.id, kind: "review" }); setNote(""); setActionError(""); }} className="rounded-lg bg-emerald-50 px-3 py-1.5 text-[11px] font-bold text-emerald-600 hover:bg-emerald-100">Mark reviewed</button>
                            <button onClick={() => { setActing({ id: a.id, kind: "escalate" }); setNote(""); setActionError(""); }} className="rounded-lg bg-red-50 px-3 py-1.5 text-[11px] font-bold text-red-500 hover:bg-red-100">Escalate</button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}
        </div>

        {acting && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4">
            <Card className="w-full max-w-md">
              <h3 className="text-xl font-black text-[#101820]">{acting.kind === "review" ? "Mark reviewed" : "Escalate"}</h3>
              <p className="mt-2 text-sm text-slate-500">
                {acting.kind === "escalate"
                  ? "This only flags the finding for follow-up — it never alters any payment or ledger record itself. Use the existing refund/four-eyes tools for any correction."
                  : "Record what you checked."}
              </p>
              <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (required)" className="mt-3 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none" />
              {actionError && <p className="mt-2 text-[12px] text-red-500">{actionError}</p>}
              <div className="mt-4 flex gap-3">
                <button disabled={busyId === acting.id || !note.trim()} onClick={() => void confirmAction()} className="flex-1 rounded-xl bg-[#096B4A] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">Confirm</button>
                <button onClick={() => setActing(null)} className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600">Cancel</button>
              </div>
            </Card>
          </div>
        )}
      </AdminLayout>
    </ProtectedRoute>
  );
}
