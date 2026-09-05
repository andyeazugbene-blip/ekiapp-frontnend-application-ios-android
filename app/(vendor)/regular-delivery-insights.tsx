import React, { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useFocusRefresh } from "../../hooks/useFocusRefresh";
import { goBackOrReplace } from "../../utils/navigation";
import { formatMoney } from "../../utils/currency";
import {
  ErrorState,
  FloatingCard,
  IconAvatar,
  LoadingBlock,
  PremiumHeader,
  premiumStyles,
} from "../../components/shared/PremiumBlocks";
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

  useFocusRefresh(load);

  return (
    <View style={premiumStyles.page}>
      <PremiumHeader title="Regular Delivery Insights" onBack={() => goBackOrReplace(router, "/(vendor)/regular-deliveries" as any)} />

      <ScrollView style={{ flex: 1 }} contentContainerStyle={[premiumStyles.scrollContent, { paddingTop: 18 }]} showsVerticalScrollIndicator={false}>
        {loading ? (
          <LoadingBlock />
        ) : error ? (
          <View style={premiumStyles.block}><ErrorState message={error} onRetry={() => void load()} /></View>
        ) : !insights ? null : (
          <View style={{ gap: 20 }}>
            <View style={premiumStyles.block}>
              <LinearGradient colors={["#084E39", "#076B51", "#085F48"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.revenueHero}>
                <Text style={styles.revenueLabel}>Renewal revenue · last 30 days</Text>
                {insights.paidRenewalsLast30Days === 0 || insights.revenueLast30Days.length === 0 ? (
                  <Text style={styles.revenueEmpty}>No paid renewals yet</Text>
                ) : (
                  insights.revenueLast30Days.map((row) => (
                    <Text key={row.currency} style={styles.revenueValue}>{formatMoney(row.amount / 100, row.currency)}</Text>
                  ))
                )}
                <Text style={styles.revenueSub}>
                  {insights.paidRenewalsLast30Days} paid renewal{insights.paidRenewalsLast30Days === 1 ? "" : "s"} in the last 30 days
                </Text>
              </LinearGradient>
            </View>

            <View style={premiumStyles.block}>
              <View style={styles.grid}>
                <FloatingCard style={styles.metricCard}>
                  <IconAvatar icon="people-outline" tone="success" />
                  <Text style={styles.metricValue}>{insights.activeSubscribers}</Text>
                  <Text style={styles.metricLabel}>Active subscribers</Text>
                </FloatingCard>
                <FloatingCard style={styles.metricCard}>
                  <IconAvatar icon="pause-outline" tone="neutral" />
                  <Text style={styles.metricValue}>{insights.pausedSubscribers}</Text>
                  <Text style={styles.metricLabel}>Paused subscribers</Text>
                </FloatingCard>
                <FloatingCard style={styles.metricCard}>
                  <IconAvatar icon="close-circle-outline" tone="error" />
                  <Text style={styles.metricValue}>{insights.cancelledLast30Days}</Text>
                  <Text style={styles.metricLabel}>Cancelled (30 days)</Text>
                </FloatingCard>
                <FloatingCard style={styles.metricCard}>
                  <IconAvatar icon="repeat-outline" tone="info" />
                  <Text style={styles.metricValue}>{insights.upcomingRenewalsNext7Days}</Text>
                  <Text style={styles.metricLabel}>Renewals due (7 days)</Text>
                </FloatingCard>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  revenueHero: { borderRadius: 28, padding: 20 },
  revenueLabel: { color: "rgba(255,255,255,0.8)", fontSize: 13, fontFamily: "Outfit-Regular" },
  revenueValue: { color: "#FFFFFF", fontSize: 34, lineHeight: 40, fontFamily: "Manrope-ExtraBold", marginTop: 8 },
  revenueEmpty: { color: "rgba(255,255,255,0.85)", fontSize: 18, fontFamily: "Manrope-Bold", marginTop: 10 },
  revenueSub: { color: "rgba(255,255,255,0.72)", fontSize: 12, fontFamily: "Outfit-Regular", marginTop: 12 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metricCard: { width: "47%", gap: 10 },
  metricValue: { fontSize: 24, fontFamily: "Manrope-ExtraBold", color: "#151E1B" },
  metricLabel: { fontSize: 11, fontFamily: "Outfit-Regular", color: "#6A7B72", marginTop: -6 },
});
