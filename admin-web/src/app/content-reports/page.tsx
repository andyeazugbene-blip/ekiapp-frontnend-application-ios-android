"use client";

import { useCallback, useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Card, ErrorPanel, LoadingPanel } from "@/components/AdminUI";
import ProtectedRoute from "@/components/ProtectedRoute";
import { APIError } from "@/lib/api";
import { ContentReport, ReportStatus, contentReportsAPI } from "@/lib/services/content-reports.api";

const REASON_LABEL: Record<string, string> = {
  inappropriate: "Inappropriate",
  spam: "Spam",
  harassment: "Harassment",
  fraud: "Fraud",
  other: "Other",
};

const STATUS_FILTERS: { label: string; value: ReportStatus | "ALL" }[] = [
  { label: "Pending", value: "PENDING" },
  { label: "Reviewed", value: "REVIEWED" },
  { label: "Dismissed", value: "DISMISSED" },
  { label: "All", value: "ALL" },
];

export default function ContentReportsPage() {
  const [items, setItems] = useState<ContentReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<ReportStatus | "ALL">("PENDING");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");

  const loadData = useCallback(async (status: ReportStatus | "ALL") => {
    try {
      setLoading(true);
      setError("");
      setItems(await contentReportsAPI.list(status === "ALL" ? undefined : status));
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Failed to load content reports");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadData(filter); }, [filter, loadData]);

  const act = async (id: string, status: "REVIEWED" | "DISMISSED") => {
    try {
      setBusyId(id);
      setActionError("");
      await contentReportsAPI.review(id, status);
      await loadData(filter);
    } catch (err) {
      setActionError(err instanceof APIError ? err.message : "Failed to update report");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <ProtectedRoute>
      <AdminLayout>
        <div className="space-y-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-black tracking-tight text-[#101820]">Content Reports</h1>
              <p className="text-[13px] text-slate-400">User-submitted reports on messages, reviews, products, and stores — real abuse/moderation queue, not a UI-only block.</p>
            </div>
            <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setFilter(f.value)}
                  className={`rounded-lg px-3 py-1.5 text-[12px] font-bold transition ${filter === f.value ? "bg-white text-[#096B4A] shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {error && <ErrorPanel message={error} onRetry={() => void loadData(filter)} />}
          {actionError && <p className="text-[12px] text-red-500">{actionError}</p>}

          {loading ? (
            <LoadingPanel label="Loading content reports..." />
          ) : (
            <Card>
              {items.length === 0 ? (
                <p className="p-4 text-center text-sm text-slate-400">No {filter === "ALL" ? "" : filter.toLowerCase() + " "}reports found.</p>
              ) : (
                <div className="space-y-3">
                  {items.map((r) => (
                    <div key={r.id} className="rounded-xl border border-slate-100 p-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-bold text-[#101820]">{REASON_LABEL[r.reason] ?? r.reason}</p>
                            <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${r.status === "PENDING" ? "bg-amber-50 text-amber-600" : r.status === "DISMISSED" ? "bg-slate-100 text-slate-500" : "bg-emerald-50 text-emerald-600"}`}>{r.status}</span>
                          </div>
                          <p className="mt-1 text-[12px] text-slate-500">{r.targetType}: {r.targetId}</p>
                          <p className="mt-1 text-[12px] text-slate-500">
                            Reported by {r.reporter ? `${r.reporter.name} (${r.reporter.email})` : "unknown user (account deleted)"}
                          </p>
                          {r.details && <p className="mt-2 max-w-xl rounded-lg bg-slate-50 p-2 text-[12px] text-slate-600">{r.details}</p>}
                          <p className="mt-1 text-[11px] text-slate-400">Submitted {new Date(r.createdAt).toLocaleString("en-GB")}</p>
                        </div>
                        {r.status === "PENDING" && (
                          <div className="flex gap-2">
                            <button disabled={busyId === r.id} onClick={() => void act(r.id, "REVIEWED")} className="rounded-lg bg-emerald-50 px-3 py-1.5 text-[11px] font-bold text-emerald-600 hover:bg-emerald-100 disabled:opacity-50">Mark reviewed</button>
                            <button disabled={busyId === r.id} onClick={() => void act(r.id, "DISMISSED")} className="rounded-lg bg-slate-100 px-3 py-1.5 text-[11px] font-bold text-slate-500 hover:bg-slate-200 disabled:opacity-50">Dismiss</button>
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
      </AdminLayout>
    </ProtectedRoute>
  );
}
