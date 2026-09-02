import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, Share, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { goBackOrReplace } from "../../utils/navigation";
import { formatDisplayMoney } from "../../utils/currency";
import { useCurrencyStore } from "../../stores/currencyStore";
import { presentPayment } from "../../services/stripePayment";
import { communityBuyService, type Campaign, type CampaignUpdate, type Contribution } from "../../services/communityBuyService";

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
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.placeholder}><ActivityIndicator color="#076B51" /></View>
      </SafeAreaView>
    );
  }

  if (error || !campaign) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => goBackOrReplace(router, "/(buyer)/community-buy" as any)} activeOpacity={0.85} style={styles.backButton}>
            <Ionicons name="arrow-back" size={20} color="#282828" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Campaign</Text>
          <View style={{ width: 38 }} />
        </View>
        <View style={styles.emptyState}>
          <Ionicons name="alert-circle-outline" size={28} color="#D6552F" />
          <Text style={styles.emptyText}>{error || "This campaign is not available."}</Text>
          <TouchableOpacity onPress={() => void load()} activeOpacity={0.86} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const pct = campaign.progressPct ?? 0;
  const isLive = campaign.status === "LIVE";
  const contributionCount = campaign.contributions?.length ?? 0;
  const remaining = Math.max(0, campaign.minimumShares - campaign.confirmedShares);
  const minimumReached = campaign.confirmedShares >= campaign.minimumShares;
  const remainingCapacity = Math.max(0, campaign.maximumShares - campaign.confirmedShares);
  const subtotal = (Math.round(Number(quantity)) || 0) * campaign.pricePerShareMinor;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => goBackOrReplace(router, "/(buyer)/community-buy" as any)} activeOpacity={0.85} style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color="#282828" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{campaign.title}</Text>
        <TouchableOpacity onPress={() => void handleShare()} activeOpacity={0.85} style={styles.backButton}>
          <Ionicons name="share-social-outline" size={18} color="#282828" />
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <View style={styles.statusRow}>
            <View style={styles.countryPill}><Text style={styles.countryPillText}>{campaign.country}</Text></View>
            <Text style={styles.statusText}>{campaign.status.replace("_", " ")}</Text>
          </View>
          <Text style={styles.title}>{campaign.title}</Text>
          <Text style={styles.vendor}>Supplied by {campaign.supplier?.vendor?.storeName ?? "a verified supplier"}</Text>
          {campaign.description ? <Text style={styles.description}>{campaign.description}</Text> : null}

          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.min(100, pct)}%` }]} />
          </View>
          <Text style={styles.progressMetaText}>{campaign.confirmedShares} of {campaign.maximumShares} slots filled</Text>
          {!minimumReached ? (
            <Text style={styles.progressMetaSub}>Only {remaining} more needed for this campaign to proceed.</Text>
          ) : (
            <Text style={[styles.progressMetaSub, { color: "#076B51" }]}>This campaign will now proceed. {remainingCapacity} additional slot{remainingCapacity === 1 ? "" : "s"} remain available.</Text>
          )}
          <View style={styles.progressMetaRow}>
            <Text style={styles.progressMetaSub}>Minimum {campaign.minimumShares} · Goal {campaign.goalShares}</Text>
            <Text style={styles.progressMetaSub}>Closes {formatDeadline(campaign.deadline)}</Text>
          </View>
        </View>

        {campaign.status === "FULFILLING" || campaign.status === "SUCCEEDED" || campaign.status === "COMPLETED" ? (
          <View style={styles.outcomeCard}>
            <Ionicons name="checkmark-circle-outline" size={20} color="#076B51" />
            <Text style={styles.outcomeText}>
              {campaign.fundingOutcome === "GOAL_REACHED"
                ? "This campaign reached its goal. Fulfilment updates will be shared with participants."
                : "This campaign will proceed — the supplier-approved minimum was reached. Fulfilment updates will be shared with participants."}
            </Text>
          </View>
        ) : campaign.status === "RESCUE_WINDOW" ? (
          <View style={[styles.outcomeCard, { backgroundColor: "rgba(255,197,0,0.12)" }]}>
            <Ionicons name="time-outline" size={20} color="#B48A00" />
            <Text style={styles.outcomeText}>This campaign has not reached its minimum yet. The organiser has until the rescue deadline to complete the remaining requirement. No supplier order has been created and no additional payment is required from you.</Text>
          </View>
        ) : campaign.status === "FAILED" ? (
          <View style={[styles.outcomeCard, { backgroundColor: "rgba(255,197,0,0.12)" }]}>
            <Ionicons name="time-outline" size={20} color="#B48A00" />
            <Text style={styles.outcomeText}>This campaign did not reach its minimum. No supplier order will be created — an individual refund is being created for every eligible confirmed contribution.</Text>
          </View>
        ) : campaign.status === "REFUNDING" ? (
          <View style={[styles.outcomeCard, { backgroundColor: "rgba(255,197,0,0.12)" }]}>
            <Ionicons name="return-down-back-outline" size={20} color="#B48A00" />
            <Text style={styles.outcomeText}>Your refund is being processed.</Text>
          </View>
        ) : campaign.status === "CANCELLED" ? (
          <View style={[styles.outcomeCard, { backgroundColor: "rgba(214,85,47,0.08)" }]}>
            <Ionicons name="return-down-back-outline" size={20} color="#D6552F" />
            <Text style={styles.outcomeText}>This campaign was ended. Any contribution you made is being refunded.</Text>
          </View>
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
              <View style={styles.outcomeCard}>
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
              </View>
            ) : (
              <>
                <Text style={styles.fieldLabel}>Price per share: {formatDisplayMoney(campaign.pricePerShareMinor / 100, campaign.currency, selectedCurrency)}</Text>
                <View style={styles.quantityRow}>
                  <TouchableOpacity onPress={() => setQuantity(String(Math.max(1, (Number(quantity) || 1) - 1)))} activeOpacity={0.85} style={styles.stepperBtn}>
                    <Ionicons name="remove" size={18} color="#076B51" />
                  </TouchableOpacity>
                  <TextInput
                    style={styles.quantityInput}
                    placeholder="1"
                    placeholderTextColor="#9AA3A0"
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
              </>
            )}
          </>
        ) : null}

        {updates.length > 0 ? (
          <>
            <Text style={styles.section}>Campaign updates</Text>
            {updates.map((u) => (
              <View key={u.id} style={styles.updateRow}>
                <Text style={styles.updateTitle}>{u.title}</Text>
                {u.body ? <Text style={styles.updateBody}>{u.body}</Text> : null}
                <Text style={styles.updateDate}>{formatDateTime(u.createdAt)}</Text>
              </View>
            ))}
          </>
        ) : null}

        <TouchableOpacity
          onPress={() => router.push({ pathname: "/(buyer)/community-buy-support-cases", params: { campaignId: campaign.id, campaignTitle: campaign.title } } as any)}
          activeOpacity={0.85}
          style={styles.reportIssueRow}
        >
          <Ionicons name="flag-outline" size={16} color="#858585" />
          <Text style={styles.reportIssueText}>Report an issue with this campaign</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9F9F9" },
  header: { backgroundColor: "#FFFFFF", paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16, flexDirection: "row", alignItems: "center", gap: 12 },
  backButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#F4F4F4", alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, fontSize: 18, fontFamily: "Manrope-Bold", color: "#282828" },
  placeholder: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 8 },
  emptyText: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#858585", textAlign: "center" },
  retryButton: { marginTop: 10, minHeight: 38, borderRadius: 12, borderWidth: 1, borderColor: "#076B51", paddingHorizontal: 18, alignItems: "center", justifyContent: "center" },
  retryButtonText: { fontSize: 13, fontFamily: "Manrope-SemiBold", color: "#076B51" },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 100, gap: 10 },
  heroCard: { backgroundColor: "#FFFFFF", borderRadius: 18, padding: 16, gap: 8 },
  statusRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  countryPill: { backgroundColor: "#F4F4F4", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  countryPillText: { fontSize: 10, fontFamily: "Manrope-Bold", color: "#858585" },
  statusText: { fontSize: 11, fontFamily: "Manrope-Bold", color: "#076B51", textTransform: "capitalize" },
  title: { fontSize: 19, fontFamily: "Manrope-ExtraBold", color: "#282828" },
  vendor: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#858585" },
  description: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#5C5C5C", lineHeight: 19, marginTop: 4 },
  progressTrack: { height: 8, borderRadius: 4, backgroundColor: "#F4F4F4", overflow: "hidden", marginTop: 8 },
  progressFill: { height: 8, borderRadius: 4, backgroundColor: "#076B51" },
  progressMetaRow: { flexDirection: "row", justifyContent: "space-between" },
  progressMetaText: { fontSize: 13, fontFamily: "Manrope-Bold", color: "#282828" },
  progressMetaSub: { fontSize: 11, fontFamily: "Outfit-Regular", color: "#858585" },
  outcomeCard: { flexDirection: "row", gap: 10, alignItems: "center", backgroundColor: "rgba(7,107,81,0.08)", borderRadius: 14, padding: 12 },
  outcomeText: { flex: 1, fontSize: 12, fontFamily: "Outfit-Regular", color: "#282828", lineHeight: 17 },
  section: { fontSize: 15, fontFamily: "Manrope-Bold", color: "#282828", marginTop: 6 },
  fieldLabel: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#858585" },
  quantityRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  stepperBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: "rgba(7,107,81,0.08)", alignItems: "center", justifyContent: "center" },
  quantityInput: { flex: 1, backgroundColor: "#FFFFFF", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, fontFamily: "Manrope-Bold", color: "#282828", textAlign: "center" },
  amountInput: { backgroundColor: "#FFFFFF", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, fontFamily: "Outfit-Regular", color: "#282828" },
  errorText: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#FB6363" },
  primaryBtn: { minHeight: 52, borderRadius: 14, backgroundColor: "#076B51", alignItems: "center", justifyContent: "center" },
  primaryBtnText: { fontSize: 14, fontFamily: "Manrope-Bold", color: "#FFFFFF" },
  secondaryBtn: { minHeight: 46, borderRadius: 14, borderWidth: 1, borderColor: "#076B51", alignItems: "center", justifyContent: "center" },
  secondaryBtnText: { fontSize: 13, fontFamily: "Manrope-SemiBold", color: "#076B51" },
  receiptToggle: { fontSize: 12, fontFamily: "Manrope-SemiBold", color: "#076B51", marginTop: 6 },
  receiptCard: { marginTop: 8, backgroundColor: "#FFFFFF", borderRadius: 12, padding: 12, gap: 6 },
  receiptRow: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  receiptLabel: { fontSize: 11, fontFamily: "Outfit-Regular", color: "#858585" },
  receiptValue: { flex: 1, fontSize: 12, fontFamily: "Manrope-SemiBold", color: "#282828", textAlign: "right" },
  updateRow: { backgroundColor: "#FFFFFF", borderRadius: 14, padding: 12, gap: 3 },
  updateTitle: { fontSize: 13, fontFamily: "Manrope-Bold", color: "#282828" },
  updateBody: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#5C5C5C", lineHeight: 17 },
  updateDate: { fontSize: 11, fontFamily: "Outfit-Regular", color: "#B0B0B0", marginTop: 2 },
  reportIssueRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 14 },
  reportIssueText: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#858585" },
});
