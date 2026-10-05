"use client";

import { useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Badge, Button, Card, ErrorPanel, Icon, LoadingPanel, MetricCard, PageHeader, TextLink } from "@/components/AdminUI";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Banner, formatDateTime, formatDate, formatMinor, useConfirm } from "@/components/AdminKit";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { ReviewDecisionDialog } from "./ReviewDecisionDialog";
import { APIError } from "@/lib/api";
import {
  communityBuyAdminAPI, isPendingApproval,
  type AdminCampaign, type AdminCancellationRequest, type AdminContribution, type AdminExtensionRequest, type AdminSupplierPayment,
  type AdminSupplierProposal, type CampaignStatus, type FundingOutcome, type SupplierPaymentStatus,
} from "@/lib/services/communityBuy.api";
import { countryDisplayName } from "@/lib/countries";


const CLOSED_STATUS_TONE: Record<CampaignStatus, "green" | "amber" | "red" | "blue" | "gray"> = {
  DRAFT: "gray", UNDER_REVIEW: "amber", CHANGES_REQUIRED: "amber", APPROVED: "blue", REJECTED: "red",
  LIVE: "blue", PAUSED: "gray", RESCUE_WINDOW: "amber", SUCCEEDED: "green", FAILED: "amber",
  REFUNDING: "amber", FULFILLING: "blue", COMPLETED: "green", FINANCIALLY_CLOSED: "gray", CANCELLED: "red",
  CANCELLATION_UNDER_REVIEW: "amber",
};

const CLOSED_STATUS_LABEL: Record<CampaignStatus, string> = {
  DRAFT: "Draft", UNDER_REVIEW: "Under review", CHANGES_REQUIRED: "Changes requested", APPROVED: "Approved",
  REJECTED: "Rejected", LIVE: "Live", PAUSED: "Paused", RESCUE_WINDOW: "Needs more participants",
  SUCCEEDED: "Succeeded", FAILED: "Did not reach minimum", REFUNDING: "Refunding", FULFILLING: "Proceeding",
  COMPLETED: "Completed", FINANCIALLY_CLOSED: "Financially closed", CANCELLED: "Ended",
  CANCELLATION_UNDER_REVIEW: "Cancellation under review",
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
  const confirm = useConfirm();
  // Backend: every queue here is community_buy.read; every action is community_buy.mutate (+2FA, prompted globally).
  const { has, loading: permLoading } = usePermissions();
  const canMutate = has("community_buy.mutate");
  const [notice, setNotice] = useState<{ tone: "success" | "info" | "warning"; text: string } | null>(null);
  const [review, setReview] = useState<{ mode: "approve" | "reject"; id: string; title: string } | null>(null);
  const [items, setItems] = useState<AdminCampaign[]>([]);
  const [closed, setClosed] = useState<AdminCampaign[]>([]);
  const [extensionRequests, setExtensionRequests] = useState<AdminExtensionRequest[]>([]);
  const [cancellationRequests, setCancellationRequests] = useState<AdminCancellationRequest[]>([]);
  // Phase 5 (organiser<->supplier negotiation)
  const [supplierProposals, setSupplierProposals] = useState<AdminSupplierProposal[]>([]);
  const [proposalNotesById, setProposalNotesById] = useState<Record<string, string>>({});
  const [supplierPayments, setSupplierPayments] = useState<AdminSupplierPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notesById, setNotesById] = useState<Record<string, string>>({});
  const [contributionsById, setContributionsById] = useState<Record<string, AdminContribution[]>>({});
  const [expandedContributionsId, setExpandedContributionsId] = useState<string | null>(null);
  const [contributionsLoadingId, setContributionsLoadingId] = useState<string | null>(null);
  const load = async (bypassCache = false) => {
    try {
      bypassCache ? setRefreshing(true) : setLoading(true);
      setError("");
      const opts = bypassCache ? { bypassCache: true } : undefined;
      const [review, recentlyClosed, pendingExtensions, pendingCancellations, pendingProposals, payments] = await Promise.all([
        communityBuyAdminAPI.getCampaignsForReview(opts),
        communityBuyAdminAPI.getRecentlyClosedCampaigns(opts),
        communityBuyAdminAPI.getExtensionRequests(opts),
        communityBuyAdminAPI.getCancellationRequests(opts),
        communityBuyAdminAPI.getSupplierProposals(opts),
        communityBuyAdminAPI.getSupplierPayments(opts),
      ]);
      setItems(review);
      setClosed(recentlyClosed);
      setExtensionRequests(pendingExtensions);
      setCancellationRequests(pendingCancellations);
      setSupplierProposals(pendingProposals);
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
      setError(err instanceof APIError ? err.message : "Failed to load contributions");
    } finally {
      setContributionsLoadingId(null);
    }
  };

  /** Direct (non-dialog) action: failures surface in the page error banner instead of a browser alert. */
  const runAction = async (id: string, action: () => Promise<unknown>, success?: string) => {
    setBusyId(id);
    try {
      await action();
      if (success) setNotice({ tone: "success", text: success });
      await load(true);
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Action failed");
    } finally {
      setBusyId(null);
    }
  };

  /** Dialog action: errors are thrown so the confirm dialog shows them inline. */
  const perform = async (id: string, action: () => Promise<unknown>, success?: string) => {
    setBusyId(id);
    try {
      await action();
      if (success) setNotice({ tone: "success", text: success });
      await load(true);
    } finally {
      setBusyId(null);
    }
  };

  const askResume = (c: AdminCampaign) => confirm.ask(
    { title: `Resume "${c.title}"?`, tone: "primary", confirmLabel: "Resume contributions", description: "New contributions are accepted again.", requireReason: false },
    () => perform(c.id, () => communityBuyAdminAPI.resumeCampaign(c.id), "Campaign resumed."),
  );

  const askPause = (c: AdminCampaign) => confirm.ask(
    { title: `Pause "${c.title}"?`, description: "No new contributions are accepted until resumed. The organiser, supplier and participants are notified.", confirmLabel: "Pause campaign", reasonLabel: "Reason (shared with the organiser and supplier, recorded in the audit log)" },
    (reason) => perform(c.id, () => communityBuyAdminAPI.pauseCampaign(c.id, reason), "Campaign paused."),
  );

  const askEnd = (c: AdminCampaign) => confirm.ask(
    { title: `End "${c.title}" now?`, confirmLabel: "End campaign", description: "No participant has been charged yet, so this only voids pledges and never creates a refund. This cannot be undone. The organiser and every participant are notified.", reasonLabel: "Reason (shared with the organiser, recorded in the audit log)" },
    (reason) => perform(c.id, () => communityBuyAdminAPI.cancelCampaign(c.id, reason), "Campaign ended."),
  );

  const askApproveExtension = (req: AdminExtensionRequest) => confirm.ask(
    { title: "Approve this extension?", tone: "primary", confirmLabel: "Approve extension", description: `The campaign deadline moves to ${formatDateTime(req.requestedDeadline)}. Only one extension is allowed per campaign.`, requireReason: false },
    () => perform(req.id, () => communityBuyAdminAPI.approveExtension(req.id), "Extension approved."),
  );

  const askRejectExtension = (req: AdminExtensionRequest) => confirm.ask(
    { title: "Reject this extension request?", confirmLabel: "Reject extension", description: "The organiser is told the request was rejected.", reasonLabel: "Reason (sent to the organiser, recorded in the audit log)" },
    (reason) => perform(req.id, () => communityBuyAdminAPI.rejectExtension(req.id, reason), "Extension rejected."),
  );

  const askApproveCancellation = (req: AdminCancellationRequest) => confirm.ask(
    { title: "Approve this cancellation?", confirmLabel: "Approve cancellation", description: "Every paid participant will be refunded, and any not-yet-released supplier or organiser payout will be held. This cannot be undone.", requireReason: false },
    async () => {
      setBusyId(req.id);
      try {
        const result = await communityBuyAdminAPI.approveCancellation(req.id);
        setNotice(isPendingApproval(result) ? { tone: "warning", text: result.message } : { tone: "success", text: "Cancellation approved. Refunds are being processed." });
        await load(true);
      } finally {
        setBusyId(null);
      }
    },
  );

  const askRejectCancellation = (req: AdminCancellationRequest) => confirm.ask(
    { title: "Reject this cancellation request?", confirmLabel: "Reject request", description: "The campaign resumes at its previous status.", reasonLabel: "Reason (shown to the organiser, recorded in the audit log)" },
    (reason) => perform(req.id, () => communityBuyAdminAPI.rejectCancellation(req.id, reason), "Cancellation request rejected."),
  );

  const askForwardProposal = (p: AdminSupplierProposal) => confirm.ask(
    { title: "Forward this proposal to the organiser?", tone: "primary", confirmLabel: "Forward to organiser", description: "The organiser decides. This does not change the campaign.", requireReason: false },
    () => perform(p.id, () => communityBuyAdminAPI.approveSupplierProposal(p.id), "Proposal forwarded to the organiser."),
  );

  // A four-eyes AdminApprovalRule can turn a release into a 202 "pending a second admin's approval": that is its own
  // outcome and must never read as a completed release.
  const askRelease = (p: AdminSupplierPayment) => confirm.ask(
    { title: `Release ${formatMinor(p.amount, p.currency)} to the supplier?`, confirmLabel: "Release payment", description: "This cannot be undone. A large release may need a second admin's approval before any money moves. Requires a 2FA code.", requireReason: false },
    async () => {
      setBusyId(p.id);
      try {
        const result = await communityBuyAdminAPI.releaseSupplierPayment(p.campaignId);
        setNotice(isPendingApproval(result)
          ? { tone: "warning", text: result.message }
          : { tone: "success", text: "Release requested. The status updates once the provider confirms." });
        await load(true);
      } finally {
        setBusyId(null);
      }
    },
  );

  const askHold = (p: AdminSupplierPayment) => confirm.ask(
    { title: "Place this supplier payment on hold?", confirmLabel: "Place on hold", description: "The payment will not be released until it is reviewed. Requires a 2FA code.", reasonLabel: "Hold reason (recorded in the audit log)" },
    (reason) => perform(p.id, () => communityBuyAdminAPI.holdSupplierPayment(p.campaignId, reason), "Payment placed on hold."),
  );

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
            {notice ? <Banner tone={notice.tone}>{notice.text}</Banner> : null}
            {!permLoading && !canMutate ? <Banner tone="info">Your role can view Community Buy queues but cannot approve, reject, pause, release or hold anything.</Banner> : null}

            <div className="grid gap-6 md:grid-cols-4">
              <MetricCard icon="clock" label="Under review" value={items.length} tone="amber" />
              <MetricCard icon="warning" label="In rescue window" value={closed.filter((c) => c.status === "RESCUE_WINDOW").length} tone="amber" />
              <MetricCard icon="clock" label="Extension requests" value={extensionRequests.length} tone="amber" />
              <MetricCard icon="clock" label="Supplier proposals" value={supplierProposals.length} tone="amber" />
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
                        <span className="text-sm text-slate-500">{formatDateTime(c.createdAt)}</span>
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <h3 className="text-lg font-bold text-[#101820]">{c.title}</h3>
                        <TextLink href={`/community-campaigns/${c.id}`}>View details</TextLink>
                      </div>
                      {c.description ? <p className="mt-1 text-sm text-slate-600">{c.description}</p> : null}
                      <div className="mt-3 grid gap-1 text-sm text-slate-600 md:grid-cols-2">
                        <p>Organiser: <span className="font-semibold text-[#101820]">{c.organiser?.user?.name ?? "Unknown"} ({c.organiser?.user?.email ?? "—"})</span></p>
                        <p>Fulfilment: <span className="font-semibold text-[#101820]">
                          {c.fulfilmentOwner === "SELF"
                            ? "Self-fulfilled (organiser)"
                            : `${c.supplier?.vendor?.storeName ?? "Unknown"} — ${c.supplierCommitted ? "✓ accepted" : c.supplierDeclinedAt ? `✗ declined${c.supplierDeclineReason ? `: ${c.supplierDeclineReason}` : ""}` : "⏳ awaiting response (not a blocker — this campaign can still be approved and published)"}`}
                        </span></p>
                        <p>Minimum / goal / maximum: <span className="font-semibold text-[#101820]">{c.minimumShares} / {c.goalShares} / {c.maximumShares} shares</span></p>
                        <p>Price per share: <span className="font-semibold text-[#101820]">{formatMinor(c.pricePerShareMinor, c.currency)}</span></p>
                        <p>Deadline: <span className="font-semibold text-[#101820]">{formatDateTime(c.deadline)}</span></p>
                      </div>
                      {canMutate ? <><textarea
                        placeholder="Notes for the organiser (required to request changes; approve and reject ask for their own notes)"
                        value={notesById[c.id] ?? ""}
                        onChange={(e) => setNotesById((prev) => ({ ...prev, [c.id]: e.target.value }))}
                        className="mt-4 w-full rounded-xl border border-slate-200 p-3 text-sm"
                        rows={2}
                      />
                      <div className="mt-4 flex flex-wrap gap-3">
                        <Button
                          disabled={busyId === c.id}
                          onClick={() => setReview({ mode: "approve", id: c.id, title: c.title })}
                        >
                          Approve
                        </Button>
                        <Button
                          variant="secondary"
                          disabled={busyId === c.id || !notesById[c.id]?.trim()}
                          onClick={() => void runAction(c.id, () => communityBuyAdminAPI.requestCampaignChanges(c.id, notesById[c.id]!.trim()), "Changes requested from the organiser.")}
                        >
                          Request changes
                        </Button>
                        <Button
                          variant="danger"
                          disabled={busyId === c.id}
                          onClick={() => setReview({ mode: "reject", id: c.id, title: c.title })}
                        >
                          Reject
                        </Button>
                      </div></> : null}
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
                        <p>Fulfilment: <span className="font-semibold text-[#101820]">
                          {c.fulfilmentOwner === "SELF"
                            ? "Self-fulfilled (organiser)"
                            : `${c.supplier?.vendor?.storeName ?? "Unknown"}${c.supplierCommitted ? " ✓ accepted" : c.supplierDeclinedAt ? " ✗ declined" : " ⏳ pending"}`}
                        </span></p>
                        <p>Confirmed shares: <span className="font-semibold text-[#101820]">{c.confirmedShares} of {c.maximumShares} (minimum {c.minimumShares}, goal {c.goalShares})</span></p>
                        <p>Price per share: <span className="font-semibold text-[#101820]">{formatMinor(c.pricePerShareMinor, c.currency)}</span></p>
                        <p>Funding outcome: <span className="font-semibold text-[#101820]">{FUNDING_OUTCOME_LABEL[c.fundingOutcome]}</span></p>
                        <p>Target value: <span className="font-semibold text-[#101820]">{formatMinor(c.targetAmount, c.currency)}</span></p>
                        <p>Extensions used: <span className="font-semibold text-[#101820]">{c.extensionCount} of 1</span></p>
                        <p>Deadline: <span className="font-semibold text-[#101820]">{formatDateTime(c.deadline)}</span></p>
                        {c.paidTotal != null ? <p>Paid total: <span className="font-semibold text-[#101820]">{formatMinor(c.paidTotal, c.currency)}</span></p> : null}
                        {c.status === "RESCUE_WINDOW" && c.rescueEndsAt ? <p>Rescue window ends: <span className="font-semibold text-[#101820]">{formatDateTime(c.rescueEndsAt)}</span></p> : null}
                      </div>
                      {c.reviewNotes ? <p className="mt-2 text-sm text-slate-500">Notes: <span className="text-slate-700">{c.reviewNotes}</span></p> : null}

                      <div className="mt-3 flex flex-wrap items-center gap-4">
                        <button onClick={() => void toggleContributions(c.id)} className="text-sm font-bold text-[#096B4A] hover:underline">
                          {expandedContributionsId === c.id ? "Hide contributions" : "View contributions"}
                        </button>
                        <TextLink href={`/activity-logs?entityId=${c.id}`}>View audit history</TextLink>
                        <TextLink href={`/community-campaigns/${c.id}`}>View details / operations</TextLink>
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
                                  <span className="text-slate-600">{ct.quantity} share{ct.quantity === 1 ? "" : "s"} · {formatMinor(ct.amount, ct.currency)}</span>
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

                      {canMutate && (c.status === "LIVE" || c.status === "PAUSED") ? (
                        <div className="mt-4 flex flex-wrap gap-3 border-t border-slate-100 pt-4">
                          {c.status === "LIVE" ? (
                            <Button variant="danger" disabled={busyId === c.id} onClick={() => askPause(c)}>Pause new contributions</Button>
                          ) : (
                            <Button variant="secondary" disabled={busyId === c.id} onClick={() => askResume(c)}>Resume contributions</Button>
                          )}
                        </div>
                      ) : null}

                      {canMutate && CANCELLABLE_STATUSES.includes(c.status) ? (
                        <div className="mt-4 border-t border-slate-100 pt-4">
                          <p className="text-xs font-semibold text-slate-500">End this campaign. No participant has been charged yet, so this only voids pledges and never creates a refund. Irreversible.</p>
                          <div className="mt-2">
                            <Button variant="danger" disabled={busyId === c.id} onClick={() => askEnd(c)}>End campaign</Button>
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
                        <h3 className="text-base font-bold text-[#101820]">{req.campaign?.title ?? "Campaign title not provided"}</h3>
                        <span className="text-sm text-slate-500">{formatDateTime(req.createdAt)}</span>
                      </div>
                      <div className="mt-2 grid gap-1 text-sm text-slate-600 md:grid-cols-2">
                        <p>Confirmed: <span className="font-semibold text-[#101820]">{req.campaign?.confirmedShares ?? "—"} of {req.campaign?.minimumShares ?? "—"} required</span></p>
                        <p>Requested deadline: <span className="font-semibold text-[#101820]">{formatDateTime(req.requestedDeadline)}</span></p>
                        <p>Supplier reconfirmed: <span className="font-semibold text-[#101820]">{req.supplierReconfirmed ? "Yes" : "No"}</span></p>
                        <p>Price unchanged: <span className="font-semibold text-[#101820]">{req.priceUnchangedConfirmed ? "Yes" : "No"}</span></p>
                        <p>Participant terms unchanged: <span className="font-semibold text-[#101820]">{req.participantTermsUnchanged ? "Yes" : "No"}</span></p>
                      </div>
                      <p className="mt-2 text-sm text-slate-600">Reason: {req.reason}</p>
                      {canMutate ? <div className="mt-4 flex flex-wrap gap-3">
                        <Button disabled={busyId === req.id || !req.supplierReconfirmed || !req.priceUnchangedConfirmed} onClick={() => askApproveExtension(req)}>Approve extension</Button>
                        <Button variant="danger" disabled={busyId === req.id} onClick={() => askRejectExtension(req)}>Reject</Button>
                      </div> : null}
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card>
              <h2 className="text-2xl font-black">Cancellation requests</h2>
              <p className="mt-1 text-sm text-slate-500">Requested by the organiser once funds have already been captured. Approval refunds every paid participant and holds any not-yet-released supplier/organiser payout — never a duplicate refund on retry.</p>
              {cancellationRequests.length === 0 ? (
                <p className="mt-8 text-slate-500">No cancellation requests waiting for review.</p>
              ) : (
                <div className="mt-6 space-y-4">
                  {cancellationRequests.map((req) => (
                    <div key={req.id} className="rounded-2xl border border-slate-200 p-5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <h3 className="text-base font-bold text-[#101820]">{req.campaign?.title ?? "Campaign title not provided"}</h3>
                        <span className="text-sm text-slate-500">{formatDateTime(req.createdAt)}</span>
                      </div>
                      <div className="mt-2 grid gap-1 text-sm text-slate-600 md:grid-cols-2">
                        <p>Confirmed shares: <span className="font-semibold text-[#101820]">{req.campaign?.confirmedShares ?? "—"}</span></p>
                        <p>Paid so far: <span className="font-semibold text-[#101820]">{req.campaign?.paidTotal != null ? `${formatMinor(req.campaign.paidTotal, req.campaign.currency)}` : "—"}</span></p>
                      </div>
                      <p className="mt-2 text-sm text-slate-600">Reason: {req.reason}</p>
                      {canMutate ? <div className="mt-4 flex flex-wrap gap-3">
                        <Button disabled={busyId === req.id} onClick={() => askApproveCancellation(req)}>Approve cancellation</Button>
                        <Button variant="danger" disabled={busyId === req.id} onClick={() => askRejectCancellation(req)}>Reject</Button>
                      </div> : null}
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card>
              <h2 className="text-2xl font-black">Supplier proposals</h2>
              <p className="mt-1 text-sm text-slate-500">A supplier-requested change to wholesale amount, maximum shares, or ready-by date. Approving here only forwards it to the organiser for their own decision — it does not change the campaign.</p>
              {supplierProposals.length === 0 ? (
                <p className="mt-8 text-slate-500">No supplier proposals waiting for review.</p>
              ) : (
                <div className="mt-6 space-y-4">
                  {supplierProposals.map((p) => (
                    <div key={p.id} className="rounded-2xl border border-slate-200 p-5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <h3 className="text-base font-bold text-[#101820]">{p.campaign?.title ?? "Campaign title not provided"}</h3>
                        <span className="text-sm text-slate-500">{formatDateTime(p.createdAt)}</span>
                      </div>
                      <div className="mt-2 grid gap-1 text-sm text-slate-600 md:grid-cols-2">
                        {p.proposedWholesaleAmountMinor != null ? <p>Proposed wholesale amount: <span className="font-semibold text-[#101820]">{(p.proposedWholesaleAmountMinor / 100).toFixed(2)} (campaign currency)</span></p> : null}
                        {p.proposedMaximumShares != null ? <p>Proposed maximum shares: <span className="font-semibold text-[#101820]">{p.proposedMaximumShares}</span> (currently {p.campaign?.maximumShares ?? "—"}, {p.campaign?.confirmedShares ?? "—"} confirmed)</p> : null}
                        {p.proposedReadyByDate ? <p>Proposed ready-by date: <span className="font-semibold text-[#101820]">{formatDate(p.proposedReadyByDate)}</span></p> : null}
                        {p.revisionCount > 0 ? <p>Revisions: <span className="font-semibold text-[#101820]">{p.revisionCount}</span></p> : null}
                      </div>
                      <p className="mt-2 text-sm text-slate-600">Message: {p.message}</p>
                      {canMutate ? <><textarea
                        placeholder="Notes for the supplier (required to request changes)"
                        value={proposalNotesById[p.id] ?? ""}
                        onChange={(e) => setProposalNotesById((prev) => ({ ...prev, [p.id]: e.target.value }))}
                        className="mt-3 w-full rounded-xl border border-slate-200 p-3 text-sm"
                        rows={2}
                      />
                      <div className="mt-4 flex flex-wrap gap-3">
                        <Button disabled={busyId === p.id} onClick={() => askForwardProposal(p)}>Forward to organiser</Button>
                        <Button
                          variant="danger"
                          disabled={busyId === p.id || !proposalNotesById[p.id]?.trim()}
                          onClick={() => void runAction(p.id, () => communityBuyAdminAPI.requestSupplierProposalChanges(p.id, proposalNotesById[p.id]!.trim()), "Changes requested from the supplier.")}
                        >
                          Request changes
                        </Button>
                      </div></> : null}
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
                        <h3 className="text-base font-bold text-[#101820]">{p.campaign?.title ?? "Campaign title not provided"}</h3>
                        <Badge tone={p.status === "PAID" ? "green" : p.status === "ON_HOLD" || p.status === "FAILED" ? "red" : "amber"}>{SUPPLIER_PAYMENT_STATUS_LABEL[p.status]}</Badge>
                      </div>
                      <div className="mt-2 grid gap-1 text-sm text-slate-600 md:grid-cols-2">
                        <p>Amount: <span className="font-semibold text-[#101820]">{formatMinor(p.amount, p.currency)}</span></p>
                        <p>Final quantity: <span className="font-semibold text-[#101820]">{p.campaign?.confirmedShares ?? "—"}</span></p>
                        <p>Requested: <span className="font-semibold text-[#101820]">{formatDateTime(p.createdAt)}</span></p>
                        {p.holdReason ? <p className="md:col-span-2">Hold reason: <span className="font-semibold text-[#101820]">{p.holdReason}</span></p> : null}
                      </div>
                      {canMutate && p.status !== "PAID" ? (
                        <div className="mt-4 flex flex-wrap items-center gap-3">
                          <Button disabled={busyId === p.id} onClick={() => askRelease(p)}>Approve release</Button>
                          <Button variant="secondary" disabled={busyId === p.id} onClick={() => askHold(p)}>Place on hold</Button>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        )}

        {confirm.dialog}
        {review ? (
          <ReviewDecisionDialog mode={review.mode} campaignId={review.id} campaignTitle={review.title} onClose={() => setReview(null)} onDone={() => load(true)} />
        ) : null}
      </AdminLayout>
    </ProtectedRoute>
  );
}
