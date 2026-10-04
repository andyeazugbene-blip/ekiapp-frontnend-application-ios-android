"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, ErrorPanel } from "@/components/AdminUI";
import { formatDateTime } from "@/components/AdminKit";
import { APIError } from "@/lib/api";
import { peopleAPI, type AdminNote, type TimelineEvent } from "@/lib/services/people.api";

type Kind = "users" | "vendors";

/** Internal staff notes. Never visible to the user/vendor. */
export function NotesCard({ kind, id }: { kind: Kind; id: string }) {
  const [notes, setNotes] = useState<AdminNote[]>([]);
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setError(""); setNotes(await peopleAPI.notes(kind, id)); }
    catch (e) { setError(e instanceof APIError ? e.message : "Could not load notes"); }
  }, [kind, id]);
  useEffect(() => { void load(); }, [load]);

  const add = async () => {
    try { setBusy(true); setError(""); await peopleAPI.addNote(kind, id, body); setBody(""); await load(); }
    catch (e) { setError(e instanceof APIError ? e.message : "Could not save note"); }
    finally { setBusy(false); }
  };

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-lg font-black text-[#101820]">Internal notes</h3>
        <Badge tone="gray">Staff only</Badge>
      </div>
      {error ? <ErrorPanel message={error} /> : null}
      <div className="space-y-2">
        <textarea
          value={body} onChange={(e) => setBody(e.target.value)} rows={2} maxLength={500}
          placeholder="Add a note for other staff (not visible to the user)…"
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#096B4A]"
        />
        <Button className="h-9 px-4" disabled={busy || body.trim().length < 5} onClick={() => void add()}>Add note</Button>
      </div>
      <ul className="mt-4 space-y-3">
        {notes.length === 0 ? <li className="text-sm font-semibold text-slate-500">No notes yet.</li> : notes.map((n) => (
          <li key={n.id} className="rounded-xl bg-slate-50 p-3">
            <p className="whitespace-pre-wrap text-sm text-slate-800">{n.body}</p>
            <p className="mt-1 text-xs font-semibold text-slate-500">{n.authorName} · {formatDateTime(n.createdAt)}</p>
          </li>
        ))}
      </ul>
    </Card>
  );
}

const ACTION_LABELS: Record<string, string> = {
  "user.suspend": "Account suspended",
  "user.unsuspend": "Account restored",
  "user.unsuspend.auto": "Suspension ended automatically",
  "vendor.suspend": "Store suspended",
  "vendor.unsuspend": "Store restored",
  "vendor.unsuspend.auto": "Suspension ended automatically",
  "vendor.close": "Store closed",
  "vendor.stripe_reminder": "Stripe onboarding reminder sent",
  "user.note_added": "Internal note added",
  "vendor.note_added": "Internal note added",
  "user.delete": "Account anonymised",
  "user.hard_delete": "Account deleted",
};

function labelFor(action: string): string {
  return ACTION_LABELS[action] ?? action.replace(/[._]/g, " ").replace(/^./, (c) => c.toUpperCase());
}

/** Complete account-action timeline from the audit log (who, what, why, when). */
export function TimelineCard({ kind, id }: { kind: Kind; id: string }) {
  const [events, setEvents] = useState<TimelineEvent[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    peopleAPI.timeline(kind, id)
      .then((e) => { if (alive) setEvents(e); })
      .catch((e) => { if (alive) setError(e instanceof APIError ? e.message : "Could not load timeline"); });
    return () => { alive = false; };
  }, [kind, id]);

  return (
    <Card>
      <h3 className="mb-3 text-lg font-black text-[#101820]">Account timeline</h3>
      {error ? <ErrorPanel message={error} /> : null}
      {events === null && !error ? <p className="text-sm font-semibold text-slate-500">Loading…</p> : null}
      {events && events.length === 0 ? <p className="text-sm font-semibold text-slate-500">No recorded admin actions.</p> : null}
      <ol className="space-y-3 border-l-2 border-slate-100 pl-4">
        {(events ?? []).map((ev) => (
          <li key={ev.id} className="relative">
            <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-[#096B4A]" />
            <p className="text-sm font-black text-slate-900">{labelFor(ev.action)}</p>
            {ev.reason ? <p className="text-sm text-slate-700">Reason: {ev.reason}</p> : null}
            <p className="text-xs font-semibold text-slate-500">{ev.actorName} · {formatDateTime(ev.createdAt)}</p>
          </li>
        ))}
      </ol>
    </Card>
  );
}
