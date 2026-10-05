"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AdminLayout from "@/components/AdminLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Badge, Button, Card, ErrorPanel, LoadingPanel, PageHeader, TextLink, TwoFactorModal } from "@/components/AdminUI";
import { Banner, DataTable, KeyValue, formatDateTime, formatMinor, timeAgo, type Column } from "@/components/AdminKit";
import { ProviderReadinessPanel } from "@/components/ProviderReadiness";
import { NotesCard, TimelineCard } from "@/components/NotesTimeline";
import { SuspendDialog } from "@/components/SuspendDialog";
import { APIError } from "@/lib/api";
import { countryDisplayName } from "@/lib/countries";
import { useTwoFactorAction } from "@/lib/hooks/useTwoFactorAction";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { peopleAPI, userState } from "@/lib/services/people.api";

const NA = "Not provided";

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const twoFactor = useTwoFactorAction();
  const { has } = usePermissions();
  const canSuspend = has("users.mutate");
  const canMessage = has("communications.send");
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"suspend" | "restore" | null>(null);

  const load = useCallback(async () => {
    try { setLoading(true); setError(""); setUser(await peopleAPI.getUser(id)); }
    catch (e) { setError(e instanceof APIError ? e.message : "Failed to load user"); }
    finally { setLoading(false); }
  }, [id]);
  useEffect(() => { void load(); }, [load]);

  if (loading && !user) return <ProtectedRoute><AdminLayout><LoadingPanel label="Loading user…" /></AdminLayout></ProtectedRoute>;
  if (error || !user) return <ProtectedRoute><AdminLayout><ErrorPanel message={error || "User not found"} onRetry={() => void load()} /></AdminLayout></ProtectedRoute>;

  const state = userState(user);
  const anonymised = state === "anonymised";
  const orderColumns: Column<any>[] = [
    { key: "n", header: "Order", render: (o) => <span className="font-black">{o.orderNumber}</span> },
    { key: "a", header: "Amount", render: (o) => formatMinor(o.totalAmount, o.currency) },
    { key: "s", header: "Status", render: (o) => <Badge tone={["COMPLETED", "DELIVERED"].includes(o.status) ? "green" : ["FAILED", "CANCELLED"].includes(o.status) ? "red" : "amber"}>{String(o.status).replace("_", " ")}</Badge> },
    { key: "d", header: "Date", render: (o) => formatDateTime(o.createdAt) },
  ];

  return (
    <ProtectedRoute>
      <AdminLayout>
        <div className="space-y-6">
          <PageHeader
            title={anonymised ? "Anonymised user" : user.name || "User"}
            subtitle={anonymised ? "Personal data has been removed. Only audit and financial history is retained." : user.email}
            actions={
              <>
                <Button variant="ghost" onClick={() => router.push("/users")}>← All users</Button>
                {!anonymised && canMessage ? <Button variant="secondary" onClick={() => router.push(`/communications?userId=${user.id}`)}>Send message</Button> : null}
                {!canSuspend || user.role === "ADMIN" || anonymised ? null : state === "suspended"
                  ? <Button onClick={() => setMode("restore")}>Restore account</Button>
                  : <Button variant="danger" onClick={() => setMode("suspend")}>Suspend account</Button>}
              </>
            }
          />

          {anonymised ? (
            <Banner tone="info" title="Anonymised account">This account was scrubbed. It cannot be suspended, restored or contacted.</Banner>
          ) : state === "suspended" ? (
            <Banner tone="danger" title="Account suspended">
              {user.suspendedReason ?? "No reason recorded"}
              {" · "}{user.suspendedAt ? formatDateTime(user.suspendedAt) : "date not recorded"}
              {user.suspendedByName ? ` · by ${user.suspendedByName}` : ""}
              {user.suspendedUntil ? ` · ends ${formatDateTime(user.suspendedUntil)}` : " · no end date"}
              {user.suspensionEvidence ? <span className="mt-1 block text-xs">Evidence: {user.suspensionEvidence}</span> : null}
            </Banner>
          ) : null}
          {twoFactor.error ? <Banner tone="danger">{twoFactor.error}</Banner> : null}

          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={user.role === "ADMIN" ? "blue" : user.role === "VENDOR" ? "green" : "gray"}>{user.role}</Badge>
            <Badge tone={anonymised ? "gray" : state === "suspended" ? "red" : "green"}>{anonymised ? "Anonymised" : state === "suspended" ? "Suspended" : "Active"}</Badge>
            {user.isTest ? <Badge tone="amber">TEST RECORD</Badge> : null}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <h3 className="mb-4 text-lg font-black text-[#101820]">Profile</h3>
              <KeyValue items={[
                { label: "Name", value: anonymised ? "Removed" : user.name || NA },
                { label: "Email", value: anonymised ? "Removed" : user.email || NA },
                { label: "Email verified", value: user.emailVerifiedAt ? formatDateTime(user.emailVerifiedAt) : "Not verified" },
                { label: "Phone", value: anonymised ? "Removed" : user.phone || NA },
                { label: "Country", value: user.country ? countryDisplayName(user.country) : NA },
                { label: "User ID", value: <span className="font-mono text-xs">{user.id}</span> },
              ]} />
            </Card>
            <Card>
              <h3 className="mb-4 text-lg font-black text-[#101820]">Activity</h3>
              <KeyValue items={[
                { label: "Joined", value: formatDateTime(user.createdAt) },
                { label: "Last active", value: user.lastActiveAt ? `${timeAgo(user.lastActiveAt)} (${formatDateTime(user.lastActiveAt)})` : "Not tracked yet" },
                { label: "Orders as buyer", value: String(user.orderCount ?? 0) },
                { label: "Support", value: user.supportConversationId ? <TextLink href={`/support-messages/${user.supportConversationId}`}>Open conversation →</TextLink> : "No conversation started" },
                { label: "Audit trail", value: <TextLink href={`/activity-logs?entityType=User&entityId=${user.id}`}>View all entries →</TextLink> },
              ]} />
            </Card>
          </div>

          <Card>
            <h3 className="mb-2 text-lg font-black text-[#101820]">Trust score: {typeof user.trustScore === "number" ? user.trustScore : NA}</h3>
            <p className="text-sm text-slate-600">
              A 0-100 payment-risk signal (starts at 50). It rises with successfully completed escrow orders and falls with order problems and disputes raised against the account.
              Below 20 the account is limited to card payments; below 10 its orders go to manual review. It is read-only here and does not suspend anyone by itself.
            </p>
          </Card>

          {user.vendor ? (
            <>
              <Card>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-lg font-black text-[#101820]">Store: {user.vendor.storeName}</h3>
                  <TextLink href={`/vendors/${user.vendor.id}`}>Open full vendor workspace →</TextLink>
                </div>
                <div className="mb-4 flex flex-wrap gap-2">
                  <Badge tone={user.vendor.verificationStatus === "VERIFIED" ? "green" : user.vendor.verificationStatus === "REJECTED" ? "red" : "amber"}>Identity: {user.vendor.verificationStatus === "REJECTED" ? "needs retry" : String(user.vendor.verificationStatus).toLowerCase()}</Badge>
                  <Badge tone={user.vendor.isSuspended ? "red" : "green"}>Store {user.vendor.isSuspended ? "suspended" : "active"}</Badge>
                </div>
              </Card>
              <ProviderReadinessPanel vendorId={user.vendor.id} />
            </>
          ) : null}

          {user.organiserProfile || user.supplierAccount ? (
            <div className="grid gap-6 lg:grid-cols-2">
              {user.organiserProfile ? (
                <Card>
                  <h3 className="mb-3 text-lg font-black text-[#101820]">Community Buy organiser</h3>
                  <KeyValue items={[
                    { label: "Verified", value: user.organiserProfile.isVerified ? "Yes" : "No" },
                    { label: "Restricted", value: user.organiserProfile.isRestricted ? "Yes" : "No" },
                    { label: "Market", value: user.organiserProfile.country ? countryDisplayName(user.organiserProfile.country) : NA },
                  ]} />
                </Card>
              ) : null}
              {user.supplierAccount ? (
                <Card>
                  <h3 className="mb-3 text-lg font-black text-[#101820]">Supplier account</h3>
                  <KeyValue items={[
                    { label: "State", value: String(user.supplierAccount.supplierState ?? "").replace(/_/g, " ") || NA },
                    { label: "Charges enabled", value: user.supplierAccount.chargesEnabled ? "Yes" : "No" },
                  ]} />
                  <div className="mt-3"><TextLink href={`/community-supplier-accounts?userId=${user.id}`}>Open supplier accounts →</TextLink></div>
                </Card>
              ) : null}
            </div>
          ) : null}

          <Card>
            <h3 className="mb-3 text-lg font-black text-[#101820]">Recent orders (as buyer)</h3>
            <DataTable columns={orderColumns} rows={user.recentOrders ?? []} rowKey={(o) => o.id} onRowClick={(o) => router.push(`/orders/${o.id}`)} emptyTitle="No orders as a buyer" />
            {(user.orderCount ?? 0) > (user.recentOrders?.length ?? 0) ? (
              <p className="mt-2 text-xs text-slate-400">Showing the {user.recentOrders?.length} most recent of {user.orderCount}.</p>
            ) : null}
          </Card>

          {!anonymised ? (
            <div className="grid gap-6 xl:grid-cols-2">
              <NotesCard kind="users" id={user.id} />
              <TimelineCard kind="users" id={user.id} />
            </div>
          ) : <TimelineCard kind="users" id={user.id} />}

          <SuspendDialog
            open={mode !== null} mode={mode ?? "suspend"} subject={user.name || user.email} onCancel={() => setMode(null)}
            onSubmit={async (values) => {
              await twoFactor.run(async (code) => {
                if (mode === "suspend") await peopleAPI.suspendUser(user.id, values, code);
                else await peopleAPI.unsuspendUser(user.id, { reason: values.reason, notifyUser: values.notifyUser }, code);
                setMode(null);
                await load();
              });
            }}
          />
          <TwoFactorModal
            open={twoFactor.show2FAModal} code={twoFactor.code} onCodeChange={twoFactor.setCode}
            onSubmit={() => void twoFactor.submit2FA()} onCancel={twoFactor.cancel2FA} loading={twoFactor.loading} error={twoFactor.error}
          />
        </div>
      </AdminLayout>
    </ProtectedRoute>
  );
}

