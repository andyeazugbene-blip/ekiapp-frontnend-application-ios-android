"use client";

import { useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Badge, Button, Card, ErrorPanel, LoadingPanel, MetricCard, PageHeader } from "@/components/AdminUI";
import ProtectedRoute from "@/components/ProtectedRoute";
import { APIError } from "@/lib/api";
import { communityBuyAdminAPI, type AdminCampaignRefund } from "@/lib/services/communityBuy.api";

function centsToUnit(value: unknown): number {
  return typeof value === "number" ? value / 100 : 0;
}

function tone(status: AdminCampaignRefund["status"]): "green" | "amber" | "red" {
  if (status === "REFUNDED") return "green";
  if (status === "REFUND_FAILED") return "red";
  return "amber";
}

export default function CommunityRefundsPage() {
  const [items, setItems] = useState<AdminCampaignRefund[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      setItems(await communityBuyAdminAPI.getRefunds());
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Failed to load refunds");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const recheck = async (id: string) => {
    setBusyId(id);
    try {
      const updated = await communityBuyAdminAPI.requeryRefund(id);
      setItems((prev) => prev.map((r) => (r.id === id ? updated : r)));
    } catch (err) {
      alert(err instanceof APIError ? err.message : "Failed to recheck refund");
    } finally {
      setBusyId(null);
    }
  };

  const escalate = async (id: string) => {
    setBusyId(id);
    try {
      await communityBuyAdminAPI.escalateRefund(id);
      alert("Escalated — a support case has been opened for this refund.");
    } catch (err) {
      alert(err instanceof APIError ? err.message : "Failed to escalate refund");
    } finally {
      setBusyId(null);
    }
  };

  const pending = items.filter((i) => i.status === "REFUND_PENDING" || i.status === "REFUND_PROCESSING").length;
  const failed = items.filter((i) => i.status === "REFUND_FAILED").length;
  const completed = items.filter((i) => i.status === "REFUNDED").length;

  return (
    <ProtectedRoute>
      <AdminLayout>
        {loading ? <LoadingPanel label="Loading refunds..." /> : (
          <div className="space-y-8">
            <PageHeader title="Community Buy refunds" subtitle="Every refund record created when a campaign fails to reach its target." />
            {error ? <ErrorPanel message={error} onRetry={() => void load()} /> : null}

            <div className="grid gap-6 md:grid-cols-3">
              <MetricCard icon="clock" label="Pending / processing" value={pending} tone="amber" />
              <MetricCard icon="check" label="Completed" value={completed} tone="green" />
              <MetricCard icon="warning" label="Failed" value={failed} tone={failed > 0 ? "red" : "green"} />
            </div>

            <Card>
              <h2 className="text-2xl font-black">Refund records</h2>
              {items.length === 0 ? (
                <p className="mt-8 text-slate-500">No refunds have been created yet.</p>
              ) : (
                <div className="mt-6 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
                        <th className="pb-3">Campaign</th>
                        <th className="pb-3">Participant</th>
                        <th className="pb-3">Amount</th>
                        <th className="pb-3">Status</th>
                        <th className="pb-3">Created</th>
                        <th className="pb-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((r) => (
                        <tr key={r.id} className="border-b border-slate-100">
                          <td className="py-3 font-semibold text-[#101820]">{r.contribution.campaign.title} <span className="text-slate-400">({r.contribution.campaign.country})</span></td>
                          <td className="py-3 text-slate-600">{r.contribution.participant.user.name} <span className="text-slate-400">({r.contribution.participant.user.email})</span></td>
                          <td className="py-3 font-semibold">{centsToUnit(r.amount).toFixed(2)} {r.currency}</td>
                          <td className="py-3"><Badge tone={tone(r.status)}>{r.status.replace(/_/g, " ")}</Badge>{r.failureReason ? <p className="mt-1 text-xs text-red-500">{r.failureReason}</p> : null}</td>
                          <td className="py-3 text-slate-500">{new Date(r.createdAt).toLocaleString()}</td>
                          <td className="py-3">
                            {r.status !== "REFUNDED" ? (
                              <div className="flex gap-2">
                                <Button variant="ghost" disabled={busyId === r.id} onClick={() => void recheck(r.id)}>Recheck</Button>
                                <Button variant="ghost" disabled={busyId === r.id} onClick={() => void escalate(r.id)}>Escalate</Button>
                              </div>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        )}
      </AdminLayout>
    </ProtectedRoute>
  );
}
