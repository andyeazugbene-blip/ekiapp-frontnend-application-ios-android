import React, { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { useFocusRefresh } from "../../hooks/useFocusRefresh";
import { Ionicons } from "@expo/vector-icons";
import { goBackOrReplace } from "../../utils/navigation";
import { formatDisplayMoney } from "../../utils/currency";
import { useCurrencyStore } from "../../stores/currencyStore";
import {
  ErrorState,
  FloatingCard,
  IconAvatar,
  LoadingBlock,
  PremiumHeader,
  PrimaryButton,
  premiumStyles,
} from "../../components/shared/PremiumBlocks";
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

  useFocusRefresh(load);

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
    <View style={premiumStyles.page}>
      <PremiumHeader title="Organise a Community Buy" onBack={() => goBackOrReplace(router, "/(buyer)/community-buy" as any)} />

      <ScrollView style={{ flex: 1 }} contentContainerStyle={[premiumStyles.scrollContent, { paddingTop: 18 }]} showsVerticalScrollIndicator={false}>
        {loading ? (
          <LoadingBlock />
        ) : error ? (
          <View style={premiumStyles.block}><ErrorState message={error} onRetry={() => void load()} /></View>
        ) : !profile ? (
          <View style={[premiumStyles.block, { gap: 12 }]}>
            <FloatingCard style={styles.introCard}>
              <IconAvatar icon="megaphone-outline" tone="success" size={52} />
              <Text style={styles.introTitle}>Become an organiser</Text>
              <Text style={styles.introBody}>
                Organisers bring a community together to bulk-buy from a verified supplier. Apply for the market you're in — an admin verifies every application.
              </Text>
            </FloatingCard>
            {markets.length === 0 ? (
              <Text style={styles.emptyText}>Organiser applications aren't open in any market yet.</Text>
            ) : (
              <View style={{ gap: 8 }}>
                {markets.map((m) => (
                  <TouchableOpacity key={m.countryCode} disabled={applying === m.countryCode} onPress={() => void handleApply(m.countryCode)} activeOpacity={0.85}>
                    <FloatingCard style={styles.applyRow}>
                      <Text style={styles.applyRowText}>Apply for {m.countryCode}</Text>
                      {applying === m.countryCode ? <ActivityIndicator size="small" color="#076B51" /> : <Ionicons name="chevron-forward" size={16} color="#8AA194" />}
                    </FloatingCard>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            {applyError ? <Text style={styles.errorText}>{applyError}</Text> : null}
          </View>
        ) : !profile.isVerified ? (
          <View style={premiumStyles.block}>
            <FloatingCard style={styles.introCard}>
              <IconAvatar icon="time-outline" tone="warning" size={52} />
              <Text style={styles.introTitle}>Application under review</Text>
              <Text style={styles.introBody}>
                Your organiser application for {profile.country} is being verified. You'll be notified once you can create a campaign.
              </Text>
            </FloatingCard>
          </View>
        ) : (
          <View style={[premiumStyles.block, { gap: 14 }]}>
            <PrimaryButton label="New campaign" icon="add" onPress={() => router.push("/(buyer)/community-buy-organiser-campaign" as any)} />

            <Text style={styles.section}>Your campaigns</Text>
            {campaigns.length === 0 ? (
              <Text style={styles.emptyText}>You haven't created a campaign yet.</Text>
            ) : (
              <View style={{ gap: 10 }}>
                {campaigns.map((c) => (
                  <TouchableOpacity
                    key={c.id}
                    activeOpacity={0.85}
                    onPress={() => router.push({ pathname: "/(buyer)/community-buy-organiser-campaign", params: { id: c.id } } as any)}
                  >
                    <FloatingCard style={{ gap: 4 }}>
                      <View style={styles.cardTop}>
                        <Text style={styles.cardTitle} numberOfLines={1}>{c.title}</Text>
                        <Text style={styles.cardStatus}>{STATUS_LABEL[c.status]}</Text>
                      </View>
                      <Text style={styles.cardMeta}>Target {formatDisplayMoney(c.targetAmount / 100, c.currency, selectedCurrency)}</Text>
                      {c.reviewNotes && c.status === "CHANGES_REQUIRED" ? <Text style={styles.reviewNotes}>{c.reviewNotes}</Text> : null}
                    </FloatingCard>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  introCard: { alignItems: "center", gap: 8 },
  introTitle: { fontSize: 16, fontFamily: "Manrope-Bold", color: "#151E1B" },
  introBody: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#6A7B72", textAlign: "center", lineHeight: 19 },
  applyRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  applyRowText: { fontSize: 13, fontFamily: "Manrope-SemiBold", color: "#151E1B" },
  errorText: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#D6552F", textAlign: "center" },
  emptyText: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#6A7B72", textAlign: "center", paddingVertical: 8 },
  section: { fontSize: 15, fontFamily: "Manrope-ExtraBold", color: "#12221A" },
  cardTop: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  cardTitle: { flex: 1, fontSize: 14, fontFamily: "Manrope-Bold", color: "#151E1B" },
  cardStatus: { fontSize: 11, fontFamily: "Manrope-SemiBold", color: "#076B51" },
  cardMeta: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#6A7B72" },
  reviewNotes: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#D6552F", marginTop: 4 },
});
