"use client";

import { useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Card, ErrorPanel, LoadingPanel, PageHeader } from "@/components/AdminUI";
import ProtectedRoute from "@/components/ProtectedRoute";
import { APIError } from "@/lib/api";
import { communityBuyAdminAPI, type MarketConfig } from "@/lib/services/communityBuy.api";

const FLAGS: { key: keyof MarketConfig; label: string; note: string }[] = [
  { key: "communityBuyEnabled", label: "Community Buy", note: "Campaigns can be created and published in this market." },
  { key: "communityBuyPaymentsEnabled", label: "Community Buy payments", note: "Requires legal/payment-provider review — no money can move until this is on." },
  { key: "organiserApplicationsEnabled", label: "Organiser applications", note: "Buyers in this market can apply to become organisers." },
  { key: "supplierApplicationsEnabled", label: "Supplier applications", note: "Verified vendors in this market can apply to become suppliers." },
  { key: "regularDeliveriesEnabled", label: "Regular Deliveries", note: "Informational flag for this market — the feature itself is not gated on it in this release." },
];

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

export default function CommunityMarketsPage() {
  const [markets, setMarkets] = useState<MarketConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyKey, setBusyKey] = useState<string | null>(null);

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

  const toggle = async (countryCode: string, key: keyof MarketConfig, value: boolean) => {
    const busyId = `${countryCode}:${key}`;
    setBusyKey(busyId);
    setMarkets((prev) => prev.map((m) => (m.countryCode === countryCode ? { ...m, [key]: value } : m)));
    try {
      await communityBuyAdminAPI.updateMarketConfig(countryCode, { [key]: value });
    } catch (err) {
      alert(err instanceof APIError ? err.message : "Failed to update market configuration");
      await load();
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <ProtectedRoute>
      <AdminLayout>
        {loading ? <LoadingPanel label="Loading market configuration..." /> : (
          <div className="space-y-8">
            <PageHeader
              title="Market configuration"
              subtitle="Country-by-country feature controls. All flags default off — the mobile app never hardcodes availability, it reads this configuration."
            />
            {error ? <ErrorPanel message={error} onRetry={() => void load()} /> : null}

            {markets.length === 0 ? (
              <Card className="py-12 text-center text-slate-500">No markets configured yet.</Card>
            ) : (
              markets.map((m) => (
                <Card key={m.countryCode}>
                  <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-black">{m.countryCode} <span className="text-base font-semibold text-slate-400">· {m.currency}</span></h2>
                  </div>
                  <div className="mt-6 space-y-4">
                    {FLAGS.map((flag) => (
                      <div key={flag.key} className="flex items-center justify-between gap-4 rounded-xl border border-slate-100 p-4">
                        <div>
                          <p className="text-sm font-bold text-[#101820]">{flag.label}</p>
                          <p className="mt-0.5 text-xs text-slate-500">{flag.note}</p>
                        </div>
                        <Toggle
                          checked={Boolean(m[flag.key])}
                          disabled={busyKey === `${m.countryCode}:${flag.key}`}
                          onChange={(value) => void toggle(m.countryCode, flag.key, value)}
                        />
                      </div>
                    ))}
                  </div>
                </Card>
              ))
            )}
          </div>
        )}
      </AdminLayout>
    </ProtectedRoute>
  );
}
