import React, { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { goBackOrReplace } from "../../utils/navigation";
import { formatDisplayMoney } from "../../utils/currency";
import { useCurrencyStore } from "../../stores/currencyStore";
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

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => goBackOrReplace(router, "/(buyer)/profile" as any)} activeOpacity={0.85} style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color="#282828" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Community Buy</Text>
        <TouchableOpacity onPress={() => router.push("/(buyer)/community-buy-organiser" as any)} activeOpacity={0.85} style={styles.organiserButton}>
          <Ionicons name="megaphone-outline" size={18} color="#076B51" />
        </TouchableOpacity>
      </View>

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

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.placeholder}><ActivityIndicator color="#076B51" /></View>
        ) : error ? (
          <View style={styles.emptyState}>
            <Ionicons name="alert-circle-outline" size={28} color="#D6552F" />
            <Text style={styles.emptyTitle}>Couldn't load campaigns</Text>
            <Text style={styles.emptyText}>{error}</Text>
            <TouchableOpacity onPress={() => void load()} activeOpacity={0.86} style={styles.retryButton}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : campaigns.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="people-circle-outline" size={32} color="#076B51" />
            <Text style={styles.emptyTitle}>No live campaigns right now</Text>
            <Text style={styles.emptyText}>Check back soon, or start your own as an organiser.</Text>
          </View>
        ) : (
          campaigns.map((c) => {
            const pct = c.progressPct ?? 0;
            return (
              <TouchableOpacity
                key={c.id}
                activeOpacity={0.85}
                style={styles.card}
                onPress={() => router.push({ pathname: "/(buyer)/community-buy-campaign", params: { id: c.id } } as any)}
              >
                <View style={styles.cardTop}>
                  <Text style={styles.cardTitle} numberOfLines={1}>{c.title}</Text>
                  <View style={styles.countryPill}><Text style={styles.countryPillText}>{c.country}</Text></View>
                </View>
                <Text style={styles.cardVendor}>{c.supplier?.vendor?.storeName ?? "Community Buy"}</Text>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${Math.min(100, pct)}%` }]} />
                </View>
                <View style={styles.cardMetaRow}>
                  <Text style={styles.cardMetaText}>{pct}% of {formatDisplayMoney(c.targetAmount / 100, c.currency, selectedCurrency)}</Text>
                  <Text style={styles.cardMetaText}>{daysLeft(c.deadline)}</Text>
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
  header: { backgroundColor: "#FFFFFF", paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12, flexDirection: "row", alignItems: "center", gap: 12 },
  backButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#F4F4F4", alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, fontSize: 20, fontFamily: "Manrope-Bold", color: "#282828" },
  organiserButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(7,107,81,0.1)", alignItems: "center", justifyContent: "center" },
  filterRow: { paddingHorizontal: 16, paddingBottom: 12, gap: 8, backgroundColor: "#FFFFFF" },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18, backgroundColor: "#F4F4F4" },
  chipActive: { backgroundColor: "#076B51" },
  chipText: { fontSize: 12, fontFamily: "Manrope-SemiBold", color: "#282828" },
  chipTextActive: { color: "#FFFFFF" },
  scrollContent: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 100, gap: 10 },
  placeholder: { paddingVertical: 60, alignItems: "center" },
  emptyState: { alignItems: "center", paddingVertical: 60, paddingHorizontal: 24, gap: 8 },
  emptyTitle: { fontSize: 15, fontFamily: "Manrope-Bold", color: "#282828" },
  emptyText: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#858585", textAlign: "center", lineHeight: 19 },
  retryButton: { marginTop: 6, minHeight: 38, borderRadius: 12, borderWidth: 1, borderColor: "#076B51", paddingHorizontal: 18, alignItems: "center", justifyContent: "center" },
  retryButtonText: { fontSize: 13, fontFamily: "Manrope-SemiBold", color: "#076B51" },
  card: { backgroundColor: "#FFFFFF", borderRadius: 16, padding: 14, gap: 8 },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  cardTitle: { flex: 1, fontSize: 15, fontFamily: "Manrope-Bold", color: "#282828" },
  countryPill: { backgroundColor: "#F4F4F4", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  countryPillText: { fontSize: 10, fontFamily: "Manrope-Bold", color: "#858585" },
  cardVendor: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#858585" },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: "#F4F4F4", overflow: "hidden" },
  progressFill: { height: 6, borderRadius: 3, backgroundColor: "#076B51" },
  cardMetaRow: { flexDirection: "row", justifyContent: "space-between" },
  cardMetaText: { fontSize: 12, fontFamily: "Outfit-Medium", color: "#282828" },
});
