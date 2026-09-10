import React, { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
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
  CAMPAIGN_STATUS_LABELS,
  type Campaign,
  type MarketConfig,
  type OrganiserProfile,
} from "../../services/communityBuyService";
import { countryDisplayName } from "../../utils/countries";

function ResponsibilityRow({ icon, text }: { icon: React.ComponentProps<typeof Ionicons>["name"]; text: string }) {
  return (
    <View style={styles.responsibilityRow}>
      <Ionicons name={icon} size={16} color="#076B51" style={{ marginTop: 1 }} />
      <Text style={styles.responsibilityText}>{text}</Text>
    </View>
  );
}

export default function CommunityBuyOrganiserScreen() {
  const router = useRouter();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const fromVendor = from === "vendor";
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
      <PremiumHeader title="Organise a Community Buy" onBack={() => goBackOrReplace(router, (fromVendor ? "/(vendor)" : "/(buyer)/community-buy") as any)} />

      <ScrollView style={{ flex: 1 }} contentContainerStyle={[premiumStyles.scrollContent, { paddingTop: 18 }]} showsVerticalScrollIndicator={false}>
        {fromVendor ? (
          <View style={premiumStyles.block}>
            <View style={styles.vendorCueRow}>
              <Ionicons name="swap-horizontal-outline" size={14} color="#516A60" />
              <Text style={styles.vendorCueText}>You're now managing this as an organiser — a separate role from your vendor store.</Text>
            </View>
          </View>
        ) : null}
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
                Organisers bring a community together to bulk-buy real foodstuff from a verified supplier at a better price. Apply for the market you're in — an admin verifies every application.
              </Text>
            </FloatingCard>

            <FloatingCard style={{ gap: 10 }}>
              <Text style={styles.responsibilitiesTitle}>What you're responsible for</Text>
              <ResponsibilityRow icon="create-outline" text="Setting the campaign's minimum, goal, maximum and deadline, and choosing a verified supplier." />
              <ResponsibilityRow icon="megaphone-outline" text="Promoting the campaign so it reaches its minimum in time." />
              <ResponsibilityRow icon="chatbubble-ellipses-outline" text="Keeping participants informed with updates while the campaign is live." />
              <Text style={[styles.responsibilitiesTitle, { marginTop: 4 }]}>What Eki handles</Text>
              <ResponsibilityRow icon="shield-checkmark-outline" text="Verifying you and the supplier, reviewing every campaign before it goes live, and processing all payments and refunds." />
              <ResponsibilityRow icon="card-outline" text="Participants save their payment details, but are only ever charged once the campaign actually succeeds. Eki never collects money upfront." />
              <Text style={[styles.responsibilitiesTitle, { marginTop: 4 }]}>What you cannot change</Text>
              <ResponsibilityRow icon="lock-closed-outline" text="Once a participant has contributed, the price, minimum, goal, maximum and deadline are locked. You also cannot approve your own extension requests or bypass admin review." />
            </FloatingCard>

            {markets.length === 0 ? (
              <FloatingCard style={styles.introCard}>
                <IconAvatar icon="hourglass-outline" tone="warning" size={52} />
                <Text style={styles.introTitle}>Organiser applications open market-by-market</Text>
                <Text style={styles.introBody}>
                  We're rolling out Community Buy one market at a time, so each one can complete its legal and payments review before organisers start collecting pledges there. No market has finished that review yet, so applications aren't open anywhere right now.
                </Text>
                <Text style={[styles.introBody, { marginTop: 4 }]}>
                  You'll get a notification the moment your market opens. In the meantime, you can still browse any Community Buy campaigns already running.
                </Text>
                <PrimaryButton
                  label="Browse Community Buy"
                  icon="search-outline"
                  onPress={() => router.push("/(buyer)/community-buy" as any)}
                />
              </FloatingCard>
            ) : (
              <View style={{ gap: 8 }}>
                {markets.map((m) => (
                  <TouchableOpacity
                    key={m.countryCode}
                    disabled={applying === m.countryCode}
                    onPress={() => void handleApply(m.countryCode)}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel={`Apply for ${countryDisplayName(m.countryCode)}`}
                    accessibilityState={{ disabled: applying === m.countryCode, busy: applying === m.countryCode }}
                  >
                    <FloatingCard style={styles.applyRow}>
                      <Text style={styles.applyRowText}>Apply for {countryDisplayName(m.countryCode)}</Text>
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
                Your organiser application for {countryDisplayName(profile.country)} is being verified. You'll be notified once you can create a campaign.
              </Text>
            </FloatingCard>
          </View>
        ) : (
          <View style={[premiumStyles.block, { gap: 14 }]}>
            {profile.isRestricted ? (
              <FloatingCard style={styles.restrictedCard}>
                <Ionicons name="alert-circle-outline" size={20} color="#D6552F" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.restrictedTitle}>New campaigns are currently restricted</Text>
                  <Text style={styles.restrictedBody}>
                    {profile.restrictedReason ?? "An admin has temporarily restricted your organiser account from creating new campaigns."} Your existing campaigns are unaffected — you can still manage them below.
                  </Text>
                </View>
              </FloatingCard>
            ) : (
              <PrimaryButton label="New campaign" icon="add" onPress={() => router.push("/(buyer)/community-buy-organiser-campaign" as any)} />
            )}

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
                    accessibilityRole="button"
                    accessibilityLabel={`${c.title}, ${CAMPAIGN_STATUS_LABELS[c.status]}`}
                  >
                    <FloatingCard style={{ gap: 4 }}>
                      <View style={styles.cardTop}>
                        <Text style={styles.cardTitle} numberOfLines={1}>{c.title}</Text>
                        <Text style={styles.cardStatus}>{CAMPAIGN_STATUS_LABELS[c.status]}</Text>
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
  responsibilitiesTitle: { fontSize: 13, fontFamily: "Manrope-ExtraBold", color: "#12221A" },
  responsibilityRow: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  responsibilityText: { flex: 1, fontSize: 12, fontFamily: "Outfit-Regular", color: "#4A5A52", lineHeight: 17 },
  restrictedCard: { flexDirection: "row", gap: 10, alignItems: "flex-start", backgroundColor: "rgba(214,85,47,0.08)" },
  restrictedTitle: { fontSize: 13, fontFamily: "Manrope-Bold", color: "#151E1B" },
  restrictedBody: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#6A7B72", lineHeight: 17, marginTop: 2 },
  vendorCueRow: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#F4F6F5", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9 },
  vendorCueText: { flex: 1, fontSize: 11, fontFamily: "Outfit-Regular", color: "#516A60" },
});
