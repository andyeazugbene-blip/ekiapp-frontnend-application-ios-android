import { apiClient } from "../api";
import { Vendor, VendorStatus } from "@/types";

function centsToUnit(value: unknown): number {
  return typeof value === "number" ? value / 100 : 0;
}

function normalizeVendor(raw: any): Vendor {
  const verification = (raw.verificationStatus ?? "PENDING").toString().toUpperCase();
  const verificationStatus = verification === "VERIFIED" ? "verified" : verification === "REJECTED" ? "rejected" : "pending_docs";
  const adminStatus: VendorStatus = raw.isSuspended ? "suspended" : verificationStatus === "verified" ? "active" : "pending";

  return {
    id: raw.id,
    storeName: raw.storeName ?? "",
    storeSlug: raw.storeSlug,
    ownerName: raw.ownerName ?? raw.user?.name ?? "",
    email: raw.contactEmail ?? raw.user?.email ?? "",
    phone: raw.contactPhone ?? "",
    country: raw.country ?? "",
    city: raw.city ?? "",
    rating: raw.rating ?? 0,
    totalProducts: raw.totalProducts ?? raw._count?.products ?? 0,
    totalOrders: raw.orderCount ?? raw.totalOrders ?? raw._count?.orderItems ?? 0,
    totalRevenue: centsToUnit(raw.totalRevenue),
    joinedAt: raw.joinedAt ?? raw.createdAt ?? "",
    coverImage: raw.coverImage,
    avatar: raw.avatar,
    verificationStatus,
    adminStatus,
    subscriptionPlan: (raw.subscriptionPlan ?? "free").toString().toLowerCase(),
    subscriptionStatus: (raw.subscriptionStatus ?? "active").toString().toLowerCase(),
    description: raw.description,
    isSuspended: raw.isSuspended ?? false,
  };
}

function toAdminVendorStatus(status?: VendorStatus | string): string | undefined {
  if (!status || status === "suspended") return undefined;
  if (status === "active") return "VERIFIED";
  if (status === "pending") return "PENDING";
  return String(status).toUpperCase();
}

export const vendorsAPI = {
  async getVendors(params?: { status?: VendorStatus; search?: string; limit?: number }): Promise<Vendor[]> {
    const query = new URLSearchParams();
    const backendStatus = toAdminVendorStatus(params?.status);
    if (backendStatus) query.set("status", backendStatus);
    query.set("limit", String(params?.limit ?? 100));
    const res = await apiClient.get<any>(`/admin/vendors?${query.toString()}`);
    let vendors = (res.items ?? res.vendors ?? []).map(normalizeVendor);
    if (params?.status === "suspended") {
      vendors = vendors.filter((vendor: Vendor) => vendor.adminStatus === "suspended");
    }
    if (params?.search) {
      const search = params.search.toLowerCase();
      vendors = vendors.filter(
        (vendor: Vendor) =>
          vendor.storeName.toLowerCase().includes(search) ||
          vendor.ownerName.toLowerCase().includes(search)
      );
    }
    return vendors;
  },

  async getVendor(vendorId: string): Promise<any> {
    const res = await apiClient.get<any>(`/admin/vendors/${vendorId}`);
    const raw = res.vendor ?? res;
    return {
      ...normalizeVendor(raw),
      products: raw.products ?? [],
      recentOrders: raw.recentOrders ?? [],
      avgRating: raw.avgRating ?? null,
      totalReviews: raw.totalReviews ?? 0,
      totalRevenue: raw.totalRevenue ?? 0,
      storeOrders: raw.storeOrders ?? 0,
      contactEmail: raw.contactEmail ?? raw.user?.email ?? "",
      createdAt: raw.createdAt ?? "",
    };
  },

  async preloadVendor(vendorId: string): Promise<void> {
    await apiClient.prefetch(`/admin/vendors/${vendorId}`);
  },

  async approveVendor(vendorId: string): Promise<void> {
    await apiClient.patch(`/admin/vendors/${vendorId}/approve`, {});
  },

  async rejectVendor(vendorId: string, reason?: string): Promise<void> {
    await apiClient.patch(`/admin/vendors/${vendorId}/reject`, { reason });
  },

  async suspendVendor(vendorId: string, twoFactorCode?: string): Promise<void> {
    await apiClient.patch(`/admin/vendors/${vendorId}/suspend`, {}, { twoFactorCode });
  },

  async unsuspendVendor(vendorId: string, twoFactorCode?: string): Promise<void> {
    await apiClient.patch(`/admin/vendors/${vendorId}/unsuspend`, {}, { twoFactorCode });
  },

  async assignSellerPlan(vendorId: string, plan: string): Promise<void> {
    await apiClient.patch(`/admin/vendors/${vendorId}/seller-plan`, { plan });
  },

  async getVendorStats(): Promise<VendorStats> {
    return apiClient.get<VendorStats>("/admin/vendors/stats");
  },

  async updateVendor(vendorId: string, data: Record<string, string | null>): Promise<void> {
    await apiClient.patch(`/admin/vendors/${vendorId}`, data);
  },

  async deleteVendor(vendorId: string): Promise<{ hardDeleted: boolean; message: string }> {
    return apiClient.delete(`/admin/vendors/${vendorId}`);
  },

  async bulkApprove(vendorIds: string[]): Promise<{ affected: number }> {
    return apiClient.post<{ affected: number }>("/admin/vendors/bulk-approve", { vendorIds });
  },

  async bulkReject(vendorIds: string[], reason?: string): Promise<{ affected: number }> {
    return apiClient.post<{ affected: number }>("/admin/vendors/bulk-reject", { vendorIds, reason });
  },

  async bulkSuspend(vendorIds: string[], twoFactorCode?: string): Promise<{ affected: number }> {
    return apiClient.post<{ affected: number }>("/admin/vendors/bulk-suspend", { vendorIds }, { twoFactorCode });
  },
};

export interface VendorStats {
  total: number;
  active: number;
  pending: number;
  rejected: number;
  suspended: number;
  verified: number;
  unverified: number;
  withOrders: number;
  withoutOrders: number;
  avgRevenue: number;
  gmv: number;
}
