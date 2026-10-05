"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import AdminLayout from "@/components/AdminLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Badge, Button, Card, ErrorPanel, LoadingPanel, PageHeader, downloadCsv } from "@/components/AdminUI";
import {
  Banner, DataTable, FilterSelect, Pagination, QueueTile, SearchInput, formatDate, formatMinor, type Column,
} from "@/components/AdminKit";
import { ProviderSummary } from "@/components/ProviderReadiness";
import { SuspendDialog } from "@/components/SuspendDialog";
import { TwoFactorModal } from "@/components/AdminUI";
import { APIError } from "@/lib/api";
import { useTwoFactorAction } from "@/lib/hooks/useTwoFactorAction";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { peopleAPI, type VendorRow, type VendorStatsResult } from "@/lib/services/people.api";
import { vendorsAPI } from "@/lib/services/vendors.api";
import { countryDisplayName } from "@/lib/countries";

const VERIFICATION_OPTIONS = [
  { value: "", label: "Any verification" },
  { value: "PENDING", label: "Verification pending" },
  { value: "VERIFIED", label: "Identity verified" },
  { value: "REJECTED", label: "Needs retry / rejected" },
];
const PAYMENT_OPTIONS = [
  { value: "", label: "Any payment readiness" },
  { value: "ready", label: "Charges + payouts on" },
  { value: "not_ready", label: "Payment not ready" },
];
const ACCOUNT_OPTIONS = [
  { value: "", label: "Any account state" },
  { value: "false", label: "Active" },
  { value: "true", label: "Suspended / closed" },
];
const SUBSCRIPTION_OPTIONS = [
  { value: "", label: "Any subscription" },
  { value: "GROWTH", label: "Growth" },
  { value: "PRO", label: "Pro" },
  { value: "FREE", label: "Legacy free (no trial)" },
  { value: "NONE", label: "No subscription record" },
];

function accountBadge(v: VendorRow) {
  if (v.closedAt) return <Badge tone="gray">Closed</Badge>;
  if (v.isSuspended) return <Badge tone="red">Suspended</Badge>;
  return <Badge tone="green">Active</Badge>;
}

function subscriptionBadge(v: VendorRow) {
  const days = v.trialEndsAt ? Math.max(0, Math.ceil((new Date(v.trialEndsAt).getTime() - Date.now()) / 86_400_000)) : 0;
  switch (v.subscriptionLifecycle) {
    case "TRIAL_ACTIVE": return <Badge tone="blue">14-day trial · {days}d left</Badge>;
    case "TRIAL_ENDING": return <Badge tone="amber">Trial ending · {days}d left</Badge>;
    case "TRIAL_EXPIRED": return <Badge tone="red">Trial expired, not converted</Badge>;
    case "PAID_ACTIVE": return <Badge tone="green">Paid · {(v.subscriptionPlan ?? "").toLowerCase()}</Badge>;
    case "PAYMENT_FAILED": return <Badge tone="red">Payment failed</Badge>;
    case "CANCELLED": return <Badge tone="gray">Cancelled</Badge>;
    case "EXPIRED": return <Badge tone="gray">Checkout expired</Badge>;
    default: return <Badge tone="gray">{v.subscriptionPlan === "FREE" ? "Legacy free (no trial)" : "No record"}</Badge>;
  }
}

function VendorsInner() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const q = params.get("q") ?? "";
  const status = params.get("status") ?? "";
  const payment = params.get("payment") ?? "";
  const suspended = params.get("suspended") ?? "";
  const subscription = params.get("subscription") ?? "";
  const country = params.get("country") ?? "";
  const includeTest = params.get("includeTest") === "true";

  const setParams = useCallback((patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) { if (v == null || v === "") next.delete(k); else next.set(k, v); }
    router.replace(`${pathname}?${next.toString()}`);
  }, [params, pathname, router]);

  const [rows, setRows] = useState<VendorRow[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [stats, setStats] = useState<VendorStatsResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cursor, setCursor] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const cursorStack = useRef<Array<string | null>>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [suspendTarget, setSuspendTarget] = useState<{ ids: string[]; label: string; mode: "suspend" | "restore" } | null>(null);
  const [notice, setNotice] = useState("");
  const twoFactor = useTwoFactorAction();
  // Backend: invite, suspend, restore and bulk actions all need vendors.mutate.
  const canMutate = usePermissions().has("vendors.mutate");

  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteMsg, setInviteMsg] = useState("");

  const filterKey = `${q}|${status}|${payment}|${suspended}|${subscription}|${country}|${includeTest}`;
  useEffect(() => { cursorStack.current = []; setCursor(null); setSelected(new Set()); }, [filterKey]);

  const load = useCallback(async () => {
    try {
      setLoading(true); setError("");
      const [list, st] = await Promise.all([
        peopleAPI.listVendors({ q, status, payment, suspended, subscription, country, includeTest, cursor }),
        peopleAPI.vendorStats().catch(() => null),
      ]);
      setRows(list.items); setNextCursor(list.nextCursor); setTotal(list.total); setStats(st);
    } catch (e) {
      setError(e instanceof APIError ? e.message : "Failed to load vendors");
    } finally { setLoading(false); }
  }, [q, status, payment, suspended, subscription, country, includeTest, cursor]);
  useEffect(() => { void load(); }, [load]);

  const submitSuspend = async (values: { reason: string; evidence?: string; durationDays?: number; notifyUser: boolean }) => {
    if (!suspendTarget) return;
    const target = suspendTarget;
    await twoFactor.run(async (code) => {
      if (target.mode === "suspend") {
        if (target.ids.length === 1) await peopleAPI.suspendVendor(target.ids[0], values, code);
        else {
          const res = await peopleAPI.bulkSuspendVendors(target.ids, values, code);
          const failed = res.results.filter((r) => !r.ok);
          setNotice(`${res.affected} vendor(s) suspended${failed.length ? `, ${failed.length} skipped (${failed[0].error})` : ""}.`);
        }
      } else {
        await peopleAPI.unsuspendVendor(target.ids[0], { reason: values.reason, notifyUser: values.notifyUser }, code);
      }
      setSuspendTarget(null); setSelected(new Set());
      await load();
    });
  };

  const sendInvite = async () => {
    try {
      setInviteBusy(true); setInviteMsg("");
      await vendorsAPI.inviteVendor(inviteEmail.trim());
      setInviteMsg("Invitation sent."); setInviteEmail("");
    } catch (e) {
      setInviteMsg(e instanceof APIError ? e.message : "Could not send invitation");
    } finally { setInviteBusy(false); }
  };

  const columns: Column<VendorRow>[] = [
    ...(canMutate ? [{
      key: "sel", header: "", className: "w-8",
      render: (r) => (
        <input
          type="checkbox" aria-label={`Select ${r.storeName}`} className="h-4 w-4 accent-[#096B4A]"
          checked={selected.has(r.id)} disabled={Boolean(r.closedAt)}
          onClick={(e) => e.stopPropagation()}
          onChange={() => setSelected((s) => { const n = new Set(s); if (n.has(r.id)) n.delete(r.id); else n.add(r.id); return n; })}
        />
      ),
    } as Column<VendorRow>] : []),
    {
      key: "vendor", header: "Vendor",
      render: (r) => (
        <div className="min-w-[180px]">
          <p className="font-black text-slate-900">{r.storeName}{r.isTest ? <span className="ml-2 align-middle"><Badge tone="amber">TEST</Badge></span> : null}</p>
          <p className="text-xs font-semibold text-slate-500">{r.ownerName || "Owner not provided"} · {r.email ?? "No email"}</p>
          <p className="text-xs text-slate-400">{[r.city, r.country ? countryDisplayName(r.country) : null].filter(Boolean).join(", ") || "Location not provided"}</p>
        </div>
      ),
    },
    { key: "account", header: "Account", render: accountBadge },
    { key: "provider", header: "Stripe verification & payments", render: (r) => <ProviderSummary summary={r.provider} /> },
    { key: "sub", header: "Subscription", render: subscriptionBadge },
    { key: "orders", header: "Orders", render: (r) => <span className="font-bold">{r.orderCount}</span> },
    { key: "rev", header: "Revenue", render: (r) => <span className="font-semibold">{formatMinor(r.totalRevenue, r.currency)}</span> },
    { key: "joined", header: "Joined", render: (r) => <span className="text-xs font-semibold text-slate-600">{formatDate(r.createdAt)}</span> },
    {
      key: "act", header: "", className: "text-right",
      render: (r) => (
        <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" className="h-9 px-3" onClick={() => router.push(`/vendors/${r.id}`)}>View</Button>
          {!canMutate || r.closedAt ? null : r.isSuspended ? (
            <Button variant="secondary" className="h-9 px-3" onClick={() => setSuspendTarget({ ids: [r.id], label: r.storeName, mode: "restore" })}>Restore</Button>
          ) : (
            <Button variant="ghost" className="h-9 px-3 text-red-600" onClick={() => setSuspendTarget({ ids: [r.id], label: r.storeName, mode: "suspend" })}>Suspend</Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Vendors"
        subtitle="Approval, identity verification, account state, subscription and payment readiness are separate facts - never combined into one 'approved' flag."
        actions={
          <>
            <Button variant="ghost" onClick={() => downloadCsv("vendors.csv", rows.map((r) => ({
              store: r.storeName, owner: r.ownerName, email: r.email ?? "", country: r.country ?? "", account: r.closedAt ? "closed" : r.isSuspended ? "suspended" : "active",
              verification: r.verificationStatus, stripe_stage: r.provider.stage, charges: r.provider.chargesEnabled, payouts: r.provider.payoutsEnabled,
              subscription: r.subscriptionPlan ?? "none", orders: r.orderCount, joined: r.createdAt,
            })))}>Export page (CSV)</Button>
            {canMutate ? <Button onClick={() => setShowInvite((v) => !v)}>Invite vendor</Button> : null}
          </>
        }
      />

      {showInvite ? (
        <Card className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} type="email" placeholder="vendor@example.com" aria-label="Vendor email"
            className="h-11 flex-1 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-[#096B4A]"
          />
          <Button disabled={inviteBusy || !inviteEmail.includes("@")} onClick={() => void sendInvite()}>{inviteBusy ? "Sending…" : "Send invite"}</Button>
          {inviteMsg ? <span className="text-sm font-semibold text-slate-600">{inviteMsg}</span> : null}
        </Card>
      ) : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <QueueTile label="Total vendors" value={stats?.total ?? "—"} unavailable={!stats} hint="All records" href="/vendors" tone="gray" />
        <QueueTile label="Approved & active" value={stats?.approved ?? "—"} unavailable={!stats} hint="Identity verified, not suspended" href="/vendors?status=VERIFIED&suspended=false" tone="green" />
        <QueueTile label="Verification pending" value={stats?.pending ?? "—"} unavailable={!stats} hint="Waiting on Stripe or vendor" href="/vendors?status=PENDING" tone="amber" />
        <QueueTile label="Needs retry" value={stats?.rejected ?? "—"} unavailable={!stats} hint="Stripe needs more input" href="/vendors?status=REJECTED" tone="amber" />
        <QueueTile label="Suspended" value={stats?.suspended ?? "—"} unavailable={!stats} hint="Incl. closed" href="/vendors?suspended=true" tone="red" />
        <QueueTile label="Payment ready" value={stats?.paymentReady ?? "—"} unavailable={!stats} hint="Charges and payouts on" href="/vendors?payment=ready" tone="blue" />
      </div>

      {notice ? <Banner tone="success">{notice}</Banner> : null}
      {twoFactor.error ? <Banner tone="danger">{twoFactor.error}</Banner> : null}
      {error ? <ErrorPanel message={error} onRetry={() => void load()} /> : null}

      <Card className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
          <SearchInput value={q} onChange={(v) => setParams({ q: v })} placeholder="Search store, owner, email, city or ID" />
          <FilterSelect label="Verification" value={status} onChange={(v) => setParams({ status: v })} options={VERIFICATION_OPTIONS} />
          <FilterSelect label="Payment readiness" value={payment} onChange={(v) => setParams({ payment: v })} options={PAYMENT_OPTIONS} />
          <FilterSelect label="Account" value={suspended} onChange={(v) => setParams({ suspended: v })} options={ACCOUNT_OPTIONS} />
          <FilterSelect label="Subscription" value={subscription} onChange={(v) => setParams({ subscription: v })} options={SUBSCRIPTION_OPTIONS} />
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-600">
            <input type="checkbox" checked={includeTest} onChange={(e) => setParams({ includeTest: e.target.checked ? "true" : null })} className="h-4 w-4 accent-[#096B4A]" />
            Include test records
          </label>
        </div>

        {selected.size > 0 ? (
          <div className="flex flex-wrap items-center gap-3 rounded-xl bg-slate-50 px-4 py-2 text-sm font-semibold">
            <span>{selected.size} selected</span>
            <Button variant="danger" className="h-9 px-4" onClick={() => setSuspendTarget({ ids: [...selected], label: `${selected.size} vendors`, mode: "suspend" })}>Suspend…</Button>
            <Button variant="ghost" className="h-9 px-4" onClick={() => setSelected(new Set())}>Clear</Button>
          </div>
        ) : null}

        {loading && rows.length === 0 ? <LoadingPanel label="Loading vendors…" /> : (
          <>
            <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} onRowClick={(r) => router.push(`/vendors/${r.id}`)} loading={loading} emptyTitle="No vendors match these filters" />
            <Pagination
              hasPrev={cursorStack.current.length > 0} hasNext={Boolean(nextCursor)} shown={rows.length} total={total} loading={loading}
              onPrev={() => { const prev = cursorStack.current.pop() ?? null; setCursor(prev); }}
              onNext={() => { cursorStack.current.push(cursor); setCursor(nextCursor); }}
            />
          </>
        )}
      </Card>

      <SuspendDialog
        open={Boolean(suspendTarget)} mode={suspendTarget?.mode ?? "suspend"} subject={suspendTarget?.label ?? ""}
        onSubmit={submitSuspend} onCancel={() => setSuspendTarget(null)}
      />
      <TwoFactorModal
        open={twoFactor.show2FAModal} code={twoFactor.code} onCodeChange={twoFactor.setCode}
        onSubmit={() => void twoFactor.submit2FA()} onCancel={twoFactor.cancel2FA} loading={twoFactor.loading} error={twoFactor.error}
      />
    </div>
  );
}

export default function VendorsPage() {
  return (
    <ProtectedRoute>
      <AdminLayout>
        <Suspense fallback={<LoadingPanel label="Loading vendors…" />}>
          <VendorsInner />
        </Suspense>
      </AdminLayout>
    </ProtectedRoute>
  );
}
