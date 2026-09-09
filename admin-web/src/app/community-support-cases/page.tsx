"use client";

import { useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Badge, Button, Card, ErrorPanel, Icon, LoadingPanel, PageHeader, TextLink } from "@/components/AdminUI";
import ProtectedRoute from "@/components/ProtectedRoute";
import { APIError } from "@/lib/api";
import {
  communityBuyAdminAPI,
  type AdminSupportCase,
  type SupportCaseStatus,
} from "@/lib/services/communityBuy.api";

const STATUS_TONE: Record<SupportCaseStatus, "green" | "amber" | "red" | "blue" | "gray"> = {
  OPEN: "amber",
  IN_PROGRESS: "blue",
  ESCALATED: "red",
  RESOLVED: "green",
  CLOSED: "gray",
};

const STATUS_LABEL: Record<SupportCaseStatus, string> = {
  OPEN: "Open", IN_PROGRESS: "In progress", ESCALATED: "Escalated", RESOLVED: "Resolved", CLOSED: "Closed",
};

const CASE_TYPE_LABEL: Record<string, string> = {
  PAYMENT_ISSUE: "Payment issue",
  REFUND_ISSUE: "Refund issue",
  FULFILMENT_ISSUE: "Fulfilment issue",
  ORGANISER_CONDUCT: "Organiser conduct",
  SUPPLIER_CONDUCT: "Supplier conduct",
  OTHER: "Other",
};

const STATUS_OPTIONS: SupportCaseStatus[] = ["OPEN", "IN_PROGRESS", "ESCALATED", "RESOLVED", "CLOSED"];

export default function CommunitySupportCasesPage() {
  const [cases, setCases] = useState<AdminSupportCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<SupportCaseStatus | "ALL">("ALL");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [draftNotes, setDraftNotes] = useState<Record<string, string>>({});
  const [draftResponse, setDraftResponse] = useState<Record<string, string>>({});

  const load = async (bypassCache = false) => {
    try {
      bypassCache ? setRefreshing(true) : setLoading(true);
      setError("");
      setCases(await communityBuyAdminAPI.getSupportCases(filter === "ALL" ? undefined : filter, bypassCache ? { bypassCache: true } : undefined));
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Could not load support cases.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const applyUpdate = async (id: string, data: Parameters<typeof communityBuyAdminAPI.updateSupportCase>[1]) => {
    setBusyId(id);
    try {
      const updated = await communityBuyAdminAPI.updateSupportCase(id, data);
      setCases((prev) => prev.map((c) => (c.id === id ? updated : c)));
    } catch (err) {
      alert(err instanceof APIError ? err.message : "Could not update this case.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <ProtectedRoute>
      <AdminLayout>
        <div className="space-y-6">
          <PageHeader
            title="Community Buy Support Cases"
            subtitle="Reports from organisers, suppliers, and participants about a specific campaign. Internal notes stay admin-only; the customer response is what the reporter sees."
            actions={<Button variant="ghost" disabled={refreshing} onClick={() => void load(true)}><Icon name="refresh" className="h-4 w-4" />{refreshing ? "Refreshing..." : "Refresh"}</Button>}
          />

          <div className="flex flex-wrap gap-2">
            {(["ALL", ...STATUS_OPTIONS] as const).map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${filter === s ? "bg-[#096B4A] text-white" : "bg-slate-100 text-slate-600"}`}
              >
                {s === "ALL" ? "All" : STATUS_LABEL[s]}
              </button>
            ))}
          </div>

          {error ? <ErrorPanel message={error} onRetry={() => void load()} /> : null}

          {loading ? (
            <LoadingPanel label="Loading support cases..." />
          ) : cases.length === 0 ? (
            <Card className="py-12 text-center">
              <p className="text-base font-semibold text-slate-700">No support cases{filter !== "ALL" ? ` with status ${filter}` : ""}.</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {cases.map((c) => {
                const expanded = expandedId === c.id;
                return (
                  <Card key={c.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-base font-bold text-[#101820]">{c.campaign?.title ?? "Campaign"}</p>
                          {c.escalated ? <Badge tone="red">Escalated</Badge> : null}
                        </div>
                        <p className="mt-1 text-sm text-slate-600">
                          {CASE_TYPE_LABEL[c.caseType] ?? c.caseType} · {c.participant?.name ?? "Unknown"} ({c.participant?.email ?? "—"}) · {new Date(c.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge tone={STATUS_TONE[c.status]}>{STATUS_LABEL[c.status]}</Badge>
                        <Button variant="ghost" onClick={() => setExpandedId(expanded ? null : c.id)}>{expanded ? "Hide" : "Manage"}</Button>
                      </div>
                    </div>

                    {expanded ? (
                      <div className="mt-4 space-y-4 border-t border-slate-100 pt-4">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Reporter&apos;s description</p>
                          <p className="mt-1 text-sm text-slate-700">{c.description}</p>
                        </div>

                        {c.evidenceUrls.length > 0 ? (
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Evidence attached by the reporter</p>
                            <div className="mt-1 flex flex-wrap gap-3">
                              {c.evidenceUrls.map((url, i) => (
                                <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-[#096B4A] hover:underline">
                                  Attachment {i + 1}
                                </a>
                              ))}
                            </div>
                          </div>
                        ) : null}

                        <p className="text-xs text-slate-400">
                          Last updated {new Date(c.updatedAt).toLocaleString()} · <TextLink href={`/activity-logs?entityId=${c.id}`}>Audit history</TextLink>
                        </p>

                        <div className="grid gap-4 md:grid-cols-2">
                          <div>
                            <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Internal notes (never shown to the reporter)</label>
                            <textarea
                              className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm"
                              rows={4}
                              defaultValue={c.internalNotes ?? ""}
                              onChange={(e) => setDraftNotes((prev) => ({ ...prev, [c.id]: e.target.value }))}
                            />
                            <Button
                              variant="secondary"
                              className="mt-2"
                              disabled={busyId === c.id}
                              onClick={() => {
                                if (confirm("Save this internal note? It is never shown to the reporter.")) void applyUpdate(c.id, { internalNotes: draftNotes[c.id] ?? c.internalNotes ?? "" });
                              }}
                            >
                              Save note
                            </Button>
                          </div>
                          <div>
                            <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Response to the reporter</label>
                            <textarea
                              className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm"
                              rows={4}
                              defaultValue={c.customerVisibleResponse ?? ""}
                              onChange={(e) => setDraftResponse((prev) => ({ ...prev, [c.id]: e.target.value }))}
                            />
                            <Button
                              variant="secondary"
                              className="mt-2"
                              disabled={busyId === c.id}
                              onClick={() => {
                                if (confirm("Send this response to the reporter? It will be visible to them and cannot be unsent.")) void applyUpdate(c.id, { customerVisibleResponse: draftResponse[c.id] ?? c.customerVisibleResponse ?? "" });
                              }}
                            >
                              Send response
                            </Button>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                          <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Status</label>
                          <select
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
                            value={c.status}
                            disabled={busyId === c.id}
                            onChange={(e) => {
                              const next = e.target.value as SupportCaseStatus;
                              if (confirm(`Change this case's status to "${STATUS_LABEL[next]}"?`)) void applyUpdate(c.id, { status: next });
                            }}
                          >
                            {STATUS_OPTIONS.map((s) => (
                              <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                            ))}
                          </select>
                          <Button
                            variant={c.escalated ? "secondary" : "danger"}
                            disabled={busyId === c.id}
                            onClick={() => {
                              if (confirm(c.escalated ? "Un-escalate this case?" : "Escalate this case?")) void applyUpdate(c.id, { escalated: !c.escalated });
                            }}
                          >
                            {c.escalated ? "Un-escalate" : "Escalate"}
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </AdminLayout>
    </ProtectedRoute>
  );
}
