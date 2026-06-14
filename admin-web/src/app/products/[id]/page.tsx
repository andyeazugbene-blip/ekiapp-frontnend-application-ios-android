"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AdminLayout from "@/components/AdminLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Button, Card, ErrorPanel, LoadingPanel, PageHeader } from "@/components/AdminUI";
import { SUPPORTED_CURRENCIES, formatDisplayMoney, useAdminDisplayCurrency } from "@/lib/displayCurrency";
import { productsAPI } from "@/lib/services/products.api";
import { APIError } from "@/lib/api";

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const productId = params.id as string;

  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { selectedCurrency, setSelectedCurrency } = useAdminDisplayCurrency(product?.currency ?? "GBP");

  const loadProduct = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const data = await productsAPI.getProduct(productId);
      setProduct(data);
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Failed to load product");
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    void loadProduct();
  }, [loadProduct]);

  const handleApprove = async () => {
    try {
      await productsAPI.approveProduct(productId);
      await loadProduct();
    } catch (err) {
      alert(err instanceof APIError ? err.message : "Failed to approve");
    }
  };

  const handleDisable = async () => {
    try {
      await productsAPI.disableProduct(productId);
      await loadProduct();
    } catch (err) {
      alert(err instanceof APIError ? err.message : "Failed to disable");
    }
  };

  if (loading) return <ProtectedRoute><AdminLayout><LoadingPanel label="Loading product..." /></AdminLayout></ProtectedRoute>;
  if (error || !product) return <ProtectedRoute><AdminLayout><ErrorPanel message={error || "Product not found"} onRetry={() => router.push("/products")} /></AdminLayout></ProtectedRoute>;

  const deliveryZones = product.deliveryZones ?? [];

  return (
    <ProtectedRoute>
      <AdminLayout>
        <div className="space-y-6">
          <PageHeader
            title={product.title}
            subtitle={`Product ID: ${product.id} · Vendor: ${product.vendorName || "N/A"}`}
            actions={
              <div className="flex gap-3">
                <select
                  value={selectedCurrency}
                  onChange={(e) => setSelectedCurrency(e.target.value as any)}
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-900"
                >
                  {SUPPORTED_CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <Button variant="secondary" onClick={() => router.push("/products")}>← Back</Button>
              </div>
            }
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Product Details */}
            <Card>
              <h2 className="text-lg font-bold mb-4">Product Details</h2>
              <div className="space-y-3">
                <InfoRow label="Title" value={product.title} />
                <InfoRow label="Description" value={product.description || "—"} />
                <InfoRow label="Price" value={formatDisplayMoney((product.priceInCents ?? 0) / 100, product.currency, selectedCurrency)} />
                <InfoRow label="Currency" value={product.currency} />
                <InfoRow label="Stock" value={String(product.stock)} />
                <InfoRow label="Weight" value={product.weightGrams ? `${(product.weightGrams / 1000).toFixed(2)} kg` : "—"} />
                <InfoRow label="Category" value={product.category || "—"} />
                <InfoRow label="Status" value={
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${product.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}`}>
                    {product.isActive ? "Active" : "Inactive"}
                  </span>
                } />
                <InfoRow label="Cost price" value={product.costAmount ? formatDisplayMoney(product.costAmount / 100, product.costCurrency ?? product.currency, selectedCurrency) : "—"} />
              </div>
            </Card>

            {/* Vendor Info */}
            <Card>
              <h2 className="text-lg font-bold mb-4">Vendor Information</h2>
              <div className="space-y-3">
                <InfoRow label="Store" value={product.vendorName || "N/A"} />
                <InfoRow label="Email" value={product.vendor?.contactEmail || "—"} />
                <InfoRow label="Country" value={product.vendor?.country || "—"} />
                <InfoRow label="City" value={product.vendor?.city || "—"} />
                <InfoRow label="Verification" value={product.vendor?.verificationStatus || "—"} />
                <InfoRow label="Stripe Connect" value={product.vendor?.stripeAccountId ? "Connected" : "Not connected"} />
              </div>
            </Card>
          </div>

          {/* Shipping / Delivery Zones */}
          <Card>
            <h2 className="text-lg font-bold mb-4">Shipping & Delivery Rates</h2>
            {deliveryZones.length === 0 ? (
              <p className="text-sm text-gray-500">No delivery zones configured for this vendor.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Zone</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Country</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Base Fee</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Per Kg Fee</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Est. for this product</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {deliveryZones.map((zone: any, i: number) => {
                      const weightKg = Math.ceil((product.weightGrams ?? 0) / 1000);
                      const estFee = zone.baseFeeAmount + weightKg * zone.feePerKgAmount;
                      return (
                        <tr key={i}>
                          <td className="px-4 py-3 text-sm text-gray-900">{zone.name}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{zone.country}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{formatDisplayMoney(zone.baseFeeAmount / 100, product.currency, selectedCurrency)}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{formatDisplayMoney(zone.feePerKgAmount / 100, product.currency, selectedCurrency)}/kg</td>
                          <td className="px-4 py-3 text-sm font-bold text-gray-900">{formatDisplayMoney(estFee / 100, product.currency, selectedCurrency)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Actions */}
          <Card>
            <h2 className="text-lg font-bold mb-4">Admin Actions</h2>
            <div className="flex gap-3">
              {!product.isActive ? (
                <Button onClick={handleApprove}>Approve Product</Button>
              ) : (
                <Button variant="secondary" onClick={handleDisable}>Disable Product</Button>
              )}
              <Button variant="ghost" onClick={() => router.push(`/vendors/${product.vendorId}`)}>
                View Vendor
              </Button>
            </div>
          </Card>
        </div>
      </AdminLayout>
    </ProtectedRoute>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between py-1">
      <span className="text-sm font-medium text-gray-500">{label}:</span>
      <span className="text-sm text-gray-900 text-right">{value}</span>
    </div>
  );
}
