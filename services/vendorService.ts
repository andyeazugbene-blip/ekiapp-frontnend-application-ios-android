import {
  VendorSummary,
  VendorAdminStatus,
  VendorDashboardData,
  AdminDashboardData,
  VendorAnalyticsData,
  VendorAnalyticsRange,
  VendorAnalyticsInsight,
  VendorAnalyticsTopProduct,
} from "../types/vendor";
import { apiClient } from "./api";
import { normalizeDashboardEarnings } from "./api/normalizers";
import { tokenStorage } from "./api/tokenStorage";
import { toCompactStoreSlug, toUrlSlug } from "../utils/shareLinks";

interface VendorMeResponse {
  vendor?: any;
  store?: any;
}

interface VendorListResponse {
  vendors?: any[];
  items?: any[];
  total?: number;
}

function toNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toText(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return fallback;
  return String(value);
}

function centsToUnit(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed / 100 : 0;
}

function pickNumber(value: Record<string, unknown>, unitKeys: string[], centKeys: string[], fallback = 0): number {
  for (const key of centKeys) {
    if (value[key] !== undefined && value[key] !== null) {
      return centsToUnit(value[key]);
    }
  }

  for (const key of unitKeys) {
    if (value[key] !== undefined && value[key] !== null) {
      return toNumber(value[key], fallback);
    }
  }

  return fallback;
}

function normalizeVendorAnalytics(raw: any, range: VendorAnalyticsRange): VendorAnalyticsData {
  const value = raw?.analytics && typeof raw.analytics === "object" ? raw.analytics : raw ?? {};
  const summary = value.summary && typeof value.summary === "object" ? value.summary : value;
  const funnel = value.salesFunnel && typeof value.salesFunnel === "object" ? value.salesFunnel : value.funnel ?? {};
  const customers =
    value.customerInsights && typeof value.customerInsights === "object"
      ? value.customerInsights
      : value.customers ?? {};

  const topProducts: VendorAnalyticsTopProduct[] = Array.isArray(value.topProducts)
    ? value.topProducts.map((entry: any) => ({
        productId: toText(entry.productId ?? entry.id),
        name: toText(entry.name ?? entry.title, "Product"),
        orders: toNumber(entry.orders ?? entry.orderCount),
        unitsSold: toNumber(entry.unitsSold ?? entry.quantity),
        revenue: pickNumber(entry, ["revenue"], ["revenueAmount", "revenueInCents"]),
        estimatedProfit:
          entry.estimatedProfit !== undefined || entry.estimatedProfitAmount !== undefined
            ? pickNumber(entry, ["estimatedProfit"], ["estimatedProfitAmount", "estimatedProfitInCents"])
            : undefined,
        hasCost: Boolean(entry.hasCost ?? entry.costPrice ?? entry.costAmount ?? entry.costPriceInCents),
      }))
    : [];

  const insights: VendorAnalyticsInsight[] = Array.isArray(value.insights)
    ? value.insights.map((entry: any, index: number) => ({
        id: toText(entry.id, `insight-${index}`),
        title: toText(entry.title, "Recommended action"),
        body: toText(entry.body ?? entry.description),
        action: toText(entry.action, "view_buyers") as VendorAnalyticsInsight["action"],
        actionLabel: toText(entry.actionLabel, "Review"),
        productId: entry.productId ? toText(entry.productId) : undefined,
        severity: entry.severity,
      }))
    : [];

  return {
    range,
    summary: {
      currency: toText(summary.currency ?? value.currency, "GBP").toUpperCase(),
      totalRevenue: pickNumber(summary, ["totalRevenue", "revenue"], ["totalRevenueAmount", "revenueAmount"]),
      estimatedProfit: pickNumber(
        summary,
        ["estimatedProfit", "profit"],
        ["estimatedProfitAmount", "profitAmount"],
      ),
      estimatedProfitAvailable: Boolean(
        summary.estimatedProfitAvailable ?? summary.hasProductCosts ?? summary.hasCostData,
      ),
      availableForPayout: pickNumber(
        summary,
        ["availableForPayout", "availableBalance"],
        ["availableForPayoutAmount", "availableBalanceAmount"],
      ),
      pendingBalance: pickNumber(
        summary,
        ["pendingBalance", "pendingPayout", "pendingRevenue"],
        ["pendingBalanceAmount", "pendingPayoutAmount", "pendingRevenueAmount"],
      ),
    },
    salesFunnel: {
      storeVisits: toNumber(funnel.storeVisits ?? funnel.opens ?? funnel.visits),
      checkoutStarted: toNumber(funnel.checkoutStarted ?? funnel.checkoutStarts),
      ordersCompleted: toNumber(funnel.ordersCompleted ?? funnel.completedOrders),
      conversionRate: toNumber(funnel.conversionRate),
      repeatOrders: toNumber(funnel.repeatOrders ?? funnel.reorders),
      storeSaves: toNumber(funnel.storeSaves ?? funnel.saveVendorCount),
    },
    customerInsights: {
      newBuyers: toNumber(customers.newBuyers),
      repeatBuyers: toNumber(customers.repeatBuyers),
      inactiveBuyers30d: toNumber(customers.inactiveBuyers30d ?? customers.inactiveBuyers),
    },
    topProducts,
    insights,
  };
}

function normalizeVendor(raw: any): VendorSummary {
  const rawVerificationStatus = (raw?.verificationStatus ?? "pending_docs").toString().toLowerCase();
  const verificationStatus = rawVerificationStatus === "pending" ? "pending_docs" : rawVerificationStatus;
  const suspended = raw?.isSuspended === true || raw?.adminStatus === "suspended";

  return {
    id: toText(raw?.id ?? raw?.vendorId),
    userId:
      raw?.userId ??
      raw?.user?.id ??
      raw?.owner?.id ??
      raw?.vendorUserId ??
      raw?.participantUserId ??
      raw?.profile?.userId ??
      undefined,
    storeName: toText(raw?.storeName),
    storeSlug: raw?.storeSlug ? toText(raw.storeSlug) : undefined,
    shareUrl: raw?.shareUrl ? toText(raw.shareUrl) : undefined,
    ownerName: toText(raw?.ownerName ?? raw?.user?.name),
    country: toText(raw?.country),
    city: toText(raw?.city),
    rating: toNumber(raw?.rating),
    totalReviews: typeof raw?.totalReviews === "number" ? raw.totalReviews : undefined,
    totalProducts: toNumber(raw?.totalProducts),
    totalOrders: toNumber(raw?.totalOrders),
    joinedAt: toText(raw?.joinedAt ?? raw?.createdAt),
    coverImage: raw?.coverImage ? toText(raw.coverImage) : undefined,
    avatar: raw?.avatar ? toText(raw.avatar) : undefined,
    verificationStatus: verificationStatus as VendorSummary["verificationStatus"],
    adminStatus: suspended ? "suspended" : verificationStatus === "verified" ? "active" : "pending",
    currency: raw?.currency ? toText(raw.currency).toUpperCase() : undefined,
    subscriptionPlan: (raw?.subscriptionPlan ?? "free").toString().toLowerCase(),
    description: raw?.description ? toText(raw.description) : undefined,
    businessType: raw?.businessType ? toText(raw.businessType) : undefined,
    sellerRegion: raw?.sellerRegion ? toText(raw.sellerRegion) : undefined,
    deliveryCountries: Array.isArray(raw?.deliveryCountries) ? raw.deliveryCountries.filter(Boolean) : [],
  } as VendorSummary;
}

export const vendorService = {
  async createVendorProfile(input: {
    storeName: string;
    description?: string;
    contactEmail?: string;
    contactPhone?: string;
    country?: string;
    city?: string;
    /** "Markets you serve" multi-select — markets[0] becomes the primary country/currency. */
    markets?: string[];
  }): Promise<{ vendor: VendorSummary; token: string }> {
    const response = await apiClient.post<{ vendor: any; token: string }>("/api/vendors", input);
    await tokenStorage.setToken(response.token);
    return { vendor: normalizeVendor(response.vendor), token: response.token };
  },

  async getMyProfile(): Promise<VendorSummary> {
    const response = await apiClient.get<VendorMeResponse>("/api/vendors/me");
    return normalizeVendor(response.vendor);
  },

  async updateMyProfile(data: Partial<VendorSummary>): Promise<VendorSummary> {
    const response = await apiClient.patch<VendorMeResponse>("/api/vendors/me", data);
    return normalizeVendor(response.vendor);
  },

  async getAllVendors(filter?: { status?: VendorAdminStatus | string; search?: string; admin?: boolean; limit?: number; sort?: string }) {
    const query = new URLSearchParams();
    if (filter?.status) query.set("status", filter.status);
    if (filter?.search) query.set("search", filter.search);
    if (filter?.limit) query.set("limit", String(filter.limit));
    if (filter?.sort) query.set("sort", filter.sort);
    const qs = query.toString();

    const endpoint = filter?.admin ? "/api/admin/vendors" : "/api/vendors";
    const response = await apiClient.get<VendorListResponse>(
      `${endpoint}${qs ? `?${qs}` : ""}`,
      filter?.admin ? undefined : { skipAuth: true }
    );
    return (response.vendors ?? response.items ?? []).map(normalizeVendor);
  },

  async getVendorById(id: string, options?: { admin?: boolean }): Promise<VendorSummary> {
    if (options?.admin) {
      try {
        const response = await apiClient.get<{ vendor: any }>(`/api/admin/vendors/${id}`);
        return normalizeVendor(response.vendor);
      } catch {
        throw new Error("Vendor not found");
      }
    }

    try {
      const response = await apiClient.get<VendorMeResponse>(`/api/vendors/${id}`, { skipAuth: true });
      const normalized = normalizeVendor(response.vendor ?? response.store);
      if (normalized.id && normalized.storeName) {
        return normalized;
      }
    } catch {}

    const vendors = await this.getAllVendors();
    const matchedVendor = vendors.find((vendor) => vendor.id === id || vendor.storeSlug === id);
    if (!matchedVendor) {
      throw new Error("Vendor not found");
    }
    return matchedVendor;
  },

  async getVendorBySlug(slug: string): Promise<VendorSummary> {
    const rawSlug = slug.trim();
    try {
      const response = await apiClient.get<VendorMeResponse>(
        `/api/public/stores/${encodeURIComponent(rawSlug)}`,
        { skipAuth: true }
      );
      return normalizeVendor(response.vendor ?? response.store);
    } catch (primaryError) {
      const vendors = await this.getAllVendors();
      const compactInput = toCompactStoreSlug(rawSlug);
      const matchedVendor = vendors.find((vendor) => {
        const vendorSlug = vendor.storeSlug ?? "";
        return (
          vendorSlug.toLowerCase() === rawSlug.toLowerCase() ||
          toCompactStoreSlug(vendorSlug) === compactInput ||
          toCompactStoreSlug(vendor.storeName) === compactInput ||
          toUrlSlug(vendor.storeName) === rawSlug.toLowerCase()
        );
      });

      if (!matchedVendor) throw primaryError;
      return matchedVendor;
    }
  },

  async approveVendor(vendorId: string) {
    return apiClient.patch<{ vendor?: any }>(`/api/admin/vendors/${vendorId}/approve`, {});
  },

  async rejectVendor(vendorId: string, reason?: string) {
    return apiClient.patch<{ vendor?: any }>(`/api/admin/vendors/${vendorId}/reject`, { reason });
  },

  async suspendVendor(vendorId: string) {
    return apiClient.patch<{ vendor?: any }>(`/api/admin/vendors/${vendorId}/suspend`, {});
  },

  async unsuspendVendor(vendorId: string) {
    return apiClient.patch<{ vendor?: any }>(`/api/admin/vendors/${vendorId}/unsuspend`, {});
  },

  async getVendorStats() {
    return apiClient.get<any>("/api/admin/vendors/stats");
  },

  async getVendorDetail(vendorId: string) {
    const response = await apiClient.get<{ vendor: any }>(`/api/admin/vendors/${vendorId}`);
    return response.vendor;
  },

  async updateVendor(vendorId: string, data: Record<string, unknown>) {
    const response = await apiClient.patch<{ vendor: any }>(`/api/admin/vendors/${vendorId}`, data);
    return response.vendor;
  },

  async deleteVendor(vendorId: string) {
    return apiClient.delete<any>(`/api/admin/vendors/${vendorId}`);
  },

  async bulkApproveVendors(vendorIds: string[]) {
    return apiClient.post<{ affected: number }>("/api/admin/vendors/bulk-approve", { vendorIds });
  },

  async bulkRejectVendors(vendorIds: string[], reason?: string) {
    return apiClient.post<{ affected: number }>("/api/admin/vendors/bulk-reject", { vendorIds, reason });
  },

  async bulkSuspendVendors(vendorIds: string[], reason?: string) {
    return apiClient.post<{ affected: number }>("/api/admin/vendors/bulk-suspend", { vendorIds, reason });
  },

  async assignVendorPlan(vendorId: string, planSlug: string) {
    return apiClient.patch<any>(`/api/admin/vendors/${vendorId}/seller-plan`, { plan: planSlug });
  },

  async getVendorAccount(): Promise<{
    vendorStatus: string;
    storeStatus: string;
    verificationStatus: string;
    accountStatus: string;
    serviceLevel: string;
    serviceName: string;
    monthlyPriceCents?: number;
    platformFeeBps?: number;
    platformFeePercent?: string;
    renewalDate: string | null;
    limits: {
      maxProducts: number;
      currentProducts: number;
      maxOrders: number | null;
      currentOrders: number;
      ordersRemaining: number | null;
      maxCoupons: number;
      currentCoupons: number;
      maxBundles: number;
      canReceiveOrders: boolean;
      canSendOffers: boolean;
      canAccessAnalytics: boolean;
      bundles: boolean;
      flashSales: boolean;
      discounts: boolean;
    };
    features?: {
      analytics: boolean;
      prioritySupport: boolean;
      flashSales: boolean;
      bundles: boolean;
      discounts: boolean;
      marketingTools: boolean;
      customerDatabase: boolean;
      repeatBuyerMarketing: boolean;
      professionalStorefront: boolean;
      orderManagement: boolean;
      storeLinkSharing: boolean;
      canReceiveOrders: boolean;
    };
    usage: { products: number; orders: number; coupons: number };
    lastSync: string;
  }> {
    const res = await apiClient.get<{ account: any }>("/api/vendor/account");
    return res.account;
  },

  async getVendorDashboard(_vendorId?: string): Promise<VendorDashboardData> {
    const raw = await apiClient.get<any>("/api/vendors/me/dashboard");
    const earnings = normalizeDashboardEarnings(raw.earnings ?? {});
    return {
      greeting: raw.greeting ?? "Welcome back,",
      storeName: raw.storeName ?? "",
      alerts: raw.alerts ?? [],
      earnings,
      insights: {
        bestSellingProduct: raw.insights?.bestSellingProduct ?? null,
        // Real repeat-buyer count now lives on performance.repeatBuyers —
        // insights.totalOrders was never a repeat-buyer figure.
        repeatBuyers: raw.performance?.repeatBuyers ?? 0,
      },
      // Pass the architecture's prepared-payload groups through as-is
      // instead of silently discarding them.
      recommended_action: raw.recommended_action ?? null,
      marketing_tools: raw.marketing_tools ?? [],
      business_tools: raw.business_tools ?? [],
      business_counts: raw.business_counts,
      performance: raw.performance,
      vendor_account_status: raw.vendor_account_status,
    } as VendorDashboardData;
  },

  async getRevenueSeries(range: "week" | "month" = "week"): Promise<{ day: string; amount: number }[]> {
    const res = await apiClient.get<{ series: { day: string; amount: number }[] }>(
      `/api/vendors/me/analytics/revenue?range=${encodeURIComponent(range)}`
    );
    return res.series ?? [];
  },

  async getVendorAnalytics(range: VendorAnalyticsRange = "month"): Promise<VendorAnalyticsData> {
    const raw = await apiClient.get<any>(`/api/vendors/me/analytics?range=${encodeURIComponent(range)}`);
    return normalizeVendorAnalytics(raw, range);
  },

  async getAdminDashboard(): Promise<AdminDashboardData> {
    return apiClient.get<AdminDashboardData>("/api/admin/dashboard");
  },

  async getNewVendors() {
    const response = await apiClient.get<VendorListResponse>(
      "/api/vendors?sort=newest&limit=4",
      { skipAuth: true }
    );
    return (response.vendors ?? response.items ?? []).map(normalizeVendor);
  },

  async submitVerificationDocument(payload: {
    type: "id" | "business" | "selfie";
    fileUrl: string;
    backUrl?: string;
    idSubtype?: "passport" | "drivers" | "national";
  }) {
    const docType =
      payload.type === "id"
        ? "GOVERNMENT_ID"
        : payload.type === "selfie"
          ? "SELFIE"
          : "BUSINESS_REGISTRATION";
    const ID_SUBTYPE_MAP: Record<string, string> = {
      passport: "passport",
      drivers: "drivers_license",
      national: "national_id",
    };

    const body: Record<string, unknown> = {
      type: docType,
      frontUrl: payload.fileUrl,
    };
    if (payload.backUrl) body.backUrl = payload.backUrl;
    if (payload.idSubtype) body.idType = ID_SUBTYPE_MAP[payload.idSubtype] ?? payload.idSubtype;

    return apiClient.post<{ document: { id: string; type: string; status: string } }>(
      "/api/vendors/me/verification",
      body
    );
  },

  async getVerificationStatus(): Promise<{ verificationStatus: string; documents: any[] }> {
    return apiClient.get<{ verificationStatus: string; documents: any[] }>("/api/vendors/me/verification");
  },

  async resetVerification() {
    return apiClient.delete<{ message: string }>("/api/vendors/me/verification");
  },

  async createStripeVerificationSession(): Promise<{ url: string; sessionId: string }> {
    return apiClient.post<{ url: string; sessionId: string }>(
      "/api/vendors/me/verification/stripe-session",
      {},
    );
  },

  async getStripeVerificationStatus(): Promise<{
    verificationStatus: string;
    stripeVerificationSessionId: string | null;
    verifiedAt: string | null;
    verificationFailureReason: string | null;
  }> {
    return apiClient.get<{
      verificationStatus: string;
      stripeVerificationSessionId: string | null;
      verifiedAt: string | null;
      verificationFailureReason: string | null;
    }>("/api/vendors/me/verification/stripe-status");
  },

  // ─── Markets you serve — the multi-market layer. Vendor.country/currency
  // stay the primary market; these are the additional approved markets. ──

  async getMyMarkets(): Promise<VendorMarket[]> {
    const response = await apiClient.get<{ markets: any[] }>("/api/vendors/me/markets");
    return (response.markets ?? []).map(normalizeVendorMarket);
  },

  async addMyMarket(market: string): Promise<VendorMarket> {
    const response = await apiClient.post<{ market: any }>("/api/vendors/me/markets", { market });
    return normalizeVendorMarket(response.market);
  },

  async setMyMarketEnabled(marketCode: string, enabled: boolean): Promise<VendorMarket> {
    const response = await apiClient.patch<{ market: any }>(`/api/vendors/me/markets/${marketCode}`, { enabled });
    return normalizeVendorMarket(response.market);
  },

  async removeMyMarket(marketCode: string): Promise<void> {
    await apiClient.delete<{ message: string }>(`/api/vendors/me/markets/${marketCode}`);
  },
};

export interface VendorMarket {
  marketCode: string;
  countryName: string;
  currency: string;
  enabled: boolean;
}

function normalizeVendorMarket(raw: any): VendorMarket {
  return {
    marketCode: toText(raw?.marketCode),
    countryName: toText(raw?.countryName),
    currency: toText(raw?.currency),
    enabled: raw?.enabled !== false,
  };
}
