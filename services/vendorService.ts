import { VendorSummary, VendorAdminStatus, VendorDashboardData, AdminDashboardData } from "../types/vendor";
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
    totalProducts: toNumber(raw?.totalProducts),
    totalOrders: toNumber(raw?.totalOrders),
    joinedAt: toText(raw?.joinedAt ?? raw?.createdAt),
    coverImage: raw?.coverImage ? toText(raw.coverImage) : undefined,
    avatar: raw?.avatar ? toText(raw.avatar) : undefined,
    verificationStatus: verificationStatus as VendorSummary["verificationStatus"],
    adminStatus: suspended ? "suspended" : verificationStatus === "verified" ? "active" : "pending",
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

  async getAllVendors(filter?: { status?: VendorAdminStatus | string; search?: string; admin?: boolean }) {
    const query = new URLSearchParams();
    if (filter?.status) query.set("status", filter.status);
    if (filter?.search) query.set("search", filter.search);
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
      const response = await apiClient.get<VendorListResponse>("/api/admin/vendors?limit=100");
      const vendor = (response.vendors ?? response.items ?? []).map(normalizeVendor).find((v) => v.id === id);
      if (!vendor) throw new Error("Vendor not found");
      return vendor;
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
        repeatBuyers: raw.insights?.totalOrders ?? 0,
      },
    } as VendorDashboardData;
  },

  async getRevenueSeries(range: "week" | "month" = "week"): Promise<{ day: string; amount: number }[]> {
    const res = await apiClient.get<{ series: { day: string; amount: number }[] }>(
      `/api/vendors/me/analytics/revenue?range=${encodeURIComponent(range)}`
    );
    return res.series ?? [];
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
    const docType = payload.type === "id" ? "GOVERNMENT_ID" : "BUSINESS_REGISTRATION";
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
};
