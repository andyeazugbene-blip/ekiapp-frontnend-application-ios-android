"use client";

import { useCallback, useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Button, Card, ErrorPanel, Icon, LoadingPanel, PageHeader } from "@/components/AdminUI";
import ProtectedRoute from "@/components/ProtectedRoute";
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
    try {
      setSubmitting(true);
      setError("");
      const payload = {
        name: form.name.trim(),
        country: form.country.trim(),
        flag: form.flag.trim() || undefined,
        baseFeeAmount: Number(form.baseFeeAmount),
        feePerKgAmount: form.feePerKgAmount ? Number(form.feePerKgAmount) : undefined,
      };
      if (editingId) {
        await deliveryZonesAPI.updateZone(editingId, payload);
      } else {
        await deliveryZonesAPI.createZone(payload);
      }
      resetForm();
      await loadZones();
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Failed to save delivery zone");
    } finally {
      setSubmitting(false);
    }
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
    if (!confirm("Delete this delivery zone?")) return;
    try {
      await deliveryZonesAPI.deleteZone(zoneId);
      await loadZones();
    } catch (err) {
      alert(err instanceof APIError ? err.message : "Failed to delete delivery zone");
    }
  };

  const handleToggleActive = async (zone: DeliveryZone) => {
    try {
      await deliveryZonesAPI.updateZone(zone.id, { isActive: !zone.isActive });
      await loadZones();
    } catch (err) {
      alert(err instanceof APIError ? err.message : "Failed to update zone");
    }
  };

  const [fixingCurrencies, setFixingCurrencies] = useState(false);
  const handleFixCurrencies = async () => {
    try {
      setFixingCurrencies(true);
      const result = await deliveryZonesAPI.fixCurrencies();
      if (result.corrected === 0) {
        alert(`Checked ${result.checked} zones — all currencies already match their country.`);
      } else {
        const lines = result.corrections.map((c) => `${c.country}: ${c.from.toUpperCase()} → ${c.to}`).join("\n");
        alert(`Checked ${result.checked} zones, fixed ${result.corrected}:\n${lines}`);
      }
      await loadZones();
    } catch (err) {
      alert(err instanceof APIError ? err.message : "Failed to fix currencies");
    } finally {
      setFixingCurrencies(false);
    }
  };

  return (
    <ProtectedRoute>
      <AdminLayout>
        {loading ? (
          <LoadingPanel label="Loading delivery zones..." />
        ) : (
          <div className="space-y-8">
            <PageHeader
              title="Delivery zones"
              subtitle="Manage global delivery zones and shipping fee rules."
              actions={
                <Button variant="secondary" disabled={fixingCurrencies} onClick={() => void handleFixCurrencies()}>
                  {fixingCurrencies ? "Checking..." : "Fix mismatched currencies"}
                </Button>
              }
            />

            {error ? <ErrorPanel message={error} onRetry={() => setError("")} /> : null}

            <div className="grid gap-8 lg:grid-cols-[420px,1fr]">
              <Card>
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
              </Card>

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
                        <div className="flex gap-2">
                          <Button variant="ghost" onClick={() => handleToggleActive(zone)}>
                            {zone.isActive ? "Pause" : "Activate"}
                          </Button>
                          <Button variant="ghost" onClick={() => handleEdit(zone)}>
                            <Icon name="settings" />
                          </Button>
                          <Button variant="danger" onClick={() => void handleDelete(zone.id)}>
                            Delete
                          </Button>
                        </div>
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
