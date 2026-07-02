"use client";
import { useCallback, useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Button, Card, ErrorPanel, Icon, LoadingPanel, PageHeader } from "@/components/AdminUI";
import ProtectedRoute from "@/components/ProtectedRoute";
import { apiClient, APIError } from "@/lib/api";

interface Campaign {
  id: string;
  name: string;
  type: "HOT_DEAL" | "GIFT_CARD";
  active: boolean;
  priority: number;
  colorTheme: string | null;
  title: string;
  subtitle: string | null;
  image: string | null;
  startDate: string | null;
  endDate: string | null;
  minimumCartAmountCents: number | null;
  requiredProductIds: string[];
  requiredCategoryIds: string[];
  minimumOrders: number | null;
  minimumSpendCents: number | null;
  newCustomerOnly: boolean;
  discountType: "PERCENTAGE" | "FIXED_AMOUNT" | null;
  discountValue: number | null;
  createdAt: string;
}

const EMPTY_FORM = {
  name: "",
  type: "HOT_DEAL" as "HOT_DEAL" | "GIFT_CARD",
  active: true,
  priority: 0,
  colorTheme: "",
  title: "",
  subtitle: "",
  image: "",
  startDate: "",
  endDate: "",
  minimumCartAmountCents: "",
  requiredProductIds: "",
  requiredCategoryIds: "",
  minimumOrders: "",
  minimumSpendCents: "",
  newCustomerOnly: false,
  discountType: "" as "" | "PERCENTAGE" | "FIXED_AMOUNT",
  discountValue: "",
};

function toFormFromCampaign(c: Campaign) {
  return {
    name: c.name,
    type: c.type,
    active: c.active,
    priority: c.priority,
    colorTheme: c.colorTheme ?? "",
    title: c.title,
    subtitle: c.subtitle ?? "",
    image: c.image ?? "",
    startDate: c.startDate ? c.startDate.slice(0, 16) : "",
    endDate: c.endDate ? c.endDate.slice(0, 16) : "",
    minimumCartAmountCents: c.minimumCartAmountCents != null ? String(c.minimumCartAmountCents / 100) : "",
    requiredProductIds: c.requiredProductIds.join(", "),
    requiredCategoryIds: c.requiredCategoryIds.join(", "),
    minimumOrders: c.minimumOrders != null ? String(c.minimumOrders) : "",
    minimumSpendCents: c.minimumSpendCents != null ? String(c.minimumSpendCents / 100) : "",
    newCustomerOnly: c.newCustomerOnly,
    discountType: (c.discountType ?? "") as "" | "PERCENTAGE" | "FIXED_AMOUNT",
    discountValue:
      c.discountValue == null
        ? ""
        : c.discountType === "FIXED_AMOUNT"
          ? String(c.discountValue / 100)
          : String(c.discountValue),
  };
}

function toPayload(form: typeof EMPTY_FORM) {
  return {
    name: form.name.trim(),
    type: form.type,
    active: form.active,
    priority: Number(form.priority) || 0,
    colorTheme: form.colorTheme.trim() || null,
    title: form.title.trim(),
    subtitle: form.subtitle.trim() || null,
    image: form.image.trim() || null,
    startDate: form.startDate ? new Date(form.startDate).toISOString() : null,
    endDate: form.endDate ? new Date(form.endDate).toISOString() : null,
    minimumCartAmountCents: form.minimumCartAmountCents ? Math.round(Number(form.minimumCartAmountCents) * 100) : null,
    requiredProductIds: form.requiredProductIds.split(",").map((s) => s.trim()).filter(Boolean),
    requiredCategoryIds: form.requiredCategoryIds.split(",").map((s) => s.trim()).filter(Boolean),
    minimumOrders: form.minimumOrders ? Number(form.minimumOrders) : null,
    minimumSpendCents: form.minimumSpendCents ? Math.round(Number(form.minimumSpendCents) * 100) : null,
    newCustomerOnly: form.newCustomerOnly,
    discountType: form.discountType || null,
    discountValue: !form.discountType || !form.discountValue
      ? null
      : form.discountType === "FIXED_AMOUNT"
        ? Math.round(Number(form.discountValue) * 100)
        : Math.round(Number(form.discountValue)),
  };
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const res = await apiClient.get<{ campaigns: Campaign[] }>("/admin/campaigns");
      setCampaigns(res.campaigns ?? []);
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Failed to load campaigns");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = (c: Campaign) => {
    setEditingId(c.id);
    setForm(toFormFromCampaign(c));
    setShowForm(true);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const save = async () => {
    if (!form.name.trim() || !form.title.trim()) {
      setError("Name and title are required.");
      return;
    }
    try {
      setSaving(true);
      setError("");
      const payload = toPayload(form);
      if (editingId) {
        await apiClient.patch(`/admin/campaigns/${editingId}`, payload);
      } else {
        await apiClient.post("/admin/campaigns", payload);
      }
      setShowForm(false);
      setEditingId(null);
      await load();
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Failed to save campaign");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (c: Campaign) => {
    try {
      await apiClient.patch(`/admin/campaigns/${c.id}`, { active: !c.active });
      await load();
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Failed to update campaign");
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm("Delete this campaign?")) return;
    try {
      await apiClient.delete(`/admin/campaigns/${id}`);
      await load();
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Failed to delete campaign");
    }
  };

  const inputClass = "rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-[#096B4A]";

  return (
    <ProtectedRoute><AdminLayout><div className="space-y-6">
      <PageHeader
        title="Campaigns"
        subtitle="Admin-controlled Hot Deals & Gift Cards eligibility engine — enforced server-side"
        actions={<Button onClick={openCreate}><Icon name="plus" /> New Campaign</Button>}
      />

      {error ? <ErrorPanel message={error} onRetry={load} /> : null}

      {showForm ? (
        <Card>
          <h2 className="text-xl font-black">{editingId ? "Edit Campaign" : "New Campaign"}</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <input className={inputClass} placeholder="Internal name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <select className={inputClass} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as "HOT_DEAL" | "GIFT_CARD" })}>
              <option value="HOT_DEAL">Hot Deal</option>
              <option value="GIFT_CARD">Gift Card</option>
            </select>
            <input className={inputClass} placeholder="Title (shown to buyer)" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <input className={inputClass} placeholder="Subtitle (optional)" value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} />
            <input className={inputClass} placeholder="Image URL (optional)" value={form.image} onChange={(e) => setForm({ ...form, image: e.target.value })} />
            <input className={inputClass} placeholder="Color theme (e.g. yellow, red, themed)" value={form.colorTheme} onChange={(e) => setForm({ ...form, colorTheme: e.target.value })} />
            <input type="number" className={inputClass} placeholder="Priority (1 = first / yellow)" value={form.priority} onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })} />
            <label className="flex items-center gap-2 px-4 py-3">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="h-4 w-4" />
              <span className="text-sm">Active</span>
            </label>
            <input type="datetime-local" className={inputClass} value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            <input type="datetime-local" className={inputClass} value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
          </div>

          <h3 className="mt-6 text-sm font-bold uppercase text-slate-500">Eligibility rules</h3>
          <p className="text-xs text-slate-400">Leave blank to skip a rule. All rules enforced server-side — buyer never decides eligibility.</p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <input type="number" min="0" step="0.01" className={inputClass} placeholder="Minimum cart amount (e.g. 50.00)" value={form.minimumCartAmountCents} onChange={(e) => setForm({ ...form, minimumCartAmountCents: e.target.value })} />
            <input type="number" min="0" step="0.01" className={inputClass} placeholder="Minimum lifetime spend" value={form.minimumSpendCents} onChange={(e) => setForm({ ...form, minimumSpendCents: e.target.value })} />
            <input type="number" min="0" className={inputClass} placeholder="Minimum paid orders" value={form.minimumOrders} onChange={(e) => setForm({ ...form, minimumOrders: e.target.value })} />
            <label className="flex items-center gap-2 px-4 py-3">
              <input type="checkbox" checked={form.newCustomerOnly} onChange={(e) => setForm({ ...form, newCustomerOnly: e.target.checked })} className="h-4 w-4" />
              <span className="text-sm">New customers only (zero prior paid orders)</span>
            </label>
            <input className={inputClass} placeholder="Required product IDs (comma separated)" value={form.requiredProductIds} onChange={(e) => setForm({ ...form, requiredProductIds: e.target.value })} />
            <input className={inputClass} placeholder="Required category names (comma separated)" value={form.requiredCategoryIds} onChange={(e) => setForm({ ...form, requiredCategoryIds: e.target.value })} />
          </div>

          <h3 className="mt-6 text-sm font-bold uppercase text-slate-500">Checkout discount</h3>
          <p className="text-xs text-slate-400">Auto-applied at checkout for eligible buyers. Platform-funded — vendor payout is unaffected. Leave blank for no discount.</p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <select
              className={inputClass}
              value={form.discountType}
              onChange={(e) => setForm({ ...form, discountType: e.target.value as "" | "PERCENTAGE" | "FIXED_AMOUNT", discountValue: "" })}
            >
              <option value="">No discount</option>
              <option value="PERCENTAGE">Percentage off</option>
              <option value="FIXED_AMOUNT">Fixed amount off</option>
            </select>
            <input
              type="number"
              min="0"
              step={form.discountType === "FIXED_AMOUNT" ? "0.01" : "1"}
              className={inputClass}
              placeholder={form.discountType === "PERCENTAGE" ? "Percent off (1-100)" : "Amount off (e.g. 10.00)"}
              value={form.discountValue}
              disabled={!form.discountType}
              onChange={(e) => setForm({ ...form, discountValue: e.target.value })}
            />
          </div>

          <div className="mt-4 flex gap-3">
            <Button disabled={saving} onClick={() => void save()}>{saving ? "Saving..." : "Save Campaign"}</Button>
            <Button variant="ghost" onClick={() => { setShowForm(false); setEditingId(null); }}>Cancel</Button>
          </div>
        </Card>
      ) : null}

      {loading ? <LoadingPanel /> : (
        <Card><div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50"><tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Title</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Priority</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Window</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Discount</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Active</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Actions</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-200">
              {campaigns.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => openEdit(c)}>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900 hover:text-[#096B4A]">{c.title}<div className="text-xs text-gray-400">{c.name}</div></td>
                  <td className="px-6 py-4 text-sm text-gray-700">{c.type === "HOT_DEAL" ? "Hot Deal" : "Gift Card"}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{c.priority}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {c.startDate ? new Date(c.startDate).toLocaleDateString() : "—"} → {c.endDate ? new Date(c.endDate).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">
                    {c.discountType && c.discountValue != null
                      ? c.discountType === "PERCENTAGE"
                        ? `${c.discountValue}% off`
                        : `$${(c.discountValue / 100).toFixed(2)} off`
                      : "—"}
                  </td>
                  <td className="px-6 py-4 text-sm">{c.active ? "✅" : "❌"}</td>
                  <td className="px-6 py-4 text-sm flex gap-2" onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" onClick={() => openEdit(c)}>Edit</Button>
                    <Button variant="ghost" onClick={() => void toggleActive(c)}>{c.active ? "Pause" : "Activate"}</Button>
                    <Button variant="danger" onClick={() => void remove(c.id)}>Delete</Button>
                  </td>
                </tr>
              ))}
              {campaigns.length === 0 && <tr><td colSpan={7} className="px-6 py-12 text-center text-gray-500">No campaigns created yet.</td></tr>}
            </tbody>
          </table>
        </div></Card>
      )}
    </div></AdminLayout></ProtectedRoute>
  );
}
