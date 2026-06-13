"use client";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Button, Card, ErrorPanel, LoadingPanel, PageHeader } from "@/components/AdminUI";
import { apiClient, APIError } from "@/lib/api";
import { formatDisplayMoney } from "@/lib/displayCurrency";

export default function PaymentDetailPage() {
  const params = useParams(); const router = useRouter();
  const [payment, setPayment] = useState<any>(null);
  const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const load = useCallback(async () => {
    try { setLoading(true); setError(""); const d = await apiClient.get<any>("/admin/payments/" + params.id); setPayment(d.payment ?? d); }
    catch (err) { setError(err instanceof APIError ? err.message : "Failed"); } finally { setLoading(false); }
  }, [params.id]);
  useEffect(() => { void load(); }, [load]);
  if (loading) return <ProtectedRoute><AdminLayout><LoadingPanel /></AdminLayout></ProtectedRoute>;
  if (error) return <ProtectedRoute><AdminLayout><ErrorPanel message={error} onRetry={load} /></AdminLayout></ProtectedRoute>;
  if (!payment) return null;
  const curr = payment.order?.currency || payment.currency || "GBP";
  return (
    <ProtectedRoute><AdminLayout><div className="space-y-6">
      <PageHeader title="Payment Details" subtitle={`ID: ${payment.id}`} actions={<Button variant="secondary" onClick={() => router.push("/payments")}>← Back</Button>} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card><h2 className="text-lg font-bold mb-4">Payment</h2>
          <div className="space-y-3">
            <div><span className="text-sm text-gray-500">Status</span><p className="font-bold">{payment.status}</p></div>
            <div><span className="text-sm text-gray-500">Amount</span><p className="font-bold">{formatDisplayMoney(payment.amount / 100, curr, curr)}</p></div>
            <div><span className="text-sm text-gray-500">Provider</span><p className="font-bold">{payment.provider || "stripe"}</p></div>
            <div><span className="text-sm text-gray-500">Platform Fee</span><p className="font-bold">{formatDisplayMoney(payment.platformFeeAmount / 100, curr, curr)}</p></div>
            <div><span className="text-sm text-gray-500">Vendor Earnings</span><p className="font-bold">{formatDisplayMoney(payment.vendorEarningsAmount / 100, curr, curr)}</p></div>
            <div><span className="text-sm text-gray-500">Processed</span><p className="font-bold">{payment.processedAt ? new Date(payment.processedAt).toLocaleString() : "N/A"}</p></div>
          </div></Card>
        {payment.order && <Card><h2 className="text-lg font-bold mb-4">Order</h2>
          <div className="space-y-3">
            <div><span className="text-sm text-gray-500">Order #</span><p className="font-bold">{payment.order.orderNumber}</p></div>
            <div><span className="text-sm text-gray-500">Status</span><p className="font-bold">{payment.order.status}</p></div>
            <div><span className="text-sm text-gray-500">Buyer</span><p className="font-bold">{payment.order.buyer?.name || "N/A"}</p></div>
            <div><span className="text-sm text-gray-500">Email</span><p className="font-bold">{payment.order.buyer?.email || "N/A"}</p></div>
          </div></Card>}
      </div>
    </div></AdminLayout></ProtectedRoute>
  );
}
