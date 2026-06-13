import { apiClient } from "../api";
import { DashboardStats, Analytics, RevenueSeries } from "@/types";

function centsToUnit(value: unknown): number {
  return typeof value === "number" ? value / 100 : 0;
}

export const adminAPI = {
  async getDashboard(): Promise<DashboardStats> {
    const raw = await apiClient.get<any>("/admin/dashboard");
    return {
      totalVendors: raw.totalVendors ?? 0,
      pendingApprovals: raw.pendingApprovals ?? 0,
      activeVendors: raw.activeVendors ?? 0,
      suspendedVendors: raw.suspendedVendors ?? 0,
      totalOrders: raw.totalOrders ?? 0,
      totalRevenue: centsToUnit(raw.totalRevenue),
      newVendorsThisWeek: raw.newVendorsThisWeek ?? 0,
      totalUsers: raw.totalUsers ?? 0,
      totalBuyers: raw.totalBuyers ?? 0,
    };
  },

  async getAnalytics(): Promise<Analytics> {
    const raw = await apiClient.get<any>("/admin/analytics");
    const failed = raw.orders?.failed ?? 0;
    const total = raw.orders?.total ?? 0;
    return {
      revenue: {
        total: centsToUnit(raw.revenue?.allTime),
        change: 0,
        currency: (raw.revenue?.currency ?? "GBP").toUpperCase(),
      },
      orders: { total, change: 0 },
      vendors: { active: 0, new: raw.growth?.newVendorsThisWeek ?? 0 },
      buyers: { active: 0, new: raw.growth?.newUsersThisWeek ?? 0 },
      avgOrderValue: total > 0 ? centsToUnit(raw.revenue?.allTime) / total : 0,
      disputeRate: total > 0 ? (failed / total) * 100 : 0,
      topVendors: (raw.topVendors ?? []).map((v: any) => ({
        id: v.vendorId,
        name: v.storeName ?? "",
        revenue: centsToUnit(v.totalRevenue),
        orders: v.totalOrders ?? 0,
      })),
    };
  },

  async getRevenueSeries(range: "7d" | "30d" | "90d" = "30d"): Promise<{ series: RevenueSeries[]; grossRevenue: number; platformFees: number; vendorEarnings: number; totalPayouts: number; netRevenue: number }> {
    const res = await apiClient.get<any>(`/admin/analytics/revenue?range=${range}`);
    return {
      series: (res.series ?? []).map((point: any) => ({
        day: point.date ? new Date(point.date).toLocaleDateString("en-GB", { month: "short", day: "numeric" }) : "",
        amount: centsToUnit(point.revenue),
      })),
      grossRevenue: centsToUnit(res.grossRevenue ?? 0),
      platformFees: centsToUnit(res.platformFees ?? 0),
      vendorEarnings: centsToUnit(res.vendorEarnings ?? 0),
      totalPayouts: centsToUnit(res.totalPayouts ?? 0),
      netRevenue: centsToUnit(res.netRevenue ?? 0),
    };
  },
};
