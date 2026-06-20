"use client";
import { useCallback, useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Button, Card, ErrorPanel, Icon, LoadingPanel, PageHeader } from "@/components/AdminUI";
import ProtectedRoute from "@/components/ProtectedRoute";
import { apiClient, APIError } from "@/lib/api";
import { SUPPORTED_CURRENCIES, formatDisplayMoney, useAdminDisplayCurrency } from "@/lib/displayCurrency";
import { giftsAPI, Reward } from "@/lib/services/gifts.api";

interface GiftCard { id: string; title: string; description: string | null; priceAmount: number; currency: string; imageUrl: string | null; isActive: boolean; createdAt: string; }

export default function GiftCardsPage() {
  const [cards, setCards] = useState<GiftCard[]>([]);
  const [hotDeals, setHotDeals] = useState<Reward[]>([]);
  const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const [showDealForm, setShowDealForm] = useState(false);
  const [savingDeal, setSavingDeal] = useState(false);
  const [dealForm, setDealForm] = useState({ name: "", description: "", value: "", currency: "GBP", expiresAt: "", minOrderAmount: "" });
  const [editCard, setEditCard] = useState<GiftCard | null>(null);
  const [editForm, setEditForm] = useState({ title: "", priceAmount: "", currency: "GBP", isActive: true });
  const [savingCard, setSavingCard] = useState(false);
  const { selectedCurrency } = useAdminDisplayCurrency("EUR");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const [d, rewards] = await Promise.all([
        apiClient.get<{ giftCards: GiftCard[] }>("/admin/gift-cards"),
        giftsAPI.getGifts(),
      ]);
      setCards(d.giftCards ?? []);
      setHotDeals(rewards.filter((reward) => reward.isHotDeal));
    }
    catch (err) { setError(err instanceof APIError ? err.message : "Failed to load"); } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const saveHotDeal = async () => {
    if (!dealForm.name.trim() || !dealForm.value) {
      setError("Hot deal name and value are required.");
      return;
    }
    if (!dealForm.minOrderAmount || Number(dealForm.minOrderAmount) <= 0) {
      setError("Minimum order amount is required — buyer must spend at least this much to unlock the deal.");
      return;
    }
    try {
      setSavingDeal(true);
      setError("");
      await giftsAPI.createGift({
        name: dealForm.name.trim(),
        description: dealForm.description.trim() || undefined,
        type: "DISCOUNT_COUPON",
        value: Number(dealForm.value),
        currency: dealForm.currency,
        minOrderAmount: Number(dealForm.minOrderAmount),
        expiresAt: dealForm.expiresAt ? new Date(dealForm.expiresAt).toISOString() : undefined,
        isHotDeal: true,
      });
      setDealForm({ name: "", description: "", value: "", currency: "GBP", expiresAt: "", minOrderAmount: "" });
      setShowDealForm(false);
      await load();
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Failed to create hot deal");
    } finally {
      setSavingDeal(false);
    }
  };

  const openEditCard = (card: GiftCard) => {
    setEditCard(card);
    setEditForm({ title: card.title, priceAmount: String(card.priceAmount / 100), currency: card.currency, isActive: card.isActive });
  };

  const saveCard = async () => {
    if (!editCard) return;
    try {
      setSavingCard(true); setError("");
      await apiClient.patch(`/admin/gift-cards/${editCard.id}`, {
        title: editForm.title,
        priceAmount: Math.round(Number(editForm.priceAmount) * 100),
        currency: editForm.currency,
        isActive: editForm.isActive,
      });
      setEditCard(null);
      await load();
    } catch (err) { setError(err instanceof APIError ? err.message : "Failed to update gift card"); }
    finally { setSavingCard(false); }
  };

  const deleteCard = async (id: string) => {
    if (!window.confirm("Delete this gift card?")) return;
    try { await apiClient.delete(`/admin/gift-cards/${id}`); await load(); }
    catch (err) { setError(err instanceof APIError ? err.message : "Failed to delete"); }
  };

  const toggleHotDeal = async (deal: Reward) => {
    await giftsAPI.updateGift(deal.id, { isActive: !deal.isActive } as any);
    await load();
  };

  return (
    <ProtectedRoute><AdminLayout><div className="space-y-6">
      <PageHeader
        title="Gift Cards"
        subtitle="Manage purchasable gift cards and buyer Home hot deals"
        actions={<Button onClick={() => setShowDealForm((value) => !value)}><Icon name="plus" /> {showDealForm ? "Cancel" : "New Hot Deal"}</Button>}
      />
      {loading ? <LoadingPanel /> : error ? <ErrorPanel message={error} onRetry={load} /> : (
        <>
        {showDealForm ? (
          <Card>
            <h2 className="text-xl font-black">Create Hot Deal</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <input value={dealForm.name} onChange={(e) => setDealForm({ ...dealForm, name: e.target.value })} placeholder="Weekend Hot Deal" className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-[#096B4A]" />
              <input type="number" min="0" step="0.01" value={dealForm.value} onChange={(e) => setDealForm({ ...dealForm, value: e.target.value })} placeholder="Value e.g. 10.00" className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-[#096B4A]" />
              <select value={dealForm.currency} onChange={(e) => setDealForm({ ...dealForm, currency: e.target.value })} className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-[#096B4A]">
                {SUPPORTED_CURRENCIES.map((currency) => <option key={currency} value={currency}>{currency}</option>)}
              </select>
              <input type="datetime-local" value={dealForm.expiresAt} onChange={(e) => setDealForm({ ...dealForm, expiresAt: e.target.value })} className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-[#096B4A]" />
              <input type="number" min="0.01" step="0.01" required value={dealForm.minOrderAmount} onChange={(e) => setDealForm({ ...dealForm, minOrderAmount: e.target.value })} placeholder="Min order amount e.g. 25.00 (required)" className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-[#096B4A]" />
              <textarea value={dealForm.description} onChange={(e) => setDealForm({ ...dealForm, description: e.target.value })} rows={2} placeholder="Short message shown on buyer Home" className="sm:col-span-2 rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-[#096B4A]" />
            </div>
            <p className="mt-2 text-xs text-slate-500">Condition: buyer must spend at least this amount in one order to unlock the deal.</p>
            <div className="mt-4 flex gap-3">
              <Button disabled={savingDeal} onClick={() => void saveHotDeal()}>{savingDeal ? "Saving..." : "Create Hot Deal"}</Button>
              <Button variant="ghost" onClick={() => setShowDealForm(false)}>Cancel</Button>
            </div>
          </Card>
        ) : null}

        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-black">Hot Deals</h2>
            <span className="text-sm text-slate-500">Shown on buyer Home</span>
          </div>
          {hotDeals.length === 0 ? (
            <div className="rounded-2xl bg-slate-50 p-8 text-center text-slate-500">No hot deals created yet.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {hotDeals.map((deal) => (
                <div key={deal.id} className="flex items-center gap-4 py-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-black">{deal.name}</span>
                      <span className={`h-2.5 w-2.5 rounded-full ${deal.isActive ? "bg-green-500" : "bg-slate-300"}`} />
                    </div>
                    <p className="text-sm text-slate-500">
                      {formatDisplayMoney(deal.value, deal.currency, selectedCurrency)}
                      {deal.minOrderAmount ? ` · Min spend ${formatDisplayMoney(deal.minOrderAmount, deal.currency, selectedCurrency)}` : ""}
                      {deal.description ? ` · ${deal.description}` : ""}
                    </p>
                  </div>
                  <Button variant="ghost" onClick={() => void toggleHotDeal(deal)}>{deal.isActive ? "Pause" : "Activate"}</Button>
                  <Button variant="danger" onClick={async () => { await giftsAPI.deleteGift(deal.id); await load(); }}>Delete</Button>
                </div>
              ))}
            </div>
          )}
        </Card>

        {editCard && (
          <Card>
            <h2 className="text-xl font-black mb-4">Edit Gift Card</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <input value={editForm.title} onChange={e => setEditForm({ ...editForm, title: e.target.value })} placeholder="Title" className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-[#096B4A]" />
              <input type="number" min="0" step="0.01" value={editForm.priceAmount} onChange={e => setEditForm({ ...editForm, priceAmount: e.target.value })} placeholder="Price e.g. 10.00" className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-[#096B4A]" />
              <select value={editForm.currency} onChange={e => setEditForm({ ...editForm, currency: e.target.value })} className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-[#096B4A]">
                {SUPPORTED_CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <label className="flex items-center gap-2 px-4 py-3">
                <input type="checkbox" checked={editForm.isActive} onChange={e => setEditForm({ ...editForm, isActive: e.target.checked })} className="h-4 w-4" />
                <span className="text-sm">Active</span>
              </label>
            </div>
            <div className="mt-4 flex gap-3">
              <Button disabled={savingCard} onClick={() => void saveCard()}>{savingCard ? "Saving..." : "Save"}</Button>
              <Button variant="ghost" onClick={() => setEditCard(null)}>Cancel</Button>
            </div>
          </Card>
        )}

        <Card><div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50"><tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Title</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Price</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Active</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Created</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Actions</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-200">
              {cards.map(c => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{c.title}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{formatDisplayMoney(c.priceAmount / 100, c.currency, selectedCurrency)}</td>
                  <td className="px-6 py-4 text-sm">{c.isActive ? "✅" : "❌"}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{new Date(c.createdAt).toLocaleDateString()}</td>
                  <td className="px-6 py-4 text-sm flex gap-2">
                    <Button variant="ghost" onClick={() => openEditCard(c)}>Edit</Button>
                    <Button variant="danger" onClick={() => void deleteCard(c.id)}>Delete</Button>
                  </td>
                </tr>
              ))}
              {cards.length === 0 && <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-500">No gift cards created yet.</td></tr>}
            </tbody>
          </table>
        </div></Card>
        </>
      )}
    </div></AdminLayout></ProtectedRoute>
  );
}
