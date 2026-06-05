import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { adminService, type AdminAnalytics } from "../../services/adminService";
import { vendorService } from "../../services/vendorService";
import { type AdminDashboardData } from "../../types/vendor";
import { RevenueChart, type RevenueDataPoint } from "../../components/vendor/RevenueChart";
import { useAuthStore } from "../../stores/authStore";

const CURRENCY_SYMBOL: Record<string, string> = { GBP: "GBP ", USD: "$", EUR: "EUR " };
const SCREEN_WIDTH = Dimensions.get("window").width;
const CARD_GAP = 14;
const HORIZONTAL_PADDING = 18;
const CARD_WIDTH = (SCREEN_WIDTH - HORIZONTAL_PADDING * 2 - CARD_GAP) / 2;

export default function AdminDashboardScreen() {
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);
  const [dashboard, setDashboard] = useState<AdminDashboardData | null>(null);
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);
  const [series, setSeries] = useState<RevenueDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [signingOut, setSigningOut] = useState(false);

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
    }, [load]),
  );

  const symbol = CURRENCY_SYMBOL[analytics?.revenue.currency ?? "GBP"] ?? "GBP ";
  const revenue = analytics?.revenue.total ?? dashboard?.totalRevenue ?? 0;
  const change = analytics?.revenue.change ?? 0;
  const avgReviewTime =
    (analytics as any)?.verification?.averageReviewTime ??
    (dashboard as any)?.averageVerificationReviewTime ??
    "2 hours";

  const handleLogout = () => {
    Alert.alert("Sign out", "Do you want to sign out of the admin panel?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: async () => {
          setSigningOut(true);
          try {
            await logout();
            router.replace("/(auth)/role-select");
          } finally {
            setSigningOut(false);
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.headerTextWrap}>
            <Text style={styles.headerEyebrow}>Eki Admin</Text>
            <Text style={styles.headerTitle}>Platform overview</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={() => router.push("/(admin)/settings" as any)}
              activeOpacity={0.85}
              style={styles.actionButton}
            >
              <Ionicons name="settings-outline" size={20} color="#076B51" />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleLogout} activeOpacity={0.85} style={styles.actionButton}>
              {signingOut ? <ActivityIndicator size="small" color="#FB6363" /> : <Ionicons name="log-out-outline" size={20} color="#FB6363" />}
            </TouchableOpacity>
          </View>
        </View>
        <Text style={styles.headerSubcopy}>Overview of vendors, orders, disputes, and revenue.</Text>
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
              <StatCard
                icon="people-outline"
                label="Total vendors"
                value={dashboard?.totalVendors ?? 0}
                sub={`+${dashboard?.newVendorsThisWeek ?? 0} new this week`}
              />
              <StatCard
                icon="person-add-outline"
                label="New vendors"
                value={dashboard?.newVendorsThisWeek ?? 0}
                sub="Awaiting activation"
              />
              <StatCard
                icon="cart-outline"
                label="Active orders"
                value={dashboard?.totalOrders ?? 0}
                sub={`${(dashboard as any)?.pendingOrders ?? 0} require vendor action`}
              />
              <StatCard
                icon="scale-outline"
                label="Disputes"
                value={(dashboard as any)?.openDisputes ?? 0}
                sub={`${(dashboard as any)?.openDisputes ?? 0} unresolved`}
              />
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
              <View style={styles.revenueLeft}>
                <View style={styles.revenueTop}>
                  <View style={styles.revenueIcon}>
                    <Ionicons name="analytics-outline" size={22} color="#FFFFFF" />
                  </View>
                  <Text style={styles.revenueLabel}>Revenue snapshot</Text>
                </View>
                <Text style={styles.revenueValue}>
                  {symbol}
                  {revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
                <View style={styles.revenueBadge}>
                  <Text style={styles.revenueBadgeText}>
                    {change >= 0 ? "+" : ""}
                    {change}% this month
                  </Text>
                </View>
              </View>
              {series.length > 0 ? (
                <View style={styles.chartWrap}>
                  <RevenueChart data={series} currencySymbol={symbol} trendPercent={change} />
                </View>
              ) : (
                <Ionicons name="trending-up-outline" size={80} color="rgba(255,255,255,0.18)" />
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({ icon, label, value, sub }: { icon: React.ComponentProps<typeof Ionicons>["name"]; label: string; value: number; sub: string }) {
  return (
    <View style={styles.statCard}>
      <View style={styles.statIcon}>
        <Ionicons name={icon} size={22} color="#076B51" />
      </View>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value.toLocaleString()}</Text>
      <Text style={styles.statChange}>{sub}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F4F4F4" },
  header: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 18 },
  headerTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 16 },
  headerTextWrap: { flex: 1 },
  headerEyebrow: { fontSize: 12, lineHeight: 16, fontFamily: "Manrope-Bold", color: "#076B51", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 8 },
  headerTitle: { fontSize: 30, lineHeight: 36, fontFamily: "Manrope-ExtraBold", color: "#282828" },
  headerSubcopy: { marginTop: 8, fontSize: 14, lineHeight: 20, fontFamily: "Outfit-Regular", color: "#6E7774" },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 10 },
  actionButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  scrollContent: { paddingHorizontal: 18, paddingBottom: 118 },
  placeholder: { paddingVertical: 80, alignItems: "center" },
  errorText: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#FB6363", textAlign: "center", paddingVertical: 30 },
  sectionTitle: { fontSize: 22, fontFamily: "Manrope-ExtraBold", color: "#282828", marginBottom: 18 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", columnGap: CARD_GAP, rowGap: CARD_GAP, marginBottom: 26 },
  statCard: { width: CARD_WIDTH, minHeight: 156, backgroundColor: "#FFFFFF", borderRadius: 26, padding: 18, borderWidth: 1, borderColor: "#F0F1F0" },
  statIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#E4F0EC",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  statLabel: { fontSize: 16, fontFamily: "Outfit-Regular", color: "#858585" },
  statValue: { fontSize: 28, fontFamily: "Manrope-ExtraBold", color: "#282828", marginTop: 6 },
  statChange: { fontSize: 14, fontFamily: "Manrope-SemiBold", color: "#076B51", marginTop: 6 },
  verificationBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#F8F0DC",
    borderRadius: 26,
    padding: 18,
    marginBottom: 26,
  },
  verificationLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  verificationIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: "#F8E6B9", alignItems: "center", justifyContent: "center" },
  verificationLabel: { fontSize: 15, fontFamily: "Outfit-Medium", color: "#767676" },
  verificationValue: { fontSize: 24, fontFamily: "Manrope-ExtraBold", color: "#B87900", marginTop: 2 },
  verificationRight: { alignItems: "flex-end", flex: 1 },
  verificationTime: { fontSize: 22, fontFamily: "Manrope-ExtraBold", color: "#B87900", marginTop: 4 },
  revenueCard: {
    minHeight: 214,
    backgroundColor: "#242424",
    borderRadius: 30,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
  },
  revenueLeft: { flex: 1, zIndex: 1 },
  revenueTop: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  revenueIcon: { width: 54, height: 54, borderRadius: 27, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" },
  revenueLabel: { fontSize: 17, fontFamily: "Outfit-Medium", color: "rgba(255,255,255,0.62)" },
  revenueValue: { fontSize: 31, fontFamily: "Manrope-ExtraBold", color: "#FFFFFF", marginTop: 2 },
  revenueBadge: { backgroundColor: "rgba(31,120,89,0.52)", borderRadius: 16, paddingHorizontal: 18, paddingVertical: 10, alignSelf: "flex-start", marginTop: 20 },
  revenueBadgeText: { fontSize: 14, fontFamily: "Manrope-Bold", color: "#FFFFFF" },
  chartWrap: { width: 160, height: 128, overflow: "hidden", opacity: 0.92 },
});
