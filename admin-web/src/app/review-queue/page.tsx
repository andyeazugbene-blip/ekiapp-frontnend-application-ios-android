"use client";

import { useCallback, useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Badge, Button, Card, ErrorPanel, LoadingPanel, PageHeader } from "@/components/AdminUI";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Banner, formatDateTime, formatMinor } from "@/components/AdminKit";
import { APIError } from "@/lib/api";
import { usePermissions } from "@/lib/hooks/usePermissions";
import {
  reviewQueueAPI,
  type DemandRow,
  type ReviewRequestDetail,
  type ReviewRequestRow,
  type ReviewRequestStatus,
  type ReviewRequestType,
} from "@/lib/services/reviewQueue.api";

const TYPE_LABEL: Record<ReviewRequestType, string> = {
  SUPPLIER_ELIGIBILITY: "Supplier eligibility",
  SUPPLIER_OFFER: "Supplier offer",
  COMMUNITY_BUY_CAMPAIGN: "Community Buy",
  EXTENSION: "Extension",
};

const STATUS_LABEL: Record<ReviewRequestStatus, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under review",
  INFO_REQUIRED: "Information required",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  WITHDRAWN: "Withdrawn",
  SUSPENDED: "Suspended",
};

const STATUS_TONE: Record<ReviewRequestStatus, "green" | "amber" | "red" | "blue" | "gray"> = {
  DRAFT: "gray",
  SUBMITTED: "blue",
  UNDER_REVIEW: "blue",
  INFO_REQUIRED: "amber",
  APPROVED: "green",
  REJECTED: "red",
  WITHDRAWN: "gray",
  SUSPENDED: "red",
};

const fieldClass = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800";

function dueLabel(row: ReviewRequestRow): string {
  const hours = Math.round((new Date(row.slaDueAt).getTime() - Date.now()) / 3_600_000);
  if (row.overdue) return `Overdue by ${Math.max(1, -hours)}h`;
  return `Due in ${Math.max(1, hours)}h`;
}

const METHOD_LABEL: Record<string, string> = { DELIVERY: "Delivery", COLLECTION: "Collection" };

/** What a reviewer needs, in the order they need it. Internal ids and flags stay out. */
const FACTS: { key: string; label: string; format?: (value: unknown, subject: Record<string, unknown>) => string }[] = [
  { key: "foodstuffName", label: "Foodstuff" },
  { key: "title", label: "Name" },
  { key: "businessName", label: "Business" },
  { key: "description", label: "Description" },
  { key: "packSize", label: "Pack size" },
  { key: "unit", label: "Pack size" },
  { key: "pricePerShareMinor", label: "Price per share", format: (value, subject) => formatMinor(Number(value), String(subject.currency ?? "GBP")) },
  { key: "minimumShares", label: "Minimum shares" },
  { key: "goalShares", label: "Goal shares" },
  { key: "maximumShares", label: "Maximum shares" },
  { key: "deadline", label: "Deadline", format: (value) => formatDateTime(String(value)) },
  { key: "windowStartsAt", label: "Offer opens", format: (value) => formatDateTime(String(value)) },
  { key: "windowEndsAt", label: "Offer ends", format: (value) => formatDateTime(String(value)) },
  { key: "fulfilmentMethods", label: "Delivery or collection", format: (value) => (value as string[]).map((m) => METHOD_LABEL[m] ?? m).join(", ") },
  { key: "deliveryPreference", label: "Delivery or collection", format: (value) => METHOD_LABEL[String(value)] ?? String(value) },
  { key: "deliveryAreas", label: "Delivery areas", format: (value) => (value as string[]).join(", ") },
  { key: "deliveryCoverageAreas", label: "Delivery areas", format: (value) => (value as string[]).join(", ") },
  { key: "collectionCity", label: "Collection city" },
  { key: "collectionPostcode", label: "Collection postcode" },
  { key: "leadTimeDays", label: "Lead time", format: (value) => `${value} days` },
  { key: "categories", label: "Categories", format: (value) => (value as string[]).join(", ") },
  { key: "coverageRegions", label: "Areas served", format: (value) => (value as string[]).join(", ") },
  { key: "storageNotes", label: "Storage notes" },
];

function SubjectFacts({ subject }: { subject: Record<string, unknown> | null }) {
  if (!subject) return <p className="text-sm font-semibold text-slate-500">This record no longer exists.</p>;
  const facts = FACTS.filter(({ key }) => {
    const value = subject[key];
    return value !== null && value !== undefined && value !== "" && !(Array.isArray(value) && value.length === 0);
  });
  return (
    <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
      {facts.map(({ key, label, format }) => (
        <div key={key}>
          <dt className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</dt>
          <dd className="text-sm font-semibold text-slate-800">{format ? format(subject[key], subject) : String(subject[key])}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function ReviewQueuePage() {
  const { has, loading: permLoading } = usePermissions();
  const canRead = has("community_buy.read");
  const canMutate = has("community_buy.mutate");

  const [rows, setRows] = useState<ReviewRequestRow[]>([]);
  const [demand, setDemand] = useState<DemandRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [type, setType] = useState("");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [status, setStatus] = useState("");

  const [detail, setDetail] = useState<ReviewRequestDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [infoMessage, setInfoMessage] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [rejectDetail, setRejectDetail] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const [items, demandRows] = await Promise.all([
        reviewQueueAPI.list({ type: type || undefined, status: status || undefined, overdue: overdueOnly }),
        reviewQueueAPI.demand().catch(() => [] as DemandRow[]),
      ]);
      setRows(items);
      setDemand(demandRows);
    } catch (e) {
      setError(e instanceof APIError ? e.message : "Could not load the queue");
    } finally {
      setLoading(false);
    }
  }, [type, status, overdueOnly]);

  useEffect(() => {
    if (!permLoading && canRead) void load();
  }, [load, permLoading, canRead]);

  const open = async (id: string) => {
    setActionError("");
    setInfoMessage("");
    setRejectReason("");
    setRejectDetail("");
    try {
      setDetail(await reviewQueueAPI.get(id));
    } catch (e) {
      setError(e instanceof APIError ? e.message : "Could not open this request");
    }
  };

  const decide = async (action: () => Promise<void>, done: string) => {
    setBusy(true);
    setActionError("");
    try {
      await action();
      setDetail(null);
      setNotice(done);
      await load();
    } catch (e) {
      setActionError(e instanceof APIError ? e.message : "That didn't work. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const undecided = detail ? ["SUBMITTED", "UNDER_REVIEW", "INFO_REQUIRED"].includes(detail.request.status) : false;

  return (
    <ProtectedRoute>
      <AdminLayout>
        <div className="space-y-5">
          <PageHeader title="Approvals" subtitle="Supplier eligibility, supplier offers, Community Buys and extensions, oldest and overdue first." />

          {notice ? <Banner tone="success" title={notice} /> : null}

          <Card>
            <div className="flex flex-wrap items-end gap-3">
              <label className="text-xs font-bold text-slate-500">
                Request type
                <select className={`${fieldClass} mt-1`} value={type} onChange={(e) => setType(e.target.value)}>
                  <option value="">All types</option>
                  {Object.entries(TYPE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label className="text-xs font-bold text-slate-500">
                Status
                <select className={`${fieldClass} mt-1`} value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="">Open</option>
                  {(["APPROVED", "REJECTED", "WITHDRAWN"] as ReviewRequestStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                </select>
              </label>
              <label className="flex items-center gap-2 pb-2 text-sm font-semibold text-slate-700">
                <input type="checkbox" checked={overdueOnly} onChange={(e) => setOverdueOnly(e.target.checked)} />
                Overdue only
              </label>
            </div>
          </Card>

          {permLoading || loading ? <LoadingPanel label="Loading approvals…" /> : null}
          {error ? <ErrorPanel message={error} onRetry={() => void load()} /> : null}
          {!permLoading && !canRead ? <ErrorPanel message="You don't have access to approvals." /> : null}

          {!loading && !error && canRead ? (
            rows.length === 0 ? (
              <Card><p className="text-sm font-semibold text-slate-500">Nothing is waiting here.</p></Card>
            ) : (
              <div className="space-y-2">
                {rows.map((row) => (
                  <Card key={row.id}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-black text-slate-900">{row.subjectLabel}</p>
                        <p className="text-xs font-semibold text-slate-500">{TYPE_LABEL[row.type]} · {row.market} · Submitted {formatDateTime(row.submittedAt)}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={STATUS_TONE[row.status]}>{STATUS_LABEL[row.status]}</Badge>
                        {row.autoApproved ? <Badge tone="gray">Auto-approved</Badge> : null}
                        {["SUBMITTED", "UNDER_REVIEW", "INFO_REQUIRED"].includes(row.status) ? <Badge tone={row.overdue ? "red" : "gray"}>{dueLabel(row)}</Badge> : null}
                        <Button variant="ghost" className="h-9 px-3" onClick={() => void open(row.id)}>View</Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )
          ) : null}

          {demand.length > 0 ? (
            <Card>
              <h3 className="mb-2 text-lg font-black text-[#101820]">Foodstuff requests</h3>
              <p className="mb-3 text-xs font-semibold text-slate-500">What buyers asked for when no bulk offer was available.</p>
              <ul className="divide-y divide-slate-100">
                {demand.map((d) => (
                  <li key={d.foodstuff} className="flex items-center justify-between py-2 text-sm font-semibold text-slate-800">
                    <span>{d.foodstuff}</span>
                    <Badge tone="blue">{d.requests}</Badge>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {detail ? (
            <div className="fixed inset-0 z-50 flex justify-end bg-black/30" role="dialog" aria-modal="true" aria-label="Request details">
              <div className="h-full w-full max-w-2xl space-y-4 overflow-y-auto bg-slate-50 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-black text-[#101820]">{TYPE_LABEL[detail.request.type]}</h2>
                    <p className="text-xs font-semibold text-slate-500">Submitted {formatDateTime(detail.request.submittedAt)}</p>
                  </div>
                  <Button variant="ghost" onClick={() => setDetail(null)}>Close</Button>
                </div>

                {actionError ? <Banner tone="danger" title={actionError} /> : null}

                <Card>
                  <h3 className="mb-3 text-sm font-black uppercase tracking-wide text-slate-500">As the user will see it</h3>
                  <SubjectFacts subject={detail.subject} />
                </Card>

                <Card>
                  <h3 className="mb-3 text-sm font-black uppercase tracking-wide text-slate-500">Submitted by</h3>
                  <p className="font-black text-slate-900">{detail.submitter?.name ?? "Not provided"}</p>
                  <p className="text-sm font-semibold text-slate-600">{detail.submitter?.email}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge tone={detail.submitter?.emailVerifiedAt ? "green" : "amber"}>{detail.submitter?.emailVerifiedAt ? "Email verified" : "Email not verified"}</Badge>
                    <Badge tone={detail.submitter?.phoneVerifiedAt ? "green" : "amber"}>{detail.submitter?.phoneVerifiedAt ? "Phone verified" : "Phone not verified"}</Badge>
                    {detail.submitter?.capabilityGrants.map((g) => <Badge key={`${g.capability}${g.market}`} tone={g.status === "ACTIVE" ? "green" : "gray"}>{g.capability} {g.market}: {g.status}</Badge>)}
                  </div>
                </Card>

                {detail.previousDecisions.length > 0 ? (
                  <Card>
                    <h3 className="mb-3 text-sm font-black uppercase tracking-wide text-slate-500">Previous decisions</h3>
                    <ul className="space-y-1">
                      {detail.previousDecisions.map((d) => (
                        <li key={d.id} className="text-sm font-semibold text-slate-700">
                          {STATUS_LABEL[d.status]}{d.autoApproved ? " (auto)" : ""}{d.decidedAt ? ` · ${formatDateTime(d.decidedAt)}` : ""}{d.decisionReason ? ` · ${d.decisionReason}` : ""}
                        </li>
                      ))}
                    </ul>
                  </Card>
                ) : null}

                <Card>
                  <h3 className="mb-3 text-sm font-black uppercase tracking-wide text-slate-500">Audit trail</h3>
                  {detail.auditTrail.length === 0 ? (
                    <p className="text-sm font-semibold text-slate-500">No decisions yet.</p>
                  ) : (
                    <ul className="space-y-1">
                      {detail.auditTrail.map((a) => (
                        <li key={`${a.action}${a.createdAt}`} className="text-sm font-semibold text-slate-700">
                          {a.action.replace("review_request.", "").replace(/_/g, " ")} · {formatDateTime(a.createdAt)}{a.reason ? ` · ${a.reason}` : ""}
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>

                {undecided && canMutate ? (
                  <Card>
                    <h3 className="mb-3 text-sm font-black uppercase tracking-wide text-slate-500">Decision</h3>
                    <div className="space-y-4">
                      <Button disabled={busy} onClick={() => void decide(() => reviewQueueAPI.approve(detail.request.id), "Approved")}>Approve</Button>

                      <div className="space-y-2 border-t border-slate-100 pt-4">
                        <label className="block text-xs font-bold text-slate-500" htmlFor="info-message">Request information</label>
                        <textarea id="info-message" className={fieldClass} rows={2} value={infoMessage} onChange={(e) => setInfoMessage(e.target.value)} placeholder="What do you need from them?" />
                        <Button variant="ghost" disabled={busy || !infoMessage.trim()} onClick={() => void decide(() => reviewQueueAPI.requestInformation(detail.request.id, infoMessage), "Information requested")}>Send request</Button>
                      </div>

                      <div className="space-y-2 border-t border-slate-100 pt-4">
                        <label className="block text-xs font-bold text-slate-500" htmlFor="reject-reason">Reject</label>
                        <select id="reject-reason" className={fieldClass} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)}>
                          <option value="">Choose a reason</option>
                          {detail.rejectionReasons.map((r) => <option key={r} value={r}>{r}</option>)}
                        </select>
                        <textarea className={fieldClass} rows={2} value={rejectDetail} onChange={(e) => setRejectDetail(e.target.value)} placeholder="What should they change? They'll see this." aria-label="Rejection details" />
                        <Button variant="danger" disabled={busy || !rejectReason} onClick={() => void decide(() => reviewQueueAPI.reject(detail.request.id, rejectReason, rejectDetail), "Rejected")}>Reject</Button>
                      </div>
                    </div>
                  </Card>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </AdminLayout>
    </ProtectedRoute>
  );
}
