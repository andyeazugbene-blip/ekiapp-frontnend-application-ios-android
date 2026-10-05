"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, EmptyState, ErrorPanel, LoadingPanel } from "@/components/AdminUI";
import { Banner, ConfirmDialog, formatDateTime, KeyValue, timeAgo, useConfirm } from "@/components/AdminKit";
import { APIError } from "@/lib/api";
import { automationAPI, type AutomationRule, type RuleState, type RulesResponse } from "@/lib/services/automation.api";
import Link from "next/link";

const STATE_TONE: Record<RuleState, "green" | "amber" | "red" | "blue" | "gray"> = {
  ACTIVE: "green", PAUSED: "amber", FAILED: "red", TEST: "blue", DRAFT: "gray", ARCHIVED: "gray",
};
const CHANNELS = ["push", "in_app", "email"] as const; // No SMS (product decision).
const CHANNEL_LABEL: Record<string, string> = { push: "Push", in_app: "In-app", email: "Email" };
const label = (s: string) => s.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

function EditDialog({ rule, onClose, onSaved }: { rule: AutomationRule | null; onClose: () => void; onSaved: () => void }) {
  const [channels, setChannels] = useState<string[]>([]);
  const [cap, setCap] = useState("");
  const [qStart, setQStart] = useState("22");
  const [qEnd, setQEnd] = useState("7");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!rule) return;
    setChannels(rule.channels ?? []);
    setCap(rule.timing?.frequencyCapDays != null ? String(rule.timing.frequencyCapDays) : "");
    setQStart(String(rule.timing?.quietHoursStartUtc ?? 22));
    setQEnd(String(rule.timing?.quietHoursEndUtc ?? 7));
    setError("");
  }, [rule]);

  if (!rule) return null;
  const input = "h-10 w-24 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-[#096B4A]";
  return (
    <ConfirmDialog
      open
      tone="primary"
      title={`Edit ${rule.name}`}
      description="Changes bump the rule version and take effect on the next run. Enforced settings: channels, frequency cap, quiet hours."
      confirmLabel="Save changes"
      loading={loading}
      error={error}
      onCancel={onClose}
      onConfirm={async (reason) => {
        setLoading(true); setError("");
        try {
          await automationAPI.updateRule(rule.id, {
            channels,
            timing: { frequencyCapDays: cap === "" ? null : Number(cap), quietHoursStartUtc: Number(qStart), quietHoursEndUtc: Number(qEnd) },
          }, reason);
          onSaved(); onClose();
        } catch (e) { setError(e instanceof APIError ? e.message : "Could not save"); }
        finally { setLoading(false); }
      }}
    >
      <fieldset className="mt-4">
        <legend className="text-sm font-bold text-slate-700">Channels</legend>
        <div className="mt-2 flex flex-wrap gap-4">
          {CHANNELS.map((c) => (
            <label key={c} className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <input type="checkbox" checked={channels.includes(c)} onChange={(e) => setChannels((cur) => e.target.checked ? [...cur, c] : cur.filter((x) => x !== c))} />
              {CHANNEL_LABEL[c]}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="mt-4 flex flex-wrap gap-6">
        <label className="text-sm font-bold text-slate-700">Frequency cap (days)
          <input className={`${input} mt-1 block`} inputMode="numeric" placeholder="none" value={cap} onChange={(e) => setCap(e.target.value)} />
        </label>
        <label className="text-sm font-bold text-slate-700">Quiet hours start (UTC hour)
          <input className={`${input} mt-1 block`} inputMode="numeric" value={qStart} onChange={(e) => setQStart(e.target.value)} />
        </label>
        <label className="text-sm font-bold text-slate-700">Quiet hours end (UTC hour)
          <input className={`${input} mt-1 block`} inputMode="numeric" value={qEnd} onChange={(e) => setQEnd(e.target.value)} />
        </label>
      </div>
    </ConfirmDialog>
  );
}

function TestDialog({ rule, onClose }: { rule: AutomationRule | null; onClose: () => void }) {
  const [recipient, setRecipient] = useState("");
  const [sendToMe, setSendToMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<string>("");
  useEffect(() => { setRecipient(""); setSendToMe(false); setError(""); setResult(""); }, [rule]);
  if (!rule) return null;
  return (
    <ConfirmDialog
      open
      tone="primary"
      title={`Test ${rule.name}`}
      description="Dry-run: checks whether the chosen recipient would be eligible and records a TEST run. No message is sent unless you tick 'Send to me', and then only to your own account."
      confirmLabel="Run test"
      loading={loading}
      error={error}
      onCancel={onClose}
      onConfirm={async (reason) => {
        setLoading(true); setError("");
        try {
          const r = await automationAPI.testRule(rule.id, { recipientUserId: recipient.trim() || undefined, sendToMe }, reason);
          setResult(`Test run recorded (${r.status}). ${r.eligible ? "Recipient would be eligible." : `Not eligible: ${label(r.ineligibleReason ?? "unknown")}.`} ${r.sentToAdmin ? "Message sent to your account." : "No message sent."}`);
        } catch (e) { setError(e instanceof APIError ? e.message : "Test failed"); }
        finally { setLoading(false); }
      }}
    >
      <label className="mt-4 block text-sm font-bold text-slate-700">Recipient user ID
        <input className="mt-1 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-[#096B4A]" value={recipient} onChange={(e) => setRecipient(e.target.value)} disabled={sendToMe} placeholder="User ID to check eligibility for" />
      </label>
      <label className="mt-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
        <input type="checkbox" checked={sendToMe} onChange={(e) => setSendToMe(e.target.checked)} /> Send the real message to me
      </label>
      {result ? <div className="mt-3"><Banner tone="info">{result}</Banner></div> : null}
    </ConfirmDialog>
  );
}

export default function AutomationsTab({ canMutate, isSuper, onChanged }: { canMutate: boolean; isSuper: boolean; onChanged: () => void }) {
  const [data, setData] = useState<RulesResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<string | null>(null);
  const [editing, setEditing] = useState<AutomationRule | null>(null);
  const [testing, setTesting] = useState<AutomationRule | null>(null);
  const confirm = useConfirm();

  const load = useCallback(async () => {
    try { setLoading(true); setError(""); setData(await automationAPI.rules()); }
    catch (e) { setError(e instanceof APIError ? e.message : "Could not load automations"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const act = (rule: AutomationRule, action: "pause" | "resume" | "archive" | "duplicate") => {
    const verb = { pause: "Pause", resume: "Resume", archive: "Archive", duplicate: "Duplicate" }[action];
    confirm.ask(
      {
        tone: action === "archive" || action === "pause" ? "danger" : "primary",
        title: `${verb} "${rule.name}"?`,
        description: action === "pause" ? "No new messages will be sent for this automation until resumed. Skipped runs are recorded as 'rule paused'."
          : action === "archive" ? "Archived rules stop permanently and cannot be resumed (duplicate instead)."
          : action === "duplicate" ? "Creates a DRAFT copy for documentation. A copy is not executed by the engine." : "The automation runs again from the next sweep.",
        confirmLabel: verb,
      },
      async (reason) => { await automationAPI.ruleAction(rule.id, action, reason); await load(); onChanged(); },
    );
  };

  const stop = () => confirm.ask(
    { tone: "danger", title: "Emergency stop all automations?", description: "Pauses every active rule and the global automation switch immediately. Transactional order/payment messages are unaffected. Requires 2FA.", confirmLabel: "Stop all automations" },
    async (reason) => { await automationAPI.emergencyStop(reason); await load(); onChanged(); },
  );
  const release = () => confirm.ask(
    { tone: "primary", title: "Release emergency stop?", description: "Re-enables the global switch and restores the rules the emergency stop paused. Rules you paused manually stay paused.", confirmLabel: "Release" },
    async (reason) => { await automationAPI.releaseEmergencyStop(reason); await load(); onChanged(); },
  );

  if (loading && !data) return <LoadingPanel label="Loading automations…" />;
  if (error) return <ErrorPanel message={error} onRetry={() => void load()} />;
  if (!data) return null;

  return (
    <div className="space-y-4">
      {data.automationsPaused ? <Banner tone="danger" title="Automations are paused globally">No automated message is being sent. Each blocked attempt is recorded in Run History as &ldquo;emergency pause&rdquo;.</Banner> : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-3xl text-sm text-slate-500">{data.note}</p>
        {canMutate && isSuper ? (data.automationsPaused ? <Button onClick={release}>Release emergency stop</Button> : <Button variant="danger" onClick={stop}>Emergency stop</Button>) : null}
      </div>

      {data.items.length === 0 ? <EmptyState title="No automations found" /> : data.items.map((r) => {
        const expanded = open === r.id;
        const c = r.counts30d;
        return (
          <Card key={r.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-black text-[#101820]">{r.name}</h3>
                  <Badge tone={STATE_TONE[r.state]}>{label(r.state)}</Badge>
                  <span className="text-xs font-semibold text-slate-400">v{r.version}</span>
                </div>
                <p className="mt-1 text-sm text-slate-600">{r.purpose}</p>
                <p className="mt-2 text-xs text-slate-500">
                  Last run: {r.lastRunAt ? timeAgo(r.lastRunAt) : "never"} · Last success: {r.lastSuccessAt ? formatDateTime(r.lastSuccessAt) : "none yet"} · 30d: {c.SENT ?? 0} handed to provider, {c.SUPPRESSED ?? 0} suppressed, {c.FAILED ?? 0} failed
                </p>
                {r.state !== "ACTIVE" && r.stateReason ? <p className="mt-1 text-xs font-semibold text-amber-700">{label(r.state)}: {r.stateReason}</p> : null}
                {r.lastSkippedAt ? <p className="mt-1 text-xs text-slate-500">Last skipped {timeAgo(r.lastSkippedAt)} ({label(r.lastSkipReason ?? "")})</p> : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href={`/automation?tab=runs&ruleKey=${encodeURIComponent(r.key)}`} className="inline-flex h-9 items-center rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-700 hover:bg-slate-50">Run history</Link>
                <Button variant="ghost" className="h-9 px-3" onClick={() => setOpen(expanded ? null : r.id)} aria-expanded={expanded}>{expanded ? "Hide details" : "Details"}</Button>
                {canMutate ? (
                  <>
                    <Button variant="ghost" className="h-9 px-3" onClick={() => setEditing(r)} disabled={r.state === "ARCHIVED"}>Edit</Button>
                    <Button variant="ghost" className="h-9 px-3" onClick={() => setTesting(r)} disabled={!r.automationType}>Test</Button>
                    {r.state === "ACTIVE" ? <Button variant="secondary" className="h-9 px-3" onClick={() => act(r, "pause")}>Pause</Button> : null}
                    {r.state === "PAUSED" || r.state === "DRAFT" || r.state === "TEST" || r.state === "FAILED" ? <Button className="h-9 px-3" onClick={() => act(r, "resume")}>{r.state === "PAUSED" ? "Resume" : "Activate"}</Button> : null}
                    <Button variant="ghost" className="h-9 px-3" onClick={() => act(r, "duplicate")}>Duplicate</Button>
                    {r.state !== "ARCHIVED" ? <Button variant="ghost" className="h-9 px-3" onClick={() => act(r, "archive")}>Archive</Button> : null}
                  </>
                ) : null}
              </div>
            </div>
            {expanded ? (
              <div className="mt-4 border-t border-slate-100 pt-4">
                <KeyValue items={[
                  { label: "Trigger", value: r.triggerDescription },
                  { label: "Audience", value: r.audience ?? "Not provided" },
                  { label: "Exclusions", value: r.exclusions?.length ? r.exclusions.join("; ") : "None" },
                  { label: "Stop conditions", value: r.timing?.stopConditions?.length ? r.timing.stopConditions.join("; ") : "None" },
                  { label: "Frequency cap", value: r.timing?.frequencyCapDays ? `${r.timing.frequencyCapDays} days` : "Per-subject dedupe only" },
                  { label: "Quiet hours (UTC)", value: `${r.timing?.quietHoursStartUtc ?? 22}:00 – ${r.timing?.quietHoursEndUtc ?? 7}:00` },
                  { label: "Channels", value: (r.channels ?? []).map((ch) => CHANNEL_LABEL[ch] ?? ch).join(", ") || "Not provided" },
                  { label: "Owner / feature", value: `${r.owner} · ${r.relatedFeature ?? "Not provided"}` },
                  { label: "Message preview", value: r.preview ? <span><strong>{r.preview.title}</strong><br />{r.preview.body}</span> : "Not provided" },
                ]} />
              </div>
            ) : null}
          </Card>
        );
      })}
      <EditDialog rule={editing} onClose={() => setEditing(null)} onSaved={() => { void load(); onChanged(); }} />
      <TestDialog rule={testing} onClose={() => setTesting(null)} />
      {confirm.dialog}
    </div>
  );
}
