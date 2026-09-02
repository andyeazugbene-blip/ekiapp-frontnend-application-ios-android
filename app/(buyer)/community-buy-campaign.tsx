import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, Share, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { goBackOrReplace } from "../../utils/navigation";
import { formatDisplayMoney } from "../../utils/currency";
import { useCurrencyStore } from "../../stores/currencyStore";
import { presentPayment } from "../../services/stripePayment";
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

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError("");
    try {
      setCampaign(await communityBuyService.getCampaign(id));
      setUpdates(await communityBuyService.getCampaignUpdates(id).catch(() => []));
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

  const handleContribute = async () => {
    const value = Math.round(Number(quantity));
    if (!Number.isFinite(value) || value <= 0) {
      setContributeError("Enter a valid number of shares.");
      return;
    }
    setContributing(true);
    setContributeError("");
    try {
      const { contributionId, clientSecret } = await communityBuyService.createContribution(id, value);
      const result = await presentPayment({ clientSecret, merchantDisplayName: "Eki Community Buy" });
      if (result.status === "succeeded") {
        const confirmed = await communityBuyService.confirmContributionPayment(contributionId);
        setContribution(confirmed);
        setJoined(true);
        await load();
      } else if (result.status !== "cancelled") {
        setContributeError(result.message ?? "Payment failed.");
      }
    } catch (err) {
      setContributeError(err instanceof Error ? err.message : "Could not start your contribution.");
    } finally {
      setContributing(false);
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
              <Text style={styles.outcomeText}>This campaign did not reach its minimum. No supplier order will be created — an individual refund is being created for every eligible confirmed contribution.</Text>
            </FloatingCard>
          ) : campaign.status === "REFUNDING" ? (
            <FloatingCard style={[styles.outcomeCard, styles.outcomeCardWarning]}>
              <Ionicons name="return-down-back-outline" size={20} color="#B48A00" />
              <Text style={styles.outcomeText}>Your refund is being processed.</Text>
            </FloatingCard>
          ) : campaign.status === "CANCELLED" ? (
            <FloatingCard style={[styles.outcomeCard, styles.outcomeCardError]}>
              <Ionicons name="return-down-back-outline" size={20} color="#D6552F" />
              <Text style={styles.outcomeText}>This campaign was ended. Any contribution you made is being refunded.</Text>
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
                    <Text style={styles.outcomeText}>Your contribution of {formatDisplayMoney(contribution.amount / 100, contribution.currency, selectedCurrency)} for {contribution.quantity} share{contribution.quantity === 1 ? "" : "s"} is confirmed.</Text>
                    <TouchableOpacity onPress={() => setShowReceipt((v) => !v)} activeOpacity={0.85}>
                      <Text style={styles.receiptToggle}>{showReceipt ? "Hide receipt" : "View receipt"}</Text>
                    </TouchableOpacity>
                    {showReceipt ? (
                      <View style={styles.receiptCard}>
                        <View style={styles.receiptRow}><Text style={styles.receiptLabel}>Campaign</Text><Text style={styles.receiptValue} numberOfLines={1}>{campaign.title}</Text></View>
                        <View style={styles.receiptRow}><Text style={styles.receiptLabel}>Shares</Text><Text style={styles.receiptValue}>{contribution.quantity}</Text></View>
                        <View style={styles.receiptRow}><Text style={styles.receiptLabel}>Price per share</Text><Text style={styles.receiptValue}>{formatDisplayMoney(campaign.pricePerShareMinor / 100, campaign.currency, selectedCurrency)}</Text></View>
                        <View style={styles.receiptRow}><Text style={styles.receiptLabel}>Total paid</Text><Text style={styles.receiptValue}>{formatDisplayMoney(contribution.amount / 100, contribution.currency, selectedCurrency)}</Text></View>
                        <View style={styles.receiptRow}><Text style={styles.receiptLabel}>Date</Text><Text style={styles.receiptValue}>{formatDateTime(contribution.createdAt)}</Text></View>
                        <View style={styles.receiptRow}><Text style={styles.receiptLabel}>Reference</Text><Text style={styles.receiptValue} numberOfLines={1}>{contribution.id}</Text></View>
                      </View>
                    ) : null}
                  </View>
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
                    <Text style={styles.fieldLabel}>Subtotal</Text>
                    <Text style={styles.progressMetaText}>{formatDisplayMoney(subtotal / 100, campaign.currency, selectedCurrency)}</Text>
                  </View>
                  {contributeError ? <Text style={styles.errorText}>{contributeError}</Text> : null}
                  <TouchableOpacity onPress={handleContribute} disabled={contributing} activeOpacity={0.88} style={[styles.primaryBtn, contributing && { opacity: 0.7 }]}>
                    {contributing ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.primaryBtnText}>Continue</Text>}
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
                    <Text style={styles.updateTitle}>{u.title}</Text>
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
  reportIssueRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 14 },
  reportIssueText: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#6A7B72" },
});
