import { create } from "zustand";
import { CartItem, Product } from "../types/product";
import { cartService, ServerCartItem, DeliveryEstimate, CheckoutIntent } from "../services/cartService";

export interface VendorGroup {
  vendorId: string;
  vendorName: string;
  items: CartItem[];
  subtotal: number;
  delivery?: DeliveryEstimate;
}

interface CartStore {
  items: CartItem[];
  serverItems: ServerCartItem[];
  /** Buyer's chosen checkout currency — every line item, delivery fee, and
   * discount is normalized into this ONE currency on the backend before
   * Stripe ever sees an amount. Empty string until the cart has synced at
   * least once; defaults to the cart's first item's currency. */
  checkoutCurrency: string;
  isLoading: boolean;
  error: string | null;
  deliveryEstimates: DeliveryEstimate[];
  checkoutIntent: CheckoutIntent | null;
  deliveryCountry: string;

  addItem: (product: Product, quantity?: number) => Promise<void>;
  removeItem: (productId: string) => Promise<void>;
  updateQuantity: (productId: string, quantity: number) => Promise<void>;
  clearCart: () => Promise<void>;
  /** Buyer explicitly changes the checkout currency — re-normalizes
   * delivery/totals, never touches the cart's contents. */
  setCheckoutCurrency: (currency: string) => Promise<void>;
  syncWithServer: () => Promise<void>;
  calculateDelivery: (country: string) => Promise<void>;
  setDeliveryCountry: (country: string) => void;
  createCheckout: (address: string, walletAmount?: number, deliveryCountryOverride?: string, promoCode?: string) => Promise<CheckoutIntent>;

  subtotal: () => number;
  totalItems: () => number;
  deliveryTotal: () => number;
  grandTotal: () => number;
  groupedByVendor: () => VendorGroup[];
  vendorCount: () => number;
  /** Every distinct native currency actually present in the cart right
   * now — length > 1 means normalization is genuinely happening. */
  nativeCurrencies: () => string[];
  /** The subset of deliveryEstimates that cannot deliver to the currently
   * calculated address — empty when every vendor is eligible. */
  ineligibleVendors: () => DeliveryEstimate[];
  reset: () => void;
}

function inferCountryFromCurrency(currency?: string): string {
  switch ((currency ?? "").toUpperCase()) {
    case "EUR":
      return "Europe";
    case "USD":
      return "United States";
    case "CAD":
      return "Canada";
    case "NGN":
      return "Nigeria";
    case "GBP":
    default:
      return "United Kingdom";
  }
}

function normalizeCurrency(currency?: string): string {
  return (currency ?? "").trim().toUpperCase();
}

/**
 * Builds a specific, actionable message naming exactly which vendor/items
 * can't be delivered — never a generic "can't deliver" banner when only
 * SOME vendors in a multi-vendor cart are actually affected.
 */
export function deliveryEligibilityMessage(ineligible: DeliveryEstimate[]): string {
  const totalProducts = ineligible.reduce((sum, e) => sum + e.productTitles.length, 0);
  if (ineligible.length === 1 && totalProducts === 1) {
    return `One item in your cart can't be delivered to this address: ${ineligible[0].productTitles[0]} (${ineligible[0].vendorName}).`;
  }
  const lines = ineligible.map((e) => `${e.vendorName}: ${e.productTitles.join(", ")}`);
  return `These items can't be delivered to this address:\n${lines.map((l) => `- ${l}`).join("\n")}`;
}

function resolveDeliveryCountry(currentCountry: string | undefined, currency?: string, override?: string): string {
  const explicit = override?.trim();
  if (explicit) return explicit;

  const fallbackCountry = inferCountryFromCurrency(currency);
  const current = currentCountry?.trim();
  if (!current) return fallbackCountry;

  if (current.toLowerCase() === "uk" && normalizeCurrency(currency) !== "GBP") {
    return fallbackCountry;
  }

  return current;
}

function productFromServerItem(item: ServerCartItem): Product {
  return {
    id: item.productId,
    name: item.productName,
    description: "",
    price: item.price,
    currency: item.currency as Product["currency"],
    images: item.productImage ? [item.productImage] : [],
    category: "",
    vendorId: item.vendorId,
    vendorName: item.vendorName,
    vendorCity: "",
    stock: 0,
    status: "active",
    weight: item.weight,
    createdAt: "",
    updatedAt: "",
  };
}

function cartItemsFromServer(items: ServerCartItem[]): CartItem[] {
  return items.map((item) => ({
    product: productFromServerItem(item),
    quantity: item.quantity,
  }));
}

export const useCartStore = create<CartStore>((set, get) => ({
  items: [],
  serverItems: [],
  checkoutCurrency: "",
  isLoading: false,
  error: null,
  deliveryEstimates: [],
  checkoutIntent: null,
  deliveryCountry: "UK",

  // A cart may hold products from vendors with different native
  // currencies — adding a product never fails on a currency mismatch and
  // never clears anything. Currency safety is enforced once, at checkout,
  // by backend FX normalization into one checkout currency.
  addItem: async (product, quantity = 1) => {
    set({ isLoading: true, error: null });
    try {
      const cart = await cartService.addItem(product.id, quantity);
      set({
        items: cartItemsFromServer(cart.items),
        serverItems: cart.items,
        // Only set a default checkout currency the FIRST time the cart
        // gets a currency at all — adding a second, different-currency
        // product must never silently retarget an already-chosen currency.
        checkoutCurrency: get().checkoutCurrency || cart.currency,
        isLoading: false,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not add item to cart.";
      set({ isLoading: false, error: message });
      throw err;
    }
  },

  removeItem: async (productId) => {
    set({ isLoading: true, error: null });
    try {
      let serverItem = get().serverItems.find((si) => si.productId === productId);
      if (!serverItem) {
        const cart = await cartService.getCart();
        serverItem = cart.items.find((si) => si.productId === productId);
      }
      if (!serverItem) {
        set({ isLoading: false });
        return;
      }
      const cart = await cartService.removeItem(serverItem.id);
      set({
        items: cartItemsFromServer(cart.items),
        serverItems: cart.items,
        deliveryEstimates: [],
        isLoading: false,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not remove item.";
      set({ isLoading: false, error: message });
      throw err;
    }
  },

  updateQuantity: async (productId, quantity) => {
    if (quantity <= 0) {
      await get().removeItem(productId);
      return;
    }

    set({ isLoading: true, error: null });
    try {
      let serverItem = get().serverItems.find((si) => si.productId === productId);
      if (!serverItem) {
        const cart = await cartService.getCart();
        serverItem = cart.items.find((si) => si.productId === productId);
      }
      if (!serverItem) throw new Error("Cart item was not found on the server.");
      const cart = await cartService.updateItem(serverItem.id, quantity);
      set({
        items: cartItemsFromServer(cart.items),
        serverItems: cart.items,
        deliveryEstimates: [],
        isLoading: false,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not update item.";
      set({ isLoading: false, error: message });
      throw err;
    }
  },

  clearCart: async () => {
    set({ isLoading: true, error: null });
    try {
      await cartService.clearCart();
      set({ items: [], serverItems: [], checkoutCurrency: "", deliveryEstimates: [], checkoutIntent: null, isLoading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not clear cart.";
      set({ isLoading: false, error: message });
      throw err;
    }
  },

  // Re-normalizes delivery into the new currency; the cart's products and
  // quantities are completely untouched by this — there is no server call
  // that could delete anything here, just a fresh delivery estimate.
  setCheckoutCurrency: async (currency) => {
    const next = currency.trim().toUpperCase();
    if (!next || next === get().checkoutCurrency) return;
    set({ checkoutCurrency: next, deliveryEstimates: [] });
    if (get().items.length > 0 && get().deliveryCountry) {
      await get().calculateDelivery(get().deliveryCountry).catch(() => {});
    }
  },

  syncWithServer: async () => {
    set({ isLoading: true, error: null });
    try {
      const cart = await cartService.getCart();
      const resolvedCountry = resolveDeliveryCountry(get().deliveryCountry, cart.items[0]?.currency);
      set({
        items: cartItemsFromServer(cart.items),
        serverItems: cart.items,
        checkoutCurrency: get().checkoutCurrency || cart.currency,
        deliveryCountry: resolvedCountry,
        isLoading: false,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not sync cart.";
      set({ isLoading: false, error: message });
    }
  },

  // Each vendor's delivery eligibility for `country` is resolved
  // independently on the backend (see delivery.service.ts) — a valid
  // vendor's estimate is returned even when another vendor in the same
  // cart cannot deliver here. This only throws for a genuine failure
  // (network, missing cart); partial ineligibility is a normal result,
  // reflected in deliveryEligible/deliveryEstimates, not an error.
  calculateDelivery: async (country) => {
    set({ isLoading: true, deliveryCountry: country, error: null });
    try {
      const cart = await cartService.getCart();
      if (!cart.id || cart.items.length === 0) {
        set({ deliveryEstimates: [], isLoading: false });
        return;
      }

      const checkoutCurrency = get().checkoutCurrency || cart.currency;
      const result = await cartService.calculateDelivery({ cartId: cart.id, country, checkoutCurrency });
      set({
        deliveryEstimates: result.estimates,
        checkoutCurrency: result.currency || checkoutCurrency,
        isLoading: false,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not calculate delivery.";
      set({ isLoading: false, error: message, deliveryEstimates: [] });
      throw err;
    }
  },

  setDeliveryCountry: (country) => {
    const nextCountry = country.trim();
    if (!nextCountry) return;
    set({ deliveryCountry: nextCountry, error: null });
  },

  // The backend independently re-checks every vendor's delivery
  // eligibility for `country` and refuses to charge (DELIVERY_INELIGIBLE_
  // VENDOR) if any vendor can't actually deliver there — this never
  // pre-picks a zone client-side, so that check can never be stale or
  // bypassed by an out-of-date zones list.
  createCheckout: async (address, walletAmount, deliveryCountryOverride, promoCode) => {
    set({ isLoading: true, error: null });
    try {
      const cart = await cartService.getCart();
      if (!cart.id) throw new Error("Your cart is not available on the server.");
      if (cart.items.length === 0) throw new Error("Your cart is empty.");

      const checkoutCurrency = get().checkoutCurrency || cart.currency;
      const country = resolveDeliveryCountry(get().deliveryCountry, checkoutCurrency, deliveryCountryOverride);

      set({ deliveryCountry: country });
      const intent = await cartService.createPaymentIntent({
        cartId: cart.id,
        deliveryAddress: address,
        deliveryCountry: country,
        checkoutCurrency,
        walletAmount,
        promoCode,
      });
      set({ checkoutIntent: intent, isLoading: false });
      return intent;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Checkout failed.";
      set({ isLoading: false, error: message });
      throw err;
    }
  },

  subtotal: () =>
    get().items.reduce((sum, item) => sum + (item.product?.price ?? 0) * (item.quantity ?? 0), 0),

  totalItems: () =>
    get().items.reduce((sum, item) => sum + (item.quantity ?? 0), 0),

  deliveryTotal: () =>
    get().deliveryEstimates.reduce((sum, est) => sum + (est.cost ?? 0), 0),

  grandTotal: () =>
    get().subtotal() + get().deliveryTotal(),

  vendorCount: () => {
    const vendorIds = new Set(get().items.map((i) => i.product.vendorId));
    return vendorIds.size;
  },

  nativeCurrencies: () =>
    Array.from(new Set(get().items.map((i) => normalizeCurrency(i.product.currency)).filter(Boolean))),

  ineligibleVendors: () => get().deliveryEstimates.filter((e) => !e.eligible),

  groupedByVendor: () => {
    const { items, deliveryEstimates } = get();
    const groups: Record<string, VendorGroup> = {};

    for (const item of items) {
      const vid = item.product.vendorId;
      if (!groups[vid]) {
        groups[vid] = {
          vendorId: vid,
          vendorName: item.product.vendorName,
          items: [],
          subtotal: 0,
          delivery: deliveryEstimates.find((d) => d.vendorId === vid),
        };
      }
      groups[vid].items.push(item);
      groups[vid].subtotal += item.product.price * item.quantity;
    }

    return Object.values(groups);
  },

  reset: () =>
    set({
      items: [],
      serverItems: [],
      checkoutCurrency: "",
      isLoading: false,
      error: null,
      deliveryEstimates: [],
      checkoutIntent: null,
      deliveryCountry: "UK",
    }),
}));
