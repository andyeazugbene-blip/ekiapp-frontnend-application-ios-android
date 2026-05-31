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

type PlanSlug = ActiveSubscription["slug"];

const PLAN_LABELS: Record<PlanSlug, string> = {
  free: "Free",
  growth: "Growth",
  pro: "Pro",
};

function formatLimit(value: number | null) {
  if (value === null || value >= Number.MAX_SAFE_INTEGER) return "Unlimited";
  return value.toLocaleString("en-US");
}

export function ReadOnlyPlanStatus({ targetSlug }: { targetSlug: PlanSlug }) {
  const router = useRouter();
  const [subscription, setSubscription] = useState<ActiveSubscription | null>(null);
  const [limits, setLimits] = useState<SubscriptionLimits | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError("");

    try {
      const [current, currentLimits] = await Promise.all([
        subscriptionService.getCurrentSubscription(),
        subscriptionService.getLimits(),
      ]);
      setSubscription(current);
      setLimits(currentLimits);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load plan status.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const targetLabel = PLAN_LABELS[targetSlug];
  const currentLabel = subscription ? PLAN_LABELS[subscription.slug] : "Free";
  const targetActive = subscription?.slug === targetSlug && subscription.status === "active";

  if (loading) return <View style={styles.loader}><ActivityIndicator color="#076B51" /></View>;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.85} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{targetLabel} Plan</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View>
              <Text style={styles.label}>Selected plan</Text>
              <Text style={styles.planName}>{targetLabel}</Text>
            </View>
            <View style={[styles.statusBadge, !targetActive && styles.statusBadgeInactive]}>
              <Text style={[styles.statusText, !targetActive && styles.statusTextInactive]}>
                {targetActive ? "Active" : "Inactive"}
              </Text>
            </View>
          </View>

          <View style={styles.currentRow}>
            <Text style={styles.currentLabel}>Current plan</Text>
            <Text style={styles.currentValue}>{currentLabel}</Text>
          </View>

          {!targetActive ? (
            <Text style={styles.neutralText}>This feature is not available on your current plan.</Text>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Usage limits</Text>
          <InfoRow label="Products" value={limits ? `${limits.currentProducts} / ${formatLimit(limits.maxProducts)}` : "Unavailable"} />
          <InfoRow label="Orders" value={limits ? limits.currentOrders.toLocaleString("en-US") : "Unavailable"} />
          <InfoRow label="Offers" value={limits?.canSendOffers ? "Available" : "Not available"} />
          <InfoRow label="Analytics" value={limits?.canAccessAnalytics ? "Available" : "Not available"} />
        </View>

        <TouchableOpacity
          onPress={() => load(true)}
          activeOpacity={0.85}
          style={[styles.refreshBtn, refreshing && { opacity: 0.6 }]}
          disabled={refreshing}
        >
          {refreshing ? <ActivityIndicator color="#FFFFFF" size="small" /> : null}
          <Text style={styles.refreshText}>Refresh plan status</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F4F4F4" },
  loader: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { backgroundColor: "#076B51", paddingHorizontal: 20, paddingTop: 16, paddingBottom: 30, borderBottomLeftRadius: 35, borderBottomRightRadius: 35, flexDirection: "row", alignItems: "center", gap: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 24, fontFamily: "Manrope-Bold", color: "#FFFFFF" },
  content: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 40 },
  errorText: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#FB6363", textAlign: "center", marginBottom: 14 },
  card: { backgroundColor: "#FFFFFF", borderRadius: 22, padding: 20, marginBottom: 16 },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  label: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#858585", marginBottom: 4 },
  planName: { fontSize: 28, fontFamily: "Manrope-Bold", color: "#282828" },
  statusBadge: { borderRadius: 999, backgroundColor: "rgba(7,107,81,0.10)", paddingHorizontal: 12, paddingVertical: 6 },
  statusBadgeInactive: { backgroundColor: "rgba(133,133,133,0.12)" },
  statusText: { fontSize: 12, fontFamily: "Manrope-SemiBold", color: "#076B51" },
  statusTextInactive: { color: "#858585" },
  currentRow: { marginTop: 18, borderTopWidth: 1, borderTopColor: "#F0F0F0", paddingTop: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  currentLabel: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#858585" },
  currentValue: { fontSize: 13, fontFamily: "Manrope-SemiBold", color: "#282828" },
  neutralText: { fontSize: 14, fontFamily: "Outfit-Regular", color: "#858585", lineHeight: 20, marginTop: 14 },
  sectionTitle: { fontSize: 16, fontFamily: "Manrope-Bold", color: "#282828", marginBottom: 10 },
  infoRow: { minHeight: 44, borderTopWidth: 1, borderTopColor: "#F0F0F0", flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  infoLabel: { fontSize: 14, fontFamily: "Outfit-Regular", color: "#282828" },
  infoValue: { fontSize: 13, fontFamily: "Manrope-SemiBold", color: "#1A1A1A" },
  refreshBtn: { height: 56, borderRadius: 14, backgroundColor: "#076B51", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  refreshText: { fontSize: 16, fontFamily: "Manrope-SemiBold", color: "#FFFFFF" },
});
