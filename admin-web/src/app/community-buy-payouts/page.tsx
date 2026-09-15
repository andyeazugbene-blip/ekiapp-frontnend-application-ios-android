"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Badge, Button, Card, ErrorPanel, LoadingPanel, PageHeader } from "@/components/AdminUI";
import ProtectedRoute from "@/components/ProtectedRoute";
import { APIError } from "@/lib/api";
import {
  communityBuyAdminAPI,
  isPendingCommunityBuyPayoutApproval,
  type AdminCommunityBuyPayout,
  type CommunityBuyPayoutStatus,
  type PayoutEligibility,
} from "@/lib/services/communityBuy.api";

const STATUS_TONE: Record<CommunityBuyPayoutStatus, "green" | "amber" | "red" | "blue" | "gray"> = {
  HELD: "amber",
  READY: "blue",
  PENDING: "blue",
  IN_TRANSIT: "blue",
  PAID: "green",
  FAILED: "red",
  REVERSED: "red",
  CANCELLED: "gray",
  MANUAL_REVIEW: "red",
};

const BLOCKER_LABEL: Record<string, string> = {
  supplier_account_not_found: "Supplier account not found",
  supplier_suspended: "Supplier is suspended",
  supplier_restricted: "Supplier is restricted",
  supplier_closed: "Supplier account is closed",
  stripe_charges_disabled: "Supplier's Stripe charges capability is disabled",
  stripe_payouts_disabled: "Supplier's Stripe payouts capability is disabled",
  fulfilment_not_completed: "Fulfilment is not yet marked completed",
  dispute_or_refund_exposure: "Open dispute or refund exposure on this campaign's captured holds",
};

function money(amountMinor: number, currency: string): string {
  return `${currency} ${(amountMinor / 100).toLocaleString("en-GB", { minimumFractionDigits: 2 })}`;
}

type ModalAction = { kind: "mark-ready" | "hold" | "release"; campaignId: string };

function EligibilityPanel({ campaignId }: { campaignId: string }) {
  const [result, setResult] = useState<PayoutEligibility | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    communityBuyAdminAPI
      .getCommunityBuyPayoutEligibility(campaignId)
      .then((r) => { if (!cancelled) setResult(r); })
      .catch((err) => { if (!cancelled) setError(err instanceof APIError ? err.message : "Could not check eligibility."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [campaignId]);

  if (loading) return <p className="text-xs text-slate-400">Checking eligibility...</p>;
  if (error) return <p className="text-xs text-red-600">{error}</p>;
  if (!result) return null;
  if (result.eligible) return <p className="text-xs font-semibold text-emerald-600">Eligible for release — no blockers found.</p>;
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold text-red-600">Not eligible for release:</p>
      <ul className="list-disc space-y-0.5 pl-4 text-xs text-red-500">
        {result.blockers.map((b) => <li key={b}>{BLOCKER_LABEL[b] ?? b}</li>)}
      </ul>
    </div>
  );
}

export default function CommunityBuyPayoutsPage() {
  const [payouts, setPayouts] = useState<AdminCommunityBuyPayout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyCampaignId, setBusyCampaignId] = useState<string | null>(null);
  const [expandedCampaignId, setExpandedCampaignId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const [pendingApprovalMessage, setPendingApprovalMessage] = useState("");

  const [modal, setModal] = useState<ModalAction | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [holdReason, setHoldReason] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      setPayouts(await communityBuyAdminAPI.getCommunityBuyPayouts());
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Could not load Community Buy payouts.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const applyUpdated = (updated: AdminCommunityBuyPayout) => {
    setPayouts((prev) => prev.map((p) => (p.campaignId === updated.campaignId ? updated : p)));
  };

  const closeModal = () => {
    setModal(null);
    setTwoFactorCode("");
    setHoldReason("");
  };

  const runAction = async () => {
    if (!modal) return;
    setBusyCampaignId(modal.campaignId);
    setActionError("");
    setPendingApprovalMessage("");
    try {
      if (modal.kind === "mark-ready") {
        applyUpdated(await communityBuyAdminAPI.markCommunityBuyPayoutReady(modal.campaignId, twoFactorCode || undefined));
      } else if (modal.kind === "hold") {
        if (!holdReason.trim()) { setActionError("A reason code is required to hold a payout."); return; }
        applyUpdated(await communityBuyAdminAPI.holdCommunityBuyPayout(modal.campaignId, holdReason.trim(), twoFactorCode || undefined));
      } else {
        const result = await communityBuyAdminAPI.releaseCommunityBuyPayout(modal.campaignId, twoFactorCode || undefined);
        if (isPendingCommunityBuyPayoutApproval(result)) {
          setPendingApprovalMessage(result.message);
        } else {
          applyUpdated(result.payout);
        }
      }
      closeModal();
    } catch (err) {
      setActionError(err instanceof APIError ? err.message : "This action could not be completed.");
    } finally {
      setBusyCampaignId(null);
    }
  };

  return (
    <ProtectedRoute>
      <AdminLayout>
        <div className="space-y-6">
          <PageHeader
            title="Direct Charge Payouts"
            subtitle="CommunityBuyPayout — governance for the M2 Stripe Connect Direct Charges flow. Under Direct Charges, a supplier's net share lands in their own connected account the instant a hold is captured; this screen governs the optional manual-payout step, which only moves real money if the connected account uses a manual Stripe payout schedule (an unresolved, explicitly-flagged external question)."
            actions={<Button variant="ghost" onClick={() => void load()}>Refresh</Button>}
          />

          {error ? <ErrorPanel message={error} onRetry={() => void load()} /> : null}
          {pendingApprovalMessage ? (
            <Card className="border-amber-200 bg-amber-50">
              <p className="text-sm font-semibold text-amber-800">{pendingApprovalMessage}</p>
            </Card>
          ) : null}

          {loading ? (
            <LoadingPanel label="Loading payouts..." />
          ) : payouts.length === 0 ? (
            <Card><p className="p-4 text-center text-sm text-slate-400">No Direct Charge payout records exist yet.</p></Card>
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead>
                    <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <th className="px-4 py-2">Campaign</th>
                      <th className="px-4 py-2">Status</th>
                      <th className="px-4 py-2">Net payout</th>
                      <th className="px-4 py-2">Eki fee</th>
                      <th className="px-4 py-2">Hold reasons</th>
                      <th className="px-4 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {payouts.map((p) => (
                      <Fragment key={p.id}>
                        <tr className="text-sm text-slate-700 align-top">
                          <td className="px-4 py-3">
                            <span className="font-semibold text-[#101820]">{p.campaign?.title ?? p.campaignId}</span>
                            <span className="block text-xs text-slate-400">{p.campaignId}</span>
                          </td>
                          <td className="px-4 py-3"><Badge tone={STATUS_TONE[p.status]}>{p.status}</Badge></td>
                          <td className="px-4 py-3 font-semibold">{money(p.netPayoutAmount, p.currency)}</td>
                          <td className="px-4 py-3">{money(p.ekiFeeAmount, p.currency)}</td>
                          <td className="px-4 py-3">
                            {p.holdReasonCodes.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {p.holdReasonCodes.map((code) => <Badge key={code} tone="amber">{code}</Badge>)}
                              </div>
                            ) : "—"}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-2">
                              <Button variant="ghost" className="!h-8 !px-3 !text-xs" onClick={() => setExpandedCampaignId(expandedCampaignId === p.campaignId ? null : p.campaignId)}>
                                {expandedCampaignId === p.campaignId ? "Hide eligibility" : "Check eligibility"}
                              </Button>
                              {p.status === "HELD" ? (
                                <Button variant="primary" disabled={busyCampaignId === p.campaignId} className="!h-8 !px-3 !text-xs" onClick={() => setModal({ kind: "mark-ready", campaignId: p.campaignId })}>Mark ready</Button>
                              ) : null}
                              {p.status !== "PAID" && p.status !== "CANCELLED" ? (
                                <Button variant="ghost" disabled={busyCampaignId === p.campaignId} className="!h-8 !px-3 !text-xs" onClick={() => setModal({ kind: "hold", campaignId: p.campaignId })}>Hold</Button>
                              ) : null}
                              {p.status === "READY" || p.status === "FAILED" ? (
                                <Button variant="primary" disabled={busyCampaignId === p.campaignId} className="!h-8 !px-3 !text-xs" onClick={() => setModal({ kind: "release", campaignId: p.campaignId })}>
                                  {p.status === "FAILED" ? "Retry release" : "Release"}
                                </Button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                        {expandedCampaignId === p.campaignId ? (
                          <tr>
                            <td colSpan={6} className="bg-slate-50 px-4 py-3">
                              <EligibilityPanel campaignId={p.campaignId} />
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>

        {modal ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4">
            <Card className="w-full max-w-md">
              <h3 className="text-xl font-black text-[#101820]">
                {modal.kind === "mark-ready" ? "Mark payout ready" : modal.kind === "hold" ? "Hold payout" : "Release payout"}
              </h3>
              <p className="mt-2 text-sm text-slate-500">
                {modal.kind === "release"
                  ? "This is the only action that can move real money, and only when the connected account's Stripe payout schedule has been confirmed as manual. Eligibility is re-verified server-side regardless of what this screen shows."
                  : modal.kind === "mark-ready"
                    ? "Confirms fulfilment is complete and there is no open dispute/refund exposure. Eligibility is re-verified server-side."
                    : "Holds this payout and records the reason code. Can be released again later once resolved."}
              </p>
              {modal.kind === "hold" ? (
                <input
                  value={holdReason}
                  onChange={(e) => setHoldReason(e.target.value)}
                  placeholder="Reason code (e.g. dispute_open)"
                  className="mt-3 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none"
                />
              ) : null}
              <input
                value={twoFactorCode}
                onChange={(e) => setTwoFactorCode(e.target.value)}
                placeholder="2FA code"
                className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none"
              />
              {actionError ? <p className="mt-2 text-sm text-red-600">{actionError}</p> : null}
              <div className="mt-4 flex gap-3">
                <button onClick={() => void runAction()} disabled={busyCampaignId === modal.campaignId} className="flex-1 rounded-xl bg-[#096B4A] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">
                  {busyCampaignId === modal.campaignId ? "Working..." : "Confirm"}
                </button>
                <button onClick={closeModal} className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600">Cancel</button>
              </div>
            </Card>
          </div>
        ) : null}
      </AdminLayout>
    </ProtectedRoute>
  );
}
