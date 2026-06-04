"use client";

import { useCallback, useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Badge, Button, Card, ErrorPanel, LoadingPanel, PageHeader } from "@/components/AdminUI";
import { escrowAPI } from "@/lib/services/escrow.api";
import { AdminEscrowHealth, EscrowProviderConfig } from "@/types";

export default function EscrowPage() {
  const [health, setHealth] = useState<AdminEscrowHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setHealth(await escrowAPI.getHealth());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load escrow controls.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const update = async (provider: EscrowProviderConfig, patch: Partial<EscrowProviderConfig>) => {
    setSavingId(provider.id);
    setError("");
    try {
      const next = await escrowAPI.updateProvider(provider.id, patch);
      setHealth((current) => current ? { ...current, providers: current.providers.map((item) => item.id === next.id ? next : item) } : current);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update escrow provider.");
    } finally {
      setSavingId("");
    }
  };

  return (
    <ProtectedRoute>
      <AdminLayout>
        {loading ? <LoadingPanel label="Loading escrow controls..." /> : (
          <div className="space-y-8">
            <PageHeader title="Escrow center" subtitle="Control verified provider corridors, OTP delivery, payout support, and protection windows." actions={<Button variant="ghost" onClick={() => void load()}>Refresh</Button>} />
            {error ? <ErrorPanel message={error} onRetry={() => void load()} /> : null}
            <div className="grid gap-4 md:grid-cols-3">
              <Card><p className="text-sm text-slate-500">SMS provider</p><div className="mt-3"><Badge tone={health?.smsConfigured ? "green" : "red"}>{health?.smsConfigured ? "Configured" : "Not configured"}</Badge></div></Card>
              <Card><p className="text-sm text-slate-500">Enabled corridors</p><p className="mt-2 text-3xl font-black">{health?.providers.filter((item) => item.enabled).length ?? 0}</p></Card>
              <Card><p className="text-sm text-slate-500">Operational rule</p><p className="mt-2 text-sm font-bold text-[#096B4A]">Unsupported corridors stay disabled at checkout.</p></Card>
            </div>

            <div className="grid gap-5 xl:grid-cols-2">
              {health?.providers.map((provider) => (
                <Card key={provider.id}>
                  <div className="flex items-start justify-between gap-4">
                    <div><h2 className="text-xl font-black">{provider.country} / {provider.currency}</h2><p className="mt-1 text-sm text-slate-500">{provider.provider}</p></div>
                    <Badge tone={provider.enabled ? "green" : "amber"}>{provider.enabled ? "Enabled" : "Disabled"}</Badge>
                  </div>
                  <div className="mt-6 grid gap-4 sm:grid-cols-2">
                    <Toggle label="Checkout enabled" checked={provider.enabled} onChange={(checked) => void update(provider, { enabled: checked })} />
                    <Toggle label="Payout supported" checked={provider.payoutSupported} onChange={(checked) => void update(provider, { payoutSupported: checked })} />
                    <label className="text-sm font-bold text-slate-700">OTP channel
                      <select value={provider.otpChannel} onChange={(event) => void update(provider, { otpChannel: event.target.value as EscrowProviderConfig["otpChannel"] })} className="mt-2 h-11 w-full rounded-xl border border-slate-300 px-3 font-normal">
                        <option value="SMS">SMS</option><option value="EMAIL">Email</option><option value="SMS_EMAIL">SMS + Email</option>
                      </select>
                    </label>
                    <label className="text-sm font-bold text-slate-700">Protection hours
                      <input type="number" min={1} max={336} defaultValue={provider.protectionWindowHours} onBlur={(event) => void update(provider, { protectionWindowHours: Number(event.target.value) })} className="mt-2 h-11 w-full rounded-xl border border-slate-300 px-3 font-normal" />
                    </label>
                  </div>
                  <p className="mt-5 text-xs text-slate-500">{savingId === provider.id ? "Saving..." : "Changes apply to new eligible checkouts."}</p>
                </Card>
              ))}
            </div>
          </div>
        )}
      </AdminLayout>
    </ProtectedRoute>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="flex h-11 items-center justify-between rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-700"><span>{label}</span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-5 w-5 accent-[#096B4A]" /></label>;
}
