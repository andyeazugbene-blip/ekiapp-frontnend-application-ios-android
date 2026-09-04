import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, Share, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { goBackOrReplace } from "../../utils/navigation";
import { formatDisplayMoney } from "../../utils/currency";
import { useCurrencyStore } from "../../stores/currencyStore";
import { presentSetupIntent } from "../../services/stripePayment";
import {
  ErrorState,
  FloatingCard,
  LoadingBlock,
  PremiumHeader,
  RangeProgressBar,
  StatusPill,
  premiumStyles,
  type Tone,
} from "../../components/shared/PremiumBlocks";
import { communityBuyService, type Campaign, type CampaignUpdate, type Contribution } from "../../services/communityBuyService";
// The saved-card flow is generic (buyer/payment-methods), built for Regular
// Deliveries — reused as-is for Community Buy pledges rather than duplicated.
import { regularDeliveriesService, type BuyerPaymentMethod } from "../../services/regularDeliveriesService";

const STATUS_TONE: Record<Campaign["status"], Tone> = {
  DRAFT: "neutral",
  UNDER_REVIEW: "neutral",
  CHANGES_REQUIRED: "warning",
  APPROVED: "info",
  REJECTED: "error",
  LIVE: "success",
  PAUSED: "warning",
  RESCUE_WINDOW: "warning",
  SUCCEEDED: "success",
  FAILED: "warning",
  REFUNDING: "warning",
  FULFILLING: "success",
  COMPLETED: "success",
  FINANCIALLY_CLOSED: "neutral",
  CANCELLED: "error",
};

function formatDateTime(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function formatDeadline(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export default function CommunityBuyCampaignScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { selectedCurrency } = useCurrencyStore();

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);

  const [quantity, setQuantity] = useState("1");
  const [contributing, setContributing] = useState(false);
  const [contribution, setContribution] = useState<Contribution | null>(null);
  const [contributeError, setContributeError] = useState("");
  const [updates, setUpdates] = useState<CampaignUpdate[]>([]);
  const [showReceipt, setShowReceipt] = useState(false);

  const [paymentMethods, setPaymentMethods] = useState<BuyerPaymentMethod[]>([]);
  const [paymentMethodId, setPaymentMethodId] = useState<string | null>(null);
  const [addingCard, setAddingCard] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError("");
    try {
      setCampaign(await communityBuyService.getCampaign(id));
      setUpdates(await communityBuyService.getCampaignUpdates(id).catch(() => []));
      const [methods, mine] = await Promise.all([
        regularDeliveriesService.listPaymentMethods().catch(() => [] as BuyerPaymentMethod[]),
        communityBuyService.listMyContributions().catch(() => []),
      ]);
      setPaymentMethods(methods);
      setPaymentMethodId((prev) => prev ?? methods.find((m) => m.isDefault)?.id ?? methods[0]?.id ?? null);
      // Surfaces this buyer's existing pledge for this specific campaign on
      // revisit — otherwise PAID/CHARGE_FAILED (which only resolve after the
      // campaign closes, days after the pledge screen was last open) would
      // never be shown.
      const mineForCampaign = mine.find((m) => m.campaign.id === id);
      if (mineForCampaign?.latestContribution) {
        setContribution(mineForCampaign.latestContribution);
        setJoined(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load this campaign.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleShare = async () => {
    if (!campaign) return;
    try {
      await Share.share({
        message: `Join "${campaign.title}" on Eki Community Buy — ${campaign.confirmedShares} of ${campaign.maximumShares} slots filled. Open the Eki app to take part.`,
      });
    } catch {
      // User cancelled the native share sheet — nothing to do.
    }
  };

  const handleJoin = async () => {
    setJoining(true);
    try {
      await communityBuyService.joinCampaign(id);
      setJoined(true);
    } catch (err) {
      Alert.alert("Couldn't join", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setJoining(false);
    }
  };

  const handleAddCard = async () => {
    setAddingCard(true);
    try {
      const { clientSecret } = await regularDeliveriesService.createSetupIntent();
      const result = await presentSetupIntent({ clientSecret });
      if (result.status === "succeeded") {
        // The client only confirms the SetupIntent completed — the backend
        // re-verifies it server-side before actually saving the card.
        const setupIntentId = clientSecret.split("_secret_")[0];
        await regularDeliveriesService.confirmSetupIntent(setupIntentId);
        const methods = await regularDeliveriesService.listPaymentMethods();
        setPaymentMethods(methods);
        setPaymentMethodId(methods.find((m) => m.isDefault)?.id ?? methods[0]?.id ?? null);
      } else if (result.status !== "cancelled") {
        Alert.alert("Could not save card", result.message ?? "Please try again.");
      }
    } catch (err) {
      Alert.alert("Could not save card", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setAddingCard(false);
    }
  };

  /**
   * PLEDGE_THEN_CHARGE (client mandate 2026-09): this only saves a pledge
   * against an already-collected payment method. No charge happens now —
   * the amount is only captured later if the campaign actually succeeds.
   */
  const handleContribute = async () => {
    // Re-entrancy guard — the backend has no unique constraint preventing
    // the same user from pledging twice to the same campaign (contributions
    // are deliberately independent rows), so a double-tap race here is the
    // one thing currently stopping a real duplicate pledge, not just a UX nicety.
    if (contributing) return;
    const value = Math.round(Number(quantity));
    if (!Number.isFinite(value) || value <= 0) {
      setContributeError("Enter a valid number of shares.");
      return;
    }
    if (!paymentMethodId) {
      setContributeError("Add a payment method to continue.");
      return;
    }
    setContributing(true);
    setContributeError("");
    try {
      const pledge = await communityBuyService.pledgeContribution(id, value, paymentMethodId);
      const full = await communityBuyService.getContribution(pledge.contributionId);
      setContribution(full);
      setJoined(true);
      await load();
    } catch (err) {
      setContributeError(err instanceof Error ? err.message : "Could not record your pledge.");
    } finally {
      setContributing(false);
    }
  };

  const handleRetryCharge = async () => {
    if (!contribution || retrying) return;
    setRetrying(true);
    try {
      const updated = await communityBuyService.retryContributionCharge(contribution.id);
      setContribution(updated);
    } catch (err) {
      Alert.alert("Could not retry payment", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setRetrying(false);
    }
  };

  if (loading) {
    return (
      <View style={premiumStyles.page}>
        <PremiumHeader title="Campaign" onBack={() => goBackOrReplace(router, "/(buyer)/community-buy" as any)} />
        <LoadingBlock />
      </View>
    );
  }

  if (error || !campaign) {
    return (
      <View style={premiumStyles.page}>
        <PremiumHeader title="Campaign" onBack={() => goBackOrReplace(router, "/(buyer)/community-buy" as any)} />
        <View style={premiumStyles.block}>
          <ErrorState message={error || "This campaign is not available."} onRetry={() => void load()} />
        </View>
      </View>
    );
  }

  const isLive = campaign.status === "LIVE";
  const remaining = Math.max(0, campaign.minimumShares - campaign.confirmedShares);
  const minimumReached = campaign.confirmedShares >= campaign.minimumShares;
  const remainingCapacity = Math.max(0, campaign.maximumShares - campaign.confirmedShares);
  const subtotal = (Math.round(Number(quantity)) || 0) * campaign.pricePerShareMinor;

  return (
    <View style={premiumStyles.page}>
      <PremiumHeader
        title={campaign.title}
        subtitle={`Supplied by ${campaign.supplier?.vendor?.storeName ?? "a verified supplier"}`}
        onBack={() => goBackOrReplace(router, "/(buyer)/community-buy" as any)}
        right={
          <TouchableOpacity onPress={() => void handleShare()} activeOpacity={0.85} style={styles.headerIconBtn}>
            <Ionicons name="share-social-outline" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        }
      />

      <ScrollView style={{ flex: 1 }} contentContainerStyle={[premiumStyles.scrollContent, { paddingTop: 18 }]} showsVerticalScrollIndicator={false}>
        <View style={[premiumStyles.block, { gap: 14 }]}>
          <FloatingCard style={{ gap: 10 }}>
            <View style={styles.statusRow}>
              <View style={styles.countryPill}><Text style={styles.countryPillText}>{campaign.country}</Text></View>
              <StatusPill label={campaign.status.replace("_", " ")} tone={STATUS_TONE[campaign.status]} />
            </View>
            {campaign.description ? <Text style={styles.description}>{campaign.description}</Text> : null}

            <RangeProgressBar value={campaign.confirmedShares} min={campaign.minimumShares} goal={campaign.goalShares} max={campaign.maximumShares} />
            <Text style={styles.progressMetaText}>{campaign.confirmedShares} of {campaign.maximumShares} slots filled</Text>
            {!minimumReached ? (
              <Text style={styles.progressMetaSub}>Only {remaining} more needed for this campaign to proceed.</Text>
            ) : (
              <Text style={[styles.progressMetaSub, { color: "#076B51" }]}>This campaign will now proceed. {remainingCapacity} additional slot{remainingCapacity === 1 ? "" : "s"} remain available.</Text>
            )}
            <View style={styles.progressMetaRow}>
              <Text style={styles.progressMetaSub}>Closes {formatDeadline(campaign.deadline)}</Text>
            </View>
          </FloatingCard>

          {campaign.status === "FULFILLING" || campaign.status === "SUCCEEDED" || campaign.status === "COMPLETED" ? (
            <FloatingCard style={styles.outcomeCard}>
              <Ionicons name="checkmark-circle-outline" size={20} color="#076B51" />
              <Text style={styles.outcomeText}>
                {campaign.fundingOutcome === "GOAL_REACHED"
                  ? "This campaign reached its goal. Fulfilment updates will be shared with participants."
                  : "This campaign will proceed — the supplier-approved minimum was reached. Fulfilment updates will be shared with participants."}
              </Text>
            </FloatingCard>
          ) : campaign.status === "RESCUE_WINDOW" ? (
            <FloatingCard style={[styles.outcomeCard, styles.outcomeCardWarning]}>
              <Ionicons name="time-outline" size={20} color="#B48A00" />
              <Text style={styles.outcomeText}>This campaign has not reached its minimum yet. The organiser has until the rescue deadline to complete the remaining requirement. No supplier order has been created and no additional payment is required from you.</Text>
            </FloatingCard>
          ) : campaign.status === "FAILED" ? (
            <FloatingCard style={[styles.outcomeCard, styles.outcomeCardWarning]}>
              <Ionicons name="time-outline" size={20} color="#B48A00" />
              <Text style={styles.outcomeText}>This campaign did not reach its minimum. No supplier order will be created — no participant was ever charged, so there is nothing to refund. Any saved pledge has been cancelled.</Text>
            </FloatingCard>
          ) : campaign.status === "REFUNDING" ? (
            <FloatingCard style={[styles.outcomeCard, styles.outcomeCardWarning]}>
              <Ionicons name="return-down-back-outline" size={20} color="#B48A00" />
              <Text style={styles.outcomeText}>Your refund is being processed.</Text>
            </FloatingCard>
          ) : campaign.status === "CANCELLED" ? (
            <FloatingCard style={[styles.outcomeCard, styles.outcomeCardError]}>
              <Ionicons name="return-down-back-outline" size={20} color="#D6552F" />
              <Text style={styles.outcomeText}>This campaign was ended. No participant was charged — any pledge you made has been cancelled.</Text>
            </FloatingCard>
          ) : null}

          {isLive ? (
            <>
              {!joined ? (
                <TouchableOpacity onPress={handleJoin} disabled={joining} activeOpacity={0.88} style={styles.secondaryBtn}>
                  {joining ? <ActivityIndicator size="small" color="#076B51" /> : <Text style={styles.secondaryBtnText}>Join this campaign</Text>}
                </TouchableOpacity>
              ) : null}

              <Text style={styles.section}>Choose your quantity</Text>
              {contribution?.status === "PAID" ? (
                <FloatingCard style={styles.outcomeCard}>
                  <Ionicons name="checkmark-circle-outline" size={20} color="#076B51" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.outcomeText}>Payment confirmed — this campaign succeeded, and your saved card was charged {formatDisplayMoney(contribution.amount / 100, contribution.currency, selectedCurrency)} for {contribution.quantity} share{contribution.quantity === 1 ? "" : "s"}.</Text>
                    <TouchableOpacity onPress={() => setShowReceipt((v) => !v)} activeOpacity={0.85}>
                      <Text style={styles.receiptToggle}>{showReceipt ? "Hide receipt" : "View receipt"}</Text>
                    </TouchableOpacity>
                    {showReceipt ? (
                      <View style={styles.receiptCard}>
                        <View style={styles.receiptRow}><Text style={styles.receiptLabel}>Campaign</Text><Text style={styles.receiptValue} numberOfLines={1}>{campaign.title}</Text></View>
                        <View style={styles.receiptRow}><Text style={styles.receiptLabel}>Shares</Text><Text style={styles.receiptValue}>{contribution.quantity}</Text></View>
                        <View style={styles.receiptRow}><Text style={styles.receiptLabel}>Price per share</Text><Text style={styles.receiptValue}>{formatDisplayMoney(campaign.pricePerShareMinor / 100, campaign.currency, selectedCurrency)}</Text></View>
                        <View style={styles.receiptRow}><Text style={styles.receiptLabel}>Total charged</Text><Text style={styles.receiptValue}>{formatDisplayMoney(contribution.amount / 100, contribution.currency, selectedCurrency)}</Text></View>
                        <View style={styles.receiptRow}><Text style={styles.receiptLabel}>Date</Text><Text style={styles.receiptValue}>{formatDateTime(contribution.createdAt)}</Text></View>
                        <View style={styles.receiptRow}><Text style={styles.receiptLabel}>Reference</Text><Text style={styles.receiptValue} numberOfLines={1}>{contribution.id}</Text></View>
                      </View>
                    ) : null}
                  </View>
                </FloatingCard>
              ) : contribution?.status === "PLEDGED" ? (
                <FloatingCard style={styles.outcomeCard}>
                  <Ionicons name="bookmark-outline" size={20} color="#076B51" />
                  <Text style={styles.outcomeText}>Pledge recorded — payment method saved for {contribution.quantity} share{contribution.quantity === 1 ? "" : "s"} ({formatDisplayMoney(contribution.amount / 100, contribution.currency, selectedCurrency)}). You will only be charged if this campaign succeeds. Awaiting campaign outcome.</Text>
                </FloatingCard>
              ) : contribution?.status === "PAYMENT_PROCESSING" ? (
                <FloatingCard style={styles.outcomeCard}>
                  <ActivityIndicator size="small" color="#076B51" />
                  <Text style={styles.outcomeText}>Payment pending — this campaign succeeded and we're collecting payment from your saved card now.</Text>
                </FloatingCard>
              ) : contribution?.status === "CHARGE_FAILED" ? (
                <FloatingCard style={[styles.outcomeCard, styles.outcomeCardWarning]}>
                  <Ionicons name="alert-circle-outline" size={20} color="#B48A00" />
                  <View style={{ flex: 1, gap: 8 }}>
                    <Text style={styles.outcomeText}>Payment failed — we couldn't collect payment for your pledge. Retry now or update your card to keep your place.</Text>
                    <TouchableOpacity onPress={() => void handleRetryCharge()} disabled={retrying} activeOpacity={0.88} style={[styles.primaryBtn, retrying && { opacity: 0.7 }]}>
                      {retrying ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.primaryBtnText}>Retry payment</Text>}
                    </TouchableOpacity>
                  </View>
                </FloatingCard>
              ) : contribution?.status === "CANCELLED" ? (
                <FloatingCard style={styles.outcomeCard}>
                  <Ionicons name="close-circle-outline" size={20} color="#6A7B72" />
                  <Text style={styles.outcomeText}>This pledge was cancelled — the campaign didn't proceed. Your saved payment method was never charged.</Text>
                </FloatingCard>
              ) : (
                <FloatingCard style={{ gap: 10 }}>
                  <Text style={styles.fieldLabel}>Price per share: {formatDisplayMoney(campaign.pricePerShareMinor / 100, campaign.currency, selectedCurrency)}</Text>
                  <View style={styles.quantityRow}>
                    <TouchableOpacity onPress={() => setQuantity(String(Math.max(1, (Number(quantity) || 1) - 1)))} activeOpacity={0.85} style={styles.stepperBtn}>
                      <Ionicons name="remove" size={18} color="#076B51" />
                    </TouchableOpacity>
                    <TextInput
                      style={styles.quantityInput}
                      placeholder="1"
                      placeholderTextColor="#8AA194"
                      keyboardType="number-pad"
                      value={quantity}
                      onChangeText={setQuantity}
                    />
                    <TouchableOpacity onPress={() => setQuantity(String(Math.min(remainingCapacity || 1, (Number(quantity) || 0) + 1)))} activeOpacity={0.85} style={styles.stepperBtn}>
                      <Ionicons name="add" size={18} color="#076B51" />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.progressMetaSub}>{remainingCapacity} share{remainingCapacity === 1 ? "" : "s"} remain available.</Text>
                  <View style={styles.progressMetaRow}>
                    <Text style={styles.fieldLabel}>Amount if this campaign succeeds</Text>
                    <Text style={styles.progressMetaText}>{formatDisplayMoney(subtotal / 100, campaign.currency, selectedCurrency)}</Text>
                  </View>

                  <Text style={styles.fieldLabel}>Payment method</Text>
                  <View style={{ gap: 8 }}>
                    {paymentMethods.map((m) => (
                      <TouchableOpacity key={m.id} onPress={() => setPaymentMethodId(m.id)} activeOpacity={0.85}>
                        <FloatingCard style={[styles.optionRow, paymentMethodId === m.id && styles.optionRowActive]}>
                          <Ionicons name={paymentMethodId === m.id ? "radio-button-on" : "radio-button-off"} size={18} color={paymentMethodId === m.id ? "#076B51" : "#C7D2CB"} />
                          <Text style={styles.optionTitle}>{(m.brand ?? "Card").toUpperCase()} •••• {m.last4}</Text>
                        </FloatingCard>
                      </TouchableOpacity>
                    ))}
                    <TouchableOpacity onPress={() => void handleAddCard()} disabled={addingCard} activeOpacity={0.85} style={styles.addRow}>
                      {addingCard ? <ActivityIndicator size="small" color="#076B51" /> : <Ionicons name="card-outline" size={18} color="#076B51" />}
                      <Text style={styles.addRowText}>{addingCard ? "Saving card..." : "Add a card"}</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.disclosureText}>Your card will not be charged now. It will only be charged {formatDisplayMoney(subtotal / 100, campaign.currency, selectedCurrency)} if this campaign reaches its minimum or goal.</Text>

                  {contributeError ? <Text style={styles.errorText}>{contributeError}</Text> : null}
                  <TouchableOpacity onPress={handleContribute} disabled={contributing} activeOpacity={0.88} style={[styles.primaryBtn, contributing && { opacity: 0.7 }]}>
                    {contributing ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.primaryBtnText}>Pledge — no charge now</Text>}
                  </TouchableOpacity>
                </FloatingCard>
              )}
            </>
          ) : null}

          {updates.length > 0 ? (
            <>
              <Text style={styles.section}>Campaign updates</Text>
              <View style={{ gap: 8 }}>
                {updates.map((u) => (
                  <FloatingCard key={u.id} style={{ gap: 3 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Text style={styles.updateTitle}>{u.title}</Text>
                      {u.authorRole === "ORGANISER" || u.authorRole === "SUPPLIER" ? (
                        <View style={styles.updateAuthorPill}>
                          <Text style={styles.updateAuthorPillText}>{u.authorRole === "ORGANISER" ? "Organiser" : "Supplier"}</Text>
                        </View>
                      ) : null}
                    </View>
                    {u.body ? <Text style={styles.updateBody}>{u.body}</Text> : null}
                    <Text style={styles.updateDate}>{formatDateTime(u.createdAt)}</Text>
                  </FloatingCard>
                ))}
              </View>
            </>
          ) : null}

          <TouchableOpacity
            onPress={() => router.push({ pathname: "/(buyer)/community-buy-support-cases", params: { campaignId: campaign.id, campaignTitle: campaign.title } } as any)}
            activeOpacity={0.85}
            style={styles.reportIssueRow}
          >
            <Ionicons name="flag-outline" size={16} color="#6A7B72" />
            <Text style={styles.reportIssueText}>Report an issue with this campaign</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  headerIconBtn: { width: 38, height: 38, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.14)", alignItems: "center", justifyContent: "center" },
  statusRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  countryPill: { backgroundColor: "#F4F6F5", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  countryPillText: { fontSize: 10, fontFamily: "Manrope-Bold", color: "#6A7B72" },
  description: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#4A5A52", lineHeight: 19 },
  progressMetaRow: { flexDirection: "row", justifyContent: "space-between" },
  progressMetaText: { fontSize: 13, fontFamily: "Manrope-Bold", color: "#151E1B" },
  progressMetaSub: { fontSize: 11, fontFamily: "Outfit-Regular", color: "#6A7B72" },
  outcomeCard: { flexDirection: "row", gap: 10, alignItems: "center", backgroundColor: "rgba(7,107,81,0.06)" },
  outcomeCardWarning: { backgroundColor: "rgba(255,197,0,0.10)" },
  outcomeCardError: { backgroundColor: "rgba(214,85,47,0.06)" },
  outcomeText: { flex: 1, fontSize: 12, fontFamily: "Outfit-Regular", color: "#151E1B", lineHeight: 17 },
  section: { fontSize: 15, fontFamily: "Manrope-ExtraBold", color: "#12221A", marginTop: 4 },
  fieldLabel: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#6A7B72" },
  quantityRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  stepperBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: "rgba(7,107,81,0.08)", alignItems: "center", justifyContent: "center" },
  quantityInput: { flex: 1, backgroundColor: "#F4F6F5", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, fontFamily: "Manrope-Bold", color: "#151E1B", textAlign: "center" },
  errorText: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#D6552F" },
  primaryBtn: { minHeight: 52, borderRadius: 14, backgroundColor: "#076B51", alignItems: "center", justifyContent: "center" },
  primaryBtnText: { fontSize: 14, fontFamily: "Manrope-Bold", color: "#FFFFFF" },
  secondaryBtn: { minHeight: 46, borderRadius: 14, borderWidth: 1, borderColor: "#076B51", alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF" },
  secondaryBtnText: { fontSize: 13, fontFamily: "Manrope-SemiBold", color: "#076B51" },
  receiptToggle: { fontSize: 12, fontFamily: "Manrope-SemiBold", color: "#076B51", marginTop: 6 },
  receiptCard: { marginTop: 8, backgroundColor: "#F4F6F5", borderRadius: 12, padding: 12, gap: 6 },
  receiptRow: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  receiptLabel: { fontSize: 11, fontFamily: "Outfit-Regular", color: "#6A7B72" },
  receiptValue: { flex: 1, fontSize: 12, fontFamily: "Manrope-SemiBold", color: "#151E1B", textAlign: "right" },
  updateTitle: { fontSize: 13, fontFamily: "Manrope-Bold", color: "#151E1B" },
  updateBody: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#4A5A52", lineHeight: 17 },
  updateDate: { fontSize: 11, fontFamily: "Outfit-Regular", color: "#8AA194", marginTop: 2 },
  updateAuthorPill: { backgroundColor: "#E7F0EB", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  updateAuthorPillText: { fontSize: 10, fontFamily: "Manrope-SemiBold", color: "#3A6B52" },
  reportIssueRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 14 },
  reportIssueText: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#6A7B72" },
  optionRow: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1.5, borderColor: "transparent" },
  optionRowActive: { borderColor: "#076B51" },
  optionTitle: { fontSize: 13, fontFamily: "Manrope-SemiBold", color: "#151E1B" },
  addRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6 },
  addRowText: { fontSize: 13, fontFamily: "Manrope-Bold", color: "#076B51" },
  disclosureText: { fontSize: 11, fontFamily: "Outfit-Regular", color: "#6A7B72", lineHeight: 16 },
});
