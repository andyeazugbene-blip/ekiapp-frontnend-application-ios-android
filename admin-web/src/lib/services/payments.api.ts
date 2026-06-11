import { apiClient } from "../api";

export interface AdminPayment {
  id: string;
  orderId: string;
  orderNumber: string;
  buyerName: string;
  vendorName: string;
  amount: number;
  currency: string;
  status: string;
  method: string;
  createdAt: string;
}

function centsToUnit(value: unknown): number {
  return typeof value === "number" ? value / 100 : 0;
}

function normalizePayment(raw: any): AdminPayment {
  return {
    id: raw.id,
    orderId: raw.orderId ?? "",
    orderNumber: raw.order?.orderNumber ?? `ORD-${(raw.orderId ?? "").slice(0, 8)}`,
    buyerName: raw.order?.buyer?.name ?? raw.buyerName ?? "",
    vendorName: raw.order?.vendor?.storeName ?? raw.vendorName ?? "",
    amount: centsToUnit(raw.amount),
    currency: (raw.currency ?? "GBP").toUpperCase(),
    status: (raw.status ?? "PENDING").toString(),
    method: raw.method ?? raw.paymentMethod ?? "card",
    createdAt: raw.createdAt ?? "",
  };
}

export const paymentsAPI = {
  async getPayments(params?: { status?: string; limit?: number }): Promise<AdminPayment[]> {
    const query = new URLSearchParams();
    if (params?.status) query.set("status", params.status);
    query.set("limit", String(params?.limit ?? 100));
    const res = await apiClient.get<any>(`/admin/payments?${query.toString()}`);
    return (res.items ?? res.payments ?? []).map(normalizePayment);
  },
};
