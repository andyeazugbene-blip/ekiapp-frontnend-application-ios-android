"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AdminLayout from "@/components/AdminLayout";
import { Badge, Button, Card, ErrorPanel, Icon, LoadingPanel, MetricCard, PageHeader } from "@/components/AdminUI";
import ProtectedRoute from "@/components/ProtectedRoute";
import { APIError } from "@/lib/api";
import { disputesAPI } from "@/lib/services/disputes.api";
import { Dispute } from "@/types";

export default function DisputesPage() {
  const router = useRouter();
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const loadDisputes = async () => {
    try {
      setLoading(true);
      setError("");
      setDisputes(await disputesAPI.getDisputes());
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Failed to load disputes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDisputes();
  }, []);

  const summary = useMemo(() => {
    const open = disputes.filter((d) => !d.resolvedAt && d.status.toLowerCase() !== "resolved");
    return {
      open: open.length,
      urgent: open.filter((d) => d.status.toLowerCase().includes("urgent") || d.reason.toLowerCase().includes("not received")).length,
      awaiting: open.filter((d) => d.status.toLowerCase().includes("await")).length || open.length,
      hold: open.filter((d) => d.refundAmount && d.refundAmount > 0).length,
      ready: open.filter((d) => d.status.toLowerCase().includes("ready")).length,
    };
  }, [disputes]);

  const resolve = async (dispute: Dispute, resolution: "buyer" | "vendor") => {
    if (!confirm(`Resolve this dispute for the ${resolution}?`)) return;
    try {
      setResolvingId(dispute.id);
      await disputesAPI.resolveDispute(dispute.id, { resolution, note: `Resolved for ${resolution} from admin resolution centre.` });
      await loadDisputes();
    } catch (err) {
      alert(err instanceof APIError ? err.message : "Failed to resolve dispute");
    } finally {
      setResolvingId(null);
    }
  };

  return (
    <ProtectedRoute>
      <AdminLayout>
        {loading ? <LoadingPanel label="Loading disputes..." /> : (
          <div className="space-y-8">
            <PageHeader title="Disputes" subtitle="Manage and resolve vendor and buyer disputes." actions={<><Button variant="ghost" disabled><Icon name="settings" /> Filters</Button><Button variant="ghost" disabled><Icon name="calendar" /> Last 30 days</Button></>} />
            {error ? <ErrorPanel message={error} onRetry={() => void loadDisputes()} /> : null}

            <div>
              <h2 className="text-2xl font-black">Reported issues</h2>
              <div className="mt-6 grid gap-6 md:grid-cols-3">
                <MetricCard icon="disputes" label="Disputes" value={summary.open} tone="green" />
                <MetricCard icon="disputes" label="Urgent" value={summary.urgent.toString().padStart(2, "0")} tone="red" />
                <MetricCard icon="clock" label="Awaiting" value={summary.awaiting.toString().padStart(2, "0")} tone="amber" />
              </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
              <Card>
                <h2 className="text-2xl font-black">Dispute queue</h2>
                {disputes.length === 0 ? (
                  <p className="mt-8 text-slate-500">No disputes found. All clear.</p>
                ) : (
                  <div className="mt-6 space-y-5">
                    {disputes.slice(0, 8).map((dispute) => (
                      <div key={dispute.id} className="rounded-2xl border border-slate-200 p-5 cursor-pointer transition hover:border-[#096B4A] hover:bg-emerald-50/20" onClick={() => router.push(`/disputes/${dispute.id}`)}>
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                          <Badge tone="green">Order #{dispute.order?.orderNumber || dispute.orderId.slice(0, 8)}</Badge>
                          <span className="text-sm text-slate-500">{dispute.createdAt ? new Date(dispute.createdAt).toLocaleString() : ""}</span>
                        </div>
                        <div className="mt-6 grid gap-4 md:grid-cols-[0.25fr_1fr_auto] md:items-center">
                          <div className="space-y-3 text-sm text-slate-500"><p>Buyer:</p><p>Issue:</p><p>Status:</p></div>
                          <div className="space-y-3 text-sm font-semibold text-[#101820]"><p>{dispute.buyerId || "Unknown buyer"}</p><p>{dispute.reason || "No reason provided"}</p><p><StatusBadge status={dispute.status} /></p></div>
                          <div className="flex flex-wrap gap-3" onClick={(e) => e.stopPropagation()}>
                            <Button variant="secondary" onClick={() => router.push(`/disputes/${dispute.id}`)}>View Details →</Button>
                            <Button disabled={resolvingId === dispute.id} onClick={() => void resolve(dispute, "buyer")}>Release payment</Button>
                            <Button variant="danger" disabled={resolvingId === dispute.id} onClick={() => void resolve(dispute, "vendor")}>Hold payment</Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              <Card>
                <h2 className="text-2xl font-black">Payment decision summary</h2>
                <DecisionCard icon="settings" label="Payments on hold" value={summary.hold.toString().padStart(2, "0")} />
                <DecisionCard icon="arrow" label="Ready for release" value={summary.ready.toString().padStart(2, "0")} />
              </Card>
            </div>
          </div>
        )}
      </AdminLayout>
    </ProtectedRoute>
  );
}

function StatusBadge({ status }: { status: string }) {
  const value = status.toLowerCase();
  if (value.includes("resolved") || value.includes("ready")) return <Badge tone="green">{status}</Badge>;
  if (value.includes("investigation") || value.includes("urgent")) return <Badge tone="red">{status}</Badge>;
  return <Badge tone="amber">{status || "Awaiting review"}</Badge>;
}

function DecisionCard({ icon, label, value }: { icon: string; label: string; value: string }) {
  return <div className="mt-6 rounded-2xl bg-slate-50 p-7"><div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-[#096B4A]"><Icon name={icon} className="h-8 w-8" /></div><p className="mt-8 text-lg">{label}</p><p className="mt-5 text-4xl font-black">{value}</p><p className="mt-6 font-bold text-[#096B4A]">View details</p></div>;
}
