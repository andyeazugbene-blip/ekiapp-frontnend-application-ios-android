import type { Product } from "../types/product";
import type { VendorSummary } from "../types/vendor";
import { apiClient } from "./api";

export type PublicStoreSourceKey =
  | "instagram"
  | "whatsapp"
  | "sms"
  | "direct"
  | "tiktok"
  | "more"
  | "unknown";

export type PublicStoreEvent =
  | "open"
  | "add_to_cart"
  | "start_checkout"
  | "place_order"
  | "track_order"
  | "reorder"
  | "open_in_app"
  | "save_vendor";

export type PublicOrderProgress =
  | "placed"
  | "accepted"
  | "preparing"
  | "dispatched"
  | "in_transit"
  | "delivered";

export interface PublicOrderContact {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  addressLine1: string;
  city: string;
  postcode: string;
  country: string;
}

export interface PublicOrderItemSnapshot {
  productId: string;
  name: string;
  image?: string;
  quantity: number;
  price: number;
  unitLabel?: string;
  etaLabel?: string;
}

export interface PublicStoreOrder {
  id: string;
  orderNumber: string;
  vendorId: string;
  vendorName: string;
  vendorCity: string;
  vendorSlug: string;
  currency: string;
  subtotal: number;
  delivery: number;
  platformFee: number;
  total: number;
  createdAt: string;
  estimatedDeliveryLabel: string;
  items: PublicOrderItemSnapshot[];
  contact: PublicOrderContact;
  status: PublicOrderProgress;
  source: "backend";
  backendOrderId?: string;
  backendOrderIds?: string[];
  paymentBrand?: string;
  paymentLast4?: string;
}

export interface PublicStoreAnalytics {
  storeSlug: string;
  opens: number;
  cartAdds: number;
  checkoutStarts: number;
  ordersPlaced: number;
  trackRequests: number;
  reorders: number;
  appLaunches: number;
  saveVendorCount: number;
  sourceBreakdown: Record<PublicStoreSourceKey, number>;
  sourceOrders: Record<PublicStoreSourceKey, number>;
  sourceRevenue: Record<PublicStoreSourceKey, number>;
  lastOpenedAt?: string;
  lastOrderAt?: string;
}

export interface PublicStoreEventMetadata {
  source?: string;
  productId?: string;
  productName?: string;
  quantity?: number;
  orderTotal?: number;
  orderIds?: string[];
  items?: PublicOrderItemSnapshot[];
}

export interface PublicStoreSourcePerformance {
  source: PublicStoreSourceKey;
  label: string;
  clicks: number;
  orders: number;
  revenue: number;
}

export interface PublicStoreTopProduct {
  productId: string;
  name: string;
  cartAdds: number;
  unitsSold: number;
  revenue: number;
}

export interface PublicStoreAnalyticsDetail extends PublicStoreAnalytics {
  weeklyOpens: number;
  weeklyOrders: number;
  conversionRate: number;
  totalRevenue: number;
  pendingRevenue: number;
  completedOrders: number;
  repeatRevenue: number;
  sourcePerformance: PublicStoreSourcePerformance[];
  topProducts: PublicStoreTopProduct[];
}

interface AnalyticsSummaryResponse {
  analytics?: unknown;
}

interface AnalyticsDetailResponse {
  analytics?: unknown;
}

interface LookupVerifyResponse {
  orders?: unknown[];
}

interface PublicStoreResponse {
  store?: unknown;
}

interface PublicStoreProductsResponse {
  items?: unknown[];
  nextCursor?: string | null;
}

const SOURCE_KEYS: PublicStoreSourceKey[] = [
  "instagram",
  "whatsapp",
  "sms",
  "direct",
  "tiktok",
  "more",
  "unknown",
];

function buildEmptySourceMap(): Record<PublicStoreSourceKey, number> {
  return SOURCE_KEYS.reduce((acc, key) => {
    acc[key] = 0;
    return acc;
  }, {} as Record<PublicStoreSourceKey, number>);
}

function asNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : Number(value ?? 0) || 0;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asStatus(value: unknown): PublicOrderProgress {
  const status = asString(value);
  if (
    status === "placed" ||
    status === "accepted" ||
    status === "preparing" ||
    status === "dispatched" ||
    status === "in_transit" ||
    status === "delivered"
  ) {
    return status;
  }
  return "placed";
}

function normalizeSummary(raw: unknown, storeSlug: string): PublicStoreAnalytics {
  const value = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};

  return {
    storeSlug: asString(value.storeSlug) || storeSlug,
    opens: asNumber(value.opens),
    cartAdds: asNumber(value.cartAdds),
    checkoutStarts: asNumber(value.checkoutStarts),
    ordersPlaced: asNumber(value.ordersPlaced),
    trackRequests: asNumber(value.trackRequests),
    reorders: asNumber(value.reorders),
    appLaunches: asNumber(value.appLaunches),
    saveVendorCount: asNumber(value.saveVendorCount),
    sourceBreakdown: { ...buildEmptySourceMap(), ...((value.sourceBreakdown as Record<string, number>) ?? {}) },
    sourceOrders: { ...buildEmptySourceMap(), ...((value.sourceOrders as Record<string, number>) ?? {}) },
    sourceRevenue: { ...buildEmptySourceMap(), ...((value.sourceRevenue as Record<string, number>) ?? {}) },
    lastOpenedAt: typeof value.lastOpenedAt === "string" ? value.lastOpenedAt : undefined,
    lastOrderAt: typeof value.lastOrderAt === "string" ? value.lastOrderAt : undefined,
  };
}

function normalizeDetailedAnalytics(raw: unknown, storeSlug: string): PublicStoreAnalyticsDetail {
  const value = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const summary = normalizeSummary(raw, storeSlug);

  return {
    ...summary,
    weeklyOpens: asNumber(value.weeklyOpens),
    weeklyOrders: asNumber(value.weeklyOrders),
    conversionRate: asNumber(value.conversionRate),
    totalRevenue: asNumber(value.totalRevenue),
    pendingRevenue: asNumber(value.pendingRevenue),
    completedOrders: asNumber(value.completedOrders),
    repeatRevenue: asNumber(value.repeatRevenue),
    sourcePerformance: Array.isArray(value.sourcePerformance)
      ? value.sourcePerformance.map((entry) => {
          const item = entry as Record<string, unknown>;
          return {
            source: (asString(item.source) as PublicStoreSourceKey) || "direct",
            label: asString(item.label) || "Direct",
            clicks: asNumber(item.clicks),
            orders: asNumber(item.orders),
            revenue: asNumber(item.revenue),
          };
        })
      : [],
    topProducts: Array.isArray(value.topProducts)
      ? value.topProducts.map((entry) => {
          const item = entry as Record<string, unknown>;
          return {
            productId: asString(item.productId),
            name: asString(item.name) || "Product",
            cartAdds: asNumber(item.cartAdds),
            unitsSold: asNumber(item.unitsSold),
            revenue: asNumber(item.revenue),
          };
        })
      : [],
  };
}

function normalizeOrder(raw: unknown): PublicStoreOrder {
  const value = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const contact = value.contact && typeof value.contact === "object" ? (value.contact as Record<string, unknown>) : {};

  return {
    id: asString(value.id),
    orderNumber: asString(value.orderNumber),
    vendorId: asString(value.vendorId),
    vendorName: asString(value.vendorName),
    vendorCity: asString(value.vendorCity),
    vendorSlug: asString(value.vendorSlug),
    currency: asString(value.currency) || "GBP",
    subtotal: asNumber(value.subtotal),
    delivery: asNumber(value.delivery),
    platformFee: asNumber(value.platformFee),
    total: asNumber(value.total),
    createdAt: asString(value.createdAt),
    estimatedDeliveryLabel: asString(value.estimatedDeliveryLabel) || "2-4 days",
    items: Array.isArray(value.items)
      ? value.items.map((entry) => {
          const item = entry as Record<string, unknown>;
          return {
            productId: asString(item.productId),
            name: asString(item.name),
            image: typeof item.image === "string" ? item.image : undefined,
            quantity: asNumber(item.quantity),
            price: asNumber(item.price),
            unitLabel: typeof item.unitLabel === "string" ? item.unitLabel : undefined,
            etaLabel: typeof item.etaLabel === "string" ? item.etaLabel : undefined,
          };
        })
      : [],
    contact: {
      firstName: asString(contact.firstName),
      lastName: asString(contact.lastName),
      email: asString(contact.email),
      phone: asString(contact.phone),
      addressLine1: asString(contact.addressLine1),
      city: asString(contact.city),
      postcode: asString(contact.postcode),
      country: asString(contact.country),
    },
    status: asStatus(value.status),
    source: "backend",
    backendOrderId: typeof value.backendOrderId === "string" ? value.backendOrderId : asString(value.id) || undefined,
    backendOrderIds: Array.isArray(value.backendOrderIds)
      ? value.backendOrderIds.filter((entry): entry is string => typeof entry === "string")
      : typeof value.backendOrderId === "string"
        ? [value.backendOrderId]
        : asString(value.id)
          ? [asString(value.id)]
          : undefined,
    paymentBrand: typeof value.paymentBrand === "string" ? value.paymentBrand : undefined,
    paymentLast4: typeof value.paymentLast4 === "string" ? value.paymentLast4 : undefined,
  };
}

function normalizeStore(raw: unknown): VendorSummary {
  const value = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const verificationStatus = (asString(value.verificationStatus) || "pending_docs").toLowerCase();

  return {
    id: asString(value.vendorId) || asString(value.id),
    userId: undefined,
    storeName: asString(value.storeName),
    storeSlug: asString(value.storeSlug),
    shareUrl: asString(value.shareUrl),
    ownerName: "",
    country: asString(value.country),
    city: asString(value.city),
    rating: asNumber(value.rating),
    totalProducts: asNumber(value.totalProducts),
    totalOrders: 0,
    joinedAt: asString(value.createdAt),
    coverImage: asString(value.coverImage) || undefined,
    avatar: asString(value.avatar) || undefined,
    verificationStatus:
      verificationStatus === "verified" || verificationStatus === "rejected" || verificationStatus === "pending_docs"
        ? (verificationStatus as VendorSummary["verificationStatus"])
        : "pending_docs",
    adminStatus: verificationStatus === "verified" ? "active" : "pending",
    subscriptionPlan: "free",
    description: asString(value.description) || undefined,
    deliveryCountries: Array.isArray(value.deliveryCountries)
      ? value.deliveryCountries.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
      : [],
  };
}

function normalizePublicProduct(raw: unknown): Product {
  const value = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const images = Array.isArray(value.images)
    ? value.images.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    : [];
  const stock = asNumber(value.stock);
  const priceInCents = asNumber(value.priceInCents);
  const weightGrams = asNumber(value.weightGrams);

  return {
    id: asString(value.id),
    name: asString(value.title) || asString(value.name),
    description: asString(value.description),
    price: priceInCents > 0 ? priceInCents / 100 : asNumber(value.price),
    currency: (asString(value.currency) || "GBP").toUpperCase() as Product["currency"],
    images,
    category: asString(value.category),
    vendorId: asString(value.vendorId),
    vendorUserId: undefined,
    vendorName: "",
    vendorCity: "",
    stock,
    status: stock > 0 ? "active" : "out_of_stock",
    weight: weightGrams > 0 ? weightGrams / 1000 : undefined,
    unit: undefined,
    createdAt: asString(value.createdAt),
    updatedAt: asString(value.createdAt),
  };
}

export const publicStoreService = {
  async getStore(storeSlug: string): Promise<VendorSummary> {
    const response = await apiClient.get<PublicStoreResponse>(
      `/api/public/stores/${encodeURIComponent(storeSlug)}`,
      { skipAuth: true },
    );
    return normalizeStore(response.store);
  },

  async listProducts(storeSlug: string, params?: { limit?: number; cursor?: string; category?: string }): Promise<Product[]> {
    const query = new URLSearchParams();
    if (params?.limit) query.set("limit", String(params.limit));
    if (params?.cursor) query.set("cursor", params.cursor);
    if (params?.category) query.set("category", params.category);
    const qs = query.toString();
    const response = await apiClient.get<PublicStoreProductsResponse>(
      `/api/public/stores/${encodeURIComponent(storeSlug)}/products${qs ? `?${qs}` : ""}`,
      { skipAuth: true },
    );
    return Array.isArray(response.items) ? response.items.map(normalizePublicProduct) : [];
  },

  async trackEvent(
    storeSlug: string,
    event: PublicStoreEvent,
    metadata: PublicStoreEventMetadata = {},
  ): Promise<PublicStoreAnalytics> {
    const response = await apiClient.post<AnalyticsSummaryResponse>(
      `/api/public/stores/${encodeURIComponent(storeSlug)}/events`,
      {
        event,
        ...metadata,
      },
      { skipAuth: true },
    );

    return normalizeSummary(response.analytics, storeSlug);
  },

  async getDetailedAnalytics(storeSlug: string): Promise<PublicStoreAnalyticsDetail> {
    const response = await apiClient.get<AnalyticsDetailResponse>(
      `/api/vendors/me/public-store-analytics?storeSlug=${encodeURIComponent(storeSlug)}`,
    );
    return normalizeDetailedAnalytics(response.analytics, storeSlug);
  },

  async requestLookupCode(storeSlug: string, email: string): Promise<void> {
    await apiClient.post(
      `/api/public/stores/${encodeURIComponent(storeSlug)}/order-lookup/request`,
      { email: email.trim().toLowerCase() },
      { skipAuth: true },
    );
  },

  async verifyLookupCode(storeSlug: string, email: string, code: string): Promise<PublicStoreOrder[]> {
    const response = await apiClient.post<LookupVerifyResponse>(
      `/api/public/stores/${encodeURIComponent(storeSlug)}/order-lookup/verify`,
      {
        email: email.trim().toLowerCase(),
        code: code.trim(),
      },
      { skipAuth: true },
    );

    return Array.isArray(response.orders) ? response.orders.map(normalizeOrder) : [];
  },
};
