"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Banner, KeyValue, formatDateTime } from "@/components/AdminKit";
import { Badge, Button, Card, ErrorPanel, PageHeader } from "@/components/AdminUI";
import { NoAccess, SkeletonRows } from "@/components/PageStates";
import ProtectedRoute from "@/components/ProtectedRoute";
import { APIError } from "@/lib/api";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { formatCoverage } from "@/lib/countries";
import { communityBuyAdminAPI, type SupplierAccountDetail } from "@/lib/services/communityBuy.api";
import { AccountBadge, ApplicationBadge, PayoutBadge, availableActions, useSupplierActions } from "../SupplierBits";

/** Handbook 14.11 supplier detail: application, account and payout status separately, with every allowed action. */
function Content() {
  const { id } = useParams<{ id: string }>();
  const { has, loading: permLoading } = usePermissions();
  const [detail, setDetail] = useState<SupplierAccountDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async (bypassCache = false) => {
    try {
      setLoading(true);
      setError("");
      setDetail(await communityBuyAdminAPI.getSupplierAccount(id, bypassCache ? { bypassCache: true } : undefined));
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Failed to load supplier account");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);
  const actions = useSupplierActions(async (message) => { setNotice(message); await load(true); });

  if (!permLoading && !has("community_buy.read")) return <NoAccess what="supplier accounts" />;
  if (loading && !detail) return <SkeletonRows count={6} />;
  if (error || !detail) return <ErrorPanel message={error || "Supplier account not found"} onRetry={() => void load()} />;

  const a = detail.account;
  const can = availableActions(a);
  const canMutate = has("community_buy.mutate");
  const perf = detail.performance;

  return (
    <div className="space-y-6">
      <Link href="/community-supplier-accounts" className="text-sm font-bold text-[#096B4A] hover:underline">&larr; Supplier accounts</Link>
      <PageHeader
        title={a.user?.name ?? "Supplier account"}
        subtitle={a.user?.email ?? "Email not provided"}
        actions={
          canMutate ? (
            <>
              {can.requestInfo && a.supplierState !== "INFORMATION_REQUIRED" ? <Button variant="ghost" onClick={() => actions.requestInfo(a)}>Request information</Button> : null}
              {can.approve ? <Button onClick={() => actions.approve(a)}>Approve</Button> : null}
              {can.reject ? <Button variant="danger" onClick={() => actions.reject(a)}>Reject</Button> : null}
              {can.unrestrict ? <Button variant="secondary" onClick={() => actions.unrestrict(a)}>Lift restriction</Button> : null}
              {can.unsuspend ? <Button variant="secondary" onClick={() => actions.unsuspend(a)}>Lift suspension</Button> : null}
            </>
          ) : null
        }
      />
      {notice ? <Banner tone="success">{notice}</Banner> : null}
      {a.reasonCode && ["INFORMATION_REQUIRED", "REJECTED", "RESTRICTED", "SUSPENDED", "CLOSED"].includes(a.supplierState) ? (
        <Banner tone="warning" title="Reason on file">{a.reasonCode}</Banner>
      ) : null}

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <p className="text-xs font-black uppercase tracking-wide text-slate-500">Application status</p>
          <div className="mt-2"><ApplicationBadge status={a.statuses?.application} /></div>
          <p className="mt-3 text-xs text-slate-500">Applied {formatDateTime(a.createdAt)}</p>
          {a.reviewedAt ? <p className="text-xs text-slate-500">Last decision {formatDateTime(a.reviewedAt)}</p> : null}
          <p className="text-xs text-slate-500">Terms accepted: {a.termsAcceptedAt ? formatDateTime(a.termsAcceptedAt) : a.legacySupplierProfileId ? "Verified under the legacy process" : "Not recorded"}</p>
        </Card>
        <Card>
          <p className="text-xs font-black uppercase tracking-wide text-slate-500">Account status</p>
          <div className="mt-2"><AccountBadge status={a.statuses?.account} /></div>
          {a.approvedAt ? <p className="mt-3 text-xs text-slate-500">Approved {formatDateTime(a.approvedAt)}</p> : null}
          {a.suspendedAt ? <p className="text-xs text-slate-500">Suspended {formatDateTime(a.suspendedAt)}</p> : null}
          {a.closedAt ? <p className="text-xs text-slate-500">Closed {formatDateTime(a.closedAt)} (history retained)</p> : null}
          {a.supplierState === "RESTRICTED" ? <p className="text-xs text-slate-500">Participant data access: {a.controlScope === "fulfilment_access_preserved" ? "preserved for existing campaigns" : "revoked"}</p> : null}
        </Card>
        <Card>
          <p className="text-xs font-black uppercase tracking-wide text-slate-500">Payout status</p>
          <div className="mt-2"><PayoutBadge status={a.statuses?.payout} /></div>
          <p className="mt-3 text-xs text-slate-500">Charges {a.chargesEnabled ? "enabled" : "not enabled"}, payouts {a.payoutsEnabled ? "enabled" : "not enabled"}</p>
          {a.stripeRequirementsDue?.length > 0 ? <p className="text-xs text-amber-700">Outstanding with the provider: {a.stripeRequirementsDue.join(", ")}</p> : null}
          <p className="text-xs text-slate-500">A supplier cannot be assigned to a campaign until payouts are ready.</p>
        </Card>
      </div>

      <Card>
        <h2 className="mb-4 text-xl font-black">Profile</h2>
        <KeyValue
          items={[
            { label: "Name", value: a.user?.name ?? "Not provided" },
            { label: "Email", value: a.user?.email ?? "Not provided" },
            { label: "Phone", value: a.user?.phone ?? "Not provided" },
            { label: "Categories", value: a.categories.length > 0 ? a.categories.join(", ") : "Not provided" },
            { label: "Coverage", value: formatCoverage(a.coverageRegions) },
            { label: "Collection areas", value: a.collectionAreas.length > 0 ? a.collectionAreas.join(", ") : "Not provided" },
            { label: "Collection capacity", value: a.collectionCapacityPerDay != null ? `${a.collectionCapacityPerDay} per day` : "Not provided" },
            { label: "Legacy link", value: a.legacySupplierProfileId ? <Badge tone="blue">Linked to a legacy vendor-backed supplier</Badge> : "None" },
          ]}
        />
      </Card>

      <Card>
        <h2 className="mb-4 text-xl font-black">Performance</h2>
        {!perf.available ? (
          <p className="text-sm text-slate-500">Not available - this supplier has not been assigned to any campaign yet.</p>
        ) : (
          <KeyValue
            items={[
              { label: "Campaigns assigned", value: perf.campaignsAssigned },
              { label: "Campaigns completed", value: perf.campaignsCompleted },
              { label: "Cancellations", value: perf.cancellations },
              { label: "Support cases / disputes", value: perf.disputes },
              { label: "On-time rate", value: perf.onTimeRate != null ? `${Math.round(perf.onTimeRate * 100)}%` : "Not available (no promised-vs-actual dispatch times are recorded)" },
            ]}
          />
        )}
      </Card>

      {detail.campaigns.length > 0 ? (
        <Card>
          <h2 className="mb-4 text-xl font-black">Assigned campaigns</h2>
          <ul className="divide-y divide-slate-100">
            {detail.campaigns.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <Link href={`/community-campaigns/${c.id}`} className="font-bold text-[#101820] hover:underline">{c.title}</Link>
                <span className="text-xs text-slate-500">{c.status.replace(/_/g, " ").toLowerCase()}{c.fulfilment ? ` - fulfilment ${c.fulfilment.status.replace(/_/g, " ").toLowerCase()}` : ""}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {canMutate && (can.restrict || can.suspend || can.revokeAccess || can.close) ? (
        <Card>
          <h2 className="text-xl font-black">Account controls</h2>
          <p className="mt-1 text-sm text-slate-500">Every control asks for a reason, is audited and notifies the supplier. Suspend, close and data-access revocation require 2FA.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            {can.restrict ? <Button variant="danger" onClick={() => actions.restrict(a)}>Restrict</Button> : null}
            {can.suspend && a.supplierState !== "SUSPENDED" ? <Button variant="danger" onClick={() => actions.suspend(a)}>Suspend</Button> : null}
            {can.revokeAccess ? <Button variant="ghost" onClick={() => actions.revokeAccess(a)}>Revoke data access now</Button> : null}
            {can.close ? <Button variant="danger" onClick={() => actions.close(a)}>Close Account</Button> : null}
          </div>
        </Card>
      ) : null}
      {actions.dialog}
    </div>
  );
}

export default function SupplierAccountDetailPage() {
  return (
    <ProtectedRoute>
      <AdminLayout>
        <Content />
      </AdminLayout>
    </ProtectedRoute>
  );
}
