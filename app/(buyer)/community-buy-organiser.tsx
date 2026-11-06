import React, { useCallback, useState } from "react";
import { Alert, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useFocusRefresh } from "../../hooks/useFocusRefresh";
import { Ionicons } from "@expo/vector-icons";
import { goBackOrReplace } from "../../utils/navigation";
import { startCommunityBuy } from "../../utils/startCommunityBuy";
import { formatDisplayMoney } from "../../utils/currency";
import { useCurrencyStore } from "../../stores/currencyStore";
import type { OrganiserHistory } from "../../services/communityBuyService";
import {
  ErrorState,
  FloatingCard,
  IconAvatar,
  LoadingBlock,
  PremiumHeader,
  PrimaryButton,
  RangeProgressBar,
  premiumStyles,
  InterScope,
} from "../../components/shared/PremiumBlocks";
import {
  communityBuyService,
  CAMPAIGN_STATUS_LABELS,
  type Campaign,
  type OrganiserProfile,
} from "../../services/communityBuyService";

function daysLeft(deadline: string): string {
  const ms = new Date(deadline).getTime() - Date.now();
  if (ms <= 0) return "Closing";
  const days = Math.ceil(ms / (24 * 60 * 60 * 1000));
  return days === 1 ? "1 day left" : `${days} days left`;
}

function ResponsibilityRow({ icon, text }: { icon: React.ComponentProps<typeof Ionicons>["name"]; text: string }) {
  return (
    <View style={styles.responsibilityRow}>
      <Ionicons name={icon} size={16} color="#076B51" style={{ marginTop: 1 }} />
      <Text style={styles.responsibilityText}>{text}</Text>
    </View>
  );
}

function CommunityBuyOrganiserScreenInner() {
  const router = useRouter();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const fromVendor = from === "vendor";
  const { selectedCurrency } = useCurrencyStore();

  const [profile, setProfile] = useState<OrganiserProfile | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [history, setHistory] = useState<OrganiserHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // Phase 2 (organiser identity display preference) — account-level, so it
  // lives here rather than in the per-campaign wizard.
  const [displayPrefBusy, setDisplayPrefBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const profileData = await communityBuyService.getMyOrganiserProfile();
      setProfile(profileData);
      setCampaigns(profileData ? await communityBuyService.listMyOrganiserCampaigns() : []);
      setHistory(profileData ? await communityBuyService.getOrganiserHistory().catch(() => null) : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load your Community Buys.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusRefresh(load);

  // Phase 2 (organiser identity display preference) — toggling this
  // controls whether buyers see this organiser's first name only (default)
  // or their full name, across every campaign they run.
  const handleToggleDisplayPreference = async (showFullName: boolean) => {
    setDisplayPrefBusy(true);
    try {
      const updated = await communityBuyService.updateMyOrganiserProfile({ firstNameOnlyDisplay: !showFullName });
      setProfile(updated);
    } catch (err) {
      Alert.alert("Couldn't update", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setDisplayPrefBusy(false);
    }
  };

  const startCampaign = () => void startCommunityBuy(router);

  return (
    <View style={premiumStyles.page}>
      <PremiumHeader title="Organise a Community Buy" onBack={() => goBackOrReplace(router, (fromVendor ? "/(vendor)" : "/(buyer)/community-buy") as any)} />

      <ScrollView style={{ flex: 1 }} contentContainerStyle={[premiumStyles.scrollContent, { paddingTop: 18 }]} showsVerticalScrollIndicator={false}>
        {loading ? (
          <LoadingBlock />
        ) : error ? (
          <View style={premiumStyles.block}><ErrorState message={error} onRetry={() => void load()} /></View>
        ) : !profile ? (
          // Spec D: organising needs no application and no separate account.
          // The market is chosen inside the campaign form, and Eki reviews
          // each campaign before it goes live.
          <View style={[premiumStyles.block, { gap: 12 }]}>
            <FloatingCard style={styles.introCard}>
              <IconAvatar icon="megaphone-outline" tone="success" size={52} />
              <Text style={styles.introTitle}>Start a Community Buy</Text>
              <Text style={styles.introBody}>
                Bring your community together to bulk-buy real foodstuff at a better price. There is nothing to apply for. Eki reviews every campaign before it goes live.
              </Text>
              <PrimaryButton label="Start a Community Buy" icon="add" onPress={startCampaign} style={{ alignSelf: "stretch", marginTop: 6 }} />
            </FloatingCard>

            <FloatingCard style={{ gap: 10 }}>
              <Text style={styles.responsibilitiesTitle}>What you're responsible for</Text>
              <ResponsibilityRow icon="create-outline" text="Setting the campaign's minimum, goal, maximum and deadline, and choosing how it is supplied." />
              <ResponsibilityRow icon="megaphone-outline" text="Promoting the campaign so it reaches its minimum in time." />
              <ResponsibilityRow icon="chatbubble-ellipses-outline" text="Keeping participants informed with updates while the campaign is live." />
              <Text style={[styles.responsibilitiesTitle, { marginTop: 4 }]}>What Eki handles</Text>
              <ResponsibilityRow icon="shield-checkmark-outline" text="Reviewing every campaign before it goes live, and processing all payments and refunds." />
              <ResponsibilityRow icon="card-outline" text="Participants save their payment details, but are only ever charged once the campaign actually succeeds. Eki never collects money upfront." />
              <Text style={[styles.responsibilitiesTitle, { marginTop: 4 }]}>What you cannot change</Text>
              <ResponsibilityRow icon="lock-closed-outline" text="Once a participant has contributed, the price, minimum, goal, maximum and deadline are locked. You also cannot approve your own extension requests or bypass Eki's review." />
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
              <PrimaryButton label="Start a Community Buy" icon="add" onPress={startCampaign} />
            )}

            <TouchableOpacity
              onPress={() => router.push("/(buyer)/community-buy-organiser-payouts" as any)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Payouts and Stripe Connect setup"
            >
              <FloatingCard style={styles.applyRow}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Ionicons name="card-outline" size={16} color="#076B51" />
                  <Text style={styles.applyRowText}>Payouts & Stripe Connect setup</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#8AA194" />
              </FloatingCard>
            </TouchableOpacity>

            <FloatingCard style={styles.applyRow}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.applyRowText}>Show my full name to buyers</Text>
                <Text style={styles.cardMeta}>Off shows only your first name on your campaigns. Default is first name only.</Text>
              </View>
              <Switch
                value={!(profile.firstNameOnlyDisplay ?? true)}
                onValueChange={(v) => void handleToggleDisplayPreference(v)}
                disabled={displayPrefBusy}
                accessibilityLabel="Show my full name to buyers"
                trackColor={{ false: "#D9E2DC", true: "#076B51" }}
              />
            </FloatingCard>

            {history ? (
              <>
                <Text style={styles.section}>Organiser history</Text>
                <FloatingCard style={{ gap: 6 }}>
                  <Text style={styles.applyRowText}>Campaigns organised: {history.campaignsOrganised}</Text>
                  <Text style={styles.applyRowText}>Successful campaigns: {history.successfulCampaigns}</Text>
                  <Text style={styles.applyRowText}>Participant completion rate: {history.participantCompletionRate == null ? "No payments yet" : `${history.participantCompletionRate}%`}</Text>
                  <Text style={styles.applyRowText}>Fulfilment issues: {history.fulfilmentIssues}</Text>
                  <Text style={styles.applyRowText}>Organiser payments: {history.organiserPaymentsEnabled ? "Enabled" : "Not enabled"}</Text>
                </FloatingCard>
              </>
            ) : null}

            <Text style={styles.section}>Your campaigns</Text>
            {campaigns.length === 0 ? (
              <Text style={styles.emptyText}>You haven't created a campaign yet.</Text>
            ) : (
              <View style={{ gap: 10 }}>
                {campaigns.map((c) => {
                  const isLiveLike = ["LIVE", "PAUSED", "RESCUE_WINDOW"].includes(c.status);
                  const fulfilmentLabel = c.fulfilmentOwner === "SELF"
                    ? "Self-fulfilled"
                    : c.supplierCommitted
                      ? "Supplier accepted"
                      : c.supplierDeclinedAt
                        ? "Supplier declined — you can reassign"
                        : "Supplier invited — awaiting response";
                  // Matches the client's exact example states — always a
                  // concrete next action, never silent about what happens
                  // next regardless of fulfilment mode or supplier state.
                  const nextAction = c.status === "DRAFT" || c.status === "CHANGES_REQUIRED"
                    ? "Next: complete and submit campaign"
                    : c.status === "UNDER_REVIEW"
                      ? "Next: waiting for Eki review"
                      : c.status === "APPROVED"
                        ? "Next: publish campaign"
                        : isLiveLike
                          ? c.fulfilmentOwner === "SELF"
                            ? `Campaign is live · ${daysLeft(c.deadline!)}`
                            : c.supplierDeclinedAt
                              ? "Campaign is live · choose another supplier"
                              : `Campaign is live · ${daysLeft(c.deadline!)}`
                          : null;
                  return (
                    <TouchableOpacity
                      key={c.id}
                      activeOpacity={0.85}
                      onPress={() => router.push({ pathname: "/(buyer)/community-buy-organiser-campaign", params: { id: c.id } } as any)}
                      accessibilityRole="button"
                      accessibilityLabel={`${c.title}, ${CAMPAIGN_STATUS_LABELS[c.status]}`}
                    >
                      <FloatingCard style={{ gap: 6 }}>
                        <View style={styles.cardTop}>
                          <Text style={styles.cardTitle} numberOfLines={1}>{c.title}</Text>
                          <Text style={styles.cardStatus}>{CAMPAIGN_STATUS_LABELS[c.status]}</Text>
                        </View>
                        {isLiveLike || c.status === "UNDER_REVIEW" || c.status === "APPROVED" ? (
                          <RangeProgressBar value={c.confirmedShares} min={c.minimumShares!} goal={c.goalShares!} max={c.maximumShares!} />
                        ) : null}
                        <Text style={styles.cardMeta}>
                          {c.confirmedShares} of {c.goalShares} goal ({c.minimumShares} min, {c.maximumShares} max) · {c.participantCount ?? 0} participant{(c.participantCount ?? 0) === 1 ? "" : "s"} · {formatDisplayMoney((c.paidTotal ?? 0) / 100, c.currency, selectedCurrency)} raised
                        </Text>
                        <Text style={styles.cardMeta}>{fulfilmentLabel}</Text>
                        {nextAction ? <Text style={styles.cardNextAction}>{nextAction}</Text> : null}
                        {c.reviewNotes && c.status === "CHANGES_REQUIRED" ? <Text style={styles.reviewNotes}>{c.reviewNotes}</Text> : null}
                      </FloatingCard>
                    </TouchableOpacity>
                  );
                })}
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
  introTitle: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#151E1B" },
  introBody: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#6A7B72", textAlign: "center", lineHeight: 19 },
  applyRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  applyRowText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#151E1B" },
  emptyText: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#6A7B72", textAlign: "center", paddingVertical: 8 },
  section: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#12221A" },
  cardTop: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  cardTitle: { flex: 1, fontSize: 14, fontFamily: "Inter_700Bold", color: "#151E1B" },
  cardStatus: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#076B51" },
  cardMeta: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#6A7B72" },
  cardNextAction: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#076B51", marginTop: 2 },
  reviewNotes: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#D6552F", marginTop: 4 },
  responsibilitiesTitle: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#12221A" },
  responsibilityRow: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  responsibilityText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", color: "#4A5A52", lineHeight: 17 },
  restrictedCard: { flexDirection: "row", gap: 10, alignItems: "flex-start", backgroundColor: "rgba(214,85,47,0.08)" },
  restrictedTitle: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#151E1B" },
  restrictedBody: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#6A7B72", lineHeight: 17, marginTop: 2 },
});

export default function CommunityBuyOrganiserScreen() {
  return (
    <InterScope value={true}>
      <CommunityBuyOrganiserScreenInner />
    </InterScope>
  );
}
