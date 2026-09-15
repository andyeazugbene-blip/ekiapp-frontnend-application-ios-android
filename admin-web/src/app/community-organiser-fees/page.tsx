"use client";

import { useCallback, useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Badge, Button, Card, ErrorPanel, LoadingPanel, PageHeader } from "@/components/AdminUI";
import ProtectedRoute from "@/components/ProtectedRoute";
import { APIError } from "@/lib/api";
import {
  communityBuyAdminAPI,
  type AdminCommunityBuyOrganiserFee,
  type AdminAttributionParticipant,
  type CommunityBuyOrganiserFeeStatus,
  type AttributionStatus,
} from "@/lib/services/communityBuy.api";

const FEE_STATUS_TONE: Record<CommunityBuyOrganiserFeeStatus, "green" | "amber" | "red" | "blue" | "gray"> = {
  ACCRUED: "blue",
  HELD: "amber",
  BLOCKED_NO_SETTLEMENT_ROUTE: "gray",
  SETTLED: "green",
  CANCELLED: "gray",
  REVERSED: "red",
};

function money(amountMinor: number, currency: string): string {
  return `${currency} ${(amountMinor / 100).toLocaleString("en-GB", { minimumFractionDigits: 2 })}`;
}

type FeeModal = { kind: "hold" | "release" | "settle"; campaignId: string };
type ReviewModal = { kind: "resolve"; participantId: string };

export default function CommunityOrganiserFeesPage() {
  const [fees, setFees] = useState<AdminCommunityBuyOrganiserFee[]>([]);
  const [reviews, setReviews] = useState<AdminAttributionParticipant[]>([]);
  const [reviewStatus, setReviewStatus] = useState<AttributionStatus>("UNDER_REVIEW");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");

  const [feeModal, setFeeModal] = useState<FeeModal | null>(null);
  const [holdReason, setHoldReason] = useState("");
  const [settlementMethod, setSettlementMethod] = useState<"EXTERNAL_SUPPLIER_ARRANGEMENT" | "NON_CASH_REWARD" | "STRIPE_CONNECT_TRANSFER">("EXTERNAL_SUPPLIER_ARRANGEMENT");
  const [providerReference, setProviderReference] = useState("");
  const [twoFactorCode, setTwoFactorCode] = useState("");

  const [reviewModal, setReviewModal] = useState<ReviewModal | null>(null);
  const [reviewOutcome, setReviewOutcome] = useState<"CONFIRMED_VALID" | "INVALIDATED">("CONFIRMED_VALID");
  const [reviewReason, setReviewReason] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const [f, r] = await Promise.all([
        communityBuyAdminAPI.getCommunityBuyOrganiserFees(),
        communityBuyAdminAPI.getAttributionReviews(reviewStatus),
      ]);
      setFees(f);
      setReviews(r);
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Could not load organiser fees.");
    } finally {
      setLoading(false);
    }
  }, [reviewStatus]);

  useEffect(() => { void load(); }, [load]);

  const closeFeeModal = () => { setFeeModal(null); setHoldReason(""); setProviderReference(""); setTwoFactorCode(""); };
  const closeReviewModal = () => { setReviewModal(null); setReviewReason(""); };

  const runFeeAction = async () => {
    if (!feeModal) return;
    setBusyId(feeModal.campaignId);
    setActionError("");
    try {
      let updated: AdminCommunityBuyOrganiserFee;
      if (feeModal.kind === "hold") {
        if (!holdReason.trim()) { setActionError("A reason code is required."); return; }
        updated = await communityBuyAdminAPI.holdCommunityBuyOrganiserFee(feeModal.campaignId, holdReason.trim(), twoFactorCode || undefined);
      } else if (feeModal.kind === "release") {
        updated = await communityBuyAdminAPI.releaseCommunityBuyOrganiserFee(feeModal.campaignId, twoFactorCode || undefined);
      } else {
        updated = await communityBuyAdminAPI.settleCommunityBuyOrganiserFee(feeModal.campaignId, settlementMethod, providerReference || undefined, twoFactorCode || undefined);
      }
      setFees((prev) => prev.map((f) => (f.campaignId === updated.campaignId ? updated : f)));
      closeFeeModal();
    } catch (err) {
      setActionError(err instanceof APIError ? err.message : "This action could not be completed.");
    } finally {
      setBusyId(null);
    }
  };

  const runReviewAction = async () => {
    if (!reviewModal) return;
    setBusyId(reviewModal.participantId);
    setActionError("");
    try {
      if (!reviewReason.trim()) { setActionError("A reason is required."); return; }
      await communityBuyAdminAPI.resolveAttributionReview(reviewModal.participantId, reviewOutcome, reviewReason.trim());
      setReviews((prev) => prev.filter((r) => r.id !== reviewModal.participantId));
      closeReviewModal();
    } catch (err) {
      setActionError(err instanceof APIError ? err.message : "This review could not be resolved.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <ProtectedRoute>
      <AdminLayout>
        <div className="space-y-6">
          <PageHeader
            title="Organiser Fees & Attribution"
            subtitle="CommunityBuyOrganiserFee — an accrual/accounting record, not a payout mechanism. Cash settlement (STRIPE_CONNECT_TRANSFER) is disabled until a provider-approved settlement route is confirmed (spec §26); the two non-cash routes spec §1.3 allows for v1 work today."
            actions={<Button variant="ghost" onClick={() => void load()}>Refresh</Button>}
          />

          {error ? <ErrorPanel message={error} onRetry={() => void load()} /> : null}

          {loading ? (
            <LoadingPanel label="Loading..." />
          ) : (
            <>
              <Card>
                <h2 className="text-base font-bold text-[#101820]">Organiser fees</h2>
                {fees.length === 0 ? (
                  <p className="mt-4 text-sm text-slate-400">No organiser fee records exist yet — a market needs organiserFeeBps configured and a third-party-supply campaign needs a captured order.</p>
                ) : (
                  <div className="mt-4 overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200">
                      <thead>
                        <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                          <th className="px-4 py-2">Campaign</th>
                          <th className="px-4 py-2">Status</th>
                          <th className="px-4 py-2">Captured qty</th>
                          <th className="px-4 py-2">Net fee</th>
                          <th className="px-4 py-2">Settlement</th>
                          <th className="px-4 py-2" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {fees.map((f) => (
                          <tr key={f.id} className="text-sm text-slate-700">
                            <td className="px-4 py-3">
                              <span className="font-semibold text-[#101820]">{f.campaign?.title ?? f.campaignId}</span>
                              <span className="block text-xs text-slate-400">{f.campaignId}</span>
                            </td>
                            <td className="px-4 py-3"><Badge tone={FEE_STATUS_TONE[f.status]}>{f.status}</Badge></td>
                            <td className="px-4 py-3">{f.capturedQuantity}</td>
                            <td className="px-4 py-3 font-semibold">{money(f.netFeeAmount, f.currency)}</td>
                            <td className="px-4 py-3">{f.settlementMethod}</td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap gap-2">
                                {f.status !== "SETTLED" ? (
                                  <Button variant="ghost" disabled={busyId === f.campaignId} className="!h-8 !px-3 !text-xs" onClick={() => setFeeModal({ kind: "hold", campaignId: f.campaignId })}>Hold</Button>
                                ) : null}
                                {f.status === "HELD" ? (
                                  <Button variant="ghost" disabled={busyId === f.campaignId} className="!h-8 !px-3 !text-xs" onClick={() => setFeeModal({ kind: "release", campaignId: f.campaignId })}>Release</Button>
                                ) : null}
                                {f.status === "ACCRUED" ? (
                                  <Button variant="primary" disabled={busyId === f.campaignId} className="!h-8 !px-3 !text-xs" onClick={() => setFeeModal({ kind: "settle", campaignId: f.campaignId })}>Settle</Button>
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>

              <Card>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-base font-bold text-[#101820]">Attribution review queue (spec §14.5)</h2>
                  <select value={reviewStatus} onChange={(e) => setReviewStatus(e.target.value as AttributionStatus)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#096B4A]">
                    <option value="UNDER_REVIEW">Under review</option>
                    <option value="INVALIDATED">Invalidated</option>
                    <option value="ACTIVE">Active</option>
                  </select>
                </div>
                <p className="mt-1 text-sm text-slate-500">Suspected supplier copying or solicitation, flagged for manual investigation. Resolving never reassigns credit to a different organiser — it only confirms or invalidates.</p>
                {reviews.length === 0 ? (
                  <p className="mt-4 text-sm text-slate-400">Nothing in this state.</p>
                ) : (
                  <div className="mt-4 overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200">
                      <thead>
                        <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                          <th className="px-4 py-2">Campaign</th>
                          <th className="px-4 py-2">Participant</th>
                          <th className="px-4 py-2">Source</th>
                          <th className="px-4 py-2">Reason</th>
                          <th className="px-4 py-2" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {reviews.map((r) => (
                          <tr key={r.id} className="text-sm text-slate-700 align-top">
                            <td className="px-4 py-3">{r.campaign?.title ?? r.campaignId}</td>
                            <td className="px-4 py-3">{r.user?.name ?? r.userId}</td>
                            <td className="px-4 py-3">{r.attributionSource ?? "—"}</td>
                            <td className="px-4 py-3 text-xs text-slate-500">{r.attributionOverrideReason ?? "—"}</td>
                            <td className="px-4 py-3">
                              {reviewStatus === "UNDER_REVIEW" ? (
                                <Button variant="primary" disabled={busyId === r.id} className="!h-8 !px-3 !text-xs" onClick={() => setReviewModal({ kind: "resolve", participantId: r.id })}>Resolve</Button>
                              ) : null}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </>
          )}
        </div>

        {feeModal ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4">
            <Card className="w-full max-w-md">
              <h3 className="text-xl font-black text-[#101820]">
                {feeModal.kind === "hold" ? "Hold organiser fee" : feeModal.kind === "release" ? "Release organiser fee" : "Settle organiser fee"}
              </h3>
              {feeModal.kind === "hold" ? (
                <input value={holdReason} onChange={(e) => setHoldReason(e.target.value)} placeholder="Reason code (e.g. dispute_open)" className="mt-3 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none" />
              ) : null}
              {feeModal.kind === "settle" ? (
                <>
                  <p className="mt-2 text-sm text-slate-500">EXTERNAL_SUPPLIER_ARRANGEMENT and NON_CASH_REWARD record settlement with no Stripe call. STRIPE_CONNECT_TRANSFER will refuse (503) until a settlement route is confirmed server-side.</p>
                  <select value={settlementMethod} onChange={(e) => setSettlementMethod(e.target.value as typeof settlementMethod)} className="mt-3 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none">
                    <option value="EXTERNAL_SUPPLIER_ARRANGEMENT">External supplier arrangement</option>
                    <option value="NON_CASH_REWARD">Non-cash reward</option>
                    <option value="STRIPE_CONNECT_TRANSFER">Stripe Connect transfer (blocked)</option>
                  </select>
                  <input value={providerReference} onChange={(e) => setProviderReference(e.target.value)} placeholder="Reference (invoice #, note)" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none" />
                </>
              ) : null}
              <input value={twoFactorCode} onChange={(e) => setTwoFactorCode(e.target.value)} placeholder="2FA code" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none" />
              {actionError ? <p className="mt-2 text-sm text-red-600">{actionError}</p> : null}
              <div className="mt-4 flex gap-3">
                <button onClick={() => void runFeeAction()} disabled={busyId === feeModal.campaignId} className="flex-1 rounded-xl bg-[#096B4A] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">
                  {busyId === feeModal.campaignId ? "Working..." : "Confirm"}
                </button>
                <button onClick={closeFeeModal} className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600">Cancel</button>
              </div>
            </Card>
          </div>
        ) : null}

        {reviewModal ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4">
            <Card className="w-full max-w-md">
              <h3 className="text-xl font-black text-[#101820]">Resolve attribution review</h3>
              <select value={reviewOutcome} onChange={(e) => setReviewOutcome(e.target.value as typeof reviewOutcome)} className="mt-3 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none">
                <option value="CONFIRMED_VALID">Confirmed valid — restore active</option>
                <option value="INVALIDATED">Invalidated — confirmed solicitation</option>
              </select>
              <textarea value={reviewReason} onChange={(e) => setReviewReason(e.target.value)} placeholder="Investigation notes (required)" className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none" rows={3} />
              {actionError ? <p className="mt-2 text-sm text-red-600">{actionError}</p> : null}
              <div className="mt-4 flex gap-3">
                <button onClick={() => void runReviewAction()} disabled={busyId === reviewModal.participantId} className="flex-1 rounded-xl bg-[#096B4A] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">
                  {busyId === reviewModal.participantId ? "Working..." : "Confirm"}
                </button>
                <button onClick={closeReviewModal} className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600">Cancel</button>
              </div>
            </Card>
          </div>
        ) : null}
      </AdminLayout>
    </ProtectedRoute>
  );
}
