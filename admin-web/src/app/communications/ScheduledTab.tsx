"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button, ErrorPanel, LoadingPanel } from "@/components/AdminUI";
import { Banner, DataTable, formatDateTime, useConfirm, type Column } from "@/components/AdminKit";
import { APIError } from "@/lib/api";
import { communicationsAPI, type ScheduledItem } from "@/lib/services/communications.api";
import { AUDIENCE_LABEL } from "./labels";

const TONE: Record<string, "green" | "amber" | "red" | "blue" | "gray"> = {
  SCHEDULED: "blue", SENDING: "amber", SENT: "green", FAILED: "red", CANCELLED: "gray",
};

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function ScheduledTab({ canSend, paused }: { canSend: boolean; paused: boolean }) {
  const [items, setItems] = useState<ScheduledItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const confirm = useConfirm();
  const [edit, setEdit] = useState<{ item: ScheduledItem; subject: string; body: string; when: string } | null>(null);
  const [editReason, setEditReason] = useState("");
  const [editError, setEditError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setItems((await communicationsAPI.scheduled.list()).items); }
    catch (e) { setError(e instanceof APIError ? e.message : "Could not load scheduled broadcasts."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const cancel = (item: ScheduledItem) =>
    confirm.ask(
      { title: "Cancel this scheduled broadcast?", description: `"${item.subject}" will not be sent.`, confirmLabel: "Cancel broadcast", reasonLabel: "Reason for cancelling (audit log)" },
      async (reason) => { await communicationsAPI.scheduled.cancel(item.id, reason); await load(); },
    );

  const saveEdit = async () => {
    if (!edit) return;
    if (editReason.trim().length < 5) { setEditError("Enter a reason of at least 5 characters."); return; }
    setSaving(true); setEditError("");
    try {
      await communicationsAPI.scheduled.update(edit.item.id, {
        subject: edit.subject, body: edit.body, scheduledFor: new Date(edit.when).toISOString(), reason: editReason.trim(),
      });
      setEdit(null); setEditReason(""); await load();
    } catch (e) { setEditError(e instanceof APIError ? e.message : "Could not save."); }
    finally { setSaving(false); }
  };

  const runDue = async () => {
    setNote("");
    try {
      const r = await communicationsAPI.scheduled.runDue();
      setNote(`Processed ${String(r.processed ?? 0)}: ${String(r.sent ?? 0)} sent, ${String(r.failed ?? 0)} failed.${r.paused ? " Paused, so nothing was sent." : ""}`);
      await load();
    } catch (e) { setError(e instanceof APIError ? e.message : "Run failed."); }
  };

  const columns: Column<ScheduledItem>[] = [
    { key: "status", header: "Status", render: (i) => <Badge tone={TONE[i.status] ?? "gray"}>{i.status.charAt(0) + i.status.slice(1).toLowerCase()}</Badge> },
    { key: "msg", header: "Message", render: (i) => <div className="max-w-xs"><p className="truncate font-bold">{i.subject}</p><p className="truncate text-xs text-slate-500">{AUDIENCE_LABEL[i.audience] ?? i.audience}</p></div> },
    { key: "at", header: "Scheduled for", render: (i) => <span className="whitespace-nowrap">{formatDateTime(i.scheduledFor)}</span> },
    { key: "sent", header: "Sent at", render: (i) => (i.sentAt ? formatDateTime(i.sentAt) : "—") },
    { key: "err", header: "Note", render: (i) => (i.error ? <span className="text-sm text-red-600">{i.error}</span> : "—") },
    { key: "act", header: "", render: (i) => (
      i.status === "SCHEDULED" && canSend ? (
        <div className="flex gap-2">
          <Button variant="ghost" className="h-9 px-3" onClick={(e) => { e.stopPropagation(); setEdit({ item: i, subject: i.subject, body: i.body, when: toLocalInput(i.scheduledFor) }); setEditReason(""); setEditError(""); }}>Edit</Button>
          <Button variant="ghost" className="h-9 px-3" onClick={(e) => { e.stopPropagation(); cancel(i); }}>Cancel</Button>
        </div>
      ) : null
    ) },
  ];

  return (
    <div className="space-y-4">
      {paused ? <Banner tone="danger" title="Paused">Scheduled sends are not being claimed while communications are paused. Overdue items stay scheduled until resumed.</Banner> : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600">Due items are sent by a job that runs every 5 minutes, never before their scheduled time.</p>
        {canSend ? <Button variant="secondary" onClick={() => void runDue()}>Run due items now</Button> : null}
      </div>
      {note ? <Banner tone="success">{note}</Banner> : null}
      {error ? <ErrorPanel message={error} onRetry={() => void load()} /> : null}
      {loading ? <LoadingPanel label="Loading scheduled broadcasts…" /> : <DataTable columns={columns} rows={items} rowKey={(i) => i.id} emptyTitle="Nothing scheduled." />}
      {confirm.dialog}
      {edit ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" role="dialog" aria-modal="true" aria-label="Edit scheduled broadcast">
          <div className="w-full max-w-lg space-y-3 rounded-[20px] bg-white p-6">
            <h3 className="text-xl font-black">Edit scheduled broadcast</h3>
            <label className="block text-sm font-bold">Title<input value={edit.subject} maxLength={120} onChange={(e) => setEdit({ ...edit, subject: e.target.value })} className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 font-normal" /></label>
            <label className="block text-sm font-bold">Message<textarea value={edit.body} rows={5} maxLength={1000} onChange={(e) => setEdit({ ...edit, body: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 font-normal" /></label>
            <label className="block text-sm font-bold">Send at<input type="datetime-local" value={edit.when} onChange={(e) => setEdit({ ...edit, when: e.target.value })} className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 font-normal" /></label>
            <label className="block text-sm font-bold">Reason for the change<textarea value={editReason} rows={2} onChange={(e) => setEditReason(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 font-normal" /></label>
            {editError ? <p className="text-sm font-bold text-red-700">{editError}</p> : null}
            <div className="flex gap-3"><Button className="flex-1" disabled={saving} onClick={() => void saveEdit()}>{saving ? "Saving…" : "Save changes"}</Button><Button className="flex-1" variant="ghost" onClick={() => setEdit(null)}>Close</Button></div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
