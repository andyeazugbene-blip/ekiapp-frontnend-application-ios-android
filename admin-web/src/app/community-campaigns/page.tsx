"use client";

import { useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Badge, Button, Card, ErrorPanel, Icon, LoadingPanel, MetricCard, PageHeader, TextLink } from "@/components/AdminUI";
import ProtectedRoute from "@/components/ProtectedRoute";
import { APIError } from "@/lib/api";
import {
  communityBuyAdminAPI, isPendingApproval,
  type AdminCampaign, type AdminContribution, type AdminExtensionRequest, type AdminSupplierPayment,
  type CampaignStatus, type FundingOutcome, type SupplierPaymentStatus,
} from "@/lib/services/communityBuy.api";
import { countryDisplayName } from "@/lib/countries";

function centsToUnit(value: unknown): number {
  return typeof value === "number" ? value / 100 : 0;
}

const CLOSED_STATUS_TONE: Record<CampaignStatus, "green" | "amber" | "red" | "blue" | "gray"> = {
  DRAFT: "gray", UNDER_REVIEW: "amber", CHANGES_REQUIRED: "amber", APPROVED: "blue", REJECTED: "red",
  LIVE: "blue", PAUSED: "gray", RESCUE_WINDOW: "amber", SUCCEEDED: "green", FAILED: "amber",
  REFUNDING: "amber", FULFILLING: "blue", COMPLETED: "green", FINANCIALLY_CLOSED: "gray", CANCELLED: "red",
};

const CLOSED_STATUS_LABEL: Record<CampaignStatus, string> = {
  DRAFT: "Draft", UNDER_REVIEW: "Under review", CHANGES_REQUIRED: "Changes requested", APPROVED: "Approved",
  REJECTED: "Rejected", LIVE: "Live", PAUSED: "Paused", RESCUE_WINDOW: "Needs more participants",
  SUCCEEDED: "Succeeded", FAILED: "Did not reach minimum", REFUNDING: "Refunding", FULFILLING: "Proceeding",
  COMPLETED: "Completed", FINANCIALLY_CLOSED: "Financially closed", CANCELLED: "Ended",
};

const FUNDING_OUTCOME_LABEL: Record<FundingOutcome, string> = {
  PENDING: "Not yet decided", GOAL_REACHED: "Goal reached", MINIMUM_REACHED: "Minimum reached", BELOW_MINIMUM: "Below minimum",
};

const SUPPLIER_PAYMENT_STATUS_LABEL: Record<SupplierPaymentStatus, string> = {
  NOT_RELEASED: "Not released", PROCESSING: "Processing", PAID: "Paid", ON_HOLD: "On hold", FAILED: "Failed",
};

// Statuses money is guaranteed never to have moved yet under PLEDGE_THEN_CHARGE
// (charging happens only once a campaign succeeds) — the only statuses the
// admin cancel/end action is allowed to act on; matches the backend guard
// exactly so the button never appears where the API would just 409.
const CANCELLABLE_STATUSES: CampaignStatus[] = ["LIVE", "PAUSED", "RESCUE_WINDOW"];

export default function CommunityCampaignsPage() {
  const [items, setItems] = useState<AdminCampaign[]>([]);
  const [closed, setClosed] = useState<AdminCampaign[]>([]);
  const [extensionRequests, setExtensionRequests] = useState<AdminExtensionRequest[]>([]);
  const [supplierPayments, setSupplierPayments] = useState<AdminSupplierPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notesById, setNotesById] = useState<Record<string, string>>({});
  const [holdReasonById, setHoldReasonById] = useState<Record<string, string>>({});
  const [cancelReasonById, setCancelReasonById] = useState<Record<string, string>>({});
  const [contributionsById, setContributionsById] = useState<Record<string, AdminContribution[]>>({});
  const [expandedContributionsId, setExpandedContributionsId] = useState<string | null>(null);
  const [contributionsLoadingId, setContributionsLoadingId] = useState<string | null>(null);

  const load = async (bypassCache = false) => {
    try {
      bypassCache ? setRefreshing(true) : setLoading(true);
      setError("");
      const opts = bypassCache ? { bypassCache: true } : undefined;
      const [review, recentlyClosed, pendingExtensions, payments] = await Promise.all([
        communityBuyAdminAPI.getCampaignsForReview(opts),
        communityBuyAdminAPI.getRecentlyClosedCampaigns(opts),
        communityBuyAdminAPI.getExtensionRequests(opts),
        communityBuyAdminAPI.getSupplierPayments(opts),
      ]);
      setItems(review);
      setClosed(recentlyClosed);
      setExtensionRequests(pendingExtensions);
      setSupplierPayments(payments);
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Failed to load campaigns");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const toggleContributions = async (campaignId: string) => {
    if (expandedContributionsId === campaignId) {
      setExpandedContributionsId(null);
      return;
    }
    setExpandedContributionsId(campaignId);
    if (contributionsById[campaignId]) return;
    setContributionsLoadingId(campaignId);
    try {
      const items = await communityBuyAdminAPI.getCampaignContributions(campaignId);
      setContributionsById((prev) => ({ ...prev, [campaignId]: items }));
    } catch (err) {
      alert(err instanceof APIError ? err.message : "Failed to load contributions");
    } finally {
      setContributionsLoadingId(null);
    }
  };

  const runAction = async (id: string, action: () => Promise<AdminCampaign>) => {
    setBusyId(id);
    try {
      await action();
      await load();
    } catch (err) {
      alert(err instanceof APIError ? err.message : "Action failed");
    } finally {
      setBusyId(null);
    }
  };

  const runExtensionAction = async (id: string, action: () => Promise<AdminExtensionRequest>) => {
    setBusyId(id);
    try {
      await action();
      await load();
    } catch (err) {
      alert(err instanceof APIError ? err.message : "Action failed");
    } finally {
      setBusyId(null);
    }
  };

  const runPaymentAction = async (id: string, action: () => Promise<AdminSupplierPayment>) => {
    setBusyId(id);
    try {
      await action();
      await load();
    } catch (err) {
      alert(err instanceof APIError ? err.message : "Action failed");
    } finally {
      setBusyId(null);
    }
  };

  // Release is handled separately from runPaymentAction because a
  // four-eyes AdminApprovalRule can turn this into a 202 "pending a second
  // admin's approval" response instead of an actual release — that must be
  // shown as its own outcome, never mistaken for a completed release.
  const runReleaseAction = async (id: string, campaignId: string) => {
    setBusyId(id);
    try {
      const result = await communityBuyAdminAPI.releaseSupplierPayment(campaignId);
      if (isPendingApproval(result)) {
        alert(result.message);
      } else {
        alert("Payment released.");
      }
      await load();
    } catch (err) {
      alert(err instanceof APIError ? err.message : "Action failed");
    } finally {
      setBusyId(null);
    }
  };

  const runCancelAction = async (campaignId: string, reason: string) => {
    setBusyId(campaignId);
    try {
      await communityBuyAdminAPI.cancelCampaign(campaignId, reason);
      await load();
    } catch (err) {
      alert(err instanceof APIError ? err.message : "Action failed");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <ProtectedRoute>
      <AdminLayout>
        {loading ? <LoadingPanel label="Loading campaigns..." /> : (
          <div className="space-y-8">
            <PageHeader
              title="Community Buy review"
              subtitle="Campaigns submitted by organisers, waiting for approval before they go live."
              actions={<Button variant="ghost" disabled={refreshing} onClick={() => void load(true)}><Icon name="refresh" className="h-4 w-4" />{refreshing ? "Refreshing..." : "Refresh"}</Button>}
            />
            {error ? <ErrorPanel message={error} onRetry={() => void load()} /> : null}

            <div className="grid gap-6 md:grid-cols-4">
              <MetricCard icon="clock" label="Under review" value={items.length} tone="amber" />
              <MetricCard icon="warning" label="In rescue window" value={closed.filter((c) => c.status === "RESCUE_WINDOW").length} tone="amber" />
              <MetricCard icon="clock" label="Extension requests" value={extensionRequests.length} tone="amber" />
              <MetricCard icon="warning" label="Payments to release" value={supplierPayments.filter((p) => p.status === "NOT_RELEASED").length} tone="amber" />
            </div>

            <Card>
              <h2 className="text-2xl font-black">Review queue</h2>
              {items.length === 0 ? (
                <p className="mt-8 text-slate-500">No campaigns waiting for review.</p>
              ) : (
                <div className="mt-6 space-y-5">
                  {items.map((c) => (
                    <div key={c.id} className="rounded-2xl border border-slate-200 p-5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <Badge tone="amber">{countryDisplayName(c.country)}</Badge>
                        <span className="text-sm text-slate-500">{new Date(c.createdAt).toLocaleString()}</span>
                      </div>
                      <h3 className="mt-3 text-lg font-bold text-[#101820]">{c.title}</h3>
                      {c.description ? <p className="mt-1 text-sm text-slate-600">{c.description}</p> : null}
                      <div className="mt-3 grid gap-1 text-sm text-slate-600 md:grid-cols-2">
                        <p>Organiser: <span className="font-semibold text-[#101820]">{c.organiser?.user?.name ?? "Unknown"} ({c.organiser?.user?.email ?? "—"})</span></p>
                        <p>Supplier: <span className="font-semibold text-[#101820]">{c.supplier?.vendor?.storeName ?? "Unknown"} {c.supplierCommitted ? "✓ accepted" : "⏳ awaiting acceptance"}</span></p>
                        <p>Minimum / goal / maximum: <span className="font-semibold text-[#101820]">{c.minimumShares} / {c.goalShares} / {c.maximumShares} shares</span></p>
                        <p>Price per share: <span className="font-semibold text-[#101820]">{centsToUnit(c.pricePerShareMinor).toFixed(2)} {c.currency}</span></p>
                        <p>Deadline: <span className="font-semibold text-[#101820]">{new Date(c.deadline).toLocaleDateString()}</span></p>
                      </div>
                      <textarea
                        placeholder="Notes for the organiser (required to request changes)"
                        value={notesById[c.id] ?? ""}
                        onChange={(e) => setNotesById((prev) => ({ ...prev, [c.id]: e.target.value }))}
                        className="mt-4 w-full rounded-xl border border-slate-200 p-3 text-sm"
                        rows={2}
                      />
                      <div className="mt-4 flex flex-wrap gap-3">
                        <Button
                          disabled={busyId === c.id}
                          onClick={() => {
                            if (confirm("Approve this campaign? It will go live and become visible to buyers.")) void runAction(c.id, () => communityBuyAdminAPI.approveCampaign(c.id));
                          }}
                        >
                          Approve
                        </Button>
                        <Button
                          variant="secondary"
                          disabled={busyId === c.id || !notesById[c.id]?.trim()}
                          onClick={() => void runAction(c.id, () => communityBuyAdminAPI.requestCampaignChanges(c.id, notesById[c.id]!.trim()))}
                        >
                          Request changes
                        </Button>
                        <Button
                          variant="danger"
                          disabled={busyId === c.id}
                          onClick={() => {
                            if (confirm("Reject this campaign?")) void runAction(c.id, () => communityBuyAdminAPI.rejectCampaign(c.id, notesById[c.id]));
                          }}
                        >
                          Reject
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card>
              <h2 className="text-2xl font-black">Live &amp; recently closed</h2>
              <p className="mt-1 text-sm text-slate-500">Campaigns currently live or paused, plus closed campaigns and the organiser&apos;s decision for any that missed target.</p>
              {closed.length === 0 ? (
                <p className="mt-8 text-slate-500">No campaigns to show yet.</p>
              ) : (
                <div className="mt-6 space-y-4">
                  {closed.map((c) => (
                    <div key={c.id} className="rounded-2xl border border-slate-200 p-5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <Badge tone={CLOSED_STATUS_TONE[c.status]}>{CLOSED_STATUS_LABEL[c.status]}</Badge>
                        <span className="text-sm text-slate-500">{countryDisplayName(c.country)}</span>
                      </div>
                      <h3 className="mt-3 text-base font-bold text-[#101820]">{c.title}</h3>
                      <div className="mt-2 grid gap-1 text-sm text-slate-600 md:grid-cols-3">
                        <p>Organiser: <span className="font-semibold text-[#101820]">{c.organiser?.user?.name ?? "Unknown"}</span></p>
                        <p>Supplier: <span className="font-semibold text-[#101820]">{c.supplier?.vendor?.storeName ?? "Unknown"}</span></p>
                        <p>Confirmed shares: <span className="font-semibold text-[#101820]">{c.confirmedShares} of {c.maximumShares} (minimum {c.minimumShares}, goal {c.goalShares})</span></p>
                        <p>Price per share: <span className="font-semibold text-[#101820]">{centsToUnit(c.pricePerShareMinor).toFixed(2)} {c.currency}</span></p>
                        <p>Funding outcome: <span className="font-semibold text-[#101820]">{FUNDING_OUTCOME_LABEL[c.fundingOutcome]}</span></p>
                        <p>Target value: <span className="font-semibold text-[#101820]">{centsToUnit(c.targetAmount).toFixed(2)} {c.currency}</span></p>
                        <p>Extensions used: <span className="font-semibold text-[#101820]">{c.extensionCount} of 1</span></p>
                        <p>Deadline: <span className="font-semibold text-[#101820]">{new Date(c.deadline).toLocaleString()}</span></p>
                        {c.paidTotal != null ? <p>Paid total: <span className="font-semibold text-[#101820]">{centsToUnit(c.paidTotal).toFixed(2)} {c.currency}</span></p> : null}
                        {c.status === "RESCUE_WINDOW" && c.rescueEndsAt ? <p>Rescue window ends: <span className="font-semibold text-[#101820]">{new Date(c.rescueEndsAt).toLocaleString()}</span></p> : null}
                      </div>
                      {c.reviewNotes ? <p className="mt-2 text-sm text-slate-500">Notes: <span className="text-slate-700">{c.reviewNotes}</span></p> : null}

                      <div className="mt-3 flex flex-wrap items-center gap-4">
                        <button onClick={() => void toggleContributions(c.id)} className="text-sm font-bold text-[#096B4A] hover:underline">
                          {expandedContributionsId === c.id ? "Hide contributions" : "View contributions"}
                        </button>
                        <TextLink href={`/activity-logs?entityId=${c.id}`}>View audit history</TextLink>
                      </div>

                      {expandedContributionsId === c.id ? (
                        <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 p-4">
                          {contributionsLoadingId === c.id ? (
                            <p className="text-sm text-slate-500">Loading contributions...</p>
                          ) : !contributionsById[c.id] || contributionsById[c.id].length === 0 ? (
                            <p className="text-sm text-slate-500">No contributions/pledges recorded yet.</p>
                          ) : (
                            <div className="space-y-2">
                              {contributionsById[c.id].map((ct) => (
                                <div key={ct.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2 text-sm last:border-0 last:pb-0">
                                  <span className="font-semibold text-[#101820]">{ct.participant.name} <span className="font-normal text-slate-500">({ct.participant.email})</span></span>
                                  <span className="text-slate-600">{ct.quantity} share{ct.quantity === 1 ? "" : "s"} · {centsToUnit(ct.amount).toFixed(2)} {ct.currency}</span>
                                  <Badge tone={ct.status === "PAID" ? "green" : ct.status.startsWith("REFUND") ? "amber" : ct.status === "CANCELLED" || ct.status === "PAYMENT_FAILED" || ct.status === "CHARGE_FAILED" ? "red" : "gray"}>
                                    {ct.status.replace(/_/g, " ")}
                                  </Badge>
                                  {ct.isOrganiserTopUp ? <Badge tone="blue">Organiser top-up</Badge> : null}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : null}

                      {c.status === "LIVE" || c.status === "PAUSED" ? (
                        <div className="mt-4 flex flex-wrap gap-3 border-t border-slate-100 pt-4">
                          {c.status === "LIVE" ? (
                            <Button
                              variant="danger"
                              disabled={busyId === c.id}
                              onClick={() => {
                                if (confirm("Pause new contributions for this campaign? Existing participants keep their pledge; no new contributions will be accepted until resumed.")) void runAction(c.id, () => communityBuyAdminAPI.pauseCampaign(c.id));
                              }}
                            >
                              Pause new contributions
                            </Button>
                          ) : (
                            <Button
                              variant="secondary"
                              disabled={busyId === c.id}
                              onClick={() => {
                                if (confirm("Resume contributions for this campaign?")) void runAction(c.id, () => communityBuyAdminAPI.resumeCampaign(c.id));
                              }}
                            >
                              Resume contributions
                            </Button>
                          )}
                        </div>
                      ) : null}

                      {CANCELLABLE_STATUSES.includes(c.status) ? (
                        <div className="mt-4 border-t border-slate-100 pt-4">
                          <p className="text-xs font-semibold text-slate-500">End this campaign — no participant has been charged yet, so this only voids pledges, never creates a refund. Irreversible.</p>
                          <div className="mt-2 flex flex-wrap items-center gap-3">
                            <input
                              placeholder="Reason (required)"
                              value={cancelReasonById[c.id] ?? ""}
                              onChange={(e) => setCancelReasonById((prev) => ({ ...prev, [c.id]: e.target.value }))}
                              className="w-72 rounded-xl border border-slate-200 p-2 text-sm"
                            />
                            <Button
                              variant="danger"
                              disabled={busyId === c.id || !cancelReasonById[c.id]?.trim()}
                              onClick={() => {
                                if (confirm(`End "${c.title}" now? This cannot be undone. The organiser and every participant will be notified; no one is charged.`)) {
                                  void runCancelAction(c.id, cancelReasonById[c.id]!.trim());
                                }
                              }}
                            >
                              End campaign
                            </Button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card>
              <h2 className="text-2xl font-black">Extension requests</h2>
              <p className="mt-1 text-sm text-slate-500">One extension maximum per campaign — requires supplier reconfirmation and an unchanged price before approval.</p>
              {extensionRequests.length === 0 ? (
                <p className="mt-8 text-slate-500">No extension requests waiting for review.</p>
              ) : (
                <div className="mt-6 space-y-4">
                  {extensionRequests.map((req) => (
                    <div key={req.id} className="rounded-2xl border border-slate-200 p-5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <h3 className="text-base font-bold text-[#101820]">{req.campaign?.title ?? req.campaignId}</h3>
                        <span className="text-sm text-slate-500">{new Date(req.createdAt).toLocaleString()}</span>
                      </div>
                      <div className="mt-2 grid gap-1 text-sm text-slate-600 md:grid-cols-2">
                        <p>Confirmed: <span className="font-semibold text-[#101820]">{req.campaign?.confirmedShares ?? "—"} of {req.campaign?.minimumShares ?? "—"} required</span></p>
                        <p>Requested deadline: <span className="font-semibold text-[#101820]">{new Date(req.requestedDeadline).toLocaleString()}</span></p>
                        <p>Supplier reconfirmed: <span className="font-semibold text-[#101820]">{req.supplierReconfirmed ? "Yes" : "No"}</span></p>
                        <p>Price unchanged: <span className="font-semibold text-[#101820]">{req.priceUnchangedConfirmed ? "Yes" : "No"}</span></p>
                        <p>Participant terms unchanged: <span className="font-semibold text-[#101820]">{req.participantTermsUnchanged ? "Yes" : "No"}</span></p>
                      </div>
                      <p className="mt-2 text-sm text-slate-600">Reason: {req.reason}</p>
                      <div className="mt-4 flex flex-wrap gap-3">
                        <Button
                          disabled={busyId === req.id || !req.supplierReconfirmed || !req.priceUnchangedConfirmed}
                          onClick={() => {
                            if (confirm(`Approve this extension? The campaign deadline will move to ${new Date(req.requestedDeadline).toLocaleString()}.`)) void runExtensionAction(req.id, () => communityBuyAdminAPI.approveExtension(req.id));
                          }}
                        >
                          Approve extension
                        </Button>
                        <Button
                          variant="danger"
                          disabled={busyId === req.id}
                          onClick={() => {
                            if (confirm("Reject this extension request?")) void runExtensionAction(req.id, () => communityBuyAdminAPI.rejectExtension(req.id));
                          }}
                        >
                          Reject
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card>
              <h2 className="text-2xl font-black">Supplier payments</h2>
              <p className="mt-1 text-sm text-slate-500">Never release if the supplier&apos;s payout account changed since campaign approval without reverification.</p>
              {supplierPayments.length === 0 ? (
                <p className="mt-8 text-slate-500">No supplier payments recorded yet.</p>
              ) : (
                <div className="mt-6 space-y-4">
                  {supplierPayments.map((p) => (
                    <div key={p.id} className="rounded-2xl border border-slate-200 p-5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <h3 className="text-base font-bold text-[#101820]">{p.campaign?.title ?? p.campaignId}</h3>
                        <Badge tone={p.status === "PAID" ? "green" : p.status === "ON_HOLD" || p.status === "FAILED" ? "red" : "amber"}>{SUPPLIER_PAYMENT_STATUS_LABEL[p.status]}</Badge>
                      </div>
                      <div className="mt-2 grid gap-1 text-sm text-slate-600 md:grid-cols-2">
                        <p>Amount: <span className="font-semibold text-[#101820]">{centsToUnit(p.amount).toFixed(2)} {p.currency}</span></p>
                        <p>Final quantity: <span className="font-semibold text-[#101820]">{p.campaign?.confirmedShares ?? "—"}</span></p>
                        <p>Requested: <span className="font-semibold text-[#101820]">{new Date(p.createdAt).toLocaleString()}</span></p>
                        {p.holdReason ? <p className="md:col-span-2">Hold reason: <span className="font-semibold text-[#101820]">{p.holdReason}</span></p> : null}
                      </div>
                      {p.status !== "PAID" ? (
                        <div className="mt-4 flex flex-wrap items-center gap-3">
                          <Button
                            disabled={busyId === p.id}
                            onClick={() => {
                              if (confirm(`Release ${centsToUnit(p.amount).toFixed(2)} ${p.currency} to the supplier? This cannot be undone. Large releases may require a second admin's approval before funds actually move.`)) void runReleaseAction(p.id, p.campaignId);
                            }}
                          >
                            Approve release
                          </Button>
                          <input
                            placeholder="Hold reason"
                            value={holdReasonById[p.id] ?? ""}
                            onChange={(e) => setHoldReasonById((prev) => ({ ...prev, [p.id]: e.target.value }))}
                            className="rounded-xl border border-slate-200 p-2 text-sm"
                          />
                          <Button
                            variant="secondary"
                            disabled={busyId === p.id || !holdReasonById[p.id]?.trim()}
                            onClick={() => {
                              if (confirm("Place this supplier payment on hold?")) void runPaymentAction(p.id, () => communityBuyAdminAPI.holdSupplierPayment(p.campaignId, holdReasonById[p.id]!.trim()));
                            }}
                          >
                            Place on hold
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        )}
      </AdminLayout>
    </ProtectedRoute>
  );
}
