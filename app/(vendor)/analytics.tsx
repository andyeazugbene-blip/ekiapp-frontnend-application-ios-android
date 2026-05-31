import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "../../stores/authStore";
import { publicStoreService, type PublicStoreAnalyticsDetail } from "../../services/publicStoreService";
import { toCompactStoreSlug } from "../../utils/shareLinks";

function emptyAnalytics(storeSlug: string): PublicStoreAnalyticsDetail {
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

function formatCurrency(value: number): string {
  return `GBP ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function VendorAnalyticsScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const vendor = user?.role === "vendor" ? user : null;
  const storeSlug = toCompactStoreSlug(vendor?.storeSlug ?? vendor?.storeName);

  const [analytics, setAnalytics] = useState<PublicStoreAnalyticsDetail>(emptyAnalytics(storeSlug));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useFocusEffect(
    useCallback(() => {
      let active = true;
      if (!storeSlug) {
        setAnalytics(emptyAnalytics(""));
        setLoading(false);
        return () => {
          active = false;
        };
      }

      setLoading(true);
      setError("");
      publicStoreService
        .getDetailedAnalytics(storeSlug)
        .then((result) => {
          if (active) setAnalytics(result);
        })
        .catch((err) => {
          if (active) setError(err instanceof Error ? err.message : "Could not load store analytics.");
        })
        .finally(() => {
          if (active) setLoading(false);
        });

      return () => {
        active = false;
      };
    }, [storeSlug]),
  );

  const performanceRows = useMemo(
    () => [
      ...analytics.sourcePerformance.map((item) => ({
        label: `${item.label} clicks`,
        value: item.clicks,
        tint: item.source === "instagram" ? "#EC4899" : item.source === "whatsapp" ? "#16A34A" : "#0A6C52",
      })),
      { label: "Checkout started", value: analytics.checkoutStarts, tint: "#0A6C52" },
      { label: "Orders completed", value: analytics.completedOrders, tint: "#15803D" },
      { label: "Track order requests", value: analytics.trackRequests, tint: "#D97706" },
      { label: "Saved vendor count", value: analytics.saveVendorCount, tint: "#B45309" },
      { label: "App opens from web", value: analytics.appLaunches, tint: "#7C3AED" },
    ],
    [analytics],
  );

  const maxPerformanceValue = Math.max(1, ...performanceRows.map((row) => row.value));

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.85} style={styles.backButton}>
          <Ionicons name="arrow-back" size={18} color="#202124" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Analytics</Text>
        <View style={styles.periodPill}>
          <Text style={styles.periodPillText}>This month</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingPage}>
          <ActivityIndicator color="#076B51" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={styles.heroCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroLabel}>Total Revenue</Text>
              <Text style={styles.heroValue}>{formatCurrency(analytics.totalRevenue)}</Text>
              <View style={styles.heroBadge}>
                <Ionicons name="arrow-up-outline" size={12} color="#C7F9D8" />
                <Text style={styles.heroBadgeText}>{Math.round(analytics.conversionRate)}% conversion from store visits</Text>
              </View>
            </View>

            <View style={styles.pendingCard}>
              <Text style={styles.pendingLabel}>Pending</Text>
              <Text style={styles.pendingValue}>{formatCurrency(analytics.pendingRevenue)}</Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Link performance this month</Text>
            {performanceRows.map((row) => (
              <View key={row.label} style={styles.performanceRow}>
                <Text style={[styles.performanceLabel, row.label === "Saved vendor count" && { color: "#9A3412" }]}>
                  {row.label}
                </Text>
                <View style={styles.performanceBarTrack}>
                  <View
                    style={[
                      styles.performanceBarFill,
                      {
                        width: `${Math.max(8, (row.value / maxPerformanceValue) * 100)}%`,
                        backgroundColor: row.tint,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.performanceValue}>{row.value}</Text>
              </View>
            ))}

            <View style={styles.insightNote}>
              <Text style={styles.insightNoteText}>
                {analytics.weeklyOrders} orders came from your public store in the last 7 days.
              </Text>
            </View>

            <View style={styles.sourceCard}>
              {analytics.sourcePerformance.map((item) => (
                <View key={item.source} style={styles.sourceMetric}>
                  <Text style={styles.sourceMetricLabel}>{item.label}</Text>
                  <Text style={styles.sourceMetricValue}>{item.clicks}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Top products</Text>
            {analytics.topProducts.length === 0 ? (
              <Text style={styles.emptyText}>No public-store product activity yet.</Text>
            ) : (
              analytics.topProducts.map((product) => (
                <View key={product.productId} style={styles.productRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.productName}>{product.name}</Text>
                    <Text style={styles.productMeta}>{product.unitsSold} sold</Text>
                  </View>
                  <View style={styles.productBarTrack}>
                    <View
                      style={[
                        styles.productBarFill,
                        {
                          width: `${Math.max(
                            12,
                            (product.unitsSold / Math.max(1, analytics.topProducts[0]?.unitsSold ?? 1)) * 100,
                          )}%`,
                        },
                      ]}
                    />
                  </View>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F7F8F7" },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E7ECEA",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { flex: 1, color: "#202124", fontSize: 22, fontFamily: "Manrope-Bold" },
  periodPill: {
    minWidth: 88,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#EFF8F3",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  periodPillText: { color: "#6B7280", fontSize: 12, fontFamily: "Outfit-Medium" },
  loadingPage: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { paddingHorizontal: 16, paddingBottom: 26 },
  errorText: { color: "#DC2626", fontSize: 13, fontFamily: "Outfit-Regular", marginBottom: 12, textAlign: "center" },
  heroCard: {
    borderRadius: 20,
    backgroundColor: "#14614A",
    padding: 16,
    flexDirection: "row",
    gap: 12,
    marginBottom: 14,
  },
  heroLabel: { color: "#D7EEE5", fontSize: 12, fontFamily: "Outfit-Regular" },
  heroValue: { color: "#FFFFFF", fontSize: 30, lineHeight: 36, fontFamily: "Manrope-ExtraBold", marginTop: 4 },
  heroBadge: {
    marginTop: 10,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  heroBadgeText: { color: "#DBFCE7", fontSize: 11, fontFamily: "Outfit-Medium" },
  pendingCard: {
    width: 118,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.12)",
    padding: 14,
    justifyContent: "center",
  },
  pendingLabel: { color: "#D7EEE5", fontSize: 12, fontFamily: "Outfit-Regular" },
  pendingValue: { color: "#FFFFFF", fontSize: 18, lineHeight: 22, fontFamily: "Manrope-Bold", marginTop: 8 },
  card: {
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E7ECEA",
    padding: 16,
    marginBottom: 14,
  },
  sectionTitle: { color: "#202124", fontSize: 15, fontFamily: "Manrope-Bold", marginBottom: 14 },
  performanceRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  performanceLabel: { width: 112, color: "#48505A", fontSize: 12, lineHeight: 16, fontFamily: "Outfit-Regular" },
  performanceBarTrack: { flex: 1, height: 5, borderRadius: 999, backgroundColor: "#EAEDEC", overflow: "hidden" },
  performanceBarFill: { height: 5, borderRadius: 999 },
  performanceValue: { width: 28, textAlign: "right", color: "#202124", fontSize: 12, fontFamily: "Manrope-Bold" },
  insightNote: {
    marginTop: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#F4C99A",
    backgroundColor: "#FFF6E9",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  insightNoteText: { color: "#A05412", fontSize: 12, lineHeight: 18, fontFamily: "Outfit-Medium" },
  sourceCard: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#EEF1EF",
  },
  sourceMetric: {
    minWidth: "30%",
    borderRadius: 12,
    backgroundColor: "#F8FAF9",
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  sourceMetricLabel: { color: "#6B7280", fontSize: 11, fontFamily: "Outfit-Regular" },
  sourceMetricValue: { color: "#202124", fontSize: 16, fontFamily: "Manrope-Bold", marginTop: 4 },
  emptyText: { color: "#6B7280", fontSize: 13, fontFamily: "Outfit-Regular" },
  productRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  productName: { color: "#202124", fontSize: 14, fontFamily: "Outfit-Medium" },
  productMeta: { color: "#6B7280", fontSize: 11, fontFamily: "Outfit-Regular", marginTop: 4 },
  productBarTrack: { width: 90, height: 5, borderRadius: 999, backgroundColor: "#EAEDEC", overflow: "hidden" },
  productBarFill: { height: 5, borderRadius: 999, backgroundColor: "#1F7A5B" },
});
