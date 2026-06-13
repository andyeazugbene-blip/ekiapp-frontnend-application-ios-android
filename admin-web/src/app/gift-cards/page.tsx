"use client";
import { useCallback, useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Button, Card, ErrorPanel, Icon, LoadingPanel, PageHeader } from "@/components/AdminUI";
import ProtectedRoute from "@/components/ProtectedRoute";
import { apiClient, APIError } from "@/lib/api";
import { SUPPORTED_CURRENCIES, formatDisplayMoney, useAdminDisplayCurrency } from "@/lib/displayCurrency";

interface GiftCard { id: string; title: string; description: string | null; priceAmount: number; currency: string; imageUrl: string | null; isActive: boolean; createdAt: string; }

export default function GiftCardsPage() {
  const [cards, setCards] = useState<GiftCard[]>([]);
  const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const { selectedCurrency } = useAdminDisplayCurrency("EUR");

  const load = useCallback(async () => {
    try { setLoading(true); setError(""); const d = await apiClient.get<{ giftCards: GiftCard[] }>("/admin/gift-cards"); setCards(d.giftCards ?? []); }
    catch (err) { setError(err instanceof APIError ? err.message : "Failed to load"); } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  return (
    <ProtectedRoute><AdminLayout><div className="space-y-6">
      <PageHeader title="Gift Cards" subtitle="Manage purchasable gift cards for buyers" />
      {loading ? <LoadingPanel /> : error ? <ErrorPanel message={error} onRetry={load} /> : (
        <Card><div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50"><tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Title</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Price</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Active</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Created</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-200">
              {cards.map(c => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{c.title}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{formatDisplayMoney(c.priceAmount / 100, c.currency, selectedCurrency)}</td>
                  <td className="px-6 py-4 text-sm">{c.isActive ? "✅" : "❌"}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{new Date(c.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
              {cards.length === 0 && <tr><td colSpan={4} className="px-6 py-12 text-center text-gray-500">No gift cards created yet.</td></tr>}
            </tbody>
          </table>
        </div></Card>
      )}
    </div></AdminLayout></ProtectedRoute>
  );
}
