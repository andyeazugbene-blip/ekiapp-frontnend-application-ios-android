"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, ErrorPanel } from "@/components/AdminUI";
import { Banner, DataTable, FilterSelect, formatDateTime, KeyValue, Pagination, SearchInput, useConfirm, type Column } from "@/components/AdminKit";
import { APIError } from "@/lib/api";
import { automationAPI, type AutomationRunRow } from "@/lib/services/automation.api";

const STATUSES = ["", "SENT", "SUPPRESSED", "FAILED", "ELIGIBILITY_CHECK", "QUEUED", "SCHEDULED", "CANCELLED"];
const label = (s: string) => s.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

export function stateTone(state: string): "green" | "amber" | "red" | "blue" | "gray" {
  if (state === "Delivered") return "green";
  if (state === "Handed to provider") return "blue";
  if (state === "Failed") return "red";
  if (state === "Suppressed") return "amber";
  return "gray";
}

function Detail({ run }: { run: AutomationRunRow }) {
  const t = run.triggerData ?? {};
  return (
    <div className="space-y-3 bg-slate-50 p-4">
      <KeyValue items={[
        { label: "Recipient", value: run.recipient ? `${run.recipient.name ?? "Not provided"} · ${run.recipient.email ?? "no email"}` : "Not provided" },
        { label: "Vendor", value: run.vendor?.storeName ?? "—" },
        { label: "Exact time", value: formatDateTime(run.createdAt) },
        { label: "Rule", value: run.ruleKey ?? "—" },
        { label: "Attempt", value: `${run.attempt}${run.retryOfId ? ` (retry of ${run.retryOfId})` : ""}` },
        { label: "Suppression reason", value: run.suppressedReason ? label(run.suppressedReason) : "—" },
        { label: "Failure reason", value: run.failureReason ?? "—" },
        { label: "Trigger data", value: Object.keys(t).length ? <code className="break-all text-xs">{JSON.stringify(t)}</code> : "None" },
      ]} />
      <div>
        <h4 className="text-sm font-black text-slate-700">Channels attempted</h4>
        {run.channels.length === 0 ? <p className="mt-1 text-sm text-slate-500">No channel detail recorded for this run.</p> : (
          <ul className="mt-1 space-y-1 text-sm">
            {run.channels.map((c) => (
              <li key={c.communicationLogId} className="flex flex-wrap gap-x-3">
                <strong>{label(c.channel)}</strong>
                <span>Provider response: {c.status === "DELIVERED" ? "Delivered (receipt confirmed)" : c.status === "SENT" ? "Accepted by provider (no delivery receipt yet)" : label(c.status)}</span>
                {c.providerRef ? <span className="text-slate-500">ref {c.providerRef}</span> : null}
                {c.statusDetail ? <span className="text-slate-500">{c.statusDetail}</span> : null}
                {c.deliveredAt ? <span className="text-slate-500">delivered {formatDateTime(c.deliveredAt)}</span> : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function RunsTab({ canMutate, initial }: { canMutate: boolean; initial: { vendorId?: string; ruleKey?: string; status?: string; type?: string } }) {
  const [rows, setRows] = useState<AutomationRunRow[]>([]);
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);
  const [next, setNext] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [recipient, setRecipient] = useState("");
  const [status, setStatus] = useState(initial.status ?? "");
  const [type, setType] = useState(initial.type ?? "");
  const [reason, setReason] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [vendorId, setVendorId] = useState(initial.vendorId ?? "");
  const [expanded, setExpanded] = useState<string | null>(null);
  const confirm = useConfirm();
  const page = cursors.length - 1;

  const load = useCallback(async (cursor?: string) => {
    try {
      setLoading(true); setError("");
      const r = await automationAPI.runs({
        status, type, recipient, reason, vendorId, ruleKey: initial.ruleKey, cursor, limit: 25,
        from: from ? new Date(from).toISOString() : undefined, to: to ? new Date(`${to}T23:59:59`).toISOString() : undefined,
      });
      setRows(r.items); setNext(r.nextCursor);
    } catch (e) { setError(e instanceof APIError ? e.message : "Could not load run history"); }
    finally { setLoading(false); }
  }, [status, type, recipient, reason, vendorId, from, to, initial.ruleKey]);

  useEffect(() => { setCursors([undefined]); void load(undefined); }, [load]);

  const retry = (run: AutomationRunRow) => confirm.ask(
    { tone: "primary", title: "Retry this failed run?", description: "Creates a new attempt for the same recipient. It is refused if this run was already retried successfully, so the message cannot be sent twice.", confirmLabel: "Retry" },
    async (why) => { await automationAPI.retryRun(run.id, why); await load(cursors[page]); },
  );

  const cols: Column<AutomationRunRow>[] = [
    { key: "t", header: "When", render: (r) => <span className="whitespace-nowrap text-xs">{formatDateTime(r.createdAt)}</span> },
    { key: "a", header: "Automation", render: (r) => <div><div className="font-bold">{label(r.type)}</div>{r.isTest ? <Badge tone="blue">Test</Badge> : null}</div> },
    { key: "r", header: "Recipient", render: (r) => <div><div className="font-semibold">{r.recipient?.name ?? "Not provided"}</div><div className="text-xs text-slate-500">{r.recipient?.email ?? ""}</div></div> },
    { key: "s", header: "Outcome", render: (r) => <Badge tone={stateTone(r.deliveryState)}>{r.deliveryState}</Badge> },
    { key: "w", header: "Reason / channels", render: (r) => <span className="text-xs text-slate-600">{r.suppressedReason ? label(r.suppressedReason) : r.failureReason ?? (r.channels.map((c) => label(c.channel)).join(", ") || "—")}</span> },
    { key: "x", header: "", render: (r) => (
      <div className="flex gap-2">
        <Button variant="ghost" className="h-8 px-3" onClick={() => setExpanded(expanded === r.id ? null : r.id)} aria-expanded={expanded === r.id}>{expanded === r.id ? "Hide" : "Details"}</Button>
        {canMutate && r.status === "FAILED" ? <Button variant="secondary" className="h-8 px-3" onClick={() => retry(r)}>Retry</Button> : null}
      </div>
    ) },
  ];

  return (
    <div className="space-y-3">
      <Banner tone="info" title="How to read outcomes">“Handed to provider” means Eki dispatched the message to the push/email provider. “Delivered” appears only when a provider receipt confirms it.</Banner>
      <div className="flex flex-wrap items-center gap-3">
        <SearchInput value={recipient} onChange={setRecipient} placeholder="Recipient name, email or ID" />
        <FilterSelect label="Status" value={status} onChange={setStatus} options={STATUSES.map((s) => ({ value: s, label: s ? label(s) : "All statuses" }))} />
        <input value={type} onChange={(e) => setType(e.target.value.toUpperCase())} placeholder="Type e.g. CART_RECOVERY" aria-label="Automation type" className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-[#096B4A]" />
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason contains…" aria-label="Reason" className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-[#096B4A]" />
        <input value={vendorId} onChange={(e) => setVendorId(e.target.value)} placeholder="Vendor ID" aria-label="Vendor ID" className="h-11 w-44 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-[#096B4A]" />
        <label className="text-xs font-bold text-slate-500">From <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-11 rounded-xl border border-slate-200 px-2 text-sm" /></label>
        <label className="text-xs font-bold text-slate-500">To <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-11 rounded-xl border border-slate-200 px-2 text-sm" /></label>
        {initial.ruleKey ? <Badge tone="blue">Rule: {initial.ruleKey}</Badge> : null}
      </div>
      {error ? <ErrorPanel message={error} onRetry={() => void load(cursors[page])} /> : null}
      <DataTable columns={cols} rows={rows} rowKey={(r) => r.id} loading={loading} emptyTitle="No automation runs match these filters" />
      {expanded ? <Card className="p-0 overflow-hidden"><Detail run={rows.find((r) => r.id === expanded) ?? rows[0]} /></Card> : null}
      <Pagination
        hasPrev={page > 0} hasNext={!!next} shown={rows.length} loading={loading}
        onPrev={() => { const c = cursors.slice(0, -1); setCursors(c); void load(c[c.length - 1]); }}
        onNext={() => { if (next) { setCursors([...cursors, next]); void load(next); } }}
      />
      {confirm.dialog}
    </div>
  );
}
