"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AdminLayout from "@/components/AdminLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Badge, Button, Card, ErrorPanel, LoadingPanel, PageHeader, TextLink, TwoFactorModal } from "@/components/AdminUI";
import { Banner, ConfirmDialog, DataTable, KeyValue, formatDate, formatDateTime, formatMinor, useConfirm, type Column } from "@/components/AdminKit";
import { ProviderReadinessPanel } from "@/components/ProviderReadiness";
import { NotesCard, TimelineCard } from "@/components/NotesTimeline";
import { SuspendDialog } from "@/components/SuspendDialog";
import { APIError } from "@/lib/api";
import { COUNTRIES, countryDisplayName } from "@/lib/countries";
import { useTwoFactorAction } from "@/lib/hooks/useTwoFactorAction";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { peopleAPI, type CloseBlocker } from "@/lib/services/people.api";
import { vendorsAPI, type VendorMarket } from "@/lib/services/vendors.api";

const NA = "Not provided";

interface SubShape {
  plan: string; status: string; currentPeriodStart: string | null; currentPeriodEnd: string | null; cancelledAt: string | null;
  trialStartedAt?: string | null; trialEndsAt?: string | null;
  lifecycle?: string; inTrial?: boolean; trialDaysRemaining?: number; billingStarted?: boolean;
}

export default function VendorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [suspendMode, setSuspendMode] = useState<"suspend" | "restore" | null>(null);
  const [closeOpen, setCloseOpen] = useState(false);
  const [blockers, setBlockers] = useState<CloseBlocker[] | null>(null);
  const [closeError, setCloseError] = useState("");
  const [closeBusy, setCloseBusy] = useState(false);
  const twoFactor = useTwoFactorAction();
  const { has } = usePermissions();
  const canMutate = has("vendors.mutate");
  const canMessage = has("communications.send");
  const canAssignPlan = has("subscriptions.mutate");

  const load = useCallback(async () => {
    try { setLoading(true); setError(""); setData(await peopleAPI.getVendor(id)); }
    catch (e) { setError(e instanceof APIError ? e.message : "Could not load vendor"); }
    finally { setLoading(false); }
  }, [id]);
  useEffect(() => { void load(); }, [load]);

  const openClose = async () => {
    setCloseError(""); setBlockers(null); setCloseOpen(true);
    try { setBlockers((await peopleAPI.closeCheck(id)).blockers); }
    catch (e) { setCloseError(e instanceof APIError ? e.message : "Could not run pre-close checks"); }
  };

  const submitClose = async (reason: string) => {
    setCloseBusy(true); setCloseError("");
    await twoFactor.run(async (code) => {
      try {
        await peopleAPI.closeVendor(id, reason, code);
        setCloseOpen(false);
        await load();
      } catch (e) {
        if (e instanceof APIError && (e as any).details?.blockers) setBlockers((e as any).details.blockers);
        throw e;
      }
    });
    setCloseBusy(false);
  };

  if (loading && !data) return <ProtectedRoute><AdminLayout><LoadingPanel label="Loading vendor…" /></AdminLayout></ProtectedRoute>;
  if (error || !data) return <ProtectedRoute><AdminLayout><ErrorPanel message={error || "Vendor not found"} onRetry={() => void load()} /></AdminLayout></ProtectedRoute>;

  const closed = Boolean(data.closedAt);
  const sub = data.subscription as SubShape | null;
  const ownerUserId: string | undefined = data.user?.id ?? data.userId;
  const orderColumns: Column<any>[] = [
    { key: "n", header: "Order", render: (o) => <span className="font-black">{o.orderNumber}</span> },
    { key: "a", header: "Amount", render: (o) => formatMinor(o.totalAmount, o.currency) },
    { key: "s", header: "Status", render: (o) => <Badge tone={["COMPLETED", "DELIVERED"].includes(o.status) ? "green" : ["FAILED", "CANCELLED"].includes(o.status) ? "red" : "amber"}>{String(o.status).replace("_", " ")}</Badge> },
    { key: "d", header: "Date", render: (o) => formatDateTime(o.createdAt) },
  ];
  const productColumns: Column<any>[] = [
    { key: "t", header: "Product", render: (p) => <span className="font-bold">{p.title}</span> },
    { key: "p", header: "Price", render: (p) => formatMinor(p.priceInCents, p.currency) },
    { key: "s", header: "Stock", render: (p) => p.stock },
    { key: "a", header: "Status", render: (p) => <Badge tone={p.isActive ? "green" : "gray"}>{p.isActive ? "Active" : "Inactive"}</Badge> },
  ];

  return (
    <ProtectedRoute>
      <AdminLayout>
        <div className="space-y-6">
          <PageHeader
            title={data.storeName}
            subtitle={`${data.user?.name ?? "Owner not provided"} · ${data.contactEmail ?? data.user?.email ?? "No email"}`}
            actions={
              <>
                <Button variant="ghost" onClick={() => router.push("/vendors")}>← All vendors</Button>
                {ownerUserId && canMessage ? <Button variant="secondary" onClick={() => router.push(`/communications?userId=${ownerUserId}`)}>Send message</Button> : null}
                {closed || !canMutate ? null : data.isSuspended
                  ? <Button onClick={() => setSuspendMode("restore")}>Restore store</Button>
                  : <Button variant="danger" onClick={() => setSuspendMode("suspend")}>Suspend store</Button>}
                {closed || !canMutate ? null : <Button variant="ghost" onClick={() => void openClose()}>Close account…</Button>}
              </>
            }
          />

          {closed ? (
            <Banner tone="danger" title="This account is closed">Closed {formatDateTime(data.closedAt)}. Order, payout and audit history is kept; personal data was removed.</Banner>
          ) : data.isSuspended ? (
            <Banner tone="danger" title="Store suspended">
              {data.suspendedReason ?? "No reason recorded"}
              {" · "}{data.suspendedAt ? formatDateTime(data.suspendedAt) : "date not recorded"}
              {data.suspendedByName ? ` · by ${data.suspendedByName}` : ""}
              {data.suspendedUntil ? ` · ends ${formatDateTime(data.suspendedUntil)}` : " · no end date"}
              {data.suspensionEvidence ? <span className="mt-1 block text-xs">Evidence: {data.suspensionEvidence}</span> : null}
            </Banner>
          ) : null}
          {twoFactor.error ? <Banner tone="danger">{twoFactor.error}</Banner> : null}

          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={data.verificationStatus === "VERIFIED" ? "green" : data.verificationStatus === "REJECTED" ? "red" : "amber"}>Identity: {data.verificationStatus === "REJECTED" ? "needs retry" : String(data.verificationStatus).toLowerCase()}</Badge>
            <Badge tone={closed ? "gray" : data.isSuspended ? "red" : "green"}>Account: {closed ? "closed" : data.isSuspended ? "suspended" : "active"}</Badge>
            <Badge tone={sub ? "blue" : "gray"}>Subscription: {sub ? `${sub.plan.toLowerCase()} (${sub.status.toLowerCase().replace("_", " ")})` : "no record"}</Badge>
            <Badge tone={data.stripeChargesEnabled ? "green" : "amber"}>Charges {data.stripeChargesEnabled ? "on" : "off"}</Badge>
            <Badge tone={data.stripePayoutsEnabled ? "green" : "amber"}>Payouts {data.stripePayoutsEnabled ? "on" : "off"}</Badge>
            {data.isTest ? <Badge tone="amber">TEST RECORD</Badge> : null}
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Metric label="Products" value={data._count?.products ?? (data.products ?? []).length} />
            <Metric label="Orders (paid)" value={data.storeOrders ?? 0} hint={`${data.completedOrders ?? 0} completed`} />
            <Metric label="Rating" value={data.avgRating ? `${Number(data.avgRating).toFixed(1)}★` : "—"} hint={`${data.totalReviews ?? 0} reviews`} />
            <Metric label="Disputes" value={data.disputes?.total ?? 0} hint={`${data.disputes?.open ?? 0} open`} />
          </div>

          <Card>
            <h3 className="mb-3 text-lg font-black text-[#101820]">Gross sales (original currency)</h3>
            {(data.gmvByCurrency ?? []).length === 0 ? <p className="text-sm font-semibold text-slate-500">No paid orders yet.</p> : (
              <div className="flex flex-wrap gap-3">
                {data.gmvByCurrency.map((g: { currency: string; amount: number; orders: number }) => (
                  <div key={g.currency} className="rounded-xl border border-slate-200 px-4 py-2">
                    <p className="text-xs font-black uppercase text-slate-500">{g.currency} · {g.orders} orders</p>
                    <p className="text-xl font-black text-slate-900">{formatMinor(g.amount, g.currency)}</p>
                  </div>
                ))}
              </div>
            )}
            <p className="mt-2 text-xs text-slate-400">Totals are never added across currencies.</p>
          </Card>

          <Card>
            <h3 className="mb-4 text-lg font-black text-[#101820]">Store profile</h3>
            <KeyValue items={[
              { label: "Store URL slug", value: data.storeSlug ?? NA },
              { label: "Primary market", value: data.country ? countryDisplayName(data.country) : NA },
              { label: "City", value: data.city ?? NA },
              { label: "Business type", value: data.businessType ?? NA },
              { label: "Phone", value: data.contactPhone ?? NA },
              { label: "Store currency", value: data.currency ?? NA },
              { label: "Joined", value: formatDate(data.createdAt) },
              { label: "Description", value: data.description ?? NA },
            ]} />
          </Card>

          <ProviderReadinessPanel vendorId={data.id} />

          <SubscriptionCard vendorId={data.id} sub={sub} canAssign={canAssignPlan} onSaved={() => void load()} />

          <VendorMarketsCard vendorId={data.id} canMutate={canMutate} />

          <Card>
            <h3 className="mb-3 text-lg font-black text-[#101820]">Products ({(data.products ?? []).length})</h3>
            <DataTable columns={productColumns} rows={data.products ?? []} rowKey={(p) => p.id} onRowClick={(p) => router.push(`/products/${p.id}`)} emptyTitle="No products" />
          </Card>

          <Card>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-black text-[#101820]">Recent orders</h3>
              <TextLink href={`/orders?vendorId=${data.id}`}>All orders →</TextLink>
            </div>
            <DataTable columns={orderColumns} rows={data.recentOrders ?? []} rowKey={(o) => o.id} onRowClick={(o) => router.push(`/orders/${o.id}`)} emptyTitle="No orders yet" />
            <div className="mt-3 flex flex-wrap gap-4">
              <TextLink href={`/disputes?vendorId=${data.id}`}>Disputes →</TextLink>
              <TextLink href={`/verification?q=${encodeURIComponent(data.storeName)}`}>Verification →</TextLink>
              <TextLink href={`/automation?vendorId=${data.id}`}>Automations →</TextLink>
            </div>
          </Card>

          <div className="grid gap-6 xl:grid-cols-2">
            <NotesCard kind="vendors" id={data.id} />
            <TimelineCard kind="vendors" id={data.id} />
          </div>

          <SuspendDialog
            open={suspendMode !== null} mode={suspendMode ?? "suspend"} subject={data.storeName} onCancel={() => setSuspendMode(null)}
            onSubmit={async (values) => {
              await twoFactor.run(async (code) => {
                if (suspendMode === "suspend") await peopleAPI.suspendVendor(id, values, code);
                else await peopleAPI.unsuspendVendor(id, { reason: values.reason, notifyUser: values.notifyUser }, code);
                setSuspendMode(null);
                await load();
              });
            }}
          />

          <ConfirmDialog
            open={closeOpen}
            title={`Close ${data.storeName}?`}
            confirmLabel="Close account"
            description="Closing keeps orders, payments, payouts, disputes and the audit trail, but removes personal data, unpublishes products and signs the owner out. It cannot be undone from here."
            reasonLabel="Reason for closing (sent to the owner and audited)"
            loading={closeBusy}
            error={closeError}
            onCancel={() => setCloseOpen(false)}
            onConfirm={(reason) => void submitClose(reason)}
          >
            {blockers === null && !closeError ? <p className="text-sm font-semibold text-slate-500">Checking open orders, disputes, balance and payouts…</p> : null}
            {blockers && blockers.length > 0 ? (
              <Banner tone="warning" title="Cannot close yet">
                <ul className="list-disc pl-5">{blockers.map((b) => <li key={b.code}>{b.message}</li>)}</ul>
              </Banner>
            ) : blockers ? <Banner tone="success">All pre-close checks passed.</Banner> : null}
          </ConfirmDialog>

          <TwoFactorModal
            open={twoFactor.show2FAModal} code={twoFactor.code} onCodeChange={twoFactor.setCode}
            onSubmit={() => void twoFactor.submit2FA()} onCancel={twoFactor.cancel2FA} loading={twoFactor.loading} error={twoFactor.error}
          />
        </div>
      </AdminLayout>
    </ProtectedRoute>
  );
}

function Metric({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-black text-[#101820]">{value}</p>
      {hint ? <p className="text-xs font-semibold text-slate-500">{hint}</p> : null}
    </Card>
  );
}

function SubscriptionCard({
  vendorId, sub, canAssign, onSaved,
}: { vendorId: string; sub: SubShape | null; canAssign: boolean; onSaved: () => void }) {
  const confirm = useConfirm();
  const [plan, setPlan] = useState(sub && sub.plan !== "FREE" ? sub.plan : "GROWTH");
  const [msg, setMsg] = useState("");
  return (
    <Card>
      <h3 className="mb-3 text-lg font-black text-[#101820]">Subscription</h3>
      <KeyValue items={[
        { label: "Plan", value: sub ? (sub.plan === "FREE" ? "Legacy free (no trial)" : sub.plan.charAt(0) + sub.plan.slice(1).toLowerCase()) : "No subscription record" },
        { label: "Lifecycle", value: sub?.lifecycle ? sub.lifecycle.toLowerCase().replace(/_/g, " ") : NA },
        { label: "Billing status", value: sub ? `${sub.status.toLowerCase().replace("_", " ")}${sub.billingStarted ? " (billing started)" : sub.inTrial ? " (no charge yet)" : ""}` : NA },
        {
          label: "14-day trial",
          value: !sub?.trialEndsAt
            ? "No trial recorded"
            : new Date(sub.trialEndsAt).getTime() > Date.now()
              ? `In trial: ${formatDate(sub.trialStartedAt)} → ${formatDate(sub.trialEndsAt)} (${Math.ceil((new Date(sub.trialEndsAt).getTime() - Date.now()) / 86_400_000)} days left)`
              : `Ended ${formatDate(sub.trialEndsAt)}`,
        },
        { label: "Current period", value: sub?.currentPeriodStart ? `${formatDate(sub.currentPeriodStart)} → ${formatDate(sub.currentPeriodEnd)}` : NA },
        { label: "Next billing", value: sub?.currentPeriodEnd && sub.status === "ACTIVE" ? formatDate(sub.currentPeriodEnd) : NA },
        { label: "Cancelled", value: sub?.cancelledAt ? formatDateTime(sub.cancelledAt) : "No" },
      ]} />
      <p className="mt-3 text-xs text-slate-500">New Growth subscribers get a 14-day full-access trial through Stripe checkout. Dates come from Stripe (trial start/end) and update automatically.</p>
      {canAssign ? <div className="mt-4 flex flex-wrap items-center gap-3">
        <select value={plan} onChange={(e) => setPlan(e.target.value)} aria-label="Plan to assign" className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold">
          <option value="GROWTH">Growth</option>
          <option value="PRO">Pro</option>
        </select>
        <Button variant="secondary" onClick={() => confirm.ask(
          { title: "Override plan manually? (no billing)", tone: "primary", confirmLabel: "Assign plan", description: "This overrides Stripe billing for this vendor. Use only to correct a billing problem." },
          async (reason) => { await vendorsAPI.assignSellerPlan(vendorId, plan, reason); setMsg("Plan updated."); onSaved(); },
        )}>Override plan (no billing)</Button>
        {msg ? <span className="text-sm font-semibold text-slate-600">{msg}</span> : null}
      </div> : null}
      {confirm.dialog}
    </Card>
  );
}

function VendorMarketsCard({ vendorId, canMutate }: { vendorId: string; canMutate: boolean }) {
  const [markets, setMarkets] = useState<VendorMarket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyCode, setBusyCode] = useState<string | null>(null);
  const [addValue, setAddValue] = useState("");
  const twoFactor = useTwoFactorAction();
  const confirm = useConfirm();

  const load = useCallback(async () => {
    try { setLoading(true); setError(""); setMarkets(await vendorsAPI.getVendorMarkets(vendorId)); }
    catch (e) { setError(e instanceof APIError ? e.message : "Failed to load markets"); }
    finally { setLoading(false); }
  }, [vendorId]);
  useEffect(() => { void load(); }, [load]);

  const activeCount = markets.filter((m) => m.enabled).length;
  const assigned = new Set(markets.map((m) => m.marketCode));
  const addable = COUNTRIES.filter((c) => !assigned.has(c.code));

  const toggle = (m: VendorMarket) => {
    if (m.enabled && activeCount <= 1) { setError("A vendor must keep at least one active market. Add another before disabling this one."); return; }
    confirm.ask(
      {
        title: `${m.enabled ? "Disable" : "Enable"} ${m.countryName}?`,
        tone: m.enabled ? "danger" : "primary",
        confirmLabel: m.enabled ? "Disable market" : "Enable market",
        description: m.enabled ? "Stops new activity in this market. History is preserved." : "Allows new activity in this market again.",
      },
      async (reason) => {
        setBusyCode(m.marketCode);
        await twoFactor.run(async (code) => { await vendorsAPI.setVendorMarketEnabled(vendorId, m.marketCode, !m.enabled, reason, code); await load(); });
        setBusyCode(null);
      },
    );
  };

  const add = () => {
    if (!addValue) return;
    confirm.ask(
      { title: `Add ${addValue} as a market?`, tone: "primary", confirmLabel: "Add market" },
      async (reason) => {
        setBusyCode("adding");
        await twoFactor.run(async (code) => { await vendorsAPI.addVendorMarket(vendorId, addValue, reason, code); setAddValue(""); await load(); });
        setBusyCode(null);
      },
    );
  };

  return (
    <Card>
      <h3 className="mb-1 text-lg font-black text-[#101820]">Markets ({markets.length})</h3>
      <p className="mb-4 text-sm text-slate-500">Markets are disabled or enabled - never deleted - so history is preserved.</p>
      {error ? <ErrorPanel message={error} onRetry={() => void load()} /> : null}
      {twoFactor.error ? <Banner tone="danger">{twoFactor.error}</Banner> : null}
      {loading ? <p className="text-sm text-slate-500">Loading…</p> : (
        <div className="space-y-2">
          {markets.map((m) => (
            <div key={m.marketCode} className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
              <div>
                <p className="text-sm font-black text-slate-900">{m.countryName} ({m.marketCode}) - {m.currency}</p>
                <p className="text-xs font-semibold text-slate-500">{m.enabled ? "Enabled" : "Disabled"}</p>
              </div>
              {canMutate ? <Button variant={m.enabled ? "ghost" : "secondary"} className="h-9 px-4" disabled={busyCode === m.marketCode} onClick={() => toggle(m)}>
                {m.enabled ? "Disable" : "Enable"}
              </Button> : null}
            </div>
          ))}
          {markets.length === 0 ? <p className="text-sm font-semibold text-slate-500">No markets configured.</p> : null}
        </div>
      )}
      {canMutate && addable.length > 0 ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <select value={addValue} onChange={(e) => setAddValue(e.target.value)} aria-label="Market to add" className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold">
            <option value="">Select a market to add…</option>
            {addable.map((c) => <option key={c.code} value={c.name}>{c.name}</option>)}
          </select>
          <Button disabled={!addValue || busyCode === "adding"} onClick={add}>Add market</Button>
        </div>
      ) : null}
      {confirm.dialog}
      <TwoFactorModal
        open={twoFactor.show2FAModal} code={twoFactor.code} onCodeChange={twoFactor.setCode}
        onSubmit={() => void twoFactor.submit2FA()} onCancel={twoFactor.cancel2FA} loading={twoFactor.loading} error={twoFactor.error}
      />
    </Card>
  );
}
