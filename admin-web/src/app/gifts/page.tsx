"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Button, Card, ErrorPanel, Icon, LoadingPanel, PageHeader } from "@/components/AdminUI";
import ProtectedRoute from "@/components/ProtectedRoute";
import { giftsAPI, Reward, RewardType } from "@/lib/services/gifts.api";
import { APIError } from "@/lib/api";

const GIFT_TYPES: { id: RewardType; label: string }[] = [
  { id: "WALLET_BONUS", label: "Wallet Bonus" },
  { id: "DISCOUNT_COUPON", label: "Discount Coupon" },
  { id: "FREE_SHIPPING", label: "Free Shipping" },
];

const EMPTY_FORM = {
  kind: "GIFT" as "GIFT" | "HOT_DEAL",
  name: "",
  description: "",
  type: "WALLET_BONUS" as RewardType,
  value: "",
  currency: "GBP",
  minOrderAmount: "",
  maxClaims: "",
  expiresAt: "",
};

export default function GiftsPage() {
  const [gifts, setGifts] = useState<Reward[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const loadGifts = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      setGifts(await giftsAPI.getGifts());
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Failed to load gifts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadGifts();
  }, [loadGifts]);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(false);
  };

  const handleEdit = (gift: Reward) => {
    setForm({
      kind: gift.isHotDeal ? "HOT_DEAL" : "GIFT",
      name: gift.name,
      description: gift.description ?? "",
      type: gift.type,
      value: String(gift.value),
      currency: gift.currency,
      minOrderAmount: gift.minOrderAmount ? String(gift.minOrderAmount) : "",
      maxClaims: gift.maxClaims ? String(gift.maxClaims) : "",
      expiresAt: gift.expiresAt ? gift.expiresAt.slice(0, 16) : "",
    });
    setEditingId(gift.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.value) {
      setError("Name and value are required.");
      return;
    }
    try {
      setSubmitting(true);
      setError("");
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        type: form.type,
        value: Number(form.value),
        currency: form.currency,
        minOrderAmount: form.minOrderAmount ? Number(form.minOrderAmount) : undefined,
        maxClaims: form.maxClaims ? Number(form.maxClaims) : undefined,
        expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : undefined,
        isHotDeal: form.kind === "HOT_DEAL",
      };
      if (editingId) {
        await giftsAPI.updateGift(editingId, payload);
      } else {
        await giftsAPI.createGift(payload);
      }
      resetForm();
      await loadGifts();
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Failed to save gift");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this gift? This cannot be undone.")) return;
    try {
      await giftsAPI.deleteGift(id);
      await loadGifts();
    } catch (err) {
      alert(err instanceof APIError ? err.message : "Failed to delete gift");
    }
  };

  const handleToggle = async (gift: Reward) => {
    try {
      await giftsAPI.updateGift(gift.id, { isActive: !gift.isActive } as any);
      await loadGifts();
    } catch (err) {
      alert(err instanceof APIError ? err.message : "Failed to update gift");
    }
  };

  return (
    <ProtectedRoute>
      <AdminLayout>
        {loading ? (
          <LoadingPanel label="Loading gifts..." />
        ) : (
          <div className="space-y-8">
            <PageHeader
              title="Gifts & Rewards"
              subtitle="Create and manage welcome gifts, referral rewards, and promotions."
              actions={
                <Button onClick={() => { resetForm(); setShowForm(!showForm); }}>
                  <Icon name="plus" /> {showForm ? "Cancel" : "New Gift"}
                </Button>
              }
            />

            {error ? <ErrorPanel message={error} onRetry={() => setError("")} /> : null}

            {showForm && (
              <Card>
                <h2 className="text-xl font-black">{editingId ? "Edit gift" : "New gift"}</h2>
                <div className="mt-6 space-y-4">
                  <div>
                    <label className="mb-2 block text-sm font-bold text-gray-700">Promotion kind</label>
                    <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as "GIFT" | "HOT_DEAL", type: e.target.value === "HOT_DEAL" ? "DISCOUNT_COUPON" : form.type })} className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-[#096B4A]">
                      <option value="GIFT">Gift / Reward</option>
                      <option value="HOT_DEAL">Hot Deal</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-bold text-gray-700">Name *</label>
                    <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={form.kind === "HOT_DEAL" ? "Weekend Hot Deal" : "Welcome Gift"} className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-[#096B4A]" />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-bold text-gray-700">Description</label>
                    <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} placeholder="Gift description..." className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-[#096B4A]" />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-bold text-gray-700">Type *</label>
                      <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as RewardType })} className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-[#096B4A]">
                        {GIFT_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-bold text-gray-700">Currency</label>
                      <select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-[#096B4A]">
                        <option value="GBP">GBP</option><option value="USD">USD</option><option value="EUR">EUR</option><option value="NGN">NGN</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-bold text-gray-700">Value *</label>
                      <input type="number" min="0" step="0.01" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} placeholder="10.00" className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-[#096B4A]" />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-bold text-gray-700">Min order amount</label>
                      <input type="number" min="0" step="0.01" value={form.minOrderAmount} onChange={(e) => setForm({ ...form, minOrderAmount: e.target.value })} placeholder="Optional" className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-[#096B4A]" />
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-bold text-gray-700">Max claims</label>
                      <input type="number" min="1" value={form.maxClaims} onChange={(e) => setForm({ ...form, maxClaims: e.target.value })} placeholder="Unlimited" className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-[#096B4A]" />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-bold text-gray-700">Expires at</label>
                      <input type="datetime-local" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-[#096B4A]" />
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <Button disabled={submitting} onClick={() => void handleSave()} className="flex-1">
                      {submitting ? "Saving..." : editingId ? "Update gift" : "Create gift"}
                    </Button>
                    <Button variant="ghost" onClick={resetForm} className="flex-1">Cancel</Button>
                  </div>
                </div>
              </Card>
            )}

            <Card className="p-0">
              {gifts.length === 0 ? (
                <div className="p-12 text-center text-slate-500">No gifts created yet. Create one to offer welcome rewards to new buyers.</div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {gifts.map((gift) => (
                    <div key={gift.id} className="flex items-center gap-6 p-6">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <span className="text-lg font-black">{gift.name}</span>
                          <span className={`h-2.5 w-2.5 rounded-full ${gift.isActive ? "bg-green-500" : "bg-slate-300"}`} />
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${gift.isHotDeal ? "bg-orange-100 text-orange-700" : "bg-slate-100 text-slate-600"}`}>{gift.isHotDeal ? "Hot Deal" : gift.type.replace(/_/g, " ")}</span>
                        </div>
                        <p className="mt-1 text-sm text-slate-500">
                          {gift.currency} {(gift.value).toFixed(2)} value
                          {gift.minOrderAmount ? ` · Min order ${gift.currency} ${gift.minOrderAmount.toFixed(2)}` : ""}
                          {gift.maxClaims ? ` · ${gift.claimedCount}/${gift.maxClaims} claimed` : ` · ${gift.claimedCount} claimed`}
                          {gift.expiresAt ? ` · Expires ${new Date(gift.expiresAt).toLocaleDateString()}` : ""}
                        </p>
                        {gift.description && <p className="mt-1 text-xs text-slate-400">{gift.description}</p>}
                      </div>
                      <div className="flex gap-2">
                        <Button variant="ghost" onClick={() => handleToggle(gift)}>
                          {gift.isActive ? "Pause" : "Activate"}
                        </Button>
                        <Button variant="ghost" onClick={() => handleEdit(gift)}>
                          <Icon name="settings" />
                        </Button>
                        <Button variant="danger" onClick={() => void handleDelete(gift.id)}>Delete</Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        )}
      </AdminLayout>
    </ProtectedRoute>
  );
}
