import React, { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { goBackOrReplace } from "../../utils/navigation";
import { formatDisplayMoney } from "../../utils/currency";
import { useCurrencyStore } from "../../stores/currencyStore";
import { useFocusRefresh } from "../../hooks/useFocusRefresh";
import {
  EmptyState,
  ErrorState,
  FloatingCard,
  LoadingBlock,
  PremiumHeader,
  StatusPill,
  premiumStyles,
} from "../../components/shared/PremiumBlocks";
import {
  regularDeliveriesService,
  FREQUENCY_LABELS,
  BUYER_SUBSCRIPTION_STATUS_LABELS,
  BUYER_SUBSCRIPTION_STATUS_TONE,
  type BuyerSubscription,
  type ReorderSuggestion,
} from "../../services/regularDeliveriesService";

function formatDate(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

const TABS = {
  Active: ["ACTIVE", "PAYMENT_ATTENTION", "DRAFT"],
  Paused: ["PAUSED"],
  Ended: ["CANCELLED", "EXPIRED"],
} as const satisfies Record<string, readonly string[]>;
type TabName = keyof typeof TABS;

function estimatedTotalMinor(sub: BuyerSubscription): number {
  const gross = sub.items.reduce((sum, item) => sum + item.product.priceInCents * item.quantity, 0);
  return Math.round(gross * (1 - (sub.offer?.discountPercent ?? 0) / 100));
}

export default function RegularDeliveriesScreen() {
  const router = useRouter();
  const { selectedCurrency } = useCurrencyStore();
  const [items, setItems] = useState<BuyerSubscription[]>([]);
  const [tab, setTab] = useState<TabName>("Active");
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
      setError(err instanceof Error ? err.message : "Could not load your Foodstuff Subscriptions.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusRefresh(load);

  const visible = items.filter((sub) => (TABS[tab] as readonly string[]).includes(sub.status));

  return (
    <View style={premiumStyles.page}>
      <PremiumHeader
        title="My Foodstuff Subscriptions"
        onBack={() => goBackOrReplace(router, "/(buyer)/profile" as any)}
        right={
          <TouchableOpacity onPress={() => router.push("/(buyer)/regular-deliveries-browse" as any)} activeOpacity={0.85} style={styles.headerIconBtn} accessibilityRole="button" accessibilityLabel="Browse eligible foodstuff">
            <Ionicons name="search-outline" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        }
      >
        <View style={styles.tabRow}>
          {(Object.keys(TABS) as TabName[]).map((name) => (
            <TouchableOpacity
              key={name}
              onPress={() => setTab(name)}
              activeOpacity={0.85}
              style={[styles.tabBtn, tab === name && styles.tabBtnActive]}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === name }}
            >
              <Text style={[styles.tabBtnText, tab === name && styles.tabBtnTextActive]}>{name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </PremiumHeader>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={[premiumStyles.scrollContent, { paddingTop: 18 }]} showsVerticalScrollIndicator={false}>
        {loading ? (
          <LoadingBlock />
        ) : error ? (
          <View style={premiumStyles.block}><ErrorState message={error} onRetry={() => void load()} /></View>
        ) : (
          <View style={{ gap: 20 }}>
            {suggestions.length > 0 ? (
              <View>
                <Text style={styles.sectionLabel}>Reorder as a Foodstuff Subscription</Text>
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
              {visible.length === 0 ? (
                <FloatingCard style={{ gap: 12 }}>
                  <EmptyState icon="repeat-outline" title={tab === "Active" ? "You do not have an active Foodstuff Subscription yet." : `No ${tab.toLowerCase()} Foodstuff Subscriptions.`} />
                  <TouchableOpacity onPress={() => router.push("/(buyer)/regular-deliveries-browse" as any)} activeOpacity={0.85} style={styles.browseBtn} accessibilityRole="button">
                    <Text style={styles.browseBtnText}>Browse eligible foodstuff</Text>
                  </TouchableOpacity>
                </FloatingCard>
              ) : (
                visible.map((sub) => (
                  <TouchableOpacity
                    key={sub.id}
                    activeOpacity={0.85}
                    onPress={() => router.push({ pathname: "/(buyer)/regular-delivery-detail", params: { id: sub.id } } as any)}
                    accessibilityRole="button"
                  >
                    <FloatingCard>
                      <View style={styles.cardTop}>
                        <Text style={styles.cardTitle} numberOfLines={1}>{sub.offer?.vendor?.storeName ?? "Store"}</Text>
                        <StatusPill label={BUYER_SUBSCRIPTION_STATUS_LABELS[sub.status]} tone={BUYER_SUBSCRIPTION_STATUS_TONE[sub.status]} />
                      </View>
                      <View style={styles.rowDetail}>
                        <Text style={styles.cardVendor}>Next renewal</Text>
                        <Text style={styles.rowValue}>{formatDate(sub.nextRenewalAt)}</Text>
                      </View>
                      <View style={styles.rowDetail}>
                        <Text style={styles.cardVendor}>Estimated total</Text>
                        <Text style={styles.rowValue}>{formatDisplayMoney(estimatedTotalMinor(sub) / 100, sub.items[0]?.product.currency ?? "GBP", selectedCurrency)}</Text>
                      </View>
                      <View style={styles.cardMetaRow}>
                        <Ionicons name="repeat-outline" size={13} color="#6A7B72" />
                        <Text style={styles.cardMetaText}>{FREQUENCY_LABELS[sub.frequency]}</Text>
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
  headerIconBtn: { width: 38, height: 38, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.14)", alignItems: "center", justifyContent: "center" },
  tabRow: { flexDirection: "row", gap: 8, marginTop: 16 },
  tabBtn: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.12)" },
  tabBtnActive: { backgroundColor: "#FFFFFF" },
  tabBtnText: { fontSize: 12, fontFamily: "Manrope-Bold", color: "rgba(255,255,255,0.85)" },
  tabBtnTextActive: { color: "#076B51" },
  rowDetail: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  rowValue: { fontSize: 12, fontFamily: "Manrope-SemiBold", color: "#151E1B" },
  browseBtn: { minHeight: 44, borderRadius: 14, backgroundColor: "#076B51", alignItems: "center", justifyContent: "center" },
  browseBtnText: { fontSize: 13, fontFamily: "Manrope-Bold", color: "#FFFFFF" },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 6 },
  cardTitle: { flex: 1, fontSize: 15, fontFamily: "Manrope-Bold", color: "#151E1B" },
  cardVendor: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#6A7B72" },
  cardMetaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 },
  cardMetaText: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#6A7B72" },
  sectionLabel: { fontSize: 18, fontFamily: "Manrope-ExtraBold", color: "#12221A", marginBottom: 10 },
  suggestionsRow: { gap: 10, paddingBottom: 4 },
  suggestionCard: { width: 152, gap: 4 },
  suggestionTitle: { fontSize: 13, fontFamily: "Manrope-Bold", color: "#151E1B", minHeight: 34 },
  suggestionMeta: { fontSize: 11, fontFamily: "Manrope-SemiBold", color: "#076B51" },
  suggestionVendor: { fontSize: 11, fontFamily: "Outfit-Regular", color: "#6A7B72" },
  suggestionPrice: { fontSize: 13, fontFamily: "Manrope-Bold", color: "#151E1B", marginTop: 4 },
});
