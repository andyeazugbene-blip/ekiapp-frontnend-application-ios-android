import React, { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { adminService, type AdminAnalytics } from "../../services/adminService";
import { vendorService } from "../../services/vendorService";
import { type AdminDashboardData } from "../../types/vendor";
import { RevenueChart, type RevenueDataPoint } from "../../components/vendor/RevenueChart";

const CURRENCY_SYMBOL: Record<string, string> = { GBP: "£", USD: "$", EUR: "€" };

export default function AdminDashboardScreen() {
  const router = useRouter();
  const [dashboard, setDashboard] = useState<AdminDashboardData | null>(null);
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);
  const [series, setSeries] = useState<RevenueDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [d, a, s] = await Promise.all([
        vendorService.getAdminDashboard(),
        adminService.getAnalytics(),
        adminService.getRevenueSeries("week"),
      ]);
      setDashboard(d);
      setAnalytics(a);
      setSeries(s);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load dashboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const symbol = CURRENCY_SYMBOL[analytics?.revenue.currency ?? "GBP"] ?? "£";
  const revenue = analytics?.revenue.total ?? dashboard?.totalRevenue ?? 0;
  const change = analytics?.revenue.change ?? 0;
  const avgReviewTime =
    (analytics as any)?.verification?.averageReviewTime ??
    (dashboard as any)?.averageVerificationReviewTime ??
    "—";

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.85} style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color="#282828" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Platform overview</Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {loading && !dashboard ? (
          <View style={styles.placeholder}>
            <ActivityIndicator color="#076B51" />
          </View>
        ) : error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : (
          <>
            <Text style={styles.sectionTitle}>Overview</Text>

            <View style={styles.statsGrid}>
              <StatCard icon="people-outline" label="Total vendors" value={dashboard?.totalVendors ?? 0} sub={`+${dashboard?.newVendorsThisWeek ?? 0} new this week`} />
              <StatCard icon="star-outline" label="Pending approvals" value={dashboard?.pendingApprovals ?? 0} sub="Awaiting activation" />
              <StatCard icon="cart-outline" label="Active orders" value={dashboard?.totalOrders ?? 0} sub={`${dashboard?.activeVendors ?? 0} active vendors`} />
              <StatCard icon="alert-circle-outline" label="Suspended" value={dashboard?.suspendedVendors ?? 0} sub="Blocked accounts" />
            </View>

            <View style={styles.verificationBar}>
              <View style={styles.verificationLeft}>
                <View style={styles.verificationIcon}>
                  <Ionicons name="document-outline" size={18} color="#D97706" />
                </View>
                <View>
                  <Text style={styles.verificationLabel}>Pending verifications</Text>
                  <Text style={styles.verificationValue}>{dashboard?.pendingApprovals ?? 0}</Text>
                </View>
              </View>
              <View style={styles.verificationRight}>
                <Text style={styles.verificationLabel}>Avg review time:</Text>
                <Text style={styles.verificationTime}>{avgReviewTime}</Text>
              </View>
            </View>

            <View style={styles.revenueCard}>
              <View style={styles.revenueTop}>
                <View style={styles.revenueIcon}>
                  <Ionicons name="trending-up-outline" size={18} color="#FFFFFF" />
                </View>
                <Text style={styles.revenueLabel}>Revenue snapshot</Text>
              </View>
              <Text style={styles.revenueValue}>{symbol}{revenue.toLocaleString()}</Text>
              <View style={styles.revenueBadge}>
                <Text style={styles.revenueBadgeText}>{change >= 0 ? "+" : ""}{change}% this month</Text>
              </View>
              {series.length > 0 ? (
                <View style={styles.chartWrap}>
                  <RevenueChart data={series} currencySymbol={symbol} trendPercent={change} />
                </View>
              ) : null}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({ icon, label, value, sub }: { icon: any; label: string; value: number; sub: string }) {
  return (
    <View style={styles.statCard}>
      <View style={styles.statIcon}>
        <Ionicons name={icon} size={22} color="#076B51" />
      </View>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statChange}>{sub}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9F9F9" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, gap: 12 },
  backButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#F0F0F0", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 22, fontWeight: "700", color: "#282828" },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 100 },
  placeholder: { paddingVertical: 60, alignItems: "center" },
  errorText: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#FB6363", textAlign: "center", paddingVertical: 30 },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: "#282828", marginBottom: 14 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 16 },
  statCard: { width: "47%", backgroundColor: "#FFFFFF", borderRadius: 18, padding: 16, borderWidth: 1, borderColor: "#F0F0F0" },
  statIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: "rgba(7,107,81,0.08)", alignItems: "center", justifyContent: "center", marginBottom: 12 },
  statLabel: { fontSize: 12, fontWeight: "400", color: "#858585" },
  statValue: { fontSize: 26, fontWeight: "700", color: "#282828", marginTop: 4 },
  statChange: { fontSize: 12, fontWeight: "500", color: "#076B51", marginTop: 4 },
  verificationBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#FFF8E8", borderRadius: 16, padding: 16, marginBottom: 16 },
  verificationLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  verificationIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: "rgba(217,119,6,0.1)", alignItems: "center", justifyContent: "center" },
  verificationLabel: { fontSize: 12, fontWeight: "400", color: "#858585" },
  verificationValue: { fontSize: 22, fontWeight: "700", color: "#D97706", marginTop: 2 },
  verificationRight: { alignItems: "flex-end" },
  verificationTime: { fontSize: 16, fontWeight: "700", color: "#D97706", marginTop: 2 },
  revenueCard: { backgroundColor: "#1A1A1A", borderRadius: 22, padding: 20, marginBottom: 16 },
  revenueTop: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  revenueIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" },
  revenueLabel: { fontSize: 13, fontWeight: "400", color: "rgba(255,255,255,0.6)" },
  revenueValue: { fontSize: 28, fontWeight: "700", color: "#FFFFFF", marginTop: 4 },
  revenueBadge: { backgroundColor: "rgba(7,107,81,0.3)", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 4, alignSelf: "flex-start", marginTop: 8 },
  revenueBadgeText: { fontSize: 12, fontWeight: "500", color: "#4DB89A" },
  chartWrap: { marginTop: 18, backgroundColor: "#FFFFFF", borderRadius: 16, padding: 16 },
});
