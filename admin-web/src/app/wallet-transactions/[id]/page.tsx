"use client";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Button, Card, ErrorPanel, LoadingPanel, PageHeader } from "@/components/AdminUI";
import { apiClient, APIError } from "@/lib/api";
import { SUPPORTED_CURRENCIES, formatDisplayMoney, useAdminDisplayCurrency } from "@/lib/displayCurrency";

export default function WalletTxDetailPage() {
  const params = useParams(); const router = useRouter();
  const [tx, setTx] = useState<any>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const { selectedCurrency, setSelectedCurrency } = useAdminDisplayCurrency(tx?.currency ?? "GBP");
  const load = useCallback(async () => {
    try { setLoading(true); setError(""); const d = await apiClient.get<any>("/admin/wallet-transactions/" + params.id); setTx(d.transaction ?? d); }
    catch (err) { setError(err instanceof APIError ? err.message : "Failed"); } finally { setLoading(false); }
  }, [params.id]);
  useEffect(() => { void load(); }, [load]);
  if (loading) return <ProtectedRoute><AdminLayout><LoadingPanel /></AdminLayout></ProtectedRoute>;
  if (error) return <ProtectedRoute><AdminLayout><ErrorPanel message={error} onRetry={load} /></AdminLayout></ProtectedRoute>;
  if (!tx) return null;
  return (
    <ProtectedRoute><AdminLayout><div className="space-y-6">
      <PageHeader title="Wallet Transaction" subtitle={`ID: ${tx.id}`} actions={<Button variant="secondary" onClick={() => router.push("/wallet-transactions")}>← Back</Button>} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card><h2 className="text-lg font-bold mb-4">Transaction</h2>
          <div className="space-y-3">
            <div><span className="text-sm text-gray-500">Type</span><p className="font-bold">{tx.type}</p></div>
            <div><span className="text-sm text-gray-500">Amount</span><p className="font-bold">{formatDisplayMoney(tx.amount, tx.currency, selectedCurrency)}</p></div>
            <div><span className="text-sm text-gray-500">Description</span><p className="font-bold">{tx.description || "—"}</p></div>
            <div><span className="text-sm text-gray-500">Date</span><p className="font-bold">{tx.createdAt ? new Date(tx.createdAt).toLocaleString() : "—"}</p></div>
          </div></Card>
        {tx.vendor && <Card><h2 className="text-lg font-bold mb-4">Vendor</h2><div className="space-y-3">
          <div><span className="text-sm text-gray-500">Store</span><p className="font-bold">{tx.vendor.storeName}</p></div>
          <div><span className="text-sm text-gray-500">Email</span><p className="font-bold">{tx.vendor.contactEmail || "—"}</p></div>
          <div><span className="text-sm text-gray-500">Country</span><p className="font-bold">{tx.vendor.country || "—"}</p></div>
        </div></Card>}
        {tx.order && <Card><h2 className="text-lg font-bold mb-4">Order</h2><div className="space-y-3">
          <div><span className="text-sm text-gray-500">Order #</span><p className="font-bold">{tx.order.orderNumber}</p></div>
          <div><span className="text-sm text-gray-500">Status</span><p className="font-bold">{tx.order.status}</p></div>
          <div><span className="text-sm text-gray-500">Total</span><p className="font-bold">{formatDisplayMoney(tx.order.totalAmount, tx.order.currency, selectedCurrency)}</p></div>
        </div></Card>}
        {tx.payoutRequest && <Card><h2 className="text-lg font-bold mb-4">Payout Request</h2><div className="space-y-3">
          <div><span className="text-sm text-gray-500">Status</span><p className="font-bold">{tx.payoutRequest.status}</p></div>
          <div><span className="text-sm text-gray-500">Amount</span><p className="font-bold">{formatDisplayMoney(tx.payoutRequest.amount, tx.currency, selectedCurrency)}</p></div>
        </div></Card>}
      </div>
    </div></AdminLayout></ProtectedRoute>
  );
}
