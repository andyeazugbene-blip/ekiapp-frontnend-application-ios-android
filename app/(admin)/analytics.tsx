import React, { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { RevenueChart, type RevenueDataPoint } from "../../components/vendor/RevenueChart";
import { adminService, type AdminAnalytics } from "../../services/adminService";

function getCurrencyPrefix(currency?: string) {
  switch ((currency ?? "GBP").toUpperCase()) {
    case "USD":
      return "$";
    case "EUR":
      return "EUR ";
    case "NGN":
      return "NGN ";
    case "GHS":
      return "GHS ";
    case "KES":
      return "KSh ";
    default:
      return "GBP ";
  }
}

export default function AnalyticsScreen() {
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);
  const [series, setSeries] = useState<RevenueDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      setError("");

      Promise.all([
        adminService.getAnalytics(),
        adminService.getRevenueSeries("month"),
      ])
        .then(([nextAnalytics, nextSeries]) => {
          if (cancelled) return;
          setAnalytics(nextAnalytics);
          setSeries(nextSeries);
        })
        .catch((err) => {
          if (!cancelled) setError(err instanceof Error ? err.message : "Could not load analytics.");
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });

      return () => {
        cancelled = true;
      };
    }, [])
  );

  const currencyPrefix = getCurrencyPrefix(analytics?.revenue.currency);
  const metrics = analytics ? [
    {
      label: "Total Revenue",
      value: `${currencyPrefix}${analytics.revenue.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      up: analytics.revenue.change >= 0,
    },
    {
      label: "Total Orders",
      value: analytics.orders.total.toLocaleString(),
      up: analytics.orders.change >= 0,
    },
    {
      label: "Active Vendors",
      value: String(analytics.vendors.active),
      up: true,
    },
    {
      label: "New Vendors",
      value: String(analytics.vendors.new),
      up: analytics.vendors.new >= 0,
    },
    {
      label: "Active Buyers",
      value: String(analytics.buyers.active),
      up: true,
    },
    {
      label: "New Buyers",
      value: String(analytics.buyers.new),
      up: analytics.buyers.new >= 0,
    },
  ] : [];

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Marketplace Analytics</Text>
        <Text style={styles.headerSubtitle}>Platform performance overview</Text>
      </View>

      {loading ? (
        <View style={styles.loadingPage}>
          <ActivityIndicator color="#076B51" />
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={styles.metricsGrid}>
            {metrics.map((metric) => (
              <View key={metric.label} style={styles.metricCard}>
                <Text style={styles.metricLabel}>{metric.label}</Text>
                <Text style={styles.metricValue}>{metric.value}</Text>
                <View style={styles.changeRow}>
                  <Ionicons
                    name={metric.up ? "trending-up" : "trending-down"}
                    size={14}
                    color={metric.up ? "#076B51" : "#FB6363"}
                  />
                </View>
              </View>
            ))}
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Revenue Trend</Text>
            {series.length > 0 ? (
              <RevenueChart
                data={series}
                currencySymbol={currencyPrefix}
                trendPercent={analytics?.revenue.change ?? 0}
              />
            ) : (
              <View style={styles.chartPlaceholder}>
                <Ionicons name="bar-chart-outline" size={40} color="#858585" />
                <Text style={styles.chartText}>No revenue trend returned by the backend yet.</Text>
              </View>
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Top Vendors</Text>
            {analytics?.topVendors?.length ? (
              analytics.topVendors.slice(0, 5).map((vendor, index) => (
                <View key={vendor.id} style={[styles.vendorItem, index < analytics.topVendors.length - 1 && styles.vendorBorder]}>
                  <View style={styles.vendorRank}>
                    <Text style={styles.vendorRankText}>{index + 1}</Text>
                  </View>
                  <View style={styles.vendorInfo}>
                    <Text style={styles.vendorName}>{vendor.name || "Vendor"}</Text>
                    <Text style={styles.vendorOrders}>{vendor.orders} orders</Text>
                  </View>
                  <Text style={styles.vendorRevenue}>
                    {currencyPrefix}{vendor.revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Text>
                </View>
              ))
            ) : (
              <Text style={styles.emptyCopy}>No top vendor analytics were returned by the backend.</Text>
            )}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F4F4F4" },
  header: { backgroundColor: "#076B51", paddingHorizontal: 20, paddingTop: 16, paddingBottom: 30, borderBottomLeftRadius: 35, borderBottomRightRadius: 35, gap: 6 },
  headerTitle: { fontSize: 30, fontFamily: "Manrope-Bold", lineHeight: 30, color: "#FFFFFF" },
  headerSubtitle: { fontSize: 16, fontFamily: "Outfit-Light", color: "#FFFFFF" },
  loadingPage: { flex: 1, alignItems: "center", justifyContent: "center" },
  scrollContent: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 40 },
  errorText: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#FB6363", textAlign: "center", marginBottom: 16 },
  metricsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 16 },
  metricCard: { width: "47%", backgroundColor: "#FFFFFF", borderRadius: 20, padding: 16 },
  metricLabel: { fontSize: 12, fontWeight: "400", color: "#858585" },
  metricValue: { fontSize: 20, fontFamily: "Manrope-Bold", color: "#282828", marginTop: 6 },
  changeRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 },
  card: { backgroundColor: "#FFFFFF", borderRadius: 30, padding: 20, marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontFamily: "Manrope-Bold", color: "#282828", marginBottom: 16 },
  chartPlaceholder: { height: 160, borderRadius: 16, backgroundColor: "#F4F4F4", alignItems: "center", justifyContent: "center", gap: 8 },
  chartText: { fontSize: 14, fontWeight: "400", color: "#858585", textAlign: "center" },
  emptyCopy: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#858585" },
  vendorItem: { flexDirection: "row", alignItems: "center", paddingVertical: 14 },
  vendorBorder: { borderBottomWidth: 1, borderBottomColor: "#F4F4F4" },
  vendorRank: { width: 28, height: 28, borderRadius: 14, backgroundColor: "rgba(7,107,81,0.1)", alignItems: "center", justifyContent: "center", marginRight: 12 },
  vendorRankText: { fontSize: 14, fontWeight: "700", color: "#076B51" },
  vendorInfo: { flex: 1 },
  vendorName: { fontSize: 14, fontWeight: "700", color: "#282828" },
  vendorOrders: { fontSize: 12, fontWeight: "400", color: "#858585", marginTop: 2 },
  vendorRevenue: { fontSize: 16, fontWeight: "700", color: "#076B51" },
});
