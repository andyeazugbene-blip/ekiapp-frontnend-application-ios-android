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
    joinedAt: raw.joinedAt ?? raw.createdAt,
  };
}

export const buyerService = {
  async listMyBuyers(search?: string): Promise<VendorBuyerSummary[]> {
    const query = search ? `?search=${encodeURIComponent(search)}` : "";
    const res = await apiClient.get<VendorBuyerListResponse>(`/api/vendors/me/buyers${query}`);
    return (res.buyers ?? res.items ?? []).map(normalizeBuyer);
  },

  async getBuyer(buyerId: string): Promise<VendorBuyerProfile> {
    const res = await apiClient.get<VendorBuyerProfileResponse>(
      `/api/vendors/me/buyers/${encodeURIComponent(buyerId)}`,
    );
    return {
      ...normalizeBuyer(res.buyer),
      topProductName: res.buyer.topProductName ?? res.buyer.topProducts?.[0]?.productTitle,
      recentOrders: normalizeOrders(res.buyer.recentOrders ?? []),
    };
  },
};
