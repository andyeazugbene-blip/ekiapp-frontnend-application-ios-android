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

export interface DeliveryEstimate {
  vendorId: string;
  vendorName: string;
  country: string;
  cost: number;
  currency: string;
  estimatedDays: string;
  weight: number;
}

interface DeliveryCalculationResponse {
  subtotalAmount: number;
  deliveryAmount: number;
  totalAmount: number;
  totalWeightGrams: number;
  currency: string;
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
   * Calculate delivery costs for all vendors in cart, normalized into
   * checkoutCurrency (defaults server-side to the cart's own dominant
   * currency when omitted).
   */
  async calculateDelivery(input: {
    cartId: string;
    destinationZoneId: string;
    country: string;
    checkoutCurrency?: string;
    vendorId?: string;
    vendorName?: string;
  }): Promise<DeliveryEstimate[]> {
    const res = await apiClient.post<DeliveryCalculationResponse>("/api/delivery/calculate", {
      cartId: input.cartId,
      destinationZoneId: input.destinationZoneId,
      checkoutCurrency: input.checkoutCurrency,
    });

    return [{
      vendorId: input.vendorId ?? "",
      vendorName: input.vendorName ?? "",
      country: input.country,
      cost: res.deliveryAmount / 100,
      currency: (res.currency ?? "GBP").toUpperCase(),
      estimatedDays: "",
      weight: res.totalWeightGrams / 1000,
    }];
  },

  /**
   * Create payment intent for checkout. Backend normalizes every line
   * item and delivery fee into checkoutCurrency (defaults to the cart's
   * dominant currency when omitted) and creates exactly ONE Stripe
   * PaymentIntent in that one currency, regardless of how many native
   * currencies were mixed in the cart.
   * Returns Stripe clientSecret + order IDs.
   */
  async createPaymentIntent(payload: {
    cartId?: string;
    destinationZoneId?: string;
    deliveryAddress?: string;
    deliveryCountry?: string;
    checkoutCurrency?: string;
    walletAmount?: number;
    promoCode?: string;
  }): Promise<CheckoutIntent> {
    return apiClient.post<CheckoutIntent>("/api/payments/create-intent", payload);
  },
};
