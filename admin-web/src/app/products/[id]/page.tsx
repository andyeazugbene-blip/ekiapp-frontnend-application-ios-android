"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AdminLayout from "@/components/AdminLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Badge, Button, Card, ErrorPanel, LoadingPanel, PageHeader } from "@/components/AdminUI";
import { Banner, ExternalLink, KeyValue, formatDateTime, formatMinor, stripeDashboardUrl, useConfirm } from "@/components/AdminKit";
import { NoAccess } from "@/components/PageStates";
import { APIError } from "@/lib/api";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { formatApproxMoney, useAdminDisplayCurrency } from "@/lib/displayCurrency";
import { PRODUCT_TYPE_LABEL, productsAPI, type AdminProductDetail } from "@/lib/services/products.api";

function StatusBadge({ status }: { status: AdminProductDetail["status"] }) {
  if (status === "ACTIVE") return <Badge tone="green">Active</Badge>;
  if (status === "DISABLED") return <Badge tone="red">Disabled</Badge>;
  return <Badge tone="gray">Draft</Badge>;
}

function ProductDetail() {
  const params = useParams();
  const router = useRouter();
  const productId = params.id as string;
  const perms = usePermissions();
  const confirm = useConfirm();
  const { selectedCurrency } = useAdminDisplayCurrency("EUR");

  const [product, setProduct] = useState<AdminProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeImage, setActiveImage] = useState(0);

  const load = useCallback(async () => {
    try {
      setLoading(true); setError("");
      setProduct(await productsAPI.getProduct(productId));
    } catch (e) {
      setError(e instanceof APIError ? e.message : "Failed to load product");
    } finally { setLoading(false); }
  }, [productId]);
  useEffect(() => { if (perms.loading || perms.has("products.read")) void load(); }, [load, perms]);

  if (!perms.loading && !perms.has("products.read")) return <NoAccess what="products" />;
  if (loading && !product) return <LoadingPanel label="Loading product…" />;
  if (error && !product) return <ErrorPanel message={error} onRetry={() => void load()} />;
  if (!product) return <ErrorPanel message="Product not found" onRetry={() => router.push("/products")} />;

  const canModerate = perms.has("products.mutate");
  const v = product.vendor;
  const approx = formatApproxMoney(product.priceInCents / 100, product.currency, selectedCurrency);
  const stripeOnly = v?.stripeAccountId != null;

  const unpublish = () =>
    confirm.ask(
      {
        title: `Unpublish "${product.title}"?`,
        description: "The product disappears from the app for buyers. The record is kept and can be restored. The vendor is notified in-app and by email with your reason.",
        confirmLabel: "Unpublish product",
        reasonLabel: "Reason (sent to the vendor and recorded in the audit log)",
      },
      async (reason) => setProduct(await productsAPI.unpublish(product.id, reason)),
    );
  const restore = () =>
    confirm.ask(
      {
        title: product.adminUnpublishedAt ? `Restore "${product.title}"?` : `Publish "${product.title}"?`,
        description: "The product becomes visible to buyers again (it still cannot be bought while the seller's payment setup is incomplete). The vendor is notified.",
        confirmLabel: product.adminUnpublishedAt ? "Restore product" : "Publish product",
        tone: "primary",
        reasonLabel: "Reason (sent to the vendor and recorded in the audit log)",
      },
      async (reason) => setProduct(await productsAPI.restore(product.id, reason)),
    );

  return (
    <div className="space-y-5">
      <PageHeader
        title={product.title}
        subtitle={`${product.productCode ?? "No product code"} · ${PRODUCT_TYPE_LABEL[product.productType]}`}
        actions={
          <>
            <Button variant="ghost" onClick={() => router.push("/products")}>Back to products</Button>
            {product.publicStoreUrl && product.status === "ACTIVE" ? <ExternalLink href={product.publicStoreUrl}>View store in live app</ExternalLink> : null}
            {canModerate && product.status === "ACTIVE" ? <Button variant="danger" onClick={unpublish}>Unpublish</Button> : null}
            {canModerate && product.status !== "ACTIVE" ? <Button onClick={restore}>{product.adminUnpublishedAt ? "Restore" : "Publish"}</Button> : null}
          </>
        }
      />

      {product.status === "DISABLED" && product.adminUnpublishedAt ? (
        <Banner tone="danger" title="Unpublished by admin">
          {product.adminUnpublishedReason ?? "No reason recorded"} · {formatDateTime(product.adminUnpublishedAt)}
          {product.unpublishedBy ? ` · by ${product.unpublishedBy.name || product.unpublishedBy.email}` : ""}
        </Banner>
      ) : null}
      {product.status === "ACTIVE" && product.sellerReadiness && !product.sellerReadiness.ready ? (
        <Banner tone="warning" title="Not purchasable: seller payment setup incomplete">
          {product.sellerReadiness.message}.{" "}
          {product.sellerReadiness.gateEnabled
            ? "Buyers cannot add this product to a cart or check out until the seller can receive payments."
            : "The readiness gate is currently switched off (SELLER_PAYMENT_READINESS_GATE), so buyers can still purchase."}
        </Banner>
      ) : null}
      {!product.completeness.hasImage || !product.completeness.priceOk ? (
        <Banner tone="warning" title="Incomplete listing">
          A product needs at least one image and a price above zero before it can go live
          {!product.completeness.hasImage ? " (no image yet)" : ""}{!product.completeness.priceOk ? " (price is zero)" : ""}.
        </Banner>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2 space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2"><StatusBadge status={product.status} /><Badge tone="blue">{PRODUCT_TYPE_LABEL[product.productType]}</Badge></div>
          </div>
          {product.images.length > 0 ? (
            <div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={product.images[activeImage] ?? product.images[0]} alt={product.title} className="h-72 w-full rounded-2xl border border-slate-200 object-contain bg-slate-50" />
              {product.images.length > 1 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {product.images.map((src, i) => (
                    <button key={src + i} onClick={() => setActiveImage(i)} aria-label={`Show image ${i + 1}`} className={`overflow-hidden rounded-xl border-2 ${i === activeImage ? "border-[#096B4A]" : "border-slate-200"}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt="" className="h-16 w-16 object-cover" />
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="flex h-40 items-center justify-center rounded-2xl border border-dashed border-slate-300 text-sm font-bold text-slate-500">No images provided</div>
          )}
          <div>
            <h2 className="text-xs font-black uppercase tracking-wide text-slate-500">Description</h2>
            <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{product.description || "Not provided"}</p>
          </div>
          <KeyValue
            items={[
              { label: "Price", value: (<span>{formatMinor(product.priceInCents, product.currency)}{approx ? <span className="ml-2 text-xs font-semibold text-slate-500">{approx}</span> : null}</span>) },
              { label: "Currency", value: product.currency },
              { label: "Stock", value: product.stock },
              { label: "Weight", value: product.weightGrams ? `${product.weightGrams} g` : "Not provided" },
              { label: "Category", value: product.category ?? "Not provided" },
              { label: "Unit / pack size", value: product.unitSize ?? product.packSize ?? "Not provided" },
              { label: "Minimum quantity", value: product.minimumQuantity ?? "Not provided" },
              { label: "Created", value: formatDateTime(product.createdAt) },
              { label: "Last updated", value: formatDateTime(product.updatedAt) },
            ]}
          />
        </Card>

        <div className="space-y-5">
          <Card className="space-y-4">
            <h2 className="text-lg font-black text-[#101820]">Vendor</h2>
            {v ? (
              <>
                <KeyValue
                  items={[
                    { label: "Store", value: v.storeName },
                    { label: "Country", value: [v.city, v.country].filter(Boolean).join(", ") || "Not provided" },
                    { label: "Contact email", value: v.contactEmail ?? "Not provided" },
                  ]}
                />
                <div className="space-y-2 rounded-2xl border border-slate-200 p-3">
                  <div className="flex items-center justify-between text-sm"><span className="font-bold text-slate-600">Verification</span>
                    <Badge tone={v.verificationStatus === "VERIFIED" ? "green" : v.verificationStatus === "REJECTED" ? "red" : "amber"}>{v.verificationStatus === "VERIFIED" ? "Verified" : v.verificationStatus === "REJECTED" ? "Rejected" : "Pending"}</Badge></div>
                  <div className="flex items-center justify-between text-sm"><span className="font-bold text-slate-600">Account</span>
                    <Badge tone={v.closedAt ? "gray" : v.isSuspended ? "red" : "green"}>{v.closedAt ? "Closed" : v.isSuspended ? "Suspended" : "In good standing"}</Badge></div>
                  <div className="flex items-center justify-between text-sm"><span className="font-bold text-slate-600">Charges enabled</span>
                    <Badge tone={stripeOnly ? (v.stripeChargesEnabled ? "green" : "amber") : "gray"}>{stripeOnly ? (v.stripeChargesEnabled ? "Yes" : "No") : "No Stripe account"}</Badge></div>
                  <div className="flex items-center justify-between text-sm"><span className="font-bold text-slate-600">Payouts enabled</span>
                    <Badge tone={stripeOnly ? (v.stripePayoutsEnabled ? "green" : "amber") : "gray"}>{stripeOnly ? (v.stripePayoutsEnabled ? "Yes" : "No") : "No Stripe account"}</Badge></div>
                  <p className="text-xs font-semibold text-slate-500">Identity verification and payment readiness are separate: a verified vendor still needs charges enabled before buyers can pay them.</p>
                  {v.stripeAccountId ? <ExternalLink href={stripeDashboardUrl("account", v.stripeAccountId)}>Open in Stripe</ExternalLink> : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link href={`/vendors/${v.id}`} className="inline-flex h-10 items-center rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50">View vendor</Link>
                  <Link href={`/communications?userId=${encodeURIComponent(v.userId)}`} className="inline-flex h-10 items-center rounded-xl border border-[#096B4A] px-4 text-sm font-bold text-[#096B4A] hover:bg-emerald-50">Contact vendor</Link>
                </div>
              </>
            ) : <p className="text-sm font-semibold text-slate-500">Vendor details not available.</p>}
          </Card>

          <Card className="space-y-3">
            <h2 className="text-lg font-black text-[#101820]">Delivery</h2>
            {product.deliveryMethods.length === 0 && product.deliveryZones.length === 0 ? (
              <p className="text-sm font-semibold text-slate-500">No delivery zones or methods configured for this vendor or market.</p>
            ) : (
              <>
                <ul className="space-y-2">
                  {product.deliveryZones.map((z) => (
                    <li key={z.id} className="rounded-xl border border-slate-200 p-3 text-sm">
                      <p className="font-black text-slate-900">{z.name} <span className="font-semibold text-slate-500">· {z.country}</span> <Badge tone={z.scope === "VENDOR" ? "green" : "gray"}>{z.scope === "VENDOR" ? "Vendor zone" : "Market zone"}</Badge></p>
                      <p className="text-xs font-semibold text-slate-600">Base {formatMinor(z.baseFeeAmount, z.currency)} + {formatMinor(z.feePerKgAmount, z.currency)}/kg</p>
                      {z.deliveryMethods.length > 0 ? (
                        <ul className="mt-1 list-disc pl-5 text-xs text-slate-700">
                          {z.deliveryMethods.map((m) => <li key={m.id}>{m.label}: {formatMinor(m.priceAmount, z.currency)}, {m.minDays}-{m.maxDays} days</li>)}
                        </ul>
                      ) : <p className="mt-1 text-xs text-slate-500">No delivery methods in this zone.</p>}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Card>
        </div>
      </div>

      {product.orderItems.length > 0 ? (
        <Card>
          <h2 className="text-lg font-black text-[#101820]">Recent orders containing this product</h2>
          <ul className="mt-3 divide-y divide-slate-100 text-sm">
            {product.orderItems.map((oi) => (
              <li key={oi.id} className="flex items-center justify-between py-2">
                <Link href={`/orders/${oi.orderId}`} className="font-bold text-[#096B4A] hover:underline">View order</Link>
                <span className="font-semibold text-slate-700">{oi.quantity} × · {formatMinor(oi.totalAmount, product.currency)}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
      {confirm.dialog}
    </div>
  );
}

export default function ProductDetailPage() {
  return (
    <ProtectedRoute>
      <AdminLayout>
        <ProductDetail />
      </AdminLayout>
    </ProtectedRoute>
  );
}
