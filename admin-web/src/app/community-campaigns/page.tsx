"use client";

import { useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Badge, Button, Card, ErrorPanel, LoadingPanel, MetricCard, PageHeader } from "@/components/AdminUI";
import ProtectedRoute from "@/components/ProtectedRoute";
import { APIError } from "@/lib/api";
import { communityBuyAdminAPI, type AdminCampaign, type AdminExtensionRequest, type AdminSupplierPayment, type CampaignStatus } from "@/lib/services/communityBuy.api";

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

export default function CommunityCampaignsPage() {
  const [items, setItems] = useState<AdminCampaign[]>([]);
  const [closed, setClosed] = useState<AdminCampaign[]>([]);
  const [extensionRequests, setExtensionRequests] = useState<AdminExtensionRequest[]>([]);
  const [supplierPayments, setSupplierPayments] = useState<AdminSupplierPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notesById, setNotesById] = useState<Record<string, string>>({});
  const [holdReasonById, setHoldReasonById] = useState<Record<string, string>>({});

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const [review, recentlyClosed, pendingExtensions, payments] = await Promise.all([
        communityBuyAdminAPI.getCampaignsForReview(),
        communityBuyAdminAPI.getRecentlyClosedCampaigns(),
        communityBuyAdminAPI.getExtensionRequests(),
        communityBuyAdminAPI.getSupplierPayments(),
      ]);
      setItems(review);
      setClosed(recentlyClosed);
      setExtensionRequests(pendingExtensions);
      setSupplierPayments(payments);
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Failed to load campaigns");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

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

  return (
    <ProtectedRoute>
      <AdminLayout>
        {loading ? <LoadingPanel label="Loading campaigns..." /> : (
          <div className="space-y-8">
            <PageHeader title="Community Buy review" subtitle="Campaigns submitted by organisers, waiting for approval before they go live." />
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
                        <Badge tone="amber">{c.country}</Badge>
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
                        <Button disabled={busyId === c.id} onClick={() => void runAction(c.id, () => communityBuyAdminAPI.approveCampaign(c.id))}>Approve</Button>
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
                        <span className="text-sm text-slate-500">{c.country}</span>
                      </div>
                      <h3 className="mt-3 text-base font-bold text-[#101820]">{c.title}</h3>
                      <div className="mt-2 grid gap-1 text-sm text-slate-600 md:grid-cols-3">
                        <p>Organiser: <span className="font-semibold text-[#101820]">{c.organiser?.user?.name ?? "Unknown"}</span></p>
                        <p>Confirmed shares: <span className="font-semibold text-[#101820]">{c.confirmedShares} of {c.maximumShares} (minimum {c.minimumShares})</span></p>
                        <p>Funding outcome: <span className="font-semibold text-[#101820]">{c.fundingOutcome}</span></p>
                      </div>
                      {c.status === "LIVE" || c.status === "PAUSED" ? (
                        <div className="mt-4 border-t border-slate-100 pt-4">
                          {c.status === "LIVE" ? (
                            <Button
                              variant="danger"
                              disabled={busyId === c.id}
                              onClick={() => void runAction(c.id, () => communityBuyAdminAPI.pauseCampaign(c.id))}
                            >
                              Pause new contributions
                            </Button>
                          ) : (
                            <Button
                              variant="secondary"
                              disabled={busyId === c.id}
                              onClick={() => void runAction(c.id, () => communityBuyAdminAPI.resumeCampaign(c.id))}
                            >
                              Resume contributions
                            </Button>
                          )}
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
                      </div>
                      <p className="mt-2 text-sm text-slate-600">Reason: {req.reason}</p>
                      <div className="mt-4 flex flex-wrap gap-3">
                        <Button
                          disabled={busyId === req.id || !req.supplierReconfirmed || !req.priceUnchangedConfirmed}
                          onClick={() => void runExtensionAction(req.id, () => communityBuyAdminAPI.approveExtension(req.id))}
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
                        <Badge tone={p.status === "PAID" ? "green" : p.status === "ON_HOLD" || p.status === "FAILED" ? "red" : "amber"}>{p.status.replace("_", " ")}</Badge>
                      </div>
                      <div className="mt-2 grid gap-1 text-sm text-slate-600 md:grid-cols-2">
                        <p>Amount: <span className="font-semibold text-[#101820]">{centsToUnit(p.amount).toFixed(2)} {p.currency}</span></p>
                        <p>Final quantity: <span className="font-semibold text-[#101820]">{p.campaign?.confirmedShares ?? "—"}</span></p>
                        {p.holdReason ? <p className="md:col-span-2">Hold reason: <span className="font-semibold text-[#101820]">{p.holdReason}</span></p> : null}
                      </div>
                      {p.status !== "PAID" ? (
                        <div className="mt-4 flex flex-wrap items-center gap-3">
                          <Button
                            disabled={busyId === p.id}
                            onClick={() => void runPaymentAction(p.id, () => communityBuyAdminAPI.releaseSupplierPayment(p.campaignId))}
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
                            onClick={() => void runPaymentAction(p.id, () => communityBuyAdminAPI.holdSupplierPayment(p.campaignId, holdReasonById[p.id]!.trim()))}
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
