"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import AdminLayout from "@/components/AdminLayout";
import { Button, Card, ErrorPanel, Icon, LoadingPanel, PageHeader, downloadCsv } from "@/components/AdminUI";
import ProtectedRoute from "@/components/ProtectedRoute";
import { APIError } from "@/lib/api";
import { adminAPI } from "@/lib/services/admin.api";
import { SUPPORTED_CURRENCIES, formatDisplayMoney, useAdminDisplayCurrency } from "@/lib/displayCurrency";
import type { Analytics, RevenueSeries } from "@/types";

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [series, setSeries] = useState<RevenueSeries[]>([]);
  const [revenueMeta, setRevenueMeta] = useState<{grossRevenue:number;platformFees:number;vendorEarnings:number;totalPayouts:number;netRevenue:number} | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { selectedCurrency, setSelectedCurrency } = useAdminDisplayCurrency(analytics?.revenue?.currency ?? "GBP");

  const loadAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const [analyticsData, revenueData] = await Promise.all([
        adminAPI.getAnalytics(),
        adminAPI.getRevenueSeries("30d"),
      ]);
      setAnalytics(analyticsData);
      setSeries(revenueData.series);
      setRevenueMeta({
        grossRevenue: revenueData.grossRevenue,
        platformFees: revenueData.platformFees,
        vendorEarnings: revenueData.vendorEarnings,
        totalPayouts: revenueData.totalPayouts,
        netRevenue: revenueData.netRevenue,
      });
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAnalytics();
  }, [loadAnalytics]);

  const chartData = useMemo(
    () => series.map((point) => ({ ...point, label: point.day, amount: Number(point.amount.toFixed(2)) })),
    [series],
  );

  const pendingOrders = analytics?.orders?.pending ?? 0;
  const completedOrders = analytics?.orders?.completed ?? 0;
  const paidOrders = analytics?.orders?.paid ?? 0;
  const failedOrders = analytics?.orders?.failed ?? 0;
  const totalOrders = analytics?.orders?.total ?? 1;
  const completionRate = totalOrders > 0 ? Math.round((completedOrders / totalOrders) * 100) : 0;
  const newVendors = analytics?.growth?.newVendorsThisWeek ?? 0;
  const newBuyers = analytics?.growth?.newUsersThisWeek ?? 0;
  const newOrders = analytics?.growth?.newOrdersThisWeek ?? 0;

  const topVendors = analytics?.topVendors?.slice(0, 5) ?? [];

  return (
    <ProtectedRoute>
      <AdminLayout>
        {loading ? (
          <LoadingPanel label="Loading marketplace analytics..." />
        ) : error ? (
          <ErrorPanel message={error} onRetry={() => void loadAnalytics()} />
        ) : (
          <div className="space-y-8">
            <PageHeader
              title="Marketplace analytics"
              subtitle="Real-time performance metrics for your marketplace"
              actions={
                <div className="flex items-center gap-3">
                  <Button variant="ghost" disabled><Icon name="calendar" /> Last 30 days</Button>
                  <select
                    value={selectedCurrency}
                    onChange={(event) => setSelectedCurrency(event.target.value as (typeof SUPPORTED_CURRENCIES)[number])}
                    className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 outline-none"
                  >
                    {SUPPORTED_CURRENCIES.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                  <Button variant="secondary" onClick={() => downloadCsv("eki-analytics.csv", [
                    { metric: "total_revenue", value: analytics?.revenue?.total ?? 0 },
                    { metric: "total_orders", value: totalOrders },
                    { metric: "completed_orders", value: completedOrders },
                    { metric: "completion_rate_pct", value: completionRate },
                    { metric: "avg_order_value", value: analytics?.avgOrderValue ?? 0 },
                    ...topVendors.map((v) => ({ metric: `vendor_${v.name}`, value: v.orders })),
                    ...chartData.map((point) => ({ metric: `revenue_${point.label}`, value: point.amount })),
                  ])}><Icon name="export" /> Export report</Button>
                </div>
              }
            />

            {/* ─── Revenue Overview ────────────────────────────────────── */}
            <div>
              <h2 className="mb-4 text-2xl font-black text-[#101820]">Revenue Overview</h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <MetricCard label="Today" value={analytics ? formatDisplayMoney(analytics.revenue.today, selectedCurrency) : "—"} />
                <MetricCard label="This Week" value={analytics ? formatDisplayMoney(analytics.revenue.thisWeek, selectedCurrency) : "—"} />
                <MetricCard label="This Month" value={analytics ? formatDisplayMoney(analytics.revenue.thisMonth, selectedCurrency) : "—"} />
                <MetricCard label="All Time" value={analytics ? formatDisplayMoney(analytics.revenue.total, selectedCurrency) : "—"} />
              </div>
            </div>

            {/* ─── Revenue Chart ────────────────────────────────────────── */}
            {revenueMeta && (
              <Card className="overflow-hidden bg-[#101820] p-0 text-white">
                <div className="grid gap-8 p-8 lg:grid-cols-[0.34fr_0.66fr]">
                  <div>
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10">
                      <Icon name="analytics" className="h-8 w-8" />
                    </div>
                    <p className="mt-8 text-xl text-white/75">Revenue snapshot</p>
                    <p className="mt-6 text-5xl font-light tracking-tight">
                      {formatDisplayMoney(revenueMeta.grossRevenue, selectedCurrency)}
                    </p>
                    <div className="mt-6 space-y-2 text-sm text-white/60">
                      <p>Platform fees: <span className="font-bold text-white">{formatDisplayMoney(revenueMeta.platformFees, selectedCurrency)}</span></p>
                      <p>Vendor earnings: <span className="font-bold text-white">{formatDisplayMoney(revenueMeta.vendorEarnings, selectedCurrency)}</span></p>
                      <p>Payouts sent: <span className="font-bold text-white">{formatDisplayMoney(revenueMeta.totalPayouts, selectedCurrency)}</span></p>
                      <p className="pt-2 text-base">Net revenue: <span className="font-bold text-emerald-400">{formatDisplayMoney(revenueMeta.netRevenue, selectedCurrency)}</span></p>
                    </div>
                  </div>
                  <div className="h-[340px] min-w-0">
                    {chartData.length ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData}>
                          <defs>
                            <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#8ee5b4" stopOpacity={0.75} />
                              <stop offset="95%" stopColor="#8ee5b4" stopOpacity={0.05} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid stroke="rgba(255,255,255,.12)" strokeDasharray="4 4" />
                          <XAxis dataKey="label" stroke="rgba(255,255,255,.65)" tickLine={false} axisLine={false} />
                          <YAxis stroke="rgba(255,255,255,.55)" tickLine={false} axisLine={false} />
                          <Tooltip contentStyle={{ borderRadius: 12, border: "0", color: "#101820" }} />
                          <Area type="monotone" dataKey="amount" stroke="#8ee5b4" strokeWidth={4} fill="url(#revGradient)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex h-full items-center justify-center text-white/60">No revenue data yet</div>
                    )}
                  </div>
                </div>
              </Card>
            )}

            {/* ─── Orders Pipeline ───────────────────────────────────────── */}
            <div>
              <h2 className="mb-4 text-2xl font-black text-[#101820]">Orders Pipeline</h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <MetricCard label="Pending" value={String(pendingOrders)} note="Awaiting payment" />
                <MetricCard label="Paid" value={String(paidOrders)} note="In progress" />
                <MetricCard label="Completed" value={String(completedOrders)} note={`${completionRate}% completion rate`} />
                <MetricCard label="Failed" value={String(failedOrders)} note={failedOrders > 0 ? "Requires attention" : "None"} />
              </div>
            </div>

            {/* ─── Growth & Top Vendors ──────────────────────────────────── */}
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <h2 className="text-2xl font-black">Growth (This Week)</h2>
                <div className="mt-6 space-y-5">
                  <div className="flex items-center justify-between rounded-xl bg-emerald-50 p-5">
                    <div><p className="text-lg font-bold">New orders</p><p className="text-sm text-slate-500">Orders placed this week</p></div>
                    <p className="text-3xl font-black text-emerald-700">{newOrders}</p>
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-blue-50 p-5">
                    <div><p className="text-lg font-bold">New vendors</p><p className="text-sm text-slate-500">Vendors joined this week</p></div>
                    <p className="text-3xl font-black text-blue-700">{newVendors}</p>
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-purple-50 p-5">
                    <div><p className="text-lg font-bold">New buyers</p><p className="text-sm text-slate-500">Buyers registered this week</p></div>
                    <p className="text-3xl font-black text-purple-700">{newBuyers}</p>
                  </div>
                </div>
              </Card>

              <Card>
                <h2 className="text-2xl font-black">Top Vendors</h2>
                <div className="mt-6 space-y-4">
                  {topVendors.length === 0 ? (
                    <p className="py-8 text-center text-slate-400">No vendor data yet</p>
                  ) : (
                    topVendors.map((v, i) => (
                      <div key={v.id} className="flex items-center gap-4 rounded-xl bg-slate-50 p-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-sm font-black text-emerald-700">
                          {i + 1}
                        </div>
                        <div className="flex-1">
                          <p className="font-bold">{v.name}</p>
                          <p className="text-sm text-slate-500">{v.orders} orders · {formatDisplayMoney(v.revenue, selectedCurrency)}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </Card>
            </div>

            {/* ─── Average metrics ────────────────────────────────────────── */}
            <div className="grid gap-6 lg:grid-cols-3">
              <Card className="flex items-center gap-5">
                <MetricBubble icon="analytics" />
                <div>
                  <p className="text-sm text-slate-600">Avg order value</p>
                  <p className="mt-1 text-2xl font-black">{formatDisplayMoney(analytics?.avgOrderValue ?? 0, selectedCurrency)}</p>
                </div>
              </Card>
              <Card className="flex items-center gap-5">
                <MetricBubble icon="disputes" />
                <div>
                  <p className="text-sm text-slate-600">Dispute rate</p>
                  <p className="mt-1 text-2xl font-black">{(analytics?.disputeRate ?? 0).toFixed(1)}%</p>
                  <p className="text-xs text-slate-400">{failedOrders} failed of {totalOrders} orders</p>
                </div>
              </Card>
              <Card className="flex items-center gap-5">
                <MetricBubble icon="vendors" />
                <div>
                  <p className="text-sm text-slate-600">Order completion</p>
                  <p className="mt-1 text-2xl font-black">{completionRate}%</p>
                  <p className="text-xs text-slate-400">{completedOrders} of {totalOrders} completed</p>
                </div>
              </Card>
            </div>

          </div>
        )}
      </AdminLayout>
    </ProtectedRoute>
  );
}

function MetricBubble({ icon }: { icon: string }) {
  return <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-[#096B4A]"><Icon name={icon} className="h-8 w-8" /></div>;
}

function MetricCard({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <Card>
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-black">{value}</p>
      {note ? <p className="mt-1 text-xs text-slate-400">{note}</p> : null}
    </Card>
  );
}
