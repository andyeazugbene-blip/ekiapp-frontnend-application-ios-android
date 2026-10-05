"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Badge, Button, Card } from "@/components/AdminUI";
import { Banner, ConfirmDialog, formatDateTime } from "@/components/AdminKit";
import { APIError } from "@/lib/api";
import {
  communicationsAPI,
  type AudiencePreview,
  type BroadcastAudience,
  type BroadcastCategory,
  type BroadcastChannel,
  type BroadcastDraft,
  type BroadcastSendResult,
  type ChannelStatus,
  type MessagePreview,
  type RecipientHit,
  type TemplateRow,
  type TestSendResult,
} from "@/lib/services/communications.api";
import { AUDIENCE_LABEL, CHANNEL_LABEL, REASON_LABEL, ROLE_GROUPS, SEGMENTS, newKey, sumExcluded } from "./labels";

type Mode = "individual" | "group" | "segment";
const STEPS = ["Audience", "Reach", "Channels", "Compose", "Test", "Send"] as const;
const CHANNELS: BroadcastChannel[] = ["in_app", "push", "email"];

function errMsg(err: unknown, fallback: string): string {
  return err instanceof APIError || err instanceof Error ? err.message : fallback;
}

interface Props {
  status: ChannelStatus | null;
  canSend: boolean;
  initialUserId?: string;
  onSent: () => void;
}

export default function ComposeFlow({ status, canSend, initialUserId, onSent }: Props) {
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState<Mode>(initialUserId ? "individual" : "group");
  const [audience, setAudience] = useState<BroadcastAudience>(initialUserId ? "individual_user" : "buyers");
  const [person, setPerson] = useState<RecipientHit | null>(null);
  const [category, setCategory] = useState<BroadcastCategory>(initialUserId ? "operational" : "marketing");
  const [channels, setChannels] = useState<BroadcastChannel[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [deepLink, setDeepLink] = useState("");
  const [deepQuery, setDeepQuery] = useState("");
  const [templateKey, setTemplateKey] = useState("");
  const [templates, setTemplates] = useState<TemplateRow[]>([]);

  const [preview, setPreview] = useState<AudiencePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");

  const [msgPreview, setMsgPreview] = useState<MessagePreview | null>(null);

  const [test, setTest] = useState<{ result: TestSendResult; signature: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [testError, setTestError] = useState("");

  const [when, setWhen] = useState<"now" | "schedule">("now");
  const [scheduledAt, setScheduledAt] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [sent, setSent] = useState<BroadcastSendResult | null>(null);
  const keyRef = useRef(newKey());

  // ── deep link from other pages: /communications?userId=...
  useEffect(() => {
    if (!initialUserId) return;
    communicationsAPI.searchRecipients({ id: initialUserId })
      .then((r) => {
        if (r.users[0]) { setPerson(r.users[0]); setAudience("individual_user"); setMode("individual"); }
      })
      .catch(() => undefined);
  }, [initialUserId]);

  useEffect(() => {
    communicationsAPI.templates.list().then((r) => setTemplates(r.templates)).catch(() => undefined);
  }, []);

  const draft: BroadcastDraft = useMemo(() => ({
    title: title.trim(),
    body: body.trim(),
    audience,
    channels,
    category,
    deepLink: deepLink ? `${deepLink}${deepQuery.trim() ? `?${deepQuery.trim().replace(/^\?/, "")}` : ""}` : undefined,
    templateKey: templateKey || undefined,
    userId: audience === "individual_user" ? person?.id : undefined,
  }), [title, body, audience, channels, category, deepLink, deepQuery, templateKey, person]);

  // Content signature the test proof is tied to (same fields the server hashes).
  const signature = useMemo(
    () => JSON.stringify([draft.title, draft.body, [...channels].sort(), draft.deepLink ?? "", category]),
    [draft.title, draft.body, channels, draft.deepLink, category],
  );
  const testFresh = test && test.signature === signature && test.result.passed && !!test.result.testToken;

  // ── audience preview
  const audienceReady = audience !== "individual_user" || !!person;
  const previewKey = `${audience}|${person?.id ?? ""}|${category}|${channels.join(",")}`;
  useEffect(() => {
    if (!audienceReady) { setPreview(null); return; }
    let cancelled = false;
    setPreviewLoading(true);
    setPreviewError("");
    const t = setTimeout(() => {
      communicationsAPI.audiencePreview({ ...draft, channels: channels.length ? channels : CHANNELS })
        .then((r) => { if (!cancelled) setPreview(r); })
        .catch((e) => { if (!cancelled) { setPreview(null); setPreviewError(errMsg(e, "Could not count the audience.")); } })
        .finally(() => { if (!cancelled) setPreviewLoading(false); });
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewKey, audienceReady]);

  // Selected channels that stopped being usable (e.g. after changing audience) are dropped.
  const channelBlock = useCallback((ch: BroadcastChannel): string | null => {
    if (!status) return "Checking provider status…";
    if (ch === "email" && !status.email.configured) return "Email provider is not configured, so email cannot be sent.";
    if (ch === "push" && !status.push.configured) return "Push is not configured.";
    const elig = preview?.channels[ch];
    if (elig && elig.eligible === 0) return "No one in this audience is eligible on this channel.";
    return null;
  }, [status, preview]);
  useEffect(() => {
    setChannels((cur) => cur.filter((c) => !channelBlock(c)));
  }, [channelBlock]);

  // ── message preview
  const msgKey = `${draft.title}|${draft.body}|${category}|${draft.deepLink}`;
  useEffect(() => {
    if (step < 3 || !draft.title || !draft.body || channels.length === 0) { setMsgPreview(null); return; }
    let cancelled = false;
    const t = setTimeout(() => {
      communicationsAPI.previewMessage(draft, { name: "Amara", store_name: "Amara's Kitchen" })
        .then((r) => { if (!cancelled) setMsgPreview(r); })
        .catch(() => { if (!cancelled) setMsgPreview(null); });
    }, 350);
    return () => { cancelled = true; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [msgKey, step, channels.length]);

  const applyTemplate = (key: string) => {
    setTemplateKey(key);
    const t = templates.find((x) => x.key === key);
    if (t) { setTitle(t.title); setBody(t.body); }
  };

  const stepValid = (i: number): boolean => {
    switch (i) {
      case 0: return audienceReady;
      case 1: return !!preview && preview.total > 0;
      case 2: return channels.length > 0;
      case 3: return draft.title.length > 0 && draft.body.length > 0 && draft.title.length <= 120 && draft.body.length <= 1000;
      case 4: return !!testFresh;
      default: return true;
    }
  };

  const runTest = async () => {
    setTesting(true); setTestError("");
    try {
      const result = await communicationsAPI.testSend(draft);
      setTest({ result, signature });
    } catch (e) {
      setTestError(errMsg(e, "Test send failed."));
    } finally { setTesting(false); }
  };

  const scheduleIso = when === "schedule" && scheduledAt ? new Date(scheduledAt).toISOString() : undefined;
  const scheduleValid = when === "now" || (!!scheduleIso && new Date(scheduleIso).getTime() > Date.now() + 60_000);
  const paused = !!status?.pause.commsPaused;
  const canPressSend = canSend && !paused && !!testFresh && scheduleValid && (preview?.reachable ?? 0) > 0;

  const doSend = async (reason: string) => {
    setSending(true); setSendError("");
    try {
      const res = await communicationsAPI.send(draft, {
        reason,
        testToken: test!.result.testToken!,
        idempotencyKey: keyRef.current,
        scheduledFor: scheduleIso,
      });
      setSent(res);
      setConfirmOpen(false);
      keyRef.current = newKey();
      onSent();
    } catch (e) {
      setSendError(errMsg(e, "Send failed."));
    } finally { setSending(false); }
  };

  const reset = () => {
    setSent(null); setStep(0); setTitle(""); setBody(""); setChannels([]); setTest(null); setDeepLink(""); setDeepQuery("");
    setTemplateKey(""); setWhen("now"); setScheduledAt("");
  };

  if (sent) return <SentPanel result={sent} onAnother={reset} />;

  return (
    <div className="space-y-5">
      {/* Stepper */}
      <ol className="flex flex-wrap gap-2" aria-label="Broadcast steps">
        {STEPS.map((label, i) => {
          const reachable = i <= step || STEPS.slice(0, i).every((_, j) => stepValid(j));
          return (
            <li key={label}>
              <button
                type="button"
                disabled={!reachable}
                onClick={() => setStep(i)}
                aria-current={i === step ? "step" : undefined}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold transition disabled:opacity-50 ${i === step ? "border-[#096B4A] bg-[#096B4A] text-white" : i < step ? "border-emerald-200 bg-emerald-50 text-[#096B4A]" : "border-slate-200 bg-white text-slate-600"}`}
              >
                <span className={`flex h-5 w-5 items-center justify-center rounded-full text-xs ${i === step ? "bg-white/25" : "bg-slate-100 text-slate-600"}`}>{i < step ? "✓" : i + 1}</span>
                {label}
              </button>
            </li>
          );
        })}
      </ol>

      {paused ? <Banner tone="danger" title="Outbound communications are paused">Sending is blocked until a Super Administrator resumes it.</Banner> : null}
      {!canSend ? <Banner tone="warning" title="Read-only">Your role can view communications but not send them.</Banner> : null}

      <Card>
        {step === 0 ? (
          <AudienceStep
            mode={mode} setMode={(m) => { setMode(m); setAudience(m === "individual" ? "individual_user" : m === "group" ? "buyers" : "new_vendors"); setPerson(null); setCategory(m === "individual" ? "operational" : "marketing"); }}
            audience={audience} setAudience={setAudience} person={person} setPerson={setPerson}
          />
        ) : null}
        {step === 1 ? <ReachStep preview={preview} loading={previewLoading} error={previewError} category={category} setCategory={setCategory} status={status} /> : null}
        {step === 2 ? <ChannelStep channels={channels} toggle={(ch) => setChannels((cur) => (cur.includes(ch) ? cur.filter((c) => c !== ch) : [...cur, ch]))} block={channelBlock} status={status} preview={preview} /> : null}
        {step === 3 ? (
          <ComposeStep
            title={title} setTitle={setTitle} body={body} setBody={setBody} deepLink={deepLink} setDeepLink={setDeepLink}
            deepQuery={deepQuery} setDeepQuery={setDeepQuery} templates={templates} templateKey={templateKey} applyTemplate={applyTemplate}
            status={status} channels={channels} preview={msgPreview}
          />
        ) : null}
        {step === 4 ? <TestStep test={test} fresh={!!testFresh} testing={testing} error={testError} onRun={runTest} channels={channels} /> : null}
        {step === 5 ? (
          <SendStep
            when={when} setWhen={setWhen} scheduledAt={scheduledAt} setScheduledAt={setScheduledAt} scheduleValid={scheduleValid}
            draft={draft} preview={preview} person={person}
          />
        ) : null}
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>Back</Button>
        {step < STEPS.length - 1 ? (
          <Button disabled={!stepValid(step)} onClick={() => setStep((s) => s + 1)}>
            Next: {STEPS[step + 1]}
          </Button>
        ) : (
          <Button disabled={!canPressSend} onClick={() => { setSendError(""); setConfirmOpen(true); }}>
            {when === "schedule" ? "Review and schedule" : "Review and send"}
          </Button>
        )}
      </div>
      {step === 5 && !testFresh ? <p className="text-sm font-semibold text-amber-700">The Send button unlocks after a successful test of this exact content (step 5).</p> : null}

      <ConfirmDialog
        open={confirmOpen}
        tone="primary"
        title={when === "schedule" ? "Schedule this broadcast?" : "Send this broadcast now?"}
        confirmLabel={when === "schedule" ? "Schedule broadcast" : "Send broadcast"}
        reasonLabel="Purpose of this message (recorded in the audit log)"
        loading={sending}
        error={sendError}
        onCancel={() => { if (!sending) setConfirmOpen(false); }}
        onConfirm={(reason) => doSend(reason)}
        description={<ConfirmSummary draft={draft} preview={preview} person={person} schedule={when === "schedule" ? scheduleIso : undefined} />}
      />
    </div>
  );
}

// ─── Step 1 ─────────────────────────────────────────────────────────────────

function AudienceStep({ mode, setMode, audience, setAudience, person, setPerson }: {
  mode: Mode; setMode: (m: Mode) => void; audience: BroadcastAudience; setAudience: (a: BroadcastAudience) => void;
  person: RecipientHit | null; setPerson: (p: RecipientHit | null) => void;
}) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<RecipientHit[]>([]);
  const [searching, setSearching] = useState(false);
  useEffect(() => {
    if (mode !== "individual" || q.trim().length < 2) { setHits([]); return; }
    setSearching(true);
    const t = setTimeout(() => {
      communicationsAPI.searchRecipients({ q: q.trim() }).then((r) => setHits(r.users)).catch(() => setHits([])).finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(t);
  }, [q, mode]);

  const options = mode === "group" ? ROLE_GROUPS : SEGMENTS;
  return (
    <div className="space-y-5">
      <h2 className="text-xl font-black">1. Who should receive this?</h2>
      <div role="radiogroup" aria-label="Audience type" className="flex flex-wrap gap-2">
        {([["individual", "One person"], ["group", "Role group"], ["segment", "Saved segment"]] as const).map(([id, label]) => (
          <button key={id} role="radio" aria-checked={mode === id} onClick={() => setMode(id)}
            className={`rounded-xl border px-4 py-2 text-sm font-bold ${mode === id ? "border-[#096B4A] bg-emerald-50 text-[#096B4A]" : "border-slate-200 bg-white text-slate-700"}`}>{label}</button>
        ))}
      </div>

      {mode === "individual" ? (
        <div className="space-y-3">
          {person ? (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-[#096B4A] bg-emerald-50 p-4">
              <div>
                <p className="font-black text-[#101820]">{person.name} {person.vendor ? <span className="font-semibold text-slate-600">· {person.vendor.storeName}</span> : null}</p>
                <p className="text-sm text-slate-600">{person.email} · {person.role === "VENDOR" ? "Vendor" : "Buyer"}{person.isSuspended ? " · Suspended" : ""}</p>
              </div>
              <Button variant="ghost" onClick={() => setPerson(null)}>Change</Button>
            </div>
          ) : (
            <>
              <label className="block">
                <span className="text-xs font-black uppercase tracking-wide text-slate-500">Search by name, email or store</span>
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="At least 2 characters" className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-[#096B4A]" />
              </label>
              {searching ? <p className="text-sm text-slate-500">Searching…</p> : null}
              <ul className="space-y-2">
                {hits.map((h) => (
                  <li key={h.id}>
                    <button onClick={() => { setPerson(h); setAudience("individual_user"); }} className="flex w-full items-center justify-between rounded-xl border border-slate-200 p-3 text-left hover:border-emerald-300">
                      <span><span className="font-bold">{h.name}</span>{h.vendor ? <span className="text-slate-600"> · {h.vendor.storeName}</span> : null}<br /><span className="text-xs text-slate-500">{h.email}</span></span>
                      <Badge tone={h.role === "VENDOR" ? "blue" : "gray"}>{h.role === "VENDOR" ? "Vendor" : "Buyer"}</Badge>
                    </button>
                  </li>
                ))}
                {q.trim().length >= 2 && !searching && hits.length === 0 ? <li className="text-sm text-slate-500">No matching buyers or vendors.</li> : null}
              </ul>
            </>
          )}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {options.map((o) => (
            <button key={o.id} role="radio" aria-checked={audience === o.id} onClick={() => setAudience(o.id)}
              className={`rounded-xl border p-4 text-left transition ${audience === o.id ? "border-[#096B4A] bg-emerald-50" : "border-slate-200 bg-white hover:border-emerald-200"}`}>
              <p className="font-black text-[#101820]">{o.title}</p>
              <p className="mt-1 text-sm text-slate-600">{o.hint}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Step 2 ─────────────────────────────────────────────────────────────────

function ReachStep({ preview, loading, error, category, setCategory, status }: {
  preview: AudiencePreview | null; loading: boolean; error: string; category: BroadcastCategory;
  setCategory: (c: BroadcastCategory) => void; status: ChannelStatus | null;
}) {
  return (
    <div className="space-y-5">
      <h2 className="text-xl font-black">2. Who can actually be reached?</h2>
      <fieldset>
        <legend className="text-xs font-black uppercase tracking-wide text-slate-500">Message type</legend>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          {([["marketing", "Marketing / promotional", "Needs marketing consent, respects quiet hours, one per person per 24h, skips people who just got an automated message."], ["operational", "Service notice", "Important operational information. Consent, quiet hours and caps do not apply. Do not use for promotions."]] as const).map(([id, label, hint]) => (
            <label key={id} className={`cursor-pointer rounded-xl border p-4 ${category === id ? "border-[#096B4A] bg-emerald-50" : "border-slate-200"}`}>
              <input type="radio" name="category" className="mr-2 accent-[#096B4A]" checked={category === id} onChange={() => setCategory(id)} />
              <span className="font-black">{label}</span>
              <span className="mt-1 block text-sm text-slate-600">{hint}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {loading ? <p className="text-sm font-semibold text-slate-500">Counting…</p> : null}
      {error ? <Banner tone="danger">{error}</Banner> : null}
      {preview ? (
        <>
          <p className="text-lg font-black text-[#101820]">{preview.total} {preview.total === 1 ? "person matches" : "people match"} this audience · {preview.reachable} reachable on at least one channel</p>
          {preview.capped ? <Banner tone="warning" title="Audience limit reached">Only the first {status?.audienceCap ?? 1000} matching people are included in one send.</Banner> : null}
          {preview.quietHours && category === "marketing" ? <Banner tone="info" title="Quiet hours">Marketing push is excluded right now (22:00-07:00 UTC). Schedule for later to include push.</Banner> : null}
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-black uppercase tracking-wide text-slate-500">
                <tr><th className="px-4 py-3">Channel</th><th className="px-4 py-3">Eligible</th><th className="px-4 py-3">Excluded</th><th className="px-4 py-3">Why excluded</th></tr>
              </thead>
              <tbody>
                {CHANNELS.map((ch) => {
                  const c = preview.channels[ch];
                  return (
                    <tr key={ch} className="border-t border-slate-100 align-top">
                      <td className="px-4 py-3 font-bold">{CHANNEL_LABEL[ch]}</td>
                      <td className="px-4 py-3 font-black text-[#096B4A]">{c.eligible}</td>
                      <td className="px-4 py-3">{sumExcluded(c.excluded)}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {Object.entries(c.excluded).length === 0 ? "—" : Object.entries(c.excluded).map(([reason, n]) => (
                          <div key={reason}>{n} · {REASON_LABEL[reason as keyof typeof REASON_LABEL] ?? reason}</div>
                        ))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {preview.total === 0 ? <Banner tone="warning">Nobody matches this audience. Go back and pick another.</Banner> : null}
        </>
      ) : null}
    </div>
  );
}

// ─── Step 3 ─────────────────────────────────────────────────────────────────

function ChannelStep({ channels, toggle, block, status, preview }: {
  channels: BroadcastChannel[]; toggle: (c: BroadcastChannel) => void; block: (c: BroadcastChannel) => string | null;
  status: ChannelStatus | null; preview: AudiencePreview | null;
}) {
  const info: Record<BroadcastChannel, string> = {
    in_app: "Appears in the person's notification inbox in the app.",
    push: status ? `${status.push.provider}. ${status.push.tokenUsers} of ${status.push.totalUsers} users (${status.push.coveragePct}%) have a registered device.` : "",
    email: status ? (status.email.configured ? "Sent through Resend. Marketing emails include an unsubscribe link." : status.email.note) : "",
  };
  return (
    <div className="space-y-5">
      <h2 className="text-xl font-black">3. Choose channels</h2>
      <p className="text-sm text-slate-600">A channel is only selectable when its provider is configured and at least one person in the audience is eligible on it. SMS is not offered.</p>
      <div className="grid gap-3 sm:grid-cols-3">
        {CHANNELS.map((ch) => {
          const reason = block(ch);
          const on = channels.includes(ch);
          return (
            <button key={ch} disabled={!!reason} aria-pressed={on}
              onClick={() => toggle(ch)}
              className={`rounded-xl border p-4 text-left transition disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-70 ${on ? "border-[#096B4A] bg-emerald-50" : "border-slate-200 bg-white hover:border-emerald-200"}`}>
              <div className="flex items-center justify-between">
                <span className="text-lg font-black">{CHANNEL_LABEL[ch]}</span>
                {reason ? <Badge tone="gray">Unavailable</Badge> : on ? <Badge tone="green">Selected</Badge> : <Badge tone="blue">Available</Badge>}
              </div>
              <p className="mt-2 text-sm text-slate-600">{info[ch]}</p>
              {preview ? <p className="mt-2 text-sm font-bold text-slate-800">{preview.channels[ch].eligible} eligible</p> : null}
              {reason ? <p className="mt-2 text-sm font-semibold text-amber-700">{reason}</p> : null}
            </button>
          );
        })}
      </div>
      {status ? <p className="text-xs text-slate-500">Push &quot;Sent&quot; means handed to Expo Push Service (which relays to Apple/Google). It is only marked Delivered when Expo returns a successful receipt.</p> : null}
    </div>
  );
}

// ─── Step 4 ─────────────────────────────────────────────────────────────────

function ComposeStep({ title, setTitle, body, setBody, deepLink, setDeepLink, deepQuery, setDeepQuery, templates, templateKey, applyTemplate, status, channels, preview }: {
  title: string; setTitle: (v: string) => void; body: string; setBody: (v: string) => void; deepLink: string; setDeepLink: (v: string) => void;
  deepQuery: string; setDeepQuery: (v: string) => void; templates: TemplateRow[]; templateKey: string; applyTemplate: (k: string) => void;
  status: ChannelStatus | null; channels: BroadcastChannel[]; preview: MessagePreview | null;
}) {
  const badVars = useMemo(() => {
    const found = new Set<string>();
    for (const m of `${title} ${body}`.matchAll(/\{\{(\w+)\}\}/g)) if (!["name", "store_name"].includes(m[1])) found.add(m[1]);
    return [...found];
  }, [title, body]);
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <h2 className="text-xl font-black">4. Write the message</h2>
        <label className="block">
          <span className="text-xs font-black uppercase tracking-wide text-slate-500">Start from a template (optional)</span>
          <select value={templateKey} onChange={(e) => applyTemplate(e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm">
            <option value="">No template</option>
            {templates.filter((t) => t.enabled).map((t) => <option key={t.key} value={t.key}>{t.key.replace(/_/g, " ")}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-black uppercase tracking-wide text-slate-500">Title ({title.length}/120)</span>
          <input value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-[#096B4A]" />
        </label>
        <label className="block">
          <span className="text-xs font-black uppercase tracking-wide text-slate-500">Message ({body.length}/1000)</span>
          <textarea value={body} maxLength={1000} rows={6} onChange={(e) => setBody(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#096B4A]" />
        </label>
        <p className="text-xs text-slate-500">Variables: <code>{"{{name}}"}</code>, <code>{"{{store_name}}"}</code>. Push lock screens usually show about 120 characters. No cost applies to these channels.</p>
        {badVars.length > 0 ? <Banner tone="danger">Unsupported variable(s): {badVars.map((v) => `{{${v}}}`).join(", ")}. Broadcasts can only fill name and store_name.</Banner> : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-black uppercase tracking-wide text-slate-500">Open this screen when tapped (optional)</span>
            <select value={deepLink} onChange={(e) => setDeepLink(e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm">
              <option value="">Nothing (just opens the app)</option>
              {(status?.deepLinks ?? []).map((l) => <option key={l.path} value={l.path}>{l.label} ({l.audience})</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-black uppercase tracking-wide text-slate-500">Link parameters (optional)</span>
            <input value={deepQuery} onChange={(e) => setDeepQuery(e.target.value)} disabled={!deepLink} placeholder="id=abc123" className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm disabled:bg-slate-50" />
          </label>
        </div>
      </div>
      <div className="space-y-4">
        <h3 className="text-sm font-black uppercase tracking-wide text-slate-500">Preview per channel</h3>
        {!preview ? <p className="text-sm text-slate-500">Add a title and message to see the preview.</p> : (
          <>
            {channels.includes("push") ? (
              <div>
                <p className="mb-1 text-xs font-bold text-slate-500">Push notification</p>
                <div className="max-w-sm rounded-2xl bg-slate-900 p-3 text-white shadow">
                  <p className="text-[11px] opacity-70">EKI · now</p>
                  <p className="text-sm font-bold">{preview.push.title}</p>
                  <p className="line-clamp-3 text-sm opacity-90">{preview.push.body}</p>
                </div>
              </div>
            ) : null}
            {channels.includes("in_app") ? (
              <div>
                <p className="mb-1 text-xs font-bold text-slate-500">In-app notification</p>
                <div className="max-w-sm rounded-xl border border-slate-200 bg-white p-3">
                  <p className="text-sm font-black">{preview.in_app.title}</p>
                  <p className="mt-1 text-sm text-slate-600">{preview.in_app.body}</p>
                  {preview.in_app.deepLink ? <p className="mt-2 text-xs font-bold text-[#096B4A]">Opens: {preview.in_app.deepLink}</p> : null}
                </div>
              </div>
            ) : null}
            {channels.includes("email") ? (
              <div>
                <p className="mb-1 text-xs font-bold text-slate-500">Email · subject: {preview.email.subject}{preview.email.unsubscribe ? " · includes unsubscribe link" : ""}</p>
                <iframe title="Email preview" sandbox="" srcDoc={preview.email.html} className="h-72 w-full rounded-xl border border-slate-200 bg-white" />
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Step 5 ─────────────────────────────────────────────────────────────────

function TestStep({ test, fresh, testing, error, onRun, channels }: {
  test: { result: TestSendResult; signature: string } | null; fresh: boolean; testing: boolean; error: string; onRun: () => void; channels: BroadcastChannel[];
}) {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-black">5. Send a test to yourself</h2>
      <p className="text-sm text-slate-600">A real message goes through the same channel code to your own admin account only. You cannot send the broadcast until every selected channel test works. Changing the content or channels requires a new test.</p>
      <Button onClick={onRun} disabled={testing}>{testing ? "Sending test…" : test ? "Send test again" : "Send test to me"}</Button>
      {error ? <Banner tone="danger">{error}</Banner> : null}
      {test ? (
        <div className="space-y-2">
          {channels.map((ch) => {
            const r = test.result.results[ch];
            return (
              <div key={ch} className={`flex items-start justify-between gap-3 rounded-xl border p-3 ${r?.ok ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}>
                <div>
                  <p className="font-black">{CHANNEL_LABEL[ch]}</p>
                  <p className="text-sm text-slate-700">{r?.detail ?? r?.status ?? "No result"}</p>
                </div>
                <Badge tone={r?.ok ? "green" : "red"}>{r?.ok ? "Worked" : "Failed"}</Badge>
              </div>
            );
          })}
          {fresh ? <Banner tone="success">Test passed for this exact content. You can continue.</Banner>
            : <Banner tone="warning">{test.result.passed ? "The content or channels changed since this test. Run it again." : "At least one channel failed, so sending is locked. Fix the issue (or deselect that channel) and test again."}</Banner>}
          <p className="text-xs text-slate-500">Test sent to {test.result.sentTo}. Push is only handed to Expo; check your phone to confirm it arrived.</p>
        </div>
      ) : null}
    </div>
  );
}

// ─── Step 6 ─────────────────────────────────────────────────────────────────

function SendStep({ when, setWhen, scheduledAt, setScheduledAt, scheduleValid, draft, preview, person }: {
  when: "now" | "schedule"; setWhen: (w: "now" | "schedule") => void; scheduledAt: string; setScheduledAt: (v: string) => void;
  scheduleValid: boolean; draft: BroadcastDraft; preview: AudiencePreview | null; person: RecipientHit | null;
}) {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return (
    <div className="space-y-5">
      <h2 className="text-xl font-black">6. Deliver now or schedule</h2>
      <div role="radiogroup" aria-label="Delivery time" className="flex flex-wrap gap-2">
        {([["now", "Send now"], ["schedule", "Schedule for later"]] as const).map(([id, label]) => (
          <button key={id} role="radio" aria-checked={when === id} onClick={() => setWhen(id)}
            className={`rounded-xl border px-4 py-2 text-sm font-bold ${when === id ? "border-[#096B4A] bg-emerald-50 text-[#096B4A]" : "border-slate-200 bg-white text-slate-700"}`}>{label}</button>
        ))}
      </div>
      {when === "schedule" ? (
        <label className="block max-w-sm">
          <span className="text-xs font-black uppercase tracking-wide text-slate-500">Send at ({tz})</span>
          <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm" />
          {!scheduleValid ? <span className="mt-1 block text-sm font-semibold text-amber-700">Pick a time at least a minute in the future.</span> : null}
          <span className="mt-1 block text-xs text-slate-500">Delivery starts at the next 5-minute run after this time, never before it. Eligibility is re-checked when it sends.</span>
        </label>
      ) : null}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
        <ConfirmSummary draft={draft} preview={preview} person={person} schedule={when === "schedule" && scheduledAt ? new Date(scheduledAt).toISOString() : undefined} />
      </div>
    </div>
  );
}

function ConfirmSummary({ draft, preview, person, schedule }: { draft: BroadcastDraft; preview: AudiencePreview | null; person: RecipientHit | null; schedule?: string }) {
  return (
    <div className="space-y-2 text-sm text-slate-700">
      <p><span className="font-black">Audience:</span> {draft.audience === "individual_user" ? `${person?.name ?? "One person"} (${person?.email ?? ""})` : AUDIENCE_LABEL[draft.audience] ?? draft.audience}, {draft.category === "marketing" ? "marketing" : "service notice"}</p>
      {preview ? (
        <p><span className="font-black">Reach:</span> {preview.reachable} of {preview.total} people.{" "}
          {draft.channels.map((ch) => {
            const c = preview.channels[ch];
            const ex = sumExcluded(c.excluded);
            return `${CHANNEL_LABEL[ch]}: ${c.eligible} eligible, ${ex} excluded${ex ? ` (${Object.entries(c.excluded).map(([r, n]) => `${n} ${(REASON_LABEL[r as keyof typeof REASON_LABEL] ?? r).toLowerCase()}`).join("; ")})` : ""}.`;
          }).join(" ")}
        </p>
      ) : null}
      <p><span className="font-black">Channels:</span> {draft.channels.map((c) => CHANNEL_LABEL[c]).join(", ")}</p>
      <p><span className="font-black">When:</span> {schedule ? `Scheduled for ${formatDateTime(schedule)}` : "Immediately"}</p>
      <div className="rounded-lg border border-slate-200 bg-white p-3">
        <p className="font-black">{draft.title}</p>
        <p className="mt-1 whitespace-pre-wrap">{draft.body}</p>
        {draft.deepLink ? <p className="mt-2 text-xs font-bold text-[#096B4A]">Opens: {draft.deepLink}</p> : null}
      </div>
    </div>
  );
}

function SentPanel({ result, onAnother }: { result: BroadcastSendResult; onAnother: () => void }) {
  return (
    <Card className="space-y-4">
      {result.scheduled ? (
        <>
          <h2 className="text-xl font-black text-[#096B4A]">Broadcast scheduled</h2>
          <p className="text-sm text-slate-700">It will start at {formatDateTime(result.scheduledFor)} (next 5-minute run). You can cancel or reschedule it from the Scheduled tab.</p>
        </>
      ) : (
        <>
          <h2 className="text-xl font-black text-[#096B4A]">{result.duplicate ? "Already sent (duplicate prevented)" : "Broadcast processed"}</h2>
          {result.broadcast ? (
            <p className="text-sm text-slate-700">Status: <strong>{result.broadcast.status.replace(/_/g, " ").toLowerCase()}</strong>. {result.broadcast.error ?? "Open History to follow sent, delivered and failed counts."}</p>
          ) : null}
        </>
      )}
      <div className="flex gap-3">
        <Link href="/communications?tab=history" className="inline-flex h-11 items-center rounded-xl border border-[#096B4A] px-5 text-sm font-bold text-[#096B4A] hover:bg-emerald-50">View in History</Link>
        <Button variant="ghost" onClick={onAnother}>Compose another</Button>
      </div>
    </Card>
  );
}
