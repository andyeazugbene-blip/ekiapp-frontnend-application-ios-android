"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import AdminLayout from "@/components/AdminLayout";
import {
  Button,
  Card,
  ErrorPanel,
  Icon,
  LoadingPanel,
  PageHeader,
  downloadCsv,
} from "@/components/AdminUI";
import ProtectedRoute from "@/components/ProtectedRoute";
import { APIError } from "@/lib/api";
import { adminAPI } from "@/lib/services/admin.api";
import {
  SUPPORTED_CURRENCIES,
  formatDisplayMoney,
  useAdminDisplayCurrency,
} from "@/lib/displayCurrency";
import type {
  AnalyticsOverview,
  BuyerAnalytics,
  GeographicAnalytics,
  GrowthSeries,
  OrderAnalytics,
  PaymentAnalytics,
  VendorAnalyticsData,
} from "@/types";

type RangeKey = "7d" | "30d" | "90d";
type OrderTimeView = "day" | "week" | "month";

const PIE_COLORS = ["#096B4A", "#2563eb", "#7c3aed", "#d97706", "#dc2626", "#0891b2", "#4f46e5", "#be185d", "#15803d", "#9333ea"];

export default function AnalyticsPage() {
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [growth, setGrowth] = useState<GrowthSeries | null>(null);
  const [buyerData, setBuyerData] = useState<BuyerAnalytics | null>(null);
  const [vendorData, setVendorData] = useState<VendorAnalyticsData | null>(null);
  const [orderData, setOrderData] = useState<OrderAnalytics | null>(null);
  const [paymentData, setPaymentData] = useState<PaymentAnalytics | null>(null);
  const [geoData, setGeoData] = useState<GeographicAnalytics | null>(null);
  const [range, setRange] = useState<RangeKey>("30d");
  const [orderTimeView, setOrderTimeView] = useState<OrderTimeView>("day");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { selectedCurrency, setSelectedCurrency } = useAdminDisplayCurrency(
    overview?.currency ?? "GBP",
  );

  const loadData = useCallback(async (r: RangeKey) => {
    try {
      setLoading(true);
      setError("");
      const [ov, gr, ba, va, oa, pa, geo] = await Promise.all([
        adminAPI.getAnalyticsOverview(),
        adminAPI.getAnalyticsGrowth(r),
        adminAPI.getBuyerAnalytics(r),
        adminAPI.getVendorAnalytics(r),
        adminAPI.getOrderAnalytics(r),
        adminAPI.getPaymentAnalytics(r),
        adminAPI.getGeographicAnalytics(r),
      ]);
      setOverview(ov);
      setGrowth(gr);
      setBuyerData(ba);
      setVendorData(va);
      setOrderData(oa);
      setPaymentData(pa);
      setGeoData(geo);
    } catch (err) {
      setError(
        err instanceof APIError ? err.message : "Failed to load analytics",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData(range);
  }, [loadData, range]);

  const fmt = useCallback(
    (v: number) => formatDisplayMoney(v, selectedCurrency),
    [selectedCurrency],
  );

  const fmtLabel = (date: string) =>
    date
      ? new Date(date).toLocaleDateString("en-GB", {
          month: "short",
          day: "numeric",
        })
      : "";

  // Phase 1 chart data
  const gmvChartData = useMemo(
    () => (growth?.gmv ?? []).map((p) => ({ label: fmtLabel(p.date), value: p.value })),
    [growth],
  );
  const revChartData = useMemo(
    () => (growth?.revenue ?? []).map((p) => ({ label: fmtLabel(p.date), value: p.value })),
    [growth],
  );
  const orderChartData = useMemo(
    () => (growth?.orders ?? []).map((p) => ({ label: fmtLabel(p.date), value: p.value })),
    [growth],
  );
  const buyerChartData = useMemo(
    () => (growth?.buyers ?? []).map((p) => ({ label: fmtLabel(p.date), value: p.value })),
    [growth],
  );
  const vendorChartData = useMemo(
    () => (growth?.vendors ?? []).map((p) => ({ label: fmtLabel(p.date), value: p.value })),
    [growth],
  );

  // Phase 2 order time series
  const orderTimeSeries = useMemo(() => {
    if (!orderData) return [];
    if (orderTimeView === "day") {
      return orderData.ordersByDay.map((d) => ({ label: fmtLabel(d.date), count: d.count, gmv: d.gmv }));
    }
    if (orderTimeView === "week") {
      return orderData.ordersByWeek.map((w) => ({ label: `W ${fmtLabel(w.week)}`, count: w.count, gmv: w.gmv }));
    }
    return orderData.ordersByMonth.map((m) => ({ label: m.month, count: m.count, gmv: m.gmv }));
  }, [orderData, orderTimeView]);

  const exportRows = overview
    ? [
        { metric: "GMV", value: overview.gmv },
        { metric: "Eki Revenue", value: overview.ekiRevenue },
        { metric: "Avg Order Value", value: overview.avgOrderValue },
        { metric: "Subscription Revenue (MRR)", value: overview.subscriptionRevenue },
        { metric: "Total Orders", value: overview.totalOrders },
        { metric: "Escrow Balance", value: overview.escrowBalance },
        { metric: "Pending Payouts", value: overview.pendingPayouts },
        { metric: "Open Disputes", value: overview.openDisputes },
        { metric: "Pending Verifications", value: overview.pendingVerifications },
        { metric: "Total Buyers", value: overview.totalBuyers },
        { metric: "Active Buyers (30d)", value: overview.activeBuyers30d },
        { metric: "Total Vendors", value: overview.totalVendors },
        { metric: "Active Vendors (30d)", value: overview.activeVendors30d },
        { metric: "New Buyers", value: overview.newBuyers },
        { metric: "New Vendors", value: overview.newVendors },
        { metric: "Buyer Retention Rate %", value: overview.buyerRetentionRate },
        { metric: "Vendor Retention Rate %", value: overview.vendorRetentionRate },
      ]
    : [];

  return (
    <ProtectedRoute>
      <AdminLayout>
        {loading ? (
          <LoadingPanel label="Loading analytics dashboard..." />
        ) : error ? (
          <ErrorPanel message={error} onRetry={() => void loadData(range)} />
        ) : (
          <div className="space-y-8">
            <PageHeader
              title="Analytics Dashboard"
              subtitle="Overview KPIs, Growth Trends, Buyer/Vendor/Order/Payment/Geographic Analytics"
              actions={
                <div className="flex items-center gap-3">
                  <RangeSelector range={range} onChange={setRange} />
                  <select
                    value={selectedCurrency}
                    onChange={(e) =>
                      setSelectedCurrency(
                        e.target.value as (typeof SUPPORTED_CURRENCIES)[number],
                      )
                    }
                    className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 outline-none"
                  >
                    {SUPPORTED_CURRENCIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <Button
                    variant="secondary"
                    onClick={() => downloadCsv("eki-analytics-overview.csv", exportRows)}
                  >
                    <Icon name="export" /> Export
                  </Button>
                </div>
              }
            />

            {/* ════════════════════════════════════════════════════════════════
                PHASE 1 — Overview KPIs
            ════════════════════════════════════════════════════════════════ */}

            {/* Revenue & Financial */}
            <div>
              <h2 className="mb-4 text-lg font-black text-[#101820]">Revenue & Financial</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <KpiCard label="Total GMV" value={fmt(overview?.gmv ?? 0)} icon="analytics" tone="emerald" />
                <KpiCard label="Eki Revenue" value={fmt(overview?.ekiRevenue ?? 0)} icon="analytics" tone="emerald" note="Platform fees + subscription MRR" />
                <KpiCard label="Avg Order Value" value={fmt(overview?.avgOrderValue ?? 0)} icon="orders" tone="blue" />
                <KpiCard label="Subscription MRR" value={fmt(overview?.subscriptionRevenue ?? 0)} icon="analytics" tone="purple" note="Active plan revenue/month" />
              </div>
            </div>

            {/* Orders & Operations */}
            <div>
              <h2 className="mb-4 text-lg font-black text-[#101820]">Orders & Operations</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                <KpiCard label="Total Orders" value={String(overview?.totalOrders ?? 0)} icon="orders" tone="slate" />
                <KpiCard label="Escrow Balance" value={fmt(overview?.escrowBalance ?? 0)} icon="money" tone="amber" note="Held, not yet released" />
                <KpiCard label="Pending Payouts" value={fmt(overview?.pendingPayouts ?? 0)} icon="money" tone="amber" />
                <KpiCard label="Open Disputes" value={String(overview?.openDisputes ?? 0)} icon="disputes" tone={overview?.openDisputes ? "red" : "slate"} />
                <KpiCard label="Pending Verifications" value={String(overview?.pendingVerifications ?? 0)} icon="verification" tone={overview?.pendingVerifications ? "amber" : "slate"} />
              </div>
            </div>

            {/* Users */}
            <div>
              <h2 className="mb-4 text-lg font-black text-[#101820]">Users</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <KpiCard label="Total Buyers" value={String(overview?.totalBuyers ?? 0)} icon="user" tone="blue" />
                <KpiCard label="Active Buyers (30d)" value={String(overview?.activeBuyers30d ?? 0)} icon="user" tone="emerald" note="Placed paid order in last 30 days" />
                <KpiCard label="Total Vendors" value={String(overview?.totalVendors ?? 0)} icon="vendors" tone="purple" />
                <KpiCard label="Active Vendors (30d)" value={String(overview?.activeVendors30d ?? 0)} icon="vendors" tone="emerald" note="Had paid order in last 30 days" />
              </div>
            </div>

            {/* Growth & Retention */}
            <div>
              <h2 className="mb-4 text-lg font-black text-[#101820]">Growth & Retention</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <KpiCard label="New Buyers (30d)" value={String(overview?.newBuyers ?? 0)} icon="user" tone="blue" />
                <KpiCard label="New Vendors (30d)" value={String(overview?.newVendors ?? 0)} icon="vendors" tone="purple" />
                <KpiCard label="Buyer Retention" value={`${(overview?.buyerRetentionRate ?? 0).toFixed(1)}%`} icon="analytics" tone="emerald" note="Buyers with >1 paid order" />
                <KpiCard label="Vendor Retention" value={`${(overview?.vendorRetentionRate ?? 0).toFixed(1)}%`} icon="analytics" tone="emerald" note="Vendors active in consecutive 30d windows" />
              </div>
            </div>

            {/* ════════════════════════════════════════════════════════════════
                PHASE 1 — Growth Trends
            ════════════════════════════════════════════════════════════════ */}
            <div>
              <h2 className="mb-4 text-2xl font-black text-[#101820]">Growth Trends</h2>
              <div className="grid gap-6 lg:grid-cols-2">
                <TrendChart title="GMV Trend" data={gmvChartData} color="#096B4A" gradientId="gmvGrad" isMoney currency={selectedCurrency} />
                <TrendChart title="Revenue Trend (Platform Fees)" data={revChartData} color="#7c3aed" gradientId="revGrad2" isMoney currency={selectedCurrency} />
              </div>
              <div className="mt-6 grid gap-6 lg:grid-cols-3">
                <CountChart title="Orders" data={orderChartData} color="#096B4A" />
                <CountChart title="New Buyers" data={buyerChartData} color="#2563eb" />
                <CountChart title="New Vendors" data={vendorChartData} color="#7c3aed" />
              </div>
            </div>

            {/* ════════════════════════════════════════════════════════════════
                PHASE 2A — Buyer Analytics
            ════════════════════════════════════════════════════════════════ */}
            {buyerData && (
              <div>
                <h2 className="mb-4 text-2xl font-black text-[#101820]">Buyer Analytics</h2>

                {/* KPIs row */}
                <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <KpiCard label="New Buyers (range)" value={String(buyerData.newBuyers)} icon="user" tone="blue" note="First-time buyers in range" />
                  <KpiCard label="Returning Buyers" value={String(buyerData.returningBuyers)} icon="user" tone="emerald" note="Had orders before + during range" />
                  <KpiCard label="Repeat Purchase Rate" value={`${buyerData.repeatPurchaseRate.toFixed(1)}%`} icon="analytics" tone="emerald" note="All-time: buyers with >1 order" />
                  <KpiCard label="Avg Orders / Buyer" value={buyerData.avgOrdersPerBuyer.toFixed(2)} icon="orders" tone="blue" note="In selected range" />
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                  {/* New vs Returning pie */}
                  <Card>
                    <h3 className="mb-4 text-lg font-bold text-slate-800">New vs Returning Buyers</h3>
                    {buyerData.newBuyers + buyerData.returningBuyers > 0 ? (
                      <div className="flex items-center gap-6">
                        <div className="h-[200px] w-[200px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={[
                                  { name: "New", value: buyerData.newBuyers },
                                  { name: "Returning", value: buyerData.returningBuyers },
                                ]}
                                cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                                dataKey="value" strokeWidth={0}
                              >
                                <Cell fill="#2563eb" />
                                <Cell fill="#096B4A" />
                              </Pie>
                              <Tooltip />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <span className="inline-block h-3 w-3 rounded-full bg-blue-600" />
                            <span className="text-sm text-slate-600">New: <strong>{buyerData.newBuyers}</strong></span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="inline-block h-3 w-3 rounded-full bg-[#096B4A]" />
                            <span className="text-sm text-slate-600">Returning: <strong>{buyerData.returningBuyers}</strong></span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="py-8 text-center text-slate-400">No buyer data in range</p>
                    )}
                  </Card>

                  {/* Buyer Locations */}
                  <Card>
                    <h3 className="mb-4 text-lg font-bold text-slate-800">Buyer Locations</h3>
                    {buyerData.buyerLocations.length > 0 ? (
                      <div className="space-y-2 max-h-[240px] overflow-y-auto">
                        {buyerData.buyerLocations.map((loc) => (
                          <div key={loc.country} className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
                            <span className="font-medium text-slate-700">{loc.country}</span>
                            <span className="text-sm font-bold text-blue-700">{loc.count}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="py-8 text-center text-slate-400">No location data available</p>
                    )}
                  </Card>
                </div>

                {/* Top Buyers table */}
                <Card className="mt-6">
                  <h3 className="mb-4 text-lg font-bold text-slate-800">Top Buyers by Spend</h3>
                  {buyerData.topBuyers.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-100 text-left text-slate-500">
                            <th className="pb-3 font-medium">#</th>
                            <th className="pb-3 font-medium">Name</th>
                            <th className="pb-3 font-medium text-right">Orders</th>
                            <th className="pb-3 font-medium text-right">Total Spend</th>
                            <th className="pb-3 font-medium text-right">Last Order</th>
                          </tr>
                        </thead>
                        <tbody>
                          {buyerData.topBuyers.map((b, i) => (
                            <tr key={b.buyerId} className="border-b border-slate-50">
                              <td className="py-3 font-bold text-slate-400">{i + 1}</td>
                              <td className="py-3 font-medium">{b.name}</td>
                              <td className="py-3 text-right">{b.totalOrders}</td>
                              <td className="py-3 text-right font-bold text-emerald-700">{fmt(b.totalSpend)}</td>
                              <td className="py-3 text-right text-slate-400">
                                {b.lastOrderDate ? new Date(b.lastOrderDate).toLocaleDateString("en-GB") : "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="py-8 text-center text-slate-400">No buyer orders in range</p>
                  )}
                </Card>
              </div>
            )}

            {/* ════════════════════════════════════════════════════════════════
                PHASE 2B — Vendor Analytics
            ════════════════════════════════════════════════════════════════ */}
            {vendorData && (
              <div>
                <h2 className="mb-4 text-2xl font-black text-[#101820]">Vendor Analytics</h2>

                <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <KpiCard label="Vendors With No Orders" value={String(vendorData.vendorsWithNoOrders)} icon="vendors" tone={vendorData.vendorsWithNoOrders > 0 ? "amber" : "slate"} note={`of ${vendorData.totalVendors} total`} />
                  <KpiCard label="Vendor Retention" value={`${vendorData.vendorRetentionRate.toFixed(1)}%`} icon="analytics" tone="emerald" note="Active in consecutive periods" />
                  <KpiCard label="Total Vendors" value={String(vendorData.totalVendors)} icon="vendors" tone="purple" />
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                  {/* Top Vendors by Revenue */}
                  <Card>
                    <h3 className="mb-4 text-lg font-bold text-slate-800">Top Vendors by Revenue</h3>
                    {vendorData.topVendorsByRevenue.length > 0 ? (
                      <div className="space-y-3">
                        {vendorData.topVendorsByRevenue.map((v, i) => (
                          <div key={v.vendorId} className="flex items-center gap-3 rounded-xl bg-slate-50 p-4">
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-sm font-black text-emerald-700">{i + 1}</div>
                            <div className="flex-1 min-w-0">
                              <p className="truncate font-bold">{v.storeName}</p>
                              <p className="text-xs text-slate-500">{v.totalOrders} orders</p>
                            </div>
                            <p className="font-bold text-emerald-700">{fmt(v.totalRevenue)}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="py-8 text-center text-slate-400">No vendor revenue data</p>
                    )}
                  </Card>

                  {/* Top Vendors by Orders */}
                  <Card>
                    <h3 className="mb-4 text-lg font-bold text-slate-800">Top Vendors by Orders</h3>
                    {vendorData.topVendorsByOrders.length > 0 ? (
                      <div className="space-y-3">
                        {vendorData.topVendorsByOrders.map((v, i) => (
                          <div key={v.vendorId} className="flex items-center gap-3 rounded-xl bg-slate-50 p-4">
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-sm font-black text-blue-700">{i + 1}</div>
                            <div className="flex-1 min-w-0">
                              <p className="truncate font-bold">{v.storeName}</p>
                              <p className="text-xs text-slate-500">{fmt(v.totalRevenue)} revenue</p>
                            </div>
                            <p className="text-lg font-black text-blue-700">{v.totalOrders}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="py-8 text-center text-slate-400">No vendor order data</p>
                    )}
                  </Card>
                </div>

                {/* Vendor Locations */}
                {vendorData.vendorLocations.length > 0 && (
                  <Card className="mt-6">
                    <h3 className="mb-4 text-lg font-bold text-slate-800">Vendor Locations</h3>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {vendorData.vendorLocations.map((loc, i) => (
                        <div key={i} className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
                          <span className="font-medium text-slate-700">
                            {loc.country}{loc.city ? `, ${loc.city}` : ""}
                          </span>
                          <span className="text-sm font-bold text-purple-700">{loc.count}</span>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}
              </div>
            )}

            {/* ════════════════════════════════════════════════════════════════
                PHASE 2C — Order Analytics
            ════════════════════════════════════════════════════════════════ */}
            {orderData && (
              <div>
                <h2 className="mb-4 text-2xl font-black text-[#101820]">Order Analytics</h2>

                <div className="mb-6">
                  <KpiCard label="Avg Order Value (range)" value={fmt(orderData.avgOrderValue)} icon="orders" tone="emerald" />
                </div>

                {/* Orders by Day/Week/Month chart */}
                <Card className="mb-6">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-lg font-bold text-slate-800">Orders Over Time</h3>
                    <div className="flex rounded-lg border border-slate-200 bg-white p-0.5">
                      {(["day", "week", "month"] as OrderTimeView[]).map((v) => (
                        <button
                          key={v}
                          onClick={() => setOrderTimeView(v)}
                          className={`rounded-md px-3 py-1.5 text-xs font-bold transition-colors ${
                            orderTimeView === v ? "bg-[#096B4A] text-white" : "text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          {v === "day" ? "Daily" : v === "week" ? "Weekly" : "Monthly"}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="h-[260px]">
                    {orderTimeSeries.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={orderTimeSeries}>
                          <CartesianGrid stroke="rgba(0,0,0,.06)" strokeDasharray="4 4" vertical={false} />
                          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#94a3b8" }} />
                          <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#94a3b8" }} allowDecimals={false} />
                          <Tooltip contentStyle={{ borderRadius: 10, border: "0", fontSize: 13 }} />
                          <Bar dataKey="count" fill="#096B4A" radius={[4, 4, 0, 0]} name="Orders" />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex h-full items-center justify-center text-slate-300">No order data in range</div>
                    )}
                  </div>
                </Card>

                <div className="grid gap-6 lg:grid-cols-2">
                  {/* Most Purchased Products */}
                  <Card>
                    <h3 className="mb-4 text-lg font-bold text-slate-800">Most Purchased Products</h3>
                    {orderData.topProducts.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-slate-100 text-left text-slate-500">
                              <th className="pb-3 font-medium">#</th>
                              <th className="pb-3 font-medium">Product</th>
                              <th className="pb-3 font-medium text-right">Qty Sold</th>
                              <th className="pb-3 font-medium text-right">Revenue</th>
                            </tr>
                          </thead>
                          <tbody>
                            {orderData.topProducts.map((p, i) => (
                              <tr key={p.productId} className="border-b border-slate-50">
                                <td className="py-2.5 font-bold text-slate-400">{i + 1}</td>
                                <td className="py-2.5 font-medium max-w-[200px] truncate">{p.title}</td>
                                <td className="py-2.5 text-right">{p.totalQuantity}</td>
                                <td className="py-2.5 text-right font-bold text-emerald-700">{fmt(p.totalRevenue)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="py-8 text-center text-slate-400">No product data in range</p>
                    )}
                  </Card>

                  {/* Top Product Categories */}
                  <Card>
                    <h3 className="mb-4 text-lg font-bold text-slate-800">Top Product Categories</h3>
                    {orderData.topCategories.length > 0 ? (
                      <div className="flex items-start gap-6">
                        <div className="h-[200px] w-[200px] shrink-0">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={orderData.topCategories.map((c) => ({ name: c.category, value: c.totalRevenue }))}
                                cx="50%" cy="50%" outerRadius={80}
                                dataKey="value" strokeWidth={0}
                              >
                                {orderData.topCategories.map((_, i) => (
                                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip formatter={(value: number) => fmt(value)} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="flex-1 space-y-2 max-h-[200px] overflow-y-auto">
                          {orderData.topCategories.map((c, i) => (
                            <div key={c.category} className="flex items-center gap-2 text-sm">
                              <span className="inline-block h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                              <span className="flex-1 truncate text-slate-700">{c.category}</span>
                              <span className="font-bold">{fmt(c.totalRevenue)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="py-8 text-center text-slate-400">No category data in range</p>
                    )}
                  </Card>
                </div>
              </div>
            )}

            {/* ════════════════════════════════════════════════════════════════
                PHASE 3A — Payment Analytics
            ════════════════════════════════════════════════════════════════ */}
            {paymentData && (
              <div>
                <h2 className="mb-4 text-2xl font-black text-[#101820]">Payment Analytics</h2>

                <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
                  <KpiCard
                    label="Successful Payments"
                    value={`${paymentData.successfulPayments.count}`}
                    icon="check"
                    tone="emerald"
                    note={fmt(paymentData.successfulPayments.amount)}
                  />
                  <KpiCard
                    label="Failed Payments"
                    value={`${paymentData.failedPayments.count}`}
                    icon="clock"
                    tone={paymentData.failedPayments.count > 0 ? "red" : "slate"}
                    note={fmt(paymentData.failedPayments.amount)}
                  />
                  <KpiCard
                    label="Refunds"
                    value={`${paymentData.refunds.count}`}
                    icon="money"
                    tone={paymentData.refunds.count > 0 ? "amber" : "slate"}
                    note={fmt(paymentData.refunds.amount)}
                  />
                  <KpiCard
                    label="Payouts Completed"
                    value={`${paymentData.payouts.totalPaid.count}`}
                    icon="money"
                    tone="emerald"
                    note={fmt(paymentData.payouts.totalPaid.amount)}
                  />
                  <KpiCard
                    label="Payouts Pending"
                    value={`${paymentData.payouts.totalPending.count}`}
                    icon="clock"
                    tone={paymentData.payouts.totalPending.count > 0 ? "amber" : "slate"}
                    note={fmt(paymentData.payouts.totalPending.amount)}
                  />
                </div>

                {/* Escrow breakdown */}
                <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <KpiCard
                    label="Escrow Credits"
                    value={`${paymentData.escrow.pendingCredits.count}`}
                    icon="money"
                    tone="blue"
                    note={`${fmt(paymentData.escrow.pendingCredits.amount)} pending`}
                  />
                  <KpiCard
                    label="Escrow Releases"
                    value={`${paymentData.escrow.releases.count}`}
                    icon="check"
                    tone="emerald"
                    note={`${fmt(paymentData.escrow.releases.amount)} released`}
                  />
                  <KpiCard
                    label="Payout Debits"
                    value={`${paymentData.escrow.payoutDebits.count}`}
                    icon="money"
                    tone="purple"
                    note={fmt(paymentData.escrow.payoutDebits.amount)}
                  />
                  <KpiCard
                    label="Adjustments"
                    value={`${paymentData.escrow.adjustments.count}`}
                    icon="settings"
                    tone="slate"
                    note={`Net: ${fmt(paymentData.escrow.adjustments.amount)}`}
                  />
                </div>

                {/* Recent Payouts table */}
                {paymentData.payouts.recentPayouts.length > 0 && (
                  <Card>
                    <h3 className="mb-4 text-lg font-bold text-slate-800">Recent Payouts</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-100 text-left text-slate-500">
                            <th className="pb-3 font-medium">Vendor</th>
                            <th className="pb-3 font-medium text-right">Amount</th>
                            <th className="pb-3 font-medium text-right">Net</th>
                            <th className="pb-3 font-medium text-right">Paid At</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paymentData.payouts.recentPayouts.map((p) => (
                            <tr key={p.id} className="border-b border-slate-50">
                              <td className="py-3 font-medium">{p.storeName}</td>
                              <td className="py-3 text-right">{fmt(p.amount)}</td>
                              <td className="py-3 text-right font-bold text-emerald-700">{fmt(p.netAmount)}</td>
                              <td className="py-3 text-right text-slate-400">
                                {p.paidAt ? new Date(p.paidAt).toLocaleDateString("en-GB") : "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                )}
              </div>
            )}

            {/* ════════════════════════════════════════════════════════════════
                PHASE 3B — Geographic Analytics
            ════════════════════════════════════════════════════════════════ */}
            {geoData && (
              <div>
                <h2 className="mb-4 text-2xl font-black text-[#101820]">Geographic Analytics</h2>

                <div className="grid gap-6 lg:grid-cols-2">
                  {/* Orders by Country */}
                  <Card>
                    <h3 className="mb-4 text-lg font-bold text-slate-800">Orders by Country</h3>
                    {geoData.ordersByCountry.length > 0 ? (
                      <div className="space-y-2 max-h-[320px] overflow-y-auto">
                        {geoData.ordersByCountry.map((c, i) => (
                          <div key={c.country} className="flex items-center gap-3 rounded-lg bg-slate-50 px-4 py-3">
                            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-xs font-black text-emerald-700">{i + 1}</span>
                            <span className="flex-1 font-medium text-slate-700">{c.country}</span>
                            <span className="text-sm text-slate-500">{c.count} orders</span>
                            <span className="font-bold text-emerald-700">{fmt(c.gmv)}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="py-8 text-center text-slate-400">No geographic data — buyers may not have saved addresses</p>
                    )}
                  </Card>

                  {/* Orders by City */}
                  <Card>
                    <h3 className="mb-4 text-lg font-bold text-slate-800">Orders by City</h3>
                    {geoData.ordersByCity.length > 0 ? (
                      <div className="space-y-2 max-h-[320px] overflow-y-auto">
                        {geoData.ordersByCity.map((c, i) => (
                          <div key={`${c.city}-${c.country}`} className="flex items-center gap-3 rounded-lg bg-slate-50 px-4 py-3">
                            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-xs font-black text-blue-700">{i + 1}</span>
                            <div className="flex-1 min-w-0">
                              <p className="truncate font-medium text-slate-700">{c.city}</p>
                              <p className="text-xs text-slate-400">{c.country}</p>
                            </div>
                            <span className="text-sm text-slate-500">{c.count} orders</span>
                            <span className="font-bold text-blue-700">{fmt(c.gmv)}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="py-8 text-center text-slate-400">No city-level data available</p>
                    )}
                  </Card>
                </div>

                <div className="mt-6 grid gap-6 lg:grid-cols-2">
                  {/* Buyer Locations */}
                  <Card>
                    <h3 className="mb-4 text-lg font-bold text-slate-800">Buyer Locations</h3>
                    <p className="mb-3 text-xs text-slate-400">Source: default delivery addresses</p>
                    {geoData.buyerLocations.length > 0 ? (
                      <div className="space-y-2 max-h-[280px] overflow-y-auto">
                        {geoData.buyerLocations.map((loc, i) => (
                          <div key={i} className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
                            <span className="font-medium text-slate-700">
                              {loc.country}{loc.city ? `, ${loc.city}` : ""}
                            </span>
                            <span className="text-sm font-bold text-blue-700">{loc.count} buyers</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="py-8 text-center text-slate-400">No buyer address data</p>
                    )}
                  </Card>

                  {/* Vendor Locations */}
                  <Card>
                    <h3 className="mb-4 text-lg font-bold text-slate-800">Vendor Locations</h3>
                    <p className="mb-3 text-xs text-slate-400">Source: vendor profile country/city</p>
                    {geoData.vendorLocations.length > 0 ? (
                      <div className="space-y-2 max-h-[280px] overflow-y-auto">
                        {geoData.vendorLocations.map((loc, i) => (
                          <div key={i} className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
                            <span className="font-medium text-slate-700">
                              {loc.country}{loc.city ? `, ${loc.city}` : ""}
                            </span>
                            <span className="text-sm font-bold text-purple-700">{loc.count} vendors</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="py-8 text-center text-slate-400">No vendor location data</p>
                    )}
                  </Card>
                </div>
              </div>
            )}
          </div>
        )}
      </AdminLayout>
    </ProtectedRoute>
  );
}

/* ── Shared Components ─────────────────────────────────────────────────────── */

function RangeSelector({ range, onChange }: { range: RangeKey; onChange: (r: RangeKey) => void }) {
  return (
    <div className="flex rounded-xl border border-slate-200 bg-white p-1">
      {(["7d", "30d", "90d"] as RangeKey[]).map((r) => (
        <button
          key={r}
          onClick={() => onChange(r)}
          className={`rounded-lg px-4 py-2 text-sm font-bold transition-colors ${
            range === r ? "bg-[#096B4A] text-white" : "text-slate-600 hover:bg-slate-50"
          }`}
        >
          {r === "7d" ? "7 Days" : r === "30d" ? "30 Days" : "90 Days"}
        </button>
      ))}
    </div>
  );
}

const TONE_CLASSES: Record<string, { bg: string; text: string; icon: string }> = {
  emerald: { bg: "bg-emerald-50", text: "text-emerald-700", icon: "text-emerald-600" },
  blue: { bg: "bg-blue-50", text: "text-blue-700", icon: "text-blue-600" },
  purple: { bg: "bg-purple-50", text: "text-purple-700", icon: "text-purple-600" },
  amber: { bg: "bg-amber-50", text: "text-amber-700", icon: "text-amber-600" },
  red: { bg: "bg-red-50", text: "text-red-700", icon: "text-red-600" },
  slate: { bg: "bg-slate-50", text: "text-slate-700", icon: "text-slate-500" },
};

function KpiCard({ label, value, icon, tone = "slate", note }: {
  label: string; value: string; icon: string; tone?: string; note?: string;
}) {
  const t = TONE_CLASSES[tone] ?? TONE_CLASSES.slate;
  return (
    <Card className="flex items-start gap-4">
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${t.bg} ${t.icon}`}>
        <Icon name={icon} className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-sm text-slate-500">{label}</p>
        <p className={`mt-1 text-2xl font-black tracking-tight ${t.text}`}>{value}</p>
        {note ? <p className="mt-0.5 text-xs text-slate-400">{note}</p> : null}
      </div>
    </Card>
  );
}

function TrendChart({ title, data, color, gradientId, isMoney, currency }: {
  title: string; data: { label: string; value: number }[]; color: string;
  gradientId: string; isMoney?: boolean; currency?: string;
}) {
  return (
    <Card className="overflow-hidden bg-[#101820] p-0 text-white">
      <div className="p-6 pb-2">
        <p className="text-sm text-white/60">{title}</p>
        <p className="mt-1 text-3xl font-black tracking-tight">
          {isMoney && currency
            ? formatDisplayMoney(data.reduce((s, d) => s + d.value, 0), currency)
            : data.reduce((s, d) => s + d.value, 0).toLocaleString()}
        </p>
      </div>
      <div className="h-[220px] px-2 pb-4">
        {data.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.6} />
                  <stop offset="95%" stopColor={color} stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(255,255,255,.08)" strokeDasharray="4 4" />
              <XAxis dataKey="label" stroke="rgba(255,255,255,.45)" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
              <YAxis stroke="rgba(255,255,255,.35)" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ borderRadius: 12, border: "0", color: "#101820", fontSize: 13 }} />
              <Area type="monotone" dataKey="value" stroke={color} strokeWidth={3} fill={`url(#${gradientId})`} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-white/40">No data yet</div>
        )}
      </div>
    </Card>
  );
}

function CountChart({ title, data, color }: {
  title: string; data: { label: string; value: number }[]; color: string;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <Card>
      <div className="mb-2 flex items-baseline justify-between">
        <p className="text-sm font-bold text-slate-700">{title}</p>
        <p className="text-2xl font-black" style={{ color }}>{total.toLocaleString()}</p>
      </div>
      <div className="h-[180px]">
        {data.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid stroke="rgba(0,0,0,.06)" strokeDasharray="4 4" vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "#94a3b8" }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "#94a3b8" }} allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: 10, border: "0", fontSize: 13 }} />
              <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-slate-300">No data yet</div>
        )}
      </div>
    </Card>
  );
}
