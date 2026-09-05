import React, { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { useFocusRefresh } from "../../hooks/useFocusRefresh";
import { goBackOrReplace } from "../../utils/navigation";
import { formatDisplayMoney } from "../../utils/currency";
import { useCurrencyStore } from "../../stores/currencyStore";
import {
  EmptyState,
  ErrorState,
  FloatingCard,
  LoadingBlock,
  PremiumHeader,
  premiumStyles,
} from "../../components/shared/PremiumBlocks";
import { communityBuyService, type MarketConfig } from "../../services/communityBuyService";
import { regularDeliveriesService, FREQUENCY_LABELS, type PublicOfferSummary } from "../../services/regularDeliveriesService";

/**
 * Real public discovery for Regular Delivery offers (architecture gap
 * closure) — a buyer can reach this without a previous purchase, a deep
 * link, or an existing subscription. Reuses the same market-chip pattern
 * as the Community Buy discovery screen for consistency, filtered on the
 * regularDeliveriesEnabled flag instead of communityBuyEnabled.
 */
export default function RegularDeliveriesBrowseScreen() {
  const router = useRouter();
  const { selectedCurrency } = useCurrencyStore();
  const [markets, setMarkets] = useState<MarketConfig[]>([]);
  const [countryFilter, setCountryFilter] = useState<string | null>(null);
  const [offers, setOffers] = useState<PublicOfferSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [marketList, offerList] = await Promise.all([
        communityBuyService.listMarketConfigs().catch(() => [] as MarketConfig[]),
        regularDeliveriesService.listPublicOffers(countryFilter ? { country: countryFilter } : undefined),
      ]);
      setMarkets(marketList.filter((m) => m.regularDeliveriesEnabled));
      setOffers(offerList);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load Regular Delivery offers.");
    } finally {
      setLoading(false);
    }
  }, [countryFilter]);

  useFocusRefresh(load);

  return (
    <View style={premiumStyles.page}>
      <PremiumHeader
        title="Browse Regular Deliveries"
        subtitle="Recurring foodstuff orders from local vendors"
        onBack={() => goBackOrReplace(router, "/(buyer)/regular-deliveries" as any)}
      >
        {markets.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            <TouchableOpacity onPress={() => setCountryFilter(null)} activeOpacity={0.85} style={[styles.chip, !countryFilter && styles.chipActive]}>
              <Text style={[styles.chipText, !countryFilter && styles.chipTextActive]}>All markets</Text>
            </TouchableOpacity>
            {markets.map((m) => (
              <TouchableOpacity key={m.countryCode} onPress={() => setCountryFilter(m.countryCode)} activeOpacity={0.85} style={[styles.chip, countryFilter === m.countryCode && styles.chipActive]}>
                <Text style={[styles.chipText, countryFilter === m.countryCode && styles.chipTextActive]}>{m.countryCode}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : null}
      </PremiumHeader>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={[premiumStyles.scrollContent, { paddingTop: 18 }]} showsVerticalScrollIndicator={false}>
        {loading ? (
          <LoadingBlock />
        ) : error ? (
          <View style={premiumStyles.block}><ErrorState message={error} onRetry={() => void load()} /></View>
        ) : offers.length === 0 ? (
          <View style={premiumStyles.block}>
            <FloatingCard>
              <EmptyState
                icon="repeat-outline"
                title="No Regular Delivery offers right now"
                body={countryFilter ? "No vendors in this market offer Regular Deliveries yet." : "Check back soon as more vendors add recurring offers."}
              />
            </FloatingCard>
          </View>
        ) : (
          <View style={[premiumStyles.block, { gap: 10 }]}>
            {offers.map((o) => {
              const first = o.products[0]?.product;
              return (
                <TouchableOpacity
                  key={o.id}
                  activeOpacity={0.85}
                  onPress={() => router.push({ pathname: "/(buyer)/regular-delivery-offer", params: { id: o.id } } as any)}
                >
                  <FloatingCard style={{ gap: 8 }}>
                    <View style={styles.cardTop}>
                      <Text style={styles.cardTitle} numberOfLines={1}>{o.title}</Text>
                      {o.vendor.country ? <View style={styles.countryPill}><Text style={styles.countryPillText}>{o.vendor.country}</Text></View> : null}
                    </View>
                    <Text style={styles.cardVendor}>{o.vendor.storeName}{o.vendor.city ? ` · ${o.vendor.city}` : ""}</Text>
                    <Text style={styles.cardMetaText}>{o.products.length} product{o.products.length === 1 ? "" : "s"} · {o.frequencies.map((f) => FREQUENCY_LABELS[f]).join(", ")}</Text>
                    {first ? (
                      <Text style={styles.cardPrice}>From {formatDisplayMoney(first.priceInCents / 100, first.currency, selectedCurrency)}{o.discountPercent ? ` · ${o.discountPercent}% off` : ""}</Text>
                    ) : null}
                  </FloatingCard>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  filterRow: { gap: 8, paddingTop: 16 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.14)" },
  chipActive: { backgroundColor: "#FFFFFF" },
  chipText: { fontSize: 12, fontFamily: "Manrope-SemiBold", color: "#FFFFFF" },
  chipTextActive: { color: "#076B51" },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  cardTitle: { flex: 1, fontSize: 15, fontFamily: "Manrope-Bold", color: "#151E1B" },
  countryPill: { backgroundColor: "#F4F6F5", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  countryPillText: { fontSize: 10, fontFamily: "Manrope-Bold", color: "#6A7B72" },
  cardVendor: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#6A7B72" },
  cardMetaText: { fontSize: 12, fontFamily: "Outfit-Medium", color: "#151E1B" },
  cardPrice: { fontSize: 13, fontFamily: "Manrope-Bold", color: "#076B51" },
});
