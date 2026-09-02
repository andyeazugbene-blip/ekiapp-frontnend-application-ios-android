import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { goBackOrReplace } from "../../utils/navigation";
import { formatDisplayMoney } from "../../utils/currency";
import { useCurrencyStore } from "../../stores/currencyStore";
import {
  communityBuyService,
  type Campaign,
  type MarketConfig,
  type OrganiserProfile,
} from "../../services/communityBuyService";

const STATUS_LABEL: Record<Campaign["status"], string> = {
  DRAFT: "Draft",
  UNDER_REVIEW: "Under review",
  CHANGES_REQUIRED: "Changes requested",
  APPROVED: "Approved — ready to publish",
  REJECTED: "Rejected",
  LIVE: "Live",
  PAUSED: "Paused",
  RESCUE_WINDOW: "Needs more participants",
  SUCCEEDED: "Succeeded",
  FAILED: "Did not reach minimum",
  REFUNDING: "Refunding",
  FULFILLING: "Proceeding",
  COMPLETED: "Completed",
  FINANCIALLY_CLOSED: "Closed",
  CANCELLED: "Ended",
};

export default function CommunityBuyOrganiserScreen() {
  const router = useRouter();
  const { selectedCurrency } = useCurrencyStore();

  const [profile, setProfile] = useState<OrganiserProfile | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [markets, setMarkets] = useState<MarketConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [applying, setApplying] = useState<string | null>(null);
  const [applyError, setApplyError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [profileData, marketList] = await Promise.all([
        communityBuyService.getMyOrganiserProfile(),
        communityBuyService.listMarketConfigs().catch(() => [] as MarketConfig[]),
      ]);
      setProfile(profileData);
      setMarkets(marketList.filter((m) => m.organiserApplicationsEnabled));
      if (profileData?.isVerified) {
        setCampaigns(await communityBuyService.listMyOrganiserCampaigns());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load your organiser status.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleApply = async (countryCode: string) => {
    setApplying(countryCode);
    setApplyError("");
    try {
      const newProfile = await communityBuyService.applyAsOrganiser(countryCode);
      setProfile(newProfile);
    } catch (err) {
      setApplyError(err instanceof Error ? err.message : "Could not submit your application.");
    } finally {
      setApplying(null);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => goBackOrReplace(router, "/(buyer)/community-buy" as any)} activeOpacity={0.85} style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color="#282828" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Organise a Community Buy</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.placeholder}><ActivityIndicator color="#076B51" /></View>
        ) : error ? (
          <View style={styles.emptyState}>
            <Ionicons name="alert-circle-outline" size={28} color="#D6552F" />
            <Text style={styles.emptyText}>{error}</Text>
            <TouchableOpacity onPress={() => void load()} activeOpacity={0.86} style={styles.retryButton}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : !profile ? (
          <>
            <View style={styles.introCard}>
              <Ionicons name="megaphone-outline" size={26} color="#076B51" />
              <Text style={styles.introTitle}>Become an organiser</Text>
              <Text style={styles.introBody}>
                Organisers bring a community together to bulk-buy from a verified supplier. Apply for the market you're in — an admin verifies every application.
              </Text>
            </View>
            {markets.length === 0 ? (
              <Text style={styles.emptyText}>Organiser applications aren't open in any market yet.</Text>
            ) : (
              markets.map((m) => (
                <TouchableOpacity
                  key={m.countryCode}
                  disabled={applying === m.countryCode}
                  onPress={() => void handleApply(m.countryCode)}
                  activeOpacity={0.85}
                  style={styles.applyRow}
                >
                  <Text style={styles.applyRowText}>Apply for {m.countryCode}</Text>
                  {applying === m.countryCode ? <ActivityIndicator size="small" color="#076B51" /> : <Ionicons name="chevron-forward" size={16} color="#9AA3A0" />}
                </TouchableOpacity>
              ))
            )}
            {applyError ? <Text style={styles.errorText}>{applyError}</Text> : null}
          </>
        ) : !profile.isVerified ? (
          <View style={styles.introCard}>
            <Ionicons name="time-outline" size={26} color="#B48A00" />
            <Text style={styles.introTitle}>Application under review</Text>
            <Text style={styles.introBody}>
              Your organiser application for {profile.country} is being verified. You'll be notified once you can create a campaign.
            </Text>
          </View>
        ) : (
          <>
            <TouchableOpacity onPress={() => router.push("/(buyer)/community-buy-organiser-campaign" as any)} activeOpacity={0.88} style={styles.primaryBtn}>
              <Ionicons name="add" size={16} color="#FFFFFF" />
              <Text style={styles.primaryBtnText}>New campaign</Text>
            </TouchableOpacity>

            <Text style={styles.section}>Your campaigns</Text>
            {campaigns.length === 0 ? (
              <Text style={styles.emptyText}>You haven't created a campaign yet.</Text>
            ) : (
              campaigns.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  activeOpacity={0.85}
                  style={styles.card}
                  onPress={() => router.push({ pathname: "/(buyer)/community-buy-organiser-campaign", params: { id: c.id } } as any)}
                >
                  <View style={styles.cardTop}>
                    <Text style={styles.cardTitle} numberOfLines={1}>{c.title}</Text>
                    <Text style={styles.cardStatus}>{STATUS_LABEL[c.status]}</Text>
                  </View>
                  <Text style={styles.cardMeta}>Target {formatDisplayMoney(c.targetAmount / 100, c.currency, selectedCurrency)}</Text>
                  {c.reviewNotes && c.status === "CHANGES_REQUIRED" ? <Text style={styles.reviewNotes}>{c.reviewNotes}</Text> : null}
                </TouchableOpacity>
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
  headerTitle: { flex: 1, fontSize: 18, fontFamily: "Manrope-Bold", color: "#282828" },
  placeholder: { paddingVertical: 60, alignItems: "center" },
  emptyState: { alignItems: "center", paddingVertical: 40, gap: 8 },
  emptyText: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#858585", textAlign: "center", paddingVertical: 8 },
  retryButton: { marginTop: 6, minHeight: 38, borderRadius: 12, borderWidth: 1, borderColor: "#076B51", paddingHorizontal: 18, alignItems: "center", justifyContent: "center" },
  retryButtonText: { fontSize: 13, fontFamily: "Manrope-SemiBold", color: "#076B51" },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 100, gap: 10 },
  introCard: { backgroundColor: "#FFFFFF", borderRadius: 18, padding: 18, alignItems: "center", gap: 8 },
  introTitle: { fontSize: 16, fontFamily: "Manrope-Bold", color: "#282828" },
  introBody: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#858585", textAlign: "center", lineHeight: 19 },
  applyRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#FFFFFF", borderRadius: 14, padding: 14 },
  applyRowText: { fontSize: 13, fontFamily: "Manrope-SemiBold", color: "#282828" },
  errorText: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#FB6363", textAlign: "center" },
  primaryBtn: { flexDirection: "row", gap: 6, minHeight: 48, borderRadius: 14, backgroundColor: "#076B51", alignItems: "center", justifyContent: "center" },
  primaryBtnText: { fontSize: 13, fontFamily: "Manrope-Bold", color: "#FFFFFF" },
  section: { fontSize: 15, fontFamily: "Manrope-Bold", color: "#282828", marginTop: 6 },
  card: { backgroundColor: "#FFFFFF", borderRadius: 14, padding: 14, gap: 4 },
  cardTop: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  cardTitle: { flex: 1, fontSize: 14, fontFamily: "Manrope-Bold", color: "#282828" },
  cardStatus: { fontSize: 11, fontFamily: "Manrope-SemiBold", color: "#076B51" },
  cardMeta: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#858585" },
  reviewNotes: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#D6552F", marginTop: 4 },
});
