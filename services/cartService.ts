/**
 * Cart Service — Multi-vendor cart backed by API.
 */
import { apiClient } from "./api";
import { CartItem } from "../types/product";
import { normalizeProduct } from "./api/normalizers";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface ServerCartItem {
  id: string;
  productId: string;
  productName: string;
  productImage: string;
  vendorId: string;
  vendorName: string;
  price: number;
  currency: string;
  quantity: number;
  weight?: number;
}

export interface ServerCart {
  id?: string;
  /** The cart's dominant (first item's) native currency — informational
   * only. A cart may hold products in several native currencies; the
   * buyer's actual checkout currency is tracked separately (see
   * useCartStore's checkoutCurrency) and normalization happens server-side
   * at checkout/delivery-calculation time. */
  currency: string;
  items: ServerCartItem[];
  totalItems: number;
  subtotal: number;
}

export type DeliveryIneligibilityReason = "VENDOR_ZONE_INACTIVE" | "NO_COVERAGE";

export interface DeliveryEstimate {
  vendorId: string;
  vendorName: string;
  country: string;
  cost: number;
  currency: string;
  estimatedDays: string;
  weight: number;
  /** False when this vendor specifically cannot deliver to the address just
   * calculated for — a valid vendor stays eligible even when another vendor
   * in the same cart is not. */
  eligible: boolean;
  reason?: DeliveryIneligibilityReason;
  productIds: string[];
  productTitles: string[];
}

export interface DeliveryCalculationResult {
  /** True only when every vendor in the cart can deliver to this address. */
  eligible: boolean;
  estimates: DeliveryEstimate[];
  subtotalAmount: number;
  deliveryAmount: number;
  totalAmount: number;
  currency: string;
}

interface DeliveryCalculationResponse {
  eligible: boolean;
  subtotalAmount: number;
  deliveryAmount: number;
  totalAmount: number;
  totalWeightGrams: number;
  currency: string;
  vendors: {
    vendorId: string;
    vendorName: string;
    eligible: boolean;
    reason?: DeliveryIneligibilityReason;
    productIds: string[];
    productTitles: string[];
    subtotalAmount?: number;
    deliveryAmount?: number;
  }[];
}

export interface CheckoutIntent {
  checkoutId: string;
  orderIds: string[];
  amount: number;
  currency: string;
  clientSecret: string;
  discountAmount?: number;
  promoCode?: string;
  campaignId?: string;
  campaignTitle?: string;
  campaignDiscount?: number;
  /** True when at least one cart item's native currency differed from the
   * checkout currency and was normalized. */
  conversionApplied?: boolean;
}

// ─── Cart Service ──────────────────────────────────────────────────────────────

// ─── Normalizer ────────────────────────────────────────────────────────────────

function normalizeCart(raw: any): ServerCart {
  const rawItems: any[] = raw?.items ?? [];
  const items: ServerCartItem[] = rawItems.map((item) => {
    const product = item.product ? normalizeProduct(item.product) : null;
    return {
      id: item.id,
      productId: item.productId,
      productName: product?.name ?? item.productTitle ?? "",
      productImage: product?.images?.[0] ?? "",
      vendorId: product?.vendorId ?? item.vendorId ?? "",
      vendorName: product?.vendorName ?? "",
      price: product?.price ?? 0,
      currency: product?.currency ?? "GBP",
      quantity: item.quantity,
      weight: product?.weight,
    };
  });

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const currency = (raw?.currency ?? items[0]?.currency ?? "GBP").toUpperCase();

  return { id: raw?.id, currency, items, totalItems, subtotal };
}

export const cartService = {
  /**
   * Get current cart from server.
   */
  async getCart(): Promise<ServerCart> {
    const res = await apiClient.get<{ cart: any }>("/api/cart");
    return normalizeCart(res.cart ?? res);
  },

  /**
   * Add item to cart. A cart may hold products from vendors with
   * different native currencies — this never fails on a currency
   * mismatch and never clears anything.
   */
  async addItem(productId: string, quantity = 1): Promise<ServerCart> {
    const res = await apiClient.post<{ cart: any }>("/api/cart/items", { productId, quantity });
    return normalizeCart(res.cart ?? res);
  },

  /**
   * Update item quantity.
   */
  async updateItem(cartItemId: string, quantity: number): Promise<ServerCart> {
    const res = await apiClient.patch<{ cart: any }>(`/api/cart/items/${cartItemId}`, { quantity });
    return normalizeCart(res.cart ?? res);
  },

  /**
   * Remove item from cart.
   */
  async removeItem(cartItemId: string): Promise<ServerCart> {
    const res = await apiClient.delete<{ cart: any }>(`/api/cart/items/${cartItemId}`);
    return normalizeCart(res.cart ?? res);
  },

  /**
   * Clear entire cart.
   */
  async clearCart(): Promise<void> {
    await apiClient.delete<void>("/api/cart");
  },

  /**
   * Calculate delivery costs for every vendor in the cart, normalized into
   * checkoutCurrency (defaults server-side to the cart's own dominant
   * currency when omitted). Each vendor's delivery eligibility for this
   * country is resolved independently on the backend — a valid vendor's
   * estimate is returned even when another vendor in the same cart cannot
   * deliver here.
   */
  async calculateDelivery(input: {
    cartId: string;
    country: string;
    checkoutCurrency?: string;
  }): Promise<DeliveryCalculationResult> {
    const res = await apiClient.post<DeliveryCalculationResponse>("/api/delivery/calculate", {
      cartId: input.cartId,
      deliveryCountry: input.country,
      checkoutCurrency: input.checkoutCurrency,
    });

    const estimates: DeliveryEstimate[] = (res.vendors ?? []).map((v) => ({
      vendorId: v.vendorId,
      vendorName: v.vendorName,
      country: input.country,
      cost: v.eligible ? (v.deliveryAmount ?? 0) / 100 : 0,
      currency: (res.currency ?? "GBP").toUpperCase(),
      estimatedDays: "",
      weight: 0,
      eligible: v.eligible,
      reason: v.reason,
      productIds: v.productIds,
      productTitles: v.productTitles,
    }));

    return {
      eligible: res.eligible,
      estimates,
      subtotalAmount: res.subtotalAmount,
      deliveryAmount: res.deliveryAmount,
      totalAmount: res.totalAmount,
      currency: res.currency,
    };
  },

  /**
   * Create payment intent for checkout. Backend normalizes every line
   * item and delivery fee into checkoutCurrency (defaults to the cart's
   * dominant currency when omitted) and creates exactly ONE Stripe
   * PaymentIntent in that one currency, regardless of how many native
   * currencies were mixed in the cart. Independently re-checks every
   * vendor's delivery eligibility and refuses to charge if any vendor
   * cannot actually deliver to deliveryCountry, even if the caller's own
   * pre-check was stale.
   * Returns Stripe clientSecret + order IDs.
   */
  async createPaymentIntent(payload: {
    cartId?: string;
    deliveryAddress?: string;
    deliveryCountry?: string;
    checkoutCurrency?: string;
    walletAmount?: number;
    promoCode?: string;
  }): Promise<CheckoutIntent> {
    return apiClient.post<CheckoutIntent>("/api/payments/create-intent", payload);
  },
};
