"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import AdminLayout from "@/components/AdminLayout";
import { Banner, ConfirmDialog, SearchInput, formatDateTime } from "@/components/AdminKit";
import { Badge, Button, Card, ErrorPanel, Icon, PageHeader } from "@/components/AdminUI";
import { NoAccess, SkeletonRows } from "@/components/PageStates";
import ProtectedRoute from "@/components/ProtectedRoute";
import { APIError } from "@/lib/api";
import { usePermissions } from "@/lib/hooks/usePermissions";
import {
  communityBuyAdminAPI,
  type CommunityBuyPaymentMode,
  type MarketConfig,
  type MarketConfigUpdate,
  type MarketHistoryEntry,
  type MarketPaymentMode,
  type SupplierReleasePolicy,
} from "@/lib/services/communityBuy.api";
import { ADDABLE_MARKETS, COUNTRIES, marketLabel } from "@/lib/countries";

/**
 * Handbook 14.9 market controls. "Feature availability" (toggles) is shown
 * separately from "Verified payment readiness" (an evidence checklist). Only a
 * Super Administrator, with a complete checklist, an approval reference, a reason
 * and 2FA, can switch Community Buy payments on. Every change asks for a reason
 * and appears in the per-market history (read from the immutable audit log).
 */

const FEATURE_FLAGS: { key: "communityBuyEnabled" | "organiserApplicationsEnabled" | "supplierApplicationsEnabled" | "regularDeliveriesEnabled"; label: string; note: string }[] = [
  { key: "communityBuyEnabled", label: "Community Buy", note: "Campaigns can be created and published in this market." },
  { key: "organiserApplicationsEnabled", label: "Organiser applications", note: "Buyers in this market can apply to become organisers. Needs Community Buy on." },
  { key: "supplierApplicationsEnabled", label: "Supplier applications", note: "Suppliers in this market can apply. Needs Community Buy on." },
  { key: "regularDeliveriesEnabled", label: "Foodstuffs Subscription", note: "Buyers can browse and subscribe to Foodstuffs Subscription offers. Needs a payment provider and a payment mode other than DISABLED." },
];

const PAYMENT_MODE_OPTIONS: MarketPaymentMode[] = ["DISABLED", "TEST", "LIVE"];
const COMMUNITY_BUY_PAYMENT_MODE_OPTIONS: { value: CommunityBuyPaymentMode | ""; label: string }[] = [
  { value: "", label: "Not set (payments blocked)" },
  { value: "PLEDGE_THEN_CHARGE", label: "Pledge then charge - current model" },
  { value: "AUTHORISE_THEN_CAPTURE", label: "Authorise then capture" },
];
const SUPPLIER_RELEASE_POLICY_OPTIONS: SupplierReleasePolicy[] = ["ON_DELIVERY_CONFIRMED", "ON_FULFILMENT_MARKED"];

function Toggle({ checked, onChange, disabled, label }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-50 ${checked ? "bg-[#096B4A]" : "bg-slate-300"}`}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${checked ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}

const inputClass = "w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#096B4A]";
const labelClass = "text-xs font-bold uppercase tracking-wide text-slate-500";

type Draft = {
  paymentMode: MarketPaymentMode;
  paymentProvider: string;
  identityProvider: string;
  acceptedIdentityDocuments: string;
  campaignMinDurationHours: string;
  campaignMaxDurationHours: string;
  campaignMinValueAmount: string;
  campaignMaxValueAmount: string;
  refundTermsVersion: string;
  organiserFeeBps: string;
  supplierReleasePolicy: SupplierReleasePolicy;
  deliveryMethods: string;
  legalTermsVersion: string;
  communityBuyPaymentMode: CommunityBuyPaymentMode | "";
  communityBuyFeeBps: string;
};

function toDraft(m: MarketConfig): Draft {
  return {
    paymentMode: m.paymentMode,
    paymentProvider: m.paymentProvider ?? "",
    identityProvider: m.identityProvider ?? "",
    acceptedIdentityDocuments: (m.acceptedIdentityDocuments ?? []).join(", "),
    campaignMinDurationHours: m.campaignMinDurationHours != null ? String(m.campaignMinDurationHours) : "",
    campaignMaxDurationHours: m.campaignMaxDurationHours != null ? String(m.campaignMaxDurationHours) : "",
    campaignMinValueAmount: m.campaignMinValueAmount != null ? String(m.campaignMinValueAmount) : "",
    campaignMaxValueAmount: m.campaignMaxValueAmount != null ? String(m.campaignMaxValueAmount) : "",
    refundTermsVersion: m.refundTermsVersion ?? "",
    organiserFeeBps: m.organiserFeeBps != null ? String(m.organiserFeeBps) : "",
    supplierReleasePolicy: m.supplierReleasePolicy,
    deliveryMethods: (m.deliveryMethods ?? []).join(", "),
    legalTermsVersion: m.legalTermsVersion ?? "",
    communityBuyPaymentMode: m.communityBuyPaymentMode ?? "",
    communityBuyFeeBps: m.communityBuyFeeBps != null ? String(m.communityBuyFeeBps) : "",
  };
}

function draftToUpdate(d: Draft): MarketConfigUpdate {
  const num = (v: string): number | null => (v.trim() === "" ? null : Number(v));
  const list = (v: string): string[] => v.split(",").map((s) => s.trim()).filter(Boolean);
  return {
    paymentMode: d.paymentMode,
    paymentProvider: d.paymentProvider.trim() || null,
    identityProvider: d.identityProvider.trim() || null,
    acceptedIdentityDocuments: list(d.acceptedIdentityDocuments),
    campaignMinDurationHours: num(d.campaignMinDurationHours),
    campaignMaxDurationHours: num(d.campaignMaxDurationHours),
    campaignMinValueAmount: num(d.campaignMinValueAmount),
    campaignMaxValueAmount: num(d.campaignMaxValueAmount),
    refundTermsVersion: d.refundTermsVersion.trim() || null,
    organiserFeeBps: num(d.organiserFeeBps),
    supplierReleasePolicy: d.supplierReleasePolicy,
    deliveryMethods: list(d.deliveryMethods),
    legalTermsVersion: d.legalTermsVersion.trim() || null,
    communityBuyPaymentMode: d.communityBuyPaymentMode || null,
    communityBuyFeeBps: num(d.communityBuyFeeBps),
  };
}

type Dialog =
  | { kind: "toggle"; key: (typeof FEATURE_FLAGS)[number]["key"]; value: boolean; label: string }
  | { kind: "save" }
  | { kind: "readiness" }
  | { kind: "enablePayments" }
  | { kind: "disablePayments" };

function actionLabel(action: string): string {
  return action.replace("community_market_config.", "").replace(/_/g, " ");
}

function MarketCard({
  market, isSuperAdmin, canMutate, onUpdated,
}: { market: MarketConfig; isSuperAdmin: boolean; canMutate: boolean; onUpdated: (m: MarketConfig, message: string) => void }) {
  const [open, setOpen] = useState(false);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [dialogError, setDialogError] = useState("");
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => toDraft(market));
  const [history, setHistory] = useState<MarketHistoryEntry[] | null>(null);
  const [historyError, setHistoryError] = useState("");
  const [approvalRef, setApprovalRef] = useState("");
  const [evidence, setEvidence] = useState({
    providerSupported: Boolean(market.providerSupported),
    providerConfigChecked: Boolean(market.providerConfigChecked),
    refundTested: Boolean(market.refundTested),
    legalApprovalRef: market.legalApprovalRef ?? "",
    testTransactionAt: market.testTransactionAt ? market.testTransactionAt.slice(0, 10) : "",
  });

  useEffect(() => { setDraft(toDraft(market)); }, [market]);

  const readiness = market.readiness;
  const satisfied = readiness?.items.filter((i) => i.satisfied).length ?? 0;
  const total = readiness?.items.length ?? 5;

  const loadHistory = useCallback(async () => {
    try {
      setHistoryError("");
      setHistory(await communityBuyAdminAPI.getMarketHistory(market.countryCode, { bypassCache: true }));
    } catch (err) {
      setHistoryError(err instanceof APIError ? err.message : "Failed to load history");
    }
  }, [market.countryCode]);

  useEffect(() => { if (open && history === null) void loadHistory(); }, [open, history, loadHistory]);

  const run = async (fn: () => Promise<MarketConfig>, message: string) => {
    setBusy(true);
    setDialogError("");
    try {
      const updated = await fn();
      onUpdated(updated, message);
      setDialog(null);
      setHistory(null);
    } catch (err) {
      setDialogError(err instanceof APIError || err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  };

  const onConfirm = (reason: string) => {
    if (!dialog) return;
    if (dialog.kind === "toggle") {
      return run(() => communityBuyAdminAPI.updateMarketConfig(market.countryCode, { [dialog.key]: dialog.value } as MarketConfigUpdate, reason), `${dialog.label} ${dialog.value ? "turned on" : "turned off"} for ${marketLabel(market.countryCode, market.currency)}.`);
    }
    if (dialog.kind === "save") {
      return run(() => communityBuyAdminAPI.updateMarketConfig(market.countryCode, draftToUpdate(draft), reason), "Configuration saved.");
    }
    if (dialog.kind === "readiness") {
      return run(
        () => communityBuyAdminAPI.updateMarketReadiness(market.countryCode, {
          providerSupported: evidence.providerSupported,
          providerConfigChecked: evidence.providerConfigChecked,
          refundTested: evidence.refundTested,
          legalApprovalRef: evidence.legalApprovalRef.trim() || null,
          testTransactionAt: evidence.testTransactionAt ? new Date(evidence.testTransactionAt).toISOString() : null,
        }, reason),
        "Readiness evidence recorded.",
      );
    }
    if (dialog.kind === "enablePayments") {
      return run(() => communityBuyAdminAPI.setMarketPayments(market.countryCode, true, reason, approvalRef.trim()), "Community Buy payments enabled.");
    }
    return run(() => communityBuyAdminAPI.setMarketPayments(market.countryCode, false, reason), "Community Buy payments disabled. Existing campaigns are preserved and affected participants are notified.");
  };

  const dialogProps = (() => {
    if (!dialog) return null;
    switch (dialog.kind) {
      case "toggle":
        return { title: `${dialog.value ? "Turn on" : "Turn off"} ${dialog.label}?`, description: `${marketLabel(market.countryCode, market.currency)}. ${dialog.value ? "" : "Existing campaigns and subscriptions are preserved; affected people are notified."}`, confirmLabel: dialog.value ? "Turn on" : "Turn off", tone: (dialog.value ? "primary" : "danger") as "primary" | "danger" };
      case "save":
        return { title: "Save configuration?", description: "This changes payment mode, fees and legal settings for the market.", confirmLabel: "Save configuration", tone: "primary" as const };
      case "readiness":
        return { title: "Record payment readiness evidence", description: "Only tick items you have actually verified. Readiness is complete when every item is satisfied.", confirmLabel: "Record evidence", tone: "primary" as const };
      case "enablePayments":
        return { title: `Enable Community Buy payments in ${marketLabel(market.countryCode, market.currency)}?`, description: "Real money can move in this market once enabled. Super Administrator only; requires a complete readiness checklist, an approval reference and 2FA.", confirmLabel: "Enable payments", tone: "danger" as const };
      default:
        return { title: "Disable Community Buy payments?", description: "New payments stop immediately. Existing campaigns are preserved and affected participants are notified.", confirmLabel: "Disable payments", tone: "danger" as const };
    }
  })();

  const paymentsReadyToEnable = Boolean(readiness?.ready) && market.communityBuyEnabled;

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-black text-[#101820]">{marketLabel(market.countryCode, market.currency)}</h2>
        <div className="flex flex-wrap gap-2">
          {market.communityBuyEnabled ? <Badge tone="green">Community Buy on</Badge> : <Badge tone="gray">Community Buy off</Badge>}
          {market.communityBuyPaymentsEnabled ? <Badge tone="green">Payments on</Badge> : <Badge tone="gray">Payments off</Badge>}
          {market.communityBuyPaymentsEnabled && market.readinessUnverified ? <Badge tone="amber">Readiness unverified</Badge> : null}
          <Badge tone={readiness?.ready ? "green" : "amber"}>Readiness {satisfied}/{total}</Badge>
          <Button variant="ghost" className="h-9 px-3" onClick={() => setOpen((v) => !v)} aria-expanded={open}>{open ? "Hide" : "Manage"}</Button>
        </div>
      </div>

      {open && market.communityBuyPaymentsEnabled && market.readinessUnverified ? (
        <div className="mt-4">
          <Banner tone="warning" title="Payments are on, but readiness has not been verified">
            This market was already live before readiness evidence was required. It keeps working; a Super Administrator should record the evidence below.
          </Banner>
        </div>
      ) : null}

      {open ? (
        <div className="mt-6 space-y-8">
          <section aria-label="Feature availability">
            <h3 className="text-sm font-black uppercase tracking-wide text-slate-500">Feature availability</h3>
            <div className="mt-3 space-y-3">
              {FEATURE_FLAGS.map((flag) => (
                <div key={flag.key} className="flex items-center justify-between gap-4 rounded-xl border border-slate-100 p-4">
                  <div>
                    <p className="text-sm font-bold text-[#101820]">{flag.label}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{flag.note}</p>
                  </div>
                  <Toggle
                    label={flag.label}
                    checked={Boolean(market[flag.key])}
                    disabled={!canMutate || busy}
                    onChange={(value) => { setDialogError(""); setDialog({ kind: "toggle", key: flag.key, value, label: flag.label }); }}
                  />
                </div>
              ))}
            </div>
          </section>

          <section aria-label="Verified payment readiness">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-black uppercase tracking-wide text-slate-500">Verified payment readiness</h3>
              {isSuperAdmin && canMutate ? <Button variant="secondary" className="h-9 px-3" onClick={() => { setDialogError(""); setDialog({ kind: "readiness" }); }}>Record evidence</Button> : null}
            </div>
            <ul className="mt-3 space-y-2">
              {(readiness?.items ?? []).map((item) => (
                <li key={item.key} className="flex items-start gap-3 rounded-xl border border-slate-100 p-3 text-sm">
                  <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-black ${item.satisfied ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"}`} aria-hidden>{item.satisfied ? "✓" : "–"}</span>
                  <div>
                    <p className="font-bold text-[#101820]">{item.label}{item.satisfied ? "" : " (not verified)"}</p>
                    {item.detail ? <p className="text-xs text-slate-500">{item.key === "testTransactionAt" ? formatDateTime(item.detail) : item.detail}</p> : null}
                  </div>
                </li>
              ))}
            </ul>
            {!isSuperAdmin ? <p className="mt-2 text-xs text-slate-500">Only a Super Administrator can record readiness evidence.</p> : null}
            {market.readinessApprovedAt ? <p className="mt-2 text-xs text-slate-500">Readiness approved {formatDateTime(market.readinessApprovedAt)}.</p> : null}
          </section>

          <section aria-label="Community Buy payments">
            <h3 className="text-sm font-black uppercase tracking-wide text-slate-500">Community Buy payments</h3>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-100 p-4">
              <div>
                <p className="text-sm font-bold text-[#101820]">{market.communityBuyPaymentsEnabled ? "Payments are enabled" : "Payments are off"}</p>
                {market.enablementReason ? <p className="mt-0.5 text-xs text-slate-500">Last decision: {market.enablementReason}</p> : null}
                {!market.communityBuyPaymentsEnabled && !paymentsReadyToEnable ? (
                  <p className="mt-0.5 text-xs text-amber-700">{!market.communityBuyEnabled ? "Turn on Community Buy first." : "Complete the readiness checklist first."}</p>
                ) : null}
              </div>
              {canMutate ? (
                market.communityBuyPaymentsEnabled ? (
                  <Button variant="danger" onClick={() => { setDialogError(""); setDialog({ kind: "disablePayments" }); }}>Disable payments</Button>
                ) : isSuperAdmin ? (
                  <Button disabled={!paymentsReadyToEnable} onClick={() => { setDialogError(""); setApprovalRef(""); setDialog({ kind: "enablePayments" }); }}>Enable payments</Button>
                ) : (
                  <p className="text-xs font-semibold text-slate-500">Only a Super Administrator can enable payments.</p>
                )
              ) : null}
            </div>
          </section>

          <section aria-label="Advanced configuration">
            <h3 className="text-sm font-black uppercase tracking-wide text-slate-500">Advanced configuration</h3>
            <div className="mt-3 space-y-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <label className="space-y-1"><span className={labelClass}>Payment model</span>
                  <select className={inputClass} value={draft.communityBuyPaymentMode} onChange={(e) => setDraft((d) => ({ ...d, communityBuyPaymentMode: e.target.value as CommunityBuyPaymentMode | "" }))}>
                    {COMMUNITY_BUY_PAYMENT_MODE_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>
                </label>
                <label className="space-y-1"><span className={labelClass}>Rail status</span>
                  <select className={inputClass} value={draft.paymentMode} onChange={(e) => setDraft((d) => ({ ...d, paymentMode: e.target.value as MarketPaymentMode }))}>
                    {PAYMENT_MODE_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </label>
                <label className="space-y-1"><span className={labelClass}>Payment provider</span>
                  <input className={inputClass} placeholder="stripe" value={draft.paymentProvider} onChange={(e) => setDraft((d) => ({ ...d, paymentProvider: e.target.value }))} />
                </label>
                <label className="space-y-1"><span className={labelClass}>Identity provider</span>
                  <input className={inputClass} placeholder="stripe_identity" value={draft.identityProvider} onChange={(e) => setDraft((d) => ({ ...d, identityProvider: e.target.value }))} />
                </label>
                <label className="space-y-1"><span className={labelClass}>Eki processing fee (basis points)</span>
                  <input className={inputClass} type="number" min={0} max={10000} value={draft.communityBuyFeeBps} onChange={(e) => setDraft((d) => ({ ...d, communityBuyFeeBps: e.target.value }))} />
                </label>
                <label className="space-y-1"><span className={labelClass}>Organiser fee (basis points)</span>
                  <input className={inputClass} type="number" min={0} max={10000} value={draft.organiserFeeBps} onChange={(e) => setDraft((d) => ({ ...d, organiserFeeBps: e.target.value }))} />
                </label>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                <label className="space-y-1"><span className={labelClass}>Min duration (hours)</span>
                  <input className={inputClass} type="number" min={0} value={draft.campaignMinDurationHours} onChange={(e) => setDraft((d) => ({ ...d, campaignMinDurationHours: e.target.value }))} />
                </label>
                <label className="space-y-1"><span className={labelClass}>Max duration (hours)</span>
                  <input className={inputClass} type="number" min={0} value={draft.campaignMaxDurationHours} onChange={(e) => setDraft((d) => ({ ...d, campaignMaxDurationHours: e.target.value }))} />
                </label>
                <label className="space-y-1"><span className={labelClass}>Min value (minor units)</span>
                  <input className={inputClass} type="number" min={0} value={draft.campaignMinValueAmount} onChange={(e) => setDraft((d) => ({ ...d, campaignMinValueAmount: e.target.value }))} />
                </label>
                <label className="space-y-1"><span className={labelClass}>Max value (minor units)</span>
                  <input className={inputClass} type="number" min={0} value={draft.campaignMaxValueAmount} onChange={(e) => setDraft((d) => ({ ...d, campaignMaxValueAmount: e.target.value }))} />
                </label>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <label className="space-y-1"><span className={labelClass}>Supplier release policy</span>
                  <select className={inputClass} value={draft.supplierReleasePolicy} onChange={(e) => setDraft((d) => ({ ...d, supplierReleasePolicy: e.target.value as SupplierReleasePolicy }))}>
                    {SUPPLIER_RELEASE_POLICY_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </label>
                <label className="space-y-1 sm:col-span-2"><span className={labelClass}>Delivery methods (comma separated)</span>
                  <input className={inputClass} placeholder="DELIVERY, COLLECTION" value={draft.deliveryMethods} onChange={(e) => setDraft((d) => ({ ...d, deliveryMethods: e.target.value }))} />
                </label>
                <label className="space-y-1 sm:col-span-3"><span className={labelClass}>Accepted identity documents (comma separated)</span>
                  <input className={inputClass} placeholder="passport, national_id" value={draft.acceptedIdentityDocuments} onChange={(e) => setDraft((d) => ({ ...d, acceptedIdentityDocuments: e.target.value }))} />
                </label>
                <label className="space-y-1"><span className={labelClass}>Refund terms version</span>
                  <input className={inputClass} value={draft.refundTermsVersion} onChange={(e) => setDraft((d) => ({ ...d, refundTermsVersion: e.target.value }))} />
                </label>
                <label className="space-y-1"><span className={labelClass}>Legal terms version</span>
                  <input className={inputClass} value={draft.legalTermsVersion} onChange={(e) => setDraft((d) => ({ ...d, legalTermsVersion: e.target.value }))} />
                </label>
              </div>
              {canMutate ? <Button onClick={() => { setDialogError(""); setDialog({ kind: "save" }); }}>Save configuration</Button> : null}
              <p className="text-xs text-slate-400">Last updated {formatDateTime(market.updatedAt)}</p>
            </div>
          </section>

          <section aria-label="Change history">
            <h3 className="text-sm font-black uppercase tracking-wide text-slate-500">Change history</h3>
            {historyError ? <p className="mt-2 text-sm font-semibold text-red-600">{historyError}</p> : null}
            {history === null && !historyError ? <p className="mt-2 text-sm text-slate-500">Loading history...</p> : null}
            {history && history.length === 0 ? <p className="mt-2 text-sm text-slate-500">No recorded changes for this market yet.</p> : null}
            {history && history.length > 0 ? (
              <ol className="mt-3 space-y-2">
                {history.map((h) => (
                  <li key={h.id} className="rounded-xl border border-slate-100 p-3 text-sm">
                    <p className="font-bold text-[#101820]">{actionLabel(h.action)}</p>
                    <p className="text-xs text-slate-500">{h.actor.name ?? h.actor.email ?? h.actor.id} - {formatDateTime(h.createdAt)}</p>
                    {h.reason ? <p className="mt-1 text-xs text-slate-600">Reason: {h.reason}</p> : null}
                  </li>
                ))}
              </ol>
            ) : null}
          </section>
        </div>
      ) : null}

      {dialog && dialogProps ? (
        <ConfirmDialog
          open
          {...dialogProps}
          loading={busy}
          error={dialogError}
          onCancel={() => { if (!busy) setDialog(null); }}
          onConfirm={onConfirm}
        >
          {dialog.kind === "enablePayments" ? (
            <label className="block space-y-1">
              <span className={labelClass}>Approval reference</span>
              <input className={inputClass} value={approvalRef} onChange={(e) => setApprovalRef(e.target.value)} placeholder="e.g. ticket or sign-off number" />
            </label>
          ) : null}
          {dialog.kind === "readiness" ? (
            <div className="space-y-3 text-sm">
              {([["providerSupported", "Payment provider supports this country"], ["providerConfigChecked", "Provider configuration checked"], ["refundTested", "Refund flow tested"]] as const).map(([k, l]) => (
                <label key={k} className="flex items-center gap-2"><input type="checkbox" checked={evidence[k]} onChange={(e) => setEvidence((s) => ({ ...s, [k]: e.target.checked }))} />{l}</label>
              ))}
              <label className="block space-y-1"><span className={labelClass}>Legal / terms approval reference</span>
                <input className={inputClass} value={evidence.legalApprovalRef} onChange={(e) => setEvidence((s) => ({ ...s, legalApprovalRef: e.target.value }))} />
              </label>
              <label className="block space-y-1"><span className={labelClass}>Test transaction date</span>
                <input className={inputClass} type="date" value={evidence.testTransactionAt} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setEvidence((s) => ({ ...s, testTransactionAt: e.target.value }))} />
              </label>
            </div>
          ) : null}
        </ConfirmDialog>
      ) : null}
    </Card>
  );
}

function AddMarketDialog({ existing, onClose, onAdded }: { existing: Set<string>; onClose: () => void; onAdded: (m: MarketConfig) => void }) {
  const options = useMemo(() => [...COUNTRIES, ...ADDABLE_MARKETS].filter((c) => !existing.has(c.code)), [existing]);
  const [code, setCode] = useState(options[0]?.code ?? "");
  const [currency, setCurrency] = useState(options[0]?.currency ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <ConfirmDialog
      open
      title="Add a market"
      description="The market starts with everything off and no payment readiness. Configure and verify it afterwards."
      confirmLabel="Add market"
      tone="primary"
      loading={busy}
      error={error}
      onCancel={onClose}
      onConfirm={async (reason) => {
        setBusy(true);
        setError("");
        try {
          onAdded(await communityBuyAdminAPI.createMarket(code, currency, reason));
        } catch (err) {
          setError(err instanceof Error ? err.message : "Failed to add market");
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="block space-y-1"><span className={labelClass}>Country</span>
        <select className={inputClass} value={code} onChange={(e) => { setCode(e.target.value); setCurrency(options.find((o) => o.code === e.target.value)?.currency ?? currency); }}>
          {options.map((o) => <option key={o.code} value={o.code}>{marketLabel(o.code, o.currency)}</option>)}
        </select>
      </label>
      <label className="block space-y-1"><span className={labelClass}>Currency (ISO 4217)</span>
        <input className={inputClass} value={currency} maxLength={3} onChange={(e) => setCurrency(e.target.value.toUpperCase())} />
      </label>
    </ConfirmDialog>
  );
}

function Content() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { has, access, loading: permLoading } = usePermissions();
  const q = params.get("q") ?? "";
  const [markets, setMarkets] = useState<MarketConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [adding, setAdding] = useState(false);

  const load = useCallback(async (bypassCache = false) => {
    try {
      setLoading(true);
      setError("");
      setMarkets(await communityBuyAdminAPI.getMarketConfigs(bypassCache ? { bypassCache: true } : undefined));
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Failed to load market configuration");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const setQuery = (value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set("q", value); else next.delete("q");
    router.replace(`${pathname}?${next.toString()}`);
  };

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return markets;
    return markets.filter((m) => marketLabel(m.countryCode, m.currency).toLowerCase().includes(needle));
  }, [markets, q]);

  if (!permLoading && !has("community_buy.read")) return <NoAccess what="market controls" />;
  const canMutate = has("community_buy.mutate");
  const isSuperAdmin = Boolean(access?.isSuperAdmin);
  const unverified = markets.filter((m) => m.communityBuyPaymentsEnabled && m.readinessUnverified).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Market controls"
        subtitle="Feature availability and verified payment readiness, country by country. The mobile app reads this configuration - nothing is hardcoded."
        actions={
          <>
            <Button variant="ghost" onClick={() => void load(true)}><Icon name="refresh" className="h-4 w-4" />Refresh</Button>
            {canMutate ? <Button onClick={() => setAdding(true)}>Add market</Button> : null}
          </>
        }
      />
      {notice ? <Banner tone="success">{notice}</Banner> : null}
      {unverified > 0 ? (
        <Banner tone="warning" title={`${unverified} market${unverified === 1 ? " has" : "s have"} payments on without verified readiness`}>
          They keep working. A Super Administrator should record readiness evidence for each.
        </Banner>
      ) : null}
      {error ? <ErrorPanel message={error} onRetry={() => void load()} /> : null}
      <div className="flex flex-wrap gap-3">
        <SearchInput value={q} onChange={setQuery} placeholder="Search markets, e.g. Austria or EUR" />
      </div>
      {loading && markets.length === 0 ? <SkeletonRows count={5} /> : filtered.length === 0 ? (
        <Card className="py-12 text-center text-slate-500">{markets.length === 0 ? "No markets configured yet." : "No markets match your search."}</Card>
      ) : (
        <div className="space-y-4">
          {filtered.map((m) => (
            <MarketCard
              key={m.countryCode}
              market={m}
              isSuperAdmin={isSuperAdmin}
              canMutate={canMutate}
              onUpdated={(updated, message) => {
                setMarkets((prev) => prev.map((x) => (x.countryCode === updated.countryCode ? updated : x)));
                setNotice(message);
              }}
            />
          ))}
        </div>
      )}
      {adding ? (
        <AddMarketDialog
          existing={new Set(markets.map((m) => m.countryCode))}
          onClose={() => setAdding(false)}
          onAdded={(m) => { setMarkets((prev) => [...prev, m].sort((a, b) => a.countryCode.localeCompare(b.countryCode))); setNotice(`${marketLabel(m.countryCode, m.currency)} added.`); setAdding(false); }}
        />
      ) : null}
    </div>
  );
}

export default function CommunityMarketsPage() {
  return (
    <ProtectedRoute>
      <AdminLayout>
        <Suspense fallback={<SkeletonRows count={5} />}>
          <Content />
        </Suspense>
      </AdminLayout>
    </ProtectedRoute>
  );
}
