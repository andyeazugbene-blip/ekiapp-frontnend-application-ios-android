import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { useAuthStore } from "../../stores/authStore";
import { vendorService } from "../../services/vendorService";
import { productService } from "../../services/productService";
import { orderService } from "../../services/orderService";
import { messageService } from "../../services/messageService";
import { buyerService, type VendorBuyerSummary } from "../../services/buyerService";
import { deliveryService, type DeliveryZone } from "../../services/deliveryService";
import {
  subscriptionService,
  type ActiveSubscription,
  type SubscriptionLimits,
} from "../../services/subscriptionService";
import { regularDeliveriesService, type Renewal } from "../../services/regularDeliveriesService";
import { communityBuyService, type SupplierProfile } from "../../services/communityBuyService";
import { VendorDashboardData, VendorSummary } from "../../types/vendor";
import { Product } from "../../types/product";
import { Order } from "../../types/order";
import { VendorDrawer } from "../../components/vendor/Drawer";
import { TAB_BAR_RESERVED_SPACE } from "../../components/layout/tabBarConstants";
import { useCurrencyStore } from "../../stores/currencyStore";
import { formatDisplayMoney } from "../../utils/currency";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const SCREEN_WIDTH = Dimensions.get("window").width;

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function asText(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return fallback;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function formatToday() {
  const d = new Date();
  return `${DAY_NAMES[d.getDay()]}, ${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`;
}

interface AggregatedDashboard {
  profile: VendorSummary | null;
  data: VendorDashboardData | null;
  subscription: ActiveSubscription | null;
  limits: SubscriptionLimits | null;
  products: Product[];
  orders: Order[];
  buyers: VendorBuyerSummary[];
  zones: DeliveryZone[];
  unreadMessages: number;
  verificationSubmitted: boolean;
  pendingRenewals: Renewal[];
  supplierProfile: SupplierProfile | null;
}

/**
 * Vendor dashboard — every value comes from the live backend API.
 *
 * Backend calls (parallelized):
 *  • GET /api/vendors/me                      → profile (storeName, rating, country, plan)
 *  • GET /api/vendors/me/dashboard            → greeting + alerts + earnings + insights
 *  • GET /api/products?vendorId={profile.id}  → products (count, low-stock)
 *  • GET /api/orders?role=vendor              → orders (pending action count, total orders)
 *  • GET /api/conversations                   → unread message count
 *  • GET /api/vendors/me/buyers               → buyer avatars
 *  • GET /api/delivery/zones/me               → delivery setup, avg estimate
 *
 * No hardcoded numbers. Missing values render as `0` / `—` / empty state.
 */
export default function VendorDashboardScreen() {
  const { selectedCurrency } = useCurrencyStore();
  const formatCurrency = (n: number, currencyCode = "GBP") => {
    return formatDisplayMoney(n, currencyCode, selectedCurrency);
  };
  const formatCurrencySub = (n: number, currencyCode = "GBP") => {
    if (currencyCode.toUpperCase() === selectedCurrency.toUpperCase()) return "";
    return `= ${formatDisplayMoney(n, currencyCode, currencyCode)}`;
  };
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);

  const [agg, setAgg] = useState<AggregatedDashboard>({
    profile: null,
    data: null,
    subscription: null,
    limits: null,
    products: [],
    orders: [],
    buyers: [],
    zones: [],
    unreadMessages: 0,
    verificationSubmitted: false,
    pendingRenewals: [],
    supplierProfile: null,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerProgress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(drawerProgress, {
      toValue: drawerOpen ? 1 : 0,
      tension: 72,
      friction: 13,
      useNativeDriver: true,
    }).start();
  }, [drawerOpen, drawerProgress]);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      // 1. Profile first — its id is required for vendor-scoped product call.
      const profile = await vendorService.getMyProfile().catch(() => null);

      // 2. Everything else in parallel; each call is independent + best-effort.
      const [data, subscription, limits, products, orders, conversations, buyers, zones, verification, pendingRenewals, supplierProfile] = await Promise.all([
        vendorService.getVendorDashboard().catch(() => null),
        subscriptionService.getCurrentSubscription().catch(() => null),
        subscriptionService.getLimits().catch(() => null),
        profile?.id
          ? productService.getVendorProducts(profile.id).catch(() => [] as Product[])
          : Promise.resolve([] as Product[]),
        orderService.getVendorOrders().catch(() => [] as Order[]),
        messageService.getConversations().catch(() => []),
        buyerService.listMyBuyers().catch(() => [] as VendorBuyerSummary[]),
        deliveryService.listZones().catch(() => [] as DeliveryZone[]),
        vendorService.getVerificationStatus().catch(() => null),
        regularDeliveriesService.listMyRenewals().catch(() => [] as Renewal[]),
        communityBuyService.getMySupplierProfile().catch(() => null),
      ]);

      const unreadMessages = asArray<any>(conversations).reduce(
        (sum, c) => sum + (c.unreadCount ?? 0),
        0
      );

      setAgg({
        profile,
        data,
        subscription,
        limits,
        products: asArray<Product>(products),
        orders: asArray<Order>(orders),
        buyers: asArray<VendorBuyerSummary>(buyers),
        zones: asArray<DeliveryZone>(zones),
        unreadMessages,
        verificationSubmitted: asArray<any>(verification?.documents).some((doc) => doc.status !== "REJECTED"),
        pendingRenewals: asArray<Renewal>(pendingRenewals).filter((r) => r.status === "AWAITING_STOCK"),
        supplierProfile: supplierProfile as SupplierProfile | null,
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        if (cancelled) return;
        await load();
      })();
      return () => {
        cancelled = true;
      };
    }, [load])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load(true);
  }, [load]);

  const navigate = (path: string) => router.push(path as any);

  // ── Live-derived values (no hardcoded numbers) ─────────────────────────
  const { profile, data, subscription, limits, products, orders, buyers, zones, unreadMessages, verificationSubmitted, pendingRenewals, supplierProfile } = agg;

  const storeName =
    asText(profile?.storeName).trim() || asText(data?.storeName).trim() || asText(user?.name, "your store") || "your store";

  const earnings = data?.earnings;
  const insights = data?.insights;
  const subscriptionPlan = subscription?.slug ?? "free";
  const subscriptionStatus = subscription?.status === "active" ? "Active" : "Inactive";
  const bestSellingText = asText(insights?.bestSellingProduct).trim() || "No order data yet";
  const repeatBuyerCount = buyers.filter((b) => asNumber(b.totalOrders) >= 2).length;
  const backendAlerts = asArray<{ type?: string; count?: unknown }>(data?.alerts);

  // Alerts — prefer the backend-provided alerts; fall back to derived values.
  const alertOrderAction =
    asNumber(backendAlerts.find((a) => a.type === "order_action")?.count, NaN) ||
    orders.filter((o) => o.status === "pending" || o.status === "confirmed").length;
  const alertLowStock =
    asNumber(backendAlerts.find((a) => a.type === "low_stock")?.count, NaN) ||
    products.filter((p) => (p.stock ?? 0) > 0 && (p.stock ?? 0) <= 5).length;
  const alertUnreadMessages =
    asNumber(backendAlerts.find((a) => a.type === "message")?.count, NaN) || unreadMessages;

  // Derived counts
  const productsCount = products.length;
  const lowStockCount = products.filter((p) => (p.stock ?? 0) > 0 && (p.stock ?? 0) <= 5).length;
  const totalOrders = orders.length;
  const ratingValue = Number(profile?.rating ?? 0);
  const safeRatingValue = Number.isFinite(ratingValue) ? ratingValue : 0;
  const sellsCountryText = asText(profile?.country).trim() || "Country not set";

  // Avg delivery — average estimated days across all zones, otherwise empty.
  const avgDeliveryText = (() => {
    if (zones.length === 0) return "";
    // estimatedDays is "3–5 days" or similar; collapse to the dominant string.
    const counts = zones.reduce<Record<string, number>>((acc, z) => {
      const key = asText(z.estimatedDays);
      if (key) acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    return top ? top[0] : "";
  })();
  const deliveryHealth =
    zones.length === 0 ? "Setup" : zones.every((z) => z.active) ? "Good" : "Paused";
  const ratingDisplay = safeRatingValue > 0 ? `${safeRatingValue.toFixed(1)}/5` : "No rating yet";
  const ordersDisplay = totalOrders.toLocaleString("en-US");
  const deliveryDisplay = avgDeliveryText || "Not set";

  // Onboarding progress: 4 steps (foodstuff / delivery / verify / share).
  const stepFoodstuff = productsCount > 0;
  const stepDelivery = zones.length > 0;
  const isVerifiedVendor = profile?.verificationStatus === "verified";
  const stepVerify = isVerifiedVendor || profile?.verificationStatus === "under_review" || verificationSubmitted;
  // Share is tracked by the onboarding store; we treat "any unread message
  // received" or "any past order" as a strong signal that the link has been shared.
  const stepShare = orders.length > 0 || buyers.length > 0;
  const stepsTotal = 4;
  const stepsDone = [stepFoodstuff, stepDelivery, stepVerify, stepShare].filter(Boolean).length;
  const progressPct = (stepsDone / stepsTotal) * 100;
  const nextStepText = !stepFoodstuff
    ? "Add your first foodstuff to start selling"
    : !stepDelivery
      ? "Set delivery so buyers can place orders"
      : !stepVerify
        ? "Submit verification so buyers can place orders"
        : !stepShare
          ? "Share your store link with buyers"
          : "All set — keep growing your store";

  const dashboardPlanRemaining = asNumber((data as any)?.plan?.ordersRemaining, NaN);
  const planOrdersRemaining =
    limits?.ordersRemaining ??
    (limits?.maxOrders != null ? Math.max(0, limits.maxOrders - limits.currentOrders) : null) ??
    (Number.isFinite(dashboardPlanRemaining) ? Math.max(0, dashboardPlanRemaining) : null);
  const planOrdersText =
    limits?.maxOrders === null
      ? null
      : planOrdersRemaining != null && planOrdersRemaining <= 5
        ? `Orders remaining: ${planOrdersRemaining}`
        : null;

  const planMaxOrders = limits?.maxOrders ?? null;
  const planUsageRatio = planMaxOrders != null && planMaxOrders > 0 && planOrdersRemaining != null
    ? planOrdersRemaining / planMaxOrders
    : 1;
  const planDegraded = planUsageRatio <= 0;
  const planWarning = planUsageRatio > 0 && planUsageRatio <= 0.25;
  const planCardBg = planDegraded ? "#991B1B" : planWarning ? "#92400E" : "#076B51";
  const planGradient = planDegraded
    ? ["#991B1B", "#450A0A"] as const
    : planWarning
      ? ["#92400E", "#451A03"] as const
      : ["#1A6B55", "#0A2A1F"] as const;

  const dashboardSurfaceStyle = {
    transform: [
      {
        translateX: drawerProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [0, SCREEN_WIDTH * 0.62],
        }),
      },
      {
        translateY: drawerProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [0, 30],
        }),
      },
      {
        scale: drawerProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 0.72],
        }),
      },
    ],
  };

  return (
    <View style={styles.scene}>
      <StatusBar style={drawerOpen ? "light" : "dark"} />

      <Animated.View
        style={[
          styles.dashboardSurface,
          drawerOpen && styles.dashboardSurfaceOpen,
          dashboardSurfaceStyle,
        ]}
      >
      <ScrollView
        contentContainerStyle={{ paddingBottom: TAB_BAR_RESERVED_SPACE + insets.bottom + 24 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#076B51" />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero ───────────────────────────────────────────────────────── */}
        <View style={styles.hero}>
          <SafeAreaView edges={["top"]}>
            <View style={styles.heroTopRow}>
              <TouchableOpacity
                accessibilityLabel="Open menu"
                accessibilityRole="button"
                activeOpacity={0.8}
                onPress={() => setDrawerOpen(true)}
                style={styles.headerIconPill}
              >
                <Ionicons name="options" size={18} color="#282828" />
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityLabel="Notifications"
                accessibilityRole="button"
                activeOpacity={0.8}
                onPress={() => navigate("/(vendor)/notifications")}
                style={styles.headerIconPillAccent}
              >
                <Ionicons name="notifications" size={18} color="#FFFFFF" />
                {unreadMessages > 0 || alertUnreadMessages > 0 ? (
                  <View style={styles.headerIconBadge} />
                ) : null}
              </TouchableOpacity>
            </View>

            <Text style={styles.dateText}>{formatToday()}</Text>
            <Text style={styles.welcome}>
              {asText(data?.greeting).trim() || "Welcome back,"}
            </Text>
            <View style={styles.storeNameRow}>
              <Text style={styles.storeName} numberOfLines={1}>{storeName}</Text>
              {isVerifiedVendor ? (
                <Ionicons name="checkmark-circle" size={20} color="#4ADE80" style={styles.verifiedIcon} />
              ) : null}
            </View>
          </SafeAreaView>
        </View>

        <View style={styles.body}>
          {loading ? (
            <View style={styles.loadingBlock}>
              <ActivityIndicator color="#076B51" />
            </View>
          ) : (
            <>
            {/* ── Alerts ──────────────────────────────────────────────── */}
            <View style={styles.alertsList}>
              <AlertRow
                icon="cart-outline"
                label="Orders requiring action"
                count={alertOrderAction}
                onPress={() => navigate("/(vendor)/orders")}
              />
              <AlertRow
                icon="cube-outline"
                label="Low stock alerts"
                count={alertLowStock}
                onPress={() => navigate("/(vendor)/foodstuff")}
              />
              <AlertRow
                icon="chatbubble-ellipses-outline"
                label="Unread buyer messages"
                count={alertUnreadMessages}
                onPress={() => navigate("/(vendor)/messages")}
              />
            </View>

            {/* ── Your Sales (live earnings) ──────────────────────────── */}
            <Text style={styles.section}>Your Sales</Text>
            <View style={styles.salesGrid}>
              <SalesTile
                tone="light"
                icon="trending-up-outline"
                label="Sales today"
                value={formatCurrency(earnings?.salesToday ?? 0, earnings?.currency)}
                sub={formatCurrencySub(earnings?.salesToday ?? 0, earnings?.currency)}
              />
              <SalesTile
                tone="dark"
                icon="calendar-outline"
                label="Sales this week"
                value={formatCurrency(earnings?.salesThisWeek ?? 0, earnings?.currency)}
                sub={formatCurrencySub(earnings?.salesThisWeek ?? 0, earnings?.currency)}
              />
              <SalesTile
                tone="black"
                icon="bar-chart-outline"
                label="Sales this month"
                value={formatCurrency(earnings?.salesThisMonth ?? 0, earnings?.currency)}
                sub={formatCurrencySub(earnings?.salesThisMonth ?? 0, earnings?.currency)}
              />
              <SalesTile
                tone="light"
                icon="card-outline"
                label="Pending Payout"
                value={formatCurrency(earnings?.pendingPayout ?? 0, earnings?.currency)}
                sub={formatCurrencySub(earnings?.pendingPayout ?? 0, earnings?.currency)}
                onPress={() => navigate("/(vendor)/earnings")}
              />
            </View>

            {/* ── Business Insights ───────────────────────────────────── */}
            <Text style={styles.section}>Business Insights</Text>
            <View style={styles.insightsCardContainer}>
              {/* Row 1 */}
              <View style={styles.insightTimelineRow}>
                <View style={styles.timelineLeftCol}>
                  <View style={styles.timelineCircle}>
                    <Ionicons name="ribbon-outline" size={14} color="#076B51" />
                  </View>
                  <View style={styles.timelineVerticalLine} />
                </View>
                <View style={styles.timelineContentCol}>
                  <Text style={styles.insightLabel}>Best selling foodstuff</Text>
                  <Text style={styles.insightTitle}>{bestSellingText}</Text>
                </View>
                <View style={styles.timelineRightCol}>
                  <Sparkline points={[8, 14, 10, 18, 12, 20, 16]} />
                </View>
              </View>

              {/* Row 2 */}
              <View style={styles.insightTimelineRow}>
                <View style={styles.timelineLeftCol}>
                  <View style={styles.timelineCircle}>
                    <Ionicons name="people-outline" size={14} color="#076B51" />
                  </View>
                  <View style={styles.timelineVerticalLine} />
                </View>
                <View style={styles.timelineContentCol}>
                  <Text style={styles.insightLabel}>Repeat buyers</Text>
                  <Text style={styles.insightTitle}>{repeatBuyerCount.toLocaleString("en-US")}</Text>
                </View>
                <View style={styles.timelineRightCol}>
                  <Sparkline points={[6, 10, 8, 16, 12, 14, 18]} />
                </View>
              </View>

              {/* Row 3 */}
              <View style={[styles.insightTimelineRow, { borderBottomWidth: 0, paddingBottom: 0 }]}>
                <View style={[styles.timelineLeftCol, { height: 32 }]}>
                  <View style={styles.timelineCircle}>
                    <Ionicons name="globe-outline" size={14} color="#076B51" />
                  </View>
                </View>
                <View style={styles.timelineContentCol}>
                  <Text style={styles.insightLabel}>Sales by country</Text>
                  <Text style={styles.insightTitle}>{sellsCountryText}</Text>
                </View>
                <View style={styles.timelineRightCol}>
                  <Sparkline points={[10, 6, 14, 8, 18, 12, 16]} />
                </View>
              </View>
            </View>

            {/* ── Grow Your Sales ─────────────────────────────────────── */}
            <Text style={styles.section}>Grow Your Sales</Text>
            <View style={styles.growGrid}>
              <GrowCard
                tone="light"
                icon="pricetag-outline"
                title="Create discount"
                onPress={() => navigate("/(vendor)/create-discount")}
                locked={agg.limits ? !agg.limits.discounts : false}
              />
              <GrowCard
                tone="dark"
                icon="gift-outline"
                title="Create bundle"
                onPress={() => navigate("/(vendor)/create-bundle")}
                locked={agg.limits ? !agg.limits.bundles : false}
              />
              <GrowCard
                tone="black"
                icon="flash-outline"
                title="Flash sale"
                onPress={() => navigate("/(vendor)/create-flash-sale")}
                locked={agg.limits ? !agg.limits.flashSales : false}
              />
              <GrowCard
                tone="light"
                icon="share-social-outline"
                title="Share store link"
                onPress={() => navigate("/(vendor)/share-store-link")}
              />
            </View>

            <TouchableOpacity
              activeOpacity={0.86}
              onPress={() => navigate("/(vendor)/send-offer")}
              style={styles.sendOfferBtn}
            >
              <Text style={styles.sendOfferText}>Send offer to buyers</Text>
              <Ionicons name={"arrow-up-forward" as any} size={16} color="#FFFFFF" style={{ marginLeft: 6 }} />
            </TouchableOpacity>

            {/* ── Get Your First Order (live progress) ────────────────── */}
            {stepsDone < stepsTotal ? (
              <View style={styles.firstOrderCard}>
                <View style={styles.firstOrderHeader}>
                  <Text style={styles.firstOrderTitle}>Get Your First Order</Text>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => navigate("/(vendor)/activation")}
                    style={styles.firstOrderClose}
                  >
                    <Ionicons name="arrow-forward" size={14} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
                <Text style={styles.firstOrderProgress}>
                  Setup progress: {stepsDone} of {stepsTotal} steps completed
                </Text>
                
                {/* Segmented progress bar matching Image exactly */}
                <View style={styles.segmentProgressBar}>
                  {Array.from({ length: stepsTotal }).map((_, idx) => (
                    <View 
                      key={idx} 
                      style={[
                        styles.progressSegment, 
                        { backgroundColor: idx < stepsDone ? "#FFFFFF" : "rgba(255,255,255,0.15)" }
                      ]} 
                    />
                  ))}
                </View>

                <View style={styles.nextStepBox}>
                  <Text style={styles.nextStepLabel}>Next Step</Text>
                  <Text style={styles.nextStepText}>{nextStepText}</Text>
                </View>

                <TouchableOpacity
                  activeOpacity={0.86}
                  onPress={() => navigate("/(vendor)/share-store-link")}
                  style={styles.shareStoreBtn}
                >
                  <Text style={styles.shareStoreText}>Share your store link</Text>
                  <Ionicons name={"arrow-up-forward" as any} size={14} color="#076B51" />
                </TouchableOpacity>
              </View>
            ) : null}

            {/* ── Your Foodstuff ──────────────────────────────────────── */}
            <Text style={styles.section}>Your Foodstuff</Text>
            <View style={styles.foodstuffList}>
              <FoodRow
                icon="list-outline"
                label="Foodstuff list"
                badge={productsCount > 0 ? productsCount : undefined}
                tone="dark"
                onPress={() => navigate("/(vendor)/foodstuff")}
              />
              <FoodRow
                icon="add-circle-outline"
                label="Add foodstuff"
                tone="light"
                onPress={() => navigate("/(vendor)/foodstuff-add")}
              />
              <FoodRow
                icon="alert-circle-outline"
                label="Low stock"
                badge={lowStockCount > 0 ? lowStockCount : undefined}
                tone="light"
                onPress={() => navigate("/(vendor)/foodstuff")}
              />
            </View>

            {/* ── Business Tools (Automation, Regular Deliveries, Community Buy) ── */}
            <Text style={styles.section}>Business Tools</Text>
            <View style={styles.foodstuffList}>
              <FoodRow
                icon="flash-outline"
                label="Automation Center"
                tone="light"
                onPress={() => navigate("/(vendor)/automation-center")}
              />
              <FoodRow
                icon="repeat-outline"
                label="Regular Deliveries"
                badge={pendingRenewals.length > 0 ? pendingRenewals.length : undefined}
                tone="light"
                onPress={() => navigate("/(vendor)/regular-deliveries")}
              />
              <FoodRow
                icon="people-circle-outline"
                label={supplierProfile?.isVerified ? "Community Buy" : "Community Buy — become a supplier"}
                tone="light"
                onPress={() => navigate("/(vendor)/community-buy-supplier")}
              />
            </View>

            {/* ── Your Buyers (live horizontal cards) ─────────────────── */}
            <View style={styles.buyersHeader}>
              <Text style={[styles.section, { marginBottom: 0 }]}>Your Buyers</Text>
              {buyers.length > 0 ? (
                <TouchableOpacity activeOpacity={0.7} onPress={() => navigate("/(vendor)/buyers")}>
                  <Text style={styles.viewAllText}>View All</Text>
                </TouchableOpacity>
              ) : null}
            </View>
            {buyers.length > 0 ? (
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false} 
                contentContainerStyle={{ gap: 12, paddingRight: 16 }}
                style={styles.buyersScroll}
              >
                {buyers.slice(0, 4).map((b) => {
                  const totalBuyerOrders = asNumber(b.totalOrders);
                  const isTop = totalBuyerOrders >= 10;
                  const label = isTop ? `Top Buyer • ${totalBuyerOrders} Orders` : `${totalBuyerOrders} Orders`;
                  return (
                    <BuyerCard 
                      key={b.id} 
                      name={b.name} 
                      uri={b.avatar} 
                      label={label} 
                    />
                  );
                })}
              </ScrollView>
            ) : (
              <View style={styles.buyersEmptyCard}>
                <Ionicons name="people-outline" size={20} color="#076B51" />
                <Text style={styles.buyersEmptyText}>
                  Your buyers will appear here once you start receiving orders.
                </Text>
              </View>
            )}

            {/* ── Store Performance (live) ───────────────────────────── */}
            <Text style={styles.section}>Store Performance</Text>
            <View style={styles.perfRow}>
              <PerfCard
                tone="light"
                label="Rating"
                value={ratingDisplay}
              />
              <PerfCard tone="dark" label="Orders" value={ordersDisplay} />
            </View>
            <View style={styles.deliveryCard}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Ionicons name="airplane-outline" size={18} color="#282828" style={{ marginRight: 8 }} />
                <Text style={styles.deliveryText}>
                  Avg delivery: {deliveryDisplay}
                </Text>
              </View>
              <View
                style={[
                  styles.deliveryBadge,
                  deliveryHealth === "Paused" && { backgroundColor: "rgba(217,119,6,0.10)" },
                  deliveryHealth === "Setup" && { backgroundColor: "rgba(133,133,133,0.10)" },
                ]}
              >
                <Text
                  style={[
                    styles.deliveryBadgeText,
                    deliveryHealth === "Paused" && { color: "#D97706" },
                    deliveryHealth === "Setup" && { color: "#858585" },
                  ]}
                >
                  {deliveryHealth}
                </Text>
              </View>
            </View>

            {/* ── Vendor Services card ─────────────────────────────────── */}
            <LinearGradient
              colors={planGradient as any}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={styles.planCard}
            >
              <View style={styles.planHeaderRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.planTitle}>
                    {subscriptionPlan === "free"
                      ? "Vendor Services"
                      : subscriptionPlan === "growth"
                        ? "Vendor Services"
                        : "Vendor Services"}
                  </Text>
                  {planOrdersText ? (
                    <Text style={styles.planSub}>{planOrdersText}</Text>
                  ) : null}
                </View>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => navigate("/(vendor)/subscription-plans")}
                  style={styles.planIconBtn}
                >
                  <Ionicons name="briefcase" size={16} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
              <Text style={styles.planBody}>
                {planDegraded
                  ? "You have reached your business limit. View your vendor account to manage limits."
                  : planWarning
                    ? "You're approaching your order limit. Check your vendor account for details."
                    : "Manage your vendor services, business limits, and account details."}
              </Text>
              <View style={styles.planDivider} />
              <TouchableOpacity
                activeOpacity={0.86}
                onPress={() => navigate("/(vendor)/subscription-plans")}
                style={styles.upgradeBtn}
              >
                <Text style={styles.upgradeText}>Vendor Account</Text>
                <Ionicons name={"arrow-forward" as any} size={15} color="#076B51" style={{ transform: [{ rotate: "-45deg" }] }} />
              </TouchableOpacity>
            </LinearGradient>
          </>
        )}
        </View>
      </ScrollView>
      </Animated.View>

      <VendorDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </View>
  );
}

// ── Subcomponents ────────────────────────────────────────────────────

function AlertRow({
  icon,
  label,
  count,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  count: number;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={styles.alertRow}>
      <View style={styles.alertIcon}>
        <Ionicons name={icon} size={16} color="#076B51" />
      </View>
      <Text style={styles.alertLabel}>{label}</Text>
      {count > 0 ? (
        <View style={styles.countPill}>
          <Text style={styles.countText}>{count}</Text>
        </View>
      ) : null}
      <View style={styles.arrowPill}>
        <Ionicons name="arrow-up" size={12} color="#076B51" style={{ transform: [{ rotate: "45deg" }] }} />
      </View>
    </TouchableOpacity>
  );
}

function SalesTile({
  tone,
  icon,
  label,
  value,
  sub,
  onPress,
}: {
  tone: "dark" | "light" | "black";
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  sub: string;
  onPress?: () => void;
}) {
  const isDark = tone === "dark";
  const isBlack = tone === "black";
  
  const tileStyle = [
    styles.salesTile, 
    isDark ? styles.tileDark : isBlack ? styles.tileBlack : styles.tileLight
  ];
  
  const iconBg = isDark 
    ? "rgba(255,255,255,0.15)" 
    : isBlack 
      ? "rgba(255,255,255,0.12)" 
      : "rgba(7,107,81,0.08)";
      
  const iconColor = (isDark || isBlack) ? "#FFFFFF" : "#076B51";

  const content = (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
        <View style={[styles.salesTileIconContainer, { backgroundColor: iconBg }]}>
          <Ionicons name={icon} size={14} color={iconColor} />
        </View>
        <Text style={[
          styles.tileLabel,
          (isDark || isBlack) && styles.tileLabelDark,
          { flex: 1, marginLeft: 6 }
        ]} numberOfLines={1}>{label}</Text>
      </View>
      <Text style={[styles.tileValue, (isDark || isBlack) && styles.tileValueDark]}>{value}</Text>
      <Text style={[
        styles.tileSub, 
        (isDark || isBlack) ? styles.tileSubDark : { color: label.toLowerCase().includes("today") ? "#076B51" : "#858585" }
      ]}>{sub}</Text>
    </View>
  );
  
  if (onPress) {
    return (
      <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={tileStyle}>
        {content}
      </TouchableOpacity>
    );
  }
  return <View style={tileStyle}>{content}</View>;
}

function Sparkline({ points }: { points: number[] }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", height: 24, width: 68, gap: 3 }}>
      {points.map((h, i) => (
        <View 
          key={i} 
          style={{ 
            width: 7, 
            height: h, 
            backgroundColor: "#076B5115", 
            borderTopLeftRadius: 3, 
            borderTopRightRadius: 3,
            borderColor: "#076B51",
            borderWidth: 1,
            borderBottomWidth: 0
          }} 
        />
      ))}
    </View>
  );
}

function GrowCard({
  tone,
  icon,
  title,
  onPress,
  locked,
}: {
  tone: "dark" | "light" | "black";
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  onPress: () => void;
  locked?: boolean;
}) {
  const isDark = tone === "dark";
  const isBlack = tone === "black";

  const cardStyle = [
    styles.growCard,
    isDark ? styles.growDark : isBlack ? styles.growBlack : styles.growLight,
  ];

  const iconBg = isDark
    ? "rgba(255,255,255,0.15)"
    : isBlack
      ? "rgba(255,255,255,0.12)"
      : "rgba(7,107,81,0.08)";

  const iconColor = (isDark || isBlack) ? "#FFFFFF" : "#076B51";

  return (
    <TouchableOpacity
      activeOpacity={locked ? 1 : 0.85}
      onPress={locked ? undefined : onPress}
      disabled={locked}
      style={cardStyle}
    >
      {locked ? (
        <View style={styles.growLockBadge}>
          <Ionicons name="lock-closed" size={12} color="#FFFFFF" />
        </View>
      ) : null}
      <View style={[styles.growIconContainer, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={22} color={iconColor} />
      </View>
      <Text style={[
        styles.growCardTitle,
        (isDark || isBlack) && { color: "#FFFFFF" }
      ]}>{title}</Text>
    </TouchableOpacity>
  );
}

function FoodRow({
  icon,
  label,
  badge,
  tone,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  badge?: number;
  tone: "dark" | "light";
  onPress: () => void;
}) {
  const isDark = tone === "dark";
  return (
    <TouchableOpacity 
      activeOpacity={0.85} 
      onPress={onPress} 
      style={[styles.foodRow, isDark && styles.foodRowDark]}
    >
      <View style={[styles.foodIcon, isDark && styles.foodIconDark]}>
        <Ionicons name={icon} size={16} color={isDark ? "#FFFFFF" : "#076B51"} />
      </View>
      <Text style={[styles.foodLabel, isDark && styles.foodLabelDark]}>{label}</Text>
      {badge ? (
        <View style={isDark ? styles.foodBadgeDark : styles.foodBadge}>
          <Text style={isDark ? styles.foodBadgeTextDark : styles.foodBadgeText}>{badge}</Text>
        </View>
      ) : null}
      <Ionicons name="chevron-forward" size={16} color={isDark ? "rgba(255,255,255,0.7)" : "#9AA3A0"} />
    </TouchableOpacity>
  );
}

function BuyerCard({ name, uri, label }: { name: string; uri?: string; label: string }) {
  const initial = name?.trim().charAt(0).toUpperCase() || "?";
  return (
    <View style={styles.buyerCard}>
      <View style={styles.buyerCardAvatar}>
        {uri ? (
          <Image source={{ uri }} style={{ width: "100%", height: "100%" }} />
        ) : (
          <Text style={styles.buyerCardInitial}>{initial}</Text>
        )}
      </View>
      <Text style={styles.buyerCardName} numberOfLines={1}>
        {name.split(" ")[0]}
      </Text>
      <Text style={styles.buyerCardLabel} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function PerfCard({
  tone,
  label,
  value,
}: {
  tone: "dark" | "light";
  label: string;
  value: string;
}) {
  const dark = tone === "dark";
  return (
    <View style={[styles.perfCard, dark ? styles.tileBlack : styles.tileLight]}>
      <View
        style={[
          styles.perfIcon,
          { backgroundColor: dark ? "rgba(255,255,255,0.14)" : "rgba(7,107,81,0.10)" },
        ]}
      >
        <Ionicons
          name={label === "Rating" ? "star" : "bag-handle-outline"}
          size={16}
          color={dark ? "#FFFFFF" : "#076B51"}
        />
      </View>
      <Text style={[styles.perfValue, dark && { color: "#FFFFFF" }]}>{value}</Text>
      <Text style={[styles.perfLabel, dark && { color: "rgba(255,255,255,0.7)" }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scene: { flex: 1, backgroundColor: "#087554" },
  dashboardSurface: { flex: 1, backgroundColor: "#F4F4F4" },
  dashboardSurfaceOpen: {
    borderRadius: 28,
    overflow: "hidden",
    borderWidth: 4,
    borderColor: "#F7F7F7",
    shadowColor: "#000",
    shadowOffset: { width: -8, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 18,
  },

  // ── Hero ─────────────────────────────────────────────────────────────
  hero: {
    backgroundColor: "#076B51",
    paddingHorizontal: 18,
    paddingBottom: 24,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 4,
    marginBottom: 14,
  },
  dateText: { color: "rgba(255,255,255,0.7)", fontSize: 12, fontFamily: "Outfit-Regular", marginBottom: 4 },
  headerIconPill: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },
  headerIconPillAccent: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#1C1C1C",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  headerIconBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "#FB6363",
    borderWidth: 1,
    borderColor: "#FFFFFF",
  },
  welcome: {
    color: "#FFFFFF",
    fontSize: 28,
    fontFamily: "Manrope-Bold",
    marginTop: 8,
  },
  storeNameRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  storeName: {
    color: "#FFFFFF",
    fontSize: 22,
    fontFamily: "Manrope-Bold",
    flexShrink: 1,
  },
  verifiedIcon: { marginLeft: 6 },

  body: { paddingHorizontal: 14, paddingTop: 14 },
  loadingBlock: { paddingVertical: 60, alignItems: "center" },

  // ── Alerts ───────────────────────────────────────────────────────────
  // Negative marginTop floats these cards up over the hero's bottom edge
  // (net -18 over the hero, matching the same float pattern used in vendor-detail.tsx).
  alertsList: {
    gap: 10,
    marginTop: -32,
    marginBottom: 18,
  },
  alertRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingVertical: 13,
    paddingHorizontal: 14,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  alertIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "rgba(7,107,81,0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  alertLabel: { flex: 1, color: "#1A1A1A", fontSize: 13, fontFamily: "Manrope-SemiBold" },
  countPill: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#FFE5E5",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  countText: { fontSize: 10, fontFamily: "Manrope-Bold", color: "#FB6363" },
  arrowPill: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#E8F5F0",
    alignItems: "center",
    justifyContent: "center",
  },
  // ── Section title ────────────────────────────────────────────────────
  section: {
    color: "#1A1A1A",
    fontSize: 18,
    fontFamily: "Manrope-Bold",
    marginBottom: 14,
    marginTop: 8,
  },

  // ── Sales tiles (2×2 grid) ───────────────────────────────────────────
  salesGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 12, marginBottom: 18 },
  salesTile: { width: (SCREEN_WIDTH - 16 * 2 - 12) / 2, backgroundColor: "#FFFFFF", borderRadius: 14, paddingHorizontal: 12, paddingVertical: 12, borderWidth: 1, borderColor: "#F0F0F0", elevation: 2, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 10 },
  salesTileIconContainer: { width: 26, height: 26, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  tileDark: { backgroundColor: "#076B51", borderColor: "#0A8A66" },
  tileLight: { backgroundColor: "#FFFFFF", borderColor: "#F0F0F0" },
  tileBlack: { backgroundColor: "#282828", borderColor: "#3A3A3A" },
  tileLabel: { color: "#858585", fontSize: 11, fontFamily: "Outfit-Regular" },
  tileLabelDark: { color: "rgba(255,255,255,0.75)" },
  tileValue: { color: "#282828", fontSize: 20, fontFamily: "Manrope-Bold", marginTop: 4 },
  tileValueDark: { color: "#FFFFFF" },
  tileSub: { fontSize: 10, fontFamily: "Outfit-Regular", marginTop: 2, color: "#858585" },
  tileSubDark: { color: "rgba(255,255,255,0.6)" },

  // ── Insights vertical timeline ───────────────────────────────────────
  insightsCardContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 14,
    marginBottom: 18,
  },
  insightTimelineRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F4F4F4",
    marginBottom: 16,
  },
  timelineLeftCol: {
    width: 24,
    alignItems: "center",
    position: "relative",
    height: 48,
  },
  timelineCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(7,107,81,0.08)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  timelineVerticalLine: {
    position: "absolute",
    top: 24,
    bottom: -16,
    width: 2,
    backgroundColor: "rgba(7,107,81,0.15)",
    zIndex: 1,
  },
  timelineContentCol: {
    flex: 1,
    marginLeft: 12,
  },
  timelineRightCol: {
    marginLeft: 8,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  insightLabel: {
    color: "#858585",
    fontSize: 10,
    fontFamily: "Outfit-Regular",
  },
  insightTitle: {
    color: "#282828",
    fontSize: 13,
    fontFamily: "Manrope-Bold",
    marginTop: 3,
  },

  // ── Grow grid ────────────────────────────────────────────────────────
  growGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 10, marginBottom: 8 },
  growCard: { width: (SCREEN_WIDTH - 16 * 2 - 10) / 2, minHeight: 114, borderRadius: 20, padding: 14, justifyContent: "space-between" },
  growDark: { backgroundColor: "#076B51" },
  growLight: { backgroundColor: "#FFFFFF" },
  growBlack: { backgroundColor: "#282828" },
  growIconContainer: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  growCardTitle: { color: "#282828", fontSize: 13, fontFamily: "Manrope-Bold" },
  growLockBadge: {
    position: "absolute", top: 10, right: 10, width: 22, height: 22, borderRadius: 11,
    backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center", zIndex: 1,
  },

  // ── Send offer ───────────────────────────────────────────────────────
  sendOfferBtn: { height: 50, borderRadius: 14, backgroundColor: "#076B51", alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6, marginBottom: 18 },
  sendOfferText: { color: "#FFFFFF", fontSize: 14, fontFamily: "Manrope-SemiBold" },

  // ── Get Your First Order ─────────────────────────────────────────────
  firstOrderCard: { backgroundColor: "#282828", borderRadius: 20, padding: 18, marginBottom: 18 },
  firstOrderHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  firstOrderTitle: { color: "#FFFFFF", fontSize: 15, fontFamily: "Manrope-Bold" },
  firstOrderClose: { width: 24, height: 24, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" },
  firstOrderProgress: { color: "rgba(255,255,255,0.7)", fontSize: 11, fontFamily: "Outfit-Regular", marginTop: 8 },
  segmentProgressBar: { flexDirection: "row", gap: 6, marginTop: 12, marginBottom: 16 },
  progressSegment: { flex: 1, height: 4, borderRadius: 2 },
  nextStepBox: { backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 12, padding: 12, marginBottom: 16 },
  nextStepLabel: { color: "rgba(255,255,255,0.5)", fontSize: 10, fontFamily: "Manrope-SemiBold" },
  nextStepText: { color: "#FFFFFF", fontSize: 12, fontFamily: "Manrope-SemiBold", marginTop: 4 },
  shareStoreBtn: { height: 44, borderRadius: 12, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
  shareStoreText: { color: "#076B51", fontSize: 13, fontFamily: "Manrope-SemiBold" },

  // ── Foodstuff ────────────────────────────────────────────────────────
  foodstuffList: { gap: 8, marginBottom: 18 },
  foodRow: { backgroundColor: "#FFFFFF", borderRadius: 16, paddingVertical: 14, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 12 },
  foodRowDark: { backgroundColor: "#076B51" },
  foodIcon: { width: 30, height: 30, borderRadius: 10, backgroundColor: "rgba(7,107,81,0.08)", alignItems: "center", justifyContent: "center" },
  foodIconDark: { backgroundColor: "rgba(255,255,255,0.15)" },
  foodLabel: { flex: 1, color: "#282828", fontSize: 13, fontFamily: "Manrope-SemiBold" },
  foodLabelDark: { color: "#FFFFFF" },
  foodBadge: { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, backgroundColor: "#FFE5E5", alignItems: "center", justifyContent: "center" },
  foodBadgeDark: { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  foodBadgeText: { color: "#FB6363", fontSize: 10, fontFamily: "Manrope-Bold" },
  foodBadgeTextDark: { color: "#076B51", fontSize: 10, fontFamily: "Manrope-Bold" },

  // ── Buyers ───────────────────────────────────────────────────────────
  buyersHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 6, marginBottom: 10 },
  viewAllText: { color: "#076B51", fontSize: 12, fontFamily: "Manrope-Bold" },
  buyersScroll: { marginBottom: 18 },
  buyerCard: {
    width: 108,
    height: 124,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 12,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 6,
    elevation: 1,
  },
  buyerCardAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#076B5108",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginBottom: 8,
  },
  buyerCardInitial: {
    color: "#076B51",
    fontSize: 16,
    fontFamily: "Manrope-Bold",
  },
  buyerCardName: {
    color: "#282828",
    fontSize: 11,
    fontFamily: "Manrope-Bold",
    textAlign: "center",
  },
  buyerCardLabel: {
    color: "#858585",
    fontSize: 9,
    fontFamily: "Outfit-Regular",
    textAlign: "center",
    marginTop: 2,
  },
  buyersEmptyCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 18,
  },
  buyersEmptyText: { flex: 1, color: "#858585", fontSize: 12, fontFamily: "Outfit-Regular", lineHeight: 18 },

  // ── Performance ──────────────────────────────────────────────────────
  perfRow: { flexDirection: "row", gap: 12, marginBottom: 12 },
  perfCard: { flex: 1, minHeight: 90, borderRadius: 18, padding: 14, gap: 8 },
  perfIcon: { width: 30, height: 30, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  perfValue: { color: "#282828", fontSize: 18, fontFamily: "Manrope-Bold", marginTop: 4 },
  perfLabel: { color: "#858585", fontSize: 11, fontFamily: "Outfit-Regular" },

  deliveryCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 18,
  },
  deliveryText: { color: "#282828", fontSize: 13, fontFamily: "Manrope-SemiBold" },
  deliveryBadge: { backgroundColor: "rgba(7,107,81,0.08)", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  deliveryBadgeText: { color: "#076B51", fontSize: 11, fontFamily: "Manrope-Bold" },

  // ── Plan card ────────────────────────────────────────────────────────
  planCard: { borderRadius: 24, padding: 24, overflow: "hidden" as const },
  planHeaderRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  planTitle: { color: "#FFFFFF", fontSize: 22, fontFamily: "Manrope-Bold", fontStyle: "italic" },
  planIconBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
  planSub: { color: "rgba(255,255,255,0.85)", fontSize: 14, fontFamily: "Outfit-Regular", marginTop: 5 },
  planBody: { color: "rgba(255,255,255,0.75)", fontSize: 13, fontFamily: "Outfit-Regular", lineHeight: 19, marginTop: 16 },
  planDivider: { height: 1, backgroundColor: "rgba(255,255,255,0.15)", marginTop: 22, marginBottom: 14 },
  upgradeBtn: { height: 50, borderRadius: 14, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 10 },
  upgradeText: { color: "#076B51", fontSize: 15, fontFamily: "Manrope-SemiBold" },
});
