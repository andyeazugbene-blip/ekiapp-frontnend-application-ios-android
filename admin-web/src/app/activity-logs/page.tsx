"use client";

import { Fragment, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import AdminLayout from "@/components/AdminLayout";
import { Badge, Button, Card, ErrorPanel, LoadingPanel, PageHeader } from "@/components/AdminUI";
import { Banner, formatDateTime, Pagination } from "@/components/AdminKit";
import ProtectedRoute from "@/components/ProtectedRoute";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { APIError } from "@/lib/api";
import { AuditLogFilters, auditLogsAPI } from "@/lib/services/audit-logs.api";
import { AuditLogEntry } from "@/types";

const FILTER_KEYS: (keyof AuditLogFilters)[] = ["actor", "action", "entityType", "entityId", "from", "to", "q"];

function actionTone(action: string): "green" | "amber" | "red" | "blue" | "gray" {
  if (/reject|fail|escalate|restrict|hold|cancel|deactivate|delete|revoke|disable/i.test(action)) return "red";
  if (/approve|verify|resume|release|complete|enable|reactivate/i.test(action)) return "green";
  if (/pause|request|requery|invite|change/i.test(action)) return "amber";
  return "blue";
}

function humanAction(action: string): string {
  return action.replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\s+/g, " ").trim();
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function show(v: unknown): string {
  if (v === null || v === undefined) return "(empty)";
  return typeof v === "object" ? JSON.stringify(v) : String(v);
}

/** Before/after diff: only changed keys, falling back to listing the single side that exists. */
function DiffViewer({ before, after }: { before: unknown; after: unknown }) {
  const b = asRecord(before);
  const a = asRecord(after);
  if (!b && !a) return <p className="text-sm text-slate-500">No before/after snapshot was recorded for this action.</p>;
  const keys = Array.from(new Set([...Object.keys(b ?? {}), ...Object.keys(a ?? {})]));
  const rows = keys.filter((k) => !b || !a || show(b[k]) !== show(a[k]));
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs font-black uppercase tracking-wide text-slate-500">
          <tr><th className="px-3 py-2">Field</th><th className="px-3 py-2">Before</th><th className="px-3 py-2">After</th></tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={3} className="px-3 py-3 text-slate-500">No field values changed.</td></tr>
          ) : (
            rows.map((k) => (
              <tr key={k} className="border-t border-slate-100">
                <td className="px-3 py-2 font-bold">{k}</td>
                <td className="whitespace-pre-wrap break-all px-3 py-2 text-red-700">{b ? show(b[k]) : "(not recorded)"}</td>
                <td className="whitespace-pre-wrap break-all px-3 py-2 text-emerald-700">{a ? show(a[k]) : "(not recorded)"}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function ActivityLogsPage() {
  return (
    <ProtectedRoute>
      <AdminLayout>
        <Suspense fallback={<LoadingPanel label="Loading activity..." />}>
          <ActivityLogsContent />
        </Suspense>
      </AdminLayout>
    </ProtectedRoute>
  );
}

function ActivityLogsContent() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { has } = usePermissions();

  const filters = useMemo<AuditLogFilters>(() => {
    const f: AuditLogFilters = {};
    FILTER_KEYS.forEach((k) => {
      const v = params.get(k);
      if (v) f[k] = v;
    });
    return f;
  }, [params]);

  const [draft, setDraft] = useState<AuditLogFilters>(filters);
  const [rows, setRows] = useState<AuditLogEntry[]>([]);
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]); // cursor used for each page
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [entityTypes, setEntityTypes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => setDraft(filters), [filters]);

  useEffect(() => {
    auditLogsAPI.facets().then((f) => setEntityTypes(f.entityTypes)).catch(() => undefined);
  }, []);

  const loadPage = useCallback(
    async (pageIndex: number, stack: (string | undefined)[]) => {
      setLoading(true);
      setError("");
      try {
        const res = await auditLogsAPI.page(filters, stack[pageIndex], 25);
        setRows(res.items);
        setNextCursor(res.nextCursor);
      } catch (err) {
        setError(err instanceof APIError ? err.message : "Could not load activity logs.");
      } finally {
        setLoading(false);
      }
    },
    [filters],
  );

  // Any filter change restarts from the first page.
  useEffect(() => {
    setCursors([undefined]);
    setExpanded(null);
    void loadPage(0, [undefined]);
  }, [loadPage]);

  function apply() {
    const q = new URLSearchParams();
    FILTER_KEYS.forEach((k) => {
      const v = draft[k]?.trim();
      if (v) q.set(k, v);
    });
    router.replace(q.toString() ? `${pathname}?${q.toString()}` : pathname, { scroll: false });
  }

  function clear() {
    router.replace(pathname, { scroll: false });
  }

  async function exportCsv() {
    setExporting(true);
    setNotice("");
    setError("");
    try {
      const blob = await auditLogsAPI.exportCsv(filters);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      setNotice("Export downloaded (up to 5,000 most recent matching entries). The export itself is recorded in the audit log.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed.");
    } finally {
      setExporting(false);
    }
  }

  const field = "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#096B4A]";
  const pageIndex = cursors.length - 1;
  const hasFilters = Object.keys(filters).length > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit log"
        subtitle="Every administrator action: who, what, why, and what changed. Entries are append-only and cannot be edited or deleted."
        actions={
          has("audit.read") ? (
            <Button variant="ghost" disabled={exporting} onClick={() => void exportCsv()}>
              {exporting ? "Exporting..." : "Export CSV"}
            </Button>
          ) : null
        }
      />
      {notice ? <Banner tone="success">{notice}</Banner> : null}

      <Card>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            apply();
          }}
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
          aria-label="Audit log filters"
        >
          <label className="block text-xs font-black uppercase tracking-wide text-slate-500">Actor (name or email)
            <input className={`${field} mt-1 font-normal normal-case tracking-normal`} value={draft.actor ?? ""} onChange={(e) => setDraft({ ...draft, actor: e.target.value })} />
          </label>
          <label className="block text-xs font-black uppercase tracking-wide text-slate-500">Action contains
            <input className={`${field} mt-1 font-normal normal-case tracking-normal`} placeholder="e.g. refund, admin_role" value={draft.action ?? ""} onChange={(e) => setDraft({ ...draft, action: e.target.value })} />
          </label>
          <label className="block text-xs font-black uppercase tracking-wide text-slate-500">Entity type
            <select className={`${field} mt-1 font-normal normal-case tracking-normal`} value={draft.entityType ?? ""} onChange={(e) => setDraft({ ...draft, entityType: e.target.value })}>
              <option value="">All types</option>
              {Array.from(new Set([...(draft.entityType ? [draft.entityType] : []), ...entityTypes])).map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label className="block text-xs font-black uppercase tracking-wide text-slate-500">Entity ID
            <input className={`${field} mt-1 font-normal normal-case tracking-normal`} value={draft.entityId ?? ""} onChange={(e) => setDraft({ ...draft, entityId: e.target.value })} />
          </label>
          <label className="block text-xs font-black uppercase tracking-wide text-slate-500">From (UTC)
            <input type="date" className={`${field} mt-1 font-normal normal-case tracking-normal`} value={draft.from ?? ""} onChange={(e) => setDraft({ ...draft, from: e.target.value })} />
          </label>
          <label className="block text-xs font-black uppercase tracking-wide text-slate-500">To (UTC)
            <input type="date" className={`${field} mt-1 font-normal normal-case tracking-normal`} value={draft.to ?? ""} onChange={(e) => setDraft({ ...draft, to: e.target.value })} />
          </label>
          <label className="block text-xs font-black uppercase tracking-wide text-slate-500 sm:col-span-2">Reason contains
            <input className={`${field} mt-1 font-normal normal-case tracking-normal`} value={draft.q ?? ""} onChange={(e) => setDraft({ ...draft, q: e.target.value })} />
          </label>
          <div className="flex gap-2 sm:col-span-2 xl:col-span-4">
            <Button>Apply filters</Button>
            {hasFilters ? <Button type="button" variant="ghost" onClick={clear}>Clear</Button> : null}
          </div>
        </form>
      </Card>

      {error ? <ErrorPanel message={error} onRetry={() => void loadPage(pageIndex, cursors)} /> : null}

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs font-black uppercase tracking-wide text-slate-500">
            <tr>
              <th scope="col" className="px-4 py-3">When</th>
              <th scope="col" className="px-4 py-3">Actor</th>
              <th scope="col" className="px-4 py-3">Action</th>
              <th scope="col" className="px-4 py-3">Entity</th>
              <th scope="col" className="px-4 py-3">Reason</th>
              <th scope="col" className="px-4 py-3"><span className="sr-only">Details</span></th>
            </tr>
          </thead>
          <tbody className={loading ? "opacity-50" : ""}>
            {rows.length === 0 && !loading ? (
              <tr><td colSpan={6} className="px-4 py-12 text-center font-semibold text-slate-500">{hasFilters ? "No entries match these filters." : "No audit entries yet."}</td></tr>
            ) : null}
            {rows.map((r) => {
              const open = expanded === r.id;
              return (
                <Fragment key={r.id}>
                  <tr className="border-t border-slate-100 align-top">
                    <td className="whitespace-nowrap px-4 py-3">{formatDateTime(r.createdAt)}</td>
                    <td className="px-4 py-3">
                      <p className="font-bold text-[#101820]">{r.actor?.name ?? "Unknown user"}</p>
                      <p className="text-xs text-slate-500">{r.actor?.email ?? r.actorId}</p>
                    </td>
                    <td className="px-4 py-3"><Badge tone={actionTone(r.action)}>{humanAction(r.action)}</Badge></td>
                    <td className="px-4 py-3">
                      <p className="font-semibold">{r.entityType}</p>
                      <p className="break-all font-mono text-xs text-slate-500">{r.entityId ?? "Not provided"}</p>
                    </td>
                    <td className="max-w-xs px-4 py-3 text-slate-700">{r.reason ?? <span className="text-slate-400">Not recorded</span>}</td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" className="h-9 px-3" onClick={() => setExpanded(open ? null : r.id)} aria-expanded={open}>
                        {open ? "Hide" : "Details"}
                      </Button>
                    </td>
                  </tr>
                  {open ? (
                    <tr className="border-t border-slate-100 bg-slate-50/60">
                      <td colSpan={6} className="space-y-3 px-4 py-4">
                        <DiffViewer before={r.beforeState} after={r.afterState} />
                        {r.metadata ? (
                          <details className="text-sm">
                            <summary className="cursor-pointer font-bold text-slate-600">Raw metadata</summary>
                            <pre className="mt-2 overflow-x-auto rounded-xl bg-white p-3 text-xs">{JSON.stringify(r.metadata, null, 2)}</pre>
                          </details>
                        ) : null}
                        <p className="text-xs text-slate-400">Entry ID {r.id}</p>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <Pagination
        hasPrev={pageIndex > 0}
        hasNext={Boolean(nextCursor)}
        loading={loading}
        shown={rows.length}
        onPrev={() => {
          const stack = cursors.slice(0, -1);
          setCursors(stack);
          void loadPage(stack.length - 1, stack);
        }}
        onNext={() => {
          const stack = [...cursors, nextCursor ?? undefined];
          setCursors(stack);
          void loadPage(stack.length - 1, stack);
        }}
      />
    </div>
  );
}
