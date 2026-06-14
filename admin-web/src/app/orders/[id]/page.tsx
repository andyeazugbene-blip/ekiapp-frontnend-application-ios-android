"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AdminLayout from "@/components/AdminLayout";
import { Button, Card, ErrorPanel, LoadingPanel, PageHeader } from "@/components/AdminUI";
import ProtectedRoute from "@/components/ProtectedRoute";
import { SUPPORTED_CURRENCIES, formatDisplayMoney, useAdminDisplayCurrency } from "@/lib/displayCurrency";
import { ordersAPI } from "@/lib/services/orders.api";
import { APIError, API2FARequiredError } from "@/lib/api";

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { selectedCurrency, setSelectedCurrency } = useAdminDisplayCurrency("EUR");

  const load = useCallback(async () => {
    try { setLoading(true); setError(""); setOrder(await ordersAPI.getOrder(id)); }
    catch (err) { setError(err instanceof APIError ? err.message : "Failed"); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  if (loading) return <ProtectedRoute><AdminLayout><LoadingPanel label="Loading order..." /></AdminLayout></ProtectedRoute>;
  if (error || !order) return <ProtectedRoute><AdminLayout><ErrorPanel message={error || "Not found"} onRetry={() => router.push("/orders")} /></AdminLayout></ProtectedRoute>;

  const items = order.items ?? [];
  const payment = order.payment ?? {};
  const dz = order.deliveryZone ?? {};
  const checkout = order.checkout ?? {};
  const vi = order.vendorInfo ?? {};

  return (
    <ProtectedRoute><AdminLayout><div className="space-y-6">
      <PageHeader title={`Order ${order.orderNumber}`} subtitle={`ID: ${order.id}`}
        actions={<div className="flex gap-3">
          <select value={selectedCurrency} onChange={e => setSelectedCurrency(e.target.value as any)} className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900">
            {SUPPORTED_CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <Button variant="secondary" onClick={() => router.push("/orders")}>← Back</Button>
        </div>}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card><h2 className="text-lg font-bold mb-4">Order</h2>
          <div className="space-y-2 text-sm">
            <Row label="Status" value={<OrderBadge status={order.status} />} />
            <Row label="Total" value={formatDisplayMoney(order.totalAmount, order.currency, selectedCurrency)} />
            <Row label="Subtotal" value={formatDisplayMoney(order.subtotalAmount ?? 0, order.currency, selectedCurrency)} />
            <Row label="Delivery fee" value={formatDisplayMoney(order.deliveryFeeAmount ?? 0, order.currency, selectedCurrency)} />
            <Row label="Platform fee" value={formatDisplayMoney(order.platformFeeAmount ?? 0, order.currency, selectedCurrency)} />
            <Row label="Vendor earns" value={formatDisplayMoney(order.vendorEarnings ?? 0, order.currency, selectedCurrency)} />
            <Row label="Created" value={new Date(order.createdAt).toLocaleString()} />
            {order.deliveredAt ? <Row label="Delivered" value={new Date(order.deliveredAt).toLocaleString()} /> : null}
          </div>
        </Card>

        <Card><h2 className="text-lg font-bold mb-4">Payment</h2>
          <div className="space-y-2 text-sm">
            <Row label="Status" value={<OrderBadge status={payment.status} />} />
            <Row label="Provider" value={payment.provider ?? "—"} />
            <Row label="Amount" value={formatDisplayMoney(payment.amount ?? 0, payment.currency ?? order.currency, selectedCurrency)} />
            <Row label="Intent" value={payment.stripePaymentIntentId ? <span className="font-mono text-xs">{payment.stripePaymentIntentId}</span> : "—"} />
            <Row label="Processed" value={payment.processedAt ? new Date(payment.processedAt).toLocaleString() : "—"} />
            {payment.platformFeeAmount != null ? <Row label="Platform fee" value={formatDisplayMoney(payment.platformFeeAmount, payment.currency ?? order.currency, selectedCurrency)} /> : null}
            {payment.vendorEarningsAmount != null ? <Row label="Vendor earnings" value={formatDisplayMoney(payment.vendorEarningsAmount, payment.currency ?? order.currency, selectedCurrency)} /> : null}
          </div>
        </Card>

        <Card><h2 className="text-lg font-bold mb-4">Parties</h2>
          <div className="space-y-2 text-sm">
            <Row label="Buyer" value={order.buyer?.name ?? order.buyerName ?? order.buyerId} />
            <Row label="Email" value={order.buyer?.email ?? "—"} />
            <div className="border-t my-2" />
            <Row label="Vendor" value={order.vendorName ?? order.vendorId ?? "—"} />
            <Row label="Email" value={vi.contactEmail ?? "—"} />
            <Row label="Country" value={vi.country ?? "—"} />
            <Row label="Verification" value={vi.verificationStatus?.replace("_"," ") ?? "—"} />
          </div>
        </Card>
      </div>

      <Card><h2 className="text-lg font-bold mb-4">Delivery</h2>
        <div className="space-y-2 text-sm">
          <Row label="Zone" value={dz.name ?? "—"} />
          <Row label="Country" value={dz.country ?? "—"} />
          <Row label="Base fee" value={dz.baseFeeAmount != null ? formatDisplayMoney(dz.baseFeeAmount, order.currency, selectedCurrency) : "—"} />
          <Row label="Per kg" value={dz.feePerKgAmount != null ? formatDisplayMoney(dz.feePerKgAmount, order.currency, selectedCurrency) : "—"} />
          <Row label="Address" value={order.deliveryAddress ?? "—"} />
        </div>
      </Card>

      <Card><h2 className="text-lg font-bold mb-4">Items ({items.length})</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50"><tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Qty</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-200">
              {items.map((item: any, i: number) => (
                <tr key={item.id ?? i}>
                  <td className="px-4 py-3 text-sm text-gray-900">{item.productTitle ?? item.product?.title ?? "—"}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">{item.quantity}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">{formatDisplayMoney(item.unitAmount ?? item.product?.priceInCents ?? 0, order.currency, selectedCurrency)}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">{formatDisplayMoney(item.totalAmount ?? 0, order.currency, selectedCurrency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div></AdminLayout></ProtectedRoute>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="flex justify-between"><span className="text-gray-500">{label}</span><span className="text-gray-900 font-medium">{value}</span></div>;
}
function OrderBadge({ status }: { status: string }) {
  const s = (status ?? "").toLowerCase();
  const c: Record<string,string> = { pending:"bg-yellow-100 text-yellow-800", succeeded:"bg-green-100 text-green-800", paid:"bg-green-100 text-green-800", confirmed:"bg-blue-100 text-blue-800", processing:"bg-purple-100 text-purple-800", delivered:"bg-green-100 text-green-800", completed:"bg-green-100 text-green-800", failed:"bg-red-100 text-red-800", cancelled:"bg-red-100 text-red-800", refunded:"bg-gray-100 text-gray-800" };
  return <span className={`px-2 py-1 rounded-full text-xs font-medium ${c[s] ?? "bg-gray-100 text-gray-800"}`}>{s.replace("_"," ")}</span>;
}
