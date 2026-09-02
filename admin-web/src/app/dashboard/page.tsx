"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import Link from "next/link";
import AdminLayout from "@/components/AdminLayout";
import { Card, ErrorPanel, Icon, LoadingPanel, downloadCsv } from "@/components/AdminUI";
import ProtectedRoute from "@/components/ProtectedRoute";
import { APIError } from "@/lib/api";
import { SUPPORTED_CURRENCIES, formatDisplayMoney, useAdminDisplayCurrency } from "@/lib/displayCurrency";
import { adminAPI, CommunicationStats } from "@/lib/services/admin.api";
import { disputesAPI } from "@/lib/services/disputes.api";
import { ordersAPI } from "@/lib/services/orders.api";
import { Analytics, AnalyticsOverview, DashboardStats, Dispute, Order, RevenueSeries } from "@/types";

type ChartRange = "today" | "7d" | "30d" | "90d";

/* ───── KPI Card ───── */
function KpiCard({ label, value, change, stable }: { label: string; value: string; change?: number; stable?: boolean }) {
  const hasChange = change !== undefined && !stable;
  const up = hasChange && change >= 0;
  return (
    <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3.5">
      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider truncate">{label}</p>
      <p className="mt-1.5 text-xl font-black text-[#101820] tracking-tight truncate">{value}</p>
      {hasChange ? (
        <p className={`mt-1 flex items-center gap-0.5 text-[11px] font-bold ${up ? "text-emerald-500" : "text-red-500"}`}>
          <span>{up ? "↑" : "↓"}</span> {Math.abs(change!).toFixed(1)}%
        </p>
      ) : (
        <p className="mt-1 text-[11px] font-medium text-slate-300">— stable</p>
      )}
    </div>
  );
}

/* ───── Urgent Action Item ───── */
function UrgentItem({ label, count, href, color = "#f59e0b" }: { label: string; count: number; href: string; color?: string }) {
  return (
    <Link href={href} className="group flex items-center gap-3 rounded-xl px-1 py-2 hover:bg-slate-50 transition">
      <div className="w-1 h-8 rounded-full" style={{ backgroundColor: color }} />
      <span className="flex-1 text-[13px] font-medium text-slate-700 group-hover:text-[#096B4A]">{label}</span>
      <span className="flex h-6 min-w-[24px] items-center justify-center rounded-full bg-slate-100 px-2 text-[11px] font-bold text-slate-600">{count}</span>
      <svg className="h-3.5 w-3.5 text-slate-300 group-hover:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
    </Link>
  );
}

/* ───── Order Status Box ───── */
function OrderStatusBox({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="h-1.5 w-full rounded-full" style={{ backgroundColor: color }} />
      <span className="text-lg font-black text-[#101820]">{count}</span>
      <span className="text-[10px] font-medium text-slate-500">{label}</span>
    </div>
  );
}

/* ───── Quick Action Pill ───── */
function ActionPill({ label, href, bg, dotColor, icon }: { label: string; href: string; bg: string; dotColor: string; icon: string }) {
  return (
    <Link href={href} className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-semibold text-white transition hover:opacity-90" style={{ backgroundColor: bg }}>
      <span style={{ color: dotColor }}>{icon}</span>
      {label}
    </Link>
  );
}

/* ───── Activity Item ───── */
function ActivityItem({ icon, iconColor, title, subtitle }: { icon: string; iconColor: string; title: string; subtitle: string }) {
  return (
    <div className="flex items-start gap-2.5 py-1.5">
      <span className="mt-0.5 text-sm" style={{ color: iconColor }}>{icon}</span>
      <div className="min-w-0">
        <p className="text-[12px] font-semibold text-slate-800 truncate">{title}</p>
        <p className="text-[11px] text-slate-400 truncate">{subtitle}</p>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [revenueData, setRevenueData] = useState<RevenueSeries[]>([]);
  const [revenueMeta, setRevenueMeta] = useState<{ grossRevenue: number; platformFees: number; vendorEarnings: number; totalPayouts: number; netRevenue: number } | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [commStats, setCommStats] = useState<CommunicationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [chartRange, setChartRange] = useState<ChartRange>("30d");
  const [dateOpen, setDateOpen] = useState(false);

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const [dashboardData, overviewData, analyticsData, revData, orderData, disputeData, commData] = await Promise.all([
        adminAPI.getDashboard(),
        adminAPI.getAnalyticsOverview().catch(() => null),
        adminAPI.getAnalytics().catch(() => null),
        adminAPI.getRevenueSeries("30d").catch(() => ({ series: [], grossRevenue: 0, platformFees: 0, vendorEarnings: 0, totalPayouts: 0, netRevenue: 0 })),
        ordersAPI.getOrders({ limit: 50 }).catch(() => []),
        disputesAPI.getDisputes().catch(() => []),
        adminAPI.getCommunicationStats().catch(() => null),
      ]);
      setStats(dashboardData);
      setOverview(overviewData);
      setAnalytics(analyticsData);
      setRevenueData(revData.series ?? []);
      setRevenueMeta(revData);
      setOrders(orderData);
      setDisputes(disputeData);
      setCommStats(commData);
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadDashboard(); }, [loadDashboard]);

  const loadChartData = useCallback(async (range: ChartRange) => {
    setChartRange(range);
    const apiRange = range === "today" ? "7d" : range;
    try {
      const rev = await adminAPI.getRevenueSeries(apiRange as "7d" | "30d" | "90d");
      setRevenueData(rev.series ?? []);
      setRevenueMeta(rev);
    } catch { /* keep existing */ }
  }, []);

  const { selectedCurrency, setSelectedCurrency } = useAdminDisplayCurrency("EUR");
  const cur = overview?.currency ?? "GBP";
  const fmtMoney = (v: number) => formatDisplayMoney(v, cur, selectedCurrency);
  const fmtNum = (v: number) => v.toLocaleString();

  const chartData = useMemo(
    () => revenueData.map((p) => ({
      name: p.day,
      Revenue: Number(p.amount.toFixed(2)),
    })),
    [revenueData],
  );

  const today = new Date();
  const todayStr = today.toLocaleDateString("en-GB", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const dateRange = `${new Date(today.getFullYear(), today.getMonth(), 1).toLocaleDateString("en-GB", { month: "short", day: "numeric" })} – ${today.toLocaleDateString("en-GB", { month: "short", day: "numeric", year: "numeric" })}`;

  const orderCounts = useMemo(() => {
    const c: Record<string, number> = { pending: 0, confirmed: 0, shipped: 0, delivered: 0, completed: 0, cancelled: 0, refunded: 0 };
    orders.forEach((o) => { c[o.status] = (c[o.status] ?? 0) + 1; });
    if (analytics?.orders) {
      if (analytics.orders.pending) c.pending = analytics.orders.pending;
      if (analytics.orders.completed) c.completed = analytics.orders.completed;
      if (analytics.orders.paid) c.confirmed = analytics.orders.paid;
      if (analytics.orders.failed) c.cancelled = analytics.orders.failed;
    }
    return c;
  }, [orders, analytics]);

  const openDisputeCount = disputes.filter(d => d.status === "OPEN" || d.status === "open").length || (overview?.openDisputes ?? 0);
  const refundCount = orders.filter(o => o.status === "refunded").length;

  const urgentTotal = (stats?.pendingApprovals ?? 0) + (overview?.pendingVerifications ?? 0) + orderCounts.pending + openDisputeCount + refundCount + (stats?.suspendedVendors ?? 0) + (stats?.pendingPayoutsCount ?? 0) + (stats?.expiringSubscriptionsCount ?? 0);

  const recentActivity = useMemo(() => {
    const items: { icon: string; iconColor: string; title: string; subtitle: string }[] = [];
    orders.slice(0, 2).forEach(o => {
      items.push({ icon: "●", iconColor: "#3b82f6", title: "Order Placed", subtitle: o.orderNumber });
    });
    disputes.slice(0, 1).forEach(d => {
      items.push({ icon: "▲", iconColor: "#ef4444", title: "Dispute Opened", subtitle: d.orderId.slice(0, 12) });
    });
    orders.filter(o => o.status === "refunded").slice(0, 1).forEach(o => {
      items.push({ icon: "●", iconColor: "#8b5cf6", title: "Refund Done", subtitle: o.orderNumber });
    });
    return items;
  }, [orders, disputes]);

  return (
    <ProtectedRoute>
      <AdminLayout>
        {loading ? (
          <LoadingPanel label="Loading platform overview..." />
        ) : error ? (
          <ErrorPanel message={error} onRetry={() => void loadDashboard()} />
        ) : (
          <div className="space-y-5">
            {/* ═══ Header ═══ */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h1 className="text-2xl font-black tracking-tight text-[#101820]">Overview Dashboard</h1>
                <p className="text-[13px] text-slate-400">Today · {todayStr}</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <button onClick={() => setDateOpen(p => !p)} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-[13px] font-medium text-slate-600 hover:bg-slate-50 transition">
                    {dateRange}
                    <svg className={`h-3.5 w-3.5 text-slate-400 transition ${dateOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </button>
                  {dateOpen && (
                    <div className="absolute right-0 top-full mt-1 z-30 w-44 rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                      {(["today", "7d", "30d", "90d"] as ChartRange[]).map(r => (
                        <button key={r} onClick={() => { void loadChartData(r); setDateOpen(false); }}
                          className={`block w-full px-4 py-2 text-left text-[13px] font-medium transition ${chartRange === r ? "bg-emerald-50 text-[#096B4A]" : "text-slate-600 hover:bg-slate-50"}`}>
                          {r === "today" ? "Today" : r === "7d" ? "Last 7 days" : r === "30d" ? "Last 30 days" : "Last 90 days"}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center rounded-xl border border-slate-200 bg-white px-3 py-2 gap-2">
                  <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path strokeLinecap="round" strokeWidth={2} d="m20 20-3.5-3.5" /></svg>
                  <span className="text-[13px] text-slate-400">Search...</span>
                </div>
                <select
                  value={selectedCurrency}
                  onChange={(e) => setSelectedCurrency(e.target.value as any)}
                  className="h-9 rounded-xl border border-slate-200 bg-white px-2 text-[13px] font-bold text-slate-600 outline-none"
                >
                  {SUPPORTED_CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            {/* ═══ KPI Row 1 — 7 cards ═══ */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
              <KpiCard label="GMV" value={fmtMoney(overview?.gmv ?? 0)} />
              <KpiCard label="Revenue" value={fmtMoney(overview?.ekiRevenue ?? 0)} />
              <KpiCard label="Orders" value={fmtNum(overview?.totalOrders ?? 0)} />
              <KpiCard label="Avg Order" value={fmtMoney(overview?.avgOrderValue ?? 0)} />
              <KpiCard label="Total Buyers" value={fmtNum(overview?.totalBuyers ?? 0)} />
              <KpiCard label="Total Vendors" value={fmtNum(overview?.totalVendors ?? 0)} />
              <KpiCard label="Active Buyers" value={fmtNum(overview?.activeBuyers30d ?? 0)} change={overview?.buyerRetentionRate} />
            </div>

            {/* ═══ KPI Row 2 — 8 cards ═══ */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
              <KpiCard label="Active Vendors" value={fmtNum(overview?.activeVendors30d ?? 0)} change={overview?.vendorRetentionRate} />
              <KpiCard label="Escrow" value={fmtMoney(overview?.escrowBalance ?? 0)} stable />
              <KpiCard label="Pending Payouts" value={fmtMoney(overview?.pendingPayouts ?? 0)} stable />
              <KpiCard label="Open Disputes" value={fmtNum(openDisputeCount)} change={openDisputeCount > 0 ? undefined : undefined} stable={openDisputeCount === 0} />
              <KpiCard label="Pending Verif." value={fmtNum(overview?.pendingVerifications ?? 0)} stable />
              <KpiCard label="Sub Revenue" value={fmtMoney(overview?.subscriptionRevenue ?? 0)} />
              <KpiCard label="Refunds" value={fmtNum(refundCount)} stable />
            </div>

            {/* ═══ 3-Column Layout ═══ */}
            <div className="grid gap-5 xl:grid-cols-[260px_1fr_240px]">

              {/* ── Left: Urgent Actions ── */}
              <div className="rounded-2xl border border-slate-100 bg-white p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" />
                  <h3 className="text-sm font-black text-slate-800">Urgent Actions</h3>
                  <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">{urgentTotal}</span>
                </div>
                <div className="space-y-0.5">
                  <UrgentItem label="Vendor Applications" count={stats?.pendingApprovals ?? 0} href="/vendors" color="#f59e0b" />
                  <UrgentItem label="Pending Verifications" count={overview?.pendingVerifications ?? 0} href="/verification" color="#f59e0b" />
                  <UrgentItem label="Orders Need Courier" count={orderCounts.confirmed} href="/orders" color="#f59e0b" />
                  <UrgentItem label="Pending Payouts" count={stats?.pendingPayoutsCount ?? 0} href="/payout-requests" color="#f59e0b" />
                  <UrgentItem label="Open Disputes" count={openDisputeCount} href="/disputes" color="#ef4444" />
                  <UrgentItem label="Refund Requests" count={refundCount} href="/refunds" color="#f59e0b" />
                  <UrgentItem label="Failed Payments" count={analytics?.orders?.failed ?? 0} href="/payments" color="#ef4444" />
                  <UrgentItem label="High-risk Vendors" count={stats?.suspendedVendors ?? 0} href="/vendors" color="#ef4444" />
                  <UrgentItem label="Expiring Subs" count={stats?.expiringSubscriptionsCount ?? 0} href="/subscription-plans" color="#f59e0b" />
                </div>
                <Link href="/vendors" className="mt-3 block text-[12px] font-semibold text-[#096B4A] hover:underline">
                  View all pending actions →
                </Link>
              </div>

              {/* ── Center: Chart + Orders + Comms ── */}
              <div className="space-y-5">
                {/* Revenue & GMV Chart */}
                <div className="rounded-2xl border border-slate-100 bg-white p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-black text-slate-800">Revenue & GMV</h3>
                    <div className="flex gap-1">
                      {(["today", "7d", "30d", "90d"] as ChartRange[]).map((r) => (
                        <button
                          key={r}
                          onClick={() => void loadChartData(r)}
                          className={`rounded-lg px-3 py-1 text-[11px] font-bold transition ${
                            chartRange === r
                              ? "bg-[#096B4A] text-white"
                              : "text-slate-500 hover:bg-slate-100"
                          }`}
                        >
                          {r === "today" ? "Today" : r.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="h-[240px]">
                    {chartData.length ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} barGap={2} barSize={chartData.length > 30 ? 5 : 14}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                          <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                          <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                          <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }} />
                          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: "#64748b" }} />
                          <Bar dataKey="Revenue" fill="#096B4A" radius={[3, 3, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-slate-400">No revenue data</div>
                    )}
                  </div>
                </div>

                {/* Orders by Status */}
                <div className="rounded-2xl border border-slate-100 bg-white p-5">
                  <h3 className="mb-4 text-sm font-black text-slate-800">Orders by Status</h3>
                  <div className="grid grid-cols-4 gap-3 sm:grid-cols-8">
                    <OrderStatusBox label="Pending" count={orderCounts.pending} color="#f59e0b" />
                    <OrderStatusBox label="Paid" count={orderCounts.confirmed} color="#3b82f6" />
                    <OrderStatusBox label="Processing" count={orderCounts.shipped} color="#8b5cf6" />
                    <OrderStatusBox label="Shipped" count={orderCounts.delivered} color="#06b6d4" />
                    <OrderStatusBox label="Delivered" count={orderCounts.completed} color="#10b981" />
                    <OrderStatusBox label="Cancelled" count={orderCounts.cancelled} color="#ef4444" />
                    <OrderStatusBox label="Disputed" count={openDisputeCount} color="#f97316" />
                    <OrderStatusBox label="Refunded" count={orderCounts.refunded} color="#6366f1" />
                  </div>
                </div>

                {/* Communications */}
                <div className="rounded-2xl border border-slate-100 bg-white px-5 py-4">
                  <h3 className="mb-3 text-sm font-black text-slate-800">Communications — Last 30 Days</h3>
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                    <span className="text-sm"><span className="font-black text-[#101820]">{fmtNum(commStats?.total ?? 0)}</span> <span className="text-slate-400">Total</span></span>
                    <span className="text-sm"><span className="font-black text-emerald-500">{fmtNum(commStats?.totalSent ?? 0)}</span> <span className="text-slate-400">Sent</span></span>
                    <span className="text-sm"><span className="font-black text-blue-500">{fmtNum(commStats?.totalQueued ?? 0)}</span> <span className="text-slate-400">Queued</span></span>
                    <span className="text-sm"><span className="font-black text-red-500">{fmtNum(commStats?.totalFailed ?? 0)}</span> <span className="text-slate-400">Failed</span></span>
                  </div>
                </div>
              </div>

              {/* ── Right: Quick Actions + Financial + Activity ── */}
              <div className="space-y-5">
                {/* Quick Actions */}
                <div className="rounded-2xl border border-slate-100 bg-white p-4">
                  <h3 className="mb-3 text-sm font-black text-slate-800">Quick Actions</h3>
                  <div className="space-y-2">
                    <ActionPill label="Approve Vendors" href="/vendors" bg="#096B4A" dotColor="#86efac" icon="✓" />
                    <ActionPill label="Process Payouts" href="/payout-requests" bg="#096B4A" dotColor="#86efac" icon="○" />
                    <ActionPill label="View Disputes" href="/disputes" bg="#ef4444" dotColor="#fca5a5" icon="▲" />
                    <ActionPill label="Send Announcement" href="/communications" bg="#096B4A" dotColor="#86efac" icon="●" />
                    <ActionPill label="Create Campaign" href="/campaigns" bg="#096B4A" dotColor="#86efac" icon="◆" />
                  </div>
                </div>

                {/* Financial Snapshot */}
                <div className="rounded-2xl border border-slate-100 bg-white p-4">
                  <h3 className="mb-3 text-sm font-black text-slate-800">Financial Snapshot</h3>
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] text-slate-500">Escrow Balance</span>
                      <span className="text-[13px] font-bold text-[#101820]">{fmtMoney(overview?.escrowBalance ?? 0)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] text-slate-500">Pending Payouts</span>
                      <span className="text-[13px] font-bold text-red-500">{fmtMoney(overview?.pendingPayouts ?? 0)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] text-slate-500">Refund Pool</span>
                      <span className="text-[13px] font-bold text-[#101820]">{fmtMoney(revenueMeta?.totalPayouts ?? 0)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] text-slate-500">Sub Revenue</span>
                      <span className="text-[13px] font-bold text-[#101820]">{fmtMoney(overview?.subscriptionRevenue ?? 0)}</span>
                    </div>
                  </div>
                </div>

                {/* Recent Activity */}
                <div className="rounded-2xl border border-slate-100 bg-white p-4">
                  <h3 className="mb-3 text-sm font-black text-slate-800">Recent Activity</h3>
                  <div className="space-y-1">
                    {stats && (stats.pendingApprovals > 0 || stats.activeVendors > 0) && (
                      <ActivityItem icon="✓" iconColor="#10b981" title="Vendor Approved" subtitle="Recent vendor" />
                    )}
                    {recentActivity.map((item, i) => (
                      <ActivityItem key={i} {...item} />
                    ))}
                    {recentActivity.length === 0 && !stats?.activeVendors && (
                      <p className="text-xs text-slate-400 text-center py-3">No recent activity</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* ═══ Bottom: Buyer & Vendor Growth ═══ */}
            <div className="rounded-2xl border border-slate-100 bg-white px-6 py-4">
              <h3 className="mb-3 text-sm font-black text-slate-800">Buyer & Vendor Growth · Last 30 Days</h3>
              <div className="grid grid-cols-2 gap-y-3 sm:grid-cols-4 xl:grid-cols-8">
                <div>
                  <p className="text-lg font-black text-emerald-500">+{fmtNum(overview?.newBuyers ?? 0)}</p>
                  <p className="text-[11px] text-slate-400">New Buyers</p>
                </div>
                <div>
                  <p className="text-lg font-black text-[#101820]">{fmtNum(overview?.activeBuyers30d ?? 0)}</p>
                  <p className="text-[11px] text-slate-400">Active Buyers</p>
                </div>
                <div>
                  <p className="text-lg font-black text-emerald-500">{(overview?.buyerRetentionRate ?? 0).toFixed(1)}%</p>
                  <p className="text-[11px] text-slate-400">Buyer Retention</p>
                </div>
                <div>
                  <p className="text-lg font-black text-red-500">{(100 - (overview?.buyerRetentionRate ?? 0)).toFixed(1)}%</p>
                  <p className="text-[11px] text-slate-400">Buyer Churn</p>
                </div>
                <div>
                  <p className="text-lg font-black text-emerald-500">+{fmtNum(overview?.newVendors ?? 0)}</p>
                  <p className="text-[11px] text-slate-400">New Vendors</p>
                </div>
                <div>
                  <p className="text-lg font-black text-[#101820]">{fmtNum(overview?.activeVendors30d ?? 0)}</p>
                  <p className="text-[11px] text-slate-400">Active Vendors</p>
                </div>
                <div>
                  <p className="text-lg font-black text-emerald-500">{(overview?.vendorRetentionRate ?? 0).toFixed(1)}%</p>
                  <p className="text-[11px] text-slate-400">Vendor Retention</p>
                </div>
                <div>
                  <p className="text-lg font-black text-red-500">{(100 - (overview?.vendorRetentionRate ?? 0)).toFixed(1)}%</p>
                  <p className="text-[11px] text-slate-400">Vendor Churn</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </AdminLayout>
    </ProtectedRoute>
  );
}
