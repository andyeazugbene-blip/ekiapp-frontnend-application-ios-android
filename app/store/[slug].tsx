import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  type LayoutChangeEvent,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import type { CheckoutIntent, ServerCartItem } from "../../services/cartService";
import { authService } from "../../services/authService";
import { orderService } from "../../services/orderService";
import { productService } from "../../services/productService";
import {
  publicStoreService,
  type PublicStoreEvent,
  type PublicStoreEventMetadata,
  type PublicOrderItemSnapshot,
  type PublicStoreOrder,
} from "../../services/publicStoreService";
import { reviewService } from "../../services/reviewService";
import { useAuthStore } from "../../stores/authStore";
import { useCartStore } from "../../stores/cartStore";
import { usePublicStoreCartStore } from "../../stores/publicStoreCartStore";
import type { Order } from "../../types/order";
import type { Product, Review } from "../../types/product";
import type { VendorSummary } from "../../types/vendor";
import { getPublicStoreUrl } from "../../utils/shareLinks";
import { RemoteImage } from "../../components/ui/RemoteImage";
import { WebStripeCheckoutForm } from "../../components/publicStore/WebStripeCheckoutForm";

const CURRENCY_SYMBOL: Record<string, string> = {
  GBP: "\u00A3",
  USD: "$",
  EUR: "\u20AC",
  NGN: "\u20A6",
  CAD: "C$",
};

type PanelMode = "cart" | "checkout" | "confirmed" | "find" | "verify" | "orders" | "tracking" | "syncing";

interface CheckoutState {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  addressLine1: string;
  city: string;
  postcode: string;
  country: string;
}

interface ServerCartSnapshotItem {
  productId: string;
  quantity: number;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function formatMoney(value: number, currency = "GBP"): string {
  const symbol = CURRENCY_SYMBOL[currency] ?? "\u00A3";
  return `${symbol}${value.toFixed(2)}`;
}

function formatStatusLabel(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatOrderDateTime(value: string): string {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return "Date unavailable";
  return new Date(parsed).toLocaleString();
}

function derivePublicEstimatedDeliveryLabel(order: Order): string {
  if (order.status === "delivered" && order.deliveredAt) {
    return `Delivered ${new Date(order.deliveredAt).toLocaleDateString()}`;
  }
  if (order.status === "dispatched" || order.status === "in_transit") {
    return "In transit";
  }
  return order.deliveryDetails?.estimatedDays || "2-4 days";
}

function productUnitLabel(product: Product): string {
  if (product.unit) return product.unit;
  if (product.weight) return `${Math.round(product.weight * 1000)}g`;
  return "Pack";
}

function deliveryCodeFor(country: string): "UK" | "US" | "CA" | "EU" {
  const normalized = country.trim().toLowerCase();
  if (normalized.includes("united kingdom") || normalized === "uk") return "UK";
  if (normalized.includes("united states") || normalized === "usa" || normalized === "us") return "US";
  if (normalized.includes("canada")) return "CA";
  return "EU";
}

function buildOrderNumberFallback(): string {
  const year = new Date().getFullYear();
  const suffix = String(Math.floor(10000 + Math.random() * 90000));
  return `EKI-${year}-${suffix}`;
}

function buildContactLabel(contact: CheckoutState): string {
  return `${contact.addressLine1}, ${contact.city} ${contact.postcode}`.replace(/\s+/g, " ").trim();
}

function buildOrderItems(items: { product: Product; quantity: number }[]): PublicOrderItemSnapshot[] {
  return items.map((item) => ({
    productId: item.product.id,
    name: item.product.name,
    image: item.product.images?.[0],
    quantity: item.quantity,
    price: item.product.price,
    unitLabel: productUnitLabel(item.product),
    etaLabel: "2-4 days",
  }));
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function mapBackendOrderToPublicOrder(
  order: Order,
  vendor: VendorSummary,
  vendorSlug: string,
  fallbackContact: CheckoutState,
): PublicStoreOrder {
  return {
    id: order.id,
    orderNumber: order.orderNumber || buildOrderNumberFallback(),
    vendorId: vendor.id,
    vendorName: vendor.storeName,
    vendorCity: vendor.city || vendor.country,
    vendorSlug,
    currency: order.currency,
    subtotal: order.subtotal,
    delivery: order.deliveryCost,
    platformFee: order.platformFee ?? 0,
    total: order.total,
    createdAt: order.createdAt,
    estimatedDeliveryLabel: derivePublicEstimatedDeliveryLabel(order),
    items: buildOrderItems(order.items),
    contact: {
      firstName: fallbackContact.firstName,
      lastName: fallbackContact.lastName,
      email: fallbackContact.email,
      phone: fallbackContact.phone,
      addressLine1: fallbackContact.addressLine1,
      city: fallbackContact.city,
      postcode: fallbackContact.postcode,
      country: fallbackContact.country,
    },
    status:
      order.status === "delivered"
        ? "delivered"
        : order.status === "in_transit"
        ? "in_transit"
        : order.status === "dispatched"
        ? "dispatched"
        : order.status === "processing"
        ? "preparing"
        : order.status === "confirmed"
        ? "accepted"
        : "placed",
    source: "backend",
    backendOrderId: order.id,
    backendOrderIds: [order.id],
  };
}

function buildInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part.trim().charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function PublicStoreScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const {
    slug,
    promo,
    product,
    order: orderParam,
    panel: panelParam,
    preview,
    source,
    utm_source: utmSource,
    channel,
  } = useLocalSearchParams<{
    slug?: string;
    promo?: string;
    product?: string;
    order?: string;
    panel?: string;
    preview?: string;
    source?: string;
    utm_source?: string;
    channel?: string;
  }>();

  const isWeb = Platform.OS === "web";
  const isDesktop = isWeb && width >= 1160;
  const isPreview = preview === "1" || preview === "true";
  const sharedProductId = typeof product === "string" ? product : "";
  const shareSource =
    (typeof source === "string" && source) ||
    (typeof utmSource === "string" && utmSource) ||
    (typeof channel === "string" && channel) ||
    "direct";

  const user = useAuthStore((state) => state.user);
  const authLoading = useAuthStore((state) => state.isLoading);

  const addServerItem = useCartStore((state) => state.addItem);
  const clearServerCart = useCartStore((state) => state.clearCart);
  const syncServerCart = useCartStore((state) => state.syncWithServer);
  const calculateDelivery = useCartStore((state) => state.calculateDelivery);
  const createCheckout = useCartStore((state) => state.createCheckout);
  const serverItems = useCartStore((state) => state.serverItems);
  const deliveryEstimates = useCartStore((state) => state.deliveryEstimates);

  const [vendor, setVendor] = useState<VendorSummary | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(isDesktop);
  const [panelMode, setPanelMode] = useState<PanelMode>("cart");
  const [panelError, setPanelError] = useState("");
  const [orderLookupError, setOrderLookupError] = useState("");
  const [lookupContact, setLookupContact] = useState("");
  const [lookupCode, setLookupCode] = useState("");
  const [lookupStatus, setLookupStatus] = useState("");
  const [matchedOrders, setMatchedOrders] = useState<PublicStoreOrder[]>([]);
  const [activeOrder, setActiveOrder] = useState<PublicStoreOrder | null>(null);
  const [insights, setInsights] = useState({
    opens: 0,
    cartAdds: 0,
    checkoutStarts: 0,
    ordersPlaced: 0,
    trackRequests: 0,
    reorders: 0,
  });
  const [saveAccountState, setSaveAccountState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [showSignIn, setShowSignIn] = useState(false);
  const [signInPassword, setSignInPassword] = useState("");
  const [sessionSubmitting, setSessionSubmitting] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const [productSectionY, setProductSectionY] = useState(0);

  const cartsBySlug = usePublicStoreCartStore((state) => state.cartsBySlug);
  const addPublicCartItem = usePublicStoreCartStore((state) => state.addItem);
  const decrementPublicCartItem = usePublicStoreCartStore((state) => state.decrementItem);
  const replacePublicCart = usePublicStoreCartStore((state) => state.replaceCart);
  const clearPublicCart = usePublicStoreCartStore((state) => state.clearCart);
  const cart = slug ? cartsBySlug[slug] ?? {} : {};

  const [checkout, setCheckout] = useState<CheckoutState>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    addressLine1: "",
    city: "",
    postcode: "",
    country: "United Kingdom",
  });

  const pageTrackedRef = useRef(false);
  const scrollViewRef = useRef<ScrollView | null>(null);
  const pendingCheckoutRef = useRef<{
    intent: CheckoutIntent;
    snapshot: ServerCartSnapshotItem[];
  } | null>(null);

  const trackStoreEvent = async (
    event: PublicStoreEvent,
    metadata: PublicStoreEventMetadata = {},
  ) => {
    if (!(vendor?.storeSlug ?? slug)) return;

    try {
      const analytics = await publicStoreService.trackEvent(vendor?.storeSlug ?? slug ?? "", event, metadata);
      setInsights(analytics);
    } catch {}
  };

  useEffect(() => {
    if (!slug) {
      setError("Missing store slug.");
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const nextVendor = await publicStoreService.getStore(slug);
        if (cancelled) return;

        const [nextProducts, nextReviews, analytics] = await Promise.all([
          publicStoreService.listProducts(nextVendor.storeSlug ?? slug).catch(() => [] as Product[]),
          reviewService.getForVendor(nextVendor.id).catch(() => [] as Review[]),
          publicStoreService
            .trackEvent(nextVendor.storeSlug ?? slug, "open", { source: shareSource })
            .catch(() => ({
              opens: 0,
              cartAdds: 0,
              checkoutStarts: 0,
              ordersPlaced: 0,
              trackRequests: 0,
              reorders: 0,
            })),
        ]);

        if (cancelled) return;

        setVendor(nextVendor);
        setProducts(nextProducts.filter((product) => product.status === "active" && product.stock > 0));
        setReviews(nextReviews);
        setInsights(analytics);
        if (!pageTrackedRef.current) {
          pageTrackedRef.current = true;
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load this store.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [shareSource, slug]);

  useEffect(() => {
    if (!vendor) return;
    if (checkout.country) return;

    const fallbackCountry =
      vendor.deliveryCountries?.[0] ||
      (vendor.country ? `United ${vendor.country}` : "") ||
      "United Kingdom";

    setCheckout((current) => ({ ...current, country: fallbackCountry }));
  }, [checkout.country, vendor]);

  useEffect(() => {
    if (!panelParam) return;

    if (panelParam === "checkout" || panelParam === "cart" || panelParam === "find") {
      setPanelMode(panelParam);
      setDrawerOpen(true);
    }
  }, [panelParam]);

  useEffect(() => {
    if (!orderParam || user?.role !== "buyer" || !vendor) return;

    let cancelled = false;

    (async () => {
      try {
        const backendOrder = await orderService.getBuyerOrderById(orderParam);
        if (cancelled) return;
        const nextOrder = mapBackendOrderToPublicOrder(backendOrder, vendor, vendor.storeSlug ?? slug ?? "", {
          firstName: checkout.firstName,
          lastName: checkout.lastName,
          email: checkout.email,
          phone: checkout.phone,
          addressLine1: checkout.addressLine1,
          city: checkout.city,
          postcode: checkout.postcode,
          country: checkout.country,
        });
        setMatchedOrders([nextOrder]);
        setActiveOrder(nextOrder);
        setPanelMode("tracking");
        setDrawerOpen(true);
      } catch {}
    })();

    return () => {
      cancelled = true;
    };
  }, [checkout.addressLine1, checkout.city, checkout.country, checkout.email, checkout.firstName, checkout.lastName, checkout.phone, checkout.postcode, orderParam, slug, user?.role, vendor]);

  useEffect(() => {
    if (!activeOrder?.backendOrderId || user?.role !== "buyer") return;

    let cancelled = false;

    (async () => {
      try {
        const backendOrderId = activeOrder.backendOrderId;
        if (!backendOrderId) return;
        const latest = await orderService.getBuyerOrderById(backendOrderId);
        if (cancelled || !vendor) return;
        const nextOrder = mapBackendOrderToPublicOrder(latest, vendor, vendor.storeSlug ?? slug ?? "", {
          firstName: activeOrder.contact.firstName,
          lastName: activeOrder.contact.lastName,
          email: activeOrder.contact.email,
          phone: activeOrder.contact.phone,
          addressLine1: activeOrder.contact.addressLine1,
          city: activeOrder.contact.city,
          postcode: activeOrder.contact.postcode,
          country: activeOrder.contact.country,
        });
        setActiveOrder(nextOrder);
      } catch {}
    })();

    return () => {
      cancelled = true;
    };
  }, [activeOrder?.backendOrderId, slug, user?.role, vendor]);

  const averageRating = useMemo(() => {
    if (reviews.length === 0) return 0;
    return reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length;
  }, [reviews]);

  const reviewSummary =
    reviews.length === 0
      ? "No reviews yet"
      : `${averageRating.toFixed(1)} rating from ${reviews.length} review${reviews.length === 1 ? "" : "s"}`;

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    const visibleProducts = term
      ? products.filter((item) => `${item.name} ${item.description} ${item.category}`.toLowerCase().includes(term))
      : products;

    if (!sharedProductId) return visibleProducts;

    return [...visibleProducts].sort((left, right) => {
      if (left.id === sharedProductId) return -1;
      if (right.id === sharedProductId) return 1;
      return 0;
    });
  }, [products, search, sharedProductId]);

  useEffect(() => {
    if (!sharedProductId || filteredProducts.length === 0) return;

    const match = filteredProducts.find((entry) => entry.id === sharedProductId);
    if (match) {
      setSelectedProduct(match);
      setDrawerOpen(true);
    }
  }, [filteredProducts, sharedProductId]);

  const cartItems = useMemo(
    () =>
      Object.entries(cart)
        .map(([productId, quantity]) => ({
          product: products.find((product) => product.id === productId),
          quantity,
        }))
        .filter((item): item is { product: Product; quantity: number } => Boolean(item.product) && item.quantity > 0),
    [cart, products],
  );

  const totalItems = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.quantity, 0),
    [cartItems],
  );

  const subtotal = useMemo(
    () => roundMoney(cartItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0)),
    [cartItems],
  );

  const totalWeight = useMemo(
    () => cartItems.reduce((sum, item) => sum + (item.product.weight ?? 0.5) * item.quantity, 0),
    [cartItems],
  );

  const estimatedDelivery = useMemo(() => {
    if (cartItems.length === 0) return 0;
    return roundMoney(Math.max(3.5, 2.75 + totalWeight * 1.2));
  }, [cartItems, totalWeight]);

  const platformFee = useMemo(
    () => roundMoney(subtotal * 0.045),
    [subtotal],
  );

  const total = useMemo(
    () => roundMoney(subtotal + estimatedDelivery + platformFee),
    [estimatedDelivery, platformFee, subtotal],
  );

  const currency = cartItems[0]?.product.currency ?? products[0]?.currency ?? "GBP";
  const storeUrl = getPublicStoreUrl({
    shareUrl: vendor?.shareUrl,
    storeSlug: vendor?.storeSlug ?? slug,
    storeName: vendor?.storeName,
  });
  const deliveryCountries = (vendor?.deliveryCountries?.length
    ? vendor.deliveryCountries
    : [vendor?.country].filter(Boolean)) as string[];

  const canSubmitCheckout =
    cartItems.length > 0 &&
    checkout.firstName.trim().length > 1 &&
    checkout.lastName.trim().length > 1 &&
    checkout.email.trim().includes("@") &&
    checkout.phone.trim().length >= 8 &&
    checkout.addressLine1.trim().length > 4 &&
    checkout.city.trim().length > 1 &&
    checkout.postcode.trim().length > 2;

  const currentDelivery = deliveryEstimates[0]?.cost ?? estimatedDelivery;
  const currentGrandTotal = roundMoney(subtotal + currentDelivery + platformFee);
  const cartCurrency = cartItems[0]?.product.currency ?? null;

  const buildContactFromOrder = (order: Order): CheckoutState => {
    const recipientName = order.deliveryDetails?.recipientName?.trim() || order.buyerName?.trim() || `${checkout.firstName} ${checkout.lastName}`.trim();
    const [firstName = "", ...rest] = recipientName.split(/\s+/).filter(Boolean);

    return {
      firstName,
      lastName: rest.join(" "),
      email: user?.role === "buyer" && typeof user.email === "string" ? user.email : checkout.email,
      phone: order.deliveryDetails?.phone ?? checkout.phone,
      addressLine1: order.deliveryDetails?.address ?? order.deliveryAddress ?? checkout.addressLine1,
      city: order.deliveryDetails?.city ?? checkout.city,
      postcode: order.deliveryDetails?.postalCode ?? checkout.postcode,
      country: order.deliveryDetails?.country ?? checkout.country,
    };
  };

  const mapOrderForStore = (order: Order): PublicStoreOrder => {
    if (!vendor) {
      throw new Error("Store details are not ready yet.");
    }

    return mapBackendOrderToPublicOrder(order, vendor, vendor.storeSlug ?? slug ?? "", buildContactFromOrder(order));
  };

  const loadBuyerOrdersForStore = async (): Promise<PublicStoreOrder[]> => {
    if (!vendor) {
      throw new Error("Store details are not ready yet.");
    }
    if (user?.role !== "buyer") {
      throw new Error("Sign in with your buyer account to view orders for this store.");
    }

    const orders = await orderService.getBuyerOrders();
    return orders
      .filter((order) => order.vendorId === vendor.id)
      .map((order) => mapOrderForStore(order))
      .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
  };

  const syncCheckoutOrder = async (orderIds: string[]): Promise<PublicStoreOrder> => {
    const backendOrderId = orderIds[0];
    if (!backendOrderId) {
      throw new Error("We could not match this payment to an order yet.");
    }

    let lastError: unknown = null;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        const latest = await orderService.getBuyerOrderById(backendOrderId);
        return mapOrderForStore(latest);
      } catch (error) {
        lastError = error;
        await wait(1200);
      }
    }

    throw lastError instanceof Error ? lastError : new Error("We are still syncing your order.");
  };

  const incrementCart = async (product: Product, amount = 1) => {
    if (cartCurrency && cartCurrency !== product.currency) {
      setPanelError(`This cart already contains ${cartCurrency} items. Place one currency at a time.`);
      setDrawerOpen(true);
      return;
    }

    if (!slug) return;

    addPublicCartItem(slug, product.id, amount);
    setPanelError("");
    setDrawerOpen(true);
    await trackStoreEvent("add_to_cart", {
      source: shareSource,
      productId: product.id,
      productName: product.name,
      quantity: amount,
    });
  };

  const decrementCart = (productId: string) => {
    if (!slug) return;
    decrementPublicCartItem(slug, productId);
  };

  const handleOpenCheckout = async () => {
    if (cartItems.length === 0) {
      setPanelError("Add at least one product to continue.");
      return;
    }

    await trackStoreEvent("start_checkout", {
      source: shareSource,
    });

    setPanelError("");
    setPanelMode("checkout");
    setDrawerOpen(true);
  };

  const validateCheckout = (): string | null => {
    if (!canSubmitCheckout) return "Fill in your delivery details to continue.";
    if (user && user.role !== "buyer") {
      return "Checkout needs a buyer session. Open this link in a guest browser or sign out first.";
    }
    return null;
  };

  const createBuyerSessionIfNeeded = async () => {
    if (user?.role === "buyer") return;
    if (user) {
      throw new Error("Checkout needs a buyer session. Open this link in a guest browser or sign out first.");
    }

    try {
      const randomPassword = `Eki-${Math.random().toString(36).slice(2, 10)}${Date.now().toString().slice(-4)}`;
      setSessionSubmitting(true);
      await authService.register({
        name: `${checkout.firstName.trim()} ${checkout.lastName.trim()}`.trim(),
        email: checkout.email.trim().toLowerCase(),
        password: randomPassword,
        phone: checkout.phone.trim(),
        role: "buyer",
        country: checkout.country,
      });
      await useAuthStore.getState().checkAuth();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not create your secure checkout profile.";
      if (/already|exists|registered|taken/i.test(message)) {
        setShowSignIn(true);
        throw new Error("This email already belongs to an Eki account. Sign in below to finish checkout.");
      }
      throw err;
    } finally {
      setSessionSubmitting(false);
    }
  };

  const signInExistingBuyer = async () => {
    if (!checkout.email.trim() || !signInPassword.trim()) {
      throw new Error("Enter your password to continue.");
    }

    setSessionSubmitting(true);
    try {
      await authService.login({
      email: checkout.email.trim().toLowerCase(),
      password: signInPassword.trim(),
      expectedRole: "buyer",
      });
      await useAuthStore.getState().checkAuth();
      setShowSignIn(false);
    } finally {
      setSessionSubmitting(false);
    }
  };

  const snapshotServerCart = async (): Promise<ServerCartSnapshotItem[]> => {
    await syncServerCart();
    return useCartStore.getState().serverItems.map((item: ServerCartItem) => ({
      productId: item.productId,
      quantity: item.quantity,
    }));
  };

  const restoreServerCartSnapshot = async (snapshot: ServerCartSnapshotItem[]) => {
    await clearServerCart().catch(() => {});
    for (const item of snapshot) {
      const product = await productService.getById(item.productId);
      await addServerItem(product, item.quantity);
    }
  };

  const replaceServerCartWithPublicBasket = async () => {
    await clearServerCart().catch(() => {});
    for (const item of cartItems) {
      await addServerItem(item.product, item.quantity);
    }
  };

  const prepareBrowserCheckout = async (): Promise<string> => {
    const checkoutValidation = validateCheckout();
    if (checkoutValidation) {
      setPanelError(checkoutValidation);
      throw new Error(checkoutValidation);
    }

    setPanelError("");

    if (showSignIn && !user) {
      await signInExistingBuyer();
    } else {
      await createBuyerSessionIfNeeded();
    }

    const snapshot = await snapshotServerCart();
    await replaceServerCartWithPublicBasket();
    await calculateDelivery(checkout.country.trim());

    const intent = await createCheckout(buildContactLabel(checkout));
    if (!intent.clientSecret || intent.clientSecret === "wallet_paid") {
      throw new Error("Card payment is not ready for this order.");
    }

    pendingCheckoutRef.current = { intent, snapshot };
    return intent.clientSecret;
  };

  const finalizeSuccessfulCheckout = async (_paymentId: string | null) => {
    if (!vendor || !slug) return;

    const pending = pendingCheckoutRef.current;
    if (!pending) {
      throw new Error("This checkout session has expired. Refresh the page and try again.");
    }

    try {
      const nextOrder = await syncCheckoutOrder(pending.intent.orderIds);
      await trackStoreEvent("place_order", {
        source: shareSource,
        orderTotal: currentGrandTotal,
        orderIds: pending.intent.orderIds,
        items: buildOrderItems(cartItems),
      });
      setActiveOrder(nextOrder);
      setMatchedOrders([nextOrder]);
      setPanelMode("confirmed");
      setDrawerOpen(true);
      clearPublicCart(slug);
      setLookupContact(checkout.email.trim().toLowerCase());
      setLookupCode("");
      setLookupStatus("");
      setSaveAccountState("idle");
    } catch (error) {
      setActiveOrder(null);
      setMatchedOrders([]);
      setLookupContact(checkout.email.trim().toLowerCase());
      setLookupStatus("Payment received. We are still syncing your order to your buyer account. Use this email to sign in and track it.");
      setPanelMode("syncing");
      setDrawerOpen(true);
      clearPublicCart(slug);
      setSaveAccountState("idle");
      setLookupCode("");
      setOrderLookupError(error instanceof Error ? error.message : "We are still syncing your order.");
    } finally {
      if (pending.snapshot.length > 0) {
        await restoreServerCartSnapshot(pending.snapshot).catch(() => {});
      } else {
        await clearServerCart().catch(() => {});
      }

      pendingCheckoutRef.current = null;
    }
  };

  const handlePaymentError = async (message: string) => {
    setPanelError(message);
    const pending = pendingCheckoutRef.current;
    if (pending?.snapshot?.length) {
      await restoreServerCartSnapshot(pending.snapshot).catch(() => {});
      pendingCheckoutRef.current = null;
    }
  };

  const handleFindOrder = async () => {
    if (!lookupContact.trim()) {
      setOrderLookupError("Enter the email you used at checkout.");
      return;
    }

    const normalizedContact = lookupContact.trim().toLowerCase();
    setOrderLookupError("");
    setLookupStatus("");
    setLookupCode("");
    setDrawerOpen(true);
    setPanelMode("find");

    await trackStoreEvent("track_order", {
      source: shareSource,
    });

    if (!normalizedContact.includes("@")) {
      setOrderLookupError("Use the checkout email address to receive access to your order.");
      return;
    }

    try {
      if (user?.role === "buyer" && typeof user.email === "string" && user.email.trim().toLowerCase() === normalizedContact) {
        const buyerOrders = await loadBuyerOrdersForStore();
        if (buyerOrders.length === 0) {
          setOrderLookupError("No orders from this store were found on your buyer account yet.");
          return;
        }

        setMatchedOrders(buyerOrders);
        setActiveOrder(buyerOrders[0] ?? null);
        setPanelMode(buyerOrders.length === 1 ? "tracking" : "orders");
        return;
      }

      await publicStoreService.requestLookupCode(vendor?.storeSlug ?? slug ?? "", normalizedContact);
      setLookupStatus(`We sent a 6-digit code to ${normalizedContact}. Enter it below to open your order history.`);
      setPanelMode("verify");
    } catch (error) {
      setOrderLookupError(error instanceof Error ? error.message : "We could not load your order access right now.");
    }
  };

  const handleVerifyOrderLookup = async () => {
    if (!lookupContact.trim()) {
      setOrderLookupError("Enter the email you used at checkout.");
      return;
    }
    if (!lookupCode.trim()) {
      setOrderLookupError("Enter the 6-digit code we sent to your email.");
      return;
    }

    setOrderLookupError("");

    try {
      const orders = await publicStoreService.verifyLookupCode(
        vendor?.storeSlug ?? slug ?? "",
        lookupContact.trim().toLowerCase(),
        lookupCode.trim(),
      );

      if (orders.length === 0) {
        setOrderLookupError("No orders from this store were found for that email yet.");
        return;
      }

      setMatchedOrders(orders);
      setActiveOrder(orders[0] ?? null);
      setLookupStatus("");
      setPanelMode(orders.length === 1 ? "tracking" : "orders");
    } catch (error) {
      setOrderLookupError(error instanceof Error ? error.message : "We could not verify that code.");
    }
  };

  const handleRestoreOrder = async (order: PublicStoreOrder) => {
    if (!vendor || !slug) return;

    const nextCart: Record<string, number> = {};
    order.items.forEach((item) => {
      const product = products.find((entry) => entry.id === item.productId);
      if (product) {
        nextCart[product.id] = item.quantity;
      }
    });

    if (Object.keys(nextCart).length === 0) {
      setPanelError("This vendor has changed their products since your last order.");
      return;
    }

    replacePublicCart(slug, nextCart);
    setPanelMode("checkout");
    setDrawerOpen(true);
    setCheckout({
      firstName: order.contact.firstName,
      lastName: order.contact.lastName,
      email: order.contact.email,
      phone: order.contact.phone,
      addressLine1: order.contact.addressLine1,
      city: order.contact.city,
      postcode: order.contact.postcode,
      country: order.contact.country,
    });

    await trackStoreEvent("reorder", {
      source: shareSource,
    });
  };

  const openProductDetails = (product: Product) => {
    const nextSlug = vendor?.storeSlug ?? slug;
    if (!nextSlug) return;

    router.push({
      pathname: "/store/[slug]/product/[productId]",
      params: { slug: nextSlug, productId: product.id },
    } as any);
  };

  const handleCopyStoreLink = async () => {
    try {
      await Clipboard.setStringAsync(storeUrl);
      setCopyState("copied");
      setTimeout(() => setCopyState("idle"), 2200);
    } catch {
      setCopyState("error");
      setTimeout(() => setCopyState("idle"), 2200);
    }
  };

  const handleProductsSectionLayout = (event: LayoutChangeEvent) => {
    setProductSectionY(event.nativeEvent.layout.y);
  };

  const handleScrollToProducts = () => {
    scrollViewRef.current?.scrollTo({ y: Math.max(productSectionY - 120, 0), animated: true });
  };

  const handleBuyNow = async (product: Product) => {
    if ((cart[product.id] ?? 0) <= 0) {
      await incrementCart(product);
    }
    setSelectedProduct(null);
    setPanelError("");
    setPanelMode("checkout");
    setDrawerOpen(true);
  };

  const handleSendAccessEmail = async () => {
    const email = activeOrder?.contact.email || checkout.email.trim().toLowerCase();
    const currentSlug = vendor?.storeSlug ?? slug;
    if (!email || !currentSlug) return;

    setSaveAccountState("sending");
    try {
      await publicStoreService.requestLookupCode(currentSlug, email);
      setLookupContact(email);
      setLookupStatus(`We sent a 6-digit order access code to ${email}.`);
      setSaveAccountState("sent");
    } catch {
      setSaveAccountState("error");
    }
  };

  if (loading) {
    return (
      <View style={styles.stateScreen}>
        <ActivityIndicator color="#076B51" />
      </View>
    );
  }

  if (!vendor) {
    return (
      <SafeAreaView style={styles.stateScreen}>
        <Ionicons name="storefront-outline" size={38} color="#9AA3A0" />
        <Text style={styles.stateTitle}>{error || "Store not found."}</Text>
        <TouchableOpacity onPress={() => router.replace("/" as any)} activeOpacity={0.88} style={styles.primaryCta}>
          <Text style={styles.primaryCtaText}>Open Eki</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const panel = (
    <StorePanel
      mode={panelMode}
      currency={currency}
      cartItems={cartItems}
      subtotal={subtotal}
      delivery={currentDelivery}
      platformFee={platformFee}
      total={currentGrandTotal}
      panelError={panelError}
      orderLookupError={orderLookupError}
      lookupStatus={lookupStatus}
      lookupContact={lookupContact}
      setLookupContact={setLookupContact}
      lookupCode={lookupCode}
      setLookupCode={setLookupCode}
      checkout={checkout}
      setCheckout={setCheckout}
      canSubmitCheckout={canSubmitCheckout}
      onOpenCheckout={handleOpenCheckout}
      onOpenOrderLookup={() => {
        setOrderLookupError("");
        setLookupStatus("");
        setLookupCode("");
        setPanelMode("find");
      }}
      onFindOrder={handleFindOrder}
      onVerifyOrderLookup={handleVerifyOrderLookup}
      onClose={() => {
        setDrawerOpen(false);
        if (panelMode === "find" || panelMode === "verify") setPanelMode("cart");
      }}
      onBackToCart={() => {
        setPanelError("");
        setShowSignIn(false);
        setPanelMode("cart");
      }}
      onBackToTracking={() => setPanelMode(activeOrder ? "tracking" : "orders")}
      activeOrder={activeOrder}
      matchedOrders={matchedOrders}
      onSelectOrder={(order) => {
        setActiveOrder(order);
        setPanelMode("tracking");
      }}
      onRestoreOrder={handleRestoreOrder}
      saveAccountState={saveAccountState}
      onSendAccessEmail={handleSendAccessEmail}
      showSignIn={showSignIn}
      signInPassword={signInPassword}
      setSignInPassword={setSignInPassword}
      authLoading={authLoading || sessionSubmitting}
      webCheckout={
        <WebStripeCheckoutForm
          amountLabel={formatMoney(currentGrandTotal, currency)}
          disabled={!canSubmitCheckout || authLoading || sessionSubmitting}
          billingEmail={checkout.email.trim().toLowerCase()}
          billingName={`${checkout.firstName.trim()} ${checkout.lastName.trim()}`.trim()}
          onBeforeConfirm={prepareBrowserCheckout}
          onSuccess={finalizeSuccessfulCheckout}
          onError={handlePaymentError}
        />
      }
    />
  );

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        ref={scrollViewRef}
        style={styles.screen}
        contentContainerStyle={styles.screenBody}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <View style={styles.brandDot} />
            <View>
              <Text style={styles.brandText}>Culinary Tales</Text>
              <Text style={styles.brandCaption}>Verified vendor storefront</Text>
            </View>
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity
              activeOpacity={0.88}
              onPress={() => {
                setDrawerOpen(true);
                setPanelMode("find");
              }}
              style={styles.ghostButton}
            >
              <Ionicons name="search-outline" size={18} color="#0A6C52" />
              <Text style={styles.ghostButtonText}>Find your order</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.88}
              onPress={() => {
                setDrawerOpen(true);
                setPanelMode(totalItems > 0 ? "cart" : "find");
              }}
              style={styles.cartChip}
            >
              <Text style={styles.cartChipText}>View Cart ({totalItems})</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.layout, isDesktop && styles.layoutDesktop]}>
          <View style={styles.mainColumn}>
            {isPreview ? (
              <View style={styles.previewBanner}>
                <Text style={styles.previewBannerTitle}>Preview only</Text>
                <Text style={styles.previewBannerBody}>
                  Auto-generated from your Eki products. Buyers will see the same store link when you share it.
                </Text>
              </View>
            ) : null}

            <View style={styles.storeOverviewShell}>
              <View style={styles.storeOverviewBanner}>
                <RemoteImage
                  uri={vendor.coverImage}
                  style={styles.storeOverviewImage}
                  borderRadius={26}
                  fallbackIcon="storefront-outline"
                />
                <View style={styles.storeOverviewOverlay} />
              </View>

              <View style={styles.storeOverviewCard}>
                <View style={styles.storeOverviewHeader}>
                  <View style={styles.storeOverviewAvatarWrap}>
                    <VendorAvatar label={buildInitials(vendor.storeName)} square />
                  </View>

                  <View style={styles.storeOverviewCopy}>
                    <View style={styles.storeOverviewTitleRow}>
                      <Text style={styles.storeOverviewTitle}>{vendor.storeName}</Text>
                      <View style={styles.verifiedBadge}>
                        <Ionicons name="checkmark-circle" size={14} color="#0A6C52" />
                        <Text style={styles.verifiedBadgeText}>Verified</Text>
                      </View>
                    </View>

                    <Text style={styles.storeOverviewLocation}>
                      {vendor.city || vendor.country || "United Kingdom"}
                    </Text>
                    <Text style={styles.storeOverviewDescription}>
                      {vendor.description || "Authentic foodstuff ready for secure browser checkout and fast order tracking."}
                    </Text>
                  </View>
                </View>

                <View style={styles.storeOverviewMetaRow}>
                  <Text style={styles.storeOverviewMetaLabel}>Ships to</Text>
                  <View style={styles.chipWrap}>
                    {deliveryCountries.map((country) => (
                      <View key={country} style={styles.countryChip}>
                        <Text style={styles.countryChipText}>{country}</Text>
                      </View>
                    ))}
                  </View>
                </View>

                <View style={styles.storeOverviewStats}>
                  <View style={styles.summaryStat}>
                    <Text style={styles.summaryStatValue}>{products.length}</Text>
                    <Text style={styles.summaryStatLabel}>Live products</Text>
                  </View>
                  <View style={styles.summaryStat}>
                    <Text style={styles.summaryStatValue}>{reviewSummary === "No reviews yet" ? "New" : averageRating.toFixed(1)}</Text>
                    <Text style={styles.summaryStatLabel}>Buyer rating</Text>
                  </View>
                  <View style={styles.summaryStat}>
                    <Text style={styles.summaryStatValue}>{insights.opens}</Text>
                    <Text style={styles.summaryStatLabel}>Store opens</Text>
                  </View>
                </View>

                <View style={styles.storeOverviewActions}>
                  <TouchableOpacity activeOpacity={0.88} onPress={handleCopyStoreLink} style={styles.primaryHeroAction}>
                    <Ionicons name={copyState === "copied" ? "checkmark" : "copy-outline"} size={16} color="#FFFFFF" />
                    <Text style={styles.primaryHeroActionText}>
                      {copyState === "copied" ? "Copied" : copyState === "error" ? "Copy failed" : "Copy share link"}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity activeOpacity={0.88} onPress={handleScrollToProducts} style={styles.secondaryHeroAction}>
                    <Text style={styles.secondaryHeroActionText}>View products</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.88}
                    onPress={() => {
                      setDrawerOpen(true);
                      setPanelMode("find");
                    }}
                    style={styles.secondaryHeroAction}
                  >
                    <Text style={styles.secondaryHeroActionText}>Track order</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <View style={styles.storeCard} onLayout={handleProductsSectionLayout}>
              <View style={styles.storeCardHeader}>
                <View>
                  <Text style={styles.sectionEyebrow}>Products</Text>
                  <Text style={styles.sectionTitle}>Shop directly from this vendor</Text>
                </View>
                <View style={styles.metricPill}>
                  <Ionicons name="pulse-outline" size={16} color="#0A6C52" />
                  <Text style={styles.metricPillText}>{products.length} items</Text>
                </View>
              </View>

              <View style={styles.searchRow}>
                <Ionicons name="search-outline" size={18} color="#8A8F94" />
                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Search products..."
                  placeholderTextColor="#8A8F94"
                  style={styles.searchInput}
                />
              </View>

              {promo ? (
                <View style={styles.promoBanner}>
                  <Ionicons name="gift-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.promoBannerText}>Promo code {promo} is active for this shared store link.</Text>
                </View>
              ) : null}
              {sharedProductId ? (
                <View style={styles.focusBanner}>
                  <Ionicons name="pricetag-outline" size={18} color="#0A6C52" />
                  <Text style={styles.focusBannerText}>This link opens a specific shared product first.</Text>
                </View>
              ) : null}


              <View style={[styles.productGrid, isDesktop && styles.productGridDesktop]}>
                {filteredProducts.length === 0 ? (
                  <View style={styles.emptyPanelCard}>
                    <Ionicons name="storefront-outline" size={24} color="#687076" />
                    <Text style={styles.emptyPanelTitle}>No products available right now</Text>
                    <Text style={styles.emptyPanelCopy}>
                      This vendor has not published live products for this shared storefront yet.
                    </Text>
                  </View>
                ) : null}
                {filteredProducts.map((product) => {
                  const quantity = cart[product.id] ?? 0;
                  const isSharedProduct = sharedProductId === product.id;

                  return (
                    <View key={product.id} style={[styles.productCard, isDesktop && styles.productCardDesktop]}>
                      <TouchableOpacity activeOpacity={0.92} onPress={() => openProductDetails(product)}>
                        <RemoteImage uri={product.images?.[0]} style={styles.productCardImage} borderRadius={20} />
                      </TouchableOpacity>
                      <View style={styles.productCardBody}>
                        <View style={styles.productTopRow}>
                          <TouchableOpacity style={{ flex: 1 }} activeOpacity={0.88} onPress={() => openProductDetails(product)}>
                            <Text style={styles.productCardTitle} numberOfLines={1}>
                              {product.name}
                            </Text>
                            <Text style={styles.productCardMeta}>
                              {productUnitLabel(product)} · Ships from {vendor.city || vendor.country} · Delivery 2-4 days
                            </Text>
                          </TouchableOpacity>
                          <View style={[styles.stockChip, isSharedProduct && styles.focusStockChip]}>
                            <Text style={[styles.stockChipText, isSharedProduct && styles.focusStockChipText]}>{isSharedProduct ? "Shared link" : "In Stock"}</Text>
                          </View>
                        </View>

                        <TouchableOpacity activeOpacity={0.88} onPress={() => openProductDetails(product)}>
                          <Text style={styles.productCardDescription} numberOfLines={3}>
                            {product.description || "Freshly packed and ready for secure checkout on Eki."}
                          </Text>
                        </TouchableOpacity>

                        <View style={styles.productFooter}>
                          <View style={styles.productFooterPrimary}>
                            <Text style={styles.productPrice}>{formatMoney(product.price, product.currency)}</Text>
                            <TouchableOpacity onPress={() => openProductDetails(product)} activeOpacity={0.88} style={styles.detailsButton}>
                              <Text style={styles.detailsButtonText}>View product</Text>
                            </TouchableOpacity>
                          </View>
                          {quantity > 0 ? (
                            <View style={styles.quantityControl}>
                              <TouchableOpacity onPress={() => decrementCart(product.id)} activeOpacity={0.88} style={styles.quantityButton}>
                                <Ionicons name="remove" size={16} color="#0A6C52" />
                              </TouchableOpacity>
                              <Text style={styles.quantityValue}>{quantity}</Text>
                              <TouchableOpacity onPress={() => incrementCart(product)} activeOpacity={0.88} style={styles.quantityButtonFilled}>
                                <Ionicons name="add" size={16} color="#FFFFFF" />
                              </TouchableOpacity>
                            </View>
                          ) : (
                            <TouchableOpacity onPress={() => incrementCart(product)} activeOpacity={0.88} style={styles.addButton}>
                              <Text style={styles.addButtonText}>Add to Cart</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>

              <View style={styles.subSection}>
                <Text style={styles.subSectionTitle}>Why buyers choose Eki</Text>
                <View style={styles.featureGrid}>
                  <FeatureItem icon="shield-checkmark-outline" title="Secure Eki checkout" body="Pay securely and keep a clean payment record." />
                  <FeatureItem icon="navigate-outline" title="Live order tracking" body="Track from order placed through delivery." />
                  <FeatureItem icon="refresh-outline" title="One-tap reorder" body="Save your basket and buy again faster next time." />
                </View>
              </View>

              <View style={styles.subSection}>
                <Text style={styles.subSectionTitle}>Reviews</Text>
                {reviews.length === 0 ? (
                  <View style={styles.emptyPanelCard}>
                    <Ionicons name="chatbubble-ellipses-outline" size={20} color="#687076" />
                    <Text style={styles.emptyPanelTitle}>No reviews yet</Text>
                    <Text style={styles.emptyPanelCopy}>
                      Reviews will appear here after buyers complete and review their orders.
                    </Text>
                  </View>
                ) : (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.reviewRow}>
                    {reviews.map((review) => (
                      <View key={review.id} style={styles.reviewCard}>
                        <View style={styles.reviewStars}>
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Ionicons key={star} name="star" size={15} color={star <= review.rating ? "#F4B400" : "#DFE3E1"} />
                          ))}
                        </View>
                        <Text style={styles.reviewBody} numberOfLines={4}>{review.comment}</Text>
                        <Text style={styles.reviewAuthor}>{review.userName}</Text>
                      </View>
                    ))}
                  </ScrollView>
                )}
              </View>

              <View style={styles.lookupCallout}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.lookupCalloutTitle}>Already have an order?</Text>
                  <Text style={styles.lookupCalloutBody}>Find it with your checkout email, then track it or reorder in seconds.</Text>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    setDrawerOpen(true);
                    setPanelMode("find");
                  }}
                  activeOpacity={0.88}
                  style={styles.lookupCalloutButton}
                >
                  <Text style={styles.lookupCalloutButtonText}>Find your order</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {isDesktop ? (
            <View style={styles.sideColumn}>
              <View style={styles.sideSticky}>{panel}</View>
            </View>
          ) : null}
        </View>
      </ScrollView>

      {!isDesktop ? (
        <>
          <View style={styles.mobileBottomBar}>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => {
                setDrawerOpen(true);
                setPanelMode(totalItems > 0 ? "cart" : "find");
              }}
              style={styles.mobileBottomButton}
            >
              <Text style={styles.mobileBottomButtonText}>
                {totalItems > 0
                  ? `View cart ${totalItems} items ${formatMoney(total, currency)}`
                  : "Find your order"}
              </Text>
              <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <Modal visible={drawerOpen} animationType="slide" transparent onRequestClose={() => setDrawerOpen(false)}>
            <Pressable style={styles.modalScrim} onPress={() => setDrawerOpen(false)} />
            <View style={styles.mobilePanel}>{panel}</View>
          </Modal>
        </>
      ) : null}

      <Modal
        visible={Boolean(selectedProduct)}
        animationType="fade"
        transparent
        onRequestClose={() => setSelectedProduct(null)}
      >
        <Pressable style={styles.productModalScrim} onPress={() => setSelectedProduct(null)}>
          <Pressable style={styles.productModalCard} onPress={() => undefined}>
            {selectedProduct ? (
              <>
                <RemoteImage
                  uri={selectedProduct.images?.[0]}
                  style={styles.productModalImage}
                  borderRadius={26}
                />
                <View style={styles.productModalBody}>
                  <View style={styles.productModalTopRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.productModalTitle}>{selectedProduct.name}</Text>
                      <Text style={styles.productModalMeta}>
                        {productUnitLabel(selectedProduct)} · Ships from {vendor?.city || vendor?.country || "this vendor"}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => setSelectedProduct(null)}
                      activeOpacity={0.88}
                      style={styles.productModalClose}
                    >
                      <Ionicons name="close" size={18} color="#687076" />
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.productModalDescription}>
                    {selectedProduct.description || "Freshly packed and ready for secure checkout on Culinary Tales."}
                  </Text>

                  <View style={styles.productModalSummary}>
                    <Text style={styles.productModalPrice}>
                      {formatMoney(selectedProduct.price, selectedProduct.currency)}
                    </Text>
                    <Text style={styles.productModalStock}>In stock</Text>
                  </View>

                  <View style={styles.productModalActions}>
                    <TouchableOpacity
                      onPress={() => incrementCart(selectedProduct)}
                      activeOpacity={0.88}
                      style={styles.addButton}
                    >
                      <Text style={styles.addButtonText}>Add to Cart</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleBuyNow(selectedProduct)}
                      activeOpacity={0.88}
                      style={styles.primaryCta}
                    >
                      <Text style={styles.primaryCtaText}>Buy now</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function VendorAvatar({ label, square = false }: { label: string; square?: boolean }) {
  return (
    <View style={[styles.vendorAvatar, square && styles.vendorAvatarSquare]}>
      <Text style={styles.vendorAvatarText}>{label}</Text>
    </View>
  );
}

function FeatureItem({ icon, title, body }: { icon: keyof typeof Ionicons.glyphMap; title: string; body: string }) {
  return (
    <View style={styles.featureCard}>
      <View style={styles.featureIcon}>
        <Ionicons name={icon} size={18} color="#0A6C52" />
      </View>
      <Text style={styles.featureTitle}>{title}</Text>
      <Text style={styles.featureBody}>{body}</Text>
    </View>
  );
}

function StatusStep({
  done,
  current,
  title,
  body,
}: {
  done: boolean;
  current: boolean;
  title: string;
  body: string;
}) {
  return (
    <View style={styles.timelineRow}>
      <View style={styles.timelineRail}>
        <View style={[styles.timelineDot, done && styles.timelineDotDone, current && styles.timelineDotCurrent]}>
          <Ionicons
            name={done ? "checkmark" : current ? "cube-outline" : "ellipse-outline"}
            size={done || current ? 14 : 12}
            color={done ? "#FFFFFF" : current ? "#0A6C52" : "#A0A8A4"}
          />
        </View>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.timelineTitle}>{title}</Text>
        <Text style={styles.timelineBody}>{body}</Text>
      </View>
    </View>
  );
}

function StorePanel(props: {
  mode: PanelMode;
  currency: string;
  cartItems: { product: Product; quantity: number }[];
  subtotal: number;
  delivery: number;
  platformFee: number;
  total: number;
  panelError: string;
  orderLookupError: string;
  lookupStatus: string;
  lookupContact: string;
  setLookupContact: (value: string) => void;
  lookupCode: string;
  setLookupCode: (value: string) => void;
  checkout: CheckoutState;
  setCheckout: React.Dispatch<React.SetStateAction<CheckoutState>>;
  canSubmitCheckout: boolean;
  onOpenCheckout: () => Promise<void>;
  onOpenOrderLookup: () => void;
  onFindOrder: () => Promise<void>;
  onVerifyOrderLookup: () => Promise<void>;
  onClose: () => void;
  onBackToCart: () => void;
  onBackToTracking: () => void;
  activeOrder: PublicStoreOrder | null;
  matchedOrders: PublicStoreOrder[];
  onSelectOrder: (order: PublicStoreOrder) => void;
  onRestoreOrder: (order: PublicStoreOrder) => Promise<void>;
  saveAccountState: "idle" | "sending" | "sent" | "error";
  onSendAccessEmail: () => Promise<void>;
  showSignIn: boolean;
  signInPassword: string;
  setSignInPassword: (value: string) => void;
  authLoading: boolean;
  webCheckout: React.ReactNode;
}) {
  const order = props.activeOrder;

  const steps = order
    ? [
        {
          title: "Order placed",
          body: new Date(order.createdAt).toLocaleString(),
          done: true,
          current: order.status === "placed",
        },
        {
          title: "Vendor confirmed",
          body: order.status === "accepted" || order.status === "preparing" || order.status === "dispatched" || order.status === "in_transit" || order.status === "delivered"
            ? "The vendor received your order."
            : "Pending",
          done: order.status !== "placed",
          current: order.status === "accepted",
        },
        {
          title: "Preparing your order",
          body: order.status === "preparing" || order.status === "dispatched" || order.status === "in_transit" || order.status === "delivered"
            ? "In progress..."
            : "Waiting to start",
          done: order.status === "dispatched" || order.status === "in_transit" || order.status === "delivered",
          current: order.status === "preparing",
        },
        {
          title: "Dispatched",
          body: order.status === "dispatched" || order.status === "in_transit" || order.status === "delivered"
            ? order.estimatedDeliveryLabel
            : "Pending",
          done: order.status === "in_transit" || order.status === "delivered",
          current: order.status === "dispatched",
        },
        {
          title: "Delivered",
          body: order.status === "delivered" ? "Completed" : "Pending",
          done: order.status === "delivered",
          current: false,
        },
      ]
    : [];

  return (
    <View style={styles.panelShell}>
      <View style={styles.panelHeader}>
        <View>
          <Text style={styles.panelBrand}>Culinary Tales</Text>
          <Text style={styles.panelSubtitle}>
            {props.mode === "tracking" || props.mode === "orders" || props.mode === "find"
              ? "Track your order"
              : props.mode === "verify"
              ? "Verify your identity"
              : props.mode === "confirmed"
              ? "Order confirmed"
              : props.mode === "syncing"
              ? "Order syncing"
              : props.mode === "checkout"
              ? "Complete your order"
              : "View Cart"}
          </Text>
        </View>
        <TouchableOpacity onPress={props.onClose} activeOpacity={0.88} style={styles.panelClose}>
          <Ionicons name="close" size={18} color="#687076" />
        </TouchableOpacity>
      </View>

      {props.mode === "cart" ? (
        <View style={styles.panelBody}>
          <Text style={styles.panelTitle}>Order Summary</Text>
          <Text style={styles.panelCopy}>Secure checkout · Instant confirmation · Track in Eki</Text>

          {props.cartItems.length === 0 ? (
            <View style={styles.emptyPanelCard}>
              <Ionicons name="bag-handle-outline" size={26} color="#9AA3A0" />
              <Text style={styles.emptyPanelTitle}>Your cart is empty</Text>
              <Text style={styles.emptyPanelCopy}>Add products from this store to start a secure Eki checkout.</Text>
            </View>
          ) : (
            <View style={styles.stack}>
              {props.cartItems.map((item) => (
                <View key={item.product.id} style={styles.summaryItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.summaryItemTitle}>{item.product.name}</Text>
                    <Text style={styles.summaryItemMeta}>
                      {productUnitLabel(item.product)} · Qty {item.quantity}
                    </Text>
                  </View>
                  <Text style={styles.summaryItemPrice}>{formatMoney(item.product.price * item.quantity, item.product.currency)}</Text>
                </View>
              ))}

              <View style={styles.summaryCard}>
                <SummaryRow label="Subtotal" value={formatMoney(props.subtotal, props.currency)} />
                <SummaryRow label="Delivery" value={formatMoney(props.delivery, props.currency)} />
                <SummaryRow label="Platform fee" value={formatMoney(props.platformFee, props.currency)} />
                <SummaryRow label="Total" value={formatMoney(props.total, props.currency)} strong />
              </View>

              {props.panelError ? <Text style={styles.errorText}>{props.panelError}</Text> : null}

              <TouchableOpacity onPress={() => props.onOpenCheckout()} activeOpacity={0.88} style={styles.primaryCta}>
                <Text style={styles.primaryCtaText}>Proceed to checkout</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={props.onOpenOrderLookup} activeOpacity={0.88} style={styles.secondaryCta}>
                <Text style={styles.secondaryCtaText}>Already have an order? Find it here</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      ) : null}

      {props.mode === "checkout" ? (
        <ScrollView style={styles.panelBody} showsVerticalScrollIndicator={false}>
          <Text style={styles.panelTitle}>Your details</Text>
          <Text style={styles.panelCopy}>No app required. Pay securely and receive confirmation instantly.</Text>

          <View style={styles.row}>
            <InputField label="First name" value={props.checkout.firstName} onChangeText={(value) => props.setCheckout((current) => ({ ...current, firstName: value }))} />
            <InputField label="Last name" value={props.checkout.lastName} onChangeText={(value) => props.setCheckout((current) => ({ ...current, lastName: value }))} />
          </View>

          <InputField label="Email" keyboardType="email-address" value={props.checkout.email} onChangeText={(value) => props.setCheckout((current) => ({ ...current, email: value }))} />
          <InputField label="Phone number" keyboardType="phone-pad" value={props.checkout.phone} onChangeText={(value) => props.setCheckout((current) => ({ ...current, phone: value }))} />

          <Text style={styles.formSectionTitle}>Delivery address</Text>
          <InputField label="Street address" value={props.checkout.addressLine1} onChangeText={(value) => props.setCheckout((current) => ({ ...current, addressLine1: value }))} />
          <View style={styles.row}>
            <InputField label="City" value={props.checkout.city} onChangeText={(value) => props.setCheckout((current) => ({ ...current, city: value }))} />
            <InputField label="Postcode" value={props.checkout.postcode} onChangeText={(value) => props.setCheckout((current) => ({ ...current, postcode: value }))} />
          </View>
          <InputField label="Country" value={props.checkout.country} onChangeText={(value) => props.setCheckout((current) => ({ ...current, country: value }))} />

          {props.showSignIn ? (
            <View style={styles.signInCard}>
              <Text style={styles.signInTitle}>This email already has an Eki account</Text>
              <Text style={styles.signInCopy}>Enter your password once and we will finish checkout on your existing buyer account.</Text>
              <InputField label="Password" secureTextEntry value={props.signInPassword} onChangeText={props.setSignInPassword} />
            </View>
          ) : null}

          <View style={styles.summaryCard}>
            <SummaryRow label="Subtotal" value={formatMoney(props.subtotal, props.currency)} />
            <SummaryRow label="Delivery" value={formatMoney(props.delivery, props.currency)} />
            <SummaryRow label="Platform fee" value={formatMoney(props.platformFee, props.currency)} />
            <SummaryRow label="Total" value={formatMoney(props.total, props.currency)} strong />
          </View>

          {props.panelError ? <Text style={styles.errorText}>{props.panelError}</Text> : null}

          {props.webCheckout}

          <TouchableOpacity onPress={props.onBackToCart} activeOpacity={0.88} style={styles.ghostAction}>
            <Text style={styles.ghostActionText}>Back to cart</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : null}

      {props.mode === "confirmed" && order ? (
        <ScrollView style={styles.panelBody} showsVerticalScrollIndicator={false}>
          <View style={styles.successBadge}>
            <Ionicons name="checkmark" size={24} color="#0A6C52" />
          </View>
          <Text style={styles.confirmedTitle}>Your order is now in Eki.</Text>
          <Text style={styles.confirmedBody}>Order {order.orderNumber}</Text>

          <View style={styles.confirmedCard}>
            <Text style={styles.confirmedStore}>{order.vendorName}</Text>
            <Text style={styles.confirmedMeta}>{order.vendorCity}</Text>
            <SummaryRow label="Order number" value={order.orderNumber} />
            <SummaryRow label="Placed" value={formatOrderDateTime(order.createdAt)} />
            <SummaryRow label="Total" value={formatMoney(order.total, order.currency)} />
            <SummaryRow label="Estimated delivery" value={order.estimatedDeliveryLabel} />
          </View>

          <TouchableOpacity onPress={props.onBackToTracking} activeOpacity={0.88} style={styles.primaryCta}>
            <Text style={styles.primaryCtaText}>Track this order</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => props.onRestoreOrder(order)} activeOpacity={0.88} style={styles.secondaryCta}>
            <Text style={styles.secondaryCtaText}>Reorder this basket</Text>
          </TouchableOpacity>

          <View style={styles.accountCard}>
            <Text style={styles.accountCardTitle}>Email my tracking code</Text>
            <Text style={styles.accountCardBody}>Send a secure 6-digit code to {order.contact.email} so you can reopen this order from any device.</Text>
            <TouchableOpacity onPress={() => props.onSendAccessEmail()} activeOpacity={0.88} style={styles.secondaryActionChip}>
              <Text style={styles.secondaryActionChipText}>
                {props.saveAccountState === "sending"
                  ? "Sending..."
                  : props.saveAccountState === "sent"
                  ? "Tracking code sent"
                  : props.saveAccountState === "error"
                  ? "Try sending again"
                  : "Email my tracking code"}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      ) : null}

      {props.mode === "find" ? (
        <View style={styles.panelBody}>
          <Text style={styles.panelTitle}>Find your order</Text>
          <Text style={styles.panelCopy}>
            Enter the checkout email. We will either open your buyer account orders or send a one-time code for secure access.
          </Text>
          <InputField label="Checkout email address" value={props.lookupContact} onChangeText={props.setLookupContact} />

          {props.lookupStatus ? <Text style={styles.statusText}>{props.lookupStatus}</Text> : null}

          {props.orderLookupError ? <Text style={styles.errorText}>{props.orderLookupError}</Text> : null}

          <TouchableOpacity onPress={() => props.onFindOrder()} activeOpacity={0.88} style={styles.primaryCta}>
            <Text style={styles.primaryCtaText}>Send code</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {props.mode === "verify" ? (
        <View style={styles.panelBody}>
          <Text style={styles.panelTitle}>Enter your code</Text>
          <Text style={styles.panelCopy}>
            We sent a 6-digit code to {props.lookupContact.trim().toLowerCase() || "your email"}. No password needed.
          </Text>
          <InputField
            label="Verification code"
            value={props.lookupCode}
            onChangeText={props.setLookupCode}
            keyboardType="number-pad"
            maxLength={6}
          />

          {props.lookupStatus ? <Text style={styles.statusText}>{props.lookupStatus}</Text> : null}

          {props.orderLookupError ? <Text style={styles.errorText}>{props.orderLookupError}</Text> : null}

          <TouchableOpacity onPress={() => props.onVerifyOrderLookup()} activeOpacity={0.88} style={styles.primaryCta}>
            <Text style={styles.primaryCtaText}>Verify and continue</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => props.onFindOrder()} activeOpacity={0.88} style={styles.secondaryCta}>
            <Text style={styles.secondaryCtaText}>Resend code</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {props.mode === "syncing" ? (
        <View style={styles.panelBody}>
          <View style={styles.successBadge}>
            <Ionicons name="time-outline" size={24} color="#0A6C52" />
          </View>
          <Text style={styles.confirmedTitle}>Payment received</Text>
          <Text style={styles.confirmedBody}>
            {props.lookupStatus || "We are syncing this order to your buyer account so it can be tracked from the backend."}
          </Text>

          {props.orderLookupError ? <Text style={styles.errorText}>{props.orderLookupError}</Text> : null}

          <TouchableOpacity onPress={() => props.onSendAccessEmail()} activeOpacity={0.88} style={styles.primaryCta}>
            <Text style={styles.primaryCtaText}>
              {props.saveAccountState === "sending"
                ? "Sending..."
                : props.saveAccountState === "sent"
                ? "Tracking code sent"
                : props.saveAccountState === "error"
                ? "Try again"
                : "Email my tracking code"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={props.onBackToCart} activeOpacity={0.88} style={styles.ghostAction}>
            <Text style={styles.ghostActionText}>Back to store</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {props.mode === "orders" ? (
        <ScrollView style={styles.panelBody} showsVerticalScrollIndicator={false}>
          <Text style={styles.panelTitle}>Your order history</Text>
          <Text style={styles.panelCopy}>Orders shown here come from your verified checkout email or signed-in buyer account.</Text>

          {props.matchedOrders.map((item) => (
            <TouchableOpacity key={item.id} onPress={() => props.onSelectOrder(item)} activeOpacity={0.88} style={styles.orderCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.orderCardTitle}>{item.orderNumber}</Text>
                <Text style={styles.orderCardBody}>{item.items.map((product) => product.name).slice(0, 3).join(", ")}</Text>
                <Text style={styles.orderCardMeta}>{formatOrderDateTime(item.createdAt)}</Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={styles.orderCardPrice}>{formatMoney(item.total, item.currency)}</Text>
                <Text style={styles.orderCardStatus}>{formatStatusLabel(item.status)}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : null}

      {props.mode === "tracking" && order ? (
        <ScrollView style={styles.panelBody} showsVerticalScrollIndicator={false}>
          <Text style={styles.panelTitle}>Track your order</Text>
          <Text style={styles.panelCopy}>{order.orderNumber} · {formatStatusLabel(order.status)} · Est. {order.estimatedDeliveryLabel}</Text>

          <View style={styles.trackingCard}>
            {steps.map((step) => (
              <StatusStep key={step.title} done={step.done} current={step.current} title={step.title} body={step.body} />
            ))}
          </View>

          <View style={styles.confirmedCard}>
            <Text style={styles.confirmedStore}>{order.vendorName}</Text>
            <Text style={styles.confirmedMeta}>{order.contact.addressLine1}</Text>
            <SummaryRow label="Order number" value={order.orderNumber} />
            <SummaryRow label="Placed" value={formatOrderDateTime(order.createdAt)} />
            <SummaryRow label="Status" value={formatStatusLabel(order.status)} />
            {order.items.map((item) => (
              <SummaryRow
                key={`${item.productId}-${item.name}`}
                label={`${item.name} · Qty ${item.quantity}`}
                value={formatMoney(item.price * item.quantity, order.currency)}
              />
            ))}
            <SummaryRow label="Total" value={formatMoney(order.total, order.currency)} strong />
          </View>

          <TouchableOpacity onPress={() => props.onRestoreOrder(order)} activeOpacity={0.88} style={styles.primaryCta}>
            <Text style={styles.primaryCtaText}>Reorder</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : null}
    </View>
  );
}

function SummaryRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={[styles.summaryLabel, strong && styles.summaryLabelStrong]}>{label}</Text>
      <Text style={[styles.summaryValue, strong && styles.summaryValueStrong]}>{value}</Text>
    </View>
  );
}

function InputField(props: React.ComponentProps<typeof TextInput> & { label: string }) {
  return (
    <View style={styles.inputBlock}>
      <Text style={styles.inputLabel}>{props.label}</Text>
      <TextInput
        {...props}
        placeholder={props.placeholder ?? props.label}
        placeholderTextColor="#8A8F94"
        style={[styles.input, props.style]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F4F6F5",
  },
  screenBody: {
    paddingBottom: 96,
  },
  stateScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    backgroundColor: "#F4F6F5",
  },
  stateTitle: {
    marginTop: 12,
    color: "#2B2B2B",
    fontSize: 18,
    lineHeight: 24,
    fontFamily: "Manrope-Bold",
    textAlign: "center",
  },
  header: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  brandDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#0A6C52",
  },
  brandText: {
    color: "#1F211F",
    fontSize: 22,
    lineHeight: 28,
    fontFamily: "Manrope-ExtraBold",
  },
  brandCaption: {
    color: "#687076",
    fontSize: 11,
    lineHeight: 16,
    fontFamily: "Outfit-Regular",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  ghostButton: {
    height: 42,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E4E8E6",
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  ghostButtonText: {
    color: "#0A6C52",
    fontSize: 13,
    lineHeight: 18,
    fontFamily: "Manrope-SemiBold",
  },
  cartChip: {
    height: 42,
    borderRadius: 18,
    backgroundColor: "#0A6C52",
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  cartChipText: {
    color: "#FFFFFF",
    fontSize: 13,
    lineHeight: 18,
    fontFamily: "Manrope-Bold",
  },
  layout: {
    paddingHorizontal: 18,
    gap: 18,
  },
  layoutDesktop: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  mainColumn: {
    flex: 1,
    gap: 18,
  },
  previewBanner: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#F0D7C0",
    backgroundColor: "#FFF6EE",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  previewBannerTitle: {
    color: "#C96A15",
    fontSize: 12,
    lineHeight: 16,
    fontFamily: "Manrope-Bold",
    textTransform: "uppercase",
  },
  previewBannerBody: {
    color: "#9A6332",
    fontSize: 13,
    lineHeight: 18,
    fontFamily: "Outfit-Regular",
    marginTop: 4,
  },
  storeOverviewShell: {
    marginBottom: 4,
  },
  storeOverviewBanner: {
    height: 220,
    borderRadius: 30,
    overflow: "hidden",
    backgroundColor: "#205948",
  },
  storeOverviewImage: {
    width: "100%",
    height: "100%",
  },
  storeOverviewOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(22,56,45,0.72)",
  },
  storeOverviewCard: {
    marginTop: -58,
    marginHorizontal: 18,
    borderRadius: 28,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 24,
    paddingVertical: 22,
    gap: 18,
    borderWidth: 1,
    borderColor: "#E8ECEA",
    shadowColor: "#133A2F",
    shadowOpacity: 0.08,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 5,
  },
  storeOverviewHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 18,
  },
  storeOverviewAvatarWrap: {
    marginTop: -42,
  },
  storeOverviewCopy: {
    flex: 1,
    gap: 10,
  },
  storeOverviewTitleRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 10,
  },
  storeOverviewTitle: {
    color: "#1F211F",
    fontSize: 28,
    lineHeight: 34,
    fontFamily: "Manrope-ExtraBold",
    flexShrink: 1,
  },
  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "#EEF8F3",
  },
  verifiedBadgeText: {
    color: "#0A6C52",
    fontSize: 12,
    lineHeight: 16,
    fontFamily: "Manrope-Bold",
  },
  storeOverviewLocation: {
    color: "#687076",
    fontSize: 14,
    lineHeight: 20,
    fontFamily: "Outfit-Regular",
  },
  storeOverviewDescription: {
    color: "#2B2B2B",
    fontSize: 15,
    lineHeight: 22,
    fontFamily: "Outfit-Regular",
    maxWidth: 720,
  },
  storeOverviewMetaRow: {
    gap: 10,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: "#EEF1EF",
  },
  storeOverviewMetaLabel: {
    color: "#687076",
    fontSize: 12,
    lineHeight: 16,
    fontFamily: "Outfit-Medium",
    textTransform: "uppercase",
  },
  storeOverviewStats: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  summaryStat: {
    minWidth: 120,
    borderRadius: 18,
    backgroundColor: "#F8FAF9",
    borderWidth: 1,
    borderColor: "#E7ECE9",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 4,
  },
  summaryStatValue: {
    color: "#0A6C52",
    fontSize: 20,
    lineHeight: 24,
    fontFamily: "Manrope-ExtraBold",
  },
  summaryStatLabel: {
    color: "#687076",
    fontSize: 12,
    lineHeight: 17,
    fontFamily: "Outfit-Regular",
  },
  storeOverviewActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  primaryHeroAction: {
    minHeight: 52,
    borderRadius: 18,
    backgroundColor: "#0A6C52",
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
  },
  primaryHeroActionText: {
    color: "#FFFFFF",
    fontSize: 14,
    lineHeight: 19,
    fontFamily: "Manrope-Bold",
  },
  secondaryHeroAction: {
    minHeight: 52,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#D9E3DE",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryHeroActionText: {
    color: "#1F211F",
    fontSize: 14,
    lineHeight: 19,
    fontFamily: "Manrope-SemiBold",
  },
  sideColumn: {
    width: 380,
  },
  sideSticky: {
    position: "sticky" as any,
    top: 18,
  },
  heroCard: {
    borderRadius: 28,
    overflow: "hidden",
    backgroundColor: "#173B31",
    minHeight: 320,
  },
  heroImage: {
    width: "100%",
    height: 320,
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(12,18,16,0.38)",
  },
  heroTopBar: {
    position: "absolute",
    top: 18,
    left: 18,
    right: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  securePill: {
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.92)",
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  securePillText: {
    color: "#0A6C52",
    fontSize: 12,
    lineHeight: 16,
    fontFamily: "Manrope-Bold",
  },
  heroCopy: {
    position: "absolute",
    left: 22,
    right: 22,
    bottom: 22,
    gap: 10,
  },
  heroTitle: {
    color: "#FFFFFF",
    fontSize: 30,
    lineHeight: 36,
    fontFamily: "Manrope-ExtraBold",
  },
  heroSubtitle: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 15,
    lineHeight: 22,
    fontFamily: "Outfit-Regular",
    maxWidth: 620,
  },
  heroMetaRow: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  vendorAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  vendorAvatarSquare: {
    width: 84,
    height: 84,
    borderRadius: 24,
    borderWidth: 4,
    borderColor: "#FFFFFF",
    shadowColor: "#133A2F",
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  vendorAvatarText: {
    color: "#0A6C52",
    fontSize: 15,
    lineHeight: 20,
    fontFamily: "Manrope-Bold",
  },
  vendorMetaTitle: {
    color: "#FFFFFF",
    fontSize: 14,
    lineHeight: 20,
    fontFamily: "Manrope-Bold",
  },
  vendorMetaBody: {
    color: "rgba(255,255,255,0.84)",
    fontSize: 13,
    lineHeight: 19,
    fontFamily: "Outfit-Regular",
  },
  storeCard: {
    borderRadius: 28,
    backgroundColor: "#FFFFFF",
    padding: 18,
    gap: 18,
  },
  storeCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  sectionEyebrow: {
    color: "#687076",
    fontSize: 12,
    lineHeight: 16,
    fontFamily: "Outfit-Medium",
    textTransform: "uppercase",
  },
  sectionTitle: {
    color: "#2B2B2B",
    fontSize: 24,
    lineHeight: 30,
    fontFamily: "Manrope-ExtraBold",
    marginTop: 4,
  },
  metricPill: {
    height: 38,
    borderRadius: 19,
    paddingHorizontal: 14,
    backgroundColor: "#F2FBF7",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  metricPillText: {
    color: "#0A6C52",
    fontSize: 12,
    lineHeight: 16,
    fontFamily: "Manrope-Bold",
  },
  searchRow: {
    minHeight: 52,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E4E8E6",
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  searchInput: {
    flex: 1,
    color: "#2B2B2B",
    fontSize: 15,
    lineHeight: 20,
    fontFamily: "Outfit-Regular",
  },
  promoBanner: {
    borderRadius: 18,
    backgroundColor: "#0A6C52",
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  promoBannerText: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 13,
    lineHeight: 19,
    fontFamily: "Outfit-Medium",
  },
  focusBanner: {
    borderRadius: 18,
    backgroundColor: "#F2FBF7",
    borderWidth: 1,
    borderColor: "#D7ECE3",
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  focusBannerText: {
    flex: 1,
    color: "#0A6C52",
    fontSize: 13,
    lineHeight: 19,
    fontFamily: "Outfit-Medium",
  },
  productGrid: {
    gap: 14,
  },
  productGridDesktop: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "stretch",
  },
  productCard: {
    borderRadius: 24,
    backgroundColor: "#FBFBFA",
    borderWidth: 1,
    borderColor: "#EEF1EF",
    overflow: "hidden",
  },
  productCardDesktop: {
    width: "48.6%",
  },
  productCardImage: {
    width: "100%",
    height: 210,
    backgroundColor: "#ECE7DC",
  },
  productCardBody: {
    padding: 16,
    gap: 12,
  },
  productTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  productCardTitle: {
    color: "#2B2B2B",
    fontSize: 19,
    lineHeight: 25,
    fontFamily: "Manrope-Bold",
  },
  productCardMeta: {
    color: "#687076",
    fontSize: 12,
    lineHeight: 18,
    fontFamily: "Outfit-Regular",
    marginTop: 4,
  },
  stockChip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "#EEF8F3",
  },
  focusStockChip: {
    backgroundColor: "#0A6C52",
  },
  stockChipText: {
    color: "#0A6C52",
    fontSize: 11,
    lineHeight: 15,
    fontFamily: "Manrope-Bold",
  },
  focusStockChipText: {
    color: "#FFFFFF",
  },
  productCardDescription: {
    color: "#4B5563",
    fontSize: 14,
    lineHeight: 20,
    fontFamily: "Outfit-Regular",
  },
  productFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  productFooterPrimary: {
    flex: 1,
    gap: 10,
  },
  productPrice: {
    color: "#2B2B2B",
    fontSize: 22,
    lineHeight: 28,
    fontFamily: "Manrope-ExtraBold",
  },
  detailsButton: {
    alignSelf: "flex-start",
    minHeight: 38,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#D7E1DD",
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  detailsButtonText: {
    color: "#0A6C52",
    fontSize: 12,
    lineHeight: 17,
    fontFamily: "Manrope-SemiBold",
  },
  addButton: {
    minWidth: 136,
    height: 46,
    borderRadius: 18,
    backgroundColor: "#0A6C52",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  addButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    lineHeight: 19,
    fontFamily: "Manrope-Bold",
  },
  quantityControl: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  quantityButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#D4DDD8",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  quantityButtonFilled: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0A6C52",
  },
  quantityValue: {
    minWidth: 20,
    color: "#2B2B2B",
    fontSize: 15,
    lineHeight: 20,
    fontFamily: "Manrope-Bold",
    textAlign: "center",
  },
  subSection: {
    gap: 12,
  },
  subSectionTitle: {
    color: "#2B2B2B",
    fontSize: 20,
    lineHeight: 26,
    fontFamily: "Manrope-Bold",
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  countryChip: {
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#F4F6F5",
  },
  countryChipText: {
    color: "#2B2B2B",
    fontSize: 13,
    lineHeight: 18,
    fontFamily: "Outfit-Medium",
  },
  featureGrid: {
    gap: 12,
  },
  featureCard: {
    borderRadius: 20,
    backgroundColor: "#F7FAF8",
    borderWidth: 1,
    borderColor: "#E7ECE9",
    padding: 16,
  },
  featureIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#EAF7F1",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  featureTitle: {
    color: "#2B2B2B",
    fontSize: 15,
    lineHeight: 21,
    fontFamily: "Manrope-Bold",
  },
  featureBody: {
    color: "#687076",
    fontSize: 13,
    lineHeight: 19,
    fontFamily: "Outfit-Regular",
    marginTop: 5,
  },
  reviewRow: {
    gap: 12,
  },
  reviewCard: {
    width: 260,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#EEF1EF",
    padding: 16,
    gap: 10,
  },
  reviewStars: {
    flexDirection: "row",
    gap: 2,
  },
  reviewBody: {
    color: "#2B2B2B",
    fontSize: 14,
    lineHeight: 21,
    fontFamily: "Outfit-Regular",
    minHeight: 80,
  },
  reviewAuthor: {
    color: "#687076",
    fontSize: 13,
    lineHeight: 18,
    fontFamily: "Manrope-SemiBold",
  },
  lookupCallout: {
    borderRadius: 24,
    backgroundColor: "#0D1713",
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  lookupCalloutTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    lineHeight: 24,
    fontFamily: "Manrope-Bold",
  },
  lookupCalloutBody: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 13,
    lineHeight: 19,
    fontFamily: "Outfit-Regular",
    marginTop: 4,
  },
  lookupCalloutButton: {
    height: 44,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  lookupCalloutButtonText: {
    color: "#0A6C52",
    fontSize: 13,
    lineHeight: 18,
    fontFamily: "Manrope-Bold",
  },
  panelShell: {
    borderRadius: 28,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E8ECEA",
    overflow: "hidden",
  },
  panelHeader: {
    paddingHorizontal: 18,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#EEF1EF",
  },
  panelBrand: {
    color: "#0A6C52",
    fontSize: 24,
    lineHeight: 28,
    fontFamily: "Manrope-ExtraBold",
  },
  panelSubtitle: {
    color: "#687076",
    fontSize: 12,
    lineHeight: 18,
    fontFamily: "Outfit-Regular",
  },
  panelClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F5F7F6",
  },
  panelBody: {
    padding: 18,
  },
  panelTitle: {
    color: "#2B2B2B",
    fontSize: 22,
    lineHeight: 28,
    fontFamily: "Manrope-Bold",
  },
  panelCopy: {
    color: "#687076",
    fontSize: 13,
    lineHeight: 19,
    fontFamily: "Outfit-Regular",
    marginTop: 6,
    marginBottom: 16,
  },
  emptyPanelCard: {
    borderRadius: 22,
    backgroundColor: "#F6F8F7",
    padding: 18,
    alignItems: "center",
    gap: 8,
  },
  emptyPanelTitle: {
    color: "#2B2B2B",
    fontSize: 16,
    lineHeight: 22,
    fontFamily: "Manrope-Bold",
  },
  emptyPanelCopy: {
    color: "#687076",
    fontSize: 13,
    lineHeight: 19,
    fontFamily: "Outfit-Regular",
    textAlign: "center",
  },
  stack: {
    gap: 14,
  },
  summaryItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F2F1",
  },
  summaryItemTitle: {
    color: "#2B2B2B",
    fontSize: 15,
    lineHeight: 21,
    fontFamily: "Manrope-Bold",
  },
  summaryItemMeta: {
    color: "#687076",
    fontSize: 12,
    lineHeight: 18,
    fontFamily: "Outfit-Regular",
    marginTop: 4,
  },
  summaryItemPrice: {
    color: "#2B2B2B",
    fontSize: 15,
    lineHeight: 21,
    fontFamily: "Manrope-Bold",
  },
  summaryCard: {
    borderRadius: 20,
    backgroundColor: "#F7F9F8",
    padding: 16,
    gap: 10,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  summaryLabel: {
    color: "#687076",
    fontSize: 13,
    lineHeight: 19,
    fontFamily: "Outfit-Regular",
  },
  summaryLabelStrong: {
    color: "#2B2B2B",
    fontFamily: "Manrope-Bold",
  },
  summaryValue: {
    color: "#2B2B2B",
    fontSize: 13,
    lineHeight: 19,
    fontFamily: "Manrope-SemiBold",
    textAlign: "right",
  },
  summaryValueStrong: {
    color: "#0A6C52",
    fontSize: 16,
    lineHeight: 22,
    fontFamily: "Manrope-ExtraBold",
  },
  primaryCta: {
    height: 54,
    borderRadius: 18,
    backgroundColor: "#0A6C52",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  primaryCtaText: {
    color: "#FFFFFF",
    fontSize: 15,
    lineHeight: 21,
    fontFamily: "Manrope-Bold",
  },
  secondaryCta: {
    height: 50,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#D7E1DD",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  secondaryCtaText: {
    color: "#0A6C52",
    fontSize: 14,
    lineHeight: 19,
    fontFamily: "Manrope-SemiBold",
  },
  errorText: {
    color: "#D92D20",
    fontSize: 13,
    lineHeight: 19,
    fontFamily: "Outfit-Regular",
  },
  statusText: {
    color: "#0A6C52",
    fontSize: 13,
    lineHeight: 19,
    fontFamily: "Outfit-Regular",
    marginBottom: 12,
  },
  row: {
    flexDirection: "row",
    gap: 12,
  },
  inputBlock: {
    flex: 1,
    marginBottom: 14,
  },
  inputLabel: {
    color: "#687076",
    fontSize: 12,
    lineHeight: 17,
    fontFamily: "Outfit-Medium",
    marginBottom: 6,
  },
  input: {
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E3E8E5",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    color: "#2B2B2B",
    fontSize: 15,
    lineHeight: 20,
    fontFamily: "Outfit-Regular",
  },
  formSectionTitle: {
    color: "#2B2B2B",
    fontSize: 15,
    lineHeight: 21,
    fontFamily: "Manrope-Bold",
    marginBottom: 10,
    marginTop: 4,
  },
  signInCard: {
    borderRadius: 20,
    backgroundColor: "#FFF8F5",
    borderWidth: 1,
    borderColor: "#F5DDD3",
    padding: 16,
    marginBottom: 14,
  },
  signInTitle: {
    color: "#2B2B2B",
    fontSize: 14,
    lineHeight: 20,
    fontFamily: "Manrope-Bold",
  },
  signInCopy: {
    color: "#687076",
    fontSize: 13,
    lineHeight: 19,
    fontFamily: "Outfit-Regular",
    marginTop: 6,
    marginBottom: 12,
  },
  ghostAction: {
    marginTop: 12,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 40,
  },
  ghostActionText: {
    color: "#687076",
    fontSize: 13,
    lineHeight: 18,
    fontFamily: "Manrope-SemiBold",
  },
  successBadge: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: "#E9F7F0",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginTop: 8,
  },
  confirmedTitle: {
    color: "#2B2B2B",
    fontSize: 24,
    lineHeight: 30,
    fontFamily: "Manrope-ExtraBold",
    textAlign: "center",
    marginTop: 16,
  },
  confirmedBody: {
    color: "#0A6C52",
    fontSize: 14,
    lineHeight: 20,
    fontFamily: "Manrope-SemiBold",
    textAlign: "center",
    marginTop: 6,
    marginBottom: 18,
  },
  confirmedCard: {
    borderRadius: 20,
    backgroundColor: "#F7F9F8",
    padding: 16,
    gap: 10,
    marginBottom: 16,
  },
  confirmedStore: {
    color: "#2B2B2B",
    fontSize: 16,
    lineHeight: 22,
    fontFamily: "Manrope-Bold",
  },
  confirmedMeta: {
    color: "#687076",
    fontSize: 13,
    lineHeight: 19,
    fontFamily: "Outfit-Regular",
    marginBottom: 6,
  },
  accountCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#D9E7E0",
    backgroundColor: "#F5FBF8",
    padding: 16,
    gap: 8,
    marginTop: 4,
  },
  accountCardTitle: {
    color: "#0A6C52",
    fontSize: 14,
    lineHeight: 20,
    fontFamily: "Manrope-Bold",
  },
  accountCardBody: {
    color: "#4B5563",
    fontSize: 13,
    lineHeight: 19,
    fontFamily: "Outfit-Regular",
  },
  secondaryActionChip: {
    height: 42,
    borderRadius: 15,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CFE3D8",
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start",
    marginTop: 4,
  },
  secondaryActionChipText: {
    color: "#0A6C52",
    fontSize: 13,
    lineHeight: 18,
    fontFamily: "Manrope-Bold",
  },
  orderCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E6EBE8",
    padding: 16,
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  orderCardTitle: {
    color: "#2B2B2B",
    fontSize: 15,
    lineHeight: 21,
    fontFamily: "Manrope-Bold",
  },
  orderCardBody: {
    color: "#687076",
    fontSize: 12,
    lineHeight: 18,
    fontFamily: "Outfit-Regular",
    marginTop: 4,
  },
  orderCardMeta: {
    color: "#8A8F94",
    fontSize: 11,
    lineHeight: 16,
    fontFamily: "Outfit-Regular",
    marginTop: 6,
  },
  orderCardPrice: {
    color: "#2B2B2B",
    fontSize: 14,
    lineHeight: 20,
    fontFamily: "Manrope-Bold",
  },
  orderCardStatus: {
    color: "#0A6C52",
    fontSize: 11,
    lineHeight: 16,
    fontFamily: "Outfit-Medium",
    marginTop: 6,
    textTransform: "capitalize",
  },
  trackingCard: {
    borderRadius: 22,
    backgroundColor: "#F7F9F8",
    padding: 16,
    marginBottom: 16,
    gap: 14,
  },
  timelineRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  timelineRail: {
    width: 34,
    alignItems: "center",
  },
  timelineDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#D8E3DE",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  timelineDotDone: {
    backgroundColor: "#0A6C52",
    borderColor: "#0A6C52",
  },
  timelineDotCurrent: {
    backgroundColor: "#EAF7F1",
    borderColor: "#A9D6C2",
  },
  timelineTitle: {
    color: "#2B2B2B",
    fontSize: 15,
    lineHeight: 21,
    fontFamily: "Manrope-Bold",
  },
  timelineBody: {
    color: "#687076",
    fontSize: 12,
    lineHeight: 18,
    fontFamily: "Outfit-Regular",
    marginTop: 4,
  },
  mobileBottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 18,
    backgroundColor: "rgba(244,246,245,0.96)",
    borderTopWidth: 1,
    borderTopColor: "#E4E8E6",
  },
  mobileBottomButton: {
    height: 54,
    borderRadius: 18,
    backgroundColor: "#0A6C52",
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
  },
  mobileBottomButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    lineHeight: 21,
    fontFamily: "Manrope-Bold",
  },
  modalScrim: {
    flex: 1,
    backgroundColor: "rgba(13,23,19,0.24)",
  },
  mobilePanel: {
    maxHeight: "88%",
    backgroundColor: "transparent",
    paddingHorizontal: 10,
    paddingBottom: 10,
  },
  productModalScrim: {
    flex: 1,
    backgroundColor: "rgba(13,23,19,0.48)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    paddingVertical: 24,
  },
  productModalCard: {
    width: "100%",
    maxWidth: 760,
    borderRadius: 28,
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
  },
  productModalImage: {
    width: "100%",
    height: 300,
    backgroundColor: "#ECE7DC",
  },
  productModalBody: {
    padding: 22,
    gap: 16,
  },
  productModalTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 16,
  },
  productModalClose: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#F5F7F6",
    alignItems: "center",
    justifyContent: "center",
  },
  productModalTitle: {
    color: "#2B2B2B",
    fontSize: 26,
    lineHeight: 32,
    fontFamily: "Manrope-ExtraBold",
  },
  productModalMeta: {
    color: "#687076",
    fontSize: 13,
    lineHeight: 19,
    fontFamily: "Outfit-Regular",
    marginTop: 6,
  },
  productModalDescription: {
    color: "#4B5563",
    fontSize: 15,
    lineHeight: 22,
    fontFamily: "Outfit-Regular",
  },
  productModalSummary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  productModalPrice: {
    color: "#0A6C52",
    fontSize: 28,
    lineHeight: 34,
    fontFamily: "Manrope-ExtraBold",
  },
  productModalStock: {
    color: "#0A6C52",
    fontSize: 12,
    lineHeight: 17,
    fontFamily: "Manrope-Bold",
    textTransform: "uppercase",
  },
  productModalActions: {
    flexDirection: "row",
    gap: 12,
  },
});

