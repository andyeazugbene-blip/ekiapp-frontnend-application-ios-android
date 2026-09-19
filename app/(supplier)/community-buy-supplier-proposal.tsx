import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { goBackOrReplace } from "../../utils/navigation";
import { formatDisplayMoney } from "../../utils/currency";
import { useCurrencyStore } from "../../stores/currencyStore";
import { DatePickerField } from "../../components/shared/DatePickerField";
import {
  ErrorState,
  FloatingCard,
  LoadingBlock,
  PremiumHeader,
  StatusPill,
  premiumStyles,
} from "../../components/shared/PremiumBlocks";
import {
  communityBuyService,
  SUPPLIER_PROPOSAL_STATUS_LABELS,
  SUPPLIER_PROPOSAL_STATUS_TONE,
  type Campaign,
  type SupplierProposal,
} from "../../services/communityBuyService";

const LIVE_STATUSES = ["SUBMITTED", "ADMIN_CHANGES_NEEDED", "AWAITING_ORGANISER"];

function formatDate(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export default function CommunityBuySupplierProposalScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { selectedCurrency } = useCurrencyStore();

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [proposals, setProposals] = useState<SupplierProposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [wholesaleAmount, setWholesaleAmount] = useState("");
  const [maxShares, setMaxShares] = useState("");
  const [readyByDate, setReadyByDate] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError("");
    try {
      const [c, items] = await Promise.all([
        communityBuyService.getCampaign(id),
        communityBuyService.listMySupplierProposals(id),
      ]);
      setCampaign(c);
      setProposals(items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load this campaign.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const backToCampaigns = () => goBackOrReplace(router, "/(supplier)/community-buy-supplier" as any);

  const liveProposal = proposals.find((p) => LIVE_STATUSES.includes(p.status));
  const needsChanges = liveProposal?.status === "ADMIN_CHANGES_NEEDED";

  const resetForm = () => {
    setWholesaleAmount("");
    setMaxShares("");
    setReadyByDate("");
    setMessage("");
  };

  const startEditingExisting = () => {
    if (!liveProposal) return;
    setWholesaleAmount(liveProposal.proposedWholesaleAmountMinor != null ? String(liveProposal.proposedWholesaleAmountMinor / 100) : "");
    setMaxShares(liveProposal.proposedMaximumShares != null ? String(liveProposal.proposedMaximumShares) : "");
    setReadyByDate(liveProposal.proposedReadyByDate ? liveProposal.proposedReadyByDate.slice(0, 10) : "");
    setMessage("");
  };

  const handleSubmit = async () => {
    if (!id) return;
    if (!message.trim()) return Alert.alert("Message required", "Explain what you'd like to change and why.");
    if (!wholesaleAmount.trim() && !maxShares.trim() && !readyByDate.trim()) {
      return Alert.alert("Nothing to propose", "Set at least one of wholesale amount, maximum shares, or ready-by date.");
    }
    setBusy(true);
    try {
      const input = {
        message: message.trim(),
        proposedWholesaleAmountMinor: wholesaleAmount.trim() ? Math.round(Number(wholesaleAmount) * 100) : undefined,
        proposedMaximumShares: maxShares.trim() ? Math.round(Number(maxShares)) : undefined,
        proposedReadyByDate: readyByDate.trim() ? new Date(readyByDate).toISOString() : undefined,
      };
      if (needsChanges && liveProposal) {
        await communityBuyService.resubmitSupplierProposal(id, liveProposal.id, input);
      } else {
        await communityBuyService.submitSupplierProposal(id, input);
      }
      resetForm();
      await load();
      Alert.alert("Sent", "Eki will review your proposed changes before the organiser sees them.");
    } catch (err) {
      Alert.alert("Couldn't send", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const handleWithdraw = async (proposalId: string) => {
    if (!id) return;
    Alert.alert("Withdraw this proposal?", "This can't be undone — you can submit a new one later.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Withdraw",
        style: "destructive",
        onPress: async () => {
          setBusy(true);
          try {
            await communityBuyService.withdrawSupplierProposal(id, proposalId);
            await load();
          } catch (err) {
            Alert.alert("Couldn't withdraw", err instanceof Error ? err.message : "Please try again.");
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={premiumStyles.page}>
        <PremiumHeader title="Propose changes" onBack={backToCampaigns} />
        <LoadingBlock />
      </View>
    );
  }

  if (error || !campaign) {
    return (
      <View style={premiumStyles.page}>
        <PremiumHeader title="Propose changes" onBack={backToCampaigns} />
        <View style={premiumStyles.block}><ErrorState message={error || "Check your connection and try again."} onRetry={() => void load()} /></View>
      </View>
    );
  }

  const canSubmitNew = !liveProposal;
  const showForm = canSubmitNew || needsChanges;

  return (
    <View style={premiumStyles.page}>
      <PremiumHeader title="Propose changes" subtitle={campaign.title} onBack={backToCampaigns} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={[premiumStyles.scrollContent, { paddingTop: 18 }]} showsVerticalScrollIndicator={false}>
        <View style={[premiumStyles.block, { gap: 14 }]}>
          <FloatingCard style={{ gap: 8 }}>
            <Text style={styles.section}>Current terms</Text>
            <View style={styles.row}><Text style={styles.label}>Wholesale amount</Text><Text style={styles.value}>{campaign.wholesaleAmountMinor != null ? formatDisplayMoney(campaign.wholesaleAmountMinor / 100, campaign.currency, selectedCurrency) : "Not set"}</Text></View>
            <View style={styles.row}><Text style={styles.label}>Maximum shares</Text><Text style={styles.value}>{campaign.maximumShares ?? "—"}</Text></View>
            <View style={styles.row}><Text style={styles.label}>Confirmed so far</Text><Text style={styles.value}>{campaign.confirmedShares}</Text></View>
            <View style={styles.row}><Text style={styles.label}>Ready-by date agreed</Text><Text style={styles.value}>{formatDate(campaign.agreedReadyByDate)}</Text></View>
          </FloatingCard>

          {proposals.length > 0 ? (
            <View style={{ gap: 10 }}>
              <Text style={styles.sectionOutside}>Your proposals</Text>
              {proposals.map((p) => (
                <FloatingCard key={p.id} style={{ gap: 8 }}>
                  <View style={styles.row}>
                    <StatusPill label={SUPPLIER_PROPOSAL_STATUS_LABELS[p.status]} tone={SUPPLIER_PROPOSAL_STATUS_TONE[p.status]} />
                    <Text style={styles.metaText}>{formatDate(p.createdAt)}</Text>
                  </View>
                  {p.proposedWholesaleAmountMinor != null ? <Text style={styles.metaText}>Wholesale: {formatDisplayMoney(p.proposedWholesaleAmountMinor / 100, campaign.currency, selectedCurrency)}</Text> : null}
                  {p.proposedMaximumShares != null ? <Text style={styles.metaText}>Maximum shares: {p.proposedMaximumShares}</Text> : null}
                  {p.proposedReadyByDate ? <Text style={styles.metaText}>Ready by: {formatDate(p.proposedReadyByDate)}</Text> : null}
                  <Text style={styles.metaText}>Message: {p.message}</Text>
                  {p.status === "ADMIN_CHANGES_NEEDED" && p.adminNotes ? (
                    <View style={styles.noticeBox}>
                      <Ionicons name="alert-circle-outline" size={16} color="#B48A00" />
                      <Text style={styles.noticeText}>Eki: {p.adminNotes}</Text>
                    </View>
                  ) : null}
                  {p.status === "ORGANISER_REJECTED" && p.organiserNotes ? (
                    <Text style={styles.metaText}>Organiser: {p.organiserNotes}</Text>
                  ) : null}
                  {LIVE_STATUSES.includes(p.status) ? (
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      {needsChanges && p.id === liveProposal?.id ? (
                        <TouchableOpacity onPress={startEditingExisting} activeOpacity={0.85} style={styles.editBtn}>
                          <Text style={styles.editBtnText}>Edit and resubmit</Text>
                        </TouchableOpacity>
                      ) : null}
                      <TouchableOpacity disabled={busy} onPress={() => void handleWithdraw(p.id)} activeOpacity={0.85} style={styles.withdrawBtn}>
                        {busy ? <ActivityIndicator size="small" color="#D6552F" /> : <Text style={styles.withdrawBtnText}>Withdraw</Text>}
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </FloatingCard>
              ))}
            </View>
          ) : null}

          {showForm ? (
            <FloatingCard style={{ gap: 10 }}>
              <Text style={styles.section}>{needsChanges ? "Resubmit with changes" : "Propose new terms"}</Text>
              <Text style={styles.fieldHint}>Leave a field blank to keep it unchanged. Eki reviews every proposal before the organiser sees it.</Text>
              <TextInput style={styles.input} placeholder={`Wholesale amount (${campaign.currency ?? ""})`} placeholderTextColor="#8AA194" keyboardType="decimal-pad" value={wholesaleAmount} onChangeText={setWholesaleAmount} accessibilityLabel="Proposed wholesale amount" />
              <TextInput style={styles.input} placeholder="Maximum shares" placeholderTextColor="#8AA194" keyboardType="number-pad" value={maxShares} onChangeText={setMaxShares} accessibilityLabel="Proposed maximum shares" />
              <DatePickerField label="Ready-by date (optional)" value={readyByDate} onChange={setReadyByDate} minimumDate={new Date(Date.now() + 24 * 60 * 60 * 1000)} />
              <TextInput style={[styles.input, styles.inputMultiline]} placeholder="Explain the change you're requesting" placeholderTextColor="#8AA194" value={message} onChangeText={setMessage} multiline accessibilityLabel="Message" />
              <TouchableOpacity onPress={() => void handleSubmit()} disabled={busy} activeOpacity={0.88} style={styles.submitBtn}>
                {busy ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.submitBtnText}>{needsChanges ? "Resubmit" : "Send proposal"}</Text>}
              </TouchableOpacity>
            </FloatingCard>
          ) : liveProposal ? (
            <Text style={styles.fieldHint}>A proposal is already {SUPPLIER_PROPOSAL_STATUS_LABELS[liveProposal.status].toLowerCase()}. Withdraw it above to submit a different one.</Text>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { fontSize: 13, fontFamily: "Manrope-ExtraBold", color: "#151E1B" },
  sectionOutside: { fontSize: 15, fontFamily: "Manrope-ExtraBold", color: "#12221A", marginBottom: 6 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  label: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#6A7B72" },
  value: { fontSize: 13, fontFamily: "Manrope-SemiBold", color: "#151E1B" },
  metaText: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#4A5A52" },
  fieldHint: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#6A7B72", lineHeight: 17 },
  input: { backgroundColor: "#F4F6F5", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 13, fontFamily: "Outfit-Regular", color: "#151E1B" },
  inputMultiline: { minHeight: 70, textAlignVertical: "top" },
  submitBtn: { minHeight: 48, borderRadius: 14, backgroundColor: "#076B51", alignItems: "center", justifyContent: "center" },
  submitBtnText: { fontSize: 14, fontFamily: "Manrope-Bold", color: "#FFFFFF" },
  editBtn: { flex: 1, minHeight: 40, borderRadius: 12, borderWidth: 1, borderColor: "#076B51", alignItems: "center", justifyContent: "center" },
  editBtnText: { fontSize: 12, fontFamily: "Manrope-SemiBold", color: "#076B51" },
  withdrawBtn: { flex: 1, minHeight: 40, borderRadius: 12, borderWidth: 1, borderColor: "#D6552F", alignItems: "center", justifyContent: "center" },
  withdrawBtnText: { fontSize: 12, fontFamily: "Manrope-SemiBold", color: "#D6552F" },
  noticeBox: { flexDirection: "row", gap: 8, alignItems: "flex-start", backgroundColor: "rgba(180,138,0,0.1)", borderRadius: 10, padding: 10 },
  noticeText: { flex: 1, fontSize: 12, fontFamily: "Outfit-Regular", color: "#856B0E", lineHeight: 17 },
});
