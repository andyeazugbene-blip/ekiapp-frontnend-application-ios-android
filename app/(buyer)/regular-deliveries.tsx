import React, { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { goBackOrReplace } from "../../utils/navigation";
import { formatDisplayMoney } from "../../utils/currency";
import { useCurrencyStore } from "../../stores/currencyStore";
import {
  EmptyState,
  ErrorState,
  FloatingCard,
  LoadingBlock,
  PremiumHeader,
  StatusPill,
  premiumStyles,
  type Tone,
} from "../../components/shared/PremiumBlocks";
import {
  regularDeliveriesService,
  FREQUENCY_LABELS,
  type BuyerSubscription,
  type BuyerSubscriptionStatus,
  type ReorderSuggestion,
} from "../../services/regularDeliveriesService";

const STATUS_TONE: Record<BuyerSubscriptionStatus, Tone> = {
  ACTIVE: "success",
  PAUSED: "warning",
  PAYMENT_ATTENTION: "error",
  CANCELLED: "neutral",
};

const STATUS_LABEL: Record<BuyerSubscriptionStatus, string> = {
  ACTIVE: "Active",
  PAUSED: "Paused",
  PAYMENT_ATTENTION: "Needs attention",
  CANCELLED: "Cancelled",
};

function formatDate(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export default function RegularDeliveriesScreen() {
  const router = useRouter();
  const { selectedCurrency } = useCurrencyStore();
  const [items, setItems] = useState<BuyerSubscription[]>([]);
  const [suggestions, setSuggestions] = useState<ReorderSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [subs, reorderSuggestions] = await Promise.all([
        regularDeliveriesService.listMySubscriptions(),
        regularDeliveriesService.getReorderSuggestions().catch(() => []),
      ]);
      setItems(subs);
      setSuggestions(reorderSuggestions);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load your Regular Deliveries.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <View style={premiumStyles.page}>
      <PremiumHeader
        title="Regular Deliveries"
        subtitle={loading ? undefined : `${items.length} subscription${items.length === 1 ? "" : "s"}`}
        onBack={() => goBackOrReplace(router, "/(buyer)/profile" as any)}
      />

      <ScrollView style={{ flex: 1 }} contentContainerStyle={[premiumStyles.scrollContent, { paddingTop: 18 }]} showsVerticalScrollIndicator={false}>
        {loading ? (
          <LoadingBlock />
        ) : error ? (
          <View style={premiumStyles.block}><ErrorState message={error} onRetry={() => void load()} /></View>
        ) : (
          <View style={{ gap: 20 }}>
            {suggestions.length > 0 ? (
              <View>
                <Text style={styles.sectionLabel}>Reorder as a Regular Delivery</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestionsRow}>
                  {suggestions.map((s) => (
                    <TouchableOpacity
                      key={s.product.id}
                      activeOpacity={0.85}
                      onPress={() => router.push({ pathname: "/(buyer)/regular-delivery-offer", params: { id: s.offer.id } } as any)}
                    >
                      <FloatingCard style={styles.suggestionCard}>
                        <Text style={styles.suggestionTitle} numberOfLines={2}>{s.product.title}</Text>
                        <Text style={styles.suggestionMeta}>Bought {s.orderCount}x recently</Text>
                        <Text style={styles.suggestionVendor} numberOfLines={1}>{s.offer.vendorStoreName}</Text>
                        <Text style={styles.suggestionPrice}>{formatDisplayMoney(s.product.priceInCents / 100, s.product.currency, selectedCurrency)}</Text>
                      </FloatingCard>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            ) : null}

            <View style={{ gap: 10 }}>
              {items.length === 0 ? (
                <FloatingCard>
                  <EmptyState
                    icon="repeat-outline"
                    title="No Regular Deliveries yet"
                    body="Open a vendor's store to see if they offer Regular Deliveries, then set up a recurring order from there."
                  />
                </FloatingCard>
              ) : (
                items.map((sub) => (
                  <TouchableOpacity
                    key={sub.id}
                    activeOpacity={0.85}
                    onPress={() => router.push({ pathname: "/(buyer)/regular-delivery-detail", params: { id: sub.id } } as any)}
                  >
                    <FloatingCard>
                      <View style={styles.cardTop}>
                        <Text style={styles.cardTitle} numberOfLines={1}>{sub.offer?.title ?? "Regular Delivery"}</Text>
                        <StatusPill label={STATUS_LABEL[sub.status]} tone={STATUS_TONE[sub.status]} />
                      </View>
                      <Text style={styles.cardVendor}>{sub.offer?.vendor?.storeName ?? "Vendor"}</Text>
                      <View style={styles.cardMetaRow}>
                        <Ionicons name="repeat-outline" size={13} color="#6A7B72" />
                        <Text style={styles.cardMetaText}>{FREQUENCY_LABELS[sub.frequency]}</Text>
                        {sub.nextRenewalAt ? (
                          <>
                            <Text style={styles.cardMetaDot}>•</Text>
                            <Text style={styles.cardMetaText}>Next {formatDate(sub.nextRenewalAt)}</Text>
                          </>
                        ) : null}
                      </View>
                    </FloatingCard>
                  </TouchableOpacity>
                ))
              )}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 6 },
  cardTitle: { flex: 1, fontSize: 15, fontFamily: "Manrope-Bold", color: "#151E1B" },
  cardVendor: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#6A7B72" },
  cardMetaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 },
  cardMetaText: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#6A7B72" },
  cardMetaDot: { color: "#C7D2CB" },
  sectionLabel: { fontSize: 18, fontFamily: "Manrope-ExtraBold", color: "#12221A", marginBottom: 10 },
  suggestionsRow: { gap: 10, paddingBottom: 4 },
  suggestionCard: { width: 152, gap: 4 },
  suggestionTitle: { fontSize: 13, fontFamily: "Manrope-Bold", color: "#151E1B", minHeight: 34 },
  suggestionMeta: { fontSize: 11, fontFamily: "Manrope-SemiBold", color: "#076B51" },
  suggestionVendor: { fontSize: 11, fontFamily: "Outfit-Regular", color: "#6A7B72" },
  suggestionPrice: { fontSize: 13, fontFamily: "Manrope-Bold", color: "#151E1B", marginTop: 4 },
});
