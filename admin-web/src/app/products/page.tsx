"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import AdminLayout from "@/components/AdminLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Badge, Button, Card, ErrorPanel, LoadingPanel, PageHeader } from "@/components/AdminUI";
import { DataTable, FilterSelect, Pagination, SearchInput, StatusTabs, formatDate, formatMinor, useConfirm, type Column } from "@/components/AdminKit";
import { NoAccess } from "@/components/PageStates";
import { APIError } from "@/lib/api";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { formatApproxMoney, useAdminDisplayCurrency } from "@/lib/displayCurrency";
import { PRODUCT_TYPE_LABEL, REAL_STATUS_LABEL, productsAPI, type AdminProductList, type AdminProductRow, type RealProductStatus } from "@/lib/services/products.api";

const TYPE_OPTIONS = [
  { value: "", label: "All product types" },
  { value: "STANDARD", label: PRODUCT_TYPE_LABEL.STANDARD },
  { value: "COMMUNITY_BUY", label: PRODUCT_TYPE_LABEL.COMMUNITY_BUY },
  { value: "REGULAR_DELIVERY", label: PRODUCT_TYPE_LABEL.REGULAR_DELIVERY },
];

// One badge, one source of truth (the real 5-state status column) — the
// old screen showed a legacy 3-state badge (Active/Disabled/Draft) AND a
// second real-status badge side by side, so a PENDING_ACTIVATION listing
// showed "Draft" and "Awaiting activation" at once. There's nothing left
// to reconcile between two systems now.
const REAL_STATUS_TONE: Record<RealProductStatus, "green" | "amber" | "gray" | "red"> = {
  PUBLISHED: "green",
  PENDING_ACTIVATION: "amber",
  PAUSED: "gray",
  REJECTED: "red",
  DRAFT: "gray",
};

function ProductStatusBadge({ status }: { status: RealProductStatus }) {
  return <Badge tone={REAL_STATUS_TONE[status]}>{REAL_STATUS_LABEL[status]}</Badge>;
}

function ProductsInner() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const perms = usePermissions();
  const confirm = useConfirm();
  const { selectedCurrency } = useAdminDisplayCurrency("EUR");

  const q = params.get("q") ?? "";
  const status = params.get("status") ?? "";
  const category = params.get("category") ?? "";
  const productType = params.get("productType") ?? "";

  const setParams = useCallback((patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) { if (v == null || v === "") next.delete(k); else next.set(k, v); }
    router.replace(`${pathname}?${next.toString()}`);
  }, [params, pathname, router]);

  const [data, setData] = useState<AdminProductList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cursor, setCursor] = useState<string | null>(null);
  const stack = useRef<Array<string | null>>([]);

  const key = `${q}|${status}|${category}|${productType}`;
  useEffect(() => { stack.current = []; setCursor(null); }, [key]);

  const load = useCallback(async () => {
    try {
      setLoading(true); setError("");
      setData(await productsAPI.list({ q, status, category, productType, cursor }));
    } catch (e) {
      setError(e instanceof APIError ? e.message : "Failed to load products");
    } finally { setLoading(false); }
  }, [q, status, category, productType, cursor]);
  useEffect(() => { if (perms.loading || perms.has("products.read")) void load(); }, [load, perms]);

  if (!perms.loading && !perms.has("products.read")) return <NoAccess what="products" />;
  const canModerate = perms.has("products.mutate");

  const deleteProduct = (p: AdminProductRow) =>
    confirm.ask(
      {
        title: `Delete "${p.title}"?`,
        description: "This permanently removes the listing — unlike Unpublish, the record is NOT kept and this cannot be undone. Only possible when the product has no order or subscription history; if it does, you'll get a clear error and should use Unpublish on the product page instead.",
        confirmLabel: "Delete permanently",
        reasonLabel: "Reason (recorded in the audit log before the record is removed)",
      },
      async (reason) => {
        await productsAPI.deleteProduct(p.id, reason);
        await load();
      },
    );

  const columns: Column<AdminProductRow>[] = [
    {
      key: "product", header: "Product",
      render: (p) => (
        <div className="flex items-center gap-3">
          {p.image
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={p.image} alt="" className="h-12 w-12 rounded-xl border border-slate-200 object-cover" />
            : <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-[10px] font-black uppercase text-slate-400" aria-label="No image">No image</span>}
          <div className="min-w-0">
            <p className="truncate font-black text-slate-900">{p.title}</p>
            <p className="text-xs font-semibold text-slate-500">{p.productCode ?? "No code"}</p>
          </div>
        </div>
      ),
    },
    { key: "vendor", header: "Vendor", render: (p) => <span className="font-semibold text-slate-700">{p.vendorName ?? "Not provided"}</span> },
    { key: "cat", header: "Category", render: (p) => <span className="text-slate-600">{p.category ?? "Not provided"}</span> },
    { key: "type", header: "Type", render: (p) => <Badge tone={p.productType === "STANDARD" ? "gray" : "blue"}>{PRODUCT_TYPE_LABEL[p.productType]}</Badge> },
    {
      key: "price", header: "Price",
      render: (p) => {
        const approx = formatApproxMoney(p.priceInCents / 100, p.currency, selectedCurrency);
        return (
          <div>
            <p className="font-black text-slate-900">{formatMinor(p.priceInCents, p.currency)}</p>
            {approx ? <p className="text-xs font-semibold text-slate-500">{approx}</p> : null}
          </div>
        );
      },
    },
    { key: "stock", header: "Stock", render: (p) => <span className={p.stock === 0 ? "font-black text-red-600" : "font-bold"}>{p.stock}</span> },
    {
      key: "status", header: "Status",
      render: (p) => (
        <div className="space-y-1">
          <ProductStatusBadge status={p.realStatus} />
          {p.notPurchasableReason ? <p><Badge tone="amber">Not purchasable: seller payment setup incomplete</Badge></p> : null}
        </div>
      ),
    },
    { key: "created", header: "Created", render: (p) => <span className="text-xs font-semibold text-slate-600">{formatDate(p.createdAt)}</span> },
    {
      key: "act", header: "", className: "text-right",
      render: (p) => (
        <div onClick={(e) => e.stopPropagation()} className="flex justify-end gap-2">
          <Button variant="ghost" className="h-9 px-3" onClick={() => router.push(`/products/${p.id}`)}>View</Button>
          {canModerate ? <Button variant="danger" className="h-9 px-3" onClick={() => deleteProduct(p)}>Delete</Button> : null}
        </div>
      ),
    },
  ];

  const tabs = [
    { key: "", label: "All", count: data?.counts.total ?? null },
    { key: "PUBLISHED", label: "Published", count: data?.counts.published ?? null },
    { key: "PENDING_ACTIVATION", label: "Awaiting activation", count: data?.counts.pendingActivation ?? null },
    { key: "PAUSED", label: "Paused", count: data?.counts.paused ?? null },
    { key: "REJECTED", label: "Rejected", count: data?.counts.rejected ?? null },
    { key: "DRAFT", label: "Draft", count: data?.counts.draft ?? null },
  ];
  const categoryOptions = [{ value: "", label: "All categories" }, ...(data?.categories ?? []).map((c) => ({ value: c, label: c }))];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Products"
        subtitle="Search and moderate vendor products. Prices are shown in the product's own currency; converted amounts are labelled Approx."
      />
      {error ? <ErrorPanel message={error} onRetry={() => void load()} /> : null}
      <Card className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <SearchInput value={q} onChange={(v) => setParams({ q: v })} placeholder="Search product, product code or vendor" />
          <FilterSelect label="Category" value={category} onChange={(v) => setParams({ category: v })} options={categoryOptions} />
          <FilterSelect label="Product type" value={productType} onChange={(v) => setParams({ productType: v })} options={TYPE_OPTIONS} />
        </div>
        <StatusTabs tabs={tabs} active={status} onChange={(k) => setParams({ status: k })} />
        {productType === "COMMUNITY_BUY" ? (
          <p className="text-xs font-semibold text-slate-500">Community Buy campaigns carry their own product details and are not catalogue products, so none are listed here. Review them under Community Buy.</p>
        ) : null}
        {loading && !data ? <LoadingPanel label="Loading products…" /> : (
          <>
            <DataTable columns={columns} rows={data?.items ?? []} rowKey={(p) => p.id} onRowClick={(p) => router.push(`/products/${p.id}`)} loading={loading} emptyTitle="No products match these filters" />
            <Pagination
              hasPrev={stack.current.length > 0} hasNext={Boolean(data?.nextCursor)} shown={data?.items.length ?? 0} total={status === "" && !q && !category && !productType ? data?.counts.total : null} loading={loading}
              onPrev={() => setCursor(stack.current.pop() ?? null)}
              onNext={() => { stack.current.push(cursor); setCursor(data?.nextCursor ?? null); }}
            />
          </>
        )}
      </Card>
      {confirm.dialog}
    </div>
  );
}

export default function ProductsPage() {
  return (
    <ProtectedRoute>
      <AdminLayout>
        <Suspense fallback={<LoadingPanel label="Loading products…" />}>
          <ProductsInner />
        </Suspense>
      </AdminLayout>
    </ProtectedRoute>
  );
}
