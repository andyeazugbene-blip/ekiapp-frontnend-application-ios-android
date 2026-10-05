"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import AdminLayout from "@/components/AdminLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Badge, Button, Card, ErrorPanel, LoadingPanel, PageHeader, downloadCsv } from "@/components/AdminUI";
import { DataTable, FilterSelect, Pagination, SearchInput, StatusTabs, formatDateTime, formatMinor, type Column } from "@/components/AdminKit";
import { APIError } from "@/lib/api";
import { failureCopy, moneyAPI, paymentStatusTone, type PaymentRow } from "@/lib/services/money.api";

const STATUS_TABS = [
  { key: "", label: "All" },
  { key: "SUCCEEDED", label: "Succeeded" },
  { key: "FAILED", label: "Failed" },
  { key: "PENDING", label: "Pending" },
];
const PROVIDER_OPTIONS = [
  { value: "", label: "Any provider" },
  { value: "stripe", label: "Stripe" },
  { value: "paystack", label: "Paystack" },
];

function PaymentsInner() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const q = params.get("q") ?? "";
  const status = params.get("status") ?? "";
  const provider = params.get("provider") ?? "";
  const vendorId = params.get("vendorId") ?? "";
  const includeTest = params.get("includeTest") === "true";

  const setParams = useCallback((patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) { if (v == null || v === "") next.delete(k); else next.set(k, v); }
    router.replace(`${pathname}?${next.toString()}`);
  }, [params, pathname, router]);

  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cursor, setCursor] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const stack = useRef<Array<string | null>>([]);

  const key = `${q}|${status}|${provider}|${vendorId}|${includeTest}`;
  useEffect(() => { stack.current = []; setCursor(null); }, [key]);

  const load = useCallback(async () => {
    try {
      setLoading(true); setError("");
      const res = await moneyAPI.listPayments({ q, status, provider, vendorId, includeTest, cursor });
      setRows(res.items); setNextCursor(res.nextCursor); setTotal(res.total);
    } catch (e) { setError(e instanceof APIError ? e.message : "Failed to load payments"); }
    finally { setLoading(false); }
  }, [q, status, provider, vendorId, includeTest, cursor]);
  useEffect(() => { void load(); }, [load]);

  const columns: Column<PaymentRow>[] = [
    {
      key: "order", header: "Order",
      render: (p) => (
        <div>
          <p className="font-black text-slate-900">{p.order?.orderNumber ?? "Order"}</p>
          <p className="text-xs font-semibold text-slate-500">{p.order?.buyer?.name || p.order?.buyer?.email || "Buyer not provided"}</p>
        </div>
      ),
    },
    { key: "vendor", header: "Vendor", render: (p) => <span className="font-semibold">{p.vendorName ?? "—"}</span> },
    { key: "amount", header: "Amount", render: (p) => <span className="font-black">{formatMinor(p.amount, p.currency)}</span> },
    {
      key: "provider", header: "Provider",
      render: (p) => (
        <div>
          <span className="font-semibold capitalize">{p.provider}</span>
          {p.paymentMethodType ? <p className="text-xs text-slate-500">{p.paymentMethodType}</p> : null}
        </div>
      ),
    },
    {
      key: "status", header: "Payment status",
      render: (p) => (
        <div className="space-y-1">
          <Badge tone={paymentStatusTone(p.status)}>{p.status === "SUCCEEDED" ? "Succeeded" : p.status === "FAILED" ? "Failed" : "Pending"}</Badge>
          {p.status === "FAILED" ? <p className="text-xs font-semibold text-red-600">{failureCopy(p.failureCode, p.failureMessage).title}</p> : null}
          {p.status !== "SUCCEEDED" ? <p className="text-[11px] text-slate-400">No funds collected</p> : null}
        </div>
      ),
    },
    { key: "time", header: "Time", render: (p) => <span className="text-xs font-semibold text-slate-600">{formatDateTime(p.processedAt ?? p.createdAt)}</span> },
    { key: "act", header: "", className: "text-right", render: (p) => <Button variant="ghost" className="h-9 px-3" onClick={(e) => { e.stopPropagation(); router.push(`/payments/${p.id}`); }}>View</Button> },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Payments"
        subtitle="Payment truth comes from the provider (Stripe webhooks). A payment that did not succeed collected no funds and created no vendor earnings."
        actions={<Button variant="ghost" onClick={() => downloadCsv("payments.csv", rows.map((p) => ({
          order: p.order?.orderNumber ?? "", buyer: p.order?.buyer?.email ?? "", vendor: p.vendorName ?? "", amount: p.amount / 100,
          currency: p.currency, provider: p.provider, status: p.status, failure: p.failureCode ?? "", time: p.processedAt ?? p.createdAt,
        })))}>Export page (CSV)</Button>}
      />
      {error ? <ErrorPanel message={error} onRetry={() => void load()} /> : null}
      <Card className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <SearchInput value={q} onChange={(v) => setParams({ q: v })} placeholder="Search order number, buyer, or Stripe payment ID" />
          <FilterSelect label="Provider" value={provider} onChange={(v) => setParams({ provider: v })} options={PROVIDER_OPTIONS} />
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-600">
            <input type="checkbox" checked={includeTest} onChange={(e) => setParams({ includeTest: e.target.checked ? "true" : null })} className="h-4 w-4 accent-[#096B4A]" />
            Include test records
          </label>
        </div>
        <StatusTabs tabs={STATUS_TABS} active={status} onChange={(k) => setParams({ status: k })} />
        {vendorId ? <p className="text-xs font-semibold text-slate-500">Filtered to one vendor. <button className="underline" onClick={() => setParams({ vendorId: null })}>Clear</button></p> : null}
        {loading && rows.length === 0 ? <LoadingPanel label="Loading payments…" /> : (
          <>
            <DataTable columns={columns} rows={rows} rowKey={(p) => p.id} onRowClick={(p) => router.push(`/payments/${p.id}`)} loading={loading} emptyTitle="No payments match these filters" />
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

export default function PaymentsPage() {
  return (
    <ProtectedRoute>
      <AdminLayout>
        <Suspense fallback={<LoadingPanel label="Loading payments…" />}>
          <PaymentsInner />
        </Suspense>
      </AdminLayout>
    </ProtectedRoute>
  );
}
