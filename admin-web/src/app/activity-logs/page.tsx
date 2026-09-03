"use client";

import { useEffect, useMemo, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Badge, Button, Card, ErrorPanel, LoadingPanel, PageHeader } from "@/components/AdminUI";
import ProtectedRoute from "@/components/ProtectedRoute";
import { APIError } from "@/lib/api";
import { auditLogsAPI } from "@/lib/services/audit-logs.api";
import { AuditLogEntry } from "@/types";

// Free-form metadata (Record<string, unknown> on the backend — see
// shared/utils/audit.ts) never guarantees a fixed key set, so this just
// humanizes whatever keys the writing call site actually included instead
// of a raw JSON dump. "reason" is pulled out and shown prominently since
// it's the key most admin-mutation call sites pass.
function humanizeKey(key: string): string {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()).replace(/_/g, " ");
}

function formatMetadataValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function actionTone(action: string): "green" | "amber" | "red" | "blue" | "gray" {
  if (/reject|fail|escalate|restrict|hold|cancel/i.test(action)) return "red";
  if (/approve|verify|resume|release|complete/i.test(action)) return "green";
  if (/pause|request|requery/i.test(action)) return "amber";
  return "blue";
}

export default function ActivityLogsPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [entityTypeFilter, setEntityTypeFilter] = useState<string | "ALL">("ALL");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    setError("");
    try {
      setLogs(await auditLogsAPI.getLogs());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load activity logs.");
    } finally {
      setLoading(false);
    }
  }

  const entityTypes = useMemo(() => Array.from(new Set(logs.map((l) => l.entityType))).sort(), [logs]);
  const filtered = entityTypeFilter === "ALL" ? logs : logs.filter((l) => l.entityType === entityTypeFilter);

  return (
    <ProtectedRoute>
      <AdminLayout>
        <div className="space-y-6">
          <PageHeader
            title="Audit Log"
            subtitle="Every administrator action — actor, reason, and the status change it made. Audit records cannot be edited after submission."
          />

          {error ? <ErrorPanel message={error} onRetry={() => void load()} /> : null}

          {entityTypes.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setEntityTypeFilter("ALL")}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${entityTypeFilter === "ALL" ? "bg-[#096B4A] text-white" : "bg-slate-100 text-slate-600"}`}
              >
                All
              </button>
              {entityTypes.map((t) => (
                <button
                  key={t}
                  onClick={() => setEntityTypeFilter(t)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${entityTypeFilter === t ? "bg-[#096B4A] text-white" : "bg-slate-100 text-slate-600"}`}
                >
                  {t}
                </button>
              ))}
            </div>
          ) : null}

          {loading ? (
            <LoadingPanel label="Loading activity..." />
          ) : filtered.length === 0 ? (
            <Card className="py-12 text-center">
              <p className="text-base font-semibold text-slate-700">No activity{entityTypeFilter !== "ALL" ? ` for ${entityTypeFilter}` : ""}.</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {filtered.map((log) => {
                const expanded = expandedId === log.id;
                const metadata = (log.metadata && typeof log.metadata === "object" ? log.metadata : {}) as Record<string, unknown>;
                const reason = typeof metadata.reason === "string" ? metadata.reason : undefined;
                const otherEntries = Object.entries(metadata).filter(([k]) => k !== "reason");

                return (
                  <Card key={log.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <Badge tone={actionTone(log.action)}>{log.action}</Badge>
                          <p className="text-sm text-slate-500">{log.entityType}{log.entityId ? ` · ${log.entityId}` : ""}</p>
                        </div>
                        <p className="mt-1 text-sm font-semibold text-[#101820]">
                          {log.actor?.name ?? log.actorId} <span className="font-normal text-slate-500">({log.actor?.email ?? "unknown actor"})</span>
                        </p>
                        {reason ? <p className="mt-1 text-sm text-slate-700">Reason: {reason}</p> : null}
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <p className="text-xs text-slate-400">{new Date(log.createdAt).toLocaleString()}</p>
                        {otherEntries.length > 0 ? (
                          <Button variant="ghost" onClick={() => setExpandedId(expanded ? null : log.id)}>{expanded ? "Hide" : "Details"}</Button>
                        ) : null}
                      </div>
                    </div>

                    {expanded && otherEntries.length > 0 ? (
                      <div className="mt-4 grid gap-2 border-t border-slate-100 pt-4 sm:grid-cols-2">
                        {otherEntries.map(([key, value]) => (
                          <div key={key} className="flex justify-between gap-3 text-sm">
                            <span className="text-slate-400">{humanizeKey(key)}</span>
                            <span className="font-medium text-[#101820]">{formatMetadataValue(value)}</span>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </AdminLayout>
    </ProtectedRoute>
  );
}
