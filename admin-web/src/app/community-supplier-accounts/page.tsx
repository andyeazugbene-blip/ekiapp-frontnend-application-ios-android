"use client";

import { useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Badge, Button, Card, ErrorPanel, Icon, LoadingPanel, MetricCard, PageHeader } from "@/components/AdminUI";
import ProtectedRoute from "@/components/ProtectedRoute";
import { APIError } from "@/lib/api";
import { communityBuyAdminAPI, type AdminSupplierAccount } from "@/lib/services/communityBuy.api";
import { countryDisplayName } from "@/lib/countries";

/**
 * Workstream 3 — SupplierAccount review (Set B). Approve/restrict/
 * unrestrict routes have existed backend-side since Workstream 1
 * (community-buy.controller.ts's own comment: "Backend-only for now; an
 * admin-web review screen is Workstream 3") — this is that screen. Distinct
 * from /community-verification, which reviews the legacy Vendor-keyed
 * SupplierProfile; every verified legacy supplier also appears here via
 * its synced account (supplierAccountService.syncSupplierAccountForProfile),
 * tagged "Legacy-linked" below.
 */

const REVIEW_QUEUE_STATES = ["UNDER_REVIEW", "INFORMATION_REQUIRED"] as const;

function stateTone(state: AdminSupplierAccount["supplierState"]): "green" | "amber" | "red" | "blue" | "gray" {
  switch (state) {
    case "APPROVED": return "green";
    case "UNDER_REVIEW":
    case "INFORMATION_REQUIRED":
    case "VERIFICATION_REQUIRED":
      return "amber";
    case "RESTRICTED":
    case "SUSPENDED":
      return "red";
    case "PAUSED": return "blue";
    default: return "gray";
  }
}

function regionList(regions: string[]): string {
  if (regions.length === 0) return "No coverage set";
  return regions.map((r) => countryDisplayName(r)).join(", ");
}

export default function CommunitySupplierAccountsPage() {
  const [accounts, setAccounts] = useState<AdminSupplierAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [restrictReasonById, setRestrictReasonById] = useState<Record<string, string>>({});

  const load = async (bypassCache = false) => {
    try {
      bypassCache ? setRefreshing(true) : setLoading(true);
      setError("");
      setAccounts(await communityBuyAdminAPI.getSupplierAccounts(undefined, bypassCache ? { bypassCache: true } : undefined));
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Failed to load supplier accounts");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const approve = async (id: string) => {
    if (!confirm("Approve this supplier account? They will be selectable for new Community Buy campaigns.")) return;
    setBusyId(id);
    try {
      await communityBuyAdminAPI.approveSupplierAccount(id);
      await load();
    } catch (err) {
      alert(err instanceof APIError ? err.message : "Failed to approve supplier account");
    } finally {
      setBusyId(null);
    }
  };

  const restrict = async (id: string) => {
    const reason = restrictReasonById[id]?.trim();
    if (!reason) return;
    if (!confirm("Restrict this supplier from taking on new campaigns? Existing commitments are unaffected.")) return;
    setBusyId(id);
    try {
      await communityBuyAdminAPI.restrictSupplierAccount(id, reason);
      setRestrictReasonById((prev) => ({ ...prev, [id]: "" }));
      await load();
    } catch (err) {
      alert(err instanceof APIError ? err.message : "Failed to restrict supplier account");
    } finally {
      setBusyId(null);
    }
  };

  const unrestrict = async (id: string) => {
    if (!confirm("Lift this restriction? The account returns to its prior approved/under-review state.")) return;
    setBusyId(id);
    try {
      await communityBuyAdminAPI.unrestrictSupplierAccount(id);
      await load();
    } catch (err) {
      alert(err instanceof APIError ? err.message : "Failed to lift restriction");
    } finally {
      setBusyId(null);
    }
  };

  const queue = accounts.filter((a) => (REVIEW_QUEUE_STATES as readonly string[]).includes(a.supplierState));
  const rest = accounts.filter((a) => !(REVIEW_QUEUE_STATES as readonly string[]).includes(a.supplierState));

  return (
    <ProtectedRoute>
      <AdminLayout>
        {loading ? <LoadingPanel label="Loading supplier accounts..." /> : (
          <div className="space-y-8">
            <PageHeader
              title="Supplier accounts"
              subtitle="The no-Vendor-required supplier capability — categories, coverage, Stripe Connect payout readiness, and approval, independent of any retail store."
              actions={<Button variant="ghost" disabled={refreshing} onClick={() => void load(true)}><Icon name="refresh" className="h-4 w-4" />{refreshing ? "Refreshing..." : "Refresh"}</Button>}
            />
            {error ? <ErrorPanel message={error} onRetry={() => void load()} /> : null}

            <div className="grid gap-6 md:grid-cols-3">
              <MetricCard icon="user" label="Awaiting review" value={queue.length} tone="amber" />
              <MetricCard icon="vendors" label="Approved" value={accounts.filter((a) => a.supplierState === "APPROVED").length} tone="green" />
              <MetricCard icon="vendors" label="Restricted / suspended" value={accounts.filter((a) => a.supplierState === "RESTRICTED" || a.supplierState === "SUSPENDED").length} tone="red" />
            </div>

            <Card>
              <h2 className="text-2xl font-black">Review queue</h2>
              {queue.length === 0 ? (
                <p className="mt-6 text-slate-500">No applications awaiting review.</p>
              ) : (
                <div className="mt-6 space-y-3">
                  {queue.map((a) => (
                    <div key={a.id} className="rounded-xl border border-slate-200 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold text-[#101820]">{a.user?.name ?? "Unknown"}</p>
                          <p className="text-xs text-slate-500">{a.user?.email}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {a.legacySupplierProfileId ? <Badge tone="blue">Legacy-linked</Badge> : null}
                          <Badge tone={stateTone(a.supplierState)}>{a.supplierState.replace(/_/g, " ")}</Badge>
                        </div>
                      </div>
                      <div className="mt-3 grid gap-1 text-xs text-slate-500">
                        <p>Categories: {a.categories.length > 0 ? a.categories.join(", ") : "None listed"}</p>
                        <p>Coverage: {regionList(a.coverageRegions)}</p>
                        {a.supplierState === "INFORMATION_REQUIRED" && a.reasonCode ? (
                          <p className="text-amber-700">Requested: {a.reasonCode}</p>
                        ) : null}
                        <p>Applied {new Date(a.createdAt).toLocaleDateString()}</p>
                      </div>
                      <div className="mt-3 flex justify-end">
                        <Button disabled={busyId === a.id} onClick={() => void approve(a.id)}>Approve</Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card>
              <h2 className="text-2xl font-black">All supplier accounts</h2>
              {rest.length === 0 ? (
                <p className="mt-6 text-slate-500">No other supplier accounts yet.</p>
              ) : (
                <div className="mt-6 space-y-3">
                  {rest.map((a) => (
                    <div key={a.id} className="rounded-xl border border-slate-200 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold text-[#101820]">{a.user?.name ?? "Unknown"}</p>
                          <p className="text-xs text-slate-500">{a.user?.email}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {a.legacySupplierProfileId ? <Badge tone="blue">Legacy-linked</Badge> : null}
                          <Badge tone={stateTone(a.supplierState)}>{a.supplierState.replace(/_/g, " ")}</Badge>
                        </div>
                      </div>
                      <div className="mt-3 grid gap-1 text-xs text-slate-500">
                        <p>Categories: {a.categories.length > 0 ? a.categories.join(", ") : "None listed"}</p>
                        <p>Coverage: {regionList(a.coverageRegions)}</p>
                        <p>Payouts: {a.payoutsEnabled ? "Stripe Connect ready" : "Not yet enabled"}{a.providerConnectedAccountId ? "" : " — onboarding not started"}</p>
                        {a.reasonCode ? <p>Reason on file: {a.reasonCode}</p> : null}
                      </div>
                      {a.supplierState === "RESTRICTED" || a.supplierState === "SUSPENDED" ? (
                        <div className="mt-3 flex justify-end">
                          <Button variant="secondary" disabled={busyId === a.id} onClick={() => void unrestrict(a.id)}>Lift restriction</Button>
                        </div>
                      ) : a.supplierState === "APPROVED" || a.supplierState === "PAUSED" ? (
                        <div className="mt-3 flex flex-wrap items-center justify-end gap-3">
                          <input
                            placeholder="Restriction reason"
                            value={restrictReasonById[a.id] ?? ""}
                            onChange={(e) => setRestrictReasonById((prev) => ({ ...prev, [a.id]: e.target.value }))}
                            className="flex-1 rounded-xl border border-slate-200 p-2 text-sm"
                          />
                          <Button variant="danger" disabled={busyId === a.id || !restrictReasonById[a.id]?.trim()} onClick={() => void restrict(a.id)}>Restrict</Button>
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
