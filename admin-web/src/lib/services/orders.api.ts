import { apiClient } from "../api";
import { Order, OrderStatus } from "@/types";

function centsToUnit(value: unknown): number {
  return typeof value === "number" ? value / 100 : 0;
}

function normalizeOrderStatus(status: string): OrderStatus {
  const s = status.toUpperCase();
  if (s === "PENDING_PAYMENT" || s === "PENDING") return "pending";
  if (s === "CONFIRMED" || s === "PROCESSING") return "confirmed";
  if (s === "SHIPPED" || s === "IN_TRANSIT") return "shipped";
  if (s === "DELIVERED") return "delivered"; if (s === "COMPLETED") return "completed";
  if (s === "CANCELLED") return "cancelled";
  if (s === "REFUNDED") return "refunded";
  return "pending";
}

function toBackendOrderStatus(status: OrderStatus): string {
  const map: Record<OrderStatus, string> = {
    pending: "PENDING_PAYMENT",
    confirmed: "CONFIRMED",
    shipped: "SHIPPED",
    delivered: "DELIVERED",
    completed: "COMPLETED",
    cancelled: "CANCELLED",
    refunded: "REFUNDED",
  };
  return map[status] || "PENDING_PAYMENT";
}

function normalizeOrder(raw: any): Order {
  return {
    id: raw.id,
    orderNumber: raw.orderNumber ?? `ORD-${raw.id.slice(0, 8)}`,
    buyerId: raw.buyerId ?? "",
    buyerName: raw.buyer?.name ?? "",
    vendorId: raw.vendorId ?? "",
    vendorName: raw.vendor?.storeName ?? "",
    totalAmount: centsToUnit(raw.totalAmount),
    currency: (raw.currency ?? "GBP").toUpperCase(),
    status: normalizeOrderStatus(raw.status ?? "PENDING"),
    paymentStatus: raw.paymentStatus,
    createdAt: raw.createdAt ?? "",
    items: (raw.items ?? []).map((item: any) => ({
      id: item.id,
      productTitle: item.productTitle ?? item.product?.title ?? "",
      quantity: item.quantity ?? 0,
      price: centsToUnit(item.price),
      totalAmount: centsToUnit(item.totalAmount),
    })),
  };
}

export const ordersAPI = {
  async getOrders(params?: { status?: OrderStatus; limit?: number }): Promise<Order[]> {
    const query = new URLSearchParams();
    if (params?.status) query.set("status", toBackendOrderStatus(params.status));
    query.set("limit", String(params?.limit ?? 100));
    const res = await apiClient.get<any>(`/admin/orders?${query.toString()}`);
    return (res.items ?? res.orders ?? []).map(normalizeOrder);
  },

  async getOrder(orderId: string): Promise<any> {
    const res = await apiClient.get<any>(`/admin/orders/${orderId}`);
    const raw = res.order ?? res;
    return {
      ...raw,
      totalAmount: centsToUnit(raw.totalAmount),
      subtotalAmount: centsToUnit(raw.subtotalAmount),
      deliveryFeeAmount: centsToUnit(raw.deliveryFeeAmount),
      platformFeeAmount: centsToUnit(raw.platformFeeAmount),
      vendorEarnings: centsToUnit(raw.vendorEarnings),
      vendorName: raw.vendorName ?? raw.vendor?.storeName ?? "",
      buyerName: raw.buyer?.name ?? "",
      currency: (raw.currency ?? "GBP").toUpperCase(),
      status: normalizeOrderStatus(raw.status ?? "PENDING"),
      items: (raw.items ?? []).map((item: any) => ({
        ...item,
        unitAmount: centsToUnit(item.unitAmount ?? item.product?.priceInCents),
        totalAmount: centsToUnit(item.totalAmount),
      })),
      payment: raw.payment ? {
        ...raw.payment,
        amount: centsToUnit(raw.payment.amount),
        platformFeeAmount: centsToUnit(raw.payment.platformFeeAmount),
        vendorEarningsAmount: centsToUnit(raw.payment.vendorEarningsAmount),
      } : undefined,
    };
  },

  async preloadOrder(orderId: string): Promise<void> {
    await apiClient.prefetch(`/admin/orders/${orderId}`);
  },

  async completeOrder(orderId: string): Promise<void> {
    await apiClient.patch(`/admin/orders/${orderId}/complete`, {});
  },

  async forceProcessOrder(orderId: string): Promise<any> {
    return apiClient.post(`/admin/orders/${orderId}/force-process`, {});
  },

  async refundOrder(
    orderId: string,
    params: { amount?: number; reason: string; twoFactorCode?: string }
  ): Promise<void> {
    await apiClient.post(
      `/admin/orders/${orderId}/refund`,
      {
        amount: params.amount ? Math.round(params.amount * 100) : undefined,
        reason: params.reason,
      },
      { twoFactorCode: params.twoFactorCode }
    );
  },
};
