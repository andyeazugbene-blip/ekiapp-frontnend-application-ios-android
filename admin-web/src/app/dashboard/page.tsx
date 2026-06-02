"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import AdminLayout from "@/components/AdminLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import { APIError } from "@/lib/api";
import { adminAPI } from "@/lib/services/admin.api";
import { ordersAPI } from "@/lib/services/orders.api";
import { vendorsAPI } from "@/lib/services/vendors.api";
import { DashboardStats, Order, Vendor } from "@/types";

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [revenueData, setRevenueData] = useState<{ day: string; amount: number }[]>([]);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [recentVendors, setRecentVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const [dashboardData, revenueSeries, orders, vendors] = await Promise.all([
        adminAPI.getDashboard(),
        adminAPI.getRevenueSeries("30d").catch(() => []),
        ordersAPI.getOrders({ limit: 5 }).catch(() => []),
        vendorsAPI.getVendors({ limit: 5 }).catch(() => []),
      ]);

      setStats(dashboardData);
      setRevenueData(revenueSeries);
      setRecentOrders(orders.slice(0, 5));
      setRecentVendors(vendors.slice(0, 5));
    } catch (err) {
      if (err instanceof APIError) {
        setError(err.message);
      } else {
        setError("Failed to load dashboard data");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const revenueCurrency = useMemo(() => recentOrders[0]?.currency ?? "GBP", [recentOrders]);

  if (loading) {
    return (
      <ProtectedRoute>
        <AdminLayout>
          <div className="flex h-64 items-center justify-center">
            <div className="text-center">
              <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-emerald-700"></div>
              <p className="mt-4 text-slate-600">Loading dashboard...</p>
            </div>
          </div>
        </AdminLayout>
      </ProtectedRoute>
    );
  }

  if (error) {
    return (
      <ProtectedRoute>
        <AdminLayout>
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
            {error}
            <button onClick={() => void loadDashboard()} className="ml-4 underline">
              Retry
            </button>
          </div>
        </AdminLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <AdminLayout>
        <div className="space-y-8">
          <section className="rounded-[28px] border border-emerald-100 bg-gradient-to-br from-[#0f3d32] via-[#114738] to-[#153c30] px-6 py-7 text-white shadow-[0_24px_60px_rgba(8,38,30,0.24)]">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-100/80">Eki control</p>
                <h1 className="mt-3 text-3xl font-bold tracking-tight">Marketplace operations at a glance</h1>
                <p className="mt-3 text-sm leading-6 text-emerald-50/78">
                  Fast checks for approvals, revenue, orders, and vendor activity. This dashboard is tuned for quick scanning,
                  not hunting through clutter.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 text-left lg:min-w-[320px]">
                <HeroMetric label="Active vendors" value={stats?.activeVendors ?? 0} />
                <HeroMetric label="Pending reviews" value={stats?.pendingApprovals ?? 0} />
                <HeroMetric label="Orders" value={stats?.totalOrders ?? 0} />
                <HeroMetric
                  label="Revenue"
                  value={`${revenueCurrency} ${(stats?.totalRevenue ?? 0).toFixed(2)}`}
                />
              </div>
            </div>
          </section>

          <div>
            <h2 className="text-2xl font-bold text-slate-900">Overview</h2>
            <p className="mt-1 text-sm text-slate-500">Live operational summary from the admin backend.</p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard title="Total Vendors" value={stats?.totalVendors ?? 0} subtitle={`${stats?.activeVendors ?? 0} active`} accent="emerald" />
            <StatCard title="Pending Approvals" value={stats?.pendingApprovals ?? 0} subtitle="Vendors awaiting review" accent="amber" />
            <StatCard title="Total Orders" value={stats?.totalOrders ?? 0} subtitle="All time" accent="blue" />
            <StatCard title="Total Revenue" value={`${revenueCurrency} ${(stats?.totalRevenue ?? 0).toFixed(2)}`} subtitle="All time" accent="violet" />
          </div>

          {revenueData.length > 0 ? (
            <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Revenue trend</h2>
                  <p className="mt-1 text-sm text-slate-500">Last 30 days, live from the admin API.</p>
                </div>
                <div className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                  Updated now
                </div>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="day" stroke="#94a3b8" tickLine={false} axisLine={false} />
                  <YAxis stroke="#94a3b8" tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="amount" stroke="#0f766e" strokeWidth={3} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            {recentOrders.length > 0 ? (
              <DataTableCard title="Recent orders" note="Newest 5">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead>
                    <tr>
                      <TableHead>Order #</TableHead>
                      <TableHead>Vendor</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {recentOrders.map((order) => (
                      <tr key={order.id} className="hover:bg-slate-50/80">
                        <TableCell strong>{order.orderNumber}</TableCell>
                        <TableCell>{order.vendorName || "N/A"}</TableCell>
                        <TableCell>{order.currency} {order.totalAmount.toFixed(2)}</TableCell>
                        <TableCell><StatusBadge status={order.status} /></TableCell>
                        <TableCell muted>{new Date(order.createdAt).toLocaleDateString()}</TableCell>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </DataTableCard>
            ) : null}

            {recentVendors.length > 0 ? (
              <DataTableCard title="Recent vendors" note="Newest 5">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead>
                    <tr>
                      <TableHead>Store Name</TableHead>
                      <TableHead>Owner</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Joined</TableHead>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {recentVendors.map((vendor) => (
                      <tr key={vendor.id} className="hover:bg-slate-50/80">
                        <TableCell strong>{vendor.storeName}</TableCell>
                        <TableCell>{vendor.ownerName}</TableCell>
                        <TableCell muted>{vendor.city}, {vendor.country}</TableCell>
                        <TableCell><VendorStatusBadge status={vendor.adminStatus} /></TableCell>
                        <TableCell muted>{new Date(vendor.joinedAt).toLocaleDateString()}</TableCell>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </DataTableCard>
            ) : null}
          </div>
        </div>
      </AdminLayout>
    </ProtectedRoute>
  );
}

function HeroMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 backdrop-blur-sm">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-emerald-50/60">{label}</p>
      <p className="mt-2 text-lg font-bold text-white">{value}</p>
    </div>
  );
}

function StatCard({
  title,
  value,
  subtitle,
  accent,
}: {
  title: string;
  value: string | number;
  subtitle: string;
  accent: "emerald" | "amber" | "blue" | "violet";
}) {
  const accentClasses = {
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-100",
    amber: "bg-amber-50 text-amber-700 border-amber-100",
    blue: "bg-sky-50 text-sky-700 border-sky-100",
    violet: "bg-violet-50 text-violet-700 border-violet-100",
  }[accent];

  return (
    <div className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        </div>
        <div className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl border ${accentClasses}`}>
          <div className="h-2.5 w-2.5 rounded-full bg-current" />
        </div>
      </div>
    </div>
  );
}

function DataTableCard({
  title,
  note,
  children,
}: {
  title: string;
  note: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <span className="text-xs font-medium text-slate-500">{note}</span>
      </div>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

function TableHead({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
      {children}
    </th>
  );
}

function TableCell({
  children,
  strong = false,
  muted = false,
}: {
  children: React.ReactNode;
  strong?: boolean;
  muted?: boolean;
}) {
  return (
    <td className={`px-4 py-3 text-sm ${strong ? "font-semibold text-slate-900" : muted ? "text-slate-500" : "text-slate-700"}`}>
      {children}
    </td>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors = {
    pending: "bg-yellow-100 text-yellow-800",
    confirmed: "bg-blue-100 text-blue-800",
    shipped: "bg-purple-100 text-purple-800",
    delivered: "bg-green-100 text-green-800",
    cancelled: "bg-red-100 text-red-800",
    refunded: "bg-gray-100 text-gray-800",
  }[status] || "bg-gray-100 text-gray-800";

  return <span className={`rounded-full px-2 py-1 text-xs font-medium ${colors}`}>{status}</span>;
}

function VendorStatusBadge({ status }: { status: string }) {
  const colors = {
    active: "bg-green-100 text-green-800",
    pending: "bg-yellow-100 text-yellow-800",
    suspended: "bg-red-100 text-red-800",
  }[status] || "bg-gray-100 text-gray-800";

  return <span className={`rounded-full px-2 py-1 text-xs font-medium ${colors}`}>{status}</span>;
}
