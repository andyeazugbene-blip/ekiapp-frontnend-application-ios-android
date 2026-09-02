import React, { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { goBackOrReplace } from "../../utils/navigation";
import {
  regularDeliveriesService,
  FREQUENCY_LABELS,
  type BuyerSubscription,
  type BuyerSubscriptionStatus,
} from "../../services/regularDeliveriesService";

const STATUS_STYLE: Record<BuyerSubscriptionStatus, { label: string; color: string; bg: string }> = {
  ACTIVE: { label: "Active", color: "#076B51", bg: "rgba(7,107,81,0.1)" },
  PAUSED: { label: "Paused", color: "#B48A00", bg: "rgba(255,197,0,0.15)" },
  PAYMENT_ATTENTION: { label: "Needs attention", color: "#D6552F", bg: "rgba(214,85,47,0.12)" },
  CANCELLED: { label: "Cancelled", color: "#858585", bg: "#F4F4F4" },
};

function formatDate(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export default function RegularDeliveriesScreen() {
  const router = useRouter();
  const [items, setItems] = useState<BuyerSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setItems(await regularDeliveriesService.listMySubscriptions());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load your Regular Deliveries.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => goBackOrReplace(router, "/(buyer)/profile" as any)} activeOpacity={0.85} style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color="#282828" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Regular Deliveries</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.placeholder}><ActivityIndicator color="#076B51" /></View>
        ) : error ? (
          <View style={styles.emptyState}>
            <Ionicons name="alert-circle-outline" size={28} color="#D6552F" />
            <Text style={styles.emptyTitle}>Couldn't load your deliveries</Text>
            <Text style={styles.emptyText}>{error}</Text>
            <TouchableOpacity onPress={() => void load()} activeOpacity={0.86} style={styles.retryButton}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : items.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="repeat-outline" size={32} color="#076B51" />
            <Text style={styles.emptyTitle}>No Regular Deliveries yet</Text>
            <Text style={styles.emptyText}>
              Open a vendor's store to see if they offer Regular Deliveries, then set up a recurring order from there.
            </Text>
          </View>
        ) : (
          items.map((sub) => {
            const status = STATUS_STYLE[sub.status];
            return (
              <TouchableOpacity
                key={sub.id}
                activeOpacity={0.85}
                style={styles.card}
                onPress={() => router.push({ pathname: "/(buyer)/regular-delivery-detail", params: { id: sub.id } } as any)}
              >
                <View style={styles.cardTop}>
                  <Text style={styles.cardTitle} numberOfLines={1}>{sub.offer?.title ?? "Regular Delivery"}</Text>
                  <View style={[styles.statusPill, { backgroundColor: status.bg }]}>
                    <Text style={[styles.statusPillText, { color: status.color }]}>{status.label}</Text>
                  </View>
                </View>
                <Text style={styles.cardVendor}>{sub.offer?.vendor?.storeName ?? "Vendor"}</Text>
                <View style={styles.cardMetaRow}>
                  <Ionicons name="repeat-outline" size={14} color="#858585" />
                  <Text style={styles.cardMetaText}>{FREQUENCY_LABELS[sub.frequency]}</Text>
                  {sub.nextRenewalAt ? (
                    <>
                      <Text style={styles.cardMetaDot}>•</Text>
                      <Text style={styles.cardMetaText}>Next: {formatDate(sub.nextRenewalAt)}</Text>
                    </>
                  ) : null}
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
  headerTitle: { flex: 1, fontSize: 20, fontFamily: "Manrope-Bold", color: "#282828" },
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
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  statusPillText: { fontSize: 11, fontFamily: "Manrope-Bold" },
  cardVendor: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#858585" },
  cardMetaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  cardMetaText: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#858585" },
  cardMetaDot: { color: "#DADADA" },
});
