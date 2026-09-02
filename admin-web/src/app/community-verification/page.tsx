"use client";

import { useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Badge, Button, Card, ErrorPanel, LoadingPanel, MetricCard, PageHeader } from "@/components/AdminUI";
import ProtectedRoute from "@/components/ProtectedRoute";
import { APIError } from "@/lib/api";
import { communityBuyAdminAPI, type PendingOrganiser, type PendingSupplier } from "@/lib/services/communityBuy.api";

export default function CommunityVerificationPage() {
  const [organisers, setOrganisers] = useState<PendingOrganiser[]>([]);
  const [suppliers, setSuppliers] = useState<PendingSupplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const [organiserList, supplierList] = await Promise.all([
        communityBuyAdminAPI.getPendingOrganisers(),
        communityBuyAdminAPI.getPendingSuppliers(),
      ]);
      setOrganisers(organiserList);
      setSuppliers(supplierList);
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Failed to load pending applications");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const verifyOrganiser = async (id: string) => {
    setBusyId(id);
    try {
      await communityBuyAdminAPI.verifyOrganiser(id);
      await load();
    } catch (err) {
      alert(err instanceof APIError ? err.message : "Failed to verify organiser");
    } finally {
      setBusyId(null);
    }
  };

  const verifySupplier = async (id: string) => {
    setBusyId(id);
    try {
      await communityBuyAdminAPI.verifySupplier(id);
      await load();
    } catch (err) {
      alert(err instanceof APIError ? err.message : "Failed to verify supplier");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <ProtectedRoute>
      <AdminLayout>
        {loading ? <LoadingPanel label="Loading applications..." /> : (
          <div className="space-y-8">
            <PageHeader title="Organiser & supplier verification" subtitle="Community Buy roles are granted independently of buyer/vendor status — verify each application here." />
            {error ? <ErrorPanel message={error} onRetry={() => void load()} /> : null}

            <div className="grid gap-6 md:grid-cols-2">
              <MetricCard icon="user" label="Pending organisers" value={organisers.length} tone="amber" />
              <MetricCard icon="vendors" label="Pending suppliers" value={suppliers.length} tone="amber" />
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <Card>
                <h2 className="text-2xl font-black">Organiser applications</h2>
                {organisers.length === 0 ? (
                  <p className="mt-6 text-slate-500">No pending organiser applications.</p>
                ) : (
                  <div className="mt-6 space-y-3">
                    {organisers.map((o) => (
                      <div key={o.id} className="flex items-center justify-between rounded-xl border border-slate-200 p-4">
                        <div>
                          <p className="text-sm font-bold text-[#101820]">{o.user?.name ?? "Unknown"}</p>
                          <p className="text-xs text-slate-500">{o.user?.email} · <Badge tone="gray">{o.country}</Badge></p>
                        </div>
                        <Button disabled={busyId === o.id} onClick={() => void verifyOrganiser(o.id)}>Verify</Button>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              <Card>
                <h2 className="text-2xl font-black">Supplier applications</h2>
                {suppliers.length === 0 ? (
                  <p className="mt-6 text-slate-500">No pending supplier applications.</p>
                ) : (
                  <div className="mt-6 space-y-3">
                    {suppliers.map((s) => (
                      <div key={s.id} className="flex items-center justify-between rounded-xl border border-slate-200 p-4">
                        <div>
                          <p className="text-sm font-bold text-[#101820]">{s.vendor?.storeName ?? "Unknown store"}</p>
                          <p className="text-xs text-slate-500">
                            <Badge tone={s.vendor?.verificationStatus === "VERIFIED" ? "green" : "amber"}>{s.vendor?.verificationStatus ?? "UNKNOWN"}</Badge>
                            {" "}· <Badge tone="gray">{s.country}</Badge>
                          </p>
                        </div>
                        <Button disabled={busyId === s.id} onClick={() => void verifySupplier(s.id)}>Verify</Button>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          </div>
        )}
      </AdminLayout>
    </ProtectedRoute>
  );
}
