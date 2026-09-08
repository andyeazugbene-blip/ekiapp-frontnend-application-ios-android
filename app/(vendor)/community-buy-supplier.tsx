import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
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
  StatusPill,
  premiumStyles,
} from "../../components/shared/PremiumBlocks";
import {
  communityBuyService,
  CAMPAIGN_STATUS_LABELS,
  CAMPAIGN_STATUS_TONE,
  type Campaign,
  type MarketConfig,
  type SupplierProfile,
} from "../../services/communityBuyService";
import { vendorService, type VendorMarket } from "../../services/vendorService";
import { countryDisplayName } from "../../utils/countries";

const UPDATE_POSTABLE_STATUSES = ["LIVE", "PAUSED", "RESCUE_WINDOW", "SUCCEEDED", "FAILED", "REFUNDING", "FULFILLING", "COMPLETED"];

function formatDeadline(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

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
  const [declining, setDeclining] = useState<string | null>(null);
  const [showDeclineFormId, setShowDeclineFormId] = useState<string | null>(null);
  const [declineReasonById, setDeclineReasonById] = useState<Record<string, string>>({});
  const [showUpdateFormId, setShowUpdateFormId] = useState<string | null>(null);
  const [updateTitleById, setUpdateTitleById] = useState<Record<string, string>>({});
  const [updateMessageById, setUpdateMessageById] = useState<Record<string, string>>({});
  const [postingUpdate, setPostingUpdate] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [profileData, marketList, vendorMarkets] = await Promise.all([
        communityBuyService.getMySupplierProfile(),
        communityBuyService.listMarketConfigs().catch(() => [] as MarketConfig[]),
        vendorService.getMyMarkets().catch(() => [] as VendorMarket[]),
      ]);
      setProfile(profileData);
      // A vendor can only apply as a supplier for a market they're actually
      // assigned to (backend enforces this too) — showing every open market
      // regardless would just produce a confusing rejection on submit.
      const activeVendorCodes = new Set(vendorMarkets.filter((m) => m.enabled).map((m) => m.marketCode));
      setMarkets(marketList.filter((m) => m.supplierApplicationsEnabled && activeVendorCodes.has(m.countryCode)));
      if (profileData?.isVerified) {
        setCampaigns(await communityBuyService.listMySupplierCampaigns());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load your supplier status.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusRefresh(load);

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
  const handleAcceptCampaign = (campaignId: string, title: string) => {
    Alert.alert(
      "Accept this campaign?",
      `You're committing to fulfil "${title}" if it succeeds. This is a real supply obligation.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Accept",
          onPress: async () => {
            setCommitting(campaignId);
            try {
              await communityBuyService.confirmSupplierCommitment(campaignId);
              await load();
            } catch (err) {
              Alert.alert("Couldn't accept this campaign", err instanceof Error ? err.message : "Please try again.");
            } finally {
              setCommitting(null);
            }
          },
        },
      ],
    );
  };

  const handleDeclineCampaign = async (campaignId: string) => {
    setDeclining(campaignId);
    try {
      await communityBuyService.declineSupplierCommitment(campaignId, declineReasonById[campaignId]?.trim() || undefined);
      setShowDeclineFormId(null);
      await load();
    } catch (err) {
      Alert.alert("Couldn't decline this campaign", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setDeclining(null);
    }
  };

  const handlePostUpdate = async (campaignId: string) => {
    const title = updateTitleById[campaignId]?.trim();
    const message = updateMessageById[campaignId]?.trim();
    if (!title || !message) {
      Alert.alert("Title and message required", "Give participants both a title and a message.");
      return;
    }
    setPostingUpdate(campaignId);
    try {
      await communityBuyService.postCampaignUpdate(campaignId, title, message);
      setUpdateTitleById((prev) => ({ ...prev, [campaignId]: "" }));
      setUpdateMessageById((prev) => ({ ...prev, [campaignId]: "" }));
      setShowUpdateFormId(null);
      Alert.alert("Update posted", "Every participant has been notified.");
    } catch (err) {
      Alert.alert("Couldn't post this update", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setPostingUpdate(null);
    }
  };

  return (
    <View style={premiumStyles.page}>
      <PremiumHeader title="Community Buy" subtitle="Supplier dashboard" onBack={() => goBackOrReplace(router, "/(vendor)" as any)} />

      <ScrollView style={{ flex: 1 }} contentContainerStyle={[premiumStyles.scrollContent, { paddingTop: 18 }]} showsVerticalScrollIndicator={false}>
        {loading ? (
          <LoadingBlock />
        ) : error ? (
          <View style={premiumStyles.block}><ErrorState message={error} onRetry={() => void load()} /></View>
        ) : !profile ? (
          <View style={[premiumStyles.block, { gap: 12 }]}>
            <FloatingCard style={styles.introCard}>
              <IconAvatar icon="people-circle-outline" tone="success" size={52} />
              <Text style={styles.introTitle}>Become a Community Buy supplier</Text>
              <Text style={styles.introBody}>
                Suppliers fulfil bulk orders raised by organisers in your market. Your store must already be verified. An admin reviews every application.
              </Text>
            </FloatingCard>
            {markets.length === 0 ? (
              <Text style={styles.emptyText}>Supplier applications aren't open in any market yet.</Text>
            ) : (
              <View style={{ gap: 8 }}>
                {markets.map((m) => (
                  <TouchableOpacity key={m.countryCode} disabled={applying === m.countryCode} onPress={() => void handleApply(m.countryCode)} activeOpacity={0.85}>
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
                Your supplier application for {countryDisplayName(profile.country)} is being verified. You'll be notified once organisers can select you for a campaign.
              </Text>
            </FloatingCard>
          </View>
        ) : (
          <View style={[premiumStyles.block, { gap: 14 }]}>
            <Text style={styles.section}>Assigned campaigns</Text>
            {campaigns.length === 0 ? (
              <Text style={styles.emptyText}>No campaigns have selected you as supplier yet.</Text>
            ) : (
              <View style={{ gap: 10 }}>
                {campaigns.map((c) => {
                  const pendingDecision = ["DRAFT", "CHANGES_REQUIRED"].includes(c.status) && !c.supplierCommitted && !c.supplierDeclinedAt;
                  const canPostUpdate = UPDATE_POSTABLE_STATUSES.includes(c.status);
                  return (
                    <FloatingCard key={c.id} style={{ gap: 6 }}>
                      <View style={styles.cardTop}>
                        <Text style={styles.cardTitle} numberOfLines={1}>{c.title}</Text>
                        <StatusPill label={CAMPAIGN_STATUS_LABELS[c.status]} tone={CAMPAIGN_STATUS_TONE[c.status]} />
                      </View>
                      <Text style={styles.cardMeta}>Organiser: {c.organiser?.user?.name ?? "Unknown"}</Text>
                      {c.description ? <Text style={styles.cardDescription}>{c.description}</Text> : null}
                      <Text style={styles.cardMeta}>Deadline: {formatDeadline(c.deadline)}</Text>
                      <Text style={styles.cardMeta}>
                        {c.confirmedShares} of {c.maximumShares} shares · minimum {c.minimumShares} to proceed
                      </Text>
                      <Text style={styles.cardMeta}>
                        {formatDisplayMoney(c.pricePerShareMinor / 100, c.currency, selectedCurrency)} per share
                      </Text>

                      {pendingDecision ? (
                        <>
                          <View style={styles.decisionRow}>
                            <TouchableOpacity
                              onPress={() => handleAcceptCampaign(c.id, c.title)}
                              disabled={committing === c.id || declining === c.id}
                              activeOpacity={0.88}
                              style={[styles.acceptBtn, { flex: 1, marginTop: 0 }]}
                            >
                              {committing === c.id ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.acceptBtnText}>Accept</Text>}
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => setShowDeclineFormId(showDeclineFormId === c.id ? null : c.id)}
                              disabled={committing === c.id || declining === c.id}
                              activeOpacity={0.88}
                              style={styles.declineBtn}
                            >
                              <Text style={styles.declineBtnText}>Decline</Text>
                            </TouchableOpacity>
                          </View>
                          {showDeclineFormId === c.id ? (
                            <View style={styles.inlineForm}>
                              <TextInput
                                style={[styles.input, styles.inputMultiline]}
                                placeholder="Why are you declining? (optional)"
                                placeholderTextColor="#8AA194"
                                value={declineReasonById[c.id] ?? ""}
                                onChangeText={(text) => setDeclineReasonById((prev) => ({ ...prev, [c.id]: text }))}
                                multiline
                              />
                              <Text style={styles.hint}>The organiser will be notified and will need to choose a different supplier.</Text>
                              <TouchableOpacity
                                onPress={() => {
                                  Alert.alert("Decline this campaign?", "The organiser will be notified and will need to pick a different supplier. This can't be undone.", [
                                    { text: "Keep reviewing", style: "cancel" },
                                    { text: "Decline", style: "destructive", onPress: () => void handleDeclineCampaign(c.id) },
                                  ]);
                                }}
                                disabled={declining === c.id}
                                activeOpacity={0.88}
                                style={styles.declineConfirmBtn}
                              >
                                {declining === c.id ? <ActivityIndicator size="small" color="#D6552F" /> : <Text style={styles.declineBtnText}>Confirm decline</Text>}
                              </TouchableOpacity>
                            </View>
                          ) : null}
                        </>
                      ) : c.supplierDeclinedAt ? (
                        <View style={styles.declinedRow}>
                          <Ionicons name="close-circle-outline" size={14} color="#6A7B72" />
                          <Text style={styles.declinedText}>You declined this campaign{c.supplierDeclineReason ? `: ${c.supplierDeclineReason}` : ""}</Text>
                        </View>
                      ) : c.supplierCommitted ? (
                        <View style={styles.committedRow}>
                          <Ionicons name="checkmark-circle" size={14} color="#076B51" />
                          <Text style={styles.committedText}>You've accepted this campaign</Text>
                        </View>
                      ) : null}

                      {["FULFILLING", "SUCCEEDED", "COMPLETED"].includes(c.status) ? (
                        <TouchableOpacity
                          onPress={() => router.push({ pathname: "/(vendor)/community-buy-supplier-fulfilment", params: { id: c.id } } as any)}
                          activeOpacity={0.88}
                          style={styles.acceptBtn}
                        >
                          <Text style={styles.acceptBtnText}>Manage fulfilment</Text>
                        </TouchableOpacity>
                      ) : null}

                      {canPostUpdate ? (
                        <View style={{ marginTop: 4 }}>
                          <TouchableOpacity onPress={() => setShowUpdateFormId(showUpdateFormId === c.id ? null : c.id)} activeOpacity={0.85}>
                            <Text style={styles.linkText}>{showUpdateFormId === c.id ? "Cancel" : "Post an update to participants"}</Text>
                          </TouchableOpacity>
                          {showUpdateFormId === c.id ? (
                            <View style={styles.inlineForm}>
                              <TextInput
                                style={styles.input}
                                placeholder="e.g. Dispatching Thursday"
                                placeholderTextColor="#8AA194"
                                value={updateTitleById[c.id] ?? ""}
                                onChangeText={(text) => setUpdateTitleById((prev) => ({ ...prev, [c.id]: text }))}
                                maxLength={140}
                              />
                              <TextInput
                                style={[styles.input, styles.inputMultiline]}
                                placeholder="What do participants need to know?"
                                placeholderTextColor="#8AA194"
                                value={updateMessageById[c.id] ?? ""}
                                onChangeText={(text) => setUpdateMessageById((prev) => ({ ...prev, [c.id]: text }))}
                                multiline
                                maxLength={2000}
                              />
                              <Text style={styles.hint}>Every participant is notified.</Text>
                              <TouchableOpacity onPress={() => void handlePostUpdate(c.id)} disabled={postingUpdate === c.id} activeOpacity={0.88} style={styles.acceptBtn}>
                                {postingUpdate === c.id ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.acceptBtnText}>Post update</Text>}
                              </TouchableOpacity>
                            </View>
                          ) : null}
                        </View>
                      ) : null}
                    </FloatingCard>
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
  introTitle: { fontSize: 16, fontFamily: "Manrope-Bold", color: "#151E1B" },
  introBody: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#6A7B72", textAlign: "center", lineHeight: 19 },
  applyRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  applyRowText: { fontSize: 13, fontFamily: "Manrope-SemiBold", color: "#151E1B" },
  errorText: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#D6552F", textAlign: "center" },
  emptyText: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#6A7B72", textAlign: "center", paddingVertical: 8 },
  section: { fontSize: 15, fontFamily: "Manrope-ExtraBold", color: "#12221A" },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  cardTitle: { flex: 1, fontSize: 14, fontFamily: "Manrope-Bold", color: "#151E1B" },
  cardDescription: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#4A5A52", lineHeight: 17 },
  cardMeta: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#6A7B72" },
  acceptBtn: { minHeight: 42, borderRadius: 12, backgroundColor: "#076B51", alignItems: "center", justifyContent: "center", marginTop: 6 },
  acceptBtnText: { fontSize: 12, fontFamily: "Manrope-Bold", color: "#FFFFFF" },
  committedRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  committedText: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#076B51" },
  declinedRow: { flexDirection: "row", alignItems: "flex-start", gap: 6, marginTop: 4 },
  declinedText: { flex: 1, fontSize: 12, fontFamily: "Outfit-Regular", color: "#6A7B72", lineHeight: 16 },
  decisionRow: { flexDirection: "row", gap: 8, marginTop: 6 },
  declineBtn: { flex: 1, minHeight: 42, borderRadius: 12, borderWidth: 1, borderColor: "#D6552F", alignItems: "center", justifyContent: "center" },
  declineBtnText: { fontSize: 12, fontFamily: "Manrope-Bold", color: "#D6552F" },
  declineConfirmBtn: { minHeight: 42, borderRadius: 12, borderWidth: 1, borderColor: "#D6552F", alignItems: "center", justifyContent: "center" },
  inlineForm: { gap: 8, marginTop: 6, borderTopWidth: 1, borderTopColor: "#F0F0F0", paddingTop: 10 },
  input: { backgroundColor: "#F4F6F5", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 13, fontFamily: "Outfit-Regular", color: "#151E1B" },
  inputMultiline: { minHeight: 60, textAlignVertical: "top" },
  hint: { fontSize: 11, fontFamily: "Outfit-Regular", color: "#8AA194" },
  linkText: { fontSize: 12, fontFamily: "Manrope-SemiBold", color: "#076B51" },
});
