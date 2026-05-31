/**
 * Order and shipment service.
 *
 * This file is intentionally API-only: order screens must reflect the backend
 * state, not seeded local examples.
 */
import { Order, OrderStatus, PayoutMode, VendorEarnings } from "../types/order";
import { apiClient } from "./api";
import {
  normalizeDashboardEarnings,
  normalizeOrder,
  normalizeOrders,
  toBackendOrderStatus,
} from "./api/normalizers";

interface OrderListResponse {
  items?: Record<string, any>[];
  orders?: Record<string, any>[];
  nextCursor?: string | null;
  total?: number;
}

interface OrderResponse {
  order: Record<string, any>;
}

export interface Shipment {
  id: string;
  orderId: string;
  orderNumber: string;
  carrier?: string;
  trackingNumber?: string;
  status: "processing" | "shipped" | "in_transit" | "delivered" | "delayed";
  estimatedDelivery?: string;
  events: ShipmentEvent[];
  createdAt: string;
  updatedAt: string;
}

export interface ShipmentEvent {
  status: string;
  description: string;
  timestamp: string;
  location?: string;
}

interface ShipmentResponse {
  shipment: Shipment;
}

interface ShipmentListResponse {
  shipments?: Shipment[];
  items?: Shipment[];
}

export interface ConfirmDeliveryResponse {
  confirmed: boolean;
}

export interface OpenDisputeResponse {
  disputeId: string;
}

export interface VendorEscrowDispatchResponse {
  status: string;
  deliveryCode: string;
  expiresAt: string;
}

function orderItems(response: OrderListResponse): Record<string, any>[] {
  return response.items ?? response.orders ?? [];
}

async function findAdminOrderById(id: string): Promise<Order> {
  const response = await apiClient.get<OrderListResponse>("/api/admin/orders?limit=100");
  const raw = orderItems(response).find((item) => item.id === id || item.orderNumber === id);
  if (!raw) {
    throw new Error("Order not found");
  }
  return normalizeOrder(raw);
}

export const orderService = {
  async getBuyerOrders(_buyerId?: string): Promise<Order[]> {
    const response = await apiClient.get<OrderListResponse>("/api/orders/me");
    return normalizeOrders(orderItems(response));
  },

  async getBuyerOrderById(orderId: string): Promise<Order> {
    const response = await apiClient.get<OrderResponse>(`/api/orders/${orderId}`);
    return normalizeOrder(response.order);
  },

  async getVendorOrders(_vendorId?: string, status?: OrderStatus): Promise<Order[]> {
    const query = new URLSearchParams();
    if (status) query.set("status", toBackendOrderStatus(status));
    const qs = query.toString();
    const response = await apiClient.get<OrderListResponse>(`/api/vendors/me/orders${qs ? `?${qs}` : ""}`);
    return normalizeOrders(orderItems(response));
  },

  async getVendorOrderById(orderId: string): Promise<Order> {
    const response = await apiClient.get<OrderResponse>(`/api/vendors/me/orders/${orderId}`);
    return normalizeOrder(response.order);
  },

  async updateOrderStatus(
    orderId: string,
    status: OrderStatus,
    meta?: { carrier?: string; trackingNumber?: string },
  ): Promise<Order> {
    const response = await apiClient.patch<OrderResponse>(
      `/api/vendors/me/orders/${orderId}/status`,
      { status: toBackendOrderStatus(status), ...meta },
    );
    return normalizeOrder(response.order);
  },

  async confirmBuyerDelivery(orderId: string, code: string): Promise<ConfirmDeliveryResponse> {
    return apiClient.post<ConfirmDeliveryResponse>(`/api/orders/${orderId}/confirm-delivery`, { code });
  },

  async openBuyerDispute(orderId: string, reason: string): Promise<OpenDisputeResponse> {
    return apiClient.post<OpenDisputeResponse>(`/api/orders/${orderId}/dispute`, { reason });
  },

  async confirmVendorEscrowOrder(orderId: string): Promise<{ status: string }> {
    return apiClient.post<{ status: string }>(`/api/vendors/me/orders/${orderId}/confirm-escrow`, {});
  },

  async dispatchVendorEscrowOrder(orderId: string): Promise<VendorEscrowDispatchResponse> {
    return apiClient.post<VendorEscrowDispatchResponse>(`/api/vendors/me/orders/${orderId}/dispatch`, {});
  },

  async getAllOrders(params?: { status?: OrderStatus; page?: number }): Promise<Order[]> {
    const query = new URLSearchParams();
    if (params?.status) query.set("status", toBackendOrderStatus(params.status));
    query.set("limit", "100");
    const response = await apiClient.get<OrderListResponse>(`/api/admin/orders?${query.toString()}`);
    return normalizeOrders(orderItems(response));
  },

  async getOrderById(id: string): Promise<Order> {
    try {
      const response = await apiClient.get<OrderResponse>(`/api/orders/${id}`);
      return normalizeOrder(response.order);
    } catch (error) {
      try {
        return await findAdminOrderById(id);
      } catch {
        throw error;
      }
    }
  },

  async getShipmentByOrder(orderId: string): Promise<Shipment | null> {
    try {
      const response = await apiClient.get<ShipmentResponse>(`/api/shipments/orders/${orderId}`);
      return response.shipment;
    } catch {
      return null;
    }
  },

  async getVendorShipments(): Promise<Shipment[]> {
    const response = await apiClient.get<ShipmentListResponse>("/api/shipments");
    return response.shipments ?? response.items ?? [];
  },

  async createShipment(orderId: string, data: { carrier?: string; trackingNumber?: string }): Promise<Shipment> {
    const response = await apiClient.post<ShipmentResponse>(`/api/shipments/orders/${orderId}`, data);
    return response.shipment;
  },

  async updateShipment(shipmentId: string, data: Partial<Shipment>): Promise<Shipment> {
    const response = await apiClient.patch<ShipmentResponse>(`/api/shipments/${shipmentId}`, data);
    return response.shipment;
  },

  async getVendorEarnings(_vendorId: string): Promise<VendorEarnings> {
    const raw = await apiClient.get<any>("/api/vendors/me/earnings");
    const normalized = normalizeDashboardEarnings(raw);
    return {
      totalEarnings: (raw.totalEarnings ?? 0) / 100,
      pendingPayout: normalized.pendingPayout,
      pendingPayoutNgn: normalized.pendingPayoutNgn,
      salesToday: normalized.salesToday,
      salesTodayNgn: normalized.salesTodayNgn,
      salesThisWeek: normalized.salesThisWeek,
      salesThisWeekNgn: normalized.salesThisWeekNgn,
      salesThisMonth: normalized.salesThisMonth,
      salesThisMonthNgn: normalized.salesThisMonthNgn,
      currency: normalized.currency,
      localCurrency: "NGN",
      localRate: 1500,
      payoutMode: raw.payoutMode ?? "per_order",
      recentPayouts: (raw.recentPayouts ?? []).map((p: any) => ({
        id: p.id,
        vendorId: p.vendorId ?? "",
        amount: (p.amount ?? 0) / 100,
        currency: (p.currency ?? "GBP").toUpperCase(),
        status: (p.status ?? "pending").toLowerCase(),
        orderNumber: p.orderNumber ?? "",
        createdAt: p.createdAt ?? "",
      })),
    } as VendorEarnings;
  },

  async updatePayoutMode(_vendorId: string, mode: PayoutMode) {
    return apiClient.patch<{ vendorId: string; payoutMode: PayoutMode }>("/api/vendors/me/payout-mode", { mode });
  },
};
