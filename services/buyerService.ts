/**
 * Buyer service for the current vendor's buyer list and buyer profile.
 */
import { Order } from "../types/order";
import { apiClient } from "./api";
import { normalizeOrders } from "./api/normalizers";

export interface VendorBuyerSummary {
  id: string;
  name: string;
  email?: string;
  avatar?: string;
  country: string;
  totalOrders: number;
  totalSpent: number;
  currency: string;
  lastOrderAt: string | null;
  lastOrderId?: string;
  joinedAt?: string;
}

export interface VendorBuyerProfile extends VendorBuyerSummary {
  topProductName?: string;
  recentOrders: Order[];
}

interface VendorBuyerListResponse {
  buyers?: any[];
  items?: any[];
}

interface VendorBuyerProfileResponse {
  buyer: any;
}

interface VendorOrdersResponse {
  items?: any[];
  orders?: any[];
}

function normalizeBuyer(raw: any): VendorBuyerSummary {
  return {
    id: raw.id ?? raw.buyerId ?? "",
    name: raw.name ?? "",
    email: raw.email,
    avatar: raw.avatar,
    country: raw.country ?? "",
    totalOrders: raw.totalOrders ?? 0,
    totalSpent: typeof raw.totalSpent === "number" ? raw.totalSpent / 100 : 0,
    currency: (raw.currency ?? "GBP").toUpperCase(),
    lastOrderAt: raw.lastOrderAt ?? raw.lastOrder ?? null,
    lastOrderId: raw.lastOrderId ?? raw.lastOrder?.id ?? undefined,
    joinedAt: raw.joinedAt ?? raw.createdAt,
  };
}

function aggregateBuyersFromOrders(rawOrders: any[]): VendorBuyerSummary[] {
  const buyerMap = new Map<string, VendorBuyerSummary>();
  const orders = normalizeOrders(rawOrders ?? []);

  for (const order of orders) {
    if (!order.buyerId) continue;

    const existing = buyerMap.get(order.buyerId);
    const totalOrders = (existing?.totalOrders ?? 0) + 1;
    const totalSpent = (existing?.totalSpent ?? 0) + Number(order.total ?? 0);
    const lastOrderAt = !existing?.lastOrderAt
      ? order.createdAt
      : new Date(order.createdAt) > new Date(existing.lastOrderAt)
      ? order.createdAt
      : existing.lastOrderAt;

    buyerMap.set(order.buyerId, {
      id: order.buyerId,
      name: order.buyerName || existing?.name || "Buyer",
      email: existing?.email,
      avatar: existing?.avatar,
      country: order.deliveryDetails?.country || existing?.country || "",
      totalOrders,
      totalSpent,
      currency: order.currency || existing?.currency || "GBP",
      lastOrderAt,
      lastOrderId: order.id,
      joinedAt: existing?.joinedAt || order.createdAt,
    });
  }

  return [...buyerMap.values()].sort((left, right) => {
    const leftTime = left.lastOrderAt ? new Date(left.lastOrderAt).getTime() : 0;
    const rightTime = right.lastOrderAt ? new Date(right.lastOrderAt).getTime() : 0;
    return rightTime - leftTime;
  });
}

export const buyerService = {
  async listMyBuyers(search?: string): Promise<VendorBuyerSummary[]> {
    const query = search ? `?search=${encodeURIComponent(search)}` : "";
    try {
      const res = await apiClient.get<VendorBuyerListResponse>(`/api/vendors/me/buyers${query}`);
      return (res.buyers ?? res.items ?? []).map(normalizeBuyer);
    } catch {
      const fallback = await apiClient.get<VendorOrdersResponse>("/api/vendors/me/orders");
      const buyers = aggregateBuyersFromOrders(fallback.items ?? fallback.orders ?? []);
      if (!search) return buyers;

      const term = search.trim().toLowerCase();
      return buyers.filter((buyer) =>
        buyer.name.toLowerCase().includes(term) ||
        (buyer.email ?? "").toLowerCase().includes(term) ||
        buyer.country.toLowerCase().includes(term),
      );
    }
  },

  async getBuyer(buyerId: string): Promise<VendorBuyerProfile> {
    try {
      const res = await apiClient.get<VendorBuyerProfileResponse>(
        `/api/vendors/me/buyers/${encodeURIComponent(buyerId)}`,
      );
      return {
        ...normalizeBuyer(res.buyer),
        topProductName: res.buyer.topProductName ?? res.buyer.topProducts?.[0]?.productTitle,
        recentOrders: normalizeOrders(res.buyer.recentOrders ?? []),
      };
    } catch {
      const fallback = await apiClient.get<VendorOrdersResponse>("/api/vendors/me/orders");
      const recentOrders = normalizeOrders(fallback.items ?? fallback.orders ?? []).filter(
        (order) => order.buyerId === buyerId,
      );

      if (recentOrders.length === 0) {
        throw new Error("Buyer not found");
      }

      const summaries = aggregateBuyersFromOrders(fallback.items ?? fallback.orders ?? []);
      const summary = summaries.find((buyer) => buyer.id === buyerId);

      if (!summary) {
        throw new Error("Buyer not found");
      }

      const productTotals = new Map<string, number>();
      for (const order of recentOrders) {
        for (const item of order.items ?? []) {
          const key = item.product.name || item.product.id;
          productTotals.set(key, (productTotals.get(key) ?? 0) + item.quantity);
        }
      }

      const topProductName = [...productTotals.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];

      return {
        ...summary,
        topProductName,
        recentOrders,
      };
    }
  },
};
