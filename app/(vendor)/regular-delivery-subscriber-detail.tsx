import React, { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { goBackOrReplace } from "../../utils/navigation";
import { formatDisplayMoney } from "../../utils/currency";
import { useCurrencyStore } from "../../stores/currencyStore";
import {
  regularDeliveriesService,
  FREQUENCY_LABELS,
  RENEWAL_STATUS_LABELS,
  type BuyerSubscription,
} from "../../services/regularDeliveriesService";

function formatDate(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export default function VendorSubscriberDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { selectedCurrency } = useCurrencyStore();
  const [subscription, setSubscription] = useState<BuyerSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError("");
    try {
      setSubscription(await regularDeliveriesService.getSubscriberDetail(id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load this subscriber.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => goBackOrReplace(router, "/(vendor)/regular-deliveries" as any)} activeOpacity={0.85} style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color="#282828" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Subscriber</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.placeholder}><ActivityIndicator color="#076B51" /></View>
        ) : error ? (
          <View style={styles.emptyState}>
            <Ionicons name="alert-circle-outline" size={28} color="#D6552F" />
            <Text style={styles.emptyTitle}>Couldn't load this subscriber</Text>
            <Text style={styles.emptyText}>{error}</Text>
            <TouchableOpacity onPress={() => void load()} activeOpacity={0.86} style={styles.retryButton}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : !subscription ? null : (
          <>
            <View style={styles.card}>
              <Text style={styles.buyerName}>{subscription.buyer?.name ?? "Buyer"}</Text>
              {subscription.buyer?.email ? <Text style={styles.buyerEmail}>{subscription.buyer.email}</Text> : null}
              <View style={styles.metaRow}>
                <View style={[styles.statusPill, { backgroundColor: subscription.status === "ACTIVE" ? "rgba(7,107,81,0.1)" : "#F4F4F4" }]}>
                  <Text style={[styles.statusPillText, { color: subscription.status === "ACTIVE" ? "#076B51" : "#858585" }]}>
                    {subscription.status.replace("_", " ")}
                  </Text>
                </View>
                <Text style={styles.metaText}>{FREQUENCY_LABELS[subscription.frequency]}</Text>
              </View>
              <Text style={styles.metaText}>Next renewal: {formatDate(subscription.nextRenewalAt)}</Text>
            </View>

            <Text style={styles.section}>Items on this subscription</Text>
            {subscription.items.map((item) => (
              <View key={item.id} style={styles.itemRow}>
                <Text style={styles.itemName} numberOfLines={1}>{item.product.title}</Text>
                <Text style={styles.itemMeta}>
                  x{item.quantity} · {formatDisplayMoney(item.product.priceInCents / 100, item.product.currency, selectedCurrency)}
                </Text>
              </View>
            ))}

            <Text style={styles.section}>Renewal history</Text>
            {!subscription.renewals || subscription.renewals.length === 0 ? (
              <Text style={styles.emptyActivityText}>No renewal cycles yet.</Text>
            ) : (
              subscription.renewals.map((r) => (
                <View key={r.id} style={styles.renewalRow}>
                  <View style={styles.renewalTop}>
                    <Text style={styles.renewalDate}>{formatDate(r.cycleDate)}</Text>
                    {r.subtotalAmount ? (
                      <Text style={styles.renewalAmount}>{formatDisplayMoney(r.subtotalAmount / 100, r.currency, selectedCurrency)}</Text>
                    ) : null}
                  </View>
                  <Text style={styles.renewalStatus}>{RENEWAL_STATUS_LABELS[r.status]}</Text>
                  {r.failureReason ? <Text style={styles.renewalFailure}>{r.failureReason}</Text> : null}
                </View>
              ))
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
  headerTitle: { flex: 1, fontSize: 20, fontFamily: "Manrope-Bold", color: "#282828" },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 100, gap: 10 },
  placeholder: { paddingVertical: 60, alignItems: "center" },
  emptyState: { alignItems: "center", paddingVertical: 50, paddingHorizontal: 24, gap: 8 },
  emptyTitle: { fontSize: 14, fontFamily: "Manrope-Bold", color: "#282828" },
  emptyText: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#858585", textAlign: "center", lineHeight: 18 },
  retryButton: { marginTop: 6, minHeight: 38, borderRadius: 12, borderWidth: 1, borderColor: "#076B51", paddingHorizontal: 18, alignItems: "center", justifyContent: "center" },
  retryButtonText: { fontSize: 13, fontFamily: "Manrope-SemiBold", color: "#076B51" },
  card: { backgroundColor: "#FFFFFF", borderRadius: 16, padding: 16, gap: 6 },
  buyerName: { fontSize: 16, fontFamily: "Manrope-Bold", color: "#282828" },
  buyerEmail: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#858585" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 6 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  statusPillText: { fontSize: 11, fontFamily: "Manrope-Bold" },
  metaText: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#858585" },
  section: { fontSize: 15, fontFamily: "Manrope-Bold", color: "#282828", marginTop: 12, marginBottom: 2 },
  itemRow: { backgroundColor: "#FFFFFF", borderRadius: 14, padding: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  itemName: { flex: 1, fontSize: 13, fontFamily: "Outfit-Medium", color: "#282828" },
  itemMeta: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#858585" },
  emptyActivityText: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#858585", paddingVertical: 12, textAlign: "center" },
  renewalRow: { backgroundColor: "#FFFFFF", borderRadius: 14, padding: 12, gap: 4 },
  renewalTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  renewalDate: { fontSize: 13, fontFamily: "Manrope-SemiBold", color: "#282828" },
  renewalAmount: { fontSize: 13, fontFamily: "Manrope-Bold", color: "#076B51" },
  renewalStatus: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#858585" },
  renewalFailure: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#FB6363", marginTop: 2 },
});
