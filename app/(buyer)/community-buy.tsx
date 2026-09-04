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
  RangeProgressBar,
  premiumStyles,
} from "../../components/shared/PremiumBlocks";
import { communityBuyService, type Campaign, type MarketConfig } from "../../services/communityBuyService";

function daysLeft(deadline: string): string {
  const ms = new Date(deadline).getTime() - Date.now();
  if (ms <= 0) return "Closing";
  const days = Math.ceil(ms / (24 * 60 * 60 * 1000));
  return days === 1 ? "1 day left" : `${days} days left`;
}

export default function CommunityBuyDiscoveryScreen() {
  const router = useRouter();
  const { selectedCurrency } = useCurrencyStore();
  const [markets, setMarkets] = useState<MarketConfig[]>([]);
  const [countryFilter, setCountryFilter] = useState<string | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [marketList, campaignList] = await Promise.all([
        communityBuyService.listMarketConfigs().catch(() => [] as MarketConfig[]),
        communityBuyService.listLiveCampaigns(countryFilter ?? undefined),
      ]);
      setMarkets(marketList.filter((m) => m.communityBuyEnabled));
      setCampaigns(campaignList);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load Community Buy campaigns.");
    } finally {
      setLoading(false);
    }
  }, [countryFilter]);

  useFocusRefresh(load);

  return (
    <View style={premiumStyles.page}>
      <PremiumHeader
        title="Community Buy"
        subtitle="Bulk-buy together, unlock better prices"
        onBack={() => goBackOrReplace(router, "/(buyer)/profile" as any)}
        right={
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TouchableOpacity onPress={() => router.push("/(buyer)/my-community-buys" as any)} activeOpacity={0.85} style={styles.headerIconBtn}>
              <Ionicons name="receipt-outline" size={18} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push("/(buyer)/community-buy-organiser" as any)} activeOpacity={0.85} style={styles.headerIconBtn}>
              <Ionicons name="megaphone-outline" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        }
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
        ) : campaigns.length === 0 ? (
          <View style={premiumStyles.block}>
            <FloatingCard>
              <EmptyState
                icon="people-circle-outline"
                title="No live campaigns right now"
                body="Check back soon, or start your own as an organiser."
              />
            </FloatingCard>
          </View>
        ) : (
          <View style={[premiumStyles.block, { gap: 10 }]}>
            {campaigns.map((c) => (
              <TouchableOpacity
                key={c.id}
                activeOpacity={0.85}
                onPress={() => router.push({ pathname: "/(buyer)/community-buy-campaign", params: { id: c.id } } as any)}
              >
                <FloatingCard style={{ gap: 10 }}>
                  <View style={styles.cardTop}>
                    <Text style={styles.cardTitle} numberOfLines={1}>{c.title}</Text>
                    <View style={styles.countryPill}><Text style={styles.countryPillText}>{c.country}</Text></View>
                  </View>
                  <Text style={styles.cardVendor}>{c.supplier?.vendor?.storeName ?? "Community Buy"}</Text>
                  <RangeProgressBar value={c.confirmedShares} min={c.minimumShares} goal={c.goalShares} max={c.maximumShares} />
                  <View style={styles.cardMetaRow}>
                    <Text style={styles.cardMetaText}>Target {formatDisplayMoney(c.targetAmount / 100, c.currency, selectedCurrency)}</Text>
                    <Text style={styles.cardMetaText}>{daysLeft(c.deadline)}</Text>
                  </View>
                </FloatingCard>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  headerIconBtn: { width: 38, height: 38, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.14)", alignItems: "center", justifyContent: "center" },
  filterRow: { gap: 8, paddingTop: 16 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.14)" },
  chipActive: { backgroundColor: "#FFFFFF" },
  chipText: { fontSize: 12, fontFamily: "Manrope-SemiBold", color: "#FFFFFF" },
  chipTextActive: { color: "#076B51" },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  cardTitle: { flex: 1, fontSize: 15, fontFamily: "Manrope-Bold", color: "#151E1B" },
  countryPill: { backgroundColor: "#F4F6F5", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  countryPillText: { fontSize: 10, fontFamily: "Manrope-Bold", color: "#6A7B72" },
  cardVendor: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#6A7B72", marginTop: -4 },
  cardMetaRow: { flexDirection: "row", justifyContent: "space-between" },
  cardMetaText: { fontSize: 12, fontFamily: "Outfit-Medium", color: "#151E1B" },
});
