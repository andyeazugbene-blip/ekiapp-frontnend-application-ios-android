"use client";

import { useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Badge, Button, Card, ErrorPanel, Icon, LoadingPanel, MetricCard, PageHeader } from "@/components/AdminUI";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Banner, formatDate, useConfirm } from "@/components/AdminKit";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { APIError } from "@/lib/api";
import { communityBuyAdminAPI, type PendingOrganiser, type PendingSupplier } from "@/lib/services/communityBuy.api";
import { countryDisplayName } from "@/lib/countries";

export default function CommunityVerificationPage() {
  const [organisers, setOrganisers] = useState<PendingOrganiser[]>([]);
  const [suppliers, setSuppliers] = useState<PendingSupplier[]>([]);
  const [verifiedOrganisers, setVerifiedOrganisers] = useState<PendingOrganiser[]>([]);
  const [verifiedSuppliers, setVerifiedSuppliers] = useState<PendingSupplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const confirm = useConfirm();
  // Backend: lists = community_buy.read; verify / restrict / lift = community_buy.mutate.
  const { has, loading: permLoading } = usePermissions();
  const canMutate = has("community_buy.mutate");

  const load = async (bypassCache = false) => {
    try {
      bypassCache ? setRefreshing(true) : setLoading(true);
      setError("");
      const opts = bypassCache ? { bypassCache: true } : undefined;
      const [organiserList, supplierList, verifiedOrganiserList, verifiedSupplierList] = await Promise.all([
        communityBuyAdminAPI.getPendingOrganisers(opts),
        communityBuyAdminAPI.getPendingSuppliers(opts),
        communityBuyAdminAPI.getVerifiedOrganisers(opts),
        communityBuyAdminAPI.getVerifiedSuppliers(opts),
      ]);
      setOrganisers(organiserList);
      setSuppliers(supplierList);
      setVerifiedOrganisers(verifiedOrganiserList);
      setVerifiedSuppliers(verifiedSupplierList);
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Failed to load pending applications");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { void load(); }, []);

  // All actions run inside the confirm dialog so failures show there (no browser alerts).
  const done = async (message: string) => { setNotice(message); await load(true); };

  const askVerify = (kind: "organiser" | "supplier", id: string, name: string) => confirm.ask(
    {
      title: `Verify ${name}?`,
      tone: "primary",
      confirmLabel: "Verify",
      description: kind === "organiser"
        ? "They will be able to create and publish Community Buy campaigns."
        : "They will be able to accept Community Buy campaign invitations.",
      requireReason: false,
    },
    async () => {
      if (kind === "organiser") await communityBuyAdminAPI.verifyOrganiser(id);
      else await communityBuyAdminAPI.verifySupplier(id);
      await done(`${name} verified.`);
    },
  );

  const askRestrict = (kind: "organiser" | "supplier", id: string, name: string) => confirm.ask(
    {
      title: `Restrict ${name}?`,
      confirmLabel: "Restrict",
      description: `Stops this ${kind} from taking on new campaigns. Existing live campaigns are unaffected and verification is kept.`,
      reasonLabel: "Restriction reason (recorded in the audit log)",
    },
    async (reason) => {
      if (kind === "organiser") await communityBuyAdminAPI.restrictOrganiser(id, reason);
      else await communityBuyAdminAPI.restrictSupplier(id, reason);
      await done(`${name} restricted.`);
    },
  );

  const askLift = (kind: "organiser" | "supplier", id: string, name: string) => confirm.ask(
    {
      title: `Lift the restriction on ${name}?`,
      tone: "primary",
      confirmLabel: "Lift restriction",
      description: `They will be able to take on new campaigns again.`,
      requireReason: false,
    },
    async () => {
      if (kind === "organiser") await communityBuyAdminAPI.unrestrictOrganiser(id);
      else await communityBuyAdminAPI.unrestrictSupplier(id);
      await done(`Restriction on ${name} lifted.`);
    },
  );

  return (
    <ProtectedRoute>
      <AdminLayout>
        {loading ? <LoadingPanel label="Loading applications..." /> : (
          <div className="space-y-8">
            <PageHeader
              title="Organiser & supplier verification"
              subtitle="Community Buy roles are granted independently of buyer/vendor status — verify each application here."
              actions={<Button variant="ghost" disabled={refreshing} onClick={() => void load(true)}><Icon name="refresh" className="h-4 w-4" />{refreshing ? "Refreshing..." : "Refresh"}</Button>}
            />
            {error ? <ErrorPanel message={error} onRetry={() => void load()} /> : null}
            {notice ? <Banner tone="success">{notice}</Banner> : null}
            {!permLoading && !canMutate ? <Banner tone="info">Your role can view applications but cannot verify or restrict organisers and suppliers.</Banner> : null}

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
                          <p className="mt-1 text-xs text-slate-400">Applied {formatDate(o.createdAt)}</p>
                        </div>
                        {canMutate ? <Button onClick={() => askVerify("organiser", o.id, o.user?.name ?? "this organiser")}>Verify</Button> : null}
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
                          <p className="mt-1 text-xs text-slate-400">Applied {formatDate(s.createdAt)}</p>
                        </div>
                        {canMutate ? <Button onClick={() => askVerify("supplier", s.id, s.vendor?.storeName ?? "this supplier")}>Verify</Button> : null}
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
                            {canMutate ? <Button variant="secondary" onClick={() => askLift("organiser", o.id, o.user?.name ?? "this organiser")}>Lift restriction</Button> : null}
                          </div>
                        ) : canMutate ? (
                          <div className="mt-3 flex justify-end">
                            <Button variant="danger" onClick={() => askRestrict("organiser", o.id, o.user?.name ?? "this organiser")}>Restrict…</Button>
                          </div>
                        ) : null}
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
                            {canMutate ? <Button variant="secondary" onClick={() => askLift("supplier", s.id, s.vendor?.storeName ?? "this supplier")}>Lift restriction</Button> : null}
                          </div>
                        ) : canMutate ? (
                          <div className="mt-3 flex justify-end">
                            <Button variant="danger" onClick={() => askRestrict("supplier", s.id, s.vendor?.storeName ?? "this supplier")}>Restrict…</Button>
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          </div>
        )}
        {confirm.dialog}
      </AdminLayout>
    </ProtectedRoute>
  );
}
