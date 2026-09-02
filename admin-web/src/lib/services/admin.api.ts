import { apiClient } from "../api";
import {
  DashboardStats, Analytics, RevenueSeries, AnalyticsOverview, GrowthSeries,
  BuyerAnalytics, VendorAnalyticsData, OrderAnalytics,
  PaymentAnalytics, GeographicAnalytics,
} from "@/types";

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
      pendingPayoutsCount: raw.pendingPayoutsCount ?? 0,
      expiringSubscriptionsCount: raw.expiringSubscriptionsCount ?? 0,
      totalUsers: raw.totalBuyers ?? raw.totalUsers ?? 0,
      totalBuyers: raw.totalBuyers ?? 0,
    };
  },

  async getAnalytics(): Promise<Analytics> {
    const raw = await apiClient.get<any>("/admin/analytics");
    const failed = raw.orders?.failed ?? 0;
    const total = raw.orders?.total ?? 0;
    return {
      revenue: {
        today: centsToUnit(raw.revenue?.today),
        thisWeek: centsToUnit(raw.revenue?.thisWeek),
        thisMonth: centsToUnit(raw.revenue?.thisMonth),
        total: centsToUnit(raw.revenue?.allTime),
        change: 0,
        currency: (raw.revenue?.currency ?? "GBP").toUpperCase(),
      },
      orders: {
        total,
        pending: raw.orders?.pending ?? 0,
        paid: raw.orders?.paid ?? 0,
        completed: raw.orders?.completed ?? 0,
        failed,
        change: 0,
      },
      vendors: { active: raw.vendors?.active ?? 0, new: raw.growth?.newVendorsThisWeek ?? 0 },
      buyers: { active: raw.buyers?.active ?? 0, new: raw.growth?.newUsersThisWeek ?? 0 },
      avgOrderValue: total > 0 ? centsToUnit(raw.revenue?.allTime) / total : 0,
      disputeRate: total > 0 ? (failed / total) * 100 : 0,
      growth: {
        newOrdersThisWeek: raw.growth?.newOrdersThisWeek ?? 0,
        newVendorsThisWeek: raw.growth?.newVendorsThisWeek ?? 0,
        newUsersThisWeek: raw.growth?.newUsersThisWeek ?? 0,
      },
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

  async getAnalyticsOverview(): Promise<AnalyticsOverview> {
    const raw = await apiClient.get<any>("/admin/analytics/overview");
    return {
      gmv: centsToUnit(raw.gmv),
      ekiRevenue: centsToUnit(raw.ekiRevenue),
      totalOrders: raw.totalOrders ?? 0,
      avgOrderValue: centsToUnit(raw.avgOrderValue),
      totalBuyers: raw.totalBuyers ?? 0,
      totalVendors: raw.totalVendors ?? 0,
      activeBuyers30d: raw.activeBuyers30d ?? 0,
      activeVendors30d: raw.activeVendors30d ?? 0,
      newBuyers: raw.newBuyers ?? 0,
      newVendors: raw.newVendors ?? 0,
      buyerRetentionRate: raw.buyerRetentionRate ?? 0,
      vendorRetentionRate: raw.vendorRetentionRate ?? 0,
      subscriptionRevenue: centsToUnit(raw.subscriptionRevenue),
      escrowBalance: centsToUnit(raw.escrowBalance),
      pendingPayouts: centsToUnit(raw.pendingPayouts),
      openDisputes: raw.openDisputes ?? 0,
      pendingVerifications: raw.pendingVerifications ?? 0,
      currency: (raw.currency ?? "GBP").toUpperCase(),
    };
  },

  async getAnalyticsGrowth(range: "7d" | "30d" | "90d" = "30d"): Promise<GrowthSeries> {
    const raw = await apiClient.get<any>(`/admin/analytics/growth?range=${range}`);
    const mapSeries = (arr: any[]) =>
      (arr ?? []).map((p: any) => ({
        date: p.date ?? "",
        value: centsToUnit(p.value),
      }));
    const mapCount = (arr: any[]) =>
      (arr ?? []).map((p: any) => ({
        date: p.date ?? "",
        value: p.value ?? 0,
      }));
    return {
      gmv: mapSeries(raw.gmv),
      revenue: mapSeries(raw.revenue),
      orders: mapCount(raw.orders),
      buyers: mapCount(raw.buyers),
      vendors: mapCount(raw.vendors),
      range: raw.range ?? range,
    };
  },

  async getBuyerAnalytics(range: "7d" | "30d" | "90d" = "30d"): Promise<BuyerAnalytics> {
    const raw = await apiClient.get<any>(`/admin/analytics/buyers?range=${range}`);
    return {
      newBuyers: raw.newBuyers ?? 0,
      returningBuyers: raw.returningBuyers ?? 0,
      repeatPurchaseRate: raw.repeatPurchaseRate ?? 0,
      avgOrdersPerBuyer: raw.avgOrdersPerBuyer ?? 0,
      topBuyers: (raw.topBuyers ?? []).map((b: any) => ({
        buyerId: b.buyerId ?? "",
        name: b.name ?? "Unknown",
        totalOrders: b.totalOrders ?? 0,
        totalSpend: centsToUnit(b.totalSpend),
        lastOrderDate: b.lastOrderDate ?? null,
      })),
      buyerLocations: (raw.buyerLocations ?? []).map((l: any) => ({
        country: l.country ?? "",
        count: l.count ?? 0,
      })),
      currency: (raw.currency ?? "GBP").toUpperCase(),
    };
  },

  async getVendorAnalytics(range: "7d" | "30d" | "90d" = "30d"): Promise<VendorAnalyticsData> {
    const raw = await apiClient.get<any>(`/admin/analytics/vendors?range=${range}`);
    const mapVendor = (v: any) => ({
      vendorId: v.vendorId ?? "",
      storeName: v.storeName ?? "Unknown",
      totalRevenue: centsToUnit(v.totalRevenue),
      totalOrders: v.totalOrders ?? 0,
    });
    return {
      topVendorsByRevenue: (raw.topVendorsByRevenue ?? []).map(mapVendor),
      topVendorsByOrders: (raw.topVendorsByOrders ?? []).map(mapVendor),
      vendorsWithNoOrders: raw.vendorsWithNoOrders ?? 0,
      vendorLocations: (raw.vendorLocations ?? []).map((l: any) => ({
        country: l.country ?? "",
        city: l.city ?? null,
        count: l.count ?? 0,
      })),
      vendorRetentionRate: raw.vendorRetentionRate ?? 0,
      totalVendors: raw.totalVendors ?? 0,
      currency: (raw.currency ?? "GBP").toUpperCase(),
    };
  },

  async getOrderAnalytics(range: "7d" | "30d" | "90d" = "30d"): Promise<OrderAnalytics> {
    const raw = await apiClient.get<any>(`/admin/analytics/orders?range=${range}`);
    const mapTimeSeries = (arr: any[], keyName: string) =>
      (arr ?? []).map((p: any) => ({
        [keyName]: p[keyName] ?? p.date ?? "",
        count: p.count ?? 0,
        gmv: centsToUnit(p.gmv),
      }));
    return {
      ordersByDay: mapTimeSeries(raw.ordersByDay, "date") as OrderAnalytics["ordersByDay"],
      ordersByWeek: mapTimeSeries(raw.ordersByWeek, "week") as OrderAnalytics["ordersByWeek"],
      ordersByMonth: mapTimeSeries(raw.ordersByMonth, "month") as OrderAnalytics["ordersByMonth"],
      avgOrderValue: centsToUnit(raw.avgOrderValue),
      topProducts: (raw.topProducts ?? []).map((p: any) => ({
        productId: p.productId ?? "",
        title: p.title ?? "Unknown",
        totalQuantity: p.totalQuantity ?? 0,
        totalRevenue: centsToUnit(p.totalRevenue),
      })),
      topCategories: (raw.topCategories ?? []).map((c: any) => ({
        category: c.category ?? "Uncategorized",
        totalQuantity: c.totalQuantity ?? 0,
        totalRevenue: centsToUnit(c.totalRevenue),
      })),
      currency: (raw.currency ?? "GBP").toUpperCase(),
    };
  },

  async getPaymentAnalytics(range: "7d" | "30d" | "90d" = "30d"): Promise<PaymentAnalytics> {
    const raw = await apiClient.get<any>(`/admin/analytics/payments?range=${range}`);
    const mapCA = (obj: any) => ({
      count: obj?.count ?? 0,
      amount: centsToUnit(obj?.amount),
    });
    return {
      successfulPayments: mapCA(raw.successfulPayments),
      failedPayments: mapCA(raw.failedPayments),
      refunds: mapCA(raw.refunds),
      escrow: {
        pendingCredits: mapCA(raw.escrow?.pendingCredits),
        releases: mapCA(raw.escrow?.releases),
        payoutDebits: mapCA(raw.escrow?.payoutDebits),
        adjustments: mapCA(raw.escrow?.adjustments),
      },
      payouts: {
        totalPaid: mapCA(raw.payouts?.totalPaid),
        totalPending: mapCA(raw.payouts?.totalPending),
        recentPayouts: (raw.payouts?.recentPayouts ?? []).map((p: any) => ({
          id: p.id ?? "",
          vendorId: p.vendorId ?? "",
          storeName: p.storeName ?? "Unknown",
          amount: centsToUnit(p.amount),
          netAmount: centsToUnit(p.netAmount),
          status: p.status ?? "",
          paidAt: p.paidAt ?? null,
          createdAt: p.createdAt ?? "",
        })),
      },
      currency: (raw.currency ?? "GBP").toUpperCase(),
    };
  },

  async getGeographicAnalytics(range: "7d" | "30d" | "90d" = "30d"): Promise<GeographicAnalytics> {
    const raw = await apiClient.get<any>(`/admin/analytics/geography?range=${range}`);
    return {
      ordersByCountry: (raw.ordersByCountry ?? []).map((c: any) => ({
        country: c.country ?? "",
        count: c.count ?? 0,
        gmv: centsToUnit(c.gmv),
      })),
      ordersByCity: (raw.ordersByCity ?? []).map((c: any) => ({
        city: c.city ?? "",
        country: c.country ?? "",
        count: c.count ?? 0,
        gmv: centsToUnit(c.gmv),
      })),
      buyerLocations: (raw.buyerLocations ?? []).map((l: any) => ({
        country: l.country ?? "",
        city: l.city ?? null,
        count: l.count ?? 0,
      })),
      vendorLocations: (raw.vendorLocations ?? []).map((l: any) => ({
        country: l.country ?? "",
        city: l.city ?? null,
        count: l.count ?? 0,
      })),
      currency: (raw.currency ?? "GBP").toUpperCase(),
    };
  },

  async getCommunicationLogs(filters?: {
    eventKey?: string;
    recipientType?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: CommunicationLogEntry[]; total: number }> {
    const params = new URLSearchParams();
    if (filters?.eventKey) params.set("eventKey", filters.eventKey);
    if (filters?.recipientType) params.set("recipientType", filters.recipientType);
    if (filters?.status) params.set("status", filters.status);
    if (filters?.limit) params.set("limit", String(filters.limit));
    if (filters?.offset) params.set("offset", String(filters.offset));
    const qs = params.toString();
    return apiClient.get<{ items: CommunicationLogEntry[]; total: number }>(
      `/admin/communications${qs ? `?${qs}` : ""}`,
    );
  },

  async getCommunicationTemplates(): Promise<{ templates: CommunicationTemplate[] }> {
    return apiClient.get<{ templates: CommunicationTemplate[] }>("/admin/communications/templates");
  },

  async getCommunicationStats(): Promise<CommunicationStats> {
    return apiClient.get<CommunicationStats>("/admin/communications/stats");
  },

  async sendBroadcast(input: {
    audience: string;
    channel: string;
    subject: string;
    body: string;
    vendorId?: string;
    userId?: string;
    productId?: string;
  }): Promise<{ sent: number; messagesCreated: number; smsQueued: number }> {
    return apiClient.post("/admin/broadcasts", input);
  },

  async seedTemplates(): Promise<{ seeded: number }> {
    return apiClient.post("/admin/communications/templates/seed", {});
  },

  async updateTemplate(key: string, data: { title?: string; body?: string; channels?: string[]; enabled?: boolean }): Promise<CommunicationTemplate> {
    return apiClient.patch(`/admin/communications/templates/${encodeURIComponent(key)}`, data);
  },

  async createScheduledCommunication(input: {
    audience: string; channel: string; templateKey?: string;
    subject: string; body: string; scheduledFor: string;
  }): Promise<ScheduledCommunication> {
    return apiClient.post("/admin/communications/scheduled", input);
  },

  async listScheduledCommunications(query?: { status?: string; limit?: number; offset?: number }): Promise<{ items: ScheduledCommunication[]; total: number }> {
    const params = new URLSearchParams();
    if (query?.status) params.set("status", query.status);
    if (query?.limit) params.set("limit", String(query.limit));
    if (query?.offset) params.set("offset", String(query.offset));
    const qs = params.toString();
    return apiClient.get(`/admin/communications/scheduled${qs ? `?${qs}` : ""}`);
  },

  async cancelScheduledCommunication(id: string): Promise<ScheduledCommunication> {
    return apiClient.patch(`/admin/communications/scheduled/${id}/cancel`, {});
  },

  async updateScheduledCommunication(id: string, data: { subject?: string; body?: string; scheduledFor?: string; audience?: string; channel?: string }): Promise<ScheduledCommunication> {
    return apiClient.patch(`/admin/communications/scheduled/${id}`, data);
  },

  async runScheduledCommunications(): Promise<{ processed: number; sent: number; failed: number }> {
    return apiClient.post("/admin/communications/run-scheduled", {});
  },
};

export interface CommunicationLogEntry {
  id: string;
  recipientId: string;
  recipientType: string;
  eventKey: string;
  channel: string;
  title: string;
  body: string;
  status: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface CommunicationTemplate {
  key: string;
  title: string;
  body: string;
  channels: string[];
  enabled: boolean;
  recipientType: string;
}

export interface CommunicationStats {
  total: number;
  totalSent: number;
  totalFailed: number;
  totalQueued: number;
  byEvent: { event: string; count: number }[];
  byChannel: { channel: string; count: number }[];
}

export interface ScheduledCommunication {
  id: string;
  audience: string;
  channel: string;
  templateKey: string | null;
  subject: string;
  body: string;
  status: string;
  scheduledFor: string;
  sentAt: string | null;
  createdBy: string;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}
