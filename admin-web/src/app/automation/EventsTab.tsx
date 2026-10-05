"use client";

import { useCallback, useEffect, useState } from "react";
import { ErrorPanel } from "@/components/AdminUI";
import { DataTable, formatDateTime, Pagination, type Column } from "@/components/AdminKit";
import { APIError } from "@/lib/api";
import { automationAPI, type EventRow } from "@/lib/services/automation.api";

export default function EventsTab() {
  const [rows, setRows] = useState<EventRow[]>([]);
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);
  const [next, setNext] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [entityType, setEntityType] = useState("");
  const [entityId, setEntityId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const page = cursors.length - 1;

  const load = useCallback(async (cursor?: string) => {
    try {
      setLoading(true); setError("");
      const r = await automationAPI.events({
        name: name.trim() || undefined, entityType: entityType.trim() || undefined, entityId: entityId.trim() || undefined, cursor, limit: 25,
        from: from ? new Date(from).toISOString() : undefined, to: to ? new Date(`${to}T23:59:59`).toISOString() : undefined,
      });
      setRows(r.items); setNext(r.nextCursor);
    } catch (e) { setError(e instanceof APIError ? e.message : "Could not load events"); }
    finally { setLoading(false); }
  }, [name, entityType, entityId, from, to]);
  useEffect(() => { setCursors([undefined]); const t = setTimeout(() => void load(undefined), 300); return () => clearTimeout(t); }, [load]);

  const field = "h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-[#096B4A]";
  const cols: Column<EventRow>[] = [
    { key: "t", header: "Occurred", render: (r) => <span className="whitespace-nowrap text-xs">{formatDateTime(r.occurredAt)}</span> },
    { key: "n", header: "Event", render: (r) => <span className="font-bold">{r.name}</span> },
    { key: "e", header: "Entity", render: (r) => <span className="text-xs">{r.entityType ?? "—"}{r.entityId ? ` · ${r.entityId}` : ""}</span> },
    { key: "a", header: "Actor", render: (r) => <span className="text-xs">{r.actorType ?? "—"}{r.actorId ? ` · ${r.actorId}` : ""}</span> },
    { key: "s", header: "Source", render: (r) => <span className="text-xs">{r.source ?? "—"}</span> },
    { key: "p", header: "Payload", render: (r) => <code className="block max-w-xs truncate text-xs" title={JSON.stringify(r.payload)}>{r.payload ? JSON.stringify(r.payload) : "—"}</code> },
  ];

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500">Canonical business events (handbook section 12) for troubleshooting. Read-only; emitting never blocks business actions, so a missing event does not mean the action failed.</p>
      <div className="flex flex-wrap items-center gap-3">
        <input className={field} placeholder="Event name e.g. payment_succeeded" aria-label="Event name" value={name} onChange={(e) => setName(e.target.value)} />
        <input className={field} placeholder="Entity type e.g. Order" aria-label="Entity type" value={entityType} onChange={(e) => setEntityType(e.target.value)} />
        <input className={field} placeholder="Entity ID" aria-label="Entity ID" value={entityId} onChange={(e) => setEntityId(e.target.value)} />
        <label className="text-xs font-bold text-slate-500">From <input type="date" className={field} value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label className="text-xs font-bold text-slate-500">To <input type="date" className={field} value={to} onChange={(e) => setTo(e.target.value)} /></label>
      </div>
      {error ? <ErrorPanel message={error} onRetry={() => void load(cursors[page])} /> : null}
      <DataTable columns={cols} rows={rows} rowKey={(r) => r.id} loading={loading} emptyTitle="No events match these filters" />
      <Pagination
        hasPrev={page > 0} hasNext={!!next} shown={rows.length} loading={loading}
        onPrev={() => { const c = cursors.slice(0, -1); setCursors(c); void load(c[c.length - 1]); }}
        onNext={() => { if (next) { setCursors([...cursors, next]); void load(next); } }}
      />
    </div>
  );
}
