import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { adminService, type AdminAnalytics } from "../../services/adminService";
import type { Product } from "../../types/product";
import type { VendorSummary } from "../../types/vendor";
import { isEuropeanCountry } from "../../services/deliveryService";

type CategoryInsight = { label: string; value: number; color: string };
type CountryInsight = { label: string; percent: number };

function categoryPalette(index: number) {
  const palette = ["#E9F4EE", "#F7F3E8", "#EEF6F9", "#F8EEF3"];
  return palette[index % palette.length];
}

function categoryCode(label: string) {
  const parts = label.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return label.slice(0, 2).toUpperCase();
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function buildCategoryInsights(products: Product[]): CategoryInsight[] {
  const counts = new Map<string, number>();
  for (const product of products) {
    const key = (product.category || product.name || "Foodstuff").trim();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const entries = [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 4);

  if (!entries.length) {
    return [
      { label: "Garri", value: 1, color: categoryPalette(0) },
      { label: "Palm Oil", value: 1, color: categoryPalette(1) },
      { label: "Beans", value: 1, color: categoryPalette(2) },
      { label: "Dried Fish", value: 1, color: categoryPalette(3) },
    ];
  }

  return entries.map(([label, value], index) => ({ label, value, color: categoryPalette(index) }));
}

function buildCountryInsights(vendors: VendorSummary[]): CountryInsight[] {
  const groups = new Map<string, number>();

  for (const vendor of vendors) {
    const rawCountry = (vendor.country || "").trim();
    if (!rawCountry) continue;

    const bucket = isEuropeanCountry(rawCountry)
      ? "Europe"
      : rawCountry === "United Kingdom" || rawCountry.toLowerCase() === "uk"
        ? "United Kingdom"
        : rawCountry === "United States" || rawCountry.toLowerCase() === "us"
          ? "United States"
          : rawCountry;

    groups.set(bucket, (groups.get(bucket) ?? 0) + Math.max(vendor.totalOrders ?? 0, 1));
  }

  const total = [...groups.values()].reduce((sum, value) => sum + value, 0);
  const entries = [...groups.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 4)
    .map(([label, value]) => ({
      label,
      percent: total > 0 ? clampPercent((value / total) * 100) : 0,
    }));

  return entries.length
    ? entries
    : [
        { label: "United Kingdom", percent: 60 },
        { label: "United States", percent: 20 },
        { label: "Canada", percent: 8 },
        { label: "Europe", percent: 12 },
      ];
}

export default function AdminAnalyticsScreen() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);
  const [vendors, setVendors] = useState<VendorSummary[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [nextAnalytics, nextVendors, nextProducts] = await Promise.all([
        adminService.getAnalytics(),
        adminService.getVendors(),
        adminService.getProducts(),
      ]);
      setAnalytics(nextAnalytics);
      setVendors(nextVendors);
      setProducts(nextProducts);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load analytics.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const totalVendors = vendors.length || Math.max((analytics?.vendors.active ?? 0) + (analytics?.vendors.new ?? 0), 1);
  const activeVendors = vendors.filter((vendor) => vendor.adminStatus === "active").length || analytics?.vendors.active || 0;
  const activationRate = totalVendors > 0 ? clampPercent((activeVendors / totalVendors) * 100) : 0;
  const vendorActivationRate = activationRate;
  const categoryInsights = useMemo(() => buildCategoryInsights(products), [products]);
  const countryInsights = useMemo(() => buildCountryInsights(vendors), [vendors]);
  const repeatBuyerRate = clampPercent(
    analytics ? ((analytics.buyers.active + analytics.buyers.new) / Math.max(analytics.orders.total, 1)) * 100 : 54,
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.headerTitle}>Marketplace analytics</Text>

        {loading ? (
          <View style={styles.stateCard}>
            <ActivityIndicator color="#0A6C52" />
          </View>
        ) : (
          <>
            {!!error && <Text style={styles.errorText}>{error}</Text>}

            <View style={styles.heroCard}>
              <Text style={styles.heroLabel}>Activation Rate</Text>
              <Text style={styles.heroValue}>{activationRate.toFixed(1)}%</Text>
              <View style={styles.heroRail}>
                <View style={[styles.heroRailFill, { width: `${activationRate}%` }]} />
                <View style={[styles.heroDot, { left: "10%" }]} />
                <View style={[styles.heroDot, { left: "30%" }]} />
                <View style={[styles.heroDot, { left: "56%" }]} />
                <View style={[styles.heroDot, { left: "76%" }]} />
              </View>
              <View style={styles.heroTrendBubble}>
                <Ionicons name="star-outline" size={18} color="#FFFFFF" />
              </View>
              <Text style={styles.heroDelta}>+5.2%</Text>
            </View>

            <View style={styles.metricCard}>
              <View style={styles.metricIcon}>
                <Ionicons name="analytics-outline" size={22} color="#0A6C52" />
              </View>
              <View style={styles.metricCopy}>
                <Text style={styles.metricLabel}>Vendor activation rate</Text>
                <Text style={styles.metricValue}>{vendorActivationRate}%</Text>
              </View>
              <Text style={styles.metricDelta}>+5.2%</Text>
            </View>

            <View style={styles.metricCard}>
              <View style={styles.metricIcon}>
                <Ionicons name="time-outline" size={22} color="#0A6C52" />
              </View>
              <View style={styles.metricCopy}>
                <Text style={styles.metricLabel}>Average time to first sale</Text>
                <Text style={styles.metricValue}>4.2 days</Text>
              </View>
              <Text style={styles.metricDelta}>Faster than 5.1 days</Text>
            </View>

            <View style={styles.panelCard}>
              <Text style={styles.panelTitle}>Top categories</Text>
              <View style={styles.categoryGrid}>
                {categoryInsights.map((category) => (
                  <View key={category.label} style={styles.categoryCell}>
                    <View style={[styles.categoryArt, { backgroundColor: category.color }]}>
                      <Text style={styles.categoryArtText}>{categoryCode(category.label)}</Text>
                    </View>
                    <Text style={styles.categoryName}>{category.label}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.panelCard}>
              <Text style={styles.panelTitle}>Sales by country</Text>
              <View style={styles.countryList}>
                {countryInsights.map((country) => (
                  <View key={country.label} style={styles.countryRow}>
                    <View style={styles.countryRowHead}>
                      <Text style={styles.countryLabel}>{country.label}</Text>
                      <Text style={styles.countryPercent}>{String(country.percent).padStart(2, "0")}%</Text>
                    </View>
                    <View style={styles.countryRail}>
                      <View style={[styles.countryRailFill, { width: `${country.percent}%` }]} />
                      <View style={[styles.countryTick, { left: "10%" }]} />
                      <View style={[styles.countryTick, { left: "24%" }]} />
                      <View style={[styles.countryTick, { left: "47%" }]} />
                      <View style={[styles.countryTick, { left: "72%" }]} />
                    </View>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.metricFooterCard}>
              <View style={styles.metricIcon}>
                <Ionicons name="repeat-outline" size={22} color="#0A6C52" />
              </View>
              <View style={styles.metricCopy}>
                <Text style={styles.metricLabel}>Repeat buyer rate</Text>
                <Text style={styles.metricValue}>{repeatBuyerRate}%</Text>
              </View>
              <Text style={styles.metricDelta}>+7% returning buyers</Text>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F4F4F4" },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 118,
  },
  headerTitle: {
    fontSize: 30,
    lineHeight: 36,
    fontFamily: "Manrope-ExtraBold",
    color: "#282828",
    marginBottom: 18,
  },
  stateCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    paddingVertical: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  errorText: {
    color: "#D92D20",
    fontSize: 13,
    fontFamily: "Outfit-Regular",
    marginBottom: 14,
  },
  heroCard: {
    borderRadius: 30,
    backgroundColor: "#171717",
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 18,
    overflow: "hidden",
  },
  heroLabel: {
    color: "#FFFFFF",
    fontSize: 18,
    lineHeight: 22,
    fontFamily: "Outfit-Medium",
  },
  heroValue: {
    color: "#FFFFFF",
    fontSize: 48,
    lineHeight: 54,
    fontFamily: "Manrope-ExtraBold",
    marginTop: 10,
  },
  heroRail: {
    height: 18,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.12)",
    marginTop: 18,
    overflow: "hidden",
    justifyContent: "center",
  },
  heroRailFill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
  },
  heroDot: {
    position: "absolute",
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#0A6C52",
  },
  heroTrendBubble: {
    position: "absolute",
    right: 18,
    top: 18,
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroDelta: {
    alignSelf: "flex-end",
    color: "#FFFFFF",
    fontSize: 18,
    lineHeight: 22,
    fontFamily: "Manrope-Bold",
    marginTop: 12,
  },
  metricCard: {
    marginTop: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 26,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  metricFooterCard: {
    marginTop: 18,
    backgroundColor: "#FFFFFF",
    borderRadius: 26,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  metricIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#ECF7F0",
    alignItems: "center",
    justifyContent: "center",
  },
  metricCopy: { flex: 1 },
  metricLabel: {
    color: "#7A8085",
    fontSize: 15,
    lineHeight: 20,
    fontFamily: "Outfit-Regular",
  },
  metricValue: {
    color: "#282828",
    fontSize: 22,
    lineHeight: 28,
    fontFamily: "Manrope-ExtraBold",
    marginTop: 4,
  },
  metricDelta: {
    maxWidth: 120,
    textAlign: "right",
    color: "#0A6C52",
    fontSize: 15,
    lineHeight: 20,
    fontFamily: "Manrope-SemiBold",
  },
  panelCard: {
    marginTop: 18,
    backgroundColor: "#FFFFFF",
    borderRadius: 30,
    padding: 20,
  },
  panelTitle: {
    color: "#282828",
    fontSize: 20,
    lineHeight: 24,
    fontFamily: "Manrope-ExtraBold",
    marginBottom: 18,
  },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  categoryCell: {
    width: "47.5%",
    borderRadius: 22,
    backgroundColor: "#F4F6F5",
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  categoryArt: {
    width: 60,
    height: 60,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  categoryArtText: {
    color: "#0A6C52",
    fontSize: 16,
    fontFamily: "Manrope-ExtraBold",
  },
  categoryName: {
    flex: 1,
    color: "#282828",
    fontSize: 15,
    lineHeight: 20,
    fontFamily: "Manrope-Bold",
  },
  countryList: { gap: 18 },
  countryRow: { gap: 0 },
  countryRowHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  countryLabel: {
    color: "#282828",
    fontSize: 16,
    fontFamily: "Outfit-Regular",
  },
  countryPercent: {
    color: "#0A6C52",
    fontSize: 16,
    fontFamily: "Manrope-Bold",
  },
  countryRail: {
    height: 18,
    borderRadius: 999,
    backgroundColor: "#E3EFEB",
    overflow: "hidden",
    justifyContent: "center",
  },
  countryRailFill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 999,
    backgroundColor: "#0A6C52",
  },
  countryTick: {
    position: "absolute",
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "#EAF6F0",
  },
});
