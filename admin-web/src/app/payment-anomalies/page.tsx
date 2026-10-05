"use client";

import { useCallback, useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Card, EmptyState, ErrorPanel, LoadingPanel, PageHeader } from "@/components/AdminUI";
import { Banner, formatDateTime, useConfirm } from "@/components/AdminKit";
import ProtectedRoute from "@/components/ProtectedRoute";
import { APIError } from "@/lib/api";
import { usePermissions } from "@/lib/hooks/usePermissions";
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
  const { has, loading: permLoading } = usePermissions();
  const canMutate = has("reports.mutate");
  const confirm = useConfirm();

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
      setError("");
      await paymentAnomaliesAPI.scan();
      await loadData();
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Scan failed");
    } finally {
      setScanning(false);
    }
  };

  const act = (a: PaymentAnomaly, kind: "review" | "escalate") => confirm.ask(
    {
      title: kind === "review" ? "Mark reviewed" : "Escalate this anomaly",
      tone: kind === "review" ? "primary" : "danger",
      confirmLabel: kind === "review" ? "Mark reviewed" : "Escalate",
      description: kind === "escalate"
        ? "This only flags the finding for follow-up. It never alters any payment or ledger record. Use the refund / approval tools for any correction."
        : `${KIND_LABEL[a.kind] ?? a.kind}. Record what you checked.`,
      reasonLabel: "Note (recorded in the audit log)",
    },
    async (note) => {
      if (kind === "review") await paymentAnomaliesAPI.review(a.id, note);
      else await paymentAnomaliesAPI.escalate(a.id, note);
      await loadData();
    },
  );

  const visible = items.filter((a) => (showResolved ? true : a.status === "OPEN"));

  return (
    <ProtectedRoute>
      <AdminLayout>
        <div className="space-y-5">
          <PageHeader
            title="Payment Anomalies"
            subtitle="Real findings from actual payment and ledger rows: duplicate references, double charges and missing ledger entries."
            actions={
              <>
                <label className="flex items-center gap-2 text-[13px] text-slate-600">
                  <input type="checkbox" checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)} />
                  Show reviewed / escalated
                </label>
                {canMutate ? (
                  <button onClick={() => void runScan()} disabled={scanning} className="rounded-xl bg-[#096B4A] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
                    {scanning ? "Scanning..." : "Run scan"}
                  </button>
                ) : null}
              </>
            }
          />

          {error && <ErrorPanel message={error} onRetry={() => void loadData()} />}
          {!permLoading && !canMutate ? <Banner tone="info">Your role can view anomalies but cannot scan, review or escalate them.</Banner> : null}

          {loading ? (
            <LoadingPanel label="Loading payment anomalies..." />
          ) : visible.length === 0 ? (
            <EmptyState title={`No ${showResolved ? "" : "open "}anomalies found.${canMutate ? " Run a scan to check for new ones." : ""}`} />
          ) : (
            <Card>
              <div className="space-y-3">
                {visible.map((a) => (
                  <div key={a.id} className="rounded-xl border border-slate-100 p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-[#101820]">{KIND_LABEL[a.kind] ?? a.kind}</p>
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${a.status === "OPEN" ? "bg-amber-50 text-amber-600" : a.status === "ESCALATED" ? "bg-red-50 text-red-500" : "bg-emerald-50 text-emerald-600"}`}>{a.status.toLowerCase()}</span>
                        </div>
                        <p className="mt-1 text-[12px] text-slate-500">{a.businessRefType}: {a.businessRefId}</p>
                        <pre className="mt-2 max-w-xl overflow-x-auto rounded-lg bg-slate-50 p-2 text-[11px] text-slate-600">{JSON.stringify(a.evidence, null, 1)}</pre>
                        <p className="mt-1 text-[11px] text-slate-400">Last seen {formatDateTime(a.lastSeenAt)}</p>
                        {a.note && <p className="mt-1 text-[12px] italic text-slate-500">Note: {a.note}</p>}
                      </div>
                      {a.status === "OPEN" && canMutate && (
                        <div className="flex gap-2">
                          <button onClick={() => act(a, "review")} className="rounded-lg bg-emerald-50 px-3 py-1.5 text-[11px] font-bold text-emerald-600 hover:bg-emerald-100">Mark reviewed</button>
                          <button onClick={() => act(a, "escalate")} className="rounded-lg bg-red-50 px-3 py-1.5 text-[11px] font-bold text-red-500 hover:bg-red-100">Escalate</button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
        {confirm.dialog}
      </AdminLayout>
    </ProtectedRoute>
  );
}
