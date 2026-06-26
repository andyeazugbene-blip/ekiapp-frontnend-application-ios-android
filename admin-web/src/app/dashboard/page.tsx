"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import AdminLayout from "@/components/AdminLayout";
import { Button, Card, ErrorPanel, Icon, LoadingPanel, MetricCard, PageHeader, downloadCsv } from "@/components/AdminUI";
import ProtectedRoute from "@/components/ProtectedRoute";
import { APIError } from "@/lib/api";
import { SUPPORTED_CURRENCIES, formatDisplayMoney, useAdminDisplayCurrency } from "@/lib/displayCurrency";
import { adminAPI } from "@/lib/services/admin.api";
import { disputesAPI } from "@/lib/services/disputes.api";
import { ordersAPI } from "@/lib/services/orders.api";
import { AnalyticsOverview, DashboardStats, Dispute, Order, RevenueSeries } from "@/types";

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [revenueData, setRevenueData] = useState<RevenueSeries[]>([]);
  const [revenueMeta, setRevenueMeta] = useState<{grossRevenue:number;platformFees:number;vendorEarnings:number;totalPayouts:number;netRevenue:number} | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const rev:any = await adminAPI.getRevenueSeries("30d").catch(() => ({ series: [], grossRevenue:0, platformFees:0, vendorEarnings:0, totalPayouts:0, netRevenue:0 }));
      const [dashboardData, overviewData, orderData, disputeData] = await Promise.all([
        adminAPI.getDashboard(),
        adminAPI.getAnalyticsOverview().catch(() => null),
        ordersAPI.getOrders({ limit: 8 }).catch(() => []),
        disputesAPI.getDisputes().catch(() => []),
      ]);
      setStats(dashboardData);
      setOverview(overviewData);
      setRevenueData(rev.series ?? []);
      setRevenueMeta(rev);
      setOrders(orderData);
      setDisputes(disputeData);
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const { selectedCurrency, setSelectedCurrency } = useAdminDisplayCurrency("EUR");
  const cur = overview?.currency ?? "GBP";

  const chartData = useMemo(
    () => revenueData.map((p) => ({ ...p, label: p.day, amount: Number(p.amount.toFixed(2)) })),
    [revenueData],
  );

  const fmtMoney = (v: number) => formatDisplayMoney(v, cur, selectedCurrency);
  const fmtNum = (v: number) => v.toLocaleString();
  const fmtPct = (v: number) => `${v.toFixed(1)}%`;

  return (
    <ProtectedRoute>
      <AdminLayout>
        {loading ? <LoadingPanel label="Loading platform overview..." /> : error ? <ErrorPanel message={error} onRetry={() => void loadDashboard()} /> : (
          <div className="space-y-8">
            <PageHeader
              title="Platform overview"
              subtitle="Real-time marketplace data from backend"
              actions={
                <div className="flex items-center gap-3">
                  <Button variant="secondary" disabled><Icon name="calendar" /> Last 30 days</Button>
                  <select value={selectedCurrency} onChange={(e) => setSelectedCurrency(e.target.value as any)} className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 outline-none">
                    {SUPPORTED_CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <Button variant="secondary" onClick={() => downloadCsv("eki-dashboard.csv", [
                    { metric:"gmv", value: overview?.gmv ?? 0 },
                    { metric:"eki_revenue", value: overview?.ekiRevenue ?? 0 },
                    { metric:"total_orders", value: overview?.totalOrders ?? 0 },
                    { metric:"avg_order_value", value: overview?.avgOrderValue ?? 0 },
                    { metric:"total_buyers", value: overview?.totalBuyers ?? 0 },
                    { metric:"total_vendors", value: overview?.totalVendors ?? 0 },
                    { metric:"gross_revenue", value: revenueMeta?.grossRevenue ?? 0 },
                    { metric:"net_revenue", value: revenueMeta?.netRevenue ?? 0 },
                    ...chartData.map((p) => ({ metric: `revenue_${p.label}`, value: p.amount })),
                  ])}><Icon name="export" /> Export</Button>
                </div>
              }
            />

            {/* Revenue & Financial KPIs */}
            <div>
              <h2 className="mb-4 text-2xl font-black">Revenue & Financial</h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
                <MetricCard label="Total Transaction Value (GMV)" value={overview ? fmtMoney(overview.gmv) : "—"} icon="cash" />
                <MetricCard label="Eki Revenue" value={overview ? fmtMoney(overview.ekiRevenue) : "—"} icon="trending" />
                <MetricCard label="Subscription Revenue" value={overview ? fmtMoney(overview.subscriptionRevenue) : "—"} icon="wallet" />
                <MetricCard label="Escrow Balance" value={overview ? fmtMoney(overview.escrowBalance) : "—"} icon="disputes" />
                <MetricCard label="Pending Payouts" value={overview ? fmtMoney(overview.pendingPayouts) : "—"} icon="sent" />
              </div>
            </div>

            {/* Orders & Operations */}
            <div>
              <h2 className="mb-4 text-2xl font-black">Orders & Operations</h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <MetricCard label="Total Orders" value={fmtNum(overview?.totalOrders ?? 0)} icon="orders" />
                <MetricCard label="Average Order Value" value={overview ? fmtMoney(overview.avgOrderValue) : "—"} icon="cash" />
                <MetricCard label="Open Disputes" value={overview?.openDisputes ?? 0} icon="disputes" tone={(overview?.openDisputes ?? 0) > 0 ? "amber" : "green"} />
                <MetricCard label="Pending Verifications" value={overview?.pendingVerifications ?? 0} icon="verification" tone={(overview?.pendingVerifications ?? 0) > 0 ? "amber" : "green"} />
              </div>
            </div>

            {/* Users */}
            <div>
              <h2 className="mb-4 text-2xl font-black">Users</h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <MetricCard label="Total Buyers" value={fmtNum(overview?.totalBuyers ?? 0)} icon="messages" />
                <MetricCard label="Total Vendors" value={fmtNum(overview?.totalVendors ?? 0)} icon="vendors" />
                <MetricCard label="New Buyers" value={fmtNum(overview?.newBuyers ?? 0)} icon="messages" />
                <MetricCard label="New Vendors" value={fmtNum(overview?.newVendors ?? 0)} icon="vendors" />
              </div>
            </div>

            {/* Growth & Retention */}
            <div>
              <h2 className="mb-4 text-2xl font-black">Growth & Retention</h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <MetricCard label="Active Buyers (30 Days)" value={fmtNum(overview?.activeBuyers30d ?? 0)} icon="messages" />
                <MetricCard label="Active Vendors (30 Days)" value={fmtNum(overview?.activeVendors30d ?? 0)} icon="vendors" />
                <MetricCard label="Buyer Retention Rate" value={fmtPct(overview?.buyerRetentionRate ?? 0)} icon="analytics" />
                <MetricCard label="Vendor Retention Rate" value={fmtPct(overview?.vendorRetentionRate ?? 0)} icon="analytics" />
              </div>
            </div>

            {/* Revenue 30-day breakdown */}
            <div>
              <h2 className="mb-4 text-2xl font-black">Revenue Breakdown (30 days)</h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
                <MetricCard label="Gross Revenue" value={revenueMeta ? formatDisplayMoney(revenueMeta.grossRevenue, "EUR", selectedCurrency) : "—"} icon="cash" />
                <MetricCard label="Platform Fees" value={revenueMeta ? formatDisplayMoney(revenueMeta.platformFees, "EUR", selectedCurrency) : "—"} icon="trending" />
                <MetricCard label="Vendor Earnings" value={revenueMeta ? formatDisplayMoney(revenueMeta.vendorEarnings, "EUR", selectedCurrency) : "—"} icon="wallet" />
                <MetricCard label="Payouts Sent" value={revenueMeta ? formatDisplayMoney(revenueMeta.totalPayouts, "EUR", selectedCurrency) : "—"} icon="sent" />
                <MetricCard label="Net Revenue" value={revenueMeta ? formatDisplayMoney(revenueMeta.netRevenue, "EUR", selectedCurrency) : "—"} icon="profit" />
              </div>
            </div>

            <Card className="overflow-hidden bg-[#101820] p-0 text-white">
              <div className="grid gap-8 p-8 lg:grid-cols-[0.34fr_0.66fr]">
                <div>
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10">
                    <Icon name="analytics" className="h-8 w-8" />
                  </div>
                  <p className="mt-8 text-xl text-white/75">Revenue 30d</p>
                  <p className="mt-6 text-5xl font-light tracking-tight">
                    {formatDisplayMoney(revenueMeta?.grossRevenue ?? 0, "EUR", selectedCurrency)}
                  </p>
                  <div className="mt-6 space-y-2 text-sm text-white/60">
                    <p>Platform fees: <span className="font-bold text-white">{formatDisplayMoney(revenueMeta?.platformFees ?? 0, "EUR", selectedCurrency)}</span></p>
                    <p>Payouts sent: <span className="font-bold text-white">{formatDisplayMoney(revenueMeta?.totalPayouts ?? 0, "EUR", selectedCurrency)}</span></p>
                    <p className="pt-2 text-base">Net: <span className="font-bold text-emerald-400">{formatDisplayMoney(revenueMeta?.netRevenue ?? 0, "EUR", selectedCurrency)}</span></p>
                  </div>
                </div>
                <div className="h-[340px] min-w-0">
                  {chartData.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <defs><linearGradient id="rg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#8ee5b4" stopOpacity={0.75}/><stop offset="95%" stopColor="#8ee5b4" stopOpacity={0.05}/></linearGradient></defs>
                        <CartesianGrid stroke="rgba(255,255,255,.12)" strokeDasharray="4 4" />
                        <XAxis dataKey="label" stroke="rgba(255,255,255,.65)" tickLine={false} axisLine={false} />
                        <YAxis stroke="rgba(255,255,255,.55)" tickLine={false} axisLine={false} />
                        <Tooltip contentStyle={{ borderRadius:12, border:"0", color:"#101820" }} />
                        <Area type="monotone" dataKey="amount" stroke="#8ee5b4" strokeWidth={4} fill="url(#rg)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : <div className="flex h-full items-center justify-center text-white/60">No revenue data</div>}
                </div>
              </div>
            </Card>
          </div>
        )}
      </AdminLayout>
    </ProtectedRoute>
  );
}
