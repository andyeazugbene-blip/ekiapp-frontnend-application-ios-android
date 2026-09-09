"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import AdminLayout from "@/components/AdminLayout";
import { Badge, Button, Card, ErrorPanel, Icon, LoadingPanel, PageHeader } from "@/components/AdminUI";
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
  return (
    <Suspense fallback={<AdminLayout><LoadingPanel label="Loading activity..." /></AdminLayout>}>
      <ActivityLogsContent />
    </Suspense>
  );
}

function ActivityLogsContent() {
  const searchParams = useSearchParams();
  const linkedEntityId = searchParams.get("entityId");
  const linkedEntityType = searchParams.get("entityType");

  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [entityTypeFilter, setEntityTypeFilter] = useState<string | "ALL">(linkedEntityType ?? "ALL");
  const [entityIdFilter, setEntityIdFilter] = useState(linkedEntityId ?? "");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityIdFilter]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      setLogs(await auditLogsAPI.getLogs(entityIdFilter.trim() ? { entityId: entityIdFilter.trim() } : undefined));
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
            actions={<Button variant="ghost" onClick={() => void load()}><Icon name="refresh" className="h-4 w-4" />Refresh</Button>}
          />

          {error ? <ErrorPanel message={error} onRetry={() => void load()} /> : null}

          <div className="flex flex-wrap items-center gap-3">
            <input
              placeholder="Filter by entity ID (e.g. a campaign ID)"
              value={entityIdFilter}
              onChange={(e) => setEntityIdFilter(e.target.value)}
              className="w-72 rounded-xl border border-slate-200 p-2 text-sm"
            />
            {entityIdFilter ? (
              <button onClick={() => setEntityIdFilter("")} className="text-sm font-semibold text-slate-500 underline">
                Clear
              </button>
            ) : null}
          </div>

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
              <p className="text-base font-semibold text-slate-700">
                No activity{entityTypeFilter !== "ALL" ? ` for ${entityTypeFilter}` : ""}{entityIdFilter ? ` for entity ${entityIdFilter}` : ""}.
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {filtered.map((log) => {
                const expanded = expandedId === log.id;
                const metadata = (log.metadata && typeof log.metadata === "object" ? log.metadata : {}) as Record<string, unknown>;
                const otherEntries = Object.entries(metadata);
                const before = log.beforeState && typeof log.beforeState === "object" ? (log.beforeState as Record<string, unknown>) : null;
                const after = log.afterState && typeof log.afterState === "object" ? (log.afterState as Record<string, unknown>) : null;
                const hasDetails = otherEntries.length > 0 || before || after;

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
                        {log.reason ? <p className="mt-1 text-sm text-slate-700">Reason: {log.reason}</p> : null}
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <p className="text-xs text-slate-400">{new Date(log.createdAt).toLocaleString()}</p>
                        {hasDetails ? (
                          <Button variant="ghost" onClick={() => setExpandedId(expanded ? null : log.id)}>{expanded ? "Hide" : "Details"}</Button>
                        ) : null}
                      </div>
                    </div>

                    {expanded && hasDetails ? (
                      <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
                        {before || after ? (
                          <div className="grid gap-3 sm:grid-cols-2">
                            {before ? (
                              <div>
                                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Previous state</p>
                                <p className="mt-1 text-sm text-slate-700">{formatMetadataValue(before)}</p>
                              </div>
                            ) : null}
                            {after ? (
                              <div>
                                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">New state</p>
                                <p className="mt-1 text-sm text-slate-700">{formatMetadataValue(after)}</p>
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                        {otherEntries.length > 0 ? (
                          <div className="grid gap-2 sm:grid-cols-2">
                            {otherEntries.map(([key, value]) => (
                              <div key={key} className="flex justify-between gap-3 text-sm">
                                <span className="text-slate-400">{humanizeKey(key)}</span>
                                <span className="font-medium text-[#101820]">{formatMetadataValue(value)}</span>
                              </div>
                            ))}
                          </div>
                        ) : null}
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
