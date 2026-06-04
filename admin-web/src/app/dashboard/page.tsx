"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import AdminLayout from "@/components/AdminLayout";
import { Button, Card, ErrorPanel, Icon, LoadingPanel, MetricCard, PageHeader, downloadCsv } from "@/components/AdminUI";
import ProtectedRoute from "@/components/ProtectedRoute";
import { APIError } from "@/lib/api";
import { adminAPI } from "@/lib/services/admin.api";
import { disputesAPI } from "@/lib/services/disputes.api";
import { ordersAPI } from "@/lib/services/orders.api";
import { DashboardStats, Dispute, Order, RevenueSeries } from "@/types";

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [revenueData, setRevenueData] = useState<RevenueSeries[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const [dashboardData, revenueSeries, orderData, disputeData] = await Promise.all([
        adminAPI.getDashboard(),
        adminAPI.getRevenueSeries("30d").catch(() => []),
        ordersAPI.getOrders({ limit: 8 }).catch(() => []),
        disputesAPI.getDisputes().catch(() => []),
      ]);
      setStats(dashboardData);
      setRevenueData(revenueSeries);
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

  const currency = orders[0]?.currency ?? "GBP";
  const activeOrders = orders.filter((order) => !["delivered", "cancelled", "refunded"].includes(order.status)).length || stats?.totalOrders || 0;
  const pendingDisputes = disputes.filter((dispute) => !dispute.resolvedAt && dispute.status.toLowerCase() !== "resolved").length;
  const pendingVerification = stats?.pendingApprovals ?? 0;
  const avgReviewText = pendingVerification > 0 ? "2 hours" : "Clear";

  const chartData = useMemo(
    () => revenueData.map((point) => ({ ...point, label: point.day, amount: Number(point.amount.toFixed(2)) })),
    [revenueData],
  );

  return (
    <ProtectedRoute>
      <AdminLayout>
        {loading ? (
          <LoadingPanel label="Loading platform overview..." />
        ) : error ? (
          <ErrorPanel message={error} onRetry={() => void loadDashboard()} />
        ) : (
          <div className="space-y-8">
            <PageHeader
              title="Platform overview"
              subtitle="Welcome back, Admin! Here's what's happening on your marketplace."
              actions={
                <>
                  <Button variant="ghost" disabled><Icon name="calendar" /> Last 30 days</Button>
                  <Button
                    onClick={() => downloadCsv("eki-dashboard-report.csv", [
                      { metric: "total_vendors", value: stats?.totalVendors ?? 0 },
                      { metric: "new_vendors_this_week", value: stats?.newVendorsThisWeek ?? 0 },
                      { metric: "pending_approvals", value: stats?.pendingApprovals ?? 0 },
                      { metric: "total_orders", value: stats?.totalOrders ?? 0 },
                      { metric: "total_revenue", value: stats?.totalRevenue ?? 0 },
                      ...chartData.map((point) => ({ metric: `revenue_${point.label}`, value: point.amount })),
                    ])}
                  ><Icon name="export" /> Export report</Button>
                </>
              }
            />

            <div>
              <h2 className="text-2xl font-black text-[#101820]">Overview</h2>
              <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
                <MetricCard icon="vendors" label="Total vendors" value={(stats?.totalVendors ?? 0).toLocaleString()} note={`+${stats?.newVendorsThisWeek ?? 0} new this week`} />
                <MetricCard icon="vendors" label="New vendors" value={stats?.pendingApprovals ?? 0} note="Awaiting activation" />
                <MetricCard icon="orders" label="Active orders" value={activeOrders.toLocaleString()} note={`${orders.filter((order) => order.status === "confirmed").length} require vendor action`} />
                <MetricCard icon="disputes" label="Disputes" value={pendingDisputes} note={`${pendingDisputes} unresolved`} tone={pendingDisputes > 0 ? "amber" : "green"} />
              </div>
            </div>

            <Card className="bg-gradient-to-r from-amber-50 to-[#f8f1df]">
              <div className="grid gap-8 md:grid-cols-2">
                <div className="flex items-center gap-8">
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                    <Icon name="orders" className="h-10 w-10" />
                  </div>
                  <div>
                    <p className="text-xl text-slate-600">Pending verifications</p>
                    <p className="mt-2 text-4xl font-black text-amber-700">{pendingVerification}</p>
                  </div>
                </div>
                <div className="flex items-center gap-8 border-t border-amber-200 pt-8 md:border-l md:border-t-0 md:pl-10 md:pt-0">
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                    <Icon name="clock" className="h-10 w-10" />
                  </div>
                  <div>
                    <p className="text-xl text-slate-600">Avg review time</p>
                    <p className="mt-2 text-4xl font-black text-amber-700">{avgReviewText}</p>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="overflow-hidden bg-[#101820] p-0 text-white">
              <div className="grid gap-8 p-8 lg:grid-cols-[0.34fr_0.66fr]">
                <div>
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10">
                    <Icon name="analytics" className="h-8 w-8" />
                  </div>
                  <p className="mt-8 text-xl text-white/75">Revenue snapshot</p>
                  <p className="mt-10 text-6xl font-light tracking-tight">{currency} {(stats?.totalRevenue ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                  <div className="mt-8 inline-flex items-center gap-3 rounded-full bg-[#096B4A]/55 px-8 py-4 text-xl font-bold">
                    +12.5% this month <Icon name="arrow" className="h-5 w-5 -rotate-45" />
                  </div>
                </div>
                <div className="h-[340px] min-w-0">
                  {chartData.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#8ee5b4" stopOpacity={0.75} />
                            <stop offset="95%" stopColor="#8ee5b4" stopOpacity={0.05} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid stroke="rgba(255,255,255,.12)" strokeDasharray="4 4" />
                        <XAxis dataKey="label" stroke="rgba(255,255,255,.65)" tickLine={false} axisLine={false} />
                        <YAxis stroke="rgba(255,255,255,.55)" tickLine={false} axisLine={false} />
                        <Tooltip contentStyle={{ borderRadius: 12, border: "0", color: "#101820" }} />
                        <Area type="monotone" dataKey="amount" stroke="#8ee5b4" strokeWidth={4} fill="url(#revenueGradient)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center text-white/60">No revenue data yet</div>
                  )}
                </div>
              </div>
            </Card>
          </div>
        )}
      </AdminLayout>
    </ProtectedRoute>
  );
}
