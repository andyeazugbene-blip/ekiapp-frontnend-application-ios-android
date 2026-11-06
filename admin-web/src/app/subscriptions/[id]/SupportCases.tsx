"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, ErrorPanel } from "@/components/AdminUI";
import { formatDateTime } from "@/components/AdminKit";
import { APIError } from "@/lib/api";
import { SUPPORT_CASE_TYPES, subscriptionsAdminAPI, type SubscriptionSupportCase } from "@/lib/services/regularDeliveries.api";

const fieldClass = "mt-1 w-full rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-[#096B4A]";

const links = (raw: string) => raw.split(/\s+/).map((u) => u.trim()).filter(Boolean);

/** S63: Regular Delivery support case. Buyer and vendor come from the subscription this sits on. */
export default function SupportCases({ subscriptionId, buyerName, vendorName, renewalId, canEdit, onClearRenewal }: {
  subscriptionId: string;
  buyerName: string;
  vendorName: string;
  renewalId: string | null;
  canEdit: boolean;
  onClearRenewal: () => void;
}) {
  const [cases, setCases] = useState<SubscriptionSupportCase[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [caseType, setCaseType] = useState<string>(SUPPORT_CASE_TYPES[0][0]);
  const [description, setDescription] = useState("");
  const [evidence, setEvidence] = useState("");
  const [notes, setNotes] = useState("");
  const [response, setResponse] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      setError("");
      setCases(await subscriptionsAdminAPI.listSupportCases(subscriptionId));
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Failed to load support cases");
    }
  }, [subscriptionId]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (action: () => Promise<void>) => {
    try {
      setBusy(true);
      setError("");
      await action();
      await load();
    } catch (err) {
      setError(err instanceof APIError ? err.message : "That didn't work. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <h2 className="mb-3 text-xl font-black">Foodstuff Subscription support cases</h2>
      {error ? <ErrorPanel message={error} onRetry={() => void load()} /> : null}
      <div className="space-y-3">
        {cases.length === 0 ? <p className="text-sm text-slate-500">No support cases yet.</p> : null}
        {cases.map((c) => (
          <div key={c.id} className="rounded-xl border border-slate-200 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-bold">{SUPPORT_CASE_TYPES.find(([key]) => key === c.caseType)?.[1] ?? c.caseType}</p>
              <Badge tone={c.status === "RESOLVED" || c.status === "CLOSED" ? "green" : c.escalated ? "red" : "amber"}>{c.status.replace(/_/g, " ").toLowerCase()}</Badge>
            </div>
            <p className="mt-1 text-sm text-slate-600">{c.description}</p>
            {c.renewalId ? <p className="mt-1 font-mono text-xs text-slate-500">Renewal {c.renewalId}</p> : null}
            {c.evidenceUrls.map((url) => <a key={url} className="mt-1 block truncate text-sm font-bold text-[#096B4A]" href={url} target="_blank" rel="noreferrer">{url}</a>)}
            {c.internalNotes ? <p className="mt-2 text-sm text-slate-500">Internal notes: {c.internalNotes}</p> : null}
            {c.customerVisibleResponse ? <p className="mt-2 text-sm">Customer-visible response: {c.customerVisibleResponse}</p> : null}
            <p className="mt-2 text-xs text-slate-400">Opened {formatDateTime(c.createdAt)}</p>
            {canEdit && c.status !== "CLOSED" ? (
              <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                <label className="block text-xs font-bold text-slate-500">
                  Customer-visible response
                  <textarea className={fieldClass} rows={2} value={response[c.id] ?? c.customerVisibleResponse ?? ""} onChange={(e) => setResponse((p) => ({ ...p, [c.id]: e.target.value }))} />
                </label>
                <div className="flex flex-wrap gap-2">
                  <Button disabled={busy} onClick={() => void run(() => subscriptionsAdminAPI.updateSupportCase(c.id, { customerVisibleResponse: response[c.id] ?? c.customerVisibleResponse ?? "" }))}>Save case</Button>
                  {!c.escalated ? <Button variant="secondary" disabled={busy} onClick={() => void run(() => subscriptionsAdminAPI.updateSupportCase(c.id, { escalate: true }))}>Escalate</Button> : null}
                  <Button variant="ghost" disabled={busy} onClick={() => void run(() => subscriptionsAdminAPI.updateSupportCase(c.id, { status: "RESOLVED" }))}>Mark resolved</Button>
                </div>
              </div>
            ) : null}
          </div>
        ))}
      </div>

      {canEdit ? (
        <div className="mt-5 space-y-3 border-t border-slate-100 pt-5">
          <h3 className="font-black">Open a support case</h3>
          <p className="text-sm text-slate-500">Buyer: {buyerName}. Vendor: {vendorName}.</p>
          {renewalId ? (
            <p className="text-sm text-slate-500">
              Renewal: <span className="font-mono">{renewalId}</span>{" "}
              <button className="font-bold text-[#096B4A]" onClick={onClearRenewal}>Remove</button>
            </p>
          ) : null}
          <label className="block text-xs font-bold text-slate-500">
            Case type
            <select className={fieldClass} value={caseType} onChange={(e) => setCaseType(e.target.value)}>
              {SUPPORT_CASE_TYPES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </label>
          <label className="block text-xs font-bold text-slate-500">
            What happened
            <textarea className={fieldClass} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
          <label className="block text-xs font-bold text-slate-500">
            Evidence (https links, separated by spaces)
            <input className={fieldClass} value={evidence} onChange={(e) => setEvidence(e.target.value)} />
          </label>
          <label className="block text-xs font-bold text-slate-500">
            Internal notes
            <textarea className={fieldClass} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
          <Button
            disabled={busy || !description.trim()}
            onClick={() => void run(async () => {
              await subscriptionsAdminAPI.createSupportCase(subscriptionId, {
                caseType,
                description,
                renewalId: renewalId ?? undefined,
                internalNotes: notes || undefined,
                evidenceUrls: links(evidence),
              });
              setDescription("");
              setEvidence("");
              setNotes("");
              onClearRenewal();
            })}
          >
            Save case
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
