import { create } from "zustand";
import { CartItem, Product } from "../types/product";
import { cartService, ServerCartItem, DeliveryEstimate, CheckoutIntent } from "../services/cartService";
import { deliveryService } from "../services/deliveryService";

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
  isLoading: boolean;
  error: string | null;
  deliveryEstimates: DeliveryEstimate[];
  checkoutIntent: CheckoutIntent | null;
  deliveryCountry: string;

  addItem: (product: Product, quantity?: number) => Promise<void>;
  removeItem: (productId: string) => Promise<void>;
  updateQuantity: (productId: string, quantity: number) => Promise<void>;
  clearCart: () => Promise<void>;
  syncWithServer: () => Promise<void>;
  calculateDelivery: (country: string) => Promise<void>;
  setDeliveryCountry: (country: string) => void;
  createCheckout: (address: string, walletAmount?: number, deliveryCountryOverride?: string) => Promise<CheckoutIntent>;

  subtotal: () => number;
  totalItems: () => number;
  deliveryTotal: () => number;
  grandTotal: () => number;
  groupedByVendor: () => VendorGroup[];
  vendorCount: () => number;
  reset: () => void;
}

function normalizeCountryToken(value: string): string {
  return value.trim().toLowerCase();
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

function resolveDeliveryCountry(currentCountry: string | undefined, currency?: string, override?: string): string {
  const explicit = override?.trim();
  if (explicit) return explicit;

  const fallbackCountry = inferCountryFromCurrency(currency);
  const current = currentCountry?.trim();
  if (!current) return fallbackCountry;

  if (current.toLowerCase() === "uk" && (currency ?? "").toUpperCase() !== "GBP") {
    return fallbackCountry;
  }

  return current;
}

function countryMatches(zone: { countryCode?: string; country?: string }, country: string): boolean {
  const normalized = normalizeCountryToken(country);
  const shortCode =
    normalized === "uk" || normalized.includes("united kingdom")
      ? "uk"
      : normalized === "us" || normalized === "usa" || normalized.includes("united states")
        ? "us"
        : normalized.includes("canada")
          ? "ca"
          : normalized.includes("europe") || normalized === "eu"
            ? "eu"
            : normalized;

  const zoneCode = normalizeCountryToken(zone.countryCode ?? "");
  const zoneCountry = normalizeCountryToken(zone.country ?? "");

  return zoneCode === normalized || zoneCode === shortCode || zoneCountry.includes(normalized) || zoneCountry.includes(shortCode);
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
  isLoading: false,
  error: null,
  deliveryEstimates: [],
  checkoutIntent: null,
  deliveryCountry: "UK",

  addItem: async (product, quantity = 1) => {
    const existingCurrency = get().items[0]?.product.currency ?? get().serverItems[0]?.currency;
    if (existingCurrency && existingCurrency !== product.currency) {
      const message = "Your cart can only contain products with the same currency. Clear the cart or checkout first.";
      set({ error: message });
      throw new Error(message);
    }

    set({ isLoading: true, error: null });
    try {
      const cart = await cartService.addItem(product.id, quantity);
      set({
        items: cartItemsFromServer(cart.items),
        serverItems: cart.items,
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
      set({ items: [], serverItems: [], deliveryEstimates: [], checkoutIntent: null, isLoading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not clear cart.";
      set({ isLoading: false, error: message });
      throw err;
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

      const zones = await deliveryService.listAllZones();
      const match = zones.find((z) => countryMatches(z, country));
      if (!match) throw new Error("Delivery is not available for this country yet.");

      const firstItem = cart.items[0];
      const estimates = await cartService.calculateDelivery({
        cartId: cart.id,
        destinationZoneId: match.id,
        country,
        vendorId: firstItem?.vendorId,
        vendorName: firstItem?.vendorName,
      });
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

  createCheckout: async (address, walletAmount, deliveryCountryOverride) => {
    set({ isLoading: true, error: null });
    try {
      const uniqueCurrencies = new Set(get().items.map((item) => item.product.currency).filter(Boolean));
      if (uniqueCurrencies.size > 1) {
        throw new Error("Your cart contains multiple currencies. Clear the cart and place one currency at a time.");
      }

      const cart = await cartService.getCart();
      if (!cart.id) throw new Error("Your cart is not available on the server.");

      let destinationZoneId: string | undefined;
      const zones = await deliveryService.listAllZones();
      const cartCurrency = get().items[0]?.product.currency ?? get().serverItems[0]?.currency;
      const country = resolveDeliveryCountry(get().deliveryCountry, cartCurrency, deliveryCountryOverride);
      const match = zones.find((z) => countryMatches(z, country));
      destinationZoneId = match?.id;
      if (!destinationZoneId) throw new Error("Delivery is not available for this country yet.");

      set({ deliveryCountry: country });
      const intent = await cartService.createPaymentIntent({
        cartId: cart.id,
        destinationZoneId,
        deliveryAddress: address,
        deliveryCountry: country,
        walletAmount,
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
      isLoading: false,
      error: null,
      deliveryEstimates: [],
      checkoutIntent: null,
      deliveryCountry: "UK",
    }),
}));
