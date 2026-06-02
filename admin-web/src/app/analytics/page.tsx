"use client";

import { useCallback, useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import { adminAPI } from "@/lib/services/admin.api";
import { Analytics, RevenueSeries } from "@/types";
import { APIError } from "@/lib/api";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [revenueSeries, setRevenueSeries] = useState<RevenueSeries[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [range, setRange] = useState<"7d" | "30d" | "90d">("30d");

  const loadAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const [analyticsData, series] = await Promise.all([
        adminAPI.getAnalytics(),
        adminAPI.getRevenueSeries(range),
      ]);
      setAnalytics(analyticsData);
      setRevenueSeries(series);
    } catch (err) {
      if (err instanceof APIError) {
        setError(err.message);
      } else {
        setError("Failed to load analytics");
      }
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    void loadAnalytics();
  }, [loadAnalytics]);

  if (loading) {
    return (
      <ProtectedRoute>
        <AdminLayout>
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          </div>
        </AdminLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <AdminLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Analytics</h1>
            <p className="mt-1 text-sm text-gray-600">Platform performance metrics</p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
              <button onClick={loadAnalytics} className="ml-4 underline">Retry</button>
            </div>
          )}

          {analytics && (
            <>
              {/* Key Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <MetricCard
                  title="Total Revenue"
                  value={`${analytics.revenue.currency} ${analytics.revenue.total.toFixed(2)}`}
                  subtitle="All time"
                  color="green"
                />
                <MetricCard
                  title="Total Orders"
                  value={analytics.orders.total}
                  subtitle="All time"
                  color="blue"
                />
                <MetricCard
                  title="Avg Order Value"
                  value={`${analytics.revenue.currency} ${analytics.avgOrderValue.toFixed(2)}`}
                  subtitle="Per order"
                  color="purple"
                />
                <MetricCard
                  title="Dispute Rate"
                  value={`${analytics.disputeRate.toFixed(1)}%`}
                  subtitle="Of total orders"
                  color="red"
                />
              </div>

              {/* Revenue Chart */}
              <div className="bg-white p-6 rounded-lg shadow">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">Revenue Trend</h2>
                  <select
                    value={range}
                    onChange={(e) => setRange(e.target.value as "7d" | "30d" | "90d")}
                    className="px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900"
                  >
                    <option value="7d">Last 7 days</option>
                    <option value="30d">Last 30 days</option>
                    <option value="90d">Last 90 days</option>
                  </select>
                </div>
                {revenueSeries.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={revenueSeries}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="day" />
                      <YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey="amount" stroke="#10b981" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-center py-12 text-gray-500">No revenue data available</div>
                )}
              </div>

              {/* Top Vendors */}
              {analytics.topVendors.length > 0 && (
                <div className="bg-white p-6 rounded-lg shadow">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Top Vendors</h2>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead>
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vendor</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Revenue</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Orders</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {analytics.topVendors.map((vendor) => (
                          <tr key={vendor.id}>
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">{vendor.name}</td>
                            <td className="px-4 py-3 text-sm text-gray-900">
                              {analytics.revenue.currency} {vendor.revenue.toFixed(2)}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">{vendor.orders}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </AdminLayout>
    </ProtectedRoute>
  );
}

function MetricCard({
  title,
  value,
  subtitle,
  color,
}: {
  title: string;
  value: string | number;
  subtitle: string;
  color: string;
}) {
  const colorClasses = {
    green: "bg-green-50 text-green-600",
    blue: "bg-blue-50 text-blue-600",
    purple: "bg-purple-50 text-purple-600",
    red: "bg-red-50 text-red-600",
  }[color];

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <p className="text-sm font-medium text-gray-600">{title}</p>
      <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
      <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
    </div>
  );
}
