/**
 * Data Normalizers
 * Convert backend Prisma model shapes → frontend-friendly types.
 *
 * Backend realities (from schema.prisma):
 * - All money is stored as integer CENTS (priceInCents, subtotalAmount, totalAmount, etc.)
 * - Product uses `title` not `name`, `priceInCents` not `price`, `weightGrams` not `weight`
 * - Order.status is UPPERCASE enum: PENDING, PAID, CONFIRMED, PROCESSING, …
 * - List endpoints return { items: T[], nextCursor: string | null }
 * - currency values are lowercase: "usd", "gbp"
 */

import type { Product, ProductStatus } from "../../types/product";
import type { Order, OrderStatus } from "../../types/order";

// ─── Constants ─────────────────────────────────────────────────────────────────

/** Approximate NGN/GBP rate used for local currency display */
const NGN_RATE = 1500;

// ─── Helpers ───────────────────────────────────────────────────────────────────

function centsToUnit(cents: number | undefined | null): number {
  return typeof cents === "number" ? cents / 100 : 0;
}

function isoString(v: Date | string | undefined | null): string {
  if (!v) return new Date().toISOString();
  return v instanceof Date ? v.toISOString() : v;
}

// ─── Product ───────────────────────────────────────────────────────────────────

/**
 * Map backend Product (Prisma) → frontend Product type.
 */
export function normalizeProduct(raw: Record<string, any>): Product {
  const priceGBP = centsToUnit(raw.priceInCents ?? raw.price);

  let status: ProductStatus = "active";
  if (raw.isActive === false) {
    status = "out_of_stock";
  } else if ((raw.stock ?? 0) <= 0) {
    status = "out_of_stock";
  } else if ((raw.stock ?? 0) <= 5) {
    status = "low_stock";
  }

  return {
    id: raw.id ?? "",
    name: raw.title ?? raw.name ?? "",
    description: raw.description ?? "",
    price: priceGBP,
    currency: (raw.currency?.toUpperCase() ?? "GBP") as Product["currency"],
    images: raw.images ?? [],
    category: raw.category ?? "",
    vendorId: raw.vendorId ?? "",
    vendorName: raw.vendor?.storeName ?? raw.vendorName ?? "",
    vendorCity: raw.vendor?.city ?? raw.vendorCity ?? "",
    stock: raw.stock ?? 0,
    status,
    weight:
      typeof raw.weightGrams === "number"
        ? raw.weightGrams / 1000
        : raw.weight,
    unit: raw.unit,
    createdAt: isoString(raw.createdAt),
    updatedAt: isoString(raw.updatedAt),
  };
}

export function normalizeProducts(items: Record<string, any>[]): Product[] {
  return items.map(normalizeProduct);
}

/**
 * Convert frontend Product create payload → backend CreateProductInput.
 * price (GBP float) → priceAmount (integer cents)
 * name → title
 * weight (kg) → weightGrams (integer grams)
 */
export function toBackendProductInput(
  data: Partial<Product> & { priceAmount?: number }
): Record<string, any> {
  const out: Record<string, any> = {};

  if (data.name !== undefined) out.title = data.name;
  if (data.description !== undefined) out.description = data.description;
  if (data.price !== undefined) out.priceAmount = Math.round(data.price * 100);
  if ((data as any).priceAmount !== undefined)
    out.priceAmount = (data as any).priceAmount;
  if (data.currency !== undefined) out.currency = data.currency.toLowerCase();
  if (data.images !== undefined) out.images = data.images;
  if (data.category !== undefined) out.category = data.category;
  if (data.stock !== undefined) out.stock = data.stock;
  if (data.weight !== undefined)
    out.weightGrams = Math.round((data.weight as number) * 1000);

  return out;
}

// ─── Order ─────────────────────────────────────────────────────────────────────

const STATUS_MAP: Record<string, OrderStatus> = {
  PENDING: "pending",
  PAID: "pending",       // PAID = payment received but not confirmed yet
  CONFIRMED: "confirmed",
  PROCESSING: "processing",
  DISPATCHED: "dispatched",
  IN_TRANSIT: "in_transit",
  DELIVERED: "delivered",
  COMPLETED: "delivered",
  PAYMENT_SECURED: "pending",
  VENDOR_CONFIRMED: "confirmed",
  DISPUTED: "disputed",
  AUTO_RELEASED: "delivered",
  CANCELLED: "cancelled",
  REFUNDED: "refunded",
  FAILED: "cancelled",
};

const STATUS_MAP_REVERSE: Record<OrderStatus, string> = {
  pending: "PENDING",
  confirmed: "CONFIRMED",
  processing: "PROCESSING",
  dispatched: "DISPATCHED",
  in_transit: "IN_TRANSIT",
  delivered: "DELIVERED",
  disputed: "DISPUTED",
  cancelled: "CANCELLED",
  refunded: "REFUNDED",
};

export function normalizeOrderStatus(status: string): OrderStatus {
  return STATUS_MAP[status?.toUpperCase()] ?? "pending";
}

export function toBackendOrderStatus(status: OrderStatus): string {
  return STATUS_MAP_REVERSE[status] ?? status.toUpperCase();
}

export function normalizeOrder(raw: Record<string, any>): Order {
  const items = (raw.items ?? []).map((item: Record<string, any>) => {
    const product: Product = item.product
      ? normalizeProduct(item.product)
      : {
          id: item.productId ?? "",
          name: item.productTitle ?? "",
          description: "",
          price: centsToUnit(item.unitAmount),
          currency: ((item.currency ?? "GBP").toUpperCase()) as Product["currency"],
          images: [],
          category: "",
          vendorId: item.vendorId ?? "",
          vendorName: "",
          vendorCity: "",
          stock: 0,
          status: "active",
          createdAt: "",
          updatedAt: "",
        };
    return { product, quantity: item.quantity ?? 1 };
  });

  const providerFromPayment = typeof raw.payment?.provider === "string" ? raw.payment.provider : undefined;
  const inferredProvider =
    providerFromPayment
      ?? (raw.escrowType === "DOMESTIC_AFRICA"
        ? "paystack"
        : raw.payment?.stripePaymentIntentId
        ? "stripe"
        : raw.payment?.status === "SUCCEEDED"
        ? "wallet"
        : undefined);

  const deliveryCountry = (raw.deliveryZone?.country ?? raw.deliveryCountry ?? "UK") as Order["deliveryDetails"]["country"];
  const paymentStatus =
    raw.status === "REFUNDED"
      ? "refunded"
      : raw.payment?.status === "SUCCEEDED"
      ? "paid"
      : raw.payment?.status === "FAILED"
      ? "failed"
      : "pending";

  return {
    id: raw.id ?? "",
    orderNumber: raw.orderNumber ?? `EKI-${(raw.id ?? "").slice(-6).toUpperCase()}`,
    buyerId: raw.buyerId ?? "",
    buyerName: raw.buyer?.name ?? raw.buyerName ?? "",
    vendorId: raw.items?.[0]?.vendorId ?? raw.vendorId ?? "",
    vendorName: raw.vendorName ?? raw.vendor?.storeName ?? raw.items?.[0]?.vendor?.storeName ?? "",
    items,
    subtotal: centsToUnit(raw.subtotalAmount ?? raw.subtotal),
    deliveryCost: centsToUnit(raw.deliveryFeeAmount ?? raw.deliveryCost),
    total: centsToUnit(raw.totalAmount ?? raw.total),
    currency: ((raw.currency ?? "GBP").toUpperCase()) as Order["currency"],
    status: normalizeOrderStatus(raw.status),
    backendStatus: raw.status ?? undefined,
    paymentStatus,
    paymentProvider: inferredProvider,
    paymentReference: raw.paystackTransaction?.reference ?? raw.payment?.stripePaymentIntentId ?? undefined,
    escrowType: raw.escrowType ? raw.escrowType.toLowerCase() : "none",
    escrowExpiresAt: raw.escrowExpiresAt ? isoString(raw.escrowExpiresAt) : undefined,
    vendorConfirmedAt: raw.vendorConfirmedAt ? isoString(raw.vendorConfirmedAt) : undefined,
    disputedAt: raw.disputedAt ? isoString(raw.disputedAt) : undefined,
    autoReleasedAt: raw.autoReleasedAt ? isoString(raw.autoReleasedAt) : undefined,
    platformFee: centsToUnit(raw.platformFeeAmount),
    vendorEarnings: centsToUnit(raw.vendorEarnings),
    deliveryDetails: {
      recipientName: raw.buyer?.name ?? "",
      address: raw.deliveryAddress ?? raw.deliveryZone?.name ?? "",
      city: "",
      country: deliveryCountry,
      postalCode: "",
      phone: "",
      estimatedDays: "",
      deliveryCost: centsToUnit(raw.deliveryFeeAmount ?? raw.deliveryCost),
      totalWeight: 0,
    },
    deliveryAddress: raw.deliveryAddress ?? undefined,
    dispute: raw.dispute
      ? {
          id: raw.dispute.id ?? "",
          status: raw.dispute.status ?? "",
          reason: raw.dispute.reason ?? undefined,
          resolution: raw.dispute.resolution ?? undefined,
          refundAmount: centsToUnit(raw.dispute.refundAmount),
          resolvedAt: raw.dispute.resolvedAt ? isoString(raw.dispute.resolvedAt) : undefined,
        }
      : null,
    notes: raw.notes,
    createdAt: isoString(raw.createdAt),
    updatedAt: isoString(raw.updatedAt),
    deliveredAt: raw.deliveredAt ? isoString(raw.deliveredAt) : undefined,
  };
}

export function normalizeOrders(items: Record<string, any>[]): Order[] {
  return items.map(normalizeOrder);
}

// ─── Vendor Dashboard ──────────────────────────────────────────────────────────

/**
 * Backend dashboard earnings are in cents.
 * Frontend expects GBP pounds + optional NGN equivalent.
 */
export function normalizeDashboardEarnings(raw: {
  salesToday?: number;
  salesThisWeek?: number;
  salesThisMonth?: number;
  pendingPayout?: number;
  availableBalance?: number;
  currency?: string;
}) {
  const salesToday = centsToUnit(raw.salesToday);
  const salesThisWeek = centsToUnit(raw.salesThisWeek);
  const salesThisMonth = centsToUnit(raw.salesThisMonth);
  const pendingPayout = centsToUnit(raw.pendingPayout);

  return {
    salesToday,
    salesTodayNgn: Math.round(salesToday * NGN_RATE),
    salesThisWeek,
    salesThisWeekNgn: Math.round(salesThisWeek * NGN_RATE),
    salesThisMonth,
    salesThisMonthNgn: Math.round(salesThisMonth * NGN_RATE),
    pendingPayout,
    pendingPayoutNgn: Math.round(pendingPayout * NGN_RATE),
    currency: (raw.currency ?? "GBP").toUpperCase(),
    availableBalance: centsToUnit(raw.availableBalance),
  };
}

// ─── Upload ────────────────────────────────────────────────────────────────────

const FOLDER_TO_CATEGORY: Record<string, string> = {
  products: "product",
  product: "product",
  avatars: "avatar",
  avatar: "avatar",
  stores: "cover",
  cover: "cover",
  store: "cover",
  verification: "verification",
};

/**
 * Map frontend folder strings to the backend's allowed category values:
 * "product" | "avatar" | "cover" | "verification"
 */
export function mapUploadCategory(folder: string): string {
  return FOLDER_TO_CATEGORY[folder?.toLowerCase()] ?? "product";
}

// ─── Payout ────────────────────────────────────────────────────────────────────

export function normalizePayoutRequest(raw: Record<string, any>) {
  const backendStatus = (raw.status ?? "PENDING").toString().toUpperCase();
  const status =
    backendStatus === "PAID"
      ? "paid"
      : backendStatus === "APPROVED"
        ? "processing"
        : backendStatus === "REJECTED"
          ? "failed"
          : "pending";

  return {
    id: raw.id ?? "",
    amount: centsToUnit(raw.amount),
    currency: (raw.currency ?? "GBP").toUpperCase(),
    status,
    method: raw.payoutMethod?.type ?? raw.method ?? "",
    createdAt: isoString(raw.createdAt),
  };
}
