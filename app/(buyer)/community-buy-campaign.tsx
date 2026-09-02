import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { goBackOrReplace } from "../../utils/navigation";
import { formatDisplayMoney } from "../../utils/currency";
import { useCurrencyStore } from "../../stores/currencyStore";
import { presentPayment } from "../../services/stripePayment";
import { communityBuyService, type Campaign, type Contribution } from "../../services/communityBuyService";

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

  const [amount, setAmount] = useState("");
  const [contributing, setContributing] = useState(false);
  const [contribution, setContribution] = useState<Contribution | null>(null);
  const [contributeError, setContributeError] = useState("");

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError("");
    try {
      setCampaign(await communityBuyService.getCampaign(id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load this campaign.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

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
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setContributeError("Enter a valid amount.");
      return;
    }
    setContributing(true);
    setContributeError("");
    try {
      const amountInCents = Math.round(value * 100);
      const { contributionId, clientSecret } = await communityBuyService.createContribution(id, amountInCents);
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

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => goBackOrReplace(router, "/(buyer)/community-buy" as any)} activeOpacity={0.85} style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color="#282828" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{campaign.title}</Text>
        <View style={{ width: 38 }} />
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
          <View style={styles.progressMetaRow}>
            <Text style={styles.progressMetaText}>{pct}% funded</Text>
            <Text style={styles.progressMetaText}>{formatDisplayMoney(campaign.targetAmount / 100, campaign.currency, selectedCurrency)} target</Text>
          </View>
          <View style={styles.progressMetaRow}>
            <Text style={styles.progressMetaSub}>{contributionCount} contribution{contributionCount === 1 ? "" : "s"}</Text>
            <Text style={styles.progressMetaSub}>Closes {formatDeadline(campaign.deadline)}</Text>
          </View>
        </View>

        {campaign.status === "SUCCEEDED" ? (
          <View style={styles.outcomeCard}>
            <Ionicons name="checkmark-circle-outline" size={20} color="#076B51" />
            <Text style={styles.outcomeText}>This campaign reached its target. Fulfilment updates will be shared with participants.</Text>
          </View>
        ) : campaign.status === "FAILED" ? (
          <View style={[styles.outcomeCard, { backgroundColor: "rgba(255,197,0,0.12)" }]}>
            <Ionicons name="time-outline" size={20} color="#B48A00" />
            <Text style={styles.outcomeText}>This campaign didn't reach its target. The organiser is deciding what happens next — you'll be notified.</Text>
          </View>
        ) : campaign.status === "FULFILLING" ? (
          <View style={styles.outcomeCard}>
            <Ionicons name="information-circle-outline" size={20} color="#076B51" />
            <Text style={styles.outcomeText}>This campaign didn't reach its target, but the organiser has chosen to proceed. No payment action has been taken yet — further details will follow.</Text>
          </View>
        ) : campaign.status === "CANCELLED" ? (
          <View style={[styles.outcomeCard, { backgroundColor: "rgba(214,85,47,0.08)" }]}>
            <Ionicons name="return-down-back-outline" size={20} color="#D6552F" />
            <Text style={styles.outcomeText}>This campaign was cancelled. Any contribution you made is being refunded.</Text>
          </View>
        ) : null}

        {isLive ? (
          <>
            {!joined ? (
              <TouchableOpacity onPress={handleJoin} disabled={joining} activeOpacity={0.88} style={styles.secondaryBtn}>
                {joining ? <ActivityIndicator size="small" color="#076B51" /> : <Text style={styles.secondaryBtnText}>Join this campaign</Text>}
              </TouchableOpacity>
            ) : null}

            <Text style={styles.section}>Contribute</Text>
            {contribution?.status === "PAID" ? (
              <View style={styles.outcomeCard}>
                <Ionicons name="checkmark-circle-outline" size={20} color="#076B51" />
                <Text style={styles.outcomeText}>Your contribution of {formatDisplayMoney(contribution.amount / 100, contribution.currency, selectedCurrency)} is confirmed.</Text>
              </View>
            ) : (
              <>
                <TextInput
                  style={styles.amountInput}
                  placeholder={`Amount (${campaign.currency})`}
                  placeholderTextColor="#9AA3A0"
                  keyboardType="decimal-pad"
                  value={amount}
                  onChangeText={setAmount}
                />
                {contributeError ? <Text style={styles.errorText}>{contributeError}</Text> : null}
                <TouchableOpacity onPress={handleContribute} disabled={contributing} activeOpacity={0.88} style={[styles.primaryBtn, contributing && { opacity: 0.7 }]}>
                  {contributing ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.primaryBtnText}>Contribute</Text>}
                </TouchableOpacity>
              </>
            )}
          </>
        ) : null}
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
  amountInput: { backgroundColor: "#FFFFFF", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, fontFamily: "Outfit-Regular", color: "#282828" },
  errorText: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#FB6363" },
  primaryBtn: { minHeight: 52, borderRadius: 14, backgroundColor: "#076B51", alignItems: "center", justifyContent: "center" },
  primaryBtnText: { fontSize: 14, fontFamily: "Manrope-Bold", color: "#FFFFFF" },
  secondaryBtn: { minHeight: 46, borderRadius: 14, borderWidth: 1, borderColor: "#076B51", alignItems: "center", justifyContent: "center" },
  secondaryBtnText: { fontSize: 13, fontFamily: "Manrope-SemiBold", color: "#076B51" },
});
