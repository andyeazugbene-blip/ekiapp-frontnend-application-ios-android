import { create } from "zustand";
import { CartItem, Product } from "../types/product";
import { cartService, ServerCartItem, DeliveryEstimate, CheckoutIntent, CartSummaryEntry } from "../services/cartService";
import { DeliveryZone, deliveryService, matchesDeliveryZoneCountry } from "../services/deliveryService";

export interface AddItemResult {
  switchedCurrency: boolean;
  currency: string;
  previousCurrency?: string;
}

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
  currency: string;
  otherCarts: CartSummaryEntry[];
  isLoading: boolean;
  error: string | null;
  deliveryEstimates: DeliveryEstimate[];
  checkoutIntent: CheckoutIntent | null;
  deliveryCountry: string;

  addItem: (product: Product, quantity?: number) => Promise<AddItemResult>;
  removeItem: (productId: string) => Promise<void>;
  updateQuantity: (productId: string, quantity: number) => Promise<void>;
  clearCart: () => Promise<void>;
  switchCurrency: (currency: string) => Promise<void>;
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

function cartCurrencyFromServer(items: ServerCartItem[]): string | undefined {
  const currencies = items.map((item) => normalizeCurrency(item.currency)).filter(Boolean);
  return currencies[0];
}

// vendorIds is every vendor actually in the cart, not just one item's vendor
// — a multi-vendor cart must accept a zone belonging to ANY of those
// vendors (or a global, vendor-less zone), not only the first item's. The
// backend independently resolves each vendor's own zone/fallback per group
// (see payments.service.ts createPaymentIntent) — this only needs to find
// ONE zone that establishes the right country + currency. Scoping to a
// single vendor here previously made a same-currency multi-vendor cart
// throw "delivery not available" whenever the first item's vendor had no
// zone (or only a vendor-specific one) even though another vendor already
// in the cart had a perfectly valid zone.
function findCompatibleDeliveryZone(
  zones: DeliveryZone[],
  country: string,
  currency?: string,
  vendorIds?: string[],
): DeliveryZone | null {
  const countryMatches = zones.filter((zone) => {
    if (zone.active === false || !matchesDeliveryZoneCountry(zone, country)) return false;
    return !vendorIds?.length || !zone.vendorId || vendorIds.includes(zone.vendorId);
  });
  const expectedCurrency = normalizeCurrency(currency);
  if (!expectedCurrency) return countryMatches[0] ?? null;
  return countryMatches.find((zone) => normalizeCurrency(zone.currency) === expectedCurrency) ?? null;
}

// Buyer-facing copy only — never the raw "zone currency mismatch"/ops
// language. Both branches mean the same thing to a buyer: this address
// can't be delivered to right now. checkout.tsx renders this inside the
// friendly "can't deliver" banner with "Choose another address" /
// "View delivery options" actions, not as a raw error string.
function deliveryZoneError(country: string): string {
  return `We can't deliver to ${country || "this address"} yet. Choose another address or check the vendor's delivery area.`;
}

function assertDeliveryEstimateCurrency(estimates: DeliveryEstimate[], expectedCurrency?: string) {
  const expected = normalizeCurrency(expectedCurrency);
  if (!expected) return;
  const mismatch = estimates.find((estimate) => normalizeCurrency(estimate.currency) !== expected);
  if (mismatch) {
    throw new Error(
      `Delivery zone currency mismatch. This cart is ${expected}, but delivery returned ${normalizeCurrency(mismatch.currency) || "another currency"}.`,
    );
  }
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
  currency: "",
  otherCarts: [],
  isLoading: false,
  error: null,
  deliveryEstimates: [],
  checkoutIntent: null,
  deliveryCountry: "UK",

  // Carts are one-per-(buyer, currency) on the server — adding a product
  // never fails on a currency mismatch. It routes straight to (or creates)
  // the cart for THAT product's currency, which becomes the active cart.
  // The caller gets told whether that meant switching away from a
  // different currency's cart, so it can show a brief, non-destructive
  // notice instead of the old blocking "start a new cart" alert — nothing
  // is ever cleared or lost.
  addItem: async (product, quantity = 1) => {
    const previousCurrency = get().currency;
    set({ isLoading: true, error: null });
    try {
      const cart = await cartService.addItem(product.id, quantity);
      const switchedCurrency = Boolean(previousCurrency) && previousCurrency !== cart.currency;
      set({
        items: cartItemsFromServer(cart.items),
        serverItems: cart.items,
        currency: cart.currency,
        deliveryEstimates: switchedCurrency ? [] : get().deliveryEstimates,
        isLoading: false,
      });
      if (switchedCurrency) {
        cartService.getCartsSummary().then((carts) => set({ otherCarts: carts })).catch(() => {});
      }
      return { switchedCurrency, currency: cart.currency, previousCurrency: switchedCurrency ? previousCurrency : undefined };
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

  // Clears the currently-active currency-cart (e.g. after a successful
  // checkout of that cart). Each currency-cart is independent — this never
  // touches any other currency-cart the buyer has saved.
  clearCart: async () => {
    const currency = get().currency;
    set({ isLoading: true, error: null });
    try {
      if (currency) await cartService.clearCart(currency);
      set({ items: [], serverItems: [], deliveryEstimates: [], checkoutIntent: null, isLoading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not clear cart.";
      set({ isLoading: false, error: message });
      throw err;
    }
  },

  // Switches the active cart to a different currency the buyer already has
  // a saved cart in (from the "other saved carts" list) — no data loss,
  // nothing is cleared, the previously-active cart just becomes inactive.
  switchCurrency: async (currency) => {
    set({ isLoading: true, error: null });
    try {
      const cart = await cartService.getCart(currency);
      set({
        items: cartItemsFromServer(cart.items),
        serverItems: cart.items,
        currency: cart.currency,
        deliveryEstimates: [],
        isLoading: false,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not switch cart.";
      set({ isLoading: false, error: message });
      throw err;
    }
  },

  syncWithServer: async () => {
    set({ isLoading: true, error: null });
    try {
      const [cart, otherCarts] = await Promise.all([
        cartService.getCart(),
        cartService.getCartsSummary().catch(() => [] as CartSummaryEntry[]),
      ]);
      const resolvedCountry = resolveDeliveryCountry(get().deliveryCountry, cart.items[0]?.currency);
      set({
        items: cartItemsFromServer(cart.items),
        serverItems: cart.items,
        currency: cart.currency,
        otherCarts: otherCarts.filter((entry) => entry.currency !== cart.currency),
        deliveryCountry: resolvedCountry,
        isLoading: false,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not sync cart.";
      set({ isLoading: false, error: message });
    }
  },

  calculateDelivery: async (country) => {
    set({ isLoading: true, deliveryCountry: country, error: null });
    try {
      const cart = await cartService.getCart();
      if (!cart.id || cart.items.length === 0) {
        set({ deliveryEstimates: [], isLoading: false });
        return;
      }

      const cartCurrency = cartCurrencyFromServer(cart.items);
      const firstItem = cart.items[0];
      const vendorIds = Array.from(new Set(cart.items.map((item) => item.vendorId).filter(Boolean)));
      const zones = await deliveryService.listAllZones();
      const match = findCompatibleDeliveryZone(zones, country, cartCurrency, vendorIds);
      if (!match) throw new Error(deliveryZoneError(country));

      const estimates = await cartService.calculateDelivery({
        cartId: cart.id,
        destinationZoneId: match.id,
        country,
        vendorId: firstItem?.vendorId,
        vendorName: firstItem?.vendorName,
      });
      assertDeliveryEstimateCurrency(estimates, cartCurrency);
      set({ deliveryEstimates: estimates, isLoading: false });
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

  createCheckout: async (address, walletAmount, deliveryCountryOverride, promoCode) => {
    set({ isLoading: true, error: null });
    try {
      const uniqueCurrencies = new Set(get().items.map((item) => normalizeCurrency(item.product.currency)).filter(Boolean));
      if (uniqueCurrencies.size > 1) {
        throw new Error("Your cart contains multiple currencies. Clear the cart and place one currency at a time.");
      }

      const cart = await cartService.getCart();
      if (!cart.id) throw new Error("Your cart is not available on the server.");
      if (cart.items.length === 0) throw new Error("Your cart is empty.");

      const serverCurrencies = new Set(cart.items.map((item) => normalizeCurrency(item.currency)).filter(Boolean));
      if (serverCurrencies.size > 1) {
        throw new Error("Your cart contains multiple currencies. Clear the cart and place one currency at a time.");
      }

      let destinationZoneId: string | undefined;
      const zones = await deliveryService.listAllZones();
      const cartCurrency =
        Array.from(serverCurrencies)[0] ??
        normalizeCurrency(get().items[0]?.product.currency ?? get().serverItems[0]?.currency);
      const country = resolveDeliveryCountry(get().deliveryCountry, cartCurrency, deliveryCountryOverride);
      const vendorIds = Array.from(new Set(cart.items.map((item) => item.vendorId).filter(Boolean)));
      const match = findCompatibleDeliveryZone(zones, country, cartCurrency, vendorIds);
      destinationZoneId = match?.id;
      if (!destinationZoneId) throw new Error(deliveryZoneError(country));

      set({ deliveryCountry: country });
      const intent = await cartService.createPaymentIntent({
        cartId: cart.id,
        destinationZoneId,
        deliveryAddress: address,
        deliveryCountry: country,
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
      currency: "",
      otherCarts: [],
      isLoading: false,
      error: null,
      deliveryEstimates: [],
      checkoutIntent: null,
      deliveryCountry: "UK",
    }),
}));
