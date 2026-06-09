import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { buyerService, type VendorBuyerSummary } from "../../services/buyerService";
import { orderService } from "../../services/orderService";
import { productService } from "../../services/productService";
import { publicStoreService, type PublicStoreAnalyticsDetail } from "../../services/publicStoreService";
import { vendorService } from "../../services/vendorService";
import { useAuthStore } from "../../stores/authStore";
import { useCurrencyStore } from "../../stores/currencyStore";
import type { Order } from "../../types/order";
import type { Product } from "../../types/product";
import type {
  VendorAnalyticsData,
  VendorAnalyticsInsight,
  VendorAnalyticsRange,
  VendorAnalyticsTopProduct,
  VendorDashboardData,
} from "../../types/vendor";
import { convertMoney, formatDisplayMoney, normalizeCurrencyCode } from "../../utils/currency";
import { goBackOrReplace } from "../../utils/navigation";
import { toCompactStoreSlug } from "../../utils/shareLinks";

const RANGE_OPTIONS: { id: VendorAnalyticsRange; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "7d", label: "Last 7 days" },
  { id: "month", label: "This month" },
  { id: "30d", label: "Last 30 days" },
  { id: "all", label: "All time" },
];

function emptyPublicAnalytics(storeSlug: string): PublicStoreAnalyticsDetail {
  return {
    storeSlug,
    opens: 0,
    cartAdds: 0,
    checkoutStarts: 0,
    ordersPlaced: 0,
    trackRequests: 0,
    reorders: 0,
    appLaunches: 0,
    saveVendorCount: 0,
    weeklyOpens: 0,
    weeklyOrders: 0,
    conversionRate: 0,
    totalRevenue: 0,
    pendingRevenue: 0,
    completedOrders: 0,
    repeatRevenue: 0,
    sourceBreakdown: {
      instagram: 0,
      whatsapp: 0,
      sms: 0,
      direct: 0,
      tiktok: 0,
      more: 0,
      unknown: 0,
    },
    sourceOrders: {
      instagram: 0,
      whatsapp: 0,
      sms: 0,
      direct: 0,
      tiktok: 0,
      more: 0,
      unknown: 0,
    },
    sourceRevenue: {
      instagram: 0,
      whatsapp: 0,
      sms: 0,
      direct: 0,
      tiktok: 0,
      more: 0,
      unknown: 0,
    },
    sourcePerformance: [],
    topProducts: [],
  };
}

function emptyVendorAnalytics(range: VendorAnalyticsRange): VendorAnalyticsData {
  return {
    range,
    summary: {
      currency: "GBP",
      totalRevenue: 0,
      estimatedProfit: 0,
      estimatedProfitAvailable: false,
      availableForPayout: 0,
      pendingBalance: 0,
    },
    salesFunnel: {
      storeVisits: 0,
      checkoutStarted: 0,
      ordersCompleted: 0,
      conversionRate: 0,
      repeatOrders: 0,
      storeSaves: 0,
    },
    customerInsights: {
      newBuyers: 0,
      repeatBuyers: 0,
      inactiveBuyers30d: 0,
    },
    topProducts: [],
    insights: [],
  };
}

function getRangeStart(range: VendorAnalyticsRange): Date | null {
  const now = new Date();
  if (range === "all") return null;
  if (range === "today") return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (range === "month") return new Date(now.getFullYear(), now.getMonth(), 1);
  const days = range === "7d" ? 7 : 30;
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

function isAfterRange(value: string | null | undefined, range: VendorAnalyticsRange): boolean {
  const start = getRangeStart(range);
  if (!start) return true;
  if (!value) return false;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) && timestamp >= start.getTime();
}

function toBaseGbp(value: number, currency?: string): number {
  return convertMoney(Number(value) || 0, currency ?? "GBP", "GBP");
}

function countCompletedOrders(orders: Order[]): number {
  return orders.filter((order) => order.status === "delivered" || order.paymentStatus === "paid").length;
}

function buildTopProducts(orders: Order[], publicAnalytics: PublicStoreAnalyticsDetail): VendorAnalyticsTopProduct[] {
  const productMap = new Map<string, VendorAnalyticsTopProduct>();
  const productOrderMap = new Map<string, Set<string>>();

  for (const order of orders) {
    for (const item of order.items ?? []) {
      const product = item.product;
      const key = product.id || product.name;
      if (!key) continue;

      const quantity = Number(item.quantity) || 0;
      const lineRevenue = toBaseGbp((Number(product.price) || 0) * quantity, product.currency);
      const costPrice = Number(product.costPrice);
      const hasCost = Number.isFinite(costPrice) && costPrice > 0;
      const lineProfit = hasCost
        ? toBaseGbp(((Number(product.price) || 0) - costPrice) * quantity, product.currency)
        : undefined;

      const current = productMap.get(key) ?? {
        productId: product.id || key,
        name: product.name || "Product",
        orders: 0,
        unitsSold: 0,
        revenue: 0,
        estimatedProfit: 0,
        hasCost: false,
      };
      const orderSet = productOrderMap.get(key) ?? new Set<string>();
      orderSet.add(order.id);
      productOrderMap.set(key, orderSet);

      productMap.set(key, {
        ...current,
        orders: orderSet.size,
        unitsSold: current.unitsSold + quantity,
        revenue: current.revenue + lineRevenue,
        estimatedProfit: hasCost ? (current.estimatedProfit ?? 0) + (lineProfit ?? 0) : current.estimatedProfit,
        hasCost: current.hasCost || hasCost,
      });
    }
  }

  const fromOrders = [...productMap.values()]
    .map((product) => ({
      ...product,
      estimatedProfit: product.hasCost ? product.estimatedProfit : undefined,
    }))
    .sort((left, right) => right.revenue - left.revenue)
    .slice(0, 5);

  if (fromOrders.length > 0) return fromOrders;

  return publicAnalytics.topProducts.map((product) => ({
    productId: product.productId,
    name: product.name,
    orders: product.unitsSold > 0 ? 1 : 0,
    unitsSold: product.unitsSold,
    revenue: toBaseGbp(product.revenue, "GBP"),
    estimatedProfit: undefined,
    hasCost: false,
  }));
}

function buildInsights(input: {
  analytics: VendorAnalyticsData;
  products: Product[];
  buyers: VendorBuyerSummary[];
}): VendorAnalyticsInsight[] {
  const insights: VendorAnalyticsInsight[] = [];
  const lowStock = input.products.find((product) => product.stock > 0 && product.stock <= 5);
  const hasAbandonedCheckout =
    input.analytics.salesFunnel.checkoutStarted > input.analytics.salesFunnel.ordersCompleted;

  if (input.analytics.salesFunnel.storeVisits === 0) {
    insights.push({
      id: "share-store",
      title: "Get first store visits",
      body: "Share your store link with buyers so Eki can track visits, cart adds, and orders.",
      action: "share_store",
      actionLabel: "Share store",
      severity: "info",
    });
  }

  if (input.analytics.customerInsights.inactiveBuyers30d > 0) {
    insights.push({
      id: "inactive-buyers",
      title: "Bring buyers back",
      body: `${input.analytics.customerInsights.inactiveBuyers30d} buyers have not ordered in 30 days.`,
      action: "send_offer",
      actionLabel: "Send offer",
      severity: "warning",
    });
  }

  if (lowStock) {
    insights.push({
      id: `restock-${lowStock.id}`,
      title: "Restock a popular item",
      body: `${lowStock.name} has ${lowStock.stock} left. Restock before it blocks repeat orders.`,
      action: "restock_product",
      actionLabel: "Restock product",
      productId: lowStock.id,
      severity: "warning",
    });
  }

  if (hasAbandonedCheckout) {
    insights.push({
      id: "send-reminder",
      title: "Recover checkout intent",
      body: "Some buyers started checkout but did not complete the order.",
      action: "send_reminder",
      actionLabel: "Send reminder",
      severity: "info",
    });
  }

  if (input.buyers.length > 0) {
    insights.push({
      id: "view-buyers",
      title: "Review your buyer list",
      body: "See repeat buyers, last order dates, and who may need a personal offer.",
      action: "view_buyers",
      actionLabel: "View buyers",
      severity: "success",
    });
  }

  return insights.slice(0, 4);
}

function buildFallbackAnalytics(input: {
  range: VendorAnalyticsRange;
  publicAnalytics: PublicStoreAnalyticsDetail;
  dashboard: VendorDashboardData | null;
  orders: Order[];
  buyers: VendorBuyerSummary[];
  products: Product[];
}): VendorAnalyticsData {
  const filteredOrders = input.orders.filter((order) => isAfterRange(order.createdAt, input.range));
  const paidOrders = filteredOrders.filter(
    (order) => order.paymentStatus === "paid" || order.status === "delivered" || order.status === "processing",
  );
  const completedOrders = countCompletedOrders(filteredOrders);
  const orderRevenue = paidOrders.reduce((sum, order) => sum + toBaseGbp(order.total, order.currency), 0);
  const pendingBalance = paidOrders
    .filter((order) => order.status !== "delivered" && order.status !== "cancelled" && order.status !== "refunded")
    .reduce((sum, order) => sum + toBaseGbp(order.vendorEarnings ?? order.total - (order.platformFee ?? 0), order.currency), 0);
  const availableForPayout = paidOrders
    .filter((order) => order.status === "delivered")
    .reduce((sum, order) => sum + toBaseGbp(order.vendorEarnings ?? order.total - (order.platformFee ?? 0), order.currency), 0);
  const productCosts = paidOrders.flatMap((order) =>
    order.items.map((item) => ({
      revenue: toBaseGbp((item.product.price ?? 0) * item.quantity, item.product.currency),
      cost:
        item.product.costPrice && item.product.costPrice > 0
          ? toBaseGbp(item.product.costPrice * item.quantity, item.product.costCurrency ?? item.product.currency)
          : null,
    })),
  );
  const hasProductCosts = productCosts.some((entry) => entry.cost !== null);
  const estimatedProfit = hasProductCosts
    ? productCosts.reduce((sum, entry) => sum + (entry.revenue - (entry.cost ?? 0)), 0)
    : paidOrders.reduce((sum, order) => sum + toBaseGbp(order.vendorEarnings ?? order.total - (order.platformFee ?? 0), order.currency), 0);

  const repeatBuyers = input.buyers.filter((buyer) => buyer.totalOrders > 1).length;
  const inactiveCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).getTime();
  const inactiveBuyers = input.buyers.filter((buyer) => {
    const lastOrder = buyer.lastOrderAt ? new Date(buyer.lastOrderAt).getTime() : 0;
    return lastOrder > 0 && lastOrder < inactiveCutoff;
  }).length;
  const newBuyers = input.buyers.filter(
    (buyer) => isAfterRange(buyer.joinedAt ?? buyer.lastOrderAt, input.range),
  ).length;

  const storeVisits = input.publicAnalytics.opens;
  const checkoutStarted = input.publicAnalytics.checkoutStarts;
  const publicCompleted = input.publicAnalytics.completedOrders || input.publicAnalytics.ordersPlaced;
  const ordersCompleted = publicCompleted || completedOrders;
  const conversionRate = storeVisits > 0 ? (ordersCompleted / storeVisits) * 100 : 0;
  const repeatOrders =
    input.publicAnalytics.reorders ||
    input.buyers.reduce((sum, buyer) => sum + Math.max(0, buyer.totalOrders - 1), 0);

  const analytics: VendorAnalyticsData = {
    range: input.range,
    summary: {
      currency: "GBP",
      totalRevenue: orderRevenue || toBaseGbp(input.publicAnalytics.totalRevenue, "GBP"),
      estimatedProfit,
      estimatedProfitAvailable: hasProductCosts,
      availableForPayout: availableForPayout || input.dashboard?.earnings.availableBalance || 0,
      pendingBalance: pendingBalance || input.dashboard?.earnings.pendingPayout || toBaseGbp(input.publicAnalytics.pendingRevenue, "GBP"),
    },
    salesFunnel: {
      storeVisits,
      checkoutStarted,
      ordersCompleted,
      conversionRate: input.publicAnalytics.conversionRate || conversionRate,
      repeatOrders,
      storeSaves: input.publicAnalytics.saveVendorCount,
    },
    customerInsights: {
      newBuyers,
      repeatBuyers,
      inactiveBuyers30d: inactiveBuyers,
    },
    topProducts: buildTopProducts(paidOrders, input.publicAnalytics),
    insights: [],
  };

  analytics.insights = buildInsights({ analytics, products: input.products, buyers: input.buyers });
  return analytics;
}

function mergeAnalytics(server: VendorAnalyticsData | null, fallback: VendorAnalyticsData): VendorAnalyticsData {
  if (!server) return fallback;
  const pick = (serverValue: number, fallbackValue: number) => (serverValue > 0 ? serverValue : fallbackValue);

  return {
    range: fallback.range,
    summary: {
      currency: normalizeCurrencyCode(server.summary.currency || fallback.summary.currency),
      totalRevenue: pick(server.summary.totalRevenue, fallback.summary.totalRevenue),
      estimatedProfit: pick(server.summary.estimatedProfit, fallback.summary.estimatedProfit),
      estimatedProfitAvailable:
        server.summary.estimatedProfitAvailable || fallback.summary.estimatedProfitAvailable,
      availableForPayout: pick(server.summary.availableForPayout, fallback.summary.availableForPayout),
      pendingBalance: pick(server.summary.pendingBalance, fallback.summary.pendingBalance),
    },
    salesFunnel: {
      storeVisits: pick(server.salesFunnel.storeVisits, fallback.salesFunnel.storeVisits),
      checkoutStarted: pick(server.salesFunnel.checkoutStarted, fallback.salesFunnel.checkoutStarted),
      ordersCompleted: pick(server.salesFunnel.ordersCompleted, fallback.salesFunnel.ordersCompleted),
      conversionRate: pick(server.salesFunnel.conversionRate, fallback.salesFunnel.conversionRate),
      repeatOrders: pick(server.salesFunnel.repeatOrders, fallback.salesFunnel.repeatOrders),
      storeSaves: pick(server.salesFunnel.storeSaves, fallback.salesFunnel.storeSaves),
    },
    customerInsights: {
      newBuyers: pick(server.customerInsights.newBuyers, fallback.customerInsights.newBuyers),
      repeatBuyers: pick(server.customerInsights.repeatBuyers, fallback.customerInsights.repeatBuyers),
      inactiveBuyers30d: pick(server.customerInsights.inactiveBuyers30d, fallback.customerInsights.inactiveBuyers30d),
    },
    topProducts: server.topProducts.length > 0 ? server.topProducts : fallback.topProducts,
    insights: server.insights.length > 0 ? server.insights : fallback.insights,
  };
}

function StatCard({
  label,
  value,
  helper,
  icon,
}: {
  label: string;
  value: string;
  helper?: string;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={styles.statCard}>
      <View style={styles.statIcon}>
        <Ionicons name={icon} size={18} color="#076B51" />
      </View>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      {helper ? <Text style={styles.statHelper}>{helper}</Text> : null}
    </View>
  );
}

function InsightAction({
  item,
  onPress,
}: {
  item: VendorAnalyticsInsight;
  onPress: (item: VendorAnalyticsInsight) => void;
}) {
  const color = item.severity === "warning" ? "#B45309" : item.severity === "success" ? "#076B51" : "#315A80";
  return (
    <View style={styles.insightCard}>
      <View style={[styles.insightDot, { backgroundColor: `${color}18` }]}>
        <Ionicons
          name={item.severity === "warning" ? "warning-outline" : item.severity === "success" ? "checkmark" : "sparkles-outline"}
          size={16}
          color={color}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.insightTitle}>{item.title}</Text>
        <Text style={styles.insightBody}>{item.body}</Text>
        <TouchableOpacity onPress={() => onPress(item)} activeOpacity={0.85} style={styles.inlineAction}>
          <Text style={styles.inlineActionText}>{item.actionLabel}</Text>
          <Ionicons name="arrow-forward" size={13} color="#076B51" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function VendorAnalyticsScreen() {
  const router = useRouter();
  const { selectedCurrency } = useCurrencyStore();
  const user = useAuthStore((state) => state.user);
  const vendor = user?.role === "vendor" ? user : null;
  const storeSlug = toCompactStoreSlug(vendor?.storeSlug ?? vendor?.storeName);

  const [range, setRange] = useState<VendorAnalyticsRange>("month");
  const [analytics, setAnalytics] = useState<VendorAnalyticsData>(emptyVendorAnalytics("month"));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const formatCurrency = useCallback(
    (value: number, sourceCurrency = analytics.summary.currency) =>
      formatDisplayMoney(value, sourceCurrency || "GBP", selectedCurrency),
    [analytics.summary.currency, selectedCurrency],
  );

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      setError("");

      const publicAnalyticsPromise = storeSlug
        ? publicStoreService.getDetailedAnalytics(storeSlug).catch(() => emptyPublicAnalytics(storeSlug))
        : Promise.resolve(emptyPublicAnalytics(""));

      Promise.allSettled([
        vendorService.getVendorAnalytics(range),
        publicAnalyticsPromise,
        vendorService.getVendorDashboard().catch(() => null),
        orderService.getVendorOrders().catch(() => [] as Order[]),
        buyerService.listMyBuyers().catch(() => [] as VendorBuyerSummary[]),
        vendor?.id ? productService.getVendorProducts(vendor.id).catch(() => [] as Product[]) : Promise.resolve([] as Product[]),
      ])
        .then((results) => {
          if (!active) return;
          const serverAnalytics =
            results[0].status === "fulfilled" ? (results[0].value as VendorAnalyticsData) : null;
          const publicAnalytics =
            results[1].status === "fulfilled" ? (results[1].value as PublicStoreAnalyticsDetail) : emptyPublicAnalytics(storeSlug);
          const dashboard = results[2].status === "fulfilled" ? (results[2].value as VendorDashboardData | null) : null;
          const orders = results[3].status === "fulfilled" ? (results[3].value as Order[]) : [];
          const buyers = results[4].status === "fulfilled" ? (results[4].value as VendorBuyerSummary[]) : [];
          const products = results[5].status === "fulfilled" ? (results[5].value as Product[]) : [];

          const fallback = buildFallbackAnalytics({ range, publicAnalytics, dashboard, orders, buyers, products });
          setAnalytics(mergeAnalytics(serverAnalytics, fallback));

          if (results[0].status === "rejected" && !storeSlug && orders.length === 0) {
            setError("Analytics will appear after your store has visits or orders.");
          }
        })
        .catch((err) => {
          if (active) setError(err instanceof Error ? err.message : "Could not load analytics.");
        })
        .finally(() => {
          if (active) setLoading(false);
        });

      return () => {
        active = false;
      };
    }, [range, storeSlug, vendor?.id]),
  );

  const funnelRows = useMemo(
    () => [
      { label: "Store Visits", value: analytics.salesFunnel.storeVisits, icon: "eye-outline" as const },
      { label: "Checkout Started", value: analytics.salesFunnel.checkoutStarted, icon: "cart-outline" as const },
      { label: "Orders Completed", value: analytics.salesFunnel.ordersCompleted, icon: "checkmark-circle-outline" as const },
      { label: "Conversion Rate", value: `${Math.round(analytics.salesFunnel.conversionRate)}%`, icon: "trending-up-outline" as const },
      { label: "Repeat Orders", value: analytics.salesFunnel.repeatOrders, icon: "repeat-outline" as const },
      { label: "Store Saves", value: analytics.salesFunnel.storeSaves, icon: "bookmark-outline" as const },
    ],
    [analytics.salesFunnel],
  );

  const maxProductRevenue = Math.max(1, ...analytics.topProducts.map((product) => product.revenue));

  const handleInsightAction = (item: VendorAnalyticsInsight) => {
    if (item.action === "send_offer" || item.action === "send_reminder") {
      router.push("/(vendor)/send-offer" as any);
      return;
    }
    if (item.action === "restock_product" && item.productId) {
      router.push({ pathname: "/(vendor)/foodstuff-edit", params: { id: item.productId } } as any);
      return;
    }
    if (item.action === "view_buyers") {
      router.push("/(vendor)/buyers" as any);
      return;
    }
    if (item.action === "share_product") {
      router.push("/(vendor)/foodstuff" as any);
      return;
    }
    router.push("/(vendor)/share-store-link" as any);
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => goBackOrReplace(router, "/(vendor)/settings" as any)}
          activeOpacity={0.85}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={20} color="#076B51" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Analytics</Text>
          <Text style={styles.headerSubtitle}>Revenue, buyers, products, and Eki recommendations.</Text>
        </View>
      </View>

      <View style={styles.rangeRail}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rangeContent}>
          {RANGE_OPTIONS.map((option) => {
            const active = range === option.id;
            return (
              <TouchableOpacity
                key={option.id}
                onPress={() => setRange(option.id)}
                activeOpacity={0.85}
                style={[styles.rangeChip, active && styles.rangeChipActive]}
              >
                <Text style={[styles.rangeChipText, active && styles.rangeChipTextActive]}>{option.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.loadingPage}>
          <ActivityIndicator color="#076B51" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={styles.moneyGrid}>
            <StatCard
              icon="cash-outline"
              label="Total Revenue"
              value={formatCurrency(analytics.summary.totalRevenue)}
              helper="Paid orders in this period"
            />
            <StatCard
              icon="analytics-outline"
              label="Estimated Profit"
              value={formatCurrency(analytics.summary.estimatedProfit)}
              helper={analytics.summary.estimatedProfitAvailable ? "Uses product cost" : "Add product costs for accuracy"}
            />
            <StatCard
              icon="wallet-outline"
              label="Available for Payout"
              value={formatCurrency(analytics.summary.availableForPayout)}
              helper="Ready after delivery release"
            />
            <StatCard
              icon="time-outline"
              label="Pending Balance"
              value={formatCurrency(analytics.summary.pendingBalance)}
              helper="Held until delivery or payout"
            />
          </View>

          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Sales Funnel</Text>
              <Text style={styles.sectionMeta}>{Math.round(analytics.salesFunnel.conversionRate)}% conversion</Text>
            </View>
            <View style={styles.funnelGrid}>
              {funnelRows.map((row) => (
                <View key={row.label} style={styles.funnelItem}>
                  <View style={styles.funnelIcon}>
                    <Ionicons name={row.icon} size={15} color="#076B51" />
                  </View>
                  <Text style={styles.funnelValue}>{row.value}</Text>
                  <Text style={styles.funnelLabel}>{row.label}</Text>
                </View>
              ))}
            </View>
            {analytics.salesFunnel.ordersCompleted === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>No orders yet from your store link</Text>
                <Text style={styles.emptyText}>
                  Share your store link on WhatsApp, Instagram, or Facebook to start receiving orders.
                </Text>
                <TouchableOpacity onPress={() => router.push("/(vendor)/share-store-link" as any)} style={styles.emptyButton}>
                  <Text style={styles.emptyButtonText}>Share Store Link</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>

          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Customer Insights</Text>
              <TouchableOpacity onPress={() => router.push("/(vendor)/buyers" as any)} activeOpacity={0.85}>
                <Text style={styles.sectionLink}>View buyers</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.customerRow}>
              <View style={styles.customerTile}>
                <Text style={styles.customerValue}>{analytics.customerInsights.newBuyers}</Text>
                <Text style={styles.customerLabel}>New Buyers</Text>
              </View>
              <View style={styles.customerTile}>
                <Text style={styles.customerValue}>{analytics.customerInsights.repeatBuyers}</Text>
                <Text style={styles.customerLabel}>Repeat Buyers</Text>
              </View>
              <View style={styles.customerTile}>
                <Text style={styles.customerValue}>{analytics.customerInsights.inactiveBuyers30d}</Text>
                <Text style={styles.customerLabel}>Inactive 30d</Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => router.push("/(vendor)/send-offer" as any)}
              activeOpacity={0.85}
              style={styles.secondaryAction}
            >
              <Ionicons name="pricetag-outline" size={16} color="#076B51" />
              <Text style={styles.secondaryActionText}>Send Offer</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Top Products</Text>
              <TouchableOpacity onPress={() => router.push("/(vendor)/foodstuff" as any)} activeOpacity={0.85}>
                <Text style={styles.sectionLink}>Manage</Text>
              </TouchableOpacity>
            </View>
            {analytics.topProducts.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>No product sales yet</Text>
                <Text style={styles.emptyText}>Once customers start buying, your best-selling products will appear here.</Text>
                <TouchableOpacity onPress={() => router.push("/(vendor)/foodstuff" as any)} style={styles.emptyButton}>
                  <Text style={styles.emptyButtonText}>Share Product</Text>
                </TouchableOpacity>
              </View>
            ) : (
              analytics.topProducts.map((product) => (
                <View key={product.productId || product.name} style={styles.productRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.productName}>{product.name}</Text>
                    <Text style={styles.productMeta}>
                      {product.orders} orders - {product.unitsSold} units - {formatCurrency(product.revenue, "GBP")}
                    </Text>
                    <View style={styles.productBarTrack}>
                      <View
                        style={[
                          styles.productBarFill,
                          { width: `${Math.max(8, (product.revenue / maxProductRevenue) * 100)}%` },
                        ]}
                      />
                    </View>
                  </View>
                  <View style={styles.productProfitPill}>
                    <Text style={styles.productProfitLabel}>Profit</Text>
                    <Text style={styles.productProfitValue}>
                      {product.hasCost && product.estimatedProfit !== undefined
                        ? formatCurrency(product.estimatedProfit, "GBP")
                        : "Add cost"}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Eki Insights</Text>
            {analytics.insights.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>No recommendations yet</Text>
                <Text style={styles.emptyText}>Eki will suggest offers, reminders, and restock actions as data comes in.</Text>
              </View>
            ) : (
              analytics.insights.map((item) => (
                <InsightAction key={item.id} item={item} onPress={handleInsightAction} />
              ))
            )}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F4F4F4" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 14,
  },
  backButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E7ECEA",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { color: "#282828", fontSize: 30, lineHeight: 34, fontFamily: "Manrope-Bold" },
  headerSubtitle: { color: "#858585", fontSize: 13, lineHeight: 18, fontFamily: "Outfit-Regular", marginTop: 4 },
  rangeRail: { paddingBottom: 10 },
  rangeContent: { paddingHorizontal: 20, gap: 8 },
  rangeChip: {
    minHeight: 38,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E7ECEA",
    paddingHorizontal: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  rangeChipActive: { backgroundColor: "#076B51", borderColor: "#076B51" },
  rangeChipText: { color: "#858585", fontSize: 13, fontFamily: "Outfit-Medium" },
  rangeChipTextActive: { color: "#FFFFFF" },
  loadingPage: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { paddingHorizontal: 20, paddingBottom: 34 },
  errorText: {
    color: "#B45309",
    backgroundColor: "#FFF6E9",
    borderColor: "#F4C99A",
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: "Outfit-Regular",
    marginBottom: 12,
  },
  moneyGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 14 },
  statCard: {
    width: "48%",
    minHeight: 168,
    borderRadius: 26,
    backgroundColor: "#FFFFFF",
    padding: 18,
    borderWidth: 1,
    borderColor: "#EEF1EF",
  },
  statIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#E7F3EE",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  statLabel: { color: "#858585", fontSize: 14, lineHeight: 18, fontFamily: "Outfit-Medium" },
  statValue: { color: "#282828", fontSize: 22, lineHeight: 28, fontFamily: "Manrope-Bold", marginTop: 8 },
  statHelper: { color: "#076B51", fontSize: 12, lineHeight: 16, fontFamily: "Outfit-Regular", marginTop: 8 },
  card: {
    borderRadius: 26,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#EEF1EF",
    padding: 18,
    marginBottom: 14,
  },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  sectionTitle: { color: "#282828", fontSize: 19, lineHeight: 24, fontFamily: "Manrope-Bold" },
  sectionMeta: { color: "#076B51", fontSize: 12, fontFamily: "Outfit-Medium" },
  sectionLink: { color: "#076B51", fontSize: 13, fontFamily: "Outfit-Medium" },
  funnelGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  funnelItem: {
    width: "48%",
    borderRadius: 18,
    backgroundColor: "#F7FAF8",
    padding: 14,
    minHeight: 108,
  },
  funnelIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#E7F3EE",
    alignItems: "center",
    justifyContent: "center",
  },
  funnelValue: { color: "#282828", fontSize: 22, lineHeight: 28, fontFamily: "Manrope-Bold", marginTop: 12 },
  funnelLabel: { color: "#858585", fontSize: 12, lineHeight: 16, fontFamily: "Outfit-Regular", marginTop: 2 },
  customerRow: { flexDirection: "row", gap: 10 },
  customerTile: {
    flex: 1,
    borderRadius: 18,
    backgroundColor: "#F7FAF8",
    paddingHorizontal: 10,
    paddingVertical: 14,
    alignItems: "center",
  },
  customerValue: { color: "#282828", fontSize: 22, fontFamily: "Manrope-Bold" },
  customerLabel: { color: "#858585", fontSize: 11, lineHeight: 15, fontFamily: "Outfit-Regular", textAlign: "center", marginTop: 4 },
  secondaryAction: {
    marginTop: 14,
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#076B51",
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryActionText: { color: "#076B51", fontSize: 14, fontFamily: "Manrope-SemiBold" },
  emptyState: {
    borderRadius: 18,
    backgroundColor: "#F7FAF8",
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
  emptyTitle: { color: "#282828", fontSize: 16, fontFamily: "Manrope-Bold" },
  emptyText: { color: "#858585", fontSize: 13, lineHeight: 18, fontFamily: "Outfit-Regular", marginTop: 4 },
  emptyButton: {
    alignSelf: "flex-start",
    marginTop: 12,
    borderRadius: 12,
    backgroundColor: "#076B51",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  emptyButtonText: { color: "#FFFFFF", fontSize: 13, fontFamily: "Manrope-SemiBold" },
  productRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#EEF1EF",
    paddingBottom: 14,
    marginBottom: 14,
  },
  productName: { color: "#282828", fontSize: 15, lineHeight: 20, fontFamily: "Manrope-Bold" },
  productMeta: { color: "#858585", fontSize: 12, lineHeight: 16, fontFamily: "Outfit-Regular", marginTop: 3 },
  productBarTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: "#E8F0EC",
    overflow: "hidden",
    marginTop: 9,
  },
  productBarFill: { height: 6, borderRadius: 999, backgroundColor: "#076B51" },
  productProfitPill: {
    minWidth: 86,
    borderRadius: 16,
    backgroundColor: "#F7FAF8",
    paddingHorizontal: 10,
    paddingVertical: 10,
    alignItems: "flex-end",
  },
  productProfitLabel: { color: "#858585", fontSize: 10, fontFamily: "Outfit-Regular" },
  productProfitValue: { color: "#076B51", fontSize: 13, lineHeight: 18, fontFamily: "Manrope-Bold", marginTop: 2 },
  insightCard: {
    flexDirection: "row",
    gap: 12,
    borderRadius: 18,
    backgroundColor: "#F7FAF8",
    padding: 14,
    marginTop: 12,
  },
  insightDot: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  insightTitle: { color: "#282828", fontSize: 15, fontFamily: "Manrope-Bold" },
  insightBody: { color: "#858585", fontSize: 12, lineHeight: 17, fontFamily: "Outfit-Regular", marginTop: 3 },
  inlineAction: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 10 },
  inlineActionText: { color: "#076B51", fontSize: 13, fontFamily: "Manrope-SemiBold" },
});
