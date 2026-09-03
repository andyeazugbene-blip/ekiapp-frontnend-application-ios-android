"use client";

import { useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Badge, Button, Card, ErrorPanel, LoadingPanel, PageHeader } from "@/components/AdminUI";
import ProtectedRoute from "@/components/ProtectedRoute";
import { APIError } from "@/lib/api";
import {
  communityBuyAdminAPI,
  type CommunityBuyPaymentMode,
  type MarketConfig,
  type MarketConfigUpdate,
  type MarketPaymentMode,
  type SupplierReleasePolicy,
} from "@/lib/services/communityBuy.api";

const FLAGS: { key: keyof MarketConfig; label: string; note: string }[] = [
  { key: "communityBuyEnabled", label: "Community Buy", note: "Campaigns can be created and published in this market." },
  { key: "communityBuyPaymentsEnabled", label: "Community Buy payments", note: "Requires legal/payment-provider review — no money can move until this is on." },
  { key: "organiserApplicationsEnabled", label: "Organiser applications", note: "Buyers in this market can apply to become organisers." },
  { key: "supplierApplicationsEnabled", label: "Supplier applications", note: "Verified vendors in this market can apply to become suppliers." },
  { key: "regularDeliveriesEnabled", label: "Regular Deliveries", note: "Informational flag for this market — the feature itself is not gated on it in this release." },
];

const PAYMENT_MODE_OPTIONS: MarketPaymentMode[] = ["DISABLED", "TEST", "LIVE"];
const COMMUNITY_BUY_PAYMENT_MODE_OPTIONS: { value: CommunityBuyPaymentMode | ""; label: string }[] = [
  { value: "", label: "Not set (payments blocked)" },
  { value: "PLEDGE_THEN_CHARGE", label: "Pledge then charge — implemented, current model" },
  { value: "PAY_NOW_REFUND_ON_FAILURE", label: "Pay now / refund on failure — not implemented, blocked if selected" },
  { value: "AUTHORISE_THEN_CAPTURE", label: "Authorise then capture — not implemented, blocked if selected" },
];
const SUPPLIER_RELEASE_POLICY_OPTIONS: SupplierReleasePolicy[] = ["ON_DELIVERY_CONFIRMED", "ON_FULFILMENT_MARKED"];

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 rounded-full transition disabled:opacity-50 ${checked ? "bg-[#096B4A]" : "bg-slate-300"}`}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${checked ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}

const inputClass = "w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#096B4A]";
const labelClass = "text-xs font-bold uppercase tracking-wide text-slate-500";

/** Draft form state for the advanced (non-toggle) fields — batched into one PATCH per market, not one per keystroke. */
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

function MarketCard({ market, onUpdated }: { market: MarketConfig; onUpdated: (m: MarketConfig) => void }) {
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => toDraft(market));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => { setDraft(toDraft(market)); }, [market]);

  const toggle = async (key: keyof MarketConfig, value: boolean) => {
    const busyId = `flag:${key}`;
    setBusyKey(busyId);
    const previous = market;
    onUpdated({ ...market, [key]: value });
    try {
      const updated = await communityBuyAdminAPI.updateMarketConfig(market.countryCode, { [key]: value } as MarketConfigUpdate);
      onUpdated(updated);
    } catch (err) {
      alert(err instanceof APIError ? err.message : "Failed to update market configuration");
      onUpdated(previous);
    } finally {
      setBusyKey(null);
    }
  };

  const saveDraft = async () => {
    setSaving(true);
    setSaveError("");
    setSaved(false);
    try {
      const updated = await communityBuyAdminAPI.updateMarketConfig(market.countryCode, draftToUpdate(draft));
      onUpdated(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 4000);
    } catch (err) {
      setSaveError(err instanceof APIError ? err.message : "Failed to save configuration");
    } finally {
      setSaving(false);
    }
  };

  const paymentReadyForCommunityBuy = market.communityBuyPaymentMode === "PLEDGE_THEN_CHARGE";
  const feeConfigured = market.communityBuyFeeBps != null;

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-black">
          {market.countryCode} <span className="text-base font-semibold text-slate-400">· {market.currency}</span>
        </h2>
        <div className="flex flex-wrap gap-2">
          {market.communityBuyEnabled ? <Badge tone="green">Community Buy on</Badge> : <Badge tone="gray">Community Buy off</Badge>}
          {market.communityBuyPaymentsEnabled ? (
            paymentReadyForCommunityBuy && feeConfigured ? (
              <Badge tone="green">Payments ready</Badge>
            ) : (
              <Badge tone="amber">Payments flagged on, not fully configured</Badge>
            )
          ) : null}
        </div>
      </div>

      <div className="mt-6 space-y-4">
        {FLAGS.map((flag) => (
          <div key={flag.key} className="flex items-center justify-between gap-4 rounded-xl border border-slate-100 p-4">
            <div>
              <p className="text-sm font-bold text-[#101820]">{flag.label}</p>
              <p className="mt-0.5 text-xs text-slate-500">{flag.note}</p>
            </div>
            <Toggle
              checked={Boolean(market[flag.key])}
              disabled={busyKey === `flag:${String(flag.key)}`}
              onChange={(value) => void toggle(flag.key, value)}
            />
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="mt-5 text-sm font-bold text-[#096B4A] hover:underline"
      >
        {expanded ? "Hide advanced configuration ▲" : "Advanced configuration (payment mode, fee, limits, legal) ▼"}
      </button>

      {expanded ? (
        <div className="mt-4 space-y-6 border-t border-slate-100 pt-5">
          <div>
            <p className="mb-3 text-sm font-black text-[#101820]">Community Buy payment (client mandate: no upfront capture)</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="space-y-1">
                <span className={labelClass}>Payment model</span>
                <select
                  className={inputClass}
                  value={draft.communityBuyPaymentMode}
                  onChange={(e) => setDraft((d) => ({ ...d, communityBuyPaymentMode: e.target.value as CommunityBuyPaymentMode | "" }))}
                >
                  {COMMUNITY_BUY_PAYMENT_MODE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className={labelClass}>Eki processing fee (basis points — 500 = 5%)</span>
                <input
                  className={inputClass}
                  type="number"
                  min={0}
                  max={10000}
                  placeholder="Not configured — release blocked until set"
                  value={draft.communityBuyFeeBps}
                  onChange={(e) => setDraft((d) => ({ ...d, communityBuyFeeBps: e.target.value }))}
                />
              </label>
            </div>
          </div>

          <div>
            <p className="mb-3 text-sm font-black text-[#101820]">Payment rail</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <label className="space-y-1">
                <span className={labelClass}>Rail status</span>
                <select className={inputClass} value={draft.paymentMode} onChange={(e) => setDraft((d) => ({ ...d, paymentMode: e.target.value as MarketPaymentMode }))}>
                  {PAYMENT_MODE_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </label>
              <label className="space-y-1">
                <span className={labelClass}>Payment provider</span>
                <input className={inputClass} placeholder="stripe" value={draft.paymentProvider} onChange={(e) => setDraft((d) => ({ ...d, paymentProvider: e.target.value }))} />
              </label>
              <label className="space-y-1">
                <span className={labelClass}>Identity provider</span>
                <input className={inputClass} placeholder="stripe_identity" value={draft.identityProvider} onChange={(e) => setDraft((d) => ({ ...d, identityProvider: e.target.value }))} />
              </label>
            </div>
          </div>

          <div>
            <p className="mb-3 text-sm font-black text-[#101820]">Campaign limits</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
              <label className="space-y-1">
                <span className={labelClass}>Min duration (hours)</span>
                <input className={inputClass} type="number" min={0} value={draft.campaignMinDurationHours} onChange={(e) => setDraft((d) => ({ ...d, campaignMinDurationHours: e.target.value }))} />
              </label>
              <label className="space-y-1">
                <span className={labelClass}>Max duration (hours)</span>
                <input className={inputClass} type="number" min={0} value={draft.campaignMaxDurationHours} onChange={(e) => setDraft((d) => ({ ...d, campaignMaxDurationHours: e.target.value }))} />
              </label>
              <label className="space-y-1">
                <span className={labelClass}>Min value (minor units)</span>
                <input className={inputClass} type="number" min={0} value={draft.campaignMinValueAmount} onChange={(e) => setDraft((d) => ({ ...d, campaignMinValueAmount: e.target.value }))} />
              </label>
              <label className="space-y-1">
                <span className={labelClass}>Max value (minor units)</span>
                <input className={inputClass} type="number" min={0} value={draft.campaignMaxValueAmount} onChange={(e) => setDraft((d) => ({ ...d, campaignMaxValueAmount: e.target.value }))} />
              </label>
            </div>
          </div>

          <div>
            <p className="mb-3 text-sm font-black text-[#101820]">Supplier settlement &amp; delivery</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <label className="space-y-1">
                <span className={labelClass}>Supplier release policy</span>
                <select className={inputClass} value={draft.supplierReleasePolicy} onChange={(e) => setDraft((d) => ({ ...d, supplierReleasePolicy: e.target.value as SupplierReleasePolicy }))}>
                  {SUPPLIER_RELEASE_POLICY_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </label>
              <label className="space-y-1 sm:col-span-2">
                <span className={labelClass}>Delivery methods (comma separated)</span>
                <input className={inputClass} placeholder="DELIVERY, COLLECTION" value={draft.deliveryMethods} onChange={(e) => setDraft((d) => ({ ...d, deliveryMethods: e.target.value }))} />
              </label>
              <label className="space-y-1 sm:col-span-3">
                <span className={labelClass}>Accepted identity documents (comma separated)</span>
                <input className={inputClass} placeholder="passport, national_id" value={draft.acceptedIdentityDocuments} onChange={(e) => setDraft((d) => ({ ...d, acceptedIdentityDocuments: e.target.value }))} />
              </label>
            </div>
          </div>

          <div>
            <p className="mb-3 text-sm font-black text-[#101820]">Fees &amp; legal</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <label className="space-y-1">
                <span className={labelClass}>Organiser fee (basis points)</span>
                <input className={inputClass} type="number" min={0} max={10000} value={draft.organiserFeeBps} onChange={(e) => setDraft((d) => ({ ...d, organiserFeeBps: e.target.value }))} />
              </label>
              <label className="space-y-1">
                <span className={labelClass}>Refund terms version</span>
                <input className={inputClass} value={draft.refundTermsVersion} onChange={(e) => setDraft((d) => ({ ...d, refundTermsVersion: e.target.value }))} />
              </label>
              <label className="space-y-1">
                <span className={labelClass}>Legal terms version</span>
                <input className={inputClass} value={draft.legalTermsVersion} onChange={(e) => setDraft((d) => ({ ...d, legalTermsVersion: e.target.value }))} />
              </label>
            </div>
          </div>

          {saveError ? <p className="text-sm font-semibold text-red-600">{saveError}</p> : null}
          <div className="flex items-center gap-3">
            <Button variant="primary" disabled={saving} onClick={() => void saveDraft()}>
              {saving ? "Saving..." : "Save configuration"}
            </Button>
            {saved ? <span className="text-sm font-semibold text-[#096B4A]">Saved.</span> : null}
          </div>
        </div>
      ) : null}
    </Card>
  );
}

export default function CommunityMarketsPage() {
  const [markets, setMarkets] = useState<MarketConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      setMarkets(await communityBuyAdminAPI.getMarketConfigs());
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Failed to load market configuration");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const updateOne = (updated: MarketConfig) => {
    setMarkets((prev) => prev.map((m) => (m.countryCode === updated.countryCode ? updated : m)));
  };

  // Africa is deliberately absent from this list — client mandate 2026-09:
  // "Africa must NOT be launched yet... do not delete African support."
  // Nothing here hides Africa in code; it simply has no MarketConfiguration
  // row yet (backend market-configuration.service.ts INITIAL_MARKETS only
  // seeds the client-approved launch markets). Adding an African market
  // here later is exactly the same admin action as any other market.
  return (
    <ProtectedRoute>
      <AdminLayout>
        {loading ? <LoadingPanel label="Loading market configuration..." /> : (
          <div className="space-y-8">
            <PageHeader
              title="Market configuration"
              subtitle="Country-by-country feature, payment, and legal controls. All flags default off — the mobile app never hardcodes availability, it reads this configuration. Africa is intentionally not listed for the current launch."
            />
            {error ? <ErrorPanel message={error} onRetry={() => void load()} /> : null}

            {markets.length === 0 ? (
              <Card className="py-12 text-center text-slate-500">No markets configured yet.</Card>
            ) : (
              <div className="space-y-6">
                {markets.map((m) => (
                  <MarketCard key={m.countryCode} market={m} onUpdated={updateOne} />
                ))}
              </div>
            )}
          </div>
        )}
      </AdminLayout>
    </ProtectedRoute>
  );
}
