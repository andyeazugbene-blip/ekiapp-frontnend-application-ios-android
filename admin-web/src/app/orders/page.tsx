"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import AdminLayout from "@/components/AdminLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Badge, Button, Card, ErrorPanel, LoadingPanel, PageHeader, downloadCsv } from "@/components/AdminUI";
import { DataTable, FilterSelect, Pagination, SearchInput, formatDateTime, formatMinor, type Column } from "@/components/AdminKit";
import { APIError } from "@/lib/api";
import { ORDER_STATUSES, moneyAPI, orderStatusLabel, orderStatusTone, paymentStatusTone, type OrderRow } from "@/lib/services/money.api";

const STATUS_OPTIONS = [{ value: "", label: "Any status" }, ...ORDER_STATUSES.map((s) => ({ value: s, label: orderStatusLabel(s) }))];

function OrdersInner() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const q = params.get("q") ?? "";
  const status = params.get("status") ?? "";
  const vendorId = params.get("vendorId") ?? "";
  const buyerId = params.get("buyerId") ?? "";
  const includeTest = params.get("includeTest") === "true";

  const setParams = useCallback((patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) { if (v == null || v === "") next.delete(k); else next.set(k, v); }
    router.replace(`${pathname}?${next.toString()}`);
  }, [params, pathname, router]);

  const [rows, setRows] = useState<OrderRow[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cursor, setCursor] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const stack = useRef<Array<string | null>>([]);

  const key = `${q}|${status}|${vendorId}|${buyerId}|${includeTest}`;
  useEffect(() => { stack.current = []; setCursor(null); }, [key]);

  const load = useCallback(async () => {
    try {
      setLoading(true); setError("");
      const res = await moneyAPI.listOrders({ q, status, vendorId, buyerId, includeTest, cursor });
      setRows(res.items); setNextCursor(res.nextCursor); setTotal(res.total);
    } catch (e) { setError(e instanceof APIError ? e.message : "Failed to load orders"); }
    finally { setLoading(false); }
  }, [q, status, vendorId, buyerId, includeTest, cursor]);
  useEffect(() => { void load(); }, [load]);

  const columns: Column<OrderRow>[] = [
    { key: "n", header: "Order", render: (o) => <div><p className="font-black text-slate-900">{o.orderNumber}</p><p className="text-xs text-slate-500">{o.items.length} item(s)</p></div> },
    { key: "buyer", header: "Buyer", render: (o) => <div><p className="font-semibold">{o.buyer?.name || "Name not provided"}</p><p className="text-xs text-slate-500">{o.buyer?.email}</p></div> },
    { key: "vendor", header: "Vendor", render: (o) => <span className="font-semibold">{o.vendorName ?? "—"}</span> },
    { key: "total", header: "Total", render: (o) => <span className="font-black">{formatMinor(o.totalAmount, o.currency)}</span> },
    { key: "status", header: "Order", render: (o) => <Badge tone={orderStatusTone(o.status)}>{orderStatusLabel(o.status)}</Badge> },
    { key: "pay", header: "Payment", render: (o) => o.payment ? <Badge tone={paymentStatusTone(o.payment.status)}>{o.payment.status.toLowerCase()}</Badge> : <span className="text-xs text-slate-400">No record</span> },
    { key: "time", header: "Placed", render: (o) => <span className="text-xs font-semibold text-slate-600">{formatDateTime(o.createdAt)}</span> },
    { key: "act", header: "", className: "text-right", render: (o) => <Button variant="ghost" className="h-9 px-3" onClick={(e) => { e.stopPropagation(); router.push(`/orders/${o.id}`); }}>View</Button> },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Orders"
        subtitle="Order, payment, refund and dispute states are separate. Open an order to see them together."
        actions={<Button variant="ghost" onClick={() => downloadCsv("orders.csv", rows.map((o) => ({
          order: o.orderNumber, buyer: o.buyer?.email ?? "", vendor: o.vendorName ?? "", total: o.totalAmount / 100, currency: o.currency,
          status: o.status, payment: o.payment?.status ?? "", placed: o.createdAt,
        })))}>Export page (CSV)</Button>}
      />
      {error ? <ErrorPanel message={error} onRetry={() => void load()} /> : null}
      <Card className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <SearchInput value={q} onChange={(v) => setParams({ q: v })} placeholder="Search order number, buyer name/email or Stripe payment ID" />
          <FilterSelect label="Order status" value={status} onChange={(v) => setParams({ status: v })} options={STATUS_OPTIONS} />
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-600">
            <input type="checkbox" checked={includeTest} onChange={(e) => setParams({ includeTest: e.target.checked ? "true" : null })} className="h-4 w-4 accent-[#096B4A]" />
            Include test records
          </label>
        </div>
        {(vendorId || buyerId) ? (
          <p className="text-xs font-semibold text-slate-500">Filtered to one {vendorId ? "vendor" : "buyer"}. <button className="underline" onClick={() => setParams({ vendorId: null, buyerId: null })}>Clear</button></p>
        ) : null}
        {loading && rows.length === 0 ? <LoadingPanel label="Loading orders…" /> : (
          <>
            <DataTable columns={columns} rows={rows} rowKey={(o) => o.id} onRowClick={(o) => router.push(`/orders/${o.id}`)} loading={loading} emptyTitle="No orders match these filters" />
            <Pagination
              hasPrev={stack.current.length > 0} hasNext={Boolean(nextCursor)} shown={rows.length} total={total} loading={loading}
              onPrev={() => setCursor(stack.current.pop() ?? null)}
              onNext={() => { stack.current.push(cursor); setCursor(nextCursor); }}
            />
          </>
        )}
      </Card>
    </div>
  );
}

export default function OrdersPage() {
  return (
    <ProtectedRoute>
      <AdminLayout>
        <Suspense fallback={<LoadingPanel label="Loading orders…" />}>
          <OrdersInner />
        </Suspense>
      </AdminLayout>
    </ProtectedRoute>
  );
}
