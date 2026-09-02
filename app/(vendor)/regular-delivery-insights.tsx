import React, { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { goBackOrReplace } from "../../utils/navigation";
import { formatMoney } from "../../utils/currency";
import {
  regularDeliveriesService,
  type RegularDeliveryInsights,
} from "../../services/regularDeliveriesService";

export default function RegularDeliveryInsightsScreen() {
  const router = useRouter();
  const [insights, setInsights] = useState<RegularDeliveryInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setInsights(await regularDeliveriesService.getInsights());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load insights.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => goBackOrReplace(router, "/(vendor)/regular-deliveries" as any)} activeOpacity={0.85} style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color="#282828" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Regular Delivery Insights</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.placeholder}><ActivityIndicator color="#076B51" /></View>
        ) : error ? (
          <View style={styles.emptyState}>
            <Ionicons name="alert-circle-outline" size={28} color="#D6552F" />
            <Text style={styles.emptyTitle}>Couldn't load insights</Text>
            <Text style={styles.emptyText}>{error}</Text>
            <TouchableOpacity onPress={() => void load()} activeOpacity={0.86} style={styles.retryButton}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : !insights ? null : (
          <>
            <View style={styles.grid}>
              <View style={styles.metricCard}>
                <Ionicons name="people-outline" size={20} color="#076B51" />
                <Text style={styles.metricValue}>{insights.activeSubscribers}</Text>
                <Text style={styles.metricLabel}>Active subscribers</Text>
              </View>
              <View style={styles.metricCard}>
                <Ionicons name="pause-outline" size={20} color="#076B51" />
                <Text style={styles.metricValue}>{insights.pausedSubscribers}</Text>
                <Text style={styles.metricLabel}>Paused subscribers</Text>
              </View>
              <View style={styles.metricCard}>
                <Ionicons name="close-circle-outline" size={20} color="#076B51" />
                <Text style={styles.metricValue}>{insights.cancelledLast30Days}</Text>
                <Text style={styles.metricLabel}>Cancelled (30 days)</Text>
              </View>
              <View style={styles.metricCard}>
                <Ionicons name="repeat-outline" size={20} color="#076B51" />
                <Text style={styles.metricValue}>{insights.upcomingRenewalsNext7Days}</Text>
                <Text style={styles.metricLabel}>Renewals due (7 days)</Text>
              </View>
            </View>

            <Text style={styles.section}>Renewal revenue — last 30 days</Text>
            {insights.paidRenewalsLast30Days === 0 ? (
              <Text style={styles.emptyActivityText}>No paid renewals in the last 30 days yet.</Text>
            ) : (
              <View style={styles.card}>
                <Text style={styles.revenueSub}>{insights.paidRenewalsLast30Days} paid renewal{insights.paidRenewalsLast30Days === 1 ? "" : "s"}</Text>
                {insights.revenueLast30Days.map((row) => (
                  <Text key={row.currency} style={styles.revenueValue}>{formatMoney(row.amount / 100, row.currency)}</Text>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9F9F9" },
  header: { backgroundColor: "#FFFFFF", paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16, flexDirection: "row", alignItems: "center", gap: 12 },
  backButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#F4F4F4", alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, fontSize: 18, fontFamily: "Manrope-Bold", color: "#282828" },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 100, gap: 10 },
  placeholder: { paddingVertical: 60, alignItems: "center" },
  emptyState: { alignItems: "center", paddingVertical: 50, paddingHorizontal: 24, gap: 8 },
  emptyTitle: { fontSize: 14, fontFamily: "Manrope-Bold", color: "#282828" },
  emptyText: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#858585", textAlign: "center", lineHeight: 18 },
  retryButton: { marginTop: 6, minHeight: 38, borderRadius: 12, borderWidth: 1, borderColor: "#076B51", paddingHorizontal: 18, alignItems: "center", justifyContent: "center" },
  retryButtonText: { fontSize: 13, fontFamily: "Manrope-SemiBold", color: "#076B51" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metricCard: { width: "47%", backgroundColor: "#FFFFFF", borderRadius: 16, padding: 14, gap: 6 },
  metricValue: { fontSize: 22, fontFamily: "Manrope-ExtraBold", color: "#282828" },
  metricLabel: { fontSize: 11, fontFamily: "Outfit-Regular", color: "#858585" },
  section: { fontSize: 15, fontFamily: "Manrope-Bold", color: "#282828", marginTop: 12, marginBottom: 2 },
  emptyActivityText: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#858585", paddingVertical: 12, textAlign: "center" },
  card: { backgroundColor: "#FFFFFF", borderRadius: 16, padding: 16, gap: 4 },
  revenueSub: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#858585" },
  revenueValue: { fontSize: 20, fontFamily: "Manrope-ExtraBold", color: "#076B51" },
});
