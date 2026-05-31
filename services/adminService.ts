/**
 * Admin service for platform management endpoints.
 */
import { Order, OrderStatus } from "../types/order";
import { Product } from "../types/product";
import { AdminDashboardData, VendorAdminStatus, VendorSummary } from "../types/vendor";
import { apiClient } from "./api";
import { normalizeOrder, normalizeOrders, normalizeProduct, normalizeProducts, toBackendOrderStatus } from "./api/normalizers";

export interface AdminAnalytics {
  revenue: { total: number; change: number; currency: string };
  orders: { total: number; change: number };
  vendors: { active: number; new: number };
  buyers: { active: number; new: number };
  avgOrderValue: number;
  disputeRate: number;
  topVendors: { id: string; name: string; revenue: number; orders: number }[];
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: "buyer" | "vendor" | "admin";
  status: "active" | "suspended" | "pending";
  createdAt: string;
}

export interface VerificationDocument {
  id: string;
  vendorId: string;
  vendorName: string;
  type: "id" | "business" | "selfie";
  status: "pending" | "approved" | "rejected";
  fileUrl: string;
  submittedAt: string;
  reviewedAt?: string;
  reviewNote?: string;
}

export interface AdminEscrowHealth {
  outstandingOrders: number;
  outstandingAmount: number;
  currency: string;
  statusBreakdown: Record<string, { count: number; amount: number }>;
}

export interface AdminDispute {
  id: string;
  orderId: string;
  buyerId?: string;
  vendorId?: string;
  reason: string;
  status: string;
  resolution?: string;
  fraudulent?: boolean;
  refundAmount?: number;
  createdAt: string;
  resolvedAt?: string;
  order?: {
    id: string;
    orderNumber: string;
    totalAmount: number;
    vendorEarnings?: number;
    currency: string;
    buyerId?: string;
    vendorId?: string;
    deliveryAddress?: string;
    createdAt?: string;
    items?: { productTitle: string; quantity: number; totalAmount: number }[];
  };
}

interface ListResponse<T> {
  items?: T[];
  users?: T[];
  vendors?: T[];
  products?: T[];
  orders?: T[];
  documents?: T[];
  nextCursor?: string | null;
}

function centsToUnit(value: unknown): number {
  return typeof value === "number" ? value / 100 : 0;
}

function normalizeVendor(raw: any): VendorSummary {
  const verification = (raw.verificationStatus ?? "PENDING").toString().toUpperCase();
  const verificationStatus = verification === "VERIFIED" ? "verified" : verification === "REJECTED" ? "rejected" : "pending_docs";
  const adminStatus: VendorAdminStatus = raw.isSuspended ? "suspended" : verificationStatus === "verified" ? "active" : "pending";

  return {
    id: raw.id,
    storeName: raw.storeName ?? "",
    storeSlug: raw.storeSlug,
    shareUrl: raw.shareUrl,
    ownerName: raw.ownerName ?? raw.user?.name ?? "",
    country: raw.country ?? "",
    city: raw.city ?? "",
    rating: raw.rating ?? 0,
    totalProducts: raw.totalProducts ?? raw._count?.products ?? 0,
    totalOrders: raw.totalOrders ?? raw._count?.orderItems ?? 0,
    joinedAt: raw.joinedAt ?? raw.createdAt ?? "",
    coverImage: raw.coverImage,
    avatar: raw.avatar,
    verificationStatus: verificationStatus as VendorSummary["verificationStatus"],
    adminStatus,
    subscriptionPlan: (raw.subscriptionPlan ?? "free").toString().toLowerCase(),
    description: raw.description,
  } as VendorSummary;
}

function toAdminVendorStatus(status?: VendorAdminStatus | string): string | undefined {
  if (!status || status === "suspended") return undefined;
  if (status === "active") return "VERIFIED";
  if (status === "pending") return "PENDING";
  return status.toUpperCase();
}

function normalizeUser(raw: any): AdminUser {
  return {
    id: raw.id,
    name: raw.name ?? "",
    email: raw.email ?? "",
    role: (raw.role ?? "BUYER").toString().toLowerCase(),
    status: raw.isSuspended ? "suspended" : "active",
    createdAt: raw.createdAt ?? "",
  } as AdminUser;
}

function normalizeDocument(raw: any): VerificationDocument {
  const type = (raw.type ?? "").toString().toLowerCase();
  return {
    id: raw.id,
    vendorId: raw.vendorId,
    vendorName: raw.vendor?.storeName ?? raw.vendorName ?? "",
    type: type.includes("business") ? "business" : type.includes("selfie") ? "selfie" : "id",
    status: (raw.status ?? "pending").toString().toLowerCase(),
    fileUrl: raw.frontUrl ?? raw.fileUrl ?? "",
    submittedAt: raw.createdAt ?? raw.submittedAt ?? "",
    reviewedAt: raw.reviewedAt,
    reviewNote: raw.reviewNote ?? raw.rejectionReason,
  } as VerificationDocument;
}

function normalizeDispute(raw: any): AdminDispute {
  return {
    id: raw.id,
    orderId: raw.orderId ?? raw.order?.id ?? "",
    buyerId: raw.buyerId ?? raw.order?.buyerId,
    vendorId: raw.vendorId ?? raw.order?.vendorId,
    reason: raw.reason ?? "",
    status: raw.status ?? "OPEN",
    resolution: raw.resolution ?? undefined,
    fraudulent: raw.fraudulent ?? false,
    refundAmount: centsToUnit(raw.refundAmount),
    createdAt: raw.createdAt ?? "",
    resolvedAt: raw.resolvedAt ?? undefined,
    order: raw.order
      ? {
          id: raw.order.id,
          orderNumber: raw.order.orderNumber ?? "",
          totalAmount: centsToUnit(raw.order.totalAmount),
          vendorEarnings: centsToUnit(raw.order.vendorEarnings),
          currency: (raw.order.currency ?? "GBP").toUpperCase(),
          buyerId: raw.order.buyerId ?? undefined,
          vendorId: raw.order.vendorId ?? undefined,
          deliveryAddress: raw.order.deliveryAddress ?? undefined,
          createdAt: raw.order.createdAt ?? undefined,
          items: (raw.order.items ?? []).map((item: any) => ({
            productTitle: item.productTitle ?? "",
            quantity: item.quantity ?? 0,
            totalAmount: centsToUnit(item.totalAmount),
          })),
        }
      : undefined,
  };
}

export const adminService = {
  async getDashboard(): Promise<AdminDashboardData> {
    const raw = await apiClient.get<any>("/api/admin/dashboard");
    return {
      totalVendors: raw.totalVendors ?? 0,
      pendingApprovals: raw.pendingApprovals ?? 0,
      activeVendors: raw.activeVendors ?? 0,
      suspendedVendors: raw.suspendedVendors ?? 0,
      totalOrders: raw.totalOrders ?? 0,
      totalRevenue: centsToUnit(raw.totalRevenue),
      newVendorsThisWeek: raw.newVendorsThisWeek ?? 0,
    };
  },

  async getAnalytics(): Promise<AdminAnalytics> {
    const raw = await apiClient.get<any>("/api/admin/analytics");
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

  async getRevenueSeries(range: "week" | "month" = "week"): Promise<{ day: string; amount: number }[]> {
    const backendRange = range === "week" ? "7d" : "30d";
    const res = await apiClient.get<any>(`/api/admin/analytics/revenue?range=${backendRange}`);
    return (res.series ?? []).map((point: any) => ({
      day: point.date ? new Date(point.date).toLocaleDateString("en-GB", { weekday: "short" }) : "",
      amount: centsToUnit(point.revenue),
    }));
  },

  async getUsers(params?: { role?: string; status?: string; page?: number }): Promise<AdminUser[]> {
    const query = new URLSearchParams();
    if (params?.role) query.set("role", params.role.toUpperCase());
    query.set("limit", "100");
    const res = await apiClient.get<ListResponse<any>>(`/api/admin/users?${query.toString()}`);
    return (res.items ?? res.users ?? []).map(normalizeUser);
  },

  async getVendors(params?: { status?: VendorAdminStatus; search?: string }): Promise<VendorSummary[]> {
    const query = new URLSearchParams();
    const backendStatus = toAdminVendorStatus(params?.status);
    if (backendStatus) query.set("status", backendStatus);
    query.set("limit", "100");
    const res = await apiClient.get<ListResponse<any>>(`/api/admin/vendors?${query.toString()}`);
    let vendors = (res.items ?? res.vendors ?? []).map(normalizeVendor);
    if (params?.status === "suspended") vendors = vendors.filter((vendor) => vendor.adminStatus === "suspended");
    if (params?.search) {
      const search = params.search.toLowerCase();
      vendors = vendors.filter((vendor) => vendor.storeName.toLowerCase().includes(search) || vendor.ownerName.toLowerCase().includes(search));
    }
    return vendors;
  },

  async approveVendor(vendorId: string): Promise<{ vendorId: string; status: VendorAdminStatus }> {
    await apiClient.patch<{ vendor?: any }>(`/api/admin/vendors/${vendorId}/approve`, {});
    return { vendorId, status: "active" };
  },

  async rejectVendor(vendorId: string, reason?: string): Promise<{ vendorId: string; status: VendorAdminStatus }> {
    await apiClient.patch<{ vendor?: any }>(`/api/admin/vendors/${vendorId}/reject`, { reason });
    return { vendorId, status: "pending" };
  },

  async suspendVendor(vendorId: string): Promise<{ vendorId: string; status: VendorAdminStatus }> {
    await apiClient.patch<{ vendor?: any }>(`/api/admin/vendors/${vendorId}/suspend`, {});
    return { vendorId, status: "suspended" };
  },

  async unsuspendVendor(vendorId: string): Promise<{ vendorId: string; status: VendorAdminStatus }> {
    await apiClient.patch<{ vendor?: any }>(`/api/admin/vendors/${vendorId}/unsuspend`, {});
    return { vendorId, status: "active" };
  },

  async getProducts(params?: { status?: string; page?: number }): Promise<Product[]> {
    const query = new URLSearchParams();
    if (params?.status === "active") query.set("isActive", "true");
    if (params?.status === "disabled" || params?.status === "out_of_stock") query.set("isActive", "false");
    query.set("limit", "100");
    const res = await apiClient.get<ListResponse<any>>(`/api/admin/products?${query.toString()}`);
    return normalizeProducts(res.items ?? res.products ?? []);
  },

  async approveProduct(productId: string): Promise<{ productId: string; status: string }> {
    await apiClient.patch<{ product?: any }>(`/api/admin/products/${productId}/approve`, {});
    return { productId, status: "active" };
  },

  async disableProduct(productId: string): Promise<{ productId: string; status: string }> {
    await apiClient.patch<{ product?: any }>(`/api/admin/products/${productId}/disable`, {});
    return { productId, status: "disabled" };
  },

  async getOrders(params?: { status?: OrderStatus; page?: number }): Promise<Order[]> {
    const query = new URLSearchParams();
    if (params?.status) query.set("status", toBackendOrderStatus(params.status));
    query.set("limit", "100");
    const res = await apiClient.get<ListResponse<any>>(`/api/admin/orders?${query.toString()}`);
    return normalizeOrders(res.items ?? res.orders ?? []);
  },

  async completeOrder(orderId: string): Promise<{ orderId: string; status: OrderStatus }> {
    const result = await apiClient.patch<{ orderId: string; status: string }>(`/api/admin/orders/${orderId}/complete`, {});
    return { orderId: result.orderId, status: normalizeOrder({ id: orderId, status: result.status }).status };
  },

  async getEscrowHealth(): Promise<AdminEscrowHealth> {
    return apiClient.get<AdminEscrowHealth>("/api/admin/escrow/health");
  },

  async getDisputes(params?: { status?: string; limit?: number }): Promise<AdminDispute[]> {
    const query = new URLSearchParams();
    if (params?.status) query.set("status", params.status);
    if (params?.limit) query.set("limit", String(params.limit));
    const qs = query.toString();
    const res = await apiClient.get<{ items?: any[]; disputes?: any[] }>(`/api/admin/disputes${qs ? `?${qs}` : ""}`);
    return (res.items ?? res.disputes ?? []).map(normalizeDispute);
  },

  async getDispute(disputeId: string): Promise<AdminDispute> {
    const res = await apiClient.get<{ dispute?: any }>(`/api/admin/disputes/${disputeId}`);
    return normalizeDispute(res.dispute ?? res);
  },

  async resolveDispute(
    disputeId: string,
    input: { resolution: "buyer" | "vendor" | "partial"; note: string; refundAmount?: number; fraudulent?: boolean; twoFactorCode?: string },
  ): Promise<{ status: string }> {
    const headers = input.twoFactorCode ? { "x-2fa-code": input.twoFactorCode } : undefined;
    return apiClient.patch<{ status: string }>(
      `/api/admin/disputes/${disputeId}/resolve`,
      {
        resolution: input.resolution,
        note: input.note,
        refundAmount: typeof input.refundAmount === "number" ? Math.round(input.refundAmount * 100) : undefined,
        fraudulent: input.fraudulent ?? false,
      },
      headers ? { headers } : undefined,
    );
  },

  async getVerificationDocuments(status?: "pending" | "approved" | "rejected"): Promise<VerificationDocument[]> {
    const query = status ? `?status=${encodeURIComponent(status.toUpperCase())}` : "";
    const res = await apiClient.get<ListResponse<any>>(`/api/admin/verification-documents${query}`);
    return (res.items ?? res.documents ?? []).map(normalizeDocument);
  },

  async reviewDocument(docId: string, decision: "approved" | "rejected", note?: string): Promise<VerificationDocument> {
    const res = await apiClient.patch<{ document?: any }>(
      `/api/admin/verification-documents/${docId}/review`,
      { decision: decision.toUpperCase(), note },
    );
    return normalizeDocument(res.document ?? { id: docId, status: decision, reviewNote: note });
  },
};
