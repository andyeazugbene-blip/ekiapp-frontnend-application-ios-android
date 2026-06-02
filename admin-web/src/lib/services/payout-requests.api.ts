import { apiClient } from "../api";
import { AdminPayoutRequest } from "@/types";

function centsToUnit(value: unknown): number {
  return typeof value === "number" ? value / 100 : 0;
}

function normalizePayoutRequest(raw: any): AdminPayoutRequest {
  return {
    id: raw.id,
    vendorId: raw.vendorId ?? "",
    payoutMethodId: raw.payoutMethodId ?? "",
    amount: centsToUnit(raw.amount),
    currency: (raw.currency ?? "GBP").toUpperCase(),
    status: raw.status ?? "PENDING",
    notes: raw.notes ?? null,
    rejectionReason: raw.rejectionReason ?? null,
    approvedById: raw.approvedById ?? null,
    approvedAt: raw.approvedAt ?? null,
    paidById: raw.paidById ?? null,
    paidAt: raw.paidAt ?? null,
    createdAt: raw.createdAt ?? "",
  };
}

export const payoutRequestsAPI = {
  async getPayoutRequests(status?: AdminPayoutRequest["status"]): Promise<AdminPayoutRequest[]> {
    const query = new URLSearchParams();
    if (status) {
      query.set("status", status);
    }
    const suffix = query.toString() ? `?${query.toString()}` : "";
    const res = await apiClient.get<any>(`/admin/payout-requests${suffix}`);
    return (res.payoutRequests ?? res.items ?? []).map(normalizePayoutRequest);
  },

  async approvePayoutRequest(payoutRequestId: string): Promise<AdminPayoutRequest> {
    const res = await apiClient.patch<any>(`/admin/payout-requests/${payoutRequestId}/approve`, {});
    return normalizePayoutRequest(res.payoutRequest ?? res);
  },

  async rejectPayoutRequest(payoutRequestId: string, reason?: string): Promise<AdminPayoutRequest> {
    const res = await apiClient.patch<any>(`/admin/payout-requests/${payoutRequestId}/reject`, { reason });
    return normalizePayoutRequest(res.payoutRequest ?? res);
  },

  async markPayoutRequestPaid(
    payoutRequestId: string,
    twoFactorCode?: string,
  ): Promise<AdminPayoutRequest> {
    const res = await apiClient.patch<any>(
      `/admin/payout-requests/${payoutRequestId}/mark-paid`,
      {},
      { twoFactorCode },
    );
    return normalizePayoutRequest(res.payoutRequest ?? res);
  },
};
