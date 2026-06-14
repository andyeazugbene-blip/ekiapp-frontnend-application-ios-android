"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AdminLayout from "@/components/AdminLayout";
import { Badge, Button, Card, ErrorPanel, Icon, LoadingPanel, PageHeader, TextLink } from "@/components/AdminUI";
import ProtectedRoute from "@/components/ProtectedRoute";
import { APIError } from "@/lib/api";
import { SUPPORTED_CURRENCIES, formatDisplayMoney, useAdminDisplayCurrency } from "@/lib/displayCurrency";
import { vendorsAPI } from "@/lib/services/vendors.api";
import { ordersAPI } from "@/lib/services/orders.api";

export default function VendorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { selectedCurrency, setSelectedCurrency } = useAdminDisplayCurrency("EUR");

  const load = useCallback(async () => {
    try { setLoading(true); setError("");
      const v = await vendorsAPI.getVendor(id);
      setData(v);
      setProducts((v as any).products ?? []);
      setOrders((v as any).recentOrders ?? []);
    } catch (err) { setError(err instanceof APIError ? err.message : "Failed"); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { void load(); }, [load]);
  if (loading) return <ProtectedRoute><AdminLayout><LoadingPanel label="Loading..." /></AdminLayout></ProtectedRoute>;
  if (error || !data) return <ProtectedRoute><AdminLayout><ErrorPanel message={error || "Not found"} onRetry={() => router.push("/vendors")} /></AdminLayout></ProtectedRoute>;

  const avgRating = (data as any).avgRating;
  const totalReviews = (data as any).totalReviews ?? 0;
  const totalRevenue = (data as any).totalRevenue ?? 0;
  const storeOrders = (data as any).storeOrders ?? 0;
  const verif = data.verificationStatus?.replace("_", " ") ?? "pending";

  return (
    <ProtectedRoute><AdminLayout><div className="space-y-6">
      <PageHeader title={data.storeName} subtitle={`ID: ${data.id}`}
        actions={<div className="flex gap-3">
          <select value={selectedCurrency} onChange={e => setSelectedCurrency(e.target.value as any)} className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900">
            {SUPPORTED_CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <Button variant="secondary" onClick={() => router.push("/vendors")}>← Back</Button>
        </div>}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card><h2 className="text-lg font-bold mb-4">Vendor Info</h2>
          <div className="space-y-3">
            <InfoRow label="Owner" value={data.ownerName ?? data.user?.name ?? "N/A"} />
            <InfoRow label="Email" value={data.contactEmail ?? data.user?.email ?? "N/A"} />
            <InfoRow label="Country" value={data.country ?? "—"} />
            <InfoRow label="City" value={data.city ?? "—"} />
            <InfoRow label="Joined" value={data.createdAt ? new Date(data.createdAt).toLocaleDateString() : "N/A"} />
            <InfoRow label="Verification" value={<span className={`px-2 py-1 rounded-full text-xs font-medium ${data.verificationStatus === "VERIFIED" ? "bg-green-100 text-green-800" : data.verificationStatus === "REJECTED" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"}`}>{verif.toUpperCase()}</span>} />
            <InfoRow label="Suspended" value={data.isSuspended ? "Yes" : "No"} />
          </div>
        </Card>

        <Card><h2 className="text-lg font-bold mb-4">Stats</h2>
          <div className="space-y-3">
            <InfoRow label="Total products" value={String(data.totalProducts)} />
            <InfoRow label="Total orders" value={String(storeOrders)} />
            <InfoRow label="Total revenue" value={formatDisplayMoney(totalRevenue, "EUR", selectedCurrency)} />
            <InfoRow label="Avg rating" value={avgRating ? `${Number(avgRating).toFixed(1)}★` : "—"} />
            <InfoRow label="Reviews" value={String(totalReviews)} />
          </div>
        </Card>
      </div>

      <Card><h2 className="text-lg font-bold mb-4">Products ({products.length})</h2>
        {products.length === 0 ? <p className="text-sm text-gray-500">No products</p> : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50"><tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stock</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-200">
                {products.map((p: any) => (
                  <tr key={p.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => router.push(`/products/${p.id}`)}>
                    <td className="px-4 py-3 text-sm text-gray-900">{p.title}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{formatDisplayMoney(p.priceInCents, p.currency, selectedCurrency)}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{p.stock}</td>
                    <td className="px-4 py-3 text-sm"><span className={`px-2 py-1 rounded-full text-xs font-medium ${p.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}`}>{p.isActive ? "Active" : "Inactive"}</span></td>
                    <td className="px-4 py-3 text-sm text-gray-500">{new Date(p.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card><h2 className="text-lg font-bold mb-4">Recent Orders ({orders.length})</h2>
        {orders.length === 0 ? <p className="text-sm text-gray-500">No orders</p> : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50"><tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order #</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-200">
                {orders.map((o: any) => (
                  <tr key={o.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => router.push(`/orders/${o.id}`)}>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{o.orderNumber}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{formatDisplayMoney(o.totalAmount, o.currency, selectedCurrency)}</td>
                    <td className="px-4 py-3 text-sm"><OrderStatusBadge status={o.status} /></td>
                    <td className="px-4 py-3 text-sm text-gray-500">{new Date(o.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="flex gap-3">
        {data.verificationStatus !== "VERIFIED" && <Button onClick={async () => { await vendorsAPI.approveVendor(data.id); await load(); }}>Approve</Button>}
        <Button variant="secondary" onClick={() => router.push(`/communication?vendorId=${data.id}`)}>Send Message</Button>
      </div>
    </div></AdminLayout></ProtectedRoute>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="flex justify-between py-1"><span className="text-sm font-medium text-gray-500">{label}:</span><span className="text-sm text-gray-900 text-right">{value}</span></div>;
}
function OrderStatusBadge({ status }: { status: string }) {
  const s = status?.toLowerCase() ?? "";
  const colors: Record<string,string> = { pending:"bg-yellow-100 text-yellow-800", paid:"bg-blue-100 text-blue-800", confirmed:"bg-blue-100 text-blue-800", processing:"bg-purple-100 text-purple-800", dispatched:"bg-purple-100 text-purple-800", in_transit:"bg-purple-100 text-purple-800", delivered:"bg-green-100 text-green-800", completed:"bg-green-100 text-green-800", failed:"bg-red-100 text-red-800", cancelled:"bg-red-100 text-red-800", refunded:"bg-gray-100 text-gray-800" };
  return <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[s] ?? "bg-gray-100 text-gray-800"}`}>{s.replace("_"," ")}</span>;
}
