import { apiClient } from "../api";
import { Dispute } from "@/types";

function centsToUnit(value: unknown): number {
  return typeof value === "number" ? value / 100 : 0;
}

function normalizeDispute(raw: any): Dispute {
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
          buyerId: raw.order.buyerId ?? "",
          vendorId: raw.order.vendorId ?? "",
          totalAmount: centsToUnit(raw.order.totalAmount),
          currency: (raw.order.currency ?? "GBP").toUpperCase(),
          status: raw.order.status ?? "pending",
          createdAt: raw.order.createdAt ?? "",
          items: (raw.order.items ?? []).map((item: any) => ({
            id: item.id,
            productTitle: item.productTitle ?? "",
            quantity: item.quantity ?? 0,
            price: centsToUnit(item.price),
            totalAmount: centsToUnit(item.totalAmount),
          })),
        }
      : undefined,
  };
}

export const disputesAPI = {
  async getDisputes(params?: { status?: string }): Promise<Dispute[]> {
    const query = new URLSearchParams();
    if (params?.status) query.set("status", params.status);
    query.set("limit", "100");
    const res = await apiClient.get<any>(`/admin/disputes?${query.toString()}`);
    return (res.items ?? res.disputes ?? []).map(normalizeDispute);
  },

  async getDispute(disputeId: string): Promise<Dispute> {
    const res = await apiClient.get<any>(`/admin/disputes/${disputeId}`);
    return normalizeDispute(res.dispute ?? res);
  },

  async resolveDispute(
    disputeId: string,
    params: {
      resolution: "buyer" | "vendor" | "partial";
      note: string;
      refundAmount?: number;
      fraudulent?: boolean;
      twoFactorCode?: string;
    }
  ): Promise<void> {
    await apiClient.patch(
      `/admin/disputes/${disputeId}/resolve`,
      {
        resolution: params.resolution,
        note: params.note,
        refundAmount: params.refundAmount ? Math.round(params.refundAmount * 100) : undefined,
        fraudulent: params.fraudulent ?? false,
      },
      { twoFactorCode: params.twoFactorCode }
    );
  },
};
