"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Area, AreaChart, Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import AdminLayout from "@/components/AdminLayout";
import { Button, Card, ErrorPanel, Icon, LoadingPanel, PageHeader, downloadCsv } from "@/components/AdminUI";
import ProtectedRoute from "@/components/ProtectedRoute";
import { APIError } from "@/lib/api";
import { adminAPI } from "@/lib/services/admin.api";
import { vendorsAPI } from "@/lib/services/vendors.api";
import { Analytics, RevenueSeries, Vendor } from "@/types";

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [series, setSeries] = useState<RevenueSeries[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const [analyticsData, revenueSeries, vendorData] = await Promise.all([
        adminAPI.getAnalytics(),
        adminAPI.getRevenueSeries("30d"),
        vendorsAPI.getVendors({ limit: 100 }).catch(() => []),
      ]);
      setAnalytics(analyticsData);
      setSeries(revenueSeries.series);
      setVendors(vendorData);
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAnalytics();
  }, [loadAnalytics]);

  const activeCount = vendors.filter((vendor) => vendor.adminStatus === "active").length;
  const activationRate = vendors.length ? Math.round((activeCount / vendors.length) * 1000) / 10 : 0;
  const topCategories = analytics?.topVendors.slice(0, 4).map((vendor) => ({
    name: vendor.name || "Vendor",
    value: vendor.orders,
  })) ?? [];
  const countries = useMemo(() => {
    const total = Math.max(vendors.length, 1);
    const counts = vendors.reduce<Record<string, number>>((acc, vendor) => {
      const country = vendor.country || "Unknown";
      acc[country] = (acc[country] ?? 0) + 1;
      return acc;
    }, {});
    return Object.entries(counts).slice(0, 5).map(([country, count]) => ({ country, percent: Math.round((count / total) * 100) }));
  }, [vendors]);

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
              actions={
                <>
                  <Button variant="ghost" disabled><Icon name="calendar" /> Last 30 days</Button>
                  <Button variant="secondary" onClick={() => downloadCsv("eki-analytics.csv", [
                    { metric: "activation_rate", value: activationRate },
                    { metric: "active_vendors", value: activeCount },
                    { metric: "total_vendors", value: vendors.length },
                    ...(analytics?.topVendors ?? []).map((vendor) => ({ metric: `vendor_${vendor.name}`, value: vendor.orders })),
                    ...series.map((point) => ({ metric: `revenue_${point.day}`, value: point.amount })),
                  ])}><Icon name="export" /> Export report</Button>
                </>
              }
            />

            <Card className="overflow-hidden bg-[#102820] text-white">
              <div className="relative min-h-[235px]">
                <div className="absolute inset-0 opacity-20">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={series}>
                      <Area type="monotone" dataKey="amount" stroke="#9be7bd" fill="#9be7bd" fillOpacity={0.25} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="relative z-10">
                  <p className="text-2xl">Activation rate</p>
                  <p className="mt-8 text-6xl font-black">{activationRate}%</p>
                  <div className="mt-8 max-w-3xl">
                    <div className="h-4 overflow-hidden rounded-full bg-white/15">
                      <div className="h-full rounded-full bg-white" style={{ width: `${Math.min(activationRate, 100)}%` }} />
                    </div>
                    <div className="mt-3 flex justify-between text-lg text-white/75"><span>0%</span><span>50%</span><span>100%</span></div>
                  </div>
                  <p className="absolute bottom-8 right-8 text-2xl font-bold text-emerald-100">↘ 5.2%</p>
                </div>
              </div>
            </Card>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="flex items-center gap-7">
                <MetricBubble icon="analytics" />
                <div>
                  <p className="text-xl text-slate-600">Vendor activation rate</p>
                  <p className="mt-3 text-4xl font-black">{activationRate}%</p>
                </div>
                <p className="ml-auto text-xl font-bold text-[#096B4A]">↗ 5.2%</p>
              </Card>
              <Card className="flex items-center gap-7">
                <MetricBubble icon="clock" />
                <div>
                  <p className="text-xl text-slate-600">Average time to first sale</p>
                  <p className="mt-3 text-4xl font-black">4.2 days</p>
                </div>
                <p className="ml-auto text-xl font-bold text-[#096B4A]">Faster than 5.1 days</p>
              </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <h2 className="text-2xl font-black">Top vendors</h2>
                <div className="mt-8 grid grid-cols-2 gap-5 md:grid-cols-5">
                  {topCategories.map((item, index) => (
                    <div key={`${item.name}-${index}`} className="rounded-2xl bg-slate-50 p-5 text-center">
                      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-lg font-black text-[#096B4A]">
                        {item.name.slice(0, 2).toUpperCase()}
                      </div>
                      <p className="mt-5 line-clamp-2 font-bold">{item.name}</p>
                      <p className="text-sm text-slate-500">{item.value} orders</p>
                    </div>
                  ))}
                  <div className="rounded-2xl bg-slate-50 p-5 text-center">
                    <Icon name="overview" className="mx-auto mt-5 h-10 w-10 text-[#096B4A]" />
                    <p className="mt-7 font-bold">View all</p>
                  </div>
                </div>
              </Card>

              <Card>
                <h2 className="text-2xl font-black">Sales by country</h2>
                <div className="mt-8 space-y-7">
                  {countries.map((row) => (
                    <div key={row.country}>
                      <div className="mb-3 flex justify-between text-lg"><span>{row.country}</span><span className="font-bold text-[#096B4A]">{row.percent}%</span></div>
                      <div className="h-3 overflow-hidden rounded-full bg-emerald-50"><div className="h-full rounded-full bg-[#096B4A]" style={{ width: `${row.percent}%` }} /></div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            <Card className="flex items-center gap-7">
              <MetricBubble icon="vendors" />
              <div>
                <p className="text-xl text-slate-600">Repeat buyer rate</p>
                <p className="mt-3 text-4xl font-black">54%</p>
              </div>
              <p className="ml-auto text-xl font-bold text-[#096B4A]">↗ 7% returning buyers</p>
            </Card>
          </div>
        )}
      </AdminLayout>
    </ProtectedRoute>
  );
}

function MetricBubble({ icon }: { icon: string }) {
  return <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-[#096B4A]"><Icon name={icon} className="h-10 w-10" /></div>;
}
