"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, ErrorPanel, LoadingPanel } from "@/components/AdminUI";
import { Banner, DataTable, Pagination, StatusTabs, formatDateTime, type Column } from "@/components/AdminKit";
import { APIError } from "@/lib/api";
import {
  communicationsAPI,
  type BroadcastChannel,
  type BroadcastRecord,
  type BroadcastStatus,
  type ChannelCounts,
} from "@/lib/services/communications.api";
import { AUDIENCE_LABEL, CHANNEL_LABEL, REASON_LABEL, STATUS_LABEL, STATUS_TONE } from "./labels";

const TABS = [
  { key: "", label: "All" },
  { key: "SCHEDULED", label: "Scheduled" },
  { key: "SENDING", label: "Sending" },
  { key: "SENT", label: "Sent" },
  { key: "PARTIALLY_DELIVERED", label: "Partially delivered" },
  { key: "FAILED", label: "Failed" },
  { key: "DRAFT", label: "Draft" },
];

function total(counts: Record<string, ChannelCounts> | undefined, key: keyof ChannelCounts): number {
  return Object.values(counts ?? {}).reduce((a, c) => a + (c[key] ?? 0), 0);
}

export default function HistoryTab({ initialStatus = "" }: { initialStatus?: string }) {
  const [status, setStatus] = useState(initialStatus);
  const [items, setItems] = useState<BroadcastRecord[]>([]);
  const [cursors, setCursors] = useState<string[]>([""]);
  const [next, setNext] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<BroadcastRecord | null>(null);

  const load = useCallback(async (cursor: string, st: string) => {
    setLoading(true); setError("");
    try {
      const r = await communicationsAPI.listBroadcasts({ status: st || undefined, cursor: cursor || undefined, limit: 15 });
      setItems(r.items); setNext(r.nextCursor);
    } catch (e) {
      setError(e instanceof APIError ? e.message : "Could not load broadcast history.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { setCursors([""]); void load("", status); }, [status, load]);

  const columns: Column<BroadcastRecord>[] = [
    { key: "when", header: "When", render: (b) => <span className="whitespace-nowrap">{formatDateTime(b.completedAt ?? b.scheduledFor ?? b.createdAt)}</span> },
    { key: "title", header: "Message", render: (b) => (
      <div className="max-w-xs">
        <p className="truncate font-bold text-[#101820]">{b.title}</p>
        <p className="truncate text-xs text-slate-500">{AUDIENCE_LABEL[b.audience] ?? b.audience} · {b.category === "marketing" ? "Marketing" : "Service notice"}</p>
      </div>
    ) },
    { key: "by", header: "Sent by", render: (b) => b.createdBy?.name ?? "Not provided" },
    { key: "channels", header: "Channels", render: (b) => b.channels.map((c) => CHANNEL_LABEL[c as BroadcastChannel] ?? c).join(", ") },
    { key: "status", header: "Status", render: (b) => <Badge tone={STATUS_TONE[b.status]}>{STATUS_LABEL[b.status]}</Badge> },
    { key: "counts", header: "Sent / delivered / failed", render: (b) => (
      b.status === "SCHEDULED" || b.status === "CANCELLED" ? <span className="text-slate-400">—</span> :
      <span className="whitespace-nowrap text-sm"><strong>{total(b.counts, "sent") + total(b.counts, "delivered")}</strong> sent · <strong className="text-[#096B4A]">{total(b.counts, "delivered")}</strong> delivered · <strong className={total(b.counts, "failed") ? "text-red-600" : ""}>{total(b.counts, "failed")}</strong> failed</span>
    ) },
  ];

  return (
    <div className="space-y-4">
      <StatusTabs tabs={TABS} active={status} onChange={setStatus} />
      <Banner tone="info">
        <strong>Sent</strong> means handed to the provider (Expo for push, Resend for email). <strong>Delivered</strong> is only recorded when the provider returns a receipt, which for push can take several minutes. Email delivery is not tracked.
      </Banner>
      {error ? <ErrorPanel message={error} onRetry={() => void load(cursors[cursors.length - 1], status)} /> : null}
      {loading && items.length === 0 ? <LoadingPanel label="Loading broadcast history…" /> : (
        <>
          <DataTable columns={columns} rows={items} rowKey={(b) => b.id} onRowClick={setOpen} loading={loading} emptyTitle="No broadcasts yet. Sent and scheduled messages appear here." />
          <Pagination
            hasPrev={cursors.length > 1} hasNext={!!next} loading={loading} shown={items.length}
            onPrev={() => { const c = cursors.slice(0, -1); setCursors(c); void load(c[c.length - 1], status); }}
            onNext={() => { if (next) { setCursors([...cursors, next]); void load(next, status); } }}
          />
        </>
      )}
      {open ? <DetailDrawer id={open.id} onClose={() => setOpen(null)} /> : null}
    </div>
  );
}

function DetailDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const [data, setData] = useState<{ broadcast: BroadcastRecord; counts: Record<string, ChannelCounts> } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [failures, setFailures] = useState<Array<{ id: string; recipientId: string; channel: string; statusDetail?: string | null }>>([]);

  const load = useCallback(async () => {
    try {
      setData(await communicationsAPI.getBroadcast(id));
      const f = await communicationsAPI.recipientLogs(id, "FAILED");
      setFailures(f.items);
    } catch (e) { setError(e instanceof APIError ? e.message : "Could not load this broadcast."); }
  }, [id]);
  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const refresh = async () => {
    setBusy(true); setError("");
    try { setData(await communicationsAPI.checkReceipts(id)); await load(); }
    catch (e) { setError(e instanceof APIError ? e.message : "Could not check receipts."); }
    finally { setBusy(false); }
  };

  const b = data?.broadcast;
  const elig = b?.eligibility?.channels;
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-slate-950/40" role="dialog" aria-modal="true" aria-label="Broadcast details" onClick={onClose}>
      <div className="h-full w-full max-w-2xl overflow-y-auto bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-black text-[#101820]">{b?.title ?? "Broadcast"}</h2>
            {b ? <div className="mt-2 flex flex-wrap items-center gap-2"><Badge tone={STATUS_TONE[b.status]}>{STATUS_LABEL[b.status]}</Badge><span className="text-sm text-slate-500">{AUDIENCE_LABEL[b.audience] ?? b.audience}</span></div> : null}
          </div>
          <Button variant="ghost" onClick={onClose}>Close</Button>
        </div>
        {error ? <div className="mt-4"><ErrorPanel message={error} onRetry={() => void load()} /></div> : null}
        {!data && !error ? <div className="mt-6"><LoadingPanel label="Loading…" /></div> : null}
        {b && data ? (
          <div className="mt-5 space-y-5">
            {b.error ? <Banner tone="danger" title="Not delivered">{b.error}</Banner> : null}
            {b.channelResults?.email === "not_configured" ? <Banner tone="warning" title="Email not configured">The email provider is not configured, so no email was sent.</Banner> : null}
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs font-black uppercase tracking-wide text-slate-500">
                  <tr><th className="px-3 py-2">Channel</th><th className="px-3 py-2">Eligible</th><th className="px-3 py-2">Queued</th><th className="px-3 py-2">Sent</th><th className="px-3 py-2">Delivered</th><th className="px-3 py-2">Failed</th><th className="px-3 py-2">Read</th></tr>
                </thead>
                <tbody>
                  {b.channels.map((ch) => {
                    const c = data.counts[ch];
                    return (
                      <tr key={ch} className="border-t border-slate-100">
                        <td className="px-3 py-2 font-bold">{CHANNEL_LABEL[ch as BroadcastChannel] ?? ch}</td>
                        <td className="px-3 py-2">{c?.eligible ?? 0}</td><td className="px-3 py-2">{c?.queued ?? 0}</td><td className="px-3 py-2">{c?.sent ?? 0}</td>
                        <td className="px-3 py-2 font-bold text-[#096B4A]">{ch === "email" ? "Not tracked" : c?.delivered ?? 0}</td>
                        <td className="px-3 py-2 font-bold text-red-600">{c?.failed ?? 0}</td>
                        <td className="px-3 py-2">{ch === "in_app" ? c?.read ?? 0 : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button variant="secondary" disabled={busy} onClick={() => void refresh()}>{busy ? "Checking…" : "Check push receipts now"}</Button>
              <span className="self-center text-xs text-slate-500">Expo receipts become available a few minutes after sending.</span>
            </div>
            {elig ? (
              <div>
                <h3 className="text-sm font-black uppercase tracking-wide text-slate-500">Excluded at send time ({b.audienceTotal} matched)</h3>
                <ul className="mt-2 space-y-1 text-sm text-slate-700">
                  {b.channels.map((ch) => {
                    const e = elig[ch as BroadcastChannel];
                    if (!e) return null;
                    const parts = Object.entries(e.excluded);
                    return <li key={ch}><strong>{CHANNEL_LABEL[ch as BroadcastChannel]}:</strong> {parts.length === 0 ? "nobody excluded" : parts.map(([r, n]) => `${n} ${(REASON_LABEL[r as keyof typeof REASON_LABEL] ?? r).toLowerCase()}`).join("; ")}</li>;
                  })}
                </ul>
              </div>
            ) : null}
            {failures.length > 0 ? (
              <div>
                <h3 className="text-sm font-black uppercase tracking-wide text-slate-500">Failures (first {failures.length})</h3>
                <ul className="mt-2 space-y-1 text-sm">
                  {failures.map((f) => <li key={f.id} className="rounded-lg bg-red-50 px-3 py-1.5 text-red-800">{CHANNEL_LABEL[f.channel as BroadcastChannel] ?? f.channel} · {f.statusDetail ?? "failed"} <span className="text-xs text-red-600">({f.recipientId.slice(0, 8)}…)</span></li>)}
                </ul>
              </div>
            ) : null}
            <Card className="!p-4">
              <p className="text-xs font-black uppercase tracking-wide text-slate-500">Content</p>
              <p className="mt-1 font-bold">{b.title}</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{b.body}</p>
              {b.deepLink ? <p className="mt-2 text-xs font-bold text-[#096B4A]">Opens: {b.deepLink}</p> : null}
            </Card>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-xs font-black uppercase text-slate-500">Purpose</dt><dd className="font-semibold">{b.reason}</dd></div>
              <div><dt className="text-xs font-black uppercase text-slate-500">Created</dt><dd className="font-semibold">{formatDateTime(b.createdAt)}</dd></div>
              <div><dt className="text-xs font-black uppercase text-slate-500">Scheduled for</dt><dd className="font-semibold">{b.scheduledFor ? formatDateTime(b.scheduledFor) : "Sent immediately"}</dd></div>
              <div><dt className="text-xs font-black uppercase text-slate-500">Completed</dt><dd className="font-semibold">{b.completedAt ? formatDateTime(b.completedAt) : "Not yet"}</dd></div>
            </dl>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export type { BroadcastStatus };
