/**
 * Payout service for vendor earnings and withdrawal requests.
 */
import { PayoutMode, VendorEarnings } from "../types/order";
import { apiClient } from "./api";
import { normalizeDashboardEarnings, normalizePayoutRequest } from "./api/normalizers";

export interface PayoutRequest {
  id: string;
  amount: number;
  currency: string;
  status: "pending" | "processing" | "paid" | "failed";
  method: string;
  createdAt: string;
}

function buildEarnings(raw: any): VendorEarnings {
  const normalized = normalizeDashboardEarnings(raw ?? {});
  const recentPayouts = Array.isArray(raw?.recentPayouts) ? raw.recentPayouts.map(normalizePayoutRequest) : [];

  return {
    totalEarnings: typeof raw?.totalEarnings === "number" ? raw.totalEarnings / 100 : 0,
    pendingPayout: normalized.pendingPayout,
    pendingPayoutNgn: normalized.pendingPayoutNgn,
    availableBalance: normalized.availableBalance,
    availableBalanceNgn: Math.round((normalized.availableBalance ?? 0) * 1500),
    salesToday: normalized.salesToday,
    salesTodayNgn: normalized.salesTodayNgn,
    salesThisWeek: normalized.salesThisWeek,
    salesThisWeekNgn: normalized.salesThisWeekNgn,
    salesThisMonth: normalized.salesThisMonth,
    salesThisMonthNgn: normalized.salesThisMonthNgn,
    currency: normalized.currency,
    localCurrency: "NGN",
    localRate: 1500,
    payoutMode: "per_order",
    recentPayouts: recentPayouts.map((payout: ReturnType<typeof normalizePayoutRequest>) => ({
      id: payout.id,
      vendorId: "",
      amount: payout.amount,
      currency: payout.currency,
      status: payout.status,
      orderNumber: "",
      createdAt: payout.createdAt,
    })),
  };
}

export const payoutService = {
  async getEarnings(): Promise<VendorEarnings> {
    const raw = await apiClient.get<any>("/api/vendors/me/earnings");
    return buildEarnings(raw);
  },

  async requestPayout(amount: number, method: string): Promise<PayoutRequest> {
    const raw = await apiClient.post<any>("/api/payout-requests", {
      amount: Math.round(amount * 100),
      payoutMethodId: method,
    });
    return normalizePayoutRequest(raw.payoutRequest ?? raw) as PayoutRequest;
  },

  async getPayoutRequests(): Promise<PayoutRequest[]> {
    const res = await apiClient.get<{ payoutRequests?: any[]; requests?: any[] }>("/api/payout-requests/me");
    return (res.payoutRequests ?? res.requests ?? []).map(normalizePayoutRequest) as PayoutRequest[];
  },

  async getPayoutHistory(): Promise<PayoutRequest[]> {
    const res = await apiClient.get<{ payoutRequests?: any[] }>("/api/payout-requests/me/history");
    return (res.payoutRequests ?? []).map(normalizePayoutRequest) as PayoutRequest[];
  },

  async updatePayoutMode(_mode: PayoutMode): Promise<{ payoutMode: PayoutMode }> {
    throw new Error("Changing the payout schedule is not exposed by the backend yet.");
  },
};
