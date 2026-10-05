"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { NoAccess } from "@/components/PageStates";
import AdminLayout from "@/components/AdminLayout";
import { Badge, Button, Card, ErrorPanel, Icon, LoadingPanel, PageHeader } from "@/components/AdminUI";
import { DataTable, FilterSelect, Pagination, SearchInput, StatusTabs, formatDateTime, timeAgo } from "@/components/AdminKit";
import ProtectedRoute from "@/components/ProtectedRoute";
import { APIError } from "@/lib/api";
import { supportAPI, type AdminSupportConversation, type SupportCounts, type SupportListFilters } from "@/lib/services/support.api";

const REFRESH_MS = 30_000;

export default function ConversationsPage() {
  return (
    <Suspense fallback={<AdminLayout><LoadingPanel label="Loading conversations..." /></AdminLayout>}>
      <ConversationsContent />
    </Suspense>
  );
}

function RoleBadge({ role }: { role?: string }) {
  if (role === "VENDOR") return <Badge tone="blue">VENDOR</Badge>;
  if (role === "BUYER") return <Badge tone="green">BUYER</Badge>;
  return <Badge tone="gray">{role ?? "UNKNOWN"}</Badge>;
}

function ConversationsContent() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  // URL contract (also used by Action Centre / sidebar badges):
  // ?status=open|closed|all|unread|escalated, plus ?q= ?role= ?reported ?orderLinked ?orderId
  const statusParam = sp.get("status") || "open";
  const status: "open" | "closed" | "all" = statusParam === "closed" ? "closed" : statusParam === "all" || statusParam === "unread" || statusParam === "escalated" ? "all" : "open";
  const q = sp.get("q") ?? "";
  const role = (sp.get("role") as "buyer" | "vendor" | null) ?? "";
  const unread = statusParam === "unread" || sp.get("unread") === "true";
  const escalated = statusParam === "escalated" || sp.get("escalated") === "true";
  const activeTab = statusParam === "unread" || statusParam === "escalated" || statusParam === "closed" || statusParam === "all" ? statusParam : "open";
  const reported = sp.get("reported") === "true";
  const orderLinked = sp.get("orderLinked") === "true";
  const orderId = sp.get("orderId") ?? "";

  const [items, setItems] = useState<AdminSupportConversation[]>([]);
  const [counts, setCounts] = useState<SupportCounts | null>(null);
  const [total, setTotal] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [cursors, setCursors] = useState<string[]>([]); // stack of cursors for previous pages
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ message: string; forbidden: boolean } | null>(null);
  const inflight = useRef(0);

  const setParam = useCallback((patch: Record<string, string | null>) => {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "" || v === "false") next.delete(k);
      else next.set(k, v);
    }
    setCursor(undefined);
    setCursors([]);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }, [sp, router, pathname]);

  const load = useCallback(async (silent = false) => {
    const ticket = ++inflight.current;
    if (!silent) setLoading(true);
    const filters: SupportListFilters = { status: unread || escalated ? "all" : status, q: q || undefined, role, unread, escalated, reported, orderLinked, orderId: orderId || undefined, cursor };
    try {
      const res = await supportAPI.list(filters);
      if (ticket !== inflight.current) return;
      setItems(res.items);
      setCounts(res.counts);
      setTotal(res.total);
      setNextCursor(res.nextCursor);
      setError(null);
    } catch (err) {
      if (ticket !== inflight.current) return;
      const forbidden = err instanceof APIError && err.status === 403;
      setError({ message: forbidden ? "You do not have permission to view support conversations." : err instanceof APIError ? err.message : "Could not load conversations.", forbidden });
    } finally {
      if (ticket === inflight.current) setLoading(false);
    }
  }, [status, q, role, unread, escalated, reported, orderLinked, orderId, cursor]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === "visible") void load(true); }, REFRESH_MS);
    return () => clearInterval(t);
  }, [load]);

  const toggle = (key: string, on: boolean) => setParam({ [key]: on ? null : "true" });
  const chip = (label: string, on: boolean, key: string, count?: number | null) => (
    <button
      key={key}
      type="button"
      aria-pressed={on}
      onClick={() => toggle(key, on)}
      className={`h-11 rounded-xl border px-4 text-sm font-bold transition ${on ? "border-[#096B4A] bg-emerald-50 text-[#096B4A]" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}
    >
      {label}{count != null ? <span className="ml-2 rounded-md bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">{count}</span> : null}
    </button>
  );

  return (
    <ProtectedRoute>
      <AdminLayout>
        <div className="space-y-6">
          <PageHeader
            title="Conversations"
            subtitle="Support messages from buyers and vendors, plus replies to admin broadcasts. Any admin with support access can pick up a thread."
            actions={<Button variant="ghost" onClick={() => void load()}><Icon name="refresh" className="h-4 w-4" />Refresh</Button>}
          />

          <StatusTabs
            active={activeTab}
            onChange={(k) => setParam({ status: k === "open" ? null : k, unread: null, escalated: null })}
            tabs={[
              { key: "open", label: "Open", count: counts?.open ?? null },
              { key: "unread", label: "Unread", count: counts?.unread ?? null },
              { key: "escalated", label: "Escalated", count: counts?.escalated ?? null },
              { key: "closed", label: "Closed", count: counts?.closed ?? null },
              { key: "all", label: "All", count: counts?.all ?? null },
            ]}
          />

          <div className="flex flex-wrap items-center gap-3">
            <SearchInput value={q} onChange={(v) => setParam({ q: v })} placeholder="Search name, email, store, order or message text" />
            <FilterSelect
              label="Counterparty role"
              value={role ?? ""}
              onChange={(v) => setParam({ role: v })}
              options={[{ value: "", label: "All roles" }, { value: "buyer", label: "Buyers" }, { value: "vendor", label: "Vendors" }]}
            />
            {chip("Reported", reported, "reported")}
            {chip("Order-linked", orderLinked, "orderLinked")}
          </div>
          {orderId ? (
            <p className="text-sm font-semibold text-slate-600">
              Showing conversations for one order. <button className="font-bold text-[#096B4A] underline" onClick={() => setParam({ orderId: null })}>Clear</button>
            </p>
          ) : null}

          {error ? (
            error.forbidden
              ? <NoAccess what="support conversations" />
              : <ErrorPanel message={error.message} onRetry={() => void load()} />
          ) : loading && items.length === 0 ? (
            <LoadingPanel label="Loading conversations..." />
          ) : (
            <>
              <DataTable
                loading={loading}
                rows={items}
                rowKey={(c) => c.id}
                onRowClick={(c) => router.push(`/support-messages/${c.id}`)}
                emptyTitle={q || unread || escalated || reported || orderLinked || role || orderId ? "No conversations match these filters." : status === "closed" ? "No closed conversations." : "No conversations yet."}
                columns={[
                  {
                    key: "who", header: "Participant", render: (c) => (
                      <Link href={`/support-messages/${c.id}`} className="block min-w-[180px]" onClick={(e) => e.stopPropagation()}>
                        <span className="flex items-center gap-2">
                          <span className={`truncate font-bold ${c.unreadCount > 0 ? "text-[#101820]" : "text-slate-800"}`}>{c.counterparty?.name || "Unknown user"}</span>
                          <RoleBadge role={c.counterparty?.role} />
                        </span>
                        <span className="block truncate text-xs text-slate-500">
                          {c.counterparty?.role === "VENDOR" && c.counterparty.userName ? `${c.counterparty.userName} · ` : ""}{c.counterparty?.email ?? "No email on file"}
                        </span>
                      </Link>
                    ),
                  },
                  {
                    key: "last", header: "Latest message", className: "max-w-[360px]", render: (c) => (
                      <div>
                        <p className={`truncate text-sm ${c.unreadCount > 0 ? "font-bold text-[#101820]" : "text-slate-700"}`}>
                          {c.lastMessage ? `${c.lastMessageFromCounterparty === false ? "You: " : ""}${c.lastMessage}` : "No messages yet"}
                        </p>
                        {c.orderNumber ? (
                          <Link href={`/orders/${c.orderId}`} onClick={(e) => e.stopPropagation()} className="text-xs font-bold text-[#096B4A] hover:underline">Order {c.orderNumber}</Link>
                        ) : c.orderId ? <span className="text-xs text-slate-500">Linked order</span> : null}
                      </div>
                    ),
                  },
                  {
                    key: "state", header: "Status", render: (c) => (
                      <div className="flex flex-wrap gap-1.5">
                        <Badge tone={c.status === "OPEN" ? "green" : "gray"}>{c.status === "OPEN" ? "Open" : "Closed"}</Badge>
                        {c.escalated ? <Badge tone="red">Escalated</Badge> : null}
                        {c.reported ? <Badge tone="amber">Reported</Badge> : null}
                        {c.unreadCount > 0 ? <Badge tone="amber">{c.unreadCount} new</Badge> : null}
                        {c.type !== "SUPPORT" ? <Badge tone="gray">Broadcast reply</Badge> : null}
                      </div>
                    ),
                  },
                  {
                    key: "time", header: "Last activity", render: (c) => (
                      <div className="whitespace-nowrap">
                        <p className="text-sm font-semibold text-slate-800">{timeAgo(c.lastMessageAt)}</p>
                        <p className="text-xs text-slate-500">{formatDateTime(c.lastMessageAt)}</p>
                      </div>
                    ),
                  },
                ]}
              />
              <Pagination
                shown={items.length}
                total={total}
                loading={loading}
                hasPrev={cursors.length > 0}
                hasNext={!!nextCursor}
                onPrev={() => { const prev = [...cursors]; const c = prev.pop(); setCursors(prev); setCursor(c || undefined); }}
                onNext={() => { setCursors([...cursors, cursor ?? ""]); setCursor(nextCursor ?? undefined); }}
              />
            </>
          )}
        </div>
      </AdminLayout>
    </ProtectedRoute>
  );
}
