"use client";

import { useState } from "react";
import { Badge, Button, Card } from "@/components/AdminUI";
import { Banner, formatDateTime, useConfirm } from "@/components/AdminKit";
import { disputesAPI2, type DisputeDetail } from "@/lib/services/money.api";

const TYPE_LABEL: Record<string, string> = {
  NOT_RECEIVED: "Item not received", DAMAGED: "Item damaged", WRONG_ITEM: "Wrong item", QUALITY: "Quality problem", OTHER: "Other issue",
};
const ROLE_TONE: Record<string, string> = { BUYER: "bg-sky-50 border-sky-200", VENDOR: "bg-emerald-50 border-emerald-200", ADMIN: "bg-slate-50 border-slate-200" };

function deadlineBanner(d: DisputeDetail) {
  const dl = d.deadline;
  if (!dl || dl.state === "CLOSED" || dl.state === "NONE") return null;
  const when = dl.respondByAt ? formatDateTime(dl.respondByAt) : "";
  if (dl.state === "OVERDUE") return <Banner tone="danger" title="Response deadline passed">Parties were due to respond by {when}. Decide the dispute or request more evidence to set a new deadline.</Banner>;
  if (dl.state === "DUE_SOON") return <Banner tone="warning" title="Response due within 24 hours">Respond-by {when}.</Banner>;
  return <Banner tone="info" title="Awaiting parties">Respond-by {when}.</Banner>;
}

/** Handbook §11 L454: type, claim, evidence, deadline, communication, decision, appeal. */
export default function DisputeCase({ d, reload, twoFactor, canMutate }: {
  d: DisputeDetail;
  reload: () => Promise<void>;
  twoFactor: { run: (a: (code?: string) => Promise<void>) => Promise<void> };
  /** disputes.mutate: message parties, request evidence, decide appeals. */
  canMutate: boolean;
}) {
  const confirm = useConfirm();
  const [msg, setMsg] = useState("");
  const [internal, setInternal] = useState(false);
  const [msgError, setMsgError] = useState("");
  const [posting, setPosting] = useState(false);
  const isOpen = d.status === "OPEN";

  const post = async () => {
    setMsgError("");
    if (msg.trim().length < 5) { setMsgError("Write at least 5 characters."); return; }
    setPosting(true);
    try { await disputesAPI2.postMessage(d.id, msg.trim(), internal); setMsg(""); await reload(); }
    catch (e) { setMsgError(e instanceof Error ? e.message : "Could not post"); }
    finally { setPosting(false); }
  };

  const requestEvidence = (from: "BUYER" | "VENDOR") => confirm.ask(
    {
      title: `Request evidence from the ${from.toLowerCase()}`,
      description: "They are notified and the response deadline is reset to 3 days from now.",
      confirmLabel: "Send request", tone: "primary", reasonLabel: "What do you need? (shown to them and audited)",
    },
    async (reason) => { await disputesAPI2.requestEvidence(d.id, from, reason); await reload(); },
  );

  const decideAppeal = (decision: "UPHELD" | "OVERTURNED") => confirm.ask(
    {
      title: decision === "UPHELD" ? "Uphold the original decision" : "Overturn the original decision",
      description: decision === "OVERTURNED"
        ? "This records the new outcome. Any money correction (refund or release) must be made separately and is not automatic. Requires 2FA."
        : "The original decision stands. Both parties are notified. Requires 2FA.",
      confirmLabel: decision === "UPHELD" ? "Uphold" : "Overturn", minReasonLength: 10,
    },
    async (reason) => { await twoFactor.run(async (code) => { await disputesAPI2.decideAppeal(d.id, decision, reason, code); }); await reload(); },
  );

  return (
    <div className="space-y-6">
      {deadlineBanner(d)}
      <Card>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h3 className="text-lg font-black text-[#101820]">Claim</h3>
          <Badge tone="amber">{TYPE_LABEL[d.type ?? "OTHER"] ?? d.type}</Badge>
        </div>
        <p className="text-sm text-slate-800"><span className="font-bold">Reason:</span> {d.reason}</p>
        <p className="mt-2 text-sm text-slate-800"><span className="font-bold">Claim:</span> {d.claim || "Not provided"}</p>
        {d.evidenceRequestedAt ? <p className="mt-2 text-xs font-semibold text-slate-500">Evidence requested from the {d.evidenceRequestedFrom?.toLowerCase()} on {formatDateTime(d.evidenceRequestedAt)}.</p> : null}
        {isOpen && canMutate ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => requestEvidence("BUYER")}>Request evidence from buyer</Button>
            <Button variant="secondary" onClick={() => requestEvidence("VENDOR")}>Request evidence from vendor</Button>
          </div>
        ) : null}
      </Card>

      <Card>
        <h3 className="mb-3 text-lg font-black text-[#101820]">Evidence ({d.evidence?.length ?? 0})</h3>
        {!d.evidence || d.evidence.length === 0 ? <p className="text-sm text-slate-500">No evidence has been submitted yet.</p> : (
          <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {d.evidence.map((e) => (
              <li key={e.id} className="rounded-2xl border border-slate-200 p-3 text-sm">
                <div className="mb-2 flex items-center justify-between">
                  <Badge tone={e.submitterRole === "BUYER" ? "blue" : "green"}>{e.submitterRole.toLowerCase()}</Badge>
                  <span className="text-xs text-slate-500">{formatDateTime(e.createdAt)}</span>
                </div>
                {e.kind === "PHOTO" && e.url ? (
                  // Signed URL, expires in 5 minutes: reload the page to refresh.
                  // eslint-disable-next-line @next/next/no-img-element
                  <a href={e.url} target="_blank" rel="noreferrer"><img src={e.url} alt={e.note || "Evidence photo"} className="h-40 w-full rounded-xl object-cover" /></a>
                ) : null}
                {e.kind === "DOCUMENT" && e.url ? <a className="font-bold text-[#096B4A] underline" href={e.url} target="_blank" rel="noreferrer">Open document</a> : null}
                {e.kind === "TEXT" ? <p className="whitespace-pre-wrap text-slate-800">{e.text}</p> : null}
                {e.note ? <p className="mt-2 text-xs text-slate-500">{e.note}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <h3 className="mb-3 text-lg font-black text-[#101820]">Messages and notes</h3>
          <div className="mb-4 max-h-96 space-y-2 overflow-y-auto">
            {(d.messages ?? []).length === 0 ? <p className="text-sm text-slate-500">No messages yet.</p> : null}
            {(d.messages ?? []).map((m) => (
              <div key={m.id} className={`rounded-2xl border p-3 text-sm ${m.internal ? "border-amber-300 bg-amber-50" : ROLE_TONE[m.authorRole] ?? ""}`}>
                <div className="mb-1 flex items-center justify-between text-xs font-bold text-slate-500">
                  <span>{m.internal ? "Internal note (not visible to buyer or vendor)" : m.authorRole.toLowerCase()}</span>
                  <span>{formatDateTime(m.createdAt)}</span>
                </div>
                <p className="whitespace-pre-wrap text-slate-800">{m.body}</p>
              </div>
            ))}
          </div>
          {canMutate ? <><label className="block">
            <span className="text-xs font-black uppercase tracking-wide text-slate-500">New message</span>
            <textarea value={msg} onChange={(e) => setMsg(e.target.value)} rows={3}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#096B4A]" />
          </label>
          <label className="mt-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
            <input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} className="h-4 w-4 accent-[#096B4A]" />
            Internal note only (the buyer and vendor will not see it or be notified)
          </label>
          {msgError ? <p className="mt-2 text-sm font-bold text-red-600">{msgError}</p> : null}
          <div className="mt-3"><Button disabled={posting} onClick={() => void post()}>{internal ? "Save internal note" : "Send to both parties"}</Button></div></> : null}
        </Card>

        <Card>
          <h3 className="mb-3 text-lg font-black text-[#101820]">Timeline</h3>
          <ol className="space-y-3 border-l-2 border-slate-100 pl-4">
            {(d.timeline ?? []).map((t, i) => (
              <li key={i} className="relative text-sm">
                <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-slate-400" />
                <p className="font-bold text-slate-900">{t.text}{t.actorRole ? <span className="font-semibold text-slate-500"> · {t.actorRole.toLowerCase()}</span> : null}</p>
                <p className="text-xs text-slate-500">{formatDateTime(t.at)}</p>
              </li>
            ))}
          </ol>
        </Card>
      </div>

      {!isOpen ? (
        <Card>
          <h3 className="mb-2 text-lg font-black text-[#101820]">Decision and appeal</h3>
          <p className="text-sm text-slate-800"><span className="font-bold">Decision reason:</span> {d.decisionReason || d.resolution || "Not provided"}</p>
          <p className="mt-2 text-sm text-slate-800"><span className="font-bold">Appeal:</span> {(d.appealStatus ?? "NONE").toLowerCase()}
            {d.appeal?.canAppeal && d.appeal.appealWindowEndsAt ? ` (parties can appeal until ${formatDateTime(d.appeal.appealWindowEndsAt)})` : ""}</p>
          {d.appealReason ? <p className="mt-2 text-sm text-slate-800"><span className="font-bold">Appeal reason:</span> {d.appealReason}</p> : null}
          {d.appealDecisionReason ? <p className="mt-2 text-sm text-slate-800"><span className="font-bold">Appeal decision reason:</span> {d.appealDecisionReason}</p> : null}
          {d.appealStatus === "REQUESTED" && canMutate ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => decideAppeal("UPHELD")}>Uphold decision</Button>
              <Button variant="danger" onClick={() => decideAppeal("OVERTURNED")}>Overturn decision</Button>
            </div>
          ) : null}
        </Card>
      ) : null}
      {confirm.dialog}
    </div>
  );
}
