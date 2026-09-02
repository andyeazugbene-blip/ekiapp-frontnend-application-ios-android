"use client";

import { useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Badge, Button, Card, ErrorPanel, LoadingPanel, MetricCard, PageHeader } from "@/components/AdminUI";
import ProtectedRoute from "@/components/ProtectedRoute";
import { APIError } from "@/lib/api";
import { communityBuyAdminAPI, type AdminCampaign, type CampaignStatus } from "@/lib/services/communityBuy.api";

function centsToUnit(value: unknown): number {
  return typeof value === "number" ? value / 100 : 0;
}

const CLOSED_STATUS_TONE: Record<CampaignStatus, "green" | "amber" | "red" | "blue" | "gray"> = {
  DRAFT: "gray", UNDER_REVIEW: "amber", CHANGES_REQUIRED: "amber", APPROVED: "blue", REJECTED: "red",
  LIVE: "blue", PAUSED: "gray", SUCCEEDED: "green", FAILED: "amber", FULFILLING: "blue", CANCELLED: "red",
};

const CLOSED_STATUS_LABEL: Record<CampaignStatus, string> = {
  DRAFT: "Draft", UNDER_REVIEW: "Under review", CHANGES_REQUIRED: "Changes requested", APPROVED: "Approved",
  REJECTED: "Rejected", LIVE: "Live", PAUSED: "Paused", SUCCEEDED: "Succeeded", FAILED: "Target not reached",
  FULFILLING: "Proceeding (target not reached)", CANCELLED: "Cancelled",
};

export default function CommunityCampaignsPage() {
  const [items, setItems] = useState<AdminCampaign[]>([]);
  const [closed, setClosed] = useState<AdminCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notesById, setNotesById] = useState<Record<string, string>>({});

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const [review, recentlyClosed] = await Promise.all([
        communityBuyAdminAPI.getCampaignsForReview(),
        communityBuyAdminAPI.getRecentlyClosedCampaigns(),
      ]);
      setItems(review);
      setClosed(recentlyClosed);
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

  return (
    <ProtectedRoute>
      <AdminLayout>
        {loading ? <LoadingPanel label="Loading campaigns..." /> : (
          <div className="space-y-8">
            <PageHeader title="Community Buy review" subtitle="Campaigns submitted by organisers, waiting for approval before they go live." />
            {error ? <ErrorPanel message={error} onRetry={() => void load()} /> : null}

            <div className="grid gap-6 md:grid-cols-2">
              <MetricCard icon="clock" label="Under review" value={items.length} tone="amber" />
              <MetricCard icon="warning" label="Awaiting organiser decision" value={closed.filter((c) => c.status === "FAILED").length} tone="amber" />
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
                        <p>Supplier: <span className="font-semibold text-[#101820]">{c.supplier?.vendor?.storeName ?? "Unknown"}</span></p>
                        <p>Target: <span className="font-semibold text-[#101820]">{centsToUnit(c.targetAmount).toFixed(2)} {c.currency}</span></p>
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
              <h2 className="text-2xl font-black">Recently closed</h2>
              <p className="mt-1 text-sm text-slate-500">Campaigns that reached their deadline, plus the organiser&apos;s decision for any that missed target.</p>
              {closed.length === 0 ? (
                <p className="mt-8 text-slate-500">No campaigns have closed yet.</p>
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
                        <p>Target: <span className="font-semibold text-[#101820]">{centsToUnit(c.targetAmount).toFixed(2)} {c.currency}</span></p>
                        <p>Raised: <span className="font-semibold text-[#101820]">{centsToUnit(c.paidTotal).toFixed(2)} {c.currency}</span></p>
                      </div>
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
