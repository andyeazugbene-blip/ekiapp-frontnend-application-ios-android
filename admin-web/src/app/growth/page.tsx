"use client";

import { useCallback, useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Badge, Button, Card, ErrorPanel, LoadingPanel, PageHeader } from "@/components/AdminUI";
import { Banner, formatDateTime, useConfirm } from "@/components/AdminKit";
import ProtectedRoute from "@/components/ProtectedRoute";
import { APIError, apiClient } from "@/lib/api";
import { usePermissions } from "@/lib/hooks/usePermissions";

interface ReferralCredits {
  needed: number;
  due: { referrerId: string; referrer: string; qualified: number }[];
  credits: { id: string; status: "QUALIFIED" | "RELEASED" | "REVERSED"; referrer: string; referred: string; qualifiedAt: string | null; reversalReason: string | null; isTest: boolean }[];
}

interface FirstSaleRow {
  id: string;
  store: string;
  isTest: boolean;
  status: "ACTIVE" | "COMPLETED" | "STOPPED";
  buyersMessaged: number;
  startedAt: string | null;
  escalatedAt: string | null;
}

const TONE = { QUALIFIED: "amber", RELEASED: "green", REVERSED: "red", ACTIVE: "blue", COMPLETED: "green", STOPPED: "gray" } as const;

function Growth() {
  const { has } = usePermissions();
  const canEdit = has("subscriptions.mutate");
  const confirm = useConfirm();
  const [referrals, setReferrals] = useState<ReferralCredits | null>(null);
  const [campaigns, setCampaigns] = useState<FirstSaleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const [credits, firstSale] = await Promise.all([
        apiClient.get<ReferralCredits>("/admin/growth/referral-credits", { bypassCache: true }),
        apiClient.get<{ items: FirstSaleRow[] }>("/admin/growth/first-sale-campaigns", { bypassCache: true }),
      ]);
      setReferrals(credits);
      setCampaigns(firstSale.items);
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Failed to load growth programmes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <PageHeader title="Growth programmes" subtitle="First Sale Campaigns and vendor referral credits. Limits are in Settings, under Launch decisions." />
      {loading ? <LoadingPanel label="Loading growth programmes..." /> : null}
      {error ? <ErrorPanel message={error} onRetry={() => void load()} /> : null}
      {notice ? <Banner tone="success">{notice}</Banner> : null}

      {referrals ? (
        <Card>
          <h2 className="text-xl font-black">Referral credits</h2>
          <p className="mt-1 text-sm text-slate-500">{referrals.needed} qualified paying vendors earn a credit. Releasing one adds it to the vendor&apos;s next Stripe invoice. It is never paid out as cash.</p>
          {referrals.due.length > 0 ? (
            <div className="mt-4 space-y-2">
              {referrals.due.map((d) => (
                <div key={d.referrerId} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
                  <p className="font-bold">{d.referrer}: {d.qualified} qualified</p>
                  {canEdit ? (
                    <Button onClick={() => confirm.ask(
                      { title: `Release a credit to ${d.referrer}?`, description: "This adds a real credit to their Stripe balance.", confirmLabel: "Release credit", tone: "primary" },
                      async (reason) => {
                        await apiClient.post("/admin/growth/referral-credits/release", { referrerId: d.referrerId, reason });
                        setNotice(`Credit released to ${d.referrer}.`);
                        await load();
                      },
                    )}>Release credit</Button>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
          <div className="mt-4 divide-y divide-slate-100 text-sm">
            {referrals.credits.length === 0 ? <p className="py-3 text-slate-500">No qualified referrals yet.</p> : null}
            {referrals.credits.map((c) => (
              <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-bold">{c.referrer} invited {c.referred}{c.isTest ? " (demo)" : ""}</p>
                  <p className="text-xs text-slate-500">{c.qualifiedAt ? `Qualified ${formatDateTime(c.qualifiedAt)}` : c.reversalReason ? `Not credited: ${c.reversalReason.replace(/_/g, " ")}` : ""}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge tone={TONE[c.status]}>{c.status.toLowerCase()}</Badge>
                  {canEdit && c.status !== "REVERSED" ? (
                    <Button variant="ghost" onClick={() => confirm.ask(
                      { title: "Reverse this referral?", description: c.status === "RELEASED" ? "Its share of the credit is taken back on the vendor's next invoice." : "It no longer counts towards a credit.", confirmLabel: "Reverse" },
                      async (reason) => {
                        await apiClient.post(`/admin/growth/referral-credits/${c.id}/reverse`, { reason });
                        setNotice("Referral reversed.");
                        await load();
                      },
                    )}>Reverse</Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      <Card>
        <h2 className="text-xl font-black">First Sale Campaigns</h2>
        <div className="mt-4 divide-y divide-slate-100 text-sm">
          {!loading && campaigns.length === 0 ? <p className="py-3 text-slate-500">No campaigns have started yet.</p> : null}
          {campaigns.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <p className="font-bold">{c.store}{c.isTest ? " (demo)" : ""}</p>
                <p className="text-xs text-slate-500">
                  {c.startedAt ? `Started ${formatDateTime(c.startedAt)}. ` : ""}{c.buyersMessaged} buyers told.{c.escalatedAt ? " Checkouts aren't completing: needs a look." : ""}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Badge tone={c.escalatedAt && c.status === "ACTIVE" ? "red" : TONE[c.status]}>{c.status.toLowerCase()}</Badge>
                {canEdit && c.status === "ACTIVE" ? (
                  <Button variant="ghost" onClick={() => confirm.ask(
                    { title: `Stop ${c.store}'s campaign?`, confirmLabel: "Stop campaign" },
                    async (reason) => {
                      await apiClient.post(`/admin/growth/first-sale-campaigns/${c.id}/stop`, { reason });
                      setNotice("Campaign stopped.");
                      await load();
                    },
                  )}>Stop</Button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </Card>
      {confirm.dialog}
    </div>
  );
}

export default function GrowthPage() {
  return (
    <ProtectedRoute>
      <AdminLayout>
        <Growth />
      </AdminLayout>
    </ProtectedRoute>
  );
}
