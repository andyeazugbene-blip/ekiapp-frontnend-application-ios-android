import React, { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { goBackOrReplace } from "../../utils/navigation";
import { formatDisplayMoney } from "../../utils/currency";
import { useCurrencyStore } from "../../stores/currencyStore";
import { communityBuyService, type MyCommunityBuy } from "../../services/communityBuyService";

const REFUND_BADGE: Record<NonNullable<MyCommunityBuy["refundStatus"]>, { label: string; color: string; bg: string }> = {
  REFUND_PENDING: { label: "Refund started", color: "#B48A00", bg: "rgba(255,197,0,0.15)" },
  REFUND_PROCESSING: { label: "Refund in progress", color: "#B48A00", bg: "rgba(255,197,0,0.15)" },
  REFUNDED: { label: "Refund completed", color: "#076B51", bg: "rgba(7,107,81,0.1)" },
  REFUND_FAILED: { label: "Refund needs attention", color: "#D6552F", bg: "rgba(214,85,47,0.12)" },
};

function formatDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export default function MyCommunityBuysScreen() {
  const router = useRouter();
  const { selectedCurrency } = useCurrencyStore();
  const [items, setItems] = useState<MyCommunityBuy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setItems(await communityBuyService.listMyContributions());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load your Community Buys.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => goBackOrReplace(router, "/(buyer)/community-buy" as any)} activeOpacity={0.85} style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color="#282828" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Community Buys</Text>
        <TouchableOpacity onPress={() => router.push("/(buyer)/community-buy-support-cases" as any)} activeOpacity={0.85} style={styles.backButton}>
          <Ionicons name="flag-outline" size={18} color="#282828" />
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.placeholder}><ActivityIndicator color="#076B51" /></View>
        ) : error ? (
          <View style={styles.emptyState}>
            <Ionicons name="alert-circle-outline" size={28} color="#D6552F" />
            <Text style={styles.emptyTitle}>Couldn't load this</Text>
            <Text style={styles.emptyText}>{error}</Text>
            <TouchableOpacity onPress={() => void load()} activeOpacity={0.86} style={styles.retryButton}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : items.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="people-circle-outline" size={32} color="#076B51" />
            <Text style={styles.emptyTitle}>No contributions yet</Text>
            <Text style={styles.emptyText}>Campaigns you contribute to will show up here.</Text>
          </View>
        ) : (
          items.map((item) => {
            const badge = item.refundStatus ? REFUND_BADGE[item.refundStatus] : null;
            return (
              <TouchableOpacity
                key={item.campaign.id}
                activeOpacity={0.85}
                style={styles.card}
                onPress={() => router.push({ pathname: "/(buyer)/community-buy-campaign", params: { id: item.campaign.id } } as any)}
              >
                <View style={styles.cardTop}>
                  <Text style={styles.cardTitle} numberOfLines={1}>{item.campaign.title}</Text>
                  {badge ? (
                    <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                      <Text style={[styles.badgeText, { color: badge.color }]}>{badge.label}</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.cardVendor}>{item.campaign.supplier?.vendor?.storeName ?? "Community Buy"}</Text>
                <View style={styles.cardMetaRow}>
                  <Text style={styles.cardMetaText}>{item.totalQuantity} share{item.totalQuantity === 1 ? "" : "s"} · {formatDisplayMoney(item.totalPaid / 100, item.campaign.currency, selectedCurrency)}</Text>
                  <Text style={styles.cardMetaText}>{formatDate(item.campaign.deadline)}</Text>
                </View>
              </TouchableOpacity>
            );
          })
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
  emptyState: { alignItems: "center", paddingVertical: 60, paddingHorizontal: 24, gap: 8 },
  emptyTitle: { fontSize: 15, fontFamily: "Manrope-Bold", color: "#282828" },
  emptyText: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#858585", textAlign: "center", lineHeight: 19 },
  retryButton: { marginTop: 6, minHeight: 38, borderRadius: 12, borderWidth: 1, borderColor: "#076B51", paddingHorizontal: 18, alignItems: "center", justifyContent: "center" },
  retryButtonText: { fontSize: 13, fontFamily: "Manrope-SemiBold", color: "#076B51" },
  card: { backgroundColor: "#FFFFFF", borderRadius: 16, padding: 14, gap: 6 },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  cardTitle: { flex: 1, fontSize: 15, fontFamily: "Manrope-Bold", color: "#282828" },
  cardVendor: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#858585" },
  cardMetaRow: { flexDirection: "row", justifyContent: "space-between" },
  cardMetaText: { fontSize: 12, fontFamily: "Outfit-Medium", color: "#282828" },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  badgeText: { fontSize: 10, fontFamily: "Manrope-Bold" },
});
