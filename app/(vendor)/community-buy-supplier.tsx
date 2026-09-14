import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Linking, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
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
  RangeProgressBar,
  StatusPill,
  premiumStyles,
  type Tone,
} from "../../components/shared/PremiumBlocks";
import {
  communityBuyService,
  CAMPAIGN_STATUS_LABELS,
  CAMPAIGN_STATUS_TONE,
  SUPPLIER_ACCOUNT_STATE_LABELS,
  type Campaign,
  type MarketConfig,
  type SupplierAccount,
  type SupplierAccountState,
} from "../../services/communityBuyService";
import { countryDisplayName } from "../../utils/countries";

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

const UPDATE_POSTABLE_STATUSES = ["LIVE", "PAUSED", "RESCUE_WINDOW", "SUCCEEDED", "FAILED", "REFUNDING", "FULFILLING", "COMPLETED"];

// Mirrors the backend's SUPPLIER_RESPONSE_STATUSES (community-campaigns.service.ts) —
// client-corrected flow: a supplier can accept or decline at any point up
// to the campaign closing out, not only while it's still in draft/review.
const SUPPLIER_RESPONSE_STATUSES = ["DRAFT", "CHANGES_REQUIRED", "UNDER_REVIEW", "APPROVED", "LIVE", "PAUSED", "RESCUE_WINDOW"];

// Workstream 3 — every state that still shows the campaign dashboard (the
// account has, at some point, been approved and isn't currently blocked).
// PAUSED/RESTRICTED both keep existing obligations visible (restriction
// only closes the door to new work) — SUSPENDED/CLOSED do not.
const DASHBOARD_VISIBLE_STATES: SupplierAccountState[] = ["APPROVED", "PAUSED", "RESTRICTED"];

// Community Buy Workstream 2: a campaign's deadline is nullable while
// still a draft — a supplier can be invited to (and see) a campaign
// before the organiser has finished the wizard (SUPPLIER_RESPONSE_
// STATUSES includes DRAFT/CHANGES_REQUIRED). `new Date(null)` silently
// resolves to the 1970 epoch rather than an invalid date, so the null
// check must come before constructing the Date, not rely on NaN alone.
function formatDeadline(value: string | null | undefined): string {
  if (!value) return "Not yet set";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export default function VendorCommunityBuySupplierScreen() {
  const router = useRouter();
  const { selectedCurrency } = useCurrencyStore();

  const [account, setAccount] = useState<SupplierAccount | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [markets, setMarkets] = useState<MarketConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Onboarding form (Workstream 3 — mandate item 2: real requirements, not
  // a one-tap "Apply for {country}") — country + categories + coverage.
  const [formCountry, setFormCountry] = useState<string | null>(null);
  const [formCategories, setFormCategories] = useState("");
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState("");

  const [connectingPayouts, setConnectingPayouts] = useState(false);

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
      const [profileData, marketList] = await Promise.all([
        communityBuyService.getMySupplierProfile(),
        communityBuyService.listMarketConfigs().catch(() => [] as MarketConfig[]),
      ]);
      setAccount(profileData.account);
      // Workstream 3 fix: this used to also require the caller to already
      // have a Vendor with an active market assignment before ANY market
      // would show at all — exactly the no-Vendor-required onboarding this
      // workstream exists to fix. Every market open for supplier
      // applications is offered; the backend re-validates on submit.
      setMarkets(marketList.filter((m) => m.supplierApplicationsEnabled));
      if (profileData.account && DASHBOARD_VISIBLE_STATES.includes(profileData.account.supplierState)) {
        setCampaigns(await communityBuyService.listMySupplierCampaigns());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load your supplier status.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusRefresh(load);

  const handleApply = async () => {
    if (!formCountry) {
      setApplyError("Choose a market first.");
      return;
    }
    setApplying(true);
    setApplyError("");
    try {
      const categories = formCategories.split(",").map((c) => c.trim()).filter(Boolean);
      setAccount(await communityBuyService.applyAsSupplier({ country: formCountry, categories, coverageRegions: [formCountry] }));
    } catch (err) {
      setApplyError(err instanceof Error ? err.message : "Could not submit your application.");
    } finally {
      setApplying(false);
    }
  };

  const handleConnectPayouts = async () => {
    setConnectingPayouts(true);
    try {
      const { onboardingUrl } = await communityBuyService.onboardSupplierStripeConnect();
      await Linking.openURL(onboardingUrl);
    } catch (err) {
      Alert.alert("Couldn't start payout setup", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setConnectingPayouts(false);
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

  const renderApplicationForm = (intro: { title: string; body: string; icon: IoniconName; tone: Tone }) => (
    <View style={[premiumStyles.block, { gap: 12 }]}>
      <FloatingCard style={styles.introCard}>
        <IconAvatar icon={intro.icon} tone={intro.tone} size={52} />
        <Text style={styles.introTitle}>{intro.title}</Text>
        <Text style={styles.introBody}>{intro.body}</Text>
      </FloatingCard>
      {markets.length === 0 ? (
        <Text style={styles.emptyText}>Supplier applications aren't open in any market yet.</Text>
      ) : (
        <FloatingCard style={{ gap: 10 }}>
          <Text style={styles.formLabel}>Market</Text>
          <View style={{ gap: 8 }}>
            {markets.map((m) => (
              <TouchableOpacity
                key={m.countryCode}
                onPress={() => setFormCountry(m.countryCode)}
                activeOpacity={0.85}
                accessibilityRole="radio"
                accessibilityState={{ selected: formCountry === m.countryCode }}
              >
                <View style={[styles.applyRow, formCountry === m.countryCode && styles.applyRowActive]}>
                  <Text style={styles.applyRowText}>{countryDisplayName(m.countryCode)}</Text>
                  <Ionicons name={formCountry === m.countryCode ? "radio-button-on" : "radio-button-off"} size={18} color={formCountry === m.countryCode ? "#076B51" : "#C7D2CB"} />
                </View>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.formLabel}>Categories you can supply</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Rice, Oil, Household staples"
            placeholderTextColor="#8AA194"
            value={formCategories}
            onChangeText={setFormCategories}
            accessibilityLabel="Categories, comma separated"
          />
          <Text style={styles.hint}>Comma-separated. An admin reviews every application before you can be selected for a campaign.</Text>
          {applyError ? <Text style={styles.errorText}>{applyError}</Text> : null}
          <TouchableOpacity
            onPress={() => void handleApply()}
            disabled={applying || !formCountry}
            activeOpacity={0.88}
            style={[styles.acceptBtn, (applying || !formCountry) && { opacity: 0.6 }]}
            accessibilityRole="button"
            accessibilityLabel="Submit application"
            accessibilityState={{ busy: applying, disabled: applying || !formCountry }}
          >
            {applying ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.acceptBtnText}>Submit application</Text>}
          </TouchableOpacity>
        </FloatingCard>
      )}
    </View>
  );

  const renderInfoState = (intro: { title: string; body: string; icon: IoniconName; tone: Tone }) => (
    <View style={premiumStyles.block}>
      <FloatingCard style={styles.introCard}>
        <IconAvatar icon={intro.icon} tone={intro.tone} size={52} />
        <Text style={styles.introTitle}>{intro.title}</Text>
        <Text style={styles.introBody}>{intro.body}</Text>
      </FloatingCard>
    </View>
  );

  const renderByState = () => {
    const state = account?.supplierState ?? "NOT_STARTED";
    switch (state) {
      case "NOT_STARTED":
      case "DRAFT":
        return renderApplicationForm({
          icon: "people-circle-outline",
          tone: "success",
          title: "Become a Community Buy supplier",
          body: "Suppliers fulfil bulk orders raised by organisers in your market. No store or Vendor account is required — an admin reviews every application.",
        });
      case "VERIFICATION_REQUIRED":
        return renderApplicationForm({
          icon: "shield-checkmark-outline",
          tone: "info",
          title: "Verification required",
          body: "A few more details are needed before your application can be reviewed.",
        });
      case "INFORMATION_REQUIRED":
        return (
          <View style={{ gap: 12 }}>
            {renderInfoState({
              icon: "alert-circle-outline",
              tone: "warning",
              title: "More information needed",
              body: account?.reasonCode ?? "Eki needs more information before your application can proceed. Update and resubmit below.",
            })}
            {renderApplicationForm({
              icon: "create-outline",
              tone: "warning",
              title: "Update your application",
              body: "Resubmit with the requested details.",
            })}
          </View>
        );
      case "UNDER_REVIEW":
        return renderInfoState({
          icon: "time-outline",
          tone: "warning",
          title: "Application under review",
          body: "Your Supplier Centre application is being reviewed. You'll be notified once organisers can select you for a campaign.",
        });
      case "SUSPENDED":
        return renderInfoState({
          icon: "close-circle-outline",
          tone: "error",
          title: "Supplier account suspended",
          body: account?.reasonCode ?? "Your supplier account has been suspended. Contact Eki support for details.",
        });
      case "CLOSED":
        return renderInfoState({
          icon: "lock-closed-outline",
          tone: "neutral",
          title: "Supplier account closed",
          body: "This supplier account is closed.",
        });
      case "APPROVED":
      case "PAUSED":
      case "RESTRICTED":
        return (
          <View style={[premiumStyles.block, { gap: 14 }]}>
            {state === "PAUSED" ? (
              <FloatingCard style={styles.bannerCard}>
                <Ionicons name="pause-circle-outline" size={18} color="#B7791F" />
                <Text style={styles.bannerText}>Your supplier account is paused{account?.reasonCode ? `: ${account.reasonCode}` : ""}. New campaign assignments are on hold.</Text>
              </FloatingCard>
            ) : null}
            {state === "RESTRICTED" ? (
              <FloatingCard style={styles.bannerCard}>
                <Ionicons name="warning-outline" size={18} color="#D6552F" />
                <Text style={styles.bannerText}>Your supplier account is restricted{account?.reasonCode ? `: ${account.reasonCode}` : ""}. You can't take on new campaigns, but existing ones are unaffected.</Text>
              </FloatingCard>
            ) : null}
            {!account?.payoutsEnabled ? (
              <FloatingCard style={styles.bannerCard}>
                <Ionicons name="card-outline" size={18} color="#076B51" />
                <View style={{ flex: 1, gap: 6 }}>
                  <Text style={styles.bannerText}>Set up payouts to receive settlement for your campaigns.</Text>
                  <TouchableOpacity
                    onPress={() => void handleConnectPayouts()}
                    disabled={connectingPayouts}
                    activeOpacity={0.88}
                    style={[styles.acceptBtn, { marginTop: 0 }]}
                    accessibilityRole="button"
                    accessibilityLabel="Set up payouts"
                    accessibilityState={{ busy: connectingPayouts, disabled: connectingPayouts }}
                  >
                    {connectingPayouts ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.acceptBtnText}>Set up payouts</Text>}
                  </TouchableOpacity>
                </View>
              </FloatingCard>
            ) : null}

            <Text style={styles.section}>Assigned campaigns</Text>
            {campaigns.length === 0 ? (
              <Text style={styles.emptyText}>No campaigns have selected you as supplier yet.</Text>
            ) : (
              <View style={{ gap: 10 }}>
                {campaigns.map((c) => {
                  const pendingDecision = SUPPLIER_RESPONSE_STATUSES.includes(c.status) && !c.supplierCommitted && !c.supplierDeclinedAt;
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
                      {["LIVE", "PAUSED", "RESCUE_WINDOW", "UNDER_REVIEW", "APPROVED"].includes(c.status) ? (
                        <RangeProgressBar value={c.confirmedShares} min={c.minimumShares!} goal={c.goalShares!} max={c.maximumShares!} />
                      ) : null}
                      <Text style={styles.cardMeta}>
                        {c.maximumShares != null && c.minimumShares != null
                          ? `${c.confirmedShares} of ${c.maximumShares} shares · minimum ${c.minimumShares} to proceed`
                          : "Quantities not yet set by the organiser"}
                      </Text>
                      <Text style={styles.cardMeta}>
                        {c.pricePerShareMinor != null && c.currency
                          ? `${formatDisplayMoney(c.pricePerShareMinor / 100, c.currency, selectedCurrency)} per share`
                          : "Price not yet set by the organiser"}
                      </Text>

                      {pendingDecision ? (
                        <>
                          <View style={styles.decisionRow}>
                            <TouchableOpacity
                              onPress={() => handleAcceptCampaign(c.id, c.title)}
                              disabled={committing === c.id || declining === c.id}
                              activeOpacity={0.88}
                              style={[styles.acceptBtn, { flex: 1, marginTop: 0 }]}
                              accessibilityRole="button"
                              accessibilityLabel="Accept"
                              accessibilityState={{ busy: committing === c.id, disabled: committing === c.id || declining === c.id }}
                            >
                              {committing === c.id ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.acceptBtnText}>Accept</Text>}
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => setShowDeclineFormId(showDeclineFormId === c.id ? null : c.id)}
                              disabled={committing === c.id || declining === c.id}
                              activeOpacity={0.88}
                              style={styles.declineBtn}
                              accessibilityRole="button"
                              accessibilityLabel="Decline"
                              accessibilityState={{ disabled: committing === c.id || declining === c.id, expanded: showDeclineFormId === c.id }}
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
                                accessibilityLabel="Reason for declining"
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
                                accessibilityRole="button"
                                accessibilityLabel="Confirm decline"
                                accessibilityState={{ busy: declining === c.id, disabled: declining === c.id }}
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
                          accessibilityRole="button"
                          accessibilityLabel="Manage fulfilment"
                        >
                          <Text style={styles.acceptBtnText}>Manage fulfilment</Text>
                        </TouchableOpacity>
                      ) : null}

                      {canPostUpdate ? (
                        <View style={{ marginTop: 4 }}>
                          <TouchableOpacity
                            onPress={() => setShowUpdateFormId(showUpdateFormId === c.id ? null : c.id)}
                            activeOpacity={0.85}
                            accessibilityRole="button"
                            accessibilityLabel={showUpdateFormId === c.id ? "Cancel" : "Post an update to participants"}
                            accessibilityState={{ expanded: showUpdateFormId === c.id }}
                          >
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
                                accessibilityLabel="Update title"
                              />
                              <TextInput
                                style={[styles.input, styles.inputMultiline]}
                                placeholder="What do participants need to know?"
                                placeholderTextColor="#8AA194"
                                value={updateMessageById[c.id] ?? ""}
                                onChangeText={(text) => setUpdateMessageById((prev) => ({ ...prev, [c.id]: text }))}
                                multiline
                                maxLength={2000}
                                accessibilityLabel="Update message"
                              />
                              <Text style={styles.hint}>Every participant is notified.</Text>
                              <TouchableOpacity
                                onPress={() => void handlePostUpdate(c.id)}
                                disabled={postingUpdate === c.id}
                                activeOpacity={0.88}
                                style={styles.acceptBtn}
                                accessibilityRole="button"
                                accessibilityLabel="Post update"
                                accessibilityState={{ busy: postingUpdate === c.id, disabled: postingUpdate === c.id }}
                              >
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
        );
      default:
        return renderInfoState({ icon: "help-circle-outline", tone: "info", title: SUPPLIER_ACCOUNT_STATE_LABELS[state], body: "" });
    }
  };

  return (
    <View style={premiumStyles.page}>
      <PremiumHeader title="Community Buy" subtitle="Supplier dashboard" onBack={() => goBackOrReplace(router, "/(vendor)" as any)} />

      <ScrollView style={{ flex: 1 }} contentContainerStyle={[premiumStyles.scrollContent, { paddingTop: 18 }]} showsVerticalScrollIndicator={false}>
        {loading ? <LoadingBlock /> : error ? (
          <View style={premiumStyles.block}><ErrorState message={error} onRetry={() => void load()} /></View>
        ) : renderByState()}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  introCard: { alignItems: "center", gap: 8 },
  introTitle: { fontSize: 16, fontFamily: "Manrope-Bold", color: "#151E1B" },
  introBody: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#6A7B72", textAlign: "center", lineHeight: 19 },
  applyRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1.5, borderColor: "transparent", backgroundColor: "#F4F6F5", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 },
  applyRowActive: { borderColor: "#076B51" },
  applyRowText: { fontSize: 13, fontFamily: "Manrope-SemiBold", color: "#151E1B" },
  formLabel: { fontSize: 12, fontFamily: "Manrope-Bold", color: "#4A5A52" },
  bannerCard: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  bannerText: { flex: 1, fontSize: 12, fontFamily: "Outfit-Regular", color: "#4A5A52", lineHeight: 17 },
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
