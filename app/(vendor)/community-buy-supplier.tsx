import React, { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
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
  type SupplierProfile,
} from "../../services/communityBuyService";

const STATUS_LABEL: Record<Campaign["status"], string> = {
  DRAFT: "Draft",
  UNDER_REVIEW: "Under review",
  CHANGES_REQUIRED: "Changes requested",
  APPROVED: "Approved",
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

export default function VendorCommunityBuySupplierScreen() {
  const router = useRouter();
  const { selectedCurrency } = useCurrencyStore();

  const [profile, setProfile] = useState<SupplierProfile | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [markets, setMarkets] = useState<MarketConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [applying, setApplying] = useState<string | null>(null);
  const [applyError, setApplyError] = useState("");
  const [committing, setCommitting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [profileData, marketList] = await Promise.all([
        communityBuyService.getMySupplierProfile(),
        communityBuyService.listMarketConfigs().catch(() => [] as MarketConfig[]),
      ]);
      setProfile(profileData);
      setMarkets(marketList.filter((m) => m.supplierApplicationsEnabled));
      if (profileData?.isVerified) {
        setCampaigns(await communityBuyService.listMySupplierCampaigns());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load your supplier status.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleApply = async (countryCode: string) => {
    setApplying(countryCode);
    setApplyError("");
    try {
      setProfile(await communityBuyService.applyAsSupplier(countryCode));
    } catch (err) {
      setApplyError(err instanceof Error ? err.message : "Could not submit your application.");
    } finally {
      setApplying(null);
    }
  };

  /** Doc screens 115-117 — confirms the supplier can fulfil every confirmed quantity between the minimum and maximum before the organiser can submit for admin review. */
  const handleAcceptCampaign = async (campaignId: string) => {
    setCommitting(campaignId);
    try {
      await communityBuyService.confirmSupplierCommitment(campaignId);
      await load();
    } catch (err) {
      setApplyError(err instanceof Error ? err.message : "Could not accept this campaign.");
    } finally {
      setCommitting(null);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => goBackOrReplace(router, "/(vendor)" as any)} activeOpacity={0.85} style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color="#282828" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Community Buy</Text>
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
              <Ionicons name="people-circle-outline" size={26} color="#076B51" />
              <Text style={styles.introTitle}>Become a Community Buy supplier</Text>
              <Text style={styles.introBody}>
                Suppliers fulfil bulk orders raised by organisers in your market. Your store must already be verified. An admin reviews every application.
              </Text>
            </View>
            {markets.length === 0 ? (
              <Text style={styles.emptyText}>Supplier applications aren't open in any market yet.</Text>
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
              Your supplier application for {profile.country} is being verified. You'll be notified once organisers can select you for a campaign.
            </Text>
          </View>
        ) : (
          <>
            <Text style={styles.section}>Assigned campaigns</Text>
            {campaigns.length === 0 ? (
              <Text style={styles.emptyText}>No campaigns have selected you as supplier yet.</Text>
            ) : (
              campaigns.map((c) => (
                <View key={c.id} style={styles.card}>
                  <View style={styles.cardTop}>
                    <Text style={styles.cardTitle} numberOfLines={1}>{c.title}</Text>
                    <Text style={styles.cardStatus}>{STATUS_LABEL[c.status]}</Text>
                  </View>
                  <Text style={styles.cardMeta}>
                    {c.confirmedShares} of {c.maximumShares} shares · minimum {c.minimumShares} to proceed
                  </Text>
                  <Text style={styles.cardMeta}>
                    {formatDisplayMoney(c.pricePerShareMinor / 100, c.currency, selectedCurrency)} per share
                  </Text>
                  {["DRAFT", "CHANGES_REQUIRED"].includes(c.status) && !c.supplierCommitted ? (
                    <TouchableOpacity
                      onPress={() => void handleAcceptCampaign(c.id)}
                      disabled={committing === c.id}
                      activeOpacity={0.88}
                      style={styles.acceptBtn}
                    >
                      {committing === c.id ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.acceptBtnText}>Confirm supply commitment</Text>}
                    </TouchableOpacity>
                  ) : c.supplierCommitted ? (
                    <View style={styles.committedRow}>
                      <Ionicons name="checkmark-circle" size={14} color="#076B51" />
                      <Text style={styles.committedText}>You've accepted this campaign</Text>
                    </View>
                  ) : null}
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
  section: { fontSize: 15, fontFamily: "Manrope-Bold", color: "#282828" },
  card: { backgroundColor: "#FFFFFF", borderRadius: 14, padding: 14, gap: 4 },
  cardTop: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  cardTitle: { flex: 1, fontSize: 14, fontFamily: "Manrope-Bold", color: "#282828" },
  cardStatus: { fontSize: 11, fontFamily: "Manrope-SemiBold", color: "#076B51" },
  cardMeta: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#858585" },
  acceptBtn: { minHeight: 42, borderRadius: 12, backgroundColor: "#076B51", alignItems: "center", justifyContent: "center", marginTop: 6 },
  acceptBtnText: { fontSize: 12, fontFamily: "Manrope-Bold", color: "#FFFFFF" },
  committedRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  committedText: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#076B51" },
});
