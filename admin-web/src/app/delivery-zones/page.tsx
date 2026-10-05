"use client";

import { useCallback, useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Button, Card, ErrorPanel, Icon, LoadingPanel, PageHeader } from "@/components/AdminUI";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Banner, useConfirm } from "@/components/AdminKit";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { deliveryZonesAPI, DeliveryZone } from "@/lib/services/delivery-zones.api";
import { APIError } from "@/lib/api";

const EMPTY_FORM = {
  name: "",
  country: "",
  flag: "",
  baseFeeAmount: "",
  feePerKgAmount: "",
};

export default function DeliveryZonesPage() {
  const confirm = useConfirm();
  // Backend: list = delivery_zones.read; create / edit / pause / delete / repair = delivery_zones.mutate.
  const { has, loading: permLoading } = usePermissions();
  const canMutate = has("delivery_zones.mutate");
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);

  const loadZones = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      setZones(await deliveryZonesAPI.getZones());
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Failed to load delivery zones");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadZones();
  }, [loadZones]);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.country.trim() || !form.baseFeeAmount) {
      setError("Name, country, and base fee are required.");
      return;
    }
    setError("");
    const payload = {
      name: form.name.trim(),
      country: form.country.trim(),
      flag: form.flag.trim() || undefined,
      baseFeeAmount: Number(form.baseFeeAmount),
      feePerKgAmount: form.feePerKgAmount ? Number(form.feePerKgAmount) : undefined,
    };
    confirm.ask(
      { title: editingId ? `Save changes to ${payload.name}?` : `Create delivery zone ${payload.name}?`, description: "Delivery fees affect checkout totals. The reason is recorded in the audit log.", confirmLabel: "Save", tone: "primary" },
      async (reason) => {
        setSubmitting(true);
        try {
          if (editingId) {
            await deliveryZonesAPI.updateZone(editingId, payload, reason);
          } else {
            await deliveryZonesAPI.createZone({ ...payload, reason });
          }
          resetForm();
          await loadZones();
        } finally {
          setSubmitting(false);
        }
      },
    );
  };

  const handleEdit = (zone: DeliveryZone) => {
    setForm({
      name: zone.name,
      country: zone.country,
      flag: zone.flag ?? "",
      baseFeeAmount: String(zone.baseFeeAmount),
      feePerKgAmount: String(zone.feePerKgAmount),
    });
    setEditingId(zone.id);
  };

  const handleDelete = async (zoneId: string) => {
    const zone = zones.find((z) => z.id === zoneId);
    confirm.ask({ title: `Delete ${zone?.name ?? "this delivery zone"}?`, confirmLabel: "Delete zone" }, async (reason) => {
      await deliveryZonesAPI.deleteZone(zoneId, reason);
      await loadZones();
    });
  };

  const handleToggleActive = async (zone: DeliveryZone) => {
    confirm.ask(
      { title: `${zone.isActive ? "Deactivate" : "Activate"} ${zone.name}?`, confirmLabel: zone.isActive ? "Deactivate" : "Activate", tone: zone.isActive ? "danger" : "primary" },
      async (reason) => {
        await deliveryZonesAPI.updateZone(zone.id, { isActive: !zone.isActive }, reason);
        await loadZones();
      },
    );
  };

  const [fixingCurrencies, setFixingCurrencies] = useState(false);
  const handleFixCurrencies = async () => {
    confirm.ask(
      { title: "Re-derive currencies from country?", description: "Corrects any zone whose stored currency does not match its country.", confirmLabel: "Run repair", tone: "primary" },
      async (reason) => {
        setFixingCurrencies(true);
        try {
          const result = await deliveryZonesAPI.fixCurrencies(reason);
          setError(
            result.corrected === 0
              ? ""
              : "",
          );
          setRepairNote(
            result.corrected === 0
              ? `Checked ${result.checked} zones: all currencies already match their country.`
              : `Checked ${result.checked} zones, fixed ${result.corrected}: ${result.corrections.map((c) => `${c.country} ${c.from.toUpperCase()} to ${c.to}`).join(", ")}`,
          );
          await loadZones();
        } finally {
          setFixingCurrencies(false);
        }
      },
    );
  };
  const [repairNote, setRepairNote] = useState("");

  return (
    <ProtectedRoute>
      <AdminLayout>
        {loading ? (
          <LoadingPanel label="Loading delivery zones..." />
        ) : (
          <div className="space-y-8">
            {confirm.dialog}
            {repairNote ? <div role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900">{repairNote}</div> : null}
            <PageHeader
              title="Delivery zones"
              subtitle="Manage global delivery zones and shipping fee rules."
              actions={
                !canMutate ? null : <Button variant="secondary" disabled={fixingCurrencies} onClick={() => void handleFixCurrencies()}>
                  {fixingCurrencies ? "Checking..." : "Fix mismatched currencies"}
                </Button>
              }
            />

            {error ? <ErrorPanel message={error} onRetry={() => setError("")} /> : null}
            {!permLoading && !canMutate ? <Banner tone="info">Your role can view delivery zones but cannot change them.</Banner> : null}

            <div className={canMutate ? "grid gap-8 lg:grid-cols-[420px,1fr]" : "grid gap-8"}>
              {canMutate ? <Card>
                <h2 className="text-xl font-black">{editingId ? "Edit zone" : "Add zone"}</h2>
                <div className="mt-6 space-y-4">
                  <div>
                    <label className="mb-2 block text-sm font-bold text-gray-700">Zone name *</label>
                    <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Lagos Mainland" className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-[#096B4A]" />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-bold text-gray-700">Country *</label>
                      <input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} placeholder="e.g. Nigeria" className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-[#096B4A]" />
                      <p className="mt-1 text-xs text-slate-400">Currency is derived from this on save — not client-settable.</p>
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-bold text-gray-700">Flag (optional)</label>
                      <input value={form.flag} onChange={(e) => setForm({ ...form, flag: e.target.value })} placeholder="e.g. 🇳🇬" className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-[#096B4A]" />
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-bold text-gray-700">Base fee *</label>
                      <input type="number" min="0" step="0.01" value={form.baseFeeAmount} onChange={(e) => setForm({ ...form, baseFeeAmount: e.target.value })} placeholder="e.g. 5.00" className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-[#096B4A]" />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-bold text-gray-700">Fee per kg</label>
                      <input type="number" min="0" step="0.01" value={form.feePerKgAmount} onChange={(e) => setForm({ ...form, feePerKgAmount: e.target.value })} placeholder="e.g. 1.50" className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-[#096B4A]" />
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <Button disabled={submitting} onClick={() => void handleSave()} className="flex-1">
                      {submitting ? "Saving..." : editingId ? "Update zone" : "Add zone"}
                    </Button>
                    {editingId && (
                      <Button variant="ghost" onClick={resetForm} className="flex-1">Cancel</Button>
                    )}
                  </div>
                </div>
              </Card> : null}

              <Card className="p-0">
                {zones.length === 0 ? (
                  <div className="p-12 text-center text-slate-500">No delivery zones configured yet.</div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {zones.map((zone) => (
                      <div key={zone.id} className="flex items-center gap-6 p-6">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            {zone.flag ? <span>{zone.flag}</span> : null}
                            <span className="text-lg font-black">{zone.name}</span>
                            <span className={`h-2.5 w-2.5 rounded-full ${zone.isActive ? "bg-green-500" : "bg-slate-300"}`} />
                          </div>
                          <p className="mt-1 text-sm text-slate-500">{zone.country}</p>
                          <p className="mt-1 text-sm text-slate-500">
                            {zone.currency} {zone.baseFeeAmount.toFixed(2)} base{zone.feePerKgAmount > 0 ? ` + ${zone.feePerKgAmount.toFixed(2)}/kg` : ""}
                          </p>
                        </div>
                        {canMutate ? <div className="flex gap-2">
                          <Button variant="ghost" onClick={() => handleToggleActive(zone)}>
                            {zone.isActive ? "Pause" : "Activate"}
                          </Button>
                          <Button variant="ghost" onClick={() => handleEdit(zone)}>
                            <Icon name="settings" />
                          </Button>
                          <Button variant="danger" onClick={() => void handleDelete(zone.id)}>
                            Delete
                          </Button>
                        </div> : null}
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          </div>
        )}
      </AdminLayout>
    </ProtectedRoute>
  );
}
