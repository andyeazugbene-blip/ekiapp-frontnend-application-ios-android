"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import AdminLayout from "@/components/AdminLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Badge, Button, Card, ErrorPanel, LoadingPanel, PageHeader } from "@/components/AdminUI";
import { DataTable, Pagination, SearchInput, StatusTabs, formatDateTime, formatMinor, type Column } from "@/components/AdminKit";
import { APIError } from "@/lib/api";
import { disputeStatusLabel, disputesAPI2, type DisputeRow } from "@/lib/services/money.api";

const TABS = [
  { key: "", label: "All" },
  { key: "OPEN", label: "Open" },
  { key: "RESOLVED_BUYER", label: "Buyer refunded" },
  { key: "RESOLVED_VENDOR", label: "Released to vendor" },
  { key: "RESOLVED_PARTIAL", label: "Partial" },
];

function DisputesInner() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const q = params.get("q") ?? "";
  const status = params.get("status") ?? "";
  const vendorId = params.get("vendorId") ?? "";

  const setParams = useCallback((patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) { if (v == null || v === "") next.delete(k); else next.set(k, v); }
    router.replace(`${pathname}?${next.toString()}`);
  }, [params, pathname, router]);

  const [rows, setRows] = useState<DisputeRow[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cursor, setCursor] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const stack = useRef<Array<string | null>>([]);

  const key = `${q}|${status}|${vendorId}`;
  useEffect(() => { stack.current = []; setCursor(null); }, [key]);

  const load = useCallback(async () => {
    try {
      setLoading(true); setError("");
      const res = await disputesAPI2.list({ q, status, vendorId, cursor });
      setRows(res.items); setNextCursor(res.nextCursor); setTotal(res.total);
    } catch (e) { setError(e instanceof APIError ? e.message : "Failed to load disputes"); }
    finally { setLoading(false); }
  }, [q, status, vendorId, cursor]);
  useEffect(() => { void load(); }, [load]);

  const columns: Column<DisputeRow>[] = [
    { key: "o", header: "Order", render: (d) => <span className="font-black text-slate-900">{d.order?.orderNumber ?? "Order"}</span> },
    { key: "who", header: "Buyer → vendor", render: (d) => <div><p className="font-semibold">{d.buyerName || d.buyerEmail || "Buyer not provided"}</p><p className="text-xs text-slate-500">→ {d.vendorName ?? "Vendor not provided"}</p></div> },
    { key: "why", header: "Reason", render: (d) => <span className="line-clamp-2 max-w-xs text-sm">{d.reason}</span> },
    { key: "amt", header: "Order total", render: (d) => d.order ? formatMinor(d.order.totalAmount, d.order.currency) : "—" },
    { key: "st", header: "Status", render: (d) => <div className="space-y-1"><Badge tone={d.status === "OPEN" ? "red" : "green"}>{disputeStatusLabel[d.status]}</Badge>{d.fraudulent ? <Badge tone="amber">Flagged fraud</Badge> : null}</div> },
    { key: "t", header: "Opened", render: (d) => <span className="text-xs font-semibold text-slate-600">{formatDateTime(d.createdAt)}</span> },
    { key: "a", header: "", className: "text-right", render: (d) => <Button variant={d.status === "OPEN" ? "secondary" : "ghost"} className="h-9 px-3" onClick={(e) => { e.stopPropagation(); router.push(`/disputes/${d.id}`); }}>{d.status === "OPEN" ? "Decide" : "View"}</Button> },
  ];

  return (
    <div className="space-y-5">
      <PageHeader title="Disputes" subtitle="Buyer-raised disputes on escrow orders. Card chargebacks raised through Stripe are listed under Chargebacks." />
      {error ? <ErrorPanel message={error} onRetry={() => void load()} /> : null}
      <Card className="space-y-4">
        <SearchInput value={q} onChange={(v) => setParams({ q: v })} placeholder="Search order number or reason" />
        <StatusTabs tabs={TABS} active={status} onChange={(k) => setParams({ status: k })} />
        {vendorId ? <p className="text-xs font-semibold text-slate-500">Filtered to one vendor. <button className="underline" onClick={() => setParams({ vendorId: null })}>Clear</button></p> : null}
        {loading && rows.length === 0 ? <LoadingPanel label="Loading disputes…" /> : (
          <>
            <DataTable columns={columns} rows={rows} rowKey={(d) => d.id} onRowClick={(d) => router.push(`/disputes/${d.id}`)} loading={loading} emptyTitle="No disputes match these filters" />
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

export default function DisputesPage() {
  return (
    <ProtectedRoute>
      <AdminLayout>
        <Suspense fallback={<LoadingPanel label="Loading disputes…" />}>
          <DisputesInner />
        </Suspense>
      </AdminLayout>
    </ProtectedRoute>
  );
}
