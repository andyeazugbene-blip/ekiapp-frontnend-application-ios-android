import { apiClient } from "../api";

/**
 * Users + Vendors admin API (handbook §4, §14.5, §14.7). Server-side search,
 * filters and cursor pagination; no client-side filtering of a capped list.
 */

export interface ProviderSummary {
  stage: "NOT_STARTED" | "PENDING" | "REQUIREMENTS_DUE" | "RESTRICTED" | "VERIFIED";
  identityState: string;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
}

export interface VendorRow {
  id: string;
  storeName: string;
  ownerName: string;
  email: string | null;
  country: string | null;
  city: string | null;
  avatar?: string | null;
  verificationStatus: "PENDING" | "VERIFIED" | "REJECTED";
  isSuspended: boolean;
  closedAt: string | null;
  isTest: boolean;
  createdAt: string;
  orderCount: number;
  totalRevenue: number;
  currency: string;
  subscriptionPlan: string | null;
  subscriptionStatus: string | null;
  subscriptionPeriodEnd: string | null;
  trialEndsAt: string | null;
  provider: ProviderSummary;
}

export interface VendorListResult {
  items: VendorRow[];
  nextCursor: string | null;
  total: number;
}

export interface VendorStatsResult {
  total: number;
  approved: number;
  verified: number;
  pending: number;
  rejected: number;
  suspended: number;
  paymentReady: number;
  testVendors: number;
  withOrders: number;
  withoutOrders: number;
}

export interface VendorFilters {
  q?: string;
  status?: string;       // PENDING | VERIFIED | REJECTED
  suspended?: string;    // true | false
  payment?: string;      // ready | not_ready
  country?: string;
  subscription?: string; // FREE | GROWTH | PRO | NONE
  includeTest?: boolean;
  cursor?: string | null;
  limit?: number;
}

function qs(params: Record<string, string | number | boolean | null | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "" || v === false) continue;
    p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}

function normalizeVendorRow(raw: any): VendorRow {
  return {
    id: raw.id,
    storeName: raw.storeName ?? "",
    ownerName: raw.user?.name ?? "",
    email: raw.contactEmail ?? raw.user?.email ?? null,
    country: raw.country ?? null,
    city: raw.city ?? null,
    avatar: raw.avatar,
    verificationStatus: (raw.verificationStatus ?? "PENDING") as VendorRow["verificationStatus"],
    isSuspended: Boolean(raw.isSuspended),
    closedAt: raw.closedAt ?? null,
    isTest: Boolean(raw.isTest),
    createdAt: raw.createdAt,
    orderCount: raw.orderCount ?? 0,
    totalRevenue: raw.totalRevenue ?? 0,
    currency: raw.currency ?? "EUR",
    subscriptionPlan: raw.subscriptionPlan ?? null,
    subscriptionStatus: raw.subscriptionStatus ?? null,
    subscriptionPeriodEnd: raw.subscriptionPeriodEnd ?? null,
    trialEndsAt: raw.trialEndsAt ?? null,
    provider: raw.provider ?? { stage: "NOT_STARTED", identityState: "NOT_STARTED", chargesEnabled: false, payoutsEnabled: false },
  };
}

export interface UserRow {
  id: string;
  email: string;
  name: string;
  avatar: string | null;
  role: "BUYER" | "VENDOR" | "ADMIN";
  isSuspended: boolean;
  suspendedReason: string | null;
  suspendedAt: string | null;
  anonymisedAt: string | null;
  lastActiveAt: string | null;
  isTest: boolean;
  createdAt: string;
  storeName: string | null;
  vendorId: string | null;
  orderCount: number;
}

export type UserState = "active" | "suspended" | "anonymised";

export function userState(u: { isSuspended: boolean; anonymisedAt: string | null }): UserState {
  if (u.anonymisedAt) return "anonymised";
  return u.isSuspended ? "suspended" : "active";
}

export interface UserListResult { items: UserRow[]; nextCursor: string | null; total: number }

export interface UserFilters {
  q?: string; role?: string; status?: string; includeTest?: boolean; cursor?: string | null; limit?: number;
}

export interface AdminNote { id: string; body: string; createdAt: string; authorId: string; authorName: string }
export interface TimelineEvent {
  id: string; action: string; reason: string | null; createdAt: string; actorName: string;
  beforeState: unknown; afterState: unknown;
}
export interface CloseBlocker { code: string; message: string; count?: number; amount?: number; currency?: string }

export interface SuspendBody { reason: string; evidence?: string; durationDays?: number; notifyUser?: boolean }

export const peopleAPI = {
  async listVendors(f: VendorFilters = {}): Promise<VendorListResult> {
    const res = await apiClient.get<any>(`/admin/vendors${qs({ ...f, limit: f.limit ?? 20 })}`, { bypassCache: true });
    return { items: (res.items ?? []).map(normalizeVendorRow), nextCursor: res.nextCursor ?? null, total: res.total ?? 0 };
  },

  async vendorStats(): Promise<VendorStatsResult> {
    return apiClient.get<VendorStatsResult>("/admin/vendors/stats", { bypassCache: true });
  },

  async getVendor(id: string): Promise<any> {
    const res = await apiClient.get<any>(`/admin/vendors/${id}`, { bypassCache: true });
    return res.vendor ?? res;
  },

  async suspendVendor(id: string, body: SuspendBody, twoFactorCode?: string) {
    return apiClient.patch<any>(`/admin/vendors/${id}/suspend`, body, { twoFactorCode });
  },
  async unsuspendVendor(id: string, body: { reason: string; notifyUser?: boolean }, twoFactorCode?: string) {
    return apiClient.patch<any>(`/admin/vendors/${id}/unsuspend`, body, { twoFactorCode });
  },
  async bulkSuspendVendors(ids: string[], body: SuspendBody, twoFactorCode?: string) {
    return apiClient.post<{ affected: number; results: Array<{ vendorId: string; ok: boolean; error?: string }> }>(
      "/admin/vendors/bulk-suspend", { vendorIds: ids, ...body }, { twoFactorCode });
  },
  async closeCheck(id: string): Promise<{ canClose: boolean; blockers: CloseBlocker[] }> {
    return apiClient.get(`/admin/vendors/${id}/close-check`, { bypassCache: true });
  },
  async closeVendor(id: string, reason: string, twoFactorCode?: string) {
    return apiClient.post(`/admin/vendors/${id}/close`, { reason }, { twoFactorCode });
  },

  async listUsers(f: UserFilters = {}): Promise<UserListResult> {
    const res = await apiClient.get<any>(`/admin/users${qs({ ...f, limit: f.limit ?? 20 })}`, { bypassCache: true });
    return {
      items: (res.items ?? []).map((u: any): UserRow => ({
        id: u.id, email: u.email, name: u.name, avatar: u.avatar ?? null, role: u.role,
        isSuspended: Boolean(u.isSuspended), suspendedReason: u.suspendedReason ?? null, suspendedAt: u.suspendedAt ?? null,
        anonymisedAt: u.anonymisedAt ?? null, lastActiveAt: u.lastActiveAt ?? null, isTest: Boolean(u.isTest),
        createdAt: u.createdAt, storeName: u.vendor?.storeName ?? null, vendorId: u.vendor?.id ?? null,
        orderCount: u._count?.orders ?? 0,
      })),
      nextCursor: res.nextCursor ?? null,
      total: res.total ?? 0,
    };
  },
  async getUser(id: string): Promise<any> {
    const res = await apiClient.get<any>(`/admin/users/${id}`, { bypassCache: true });
    return res.user ?? res;
  },
  async suspendUser(id: string, body: SuspendBody, twoFactorCode?: string) {
    return apiClient.patch<any>(`/admin/users/${id}/suspend`, body, { twoFactorCode });
  },
  async unsuspendUser(id: string, body: { reason: string; notifyUser?: boolean }, twoFactorCode?: string) {
    return apiClient.patch<any>(`/admin/users/${id}/unsuspend`, body, { twoFactorCode });
  },

  async notes(kind: "users" | "vendors", id: string): Promise<AdminNote[]> {
    const res = await apiClient.get<{ notes: AdminNote[] }>(`/admin/${kind}/${id}/notes`, { bypassCache: true });
    return res.notes ?? [];
  },
  async addNote(kind: "users" | "vendors", id: string, body: string): Promise<void> {
    await apiClient.post(`/admin/${kind}/${id}/notes`, { body });
  },
  async timeline(kind: "users" | "vendors", id: string): Promise<TimelineEvent[]> {
    const res = await apiClient.get<{ events: TimelineEvent[] }>(`/admin/${kind}/${id}/timeline`, { bypassCache: true });
    return res.events ?? [];
  },
};
