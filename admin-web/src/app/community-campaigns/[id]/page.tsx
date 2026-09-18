"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AdminLayout from "@/components/AdminLayout";
import { Badge, Button, Card, ErrorPanel, Icon, LoadingPanel } from "@/components/AdminUI";
import ProtectedRoute from "@/components/ProtectedRoute";
import { API2FARequiredError, APIError } from "@/lib/api";
import {
  communityBuyAdminAPI, isPendingApproval,
  type AdminCampaign, type AdminSupplierPayment,
  type CampaignStatus, type SupplierPaymentStatus,
} from "@/lib/services/communityBuy.api";
import { countryDisplayName } from "@/lib/countries";

function centsToUnit(value: unknown): number {
  return typeof value === "number" ? value / 100 : 0;
}

const STATUS_TONE: Record<CampaignStatus, "green" | "amber" | "red" | "blue" | "gray"> = {
  DRAFT: "gray", UNDER_REVIEW: "amber", CHANGES_REQUIRED: "amber", APPROVED: "blue", REJECTED: "red",
  LIVE: "blue", PAUSED: "gray", RESCUE_WINDOW: "amber", SUCCEEDED: "green", FAILED: "amber",
  REFUNDING: "amber", FULFILLING: "blue", COMPLETED: "green", FINANCIALLY_CLOSED: "gray", CANCELLED: "red",
};

const STATUS_LABEL: Record<CampaignStatus, string> = {
  DRAFT: "Draft", UNDER_REVIEW: "Under review", CHANGES_REQUIRED: "Changes requested", APPROVED: "Approved",
  REJECTED: "Rejected", LIVE: "Live", PAUSED: "Paused", RESCUE_WINDOW: "Needs more participants",
  SUCCEEDED: "Succeeded", FAILED: "Did not reach minimum", REFUNDING: "Refunding", FULFILLING: "Proceeding",
  COMPLETED: "Completed", FINANCIALLY_CLOSED: "Financially closed", CANCELLED: "Ended",
};

const SUPPLIER_PAYMENT_STATUS_LABEL: Record<SupplierPaymentStatus, string> = {
  NOT_RELEASED: "Not released", PROCESSING: "Processing", PAID: "Paid", ON_HOLD: "On hold", FAILED: "Failed",
};

// Same guard the list page uses — money is guaranteed never to have moved
// yet under PLEDGE_THEN_CHARGE for any of these, so ending the campaign here
// only voids pledges, never creates a refund. Matches the backend exactly.
const CANCELLABLE_STATUSES: CampaignStatus[] = ["LIVE", "PAUSED", "RESCUE_WINDOW"];
const REVIEW_STATUSES: CampaignStatus[] = ["UNDER_REVIEW", "CHANGES_REQUIRED"];

export default function CommunityCampaignDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();

  const [campaign, setCampaign] = useState<AdminCampaign | null>(null);
  const [payment, setPayment] = useState<AdminSupplierPayment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [notes, setNotes] = useState("");
  const [holdReason, setHoldReason] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [pendingAction, setPendingAction] = useState<"release" | "hold" | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState("");
  // Phase 2 (admin ops) — the unified operations view's one shared
  // issue/notes field. Independent of every existing review/payment/
  // campaign state field above.
  const [issueNotes, setIssueNotes] = useState("");
  const [issueNotesSaved, setIssueNotesSaved] = useState(true);

  // Diaspora escrow reconciliation (Figma admin S84/S85) — this page is
  // additive: it reuses the SAME two list endpoints the review-queue page
  // already fetches (no new backend route for a single-campaign GET) and
  // finds the matching campaign client-side, since a campaign is always in
  // exactly one of those two lists depending on its current status.
  const load = useCallback(async () => {
    if (!params.id) return;
    try {
      setLoading(true);
      setError("");
      const [review, closed, payments] = await Promise.all([
        communityBuyAdminAPI.getCampaignsForReview(),
        communityBuyAdminAPI.getRecentlyClosedCampaigns(),
        communityBuyAdminAPI.getSupplierPayments(),
      ]);
      const found = [...review, ...closed].find((c) => c.id === params.id) ?? null;
      setCampaign(found);
      setPayment(payments.find((p) => p.campaignId === params.id) ?? null);
      if (!found) setError("Campaign not found in the review or live/closed queues.");
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Failed to load this campaign");
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => { void load(); }, [load]);

  // Phase 2 (admin ops) — sync the notes draft only when a genuinely
  // different campaign loads, not on every background refresh, so an
  // in-progress edit here survives an unrelated action (approve/pause/etc.)
  // updating `campaign`.
  useEffect(() => {
    if (campaign) {
      setIssueNotes(campaign.adminIssueNotes ?? "");
      setIssueNotesSaved(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaign?.id]);

  const runSaveIssueNotes = async () => {
    if (!campaign) return;
    setBusy(true);
    try {
      await communityBuyAdminAPI.setCampaignIssueNotes(campaign.id, issueNotes.trim());
      setIssueNotesSaved(true);
      await load();
    } catch (err) {
      alert(err instanceof APIError ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  };

  const runAction = async (action: () => Promise<AdminCampaign>) => {
    setBusy(true);
    try {
      await action();
      await load();
    } catch (err) {
      alert(err instanceof APIError ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  };

  const runCancelAction = async () => {
    if (!campaign) return;
    setBusy(true);
    try {
      await communityBuyAdminAPI.cancelCampaign(campaign.id, cancelReason.trim());
      await load();
    } catch (err) {
      alert(err instanceof APIError ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  };

  const runReleaseAction = async (code?: string) => {
    if (!campaign) return;
    setBusy(true);
    try {
      const result = await communityBuyAdminAPI.releaseSupplierPayment(campaign.id, code);
      if (isPendingApproval(result)) alert(result.message);
      else alert("Payment released.");
      setPendingAction(null);
      setTwoFactorCode("");
      await load();
    } catch (err) {
      if (err instanceof API2FARequiredError) setPendingAction("release");
      else alert(err instanceof APIError ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  };

  const runHoldAction = async (code?: string) => {
    if (!campaign) return;
    setBusy(true);
    try {
      await communityBuyAdminAPI.holdSupplierPayment(campaign.id, holdReason.trim(), code);
      setPendingAction(null);
      setTwoFactorCode("");
      await load();
    } catch (err) {
      if (err instanceof API2FARequiredError) setPendingAction("hold");
      else alert(err instanceof APIError ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ProtectedRoute>
      <AdminLayout>
        {loading ? <LoadingPanel label="Loading campaign..." /> : !campaign ? (
          <div className="p-12 text-center text-slate-500">
            {error || "Campaign not found."} <button onClick={() => router.back()} className="text-[#096B4A] underline">Go back</button>
          </div>
        ) : (
          <div className="space-y-8">
            <button onClick={() => router.back()} className="flex items-center gap-2 text-sm font-bold text-[#096B4A]"><Icon name="arrow" className="h-4 w-4 rotate-90" /> Back to campaigns</button>

            {error ? <ErrorPanel message={error} onRetry={() => void load()} /> : null}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-black text-[#101820]">{campaign.title}</h1>
                  <Badge tone={STATUS_TONE[campaign.status]}>{STATUS_LABEL[campaign.status]}</Badge>
                </div>
                <p className="mt-1 text-sm text-slate-500">{countryDisplayName(campaign.country)} · Created {new Date(campaign.createdAt).toLocaleString()}</p>
              </div>
            </div>

            {/* S84 — per-campaign review detail, reusing the exact approve/request-changes/reject actions from the review queue. */}
            {REVIEW_STATUSES.includes(campaign.status) ? (
              <Card>
                <h2 className="text-xl font-black">Review</h2>
                {campaign.description ? <p className="mt-2 text-sm text-slate-600">{campaign.description}</p> : null}
                <div className="mt-3 grid gap-1 text-sm text-slate-600 md:grid-cols-2">
                  <p>Organiser: <span className="font-semibold text-[#101820]">{campaign.organiser?.user?.name ?? "Unknown"} ({campaign.organiser?.user?.email ?? "—"})</span></p>
                  <p>Fulfilment: <span className="font-semibold text-[#101820]">
                    {campaign.fulfilmentOwner === "SELF"
                      ? "Self-fulfilled (organiser)"
                      : `${campaign.supplier?.vendor?.storeName ?? "Unknown"} — ${campaign.supplierCommitted ? "✓ accepted" : campaign.supplierDeclinedAt ? `✗ declined${campaign.supplierDeclineReason ? `: ${campaign.supplierDeclineReason}` : ""}` : "⏳ awaiting response"}`}
                  </span></p>
                  <p>Minimum / goal / maximum: <span className="font-semibold text-[#101820]">{campaign.minimumShares} / {campaign.goalShares} / {campaign.maximumShares} shares</span></p>
                  <p>Price per share: <span className="font-semibold text-[#101820]">{centsToUnit(campaign.pricePerShareMinor).toFixed(2)} {campaign.currency}</span></p>
                  <p>Deadline: <span className="font-semibold text-[#101820]">{new Date(campaign.deadline).toLocaleDateString()}</span></p>
                  {campaign.reviewNotes ? <p className="md:col-span-2">Previous notes: <span className="font-semibold text-[#101820]">{campaign.reviewNotes}</span></p> : null}
                </div>
                <textarea
                  placeholder="Notes for the organiser (required to request changes)"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="mt-4 w-full rounded-xl border border-slate-200 p-3 text-sm"
                  rows={2}
                />
                <div className="mt-4 flex flex-wrap gap-3">
                  <Button
                    disabled={busy}
                    onClick={() => {
                      if (confirm("Approve this campaign? It will go live and become visible to buyers.")) void runAction(() => communityBuyAdminAPI.approveCampaign(campaign.id));
                    }}
                  >
                    Approve
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={busy || !notes.trim()}
                    onClick={() => void runAction(() => communityBuyAdminAPI.requestCampaignChanges(campaign.id, notes.trim()))}
                  >
                    Request changes
                  </Button>
                  <Button
                    variant="danger"
                    disabled={busy}
                    onClick={() => {
                      if (confirm("Reject this campaign?")) void runAction(() => communityBuyAdminAPI.rejectCampaign(campaign.id, notes || undefined));
                    }}
                  >
                    Reject
                  </Button>
                </div>
              </Card>
            ) : null}

            {/* S85 — unified campaign operations: campaign status + supplier status + payment status, with the existing pause/resume/hold/release/cancel actions consolidated onto one screen. Cancellation stays the existing instant/direct action — no "under review" workflow introduced here. */}
            <Card>
              <h2 className="text-xl font-black">Operations</h2>
              <div className="mt-3 grid gap-1 text-sm text-slate-600 md:grid-cols-3">
                <p>Campaign status: <span className="font-semibold text-[#101820]">{STATUS_LABEL[campaign.status]}</span></p>
                <p>Supplier status: <span className="font-semibold text-[#101820]">
                  {campaign.fulfilmentOwner === "SELF" ? "Self-fulfilled" : campaign.supplierCommitted ? "Accepted" : campaign.supplierDeclinedAt ? "Declined" : "Awaiting response"}
                </span></p>
                <p>Payment status: <span className="font-semibold text-[#101820]">{payment ? SUPPLIER_PAYMENT_STATUS_LABEL[payment.status] : "No payment record yet"}</span></p>
                <p>Confirmed shares: <span className="font-semibold text-[#101820]">{campaign.confirmedShares} of {campaign.maximumShares}</span></p>
                {campaign.paidTotal != null ? <p>Paid total: <span className="font-semibold text-[#101820]">{centsToUnit(campaign.paidTotal).toFixed(2)} {campaign.currency}</span></p> : null}
                {campaign.status === "RESCUE_WINDOW" && campaign.rescueEndsAt ? <p>Rescue window ends: <span className="font-semibold text-[#101820]">{new Date(campaign.rescueEndsAt).toLocaleString()}</span></p> : null}
                {campaign.perBuyerMinShares != null || campaign.perBuyerMaxShares != null ? (
                  <p>Per-buyer limit: <span className="font-semibold text-[#101820]">{campaign.perBuyerMinShares ?? "—"} – {campaign.perBuyerMaxShares ?? "—"}</span></p>
                ) : null}
                {campaign.scheduledOpenAt ? (
                  <p>Scheduled opening: <span className="font-semibold text-[#101820]">{new Date(campaign.scheduledOpenAt).toLocaleString()}</span></p>
                ) : null}
              </div>

              {/* Current issues — read from the real fields already recorded against this campaign/payment, never a new freestanding note. */}
              {campaign.reviewNotes || campaign.supplierDeclineReason || payment?.holdReason ? (
                <div className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
                  <p className="font-bold">Open issues</p>
                  {campaign.reviewNotes ? <p className="mt-1">Review notes: {campaign.reviewNotes}</p> : null}
                  {campaign.supplierDeclineReason ? <p className="mt-1">Supplier declined: {campaign.supplierDeclineReason}</p> : null}
                  {payment?.holdReason ? <p className="mt-1">Payment on hold: {payment.holdReason}</p> : null}
                </div>
              ) : null}

              {/* Phase 2 (admin ops) — one shared, admin-internal issue/notes
                  field for this campaign, independent of every other field
                  on this page (reviewNotes, supplierDeclineReason, holdReason
                  all stay exactly as they are). Never shown to the organiser
                  or participants. */}
              <div className="mt-4 border-t border-slate-100 pt-4">
                <p className="text-xs font-semibold text-slate-500">Admin notes (internal only)</p>
                <textarea
                  placeholder="Free-text notes for other admins reviewing this campaign"
                  value={issueNotes}
                  onChange={(e) => { setIssueNotes(e.target.value); setIssueNotesSaved(false); }}
                  className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm"
                  rows={3}
                />
                <div className="mt-2 flex items-center gap-3">
                  <Button
                    variant="secondary"
                    disabled={busy || issueNotesSaved}
                    onClick={() => void runSaveIssueNotes()}
                  >
                    Save notes
                  </Button>
                  {issueNotesSaved ? <span className="text-xs text-slate-400">Saved</span> : <span className="text-xs text-amber-600">Unsaved changes</span>}
                </div>
              </div>

              {campaign.status === "LIVE" || campaign.status === "PAUSED" ? (
                <div className="mt-4 flex flex-wrap gap-3 border-t border-slate-100 pt-4">
                  {campaign.status === "LIVE" ? (
                    <Button
                      variant="danger"
                      disabled={busy}
                      onClick={() => {
                        if (confirm("Pause new contributions for this campaign? Existing participants keep their pledge; no new contributions will be accepted until resumed.")) void runAction(() => communityBuyAdminAPI.pauseCampaign(campaign.id));
                      }}
                    >
                      Pause new contributions
                    </Button>
                  ) : (
                    <Button
                      variant="secondary"
                      disabled={busy}
                      onClick={() => {
                        if (confirm("Resume contributions for this campaign?")) void runAction(() => communityBuyAdminAPI.resumeCampaign(campaign.id));
                      }}
                    >
                      Resume contributions
                    </Button>
                  )}
                </div>
              ) : null}

              {payment && payment.status !== "PAID" ? (
                <div className="mt-4 border-t border-slate-100 pt-4">
                  <p className="text-xs font-semibold text-slate-500">Supplier payment — {centsToUnit(payment.amount).toFixed(2)} {payment.currency}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <Button
                      disabled={busy}
                      onClick={() => {
                        if (confirm(`Release ${centsToUnit(payment.amount).toFixed(2)} ${payment.currency} to the supplier? This cannot be undone. Large releases may require a second admin's approval before funds actually move.`)) void runReleaseAction();
                      }}
                    >
                      Approve release
                    </Button>
                    <input
                      placeholder="Hold reason"
                      value={holdReason}
                      onChange={(e) => setHoldReason(e.target.value)}
                      className="rounded-xl border border-slate-200 p-2 text-sm"
                    />
                    <Button
                      variant="secondary"
                      disabled={busy || !holdReason.trim()}
                      onClick={() => {
                        if (confirm("Place this supplier payment on hold?")) void runHoldAction();
                      }}
                    >
                      Place on hold
                    </Button>
                  </div>
                </div>
              ) : null}

              {CANCELLABLE_STATUSES.includes(campaign.status) ? (
                <div className="mt-4 border-t border-slate-100 pt-4">
                  <p className="text-xs font-semibold text-slate-500">End this campaign — no participant has been charged yet, so this only voids pledges, never creates a refund. Irreversible.</p>
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <input
                      placeholder="Reason (required)"
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value)}
                      className="w-72 rounded-xl border border-slate-200 p-2 text-sm"
                    />
                    <Button
                      variant="danger"
                      disabled={busy || !cancelReason.trim()}
                      onClick={() => {
                        if (confirm(`End "${campaign.title}" now? This cannot be undone. The organiser and every participant will be notified; no one is charged.`)) void runCancelAction();
                      }}
                    >
                      End campaign
                    </Button>
                  </div>
                </div>
              ) : null}
            </Card>
          </div>
        )}

        {pendingAction ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4">
            <Card className="w-full max-w-md">
              <h3 className="text-xl font-black text-[#101820]">Enter 2FA code</h3>
              <p className="mt-2 text-sm text-slate-500">
                {pendingAction === "release" && payment
                  ? <>Confirm the release of <span className="font-bold">{centsToUnit(payment.amount).toFixed(2)} {payment.currency}</span> to the supplier.</>
                  : "Confirm placing this supplier payment on hold."}
              </p>
              <input
                autoFocus
                inputMode="numeric"
                value={twoFactorCode}
                onChange={(e) => setTwoFactorCode(e.target.value)}
                placeholder="6-digit code"
                className="mt-3 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none"
              />
              <div className="mt-4 flex gap-3">
                <Button
                  disabled={busy || !twoFactorCode.trim()}
                  onClick={() => {
                    if (pendingAction === "release") void runReleaseAction(twoFactorCode.trim());
                    else void runHoldAction(twoFactorCode.trim());
                  }}
                  className="flex-1"
                >
                  Confirm
                </Button>
                <Button variant="ghost" className="flex-1" onClick={() => { setPendingAction(null); setTwoFactorCode(""); }}>
                  Cancel
                </Button>
              </div>
            </Card>
          </div>
        ) : null}
      </AdminLayout>
    </ProtectedRoute>
  );
}
