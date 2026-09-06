"use client";

import { useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Badge, Button, Card, ErrorPanel, LoadingPanel, MetricCard, PageHeader } from "@/components/AdminUI";
import ProtectedRoute from "@/components/ProtectedRoute";
import { APIError } from "@/lib/api";
import { communityBuyAdminAPI, type PendingOrganiser, type PendingSupplier } from "@/lib/services/communityBuy.api";
import { countryDisplayName } from "@/lib/countries";

export default function CommunityVerificationPage() {
  const [organisers, setOrganisers] = useState<PendingOrganiser[]>([]);
  const [suppliers, setSuppliers] = useState<PendingSupplier[]>([]);
  const [verifiedOrganisers, setVerifiedOrganisers] = useState<PendingOrganiser[]>([]);
  const [verifiedSuppliers, setVerifiedSuppliers] = useState<PendingSupplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [restrictReasonById, setRestrictReasonById] = useState<Record<string, string>>({});

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const [organiserList, supplierList, verifiedOrganiserList, verifiedSupplierList] = await Promise.all([
        communityBuyAdminAPI.getPendingOrganisers(),
        communityBuyAdminAPI.getPendingSuppliers(),
        communityBuyAdminAPI.getVerifiedOrganisers(),
        communityBuyAdminAPI.getVerifiedSuppliers(),
      ]);
      setOrganisers(organiserList);
      setSuppliers(supplierList);
      setVerifiedOrganisers(verifiedOrganiserList);
      setVerifiedSuppliers(verifiedSupplierList);
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

  const restrictOrganiser = async (id: string) => {
    const reason = restrictReasonById[id]?.trim();
    if (!reason) return;
    setBusyId(id);
    try {
      await communityBuyAdminAPI.restrictOrganiser(id, reason);
      setRestrictReasonById((prev) => ({ ...prev, [id]: "" }));
      await load();
    } catch (err) {
      alert(err instanceof APIError ? err.message : "Failed to restrict organiser");
    } finally {
      setBusyId(null);
    }
  };

  const unrestrictOrganiser = async (id: string) => {
    setBusyId(id);
    try {
      await communityBuyAdminAPI.unrestrictOrganiser(id);
      await load();
    } catch (err) {
      alert(err instanceof APIError ? err.message : "Failed to lift restriction");
    } finally {
      setBusyId(null);
    }
  };

  const restrictSupplier = async (id: string) => {
    const reason = restrictReasonById[id]?.trim();
    if (!reason) return;
    setBusyId(id);
    try {
      await communityBuyAdminAPI.restrictSupplier(id, reason);
      setRestrictReasonById((prev) => ({ ...prev, [id]: "" }));
      await load();
    } catch (err) {
      alert(err instanceof APIError ? err.message : "Failed to restrict supplier");
    } finally {
      setBusyId(null);
    }
  };

  const unrestrictSupplier = async (id: string) => {
    setBusyId(id);
    try {
      await communityBuyAdminAPI.unrestrictSupplier(id);
      await load();
    } catch (err) {
      alert(err instanceof APIError ? err.message : "Failed to lift restriction");
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
                          <p className="text-xs text-slate-500">{o.user?.email} · <Badge tone="gray">{countryDisplayName(o.country)}</Badge></p>
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
                            {" "}· <Badge tone="gray">{countryDisplayName(s.country)}</Badge>
                          </p>
                        </div>
                        <Button disabled={busyId === s.id} onClick={() => void verifySupplier(s.id)}>Verify</Button>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>

            <div>
              <h2 className="text-2xl font-black text-[#101820]">Risk controls</h2>
              <p className="mt-1 text-sm text-slate-500">Restrict a verified organiser or supplier from taking on new campaigns without revoking their verification. Existing live campaigns are unaffected.</p>
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <Card>
                <h3 className="text-xl font-black">Verified organisers</h3>
                {verifiedOrganisers.length === 0 ? (
                  <p className="mt-6 text-slate-500">No verified organisers yet.</p>
                ) : (
                  <div className="mt-6 space-y-3">
                    {verifiedOrganisers.map((o) => (
                      <div key={o.id} className="rounded-xl border border-slate-200 p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-bold text-[#101820]">{o.user?.name ?? "Unknown"}</p>
                            <p className="text-xs text-slate-500">{o.user?.email} · <Badge tone="gray">{countryDisplayName(o.country)}</Badge></p>
                          </div>
                          {o.isRestricted ? <Badge tone="red">Restricted</Badge> : <Badge tone="green">Active</Badge>}
                        </div>
                        {o.isRestricted ? (
                          <div className="mt-3 flex items-center justify-between gap-3">
                            {o.restrictedReason ? <p className="text-xs text-slate-500">Reason: {o.restrictedReason}</p> : <span />}
                            <Button variant="secondary" disabled={busyId === o.id} onClick={() => void unrestrictOrganiser(o.id)}>Lift restriction</Button>
                          </div>
                        ) : (
                          <div className="mt-3 flex flex-wrap items-center gap-3">
                            <input
                              placeholder="Restriction reason"
                              value={restrictReasonById[o.id] ?? ""}
                              onChange={(e) => setRestrictReasonById((prev) => ({ ...prev, [o.id]: e.target.value }))}
                              className="flex-1 rounded-xl border border-slate-200 p-2 text-sm"
                            />
                            <Button variant="danger" disabled={busyId === o.id || !restrictReasonById[o.id]?.trim()} onClick={() => void restrictOrganiser(o.id)}>Restrict</Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              <Card>
                <h3 className="text-xl font-black">Verified suppliers</h3>
                {verifiedSuppliers.length === 0 ? (
                  <p className="mt-6 text-slate-500">No verified suppliers yet.</p>
                ) : (
                  <div className="mt-6 space-y-3">
                    {verifiedSuppliers.map((s) => (
                      <div key={s.id} className="rounded-xl border border-slate-200 p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-bold text-[#101820]">{s.vendor?.storeName ?? "Unknown store"}</p>
                            <p className="text-xs text-slate-500"><Badge tone="gray">{countryDisplayName(s.country)}</Badge></p>
                          </div>
                          {s.isRestricted ? <Badge tone="red">Restricted</Badge> : <Badge tone="green">Active</Badge>}
                        </div>
                        {s.isRestricted ? (
                          <div className="mt-3 flex items-center justify-between gap-3">
                            {s.restrictedReason ? <p className="text-xs text-slate-500">Reason: {s.restrictedReason}</p> : <span />}
                            <Button variant="secondary" disabled={busyId === s.id} onClick={() => void unrestrictSupplier(s.id)}>Lift restriction</Button>
                          </div>
                        ) : (
                          <div className="mt-3 flex flex-wrap items-center gap-3">
                            <input
                              placeholder="Restriction reason"
                              value={restrictReasonById[s.id] ?? ""}
                              onChange={(e) => setRestrictReasonById((prev) => ({ ...prev, [s.id]: e.target.value }))}
                              className="flex-1 rounded-xl border border-slate-200 p-2 text-sm"
                            />
                            <Button variant="danger" disabled={busyId === s.id || !restrictReasonById[s.id]?.trim()} onClick={() => void restrictSupplier(s.id)}>Restrict</Button>
                          </div>
                        )}
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
