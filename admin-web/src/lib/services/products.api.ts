import { apiClient } from "../api";

export type ProductStatus = "ACTIVE" | "DISABLED" | "DRAFT";
export type ProductType = "STANDARD" | "COMMUNITY_BUY" | "REGULAR_DELIVERY";

/** Customer-facing name for the internal REGULAR_DELIVERY type. */
export const PRODUCT_TYPE_LABEL: Record<ProductType, string> = {
  STANDARD: "Standard",
  COMMUNITY_BUY: "Community Buy",
  REGULAR_DELIVERY: "Foodstuffs Subscription",
};

export interface SellerReadiness {
  ready: boolean;
  reason: string | null;
  message: string | null;
  gateEnabled: boolean;
}

export interface AdminProductRow {
  id: string;
  productCode: string | null;
  title: string;
  image: string | null;
  vendorId: string;
  vendorName: string | null;
  vendorUserId: string | null;
  category: string | null;
  productType: ProductType;
  /** Minor units, ORIGINAL currency. */
  priceInCents: number;
  currency: string;
  stock: number;
  isActive: boolean;
  status: ProductStatus;
  createdAt: string;
  updatedAt: string;
  sellerReadiness: SellerReadiness | null;
  notPurchasableReason: string | null;
}

export interface AdminProductList {
  items: AdminProductRow[];
  nextCursor: string | null;
  counts: { active: number; disabled: number; draft: number; total: number };
  categories: string[];
}

export interface AdminProductZone {
  id: string;
  name: string;
  country: string;
  currency: string;
  baseFeeAmount: number;
  feePerKgAmount: number;
  scope: "VENDOR" | "MARKET";
  deliveryMethods: Array<{ id: string; label: string; priceAmount: number; minDays: number; maxDays: number }>;
}

export interface AdminProductDetail {
  id: string;
  productCode: string | null;
  title: string;
  description: string | null;
  priceInCents: number;
  currency: string;
  images: string[];
  category: string | null;
  stock: number;
  weightGrams: number | null;
  isActive: boolean;
  status: ProductStatus;
  productType: ProductType;
  createdAt: string;
  updatedAt: string;
  adminUnpublishedAt: string | null;
  adminUnpublishedReason: string | null;
  unpublishedBy: { id: string; name: string | null; email: string | null } | null;
  vendorName: string | null;
  vendor: {
    id: string;
    storeName: string;
    userId: string;
    country: string | null;
    city: string | null;
    contactEmail: string | null;
    currency: string;
    verificationStatus: "PENDING" | "VERIFIED" | "REJECTED";
    isSuspended: boolean;
    closedAt: string | null;
    stripeAccountId: string | null;
    stripeChargesEnabled: boolean;
    stripePayoutsEnabled: boolean;
    stripeAccountStatus: string | null;
  } | null;
  sellerReadiness: SellerReadiness | null;
  unitSize: string | null;
  packSize: string | null;
  minimumQuantity: number | null;
  deliveryZones: AdminProductZone[];
  deliveryMethods: Array<{ id: string; label: string; priceAmount: number; minDays: number; maxDays: number; zoneName: string; zoneCountry: string }>;
  completeness: { hasImage: boolean; priceOk: boolean };
  publicStoreUrl: string | null;
  orderItems: Array<{ id: string; quantity: number; totalAmount: number; orderId: string }>;
}

export interface ProductListParams {
  q?: string;
  status?: string;
  category?: string;
  productType?: string;
  cursor?: string | null;
  limit?: number;
}

export const productsAPI = {
  async list(params: ProductListParams): Promise<AdminProductList> {
    const qs = new URLSearchParams();
    if (params.q) qs.set("q", params.q);
    if (params.status) qs.set("status", params.status);
    if (params.category) qs.set("category", params.category);
    if (params.productType) qs.set("productType", params.productType);
    if (params.cursor) qs.set("cursor", params.cursor);
    qs.set("limit", String(params.limit ?? 20));
    return apiClient.get<AdminProductList>(`/admin/products?${qs.toString()}`, { bypassCache: true });
  },

  async getProduct(productId: string): Promise<AdminProductDetail> {
    const res = await apiClient.get<{ product: AdminProductDetail }>(`/admin/products/${productId}`, { bypassCache: true });
    return res.product;
  },

  async unpublish(productId: string, reason: string): Promise<AdminProductDetail> {
    const res = await apiClient.post<{ product: AdminProductDetail }>(`/admin/products/${productId}/unpublish`, { reason });
    return res.product;
  },

  async restore(productId: string, reason: string): Promise<AdminProductDetail> {
    const res = await apiClient.post<{ product: AdminProductDetail }>(`/admin/products/${productId}/restore`, { reason });
    return res.product;
  },

  async preloadProduct(productId: string): Promise<void> {
    await apiClient.prefetch(`/admin/products/${productId}`);
  },
};
