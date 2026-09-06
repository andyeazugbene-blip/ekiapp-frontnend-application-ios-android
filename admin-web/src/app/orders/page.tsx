"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import AdminLayout from "@/components/AdminLayout";
import { Badge, Button, Card, ErrorPanel, Icon, LoadingPanel, PageHeader, downloadCsv } from "@/components/AdminUI";
import ProtectedRoute from "@/components/ProtectedRoute";
import { APIError } from "@/lib/api";
import { ordersAPI } from "@/lib/services/orders.api";
import { Order, OrderStatus } from "@/types";

export default function OrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");

  const loadOrders = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      setOrders(await ordersAPI.getOrders({ limit: 100 }));
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Failed to load orders");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  const filteredOrders = useMemo(() => {
    const term = searchQuery.toLowerCase();
    return orders.filter((order) => {
      const statusMatch = statusFilter === "all" || order.status === statusFilter;
      const searchMatch = !term || `${order.orderNumber} ${order.buyerName} ${order.vendorName}`.toLowerCase().includes(term);
      return statusMatch && searchMatch;
    });
  }, [orders, searchQuery, statusFilter]);

  const stats = {
    successful: orders.filter((order) => ["confirmed", "shipped", "delivered"].includes(order.status)).length,
    pending: orders.filter((order) => order.status === "pending").length,
    failed: orders.filter((order) => ["cancelled", "refunded"].includes(order.status)).length,
    delivered: orders.filter((order) => order.status === "delivered").length,
    late: orders.filter((order) => order.status === "shipped").length,
    notDelivered: orders.filter((order) => ["pending", "confirmed"].includes(order.status)).length,
  };
  // Real order counts grouped by calendar day (from the fetched orders) — not
  // a fabricated series. No backend endpoint provides a true daily
  // time-series, so this reflects only the days actually present in the
  // current fetch rather than inventing a fixed 7-day window.
  const chartData = useMemo(() => {
    const byDay = new Map<string, number>();
    for (const order of orders) {
      const key = new Date(order.createdAt).toISOString().slice(0, 10);
      byDay.set(key, (byDay.get(key) ?? 0) + 1);
    }
    return [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-7)
      .map(([key, count]) => ({
        day: new Date(key).toLocaleDateString("en-GB", { month: "short", day: "numeric" }),
        orders: count,
      }));
  }, [orders]);

  return (
    <ProtectedRoute>
      <AdminLayout>
        {loading ? <LoadingPanel label="Loading orders..." /> : (
          <div className="space-y-8">
            <PageHeader
              title="Order monitoring"
              subtitle="Orders > Order monitoring"
              actions={<><Button variant="ghost" disabled><Icon name="calendar" /> Last 30 days</Button><Button variant="secondary" onClick={() => exportOrders(orders)}><Icon name="export" /> Export report</Button></>}
            />
            {error ? <ErrorPanel message={error} onRetry={() => void loadOrders()} /> : null}

            <Card className="bg-[#101820] text-white">
              <div className="grid gap-6 lg:grid-cols-[0.25fr_0.75fr]">
                <div><p className="text-2xl">Total orders</p><p className="mt-4 text-5xl font-black">{orders.length}</p></div>
                <div className="h-48">
                  {chartData.length > 1 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}><XAxis dataKey="day" stroke="#b8c3ca" /><YAxis stroke="#b8c3ca" allowDecimals={false} /><Tooltip /><Area type="monotone" dataKey="orders" stroke="#8ee5b4" strokeWidth={4} fill="#8ee5b4" fillOpacity={0.22} /></AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-white/60">Not enough recent orders to chart a trend</div>
                  )}
                </div>
              </div>
            </Card>

            <div className="grid gap-6 lg:grid-cols-2">
              <StatusPanel title="Payment status" rows={[["Successful", stats.successful, "green"], ["Pending", stats.pending, "amber"], ["Failed", stats.failed, "red"]]} />
              <StatusPanel title="Delivery status" rows={[["Delivered on time", stats.delivered, "green"], ["Delivered late", stats.late, "amber"], ["Not delivered", stats.notDelivered, "red"]]} />
            </div>

            <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
              <Card>
                <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <h2 className="text-2xl font-black">Recent orders</h2>
                  <div className="flex gap-3">
                    <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search orders..." className="h-11 rounded-xl border border-slate-300 px-4 outline-none focus:border-[#096B4A]" />
                    <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as OrderStatus | "all")} className="h-11 rounded-xl border border-slate-300 px-4 outline-none focus:border-[#096B4A]">
                      <option value="all">All</option><option value="pending">Pending</option><option value="confirmed">Confirmed</option><option value="shipped">Shipped</option><option value="delivered">Delivered</option><option value="cancelled">Cancelled</option><option value="refunded">Refunded</option>
                    </select>
                  </div>
                </div>
                <div className="divide-y divide-slate-100">
                  {filteredOrders.slice(0, 12).map((order) => (
                    <button key={order.id} onClick={() => router.push(`/orders/${order.id}`)} onMouseEnter={() => void ordersAPI.preloadOrder(order.id)} className="grid w-full gap-4 py-5 text-left md:grid-cols-[1fr_1fr_auto_auto] md:items-center">
                      <div><p className="text-sm text-slate-500">{order.orderNumber}</p><p className="mt-1 text-lg font-black">{order.items?.[0]?.productTitle || "Order"}</p></div>
                      <p className="text-slate-600">{order.vendorName || "Unknown vendor"}</p>
                      <StatusBadge status={order.status} />
                      <Button variant="secondary">View order <Icon name="arrow" className="h-4 w-4" /></Button>
                    </button>
                  ))}
                </div>
              </Card>
              <Card className="space-y-5">
                <Button className="h-16 w-full" onClick={() => setStatusFilter("pending")}><Icon name="check" /> Review pending orders</Button>
                <Button variant="secondary" className="h-16 w-full" disabled title="Bulk status update needs a dedicated backend endpoint."><Icon name="check" /> Bulk update status</Button>
                <Button variant="secondary" className="h-16 w-full" disabled title="Open an order to update its delivery/payment state."><Icon name="orders" /> Update delivery status</Button>
                <Button variant="secondary" className="h-16 w-full" onClick={() => exportOrders(filteredOrders)}><Icon name="export" /> Export orders</Button>
              </Card>
            </div>
          </div>
        )}
      </AdminLayout>
    </ProtectedRoute>
  );
}

function exportOrders(orders: Order[]) {
  downloadCsv("eki-orders.csv", orders.map((order) => ({
    orderNumber: order.orderNumber,
    buyer: order.buyerName,
    vendor: order.vendorName,
    status: order.status,
    currency: order.currency,
    total: order.totalAmount,
    createdAt: order.createdAt,
  })));
}

function StatusPanel({ title, rows }: { title: string; rows: [string, number, string][] }) {
  return <Card><h2 className="text-xl font-black">{title}</h2><div className="mt-6 space-y-4">{rows.map(([label, value, tone]) => <div key={label} className={`flex items-center justify-between rounded-xl px-5 py-4 ${tone === "green" ? "bg-emerald-50" : tone === "amber" ? "bg-amber-50" : "bg-red-50"}`}><span className="font-bold">{label}</span><span className="text-xl font-black">{value}</span></div>)}</div></Card>;
}

function StatusBadge({ status }: { status: string }) {
  if (status === "delivered" || status === "confirmed" || status === "shipped") return <Badge tone="green">{status}</Badge>;
  if (status === "pending") return <Badge tone="amber">{status}</Badge>;
  return <Badge tone="red">{status}</Badge>;
}
