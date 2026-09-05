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
  currency: string;
  items: ServerCartItem[];
  totalItems: number;
  subtotal: number;
}

export interface CartSummaryEntry {
  currency: string;
  itemCount: number;
  updatedAt: string;
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
   * Get a cart from the server. With no currency, returns the buyer's
   * active (most-recently-touched) cart. With a currency, returns that
   * specific currency-cart — carts are one-per-(buyer, currency), never
   * cleared or merged when the buyer shops in a different currency.
   */
  async getCart(currency?: string): Promise<ServerCart> {
    const query = currency ? `?currency=${encodeURIComponent(currency)}` : "";
    const res = await apiClient.get<{ cart: any }>(`/api/cart${query}`);
    return normalizeCart(res.cart ?? res);
  },

  /**
   * Lightweight summary of every currency-cart the buyer currently has
   * items in — used to let them switch back to a cart that isn't active
   * without losing anything.
   */
  async getCartsSummary(): Promise<CartSummaryEntry[]> {
    const res = await apiClient.get<{ carts: CartSummaryEntry[] }>("/api/cart/summary");
    return res.carts ?? [];
  },

  /**
   * Add item to cart.
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
   * Clear one specific currency-cart. There is no "clear everything" call —
   * each currency-cart is independent, so a currency is always required.
   */
  async clearCart(currency: string): Promise<void> {
    await apiClient.delete<void>(`/api/cart?currency=${encodeURIComponent(currency)}`);
  },

  /**
   * Calculate delivery costs for all vendors in cart.
   */
  async calculateDelivery(input: {
    cartId: string;
    destinationZoneId: string;
    country: string;
    vendorId?: string;
    vendorName?: string;
  }): Promise<DeliveryEstimate[]> {
    const res = await apiClient.post<DeliveryCalculationResponse>("/api/delivery/calculate", {
      cartId: input.cartId,
      destinationZoneId: input.destinationZoneId,
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
   * Create payment intent for checkout.
   * Backend expects cartId + destinationZoneId.
   * Returns Stripe clientSecret + order IDs.
   */
  async createPaymentIntent(payload: {
    cartId?: string;
    destinationZoneId?: string;
    deliveryAddress?: string;
    deliveryCountry?: string;
    walletAmount?: number;
    promoCode?: string;
  }): Promise<CheckoutIntent> {
    return apiClient.post<CheckoutIntent>("/api/payments/create-intent", payload);
  },
};
