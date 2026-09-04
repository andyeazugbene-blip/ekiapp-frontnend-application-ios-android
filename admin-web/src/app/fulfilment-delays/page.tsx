"use client";

import { useCallback, useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Card, ErrorPanel, LoadingPanel } from "@/components/AdminUI";
import ProtectedRoute from "@/components/ProtectedRoute";
import { APIError } from "@/lib/api";
import { fulfilmentDelaysAPI, FulfilmentDelayAlert } from "@/lib/services/fulfilment-delays.api";

const REASON_LABEL: Record<string, string> = {
  PAST_ESTIMATED_READY_DATE: "Past the supplier's own estimated ready date",
  STALE_NO_PROGRESS: "No progress for longer than the configured threshold",
};

export default function FulfilmentDelaysPage() {
  const [items, setItems] = useState<FulfilmentDelayAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");
  const [staleConfigured, setStaleConfigured] = useState<boolean | null>(null);
  const [showResolved, setShowResolved] = useState(false);
  const [acting, setActing] = useState<{ id: string; kind: "contact" | "resolve" | "escalate" } | null>(null);
  const [note, setNote] = useState("");
  const [actionError, setActionError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      setItems(await fulfilmentDelaysAPI.list());
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Failed to load fulfilment delays");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  const runScan = async () => {
    try {
      setScanning(true);
      const result = await fulfilmentDelaysAPI.scan();
      setStaleConfigured(result.staleCheckConfigured);
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
      if (acting.kind === "contact") await fulfilmentDelaysAPI.contactSupplier(acting.id, note.trim());
      else if (acting.kind === "resolve") await fulfilmentDelaysAPI.resolve(acting.id, note.trim());
      else await fulfilmentDelaysAPI.escalate(acting.id, note.trim());
      setActing(null);
      setNote("");
      await loadData();
    } catch (err) {
      setActionError(err instanceof APIError ? err.message : "Failed to save");
    } finally {
      setBusyId(null);
    }
  };

  const visible = items.filter((a) => (showResolved ? true : a.status === "OPEN" || a.status === "CONTACTED"));

  return (
    <ProtectedRoute>
      <AdminLayout>
        <div className="space-y-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-black tracking-tight text-[#101820]">Supplier Fulfilment Delays</h1>
              <p className="text-[13px] text-slate-400">Real findings from actual fulfilment records — never an invented deadline.</p>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-[13px] text-slate-600">
                <input type="checkbox" checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)} />
                Show resolved/escalated
              </label>
              <button onClick={() => void runScan()} disabled={scanning} className="rounded-xl bg-[#096B4A] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
                {scanning ? "Scanning..." : "Run scan"}
              </button>
            </div>
          </div>

          {staleConfigured === false && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] text-amber-700">
              The "no progress" fallback check is inactive — set FULFILMENT_STALE_THRESHOLD_HOURS to enable it for fulfilments with no estimated-ready date at all. This is a client configuration decision, not a bug.
            </div>
          )}

          {error && <ErrorPanel message={error} onRetry={() => void loadData()} />}

          {loading ? (
            <LoadingPanel label="Loading fulfilment delays..." />
          ) : (
            <Card>
              {visible.length === 0 ? (
                <p className="p-4 text-center text-sm text-slate-400">No delayed fulfilments found. Run a scan to check for new ones.</p>
              ) : (
                <div className="space-y-3">
                  {visible.map((a) => (
                    <div key={a.id} className="rounded-xl border border-slate-100 p-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-bold text-[#101820]">{a.campaign?.title ?? a.campaignId}</p>
                            <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${a.status === "OPEN" ? "bg-amber-50 text-amber-600" : a.status === "ESCALATED" ? "bg-red-50 text-red-500" : a.status === "CONTACTED" ? "bg-blue-50 text-blue-600" : "bg-emerald-50 text-emerald-600"}`}>{a.status}</span>
                          </div>
                          <p className="mt-1 text-[12px] text-slate-500">{REASON_LABEL[a.reason] ?? a.reason}</p>
                          {a.campaign?.supplier?.vendor?.storeName && <p className="text-[12px] text-slate-500">Supplier: {a.campaign.supplier.vendor.storeName}</p>}
                          <pre className="mt-2 max-w-xl overflow-x-auto rounded-lg bg-slate-50 p-2 text-[11px] text-slate-600">{JSON.stringify(a.evidence, null, 1)}</pre>
                          <p className="mt-1 text-[11px] text-slate-400">Last seen {new Date(a.lastSeenAt).toLocaleString("en-GB")}</p>
                          {a.note && <p className="mt-1 text-[12px] italic text-slate-500">Note: {a.note}</p>}
                        </div>
                        {(a.status === "OPEN" || a.status === "CONTACTED") && (
                          <div className="flex flex-wrap gap-2">
                            <button onClick={() => { setActing({ id: a.id, kind: "contact" }); setNote(""); setActionError(""); }} className="rounded-lg bg-blue-50 px-3 py-1.5 text-[11px] font-bold text-blue-600 hover:bg-blue-100">Contact supplier</button>
                            <button onClick={() => { setActing({ id: a.id, kind: "resolve" }); setNote(""); setActionError(""); }} className="rounded-lg bg-emerald-50 px-3 py-1.5 text-[11px] font-bold text-emerald-600 hover:bg-emerald-100">Resolve</button>
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
              <h3 className="text-xl font-black text-[#101820]">
                {acting.kind === "contact" ? "Contact supplier" : acting.kind === "resolve" ? "Resolve" : "Escalate"}
              </h3>
              <p className="mt-2 text-sm text-slate-500">
                {acting.kind === "contact"
                  ? "Sends a real in-app notification to the supplier with your note."
                  : acting.kind === "escalate"
                    ? "This only flags the alert for follow-up — it never auto-cancels or auto-refunds anything."
                    : "Record what happened."}
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
