import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  subscriptionService,
  type ActiveSubscription,
  type SubscriptionLimits,
} from "../../services/subscriptionService";

const PLAN_LABELS: Record<string, string> = {
  free: "Free",
  growth: "Growth",
  pro: "Pro",
};

function formatLimit(value: number | null) {
  if (value === null || value >= Number.MAX_SAFE_INTEGER) return "Unlimited";
  return value.toLocaleString("en-US");
}

function statusLabel(subscription: ActiveSubscription | null) {
  return subscription?.status === "active" ? "Active" : "Inactive";
}

export default function SubscriptionPlansScreen() {
  const router = useRouter();
  const [subscription, setSubscription] = useState<ActiveSubscription | null>(null);
  const [limits, setLimits] = useState<SubscriptionLimits | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadPlanStatus = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError("");
    setMessage("");

    try {
      const [current, currentLimits] = await Promise.all([
        subscriptionService.getCurrentSubscription(),
        subscriptionService.getLimits(),
      ]);
      setSubscription(current);
      setLimits(currentLimits);
      if (refresh) setMessage("Plan status refreshed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load plan status.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadPlanStatus();
  }, [loadPlanStatus]);

  const planName = subscription ? PLAN_LABELS[subscription.slug] ?? subscription.planName ?? "Current Plan" : "Free";
  const isActive = subscription?.status === "active";

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.85} style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color="#282828" />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Plan Status</Text>
          <Text style={styles.headerSubtitle}>Current plan and usage limits</Text>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.placeholder}>
            <ActivityIndicator color="#076B51" />
          </View>
        ) : error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : (
          <>
            <View style={styles.statusCard}>
              <View style={styles.statusHeader}>
                <View>
                  <Text style={styles.sectionLabel}>Current plan</Text>
                  <Text style={styles.planName}>{planName}</Text>
                </View>
                <View style={[styles.statusBadge, !isActive && styles.statusBadgeInactive]}>
                  <Text style={[styles.statusBadgeText, !isActive && styles.statusBadgeTextInactive]}>
                    {statusLabel(subscription)}
                  </Text>
                </View>
              </View>
              <Text style={styles.statusBody}>
                Paid plans are purchased and managed on the Eki website using your vendor account email. This app does not process subscription payments.
              </Text>
              <View style={styles.feeBanner}>
                <Text style={styles.feeBannerLabel}>Platform fee per order</Text>
                <Text style={styles.feeBannerValue}>{limits?.platformFeePercent ?? subscription?.platformFeePercent ?? "Unavailable"}</Text>
              </View>
            </View>

            <View style={styles.statusCard}>
              <Text style={styles.sectionTitle}>Website-managed billing</Text>
              <Text style={styles.statusBody}>
                After paying on the website with the same email used for this vendor account, return here and refresh. Your paid plan and features will unlock after Stripe confirms payment.
              </Text>
            </View>

            <View style={styles.statusCard}>
              <Text style={styles.sectionTitle}>Usage limits</Text>
              <LimitRow
                icon="cube-outline"
                label="Products"
                value={
                  limits
                    ? `${limits.currentProducts.toLocaleString("en-US")} / ${formatLimit(limits.maxProducts)}`
                    : "Unavailable"
                }
              />
              <LimitRow
                icon="receipt-outline"
                label="Orders"
                value={
                  limits
                    ? limits.maxOrders === null
                      ? limits.currentOrders.toLocaleString("en-US")
                      : `${limits.currentOrders.toLocaleString("en-US")} / ${formatLimit(limits.maxOrders)}`
                    : "Unavailable"
                }
              />
              <LimitRow
                icon="mail-outline"
                label="Offers"
                value={limits?.canSendOffers ? "Available" : "Not available"}
              />
              <LimitRow
                icon="bar-chart-outline"
                label="Analytics"
                value={limits?.canAccessAnalytics ? "Available" : "Not available"}
              />
            </View>

            {message ? <Text style={styles.messageText}>{message}</Text> : null}
          </>
        )}
      </ScrollView>

      <View style={styles.bottomBar}>
        <TouchableOpacity
          onPress={() => loadPlanStatus(true)}
          activeOpacity={0.85}
          style={[styles.refreshButton, refreshing && { opacity: 0.6 }]}
          disabled={refreshing}
        >
          {refreshing ? <ActivityIndicator color="#FFFFFF" size="small" /> : null}
          <Text style={styles.refreshButtonText}>Refresh plan status</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function LimitRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.limitRow}>
      <View style={styles.limitIcon}>
        <Ionicons name={icon} size={18} color="#076B51" />
      </View>
      <Text style={styles.limitLabel}>{label}</Text>
      <Text style={styles.limitValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9F9F9" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  backButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#F0F0F0", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 20, fontFamily: "Manrope-Bold", color: "#282828" },
  headerSubtitle: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#858585", marginTop: 2 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 100 },
  placeholder: { paddingVertical: 60, alignItems: "center" },
  errorText: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#FB6363", textAlign: "center", paddingVertical: 30 },
  messageText: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#076B51", textAlign: "center", marginTop: 12 },
  statusCard: { backgroundColor: "#FFFFFF", borderRadius: 18, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: "#F0F0F0" },
  statusHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  sectionLabel: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#858585", marginBottom: 4 },
  planName: { fontSize: 28, fontFamily: "Manrope-Bold", color: "#282828" },
  statusBadge: { borderRadius: 999, backgroundColor: "rgba(7,107,81,0.10)", paddingHorizontal: 12, paddingVertical: 6 },
  statusBadgeInactive: { backgroundColor: "rgba(133,133,133,0.12)" },
  statusBadgeText: { fontSize: 12, fontFamily: "Manrope-SemiBold", color: "#076B51" },
  statusBadgeTextInactive: { color: "#858585" },
  statusBody: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#858585", lineHeight: 19, marginTop: 14 },
  feeBanner: {
    marginTop: 16,
    borderRadius: 14,
    backgroundColor: "#EEF8F0",
    borderWidth: 1,
    borderColor: "#D9EDE0",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  feeBannerLabel: { fontSize: 11, fontFamily: "Outfit-Regular", color: "#6A7B72", textTransform: "uppercase", letterSpacing: 0.6 },
  feeBannerValue: { fontSize: 22, fontFamily: "Manrope-Bold", color: "#076B51", marginTop: 4 },
  sectionTitle: { fontSize: 16, fontFamily: "Manrope-Bold", color: "#282828", marginBottom: 12 },
  limitRow: { minHeight: 48, flexDirection: "row", alignItems: "center", borderTopWidth: 1, borderTopColor: "#F0F0F0", gap: 10 },
  limitIcon: { width: 30, height: 30, borderRadius: 10, backgroundColor: "#E8F4ED", alignItems: "center", justifyContent: "center" },
  limitLabel: { flex: 1, fontSize: 14, fontFamily: "Outfit-Regular", color: "#282828" },
  limitValue: { fontSize: 13, fontFamily: "Manrope-SemiBold", color: "#1A1A1A" },
  bottomBar: { paddingHorizontal: 16, paddingVertical: 12 },
  refreshButton: { height: 56, borderRadius: 14, backgroundColor: "#076B51", alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
  refreshButtonText: { fontSize: 16, fontFamily: "Manrope-SemiBold", color: "#FFFFFF" },
});
