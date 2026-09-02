import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
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

export default function CommunityBuyOrganiserCampaignScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEdit = Boolean(id);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [campaign, setCampaign] = useState<Campaign | null>(null);

  const [country, setCountry] = useState("");
  const [currency, setCurrency] = useState("GBP");
  const [suppliers, setSuppliers] = useState<(SupplierProfile & { vendor?: { storeName: string } })[]>([]);
  const [supplierId, setSupplierId] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [deadline, setDeadline] = useState("");

  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [decisionBusy, setDecisionBusy] = useState<"fulfil" | "cancel" | null>(null);
  const { selectedCurrency } = useCurrencyStore();

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (id) {
        const existing = await communityBuyService.getCampaign(id);
        setCampaign(existing);
        setCountry(existing.country);
        setCurrency(existing.currency);
        setSupplierId(existing.supplierId);
        setTitle(existing.title);
        setDescription(existing.description ?? "");
        setTargetAmount(String(existing.targetAmount / 100));
        setDeadline(existing.deadline.slice(0, 10));
      } else {
        const profile = await communityBuyService.getMyOrganiserProfile();
        if (!profile?.isVerified) throw new Error("A verified organiser profile is required to create a campaign.");
        setCountry(profile.country);
        const markets = await communityBuyService.listMarketConfigs().catch(() => [] as MarketConfig[]);
        const market = markets.find((m) => m.countryCode === profile.country);
        setCurrency(market?.currency ?? "GBP");
        const supplierList = await communityBuyService.listVerifiedSuppliers(profile.country);
        setSuppliers(supplierList);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load this campaign.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleSave = async () => {
    if (!title.trim()) return Alert.alert("Title required", "Give this campaign a name.");
    const amountValue = Number(targetAmount);
    if (!Number.isFinite(amountValue) || amountValue <= 0) return Alert.alert("Target required", "Enter a valid target amount.");
    const deadlineDate = new Date(deadline);
    if (Number.isNaN(deadlineDate.getTime()) || deadlineDate <= new Date()) return Alert.alert("Deadline required", "Enter a valid future date (YYYY-MM-DD).");

    setSaving(true);
    try {
      if (isEdit && campaign) {
        const updated = await communityBuyService.updateCampaign(campaign.id, {
          title: title.trim(),
          description: description.trim() || undefined,
          targetAmount: Math.round(amountValue * 100),
          deadline: deadlineDate.toISOString(),
        });
        setCampaign(updated);
        Alert.alert("Saved", "Campaign updated.");
      } else {
        if (!supplierId) return Alert.alert("Supplier required", "Choose a supplier for this campaign.");
        const created = await communityBuyService.createCampaign({
          supplierId,
          title: title.trim(),
          description: description.trim() || undefined,
          country,
          currency,
          targetAmount: Math.round(amountValue * 100),
          deadline: deadlineDate.toISOString(),
        });
        router.replace({ pathname: "/(buyer)/community-buy-organiser-campaign", params: { id: created.id } } as any);
      }
    } catch (err) {
      Alert.alert("Couldn't save", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (!campaign) return;
    setSubmitting(true);
    try {
      setCampaign(await communityBuyService.submitCampaign(campaign.id));
      Alert.alert("Submitted", "Your campaign was sent for admin review.");
    } catch (err) {
      Alert.alert("Couldn't submit", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handlePublish = async () => {
    if (!campaign) return;
    setPublishing(true);
    try {
      setCampaign(await communityBuyService.publishCampaign(campaign.id));
      Alert.alert("Published", "Your campaign is now live.");
    } catch (err) {
      Alert.alert("Couldn't publish", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setPublishing(false);
    }
  };

  const handleFulfilAnyway = () => {
    if (!campaign) return;
    Alert.alert(
      "Proceed without reaching target?",
      "This records your decision to proceed. No payment action will be taken yet — you'll be notified separately once that's confirmed.",
      [
        { text: "Not yet", style: "cancel" },
        {
          text: "Proceed",
          onPress: async () => {
            setDecisionBusy("fulfil");
            try {
              setCampaign(await communityBuyService.fulfilCampaignAnyway(campaign.id));
            } catch (err) {
              Alert.alert("Couldn't record your decision", err instanceof Error ? err.message : "Please try again.");
            } finally {
              setDecisionBusy(null);
            }
          },
        },
      ],
    );
  };

  const handleCancelAfterFailure = () => {
    if (!campaign) return;
    Alert.alert(
      "Cancel this campaign?",
      "Participants who contributed will be refunded. This can't be undone.",
      [
        { text: "Keep deciding", style: "cancel" },
        {
          text: "Cancel campaign",
          style: "destructive",
          onPress: async () => {
            setDecisionBusy("cancel");
            try {
              setCampaign(await communityBuyService.cancelFailedCampaign(campaign.id));
            } catch (err) {
              Alert.alert("Couldn't cancel", err instanceof Error ? err.message : "Please try again.");
            } finally {
              setDecisionBusy(null);
            }
          },
        },
      ],
    );
  };

  const isLocked = campaign ? !["DRAFT", "CHANGES_REQUIRED"].includes(campaign.status) : false;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => goBackOrReplace(router, "/(buyer)/community-buy-organiser" as any)} activeOpacity={0.85} style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color="#282828" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isEdit ? "Campaign" : "New campaign"}</Text>
        <View style={{ width: 38 }} />
      </View>

      {loading ? (
        <View style={styles.placeholder}><ActivityIndicator color="#076B51" /></View>
      ) : error ? (
        <View style={styles.emptyState}>
          <Ionicons name="alert-circle-outline" size={28} color="#D6552F" />
          <Text style={styles.emptyText}>{error}</Text>
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {campaign?.status === "CHANGES_REQUIRED" && campaign.reviewNotes ? (
            <View style={styles.noticeCard}>
              <Ionicons name="alert-circle-outline" size={18} color="#B48A00" />
              <Text style={styles.noticeText}>{campaign.reviewNotes}</Text>
            </View>
          ) : null}
          {campaign ? <Text style={styles.statusBadge}>{campaign.status.replace("_", " ")}</Text> : null}

          {campaign?.status === "FAILED" ? (
            <View style={styles.outcomeCard}>
              <Text style={styles.outcomeTitle}>Target not reached</Text>
              <View style={styles.outcomeRow}><Text style={styles.outcomeLabel}>Target</Text><Text style={styles.outcomeValue}>{formatDisplayMoney(campaign.targetAmount / 100, campaign.currency, selectedCurrency)}</Text></View>
              <View style={styles.outcomeRow}><Text style={styles.outcomeLabel}>Raised</Text><Text style={styles.outcomeValue}>{formatDisplayMoney((campaign.paidTotal ?? 0) / 100, campaign.currency, selectedCurrency)}</Text></View>
              <View style={styles.outcomeRow}><Text style={styles.outcomeLabel}>Joined</Text><Text style={styles.outcomeValue}>{campaign.participantCount ?? 0} participant{(campaign.participantCount ?? 0) === 1 ? "" : "s"}</Text></View>
              <Text style={styles.outcomeHint}>Choose what happens next. Proceeding takes no payment action yet — you'll be notified once that's confirmed. Cancelling refunds anyone who contributed.</Text>
              <View style={styles.decisionRow}>
                <TouchableOpacity onPress={handleFulfilAnyway} disabled={decisionBusy !== null} activeOpacity={0.88} style={styles.fulfilBtn}>
                  {decisionBusy === "fulfil" ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.fulfilBtnText}>Proceed Anyway</Text>}
                </TouchableOpacity>
                <TouchableOpacity onPress={handleCancelAfterFailure} disabled={decisionBusy !== null} activeOpacity={0.88} style={styles.cancelBtn}>
                  {decisionBusy === "cancel" ? <ActivityIndicator size="small" color="#FB6363" /> : <Text style={styles.cancelBtnText}>Cancel Campaign</Text>}
                </TouchableOpacity>
              </View>
            </View>
          ) : campaign?.status === "FULFILLING" ? (
            <View style={styles.outcomeCard}>
              <Ionicons name="information-circle-outline" size={18} color="#076B51" />
              <Text style={styles.outcomeHint}>You chose to proceed with this campaign despite not reaching its target. No payment action has been taken — you'll be notified once that's confirmed.</Text>
            </View>
          ) : campaign?.status === "CANCELLED" ? (
            <View style={styles.outcomeCard}>
              <Ionicons name="return-down-back-outline" size={18} color="#858585" />
              <Text style={styles.outcomeHint}>This campaign was cancelled. Contributions are being refunded.</Text>
            </View>
          ) : null}

          <Text style={styles.label}>Title</Text>
          <TextInput style={styles.input} editable={!isLocked} placeholder="Campaign title" placeholderTextColor="#9AA3A0" value={title} onChangeText={setTitle} />

          <Text style={styles.label}>Description (optional)</Text>
          <TextInput style={[styles.input, styles.inputMultiline]} editable={!isLocked} placeholder="What is this campaign for?" placeholderTextColor="#9AA3A0" value={description} onChangeText={setDescription} multiline />

          <Text style={styles.label}>Target amount ({currency})</Text>
          <TextInput style={styles.input} editable={!isLocked} placeholder="0.00" placeholderTextColor="#9AA3A0" keyboardType="decimal-pad" value={targetAmount} onChangeText={setTargetAmount} />

          <Text style={styles.label}>Deadline (YYYY-MM-DD)</Text>
          <TextInput style={styles.input} editable={!isLocked} placeholder="2026-12-31" placeholderTextColor="#9AA3A0" value={deadline} onChangeText={setDeadline} />

          {!isEdit ? (
            <>
              <Text style={styles.label}>Supplier</Text>
              {suppliers.length === 0 ? (
                <Text style={styles.emptyText}>No verified suppliers in {country} yet.</Text>
              ) : (
                suppliers.map((s) => (
                  <TouchableOpacity key={s.id} onPress={() => setSupplierId(s.id)} activeOpacity={0.85} style={[styles.optionRow, supplierId === s.id && styles.optionRowActive]}>
                    <Ionicons name={supplierId === s.id ? "radio-button-on" : "radio-button-off"} size={18} color={supplierId === s.id ? "#076B51" : "#9AA3A0"} />
                    <Text style={styles.optionText}>{s.vendor?.storeName ?? "Supplier"}</Text>
                  </TouchableOpacity>
                ))
              )}
            </>
          ) : null}

          {!isLocked ? (
            <TouchableOpacity onPress={handleSave} disabled={saving} activeOpacity={0.88} style={[styles.primaryBtn, saving && { opacity: 0.7 }]}>
              {saving ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.primaryBtnText}>{isEdit ? "Save changes" : "Create campaign"}</Text>}
            </TouchableOpacity>
          ) : null}

          {campaign && ["DRAFT", "CHANGES_REQUIRED"].includes(campaign.status) ? (
            <TouchableOpacity onPress={handleSubmit} disabled={submitting} activeOpacity={0.85} style={styles.secondaryBtn}>
              {submitting ? <ActivityIndicator size="small" color="#076B51" /> : <Text style={styles.secondaryBtnText}>Submit for review</Text>}
            </TouchableOpacity>
          ) : null}

          {campaign?.status === "APPROVED" ? (
            <TouchableOpacity onPress={handlePublish} disabled={publishing} activeOpacity={0.85} style={styles.secondaryBtn}>
              {publishing ? <ActivityIndicator size="small" color="#076B51" /> : <Text style={styles.secondaryBtnText}>Publish campaign</Text>}
            </TouchableOpacity>
          ) : null}
        </ScrollView>
      )}
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
  scrollContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 100, gap: 8 },
  noticeCard: { flexDirection: "row", gap: 8, backgroundColor: "rgba(255,197,0,0.12)", borderRadius: 12, padding: 12 },
  noticeText: { flex: 1, fontSize: 12, fontFamily: "Outfit-Regular", color: "#282828", lineHeight: 17 },
  statusBadge: { alignSelf: "flex-start", fontSize: 11, fontFamily: "Manrope-Bold", color: "#076B51", backgroundColor: "rgba(7,107,81,0.1)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, textTransform: "capitalize" },
  outcomeCard: { backgroundColor: "#FFFFFF", borderRadius: 16, padding: 16, gap: 8 },
  outcomeTitle: { fontSize: 15, fontFamily: "Manrope-Bold", color: "#282828" },
  outcomeRow: { flexDirection: "row", justifyContent: "space-between" },
  outcomeLabel: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#858585" },
  outcomeValue: { fontSize: 13, fontFamily: "Manrope-SemiBold", color: "#282828" },
  outcomeHint: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#858585", lineHeight: 17, marginTop: 4 },
  decisionRow: { flexDirection: "row", gap: 8, marginTop: 8 },
  fulfilBtn: { flex: 1, minHeight: 46, borderRadius: 12, backgroundColor: "#076B51", alignItems: "center", justifyContent: "center" },
  fulfilBtnText: { fontSize: 13, fontFamily: "Manrope-Bold", color: "#FFFFFF" },
  cancelBtn: { flex: 1, minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: "#FB6363", alignItems: "center", justifyContent: "center" },
  cancelBtnText: { fontSize: 13, fontFamily: "Manrope-SemiBold", color: "#FB6363" },
  label: { fontSize: 13, fontFamily: "Manrope-SemiBold", color: "#282828", marginTop: 8 },
  input: { backgroundColor: "#FFFFFF", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, fontFamily: "Outfit-Regular", color: "#282828" },
  inputMultiline: { minHeight: 70, textAlignVertical: "top" },
  optionRow: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#FFFFFF", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: "transparent" },
  optionRowActive: { borderColor: "#076B51" },
  optionText: { fontSize: 13, fontFamily: "Outfit-Medium", color: "#282828" },
  primaryBtn: { minHeight: 52, borderRadius: 14, backgroundColor: "#076B51", alignItems: "center", justifyContent: "center", marginTop: 14 },
  primaryBtnText: { fontSize: 14, fontFamily: "Manrope-Bold", color: "#FFFFFF" },
  secondaryBtn: { minHeight: 46, borderRadius: 14, borderWidth: 1, borderColor: "#076B51", alignItems: "center", justifyContent: "center", marginTop: 10 },
  secondaryBtnText: { fontSize: 13, fontFamily: "Manrope-SemiBold", color: "#076B51" },
});
