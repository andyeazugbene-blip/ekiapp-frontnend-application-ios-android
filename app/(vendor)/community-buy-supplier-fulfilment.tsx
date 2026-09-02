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
  type CampaignFulfilment,
  type FulfilmentMethod,
  type SupplierPayment,
} from "../../services/communityBuyService";

const STEPS: { status: CampaignFulfilment["status"]; label: string }[] = [
  { status: "AWAITING_INVENTORY_CONFIRMATION", label: "Confirm inventory" },
  { status: "INVENTORY_CONFIRMED", label: "Set fulfilment plan" },
  { status: "PACKING", label: "Packing" },
  { status: "READY_FOR_DISPATCH_OR_COLLECTION", label: "Ready" },
  { status: "DISPATCHED", label: "Dispatched" },
  { status: "COLLECTED", label: "Collected" },
  { status: "COMPLETED", label: "Completed" },
];

const PAYMENT_LABEL: Record<SupplierPayment["status"], { label: string; color: string }> = {
  NOT_RELEASED: { label: "Not yet released", color: "#858585" },
  PROCESSING: { label: "Processing", color: "#B48A00" },
  PAID: { label: "Paid", color: "#076B51" },
  ON_HOLD: { label: "On hold", color: "#D6552F" },
  FAILED: { label: "Failed", color: "#D6552F" },
};

function stepIndex(status: string): number {
  const order = ["AWAITING_INVENTORY_CONFIRMATION", "INVENTORY_CONFIRMED", "PACKING", "READY_FOR_DISPATCH_OR_COLLECTION", "DISPATCHED", "COLLECTED", "COMPLETED"];
  return order.indexOf(status);
}

export default function CommunityBuySupplierFulfilmentScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { selectedCurrency } = useCurrencyStore();

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [fulfilment, setFulfilment] = useState<CampaignFulfilment | null>(null);
  const [payment, setPayment] = useState<SupplierPayment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const [method, setMethod] = useState<FulfilmentMethod>("DELIVERY");
  const [notes, setNotes] = useState("");

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError("");
    try {
      const [c, f] = await Promise.all([
        communityBuyService.getCampaign(id),
        communityBuyService.getSupplierFulfilment(id),
      ]);
      setCampaign(c);
      setFulfilment(f);
      setNotes(f.notes ?? "");
      if (f.method) setMethod(f.method);
      setPayment(await communityBuyService.getMySupplierPayment(id).catch(() => null));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load this campaign's fulfilment.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const runAction = async (key: string, action: () => Promise<CampaignFulfilment>) => {
    setBusy(key);
    try {
      setFulfilment(await action());
    } catch (err) {
      Alert.alert("Couldn't complete that", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.placeholder}><ActivityIndicator color="#076B51" /></View>
      </SafeAreaView>
    );
  }

  if (error || !campaign || !fulfilment) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => goBackOrReplace(router, "/(vendor)/community-buy-supplier" as any)} activeOpacity={0.85} style={styles.backButton}>
            <Ionicons name="arrow-back" size={20} color="#282828" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Fulfilment</Text>
          <View style={{ width: 38 }} />
        </View>
        <View style={styles.emptyState}>
          <Ionicons name="alert-circle-outline" size={28} color="#D6552F" />
          <Text style={styles.emptyText}>{error || "This campaign has no fulfilment record yet."}</Text>
          <TouchableOpacity onPress={() => void load()} activeOpacity={0.86} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const currentIndex = stepIndex(fulfilment.status);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => goBackOrReplace(router, "/(vendor)/community-buy-supplier" as any)} activeOpacity={0.85} style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color="#282828" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{campaign.title}</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Confirmed quantity</Text>
          <Text style={styles.summaryValue}>{campaign.confirmedShares} share{campaign.confirmedShares === 1 ? "" : "s"}</Text>
          <Text style={styles.summaryLabel}>Order value</Text>
          <Text style={styles.summaryValue}>{formatDisplayMoney((campaign.confirmedShares * (campaign.pricePerShareMinor ?? 0)) / 100, campaign.currency, selectedCurrency)}</Text>
        </View>

        <Text style={styles.section}>Fulfilment steps</Text>
        <View style={styles.stepsCard}>
          {STEPS.map((s, i) => {
            const done = i <= currentIndex;
            const skippedBranch = (s.status === "DISPATCHED" && fulfilment.method === "COLLECTION") || (s.status === "COLLECTED" && fulfilment.method === "DELIVERY");
            if (skippedBranch) return null;
            return (
              <View key={s.status} style={styles.stepRow}>
                <Ionicons name={done ? "checkmark-circle" : "ellipse-outline"} size={16} color={done ? "#076B51" : "#C4C4C4"} />
                <Text style={[styles.stepLabel, done && { color: "#282828", fontFamily: "Manrope-SemiBold" }]}>{s.label}</Text>
              </View>
            );
          })}
        </View>

        {fulfilment.status === "AWAITING_INVENTORY_CONFIRMATION" ? (
          <>
            <Text style={styles.hint}>Confirm you have enough stock to fulfil {campaign.confirmedShares} confirmed share{campaign.confirmedShares === 1 ? "" : "s"} before proceeding.</Text>
            <TouchableOpacity
              onPress={() => void runAction("inventory", () => communityBuyService.confirmFulfilmentInventory(id))}
              disabled={busy !== null}
              activeOpacity={0.88}
              style={styles.primaryBtn}
            >
              {busy === "inventory" ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.primaryBtnText}>Confirm inventory</Text>}
            </TouchableOpacity>
          </>
        ) : null}

        {fulfilment.status === "INVENTORY_CONFIRMED" ? (
          <>
            <Text style={styles.section}>Fulfilment plan</Text>
            <View style={styles.methodRow}>
              <TouchableOpacity onPress={() => setMethod("DELIVERY")} activeOpacity={0.85} style={[styles.methodChip, method === "DELIVERY" && styles.methodChipActive]}>
                <Text style={[styles.methodChipText, method === "DELIVERY" && styles.methodChipTextActive]}>Delivery</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setMethod("COLLECTION")} activeOpacity={0.85} style={[styles.methodChip, method === "COLLECTION" && styles.methodChipActive]}>
                <Text style={[styles.methodChipText, method === "COLLECTION" && styles.methodChipTextActive]}>Collection</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              placeholder="Notes for the organiser (optional)"
              placeholderTextColor="#9AA3A0"
              value={notes}
              onChangeText={setNotes}
              multiline
            />
            <TouchableOpacity
              onPress={() => void runAction("plan", () => communityBuyService.setFulfilmentPlan(id, { method, notes: notes.trim() || undefined }))}
              disabled={busy !== null}
              activeOpacity={0.88}
              style={styles.primaryBtn}
            >
              {busy === "plan" ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.primaryBtnText}>Save plan</Text>}
            </TouchableOpacity>
            {fulfilment.method ? (
              <TouchableOpacity
                onPress={() => void runAction("packing", () => communityBuyService.startFulfilmentPacking(id))}
                disabled={busy !== null}
                activeOpacity={0.88}
                style={styles.secondaryBtn}
              >
                {busy === "packing" ? <ActivityIndicator size="small" color="#076B51" /> : <Text style={styles.secondaryBtnText}>Start packing</Text>}
              </TouchableOpacity>
            ) : null}
          </>
        ) : null}

        {fulfilment.status === "PACKING" ? (
          <TouchableOpacity
            onPress={() => void runAction("ready", () => communityBuyService.markFulfilmentReady(id))}
            disabled={busy !== null}
            activeOpacity={0.88}
            style={styles.primaryBtn}
          >
            {busy === "ready" ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.primaryBtnText}>Mark ready for {fulfilment.method === "COLLECTION" ? "collection" : "dispatch"}</Text>}
          </TouchableOpacity>
        ) : null}

        {fulfilment.status === "READY_FOR_DISPATCH_OR_COLLECTION" ? (
          <TouchableOpacity
            onPress={() =>
              void runAction(
                "finish",
                () => fulfilment.method === "COLLECTION" ? communityBuyService.markFulfilmentCollected(id) : communityBuyService.markFulfilmentDispatched(id),
              )
            }
            disabled={busy !== null}
            activeOpacity={0.88}
            style={styles.primaryBtn}
          >
            {busy === "finish" ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.primaryBtnText}>Mark {fulfilment.method === "COLLECTION" ? "collected" : "dispatched"}</Text>}
          </TouchableOpacity>
        ) : null}

        {fulfilment.status === "DISPATCHED" || fulfilment.status === "COLLECTED" || fulfilment.status === "COMPLETED" ? (
          <View style={styles.outcomeCard}>
            <Ionicons name="checkmark-circle-outline" size={18} color="#076B51" />
            <Text style={styles.outcomeText}>
              {fulfilment.status === "COMPLETED" ? "The organiser has confirmed this campaign is complete." : "Waiting for the organiser to confirm receipt."}
            </Text>
          </View>
        ) : null}

        {payment ? (
          <>
            <Text style={styles.section}>Your payment</Text>
            <View style={styles.paymentCard}>
              <View style={styles.paymentRow}>
                <Text style={styles.paymentLabel}>Status</Text>
                <Text style={[styles.paymentValue, { color: PAYMENT_LABEL[payment.status].color }]}>{PAYMENT_LABEL[payment.status].label}</Text>
              </View>
              <View style={styles.paymentRow}>
                <Text style={styles.paymentLabel}>Amount</Text>
                <Text style={styles.paymentValue}>{formatDisplayMoney(payment.amount / 100, payment.currency, selectedCurrency)}</Text>
              </View>
              {payment.holdReason ? <Text style={styles.holdReason}>{payment.holdReason}</Text> : null}
            </View>
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
  summaryCard: { backgroundColor: "#FFFFFF", borderRadius: 16, padding: 16, gap: 2 },
  summaryLabel: { fontSize: 11, fontFamily: "Outfit-Regular", color: "#858585", marginTop: 6 },
  summaryValue: { fontSize: 16, fontFamily: "Manrope-Bold", color: "#282828" },
  section: { fontSize: 15, fontFamily: "Manrope-Bold", color: "#282828", marginTop: 10 },
  stepsCard: { backgroundColor: "#FFFFFF", borderRadius: 16, padding: 16, gap: 10 },
  stepRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  stepLabel: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#9AA3A0" },
  hint: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#858585", lineHeight: 17 },
  primaryBtn: { minHeight: 50, borderRadius: 14, backgroundColor: "#076B51", alignItems: "center", justifyContent: "center", marginTop: 6 },
  primaryBtnText: { fontSize: 14, fontFamily: "Manrope-Bold", color: "#FFFFFF" },
  secondaryBtn: { minHeight: 46, borderRadius: 14, borderWidth: 1, borderColor: "#076B51", alignItems: "center", justifyContent: "center", marginTop: 8 },
  secondaryBtnText: { fontSize: 13, fontFamily: "Manrope-SemiBold", color: "#076B51" },
  methodRow: { flexDirection: "row", gap: 8 },
  methodChip: { flex: 1, minHeight: 44, borderRadius: 12, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#DADADA" },
  methodChipActive: { backgroundColor: "#076B51", borderColor: "#076B51" },
  methodChipText: { fontSize: 13, fontFamily: "Manrope-SemiBold", color: "#282828" },
  methodChipTextActive: { color: "#FFFFFF" },
  input: { backgroundColor: "#FFFFFF", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, fontFamily: "Outfit-Regular", color: "#282828", marginTop: 8 },
  inputMultiline: { minHeight: 70, textAlignVertical: "top" },
  outcomeCard: { flexDirection: "row", gap: 10, alignItems: "center", backgroundColor: "rgba(7,107,81,0.08)", borderRadius: 14, padding: 12, marginTop: 6 },
  outcomeText: { flex: 1, fontSize: 12, fontFamily: "Outfit-Regular", color: "#282828", lineHeight: 17 },
  paymentCard: { backgroundColor: "#FFFFFF", borderRadius: 16, padding: 16, gap: 6 },
  paymentRow: { flexDirection: "row", justifyContent: "space-between" },
  paymentLabel: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#858585" },
  paymentValue: { fontSize: 13, fontFamily: "Manrope-Bold", color: "#282828" },
  holdReason: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#D6552F", marginTop: 4 },
});
