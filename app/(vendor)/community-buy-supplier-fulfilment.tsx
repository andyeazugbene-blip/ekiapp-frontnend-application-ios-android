import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { goBackOrReplace } from "../../utils/navigation";
import { formatDisplayMoney } from "../../utils/currency";
import { useCurrencyStore } from "../../stores/currencyStore";
import {
  ErrorState,
  FloatingCard,
  LoadingBlock,
  PremiumHeader,
  StatusPill,
  premiumStyles,
  type Tone,
} from "../../components/shared/PremiumBlocks";
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

const PAYMENT_TONE: Record<SupplierPayment["status"], Tone> = {
  NOT_RELEASED: "neutral",
  PROCESSING: "warning",
  PAID: "success",
  ON_HOLD: "error",
  FAILED: "error",
};

const PAYMENT_LABEL: Record<SupplierPayment["status"], string> = {
  NOT_RELEASED: "Not yet released",
  PROCESSING: "Processing",
  PAID: "Paid",
  ON_HOLD: "On hold",
  FAILED: "Failed",
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
      <View style={premiumStyles.page}>
        <PremiumHeader title="Fulfilment" onBack={() => goBackOrReplace(router, "/(vendor)/community-buy-supplier" as any)} />
        <LoadingBlock />
      </View>
    );
  }

  if (error || !campaign || !fulfilment) {
    return (
      <View style={premiumStyles.page}>
        <PremiumHeader title="Fulfilment" onBack={() => goBackOrReplace(router, "/(vendor)/community-buy-supplier" as any)} />
        <View style={premiumStyles.block}>
          <ErrorState message={error || "This campaign has no fulfilment record yet."} onRetry={() => void load()} />
        </View>
      </View>
    );
  }

  const currentIndex = stepIndex(fulfilment.status);

  return (
    <View style={premiumStyles.page}>
      <PremiumHeader title={campaign.title} onBack={() => goBackOrReplace(router, "/(vendor)/community-buy-supplier" as any)} />

      <ScrollView style={{ flex: 1 }} contentContainerStyle={[premiumStyles.scrollContent, { paddingTop: 18 }]} showsVerticalScrollIndicator={false}>
        <View style={[premiumStyles.block, { gap: 14 }]}>
          <FloatingCard style={{ gap: 2 }}>
            <Text style={styles.summaryLabel}>Confirmed quantity</Text>
            <Text style={styles.summaryValue}>{campaign.confirmedShares} share{campaign.confirmedShares === 1 ? "" : "s"}</Text>
            <Text style={styles.summaryLabel}>Order value</Text>
            <Text style={styles.summaryValue}>{formatDisplayMoney((campaign.confirmedShares * (campaign.pricePerShareMinor ?? 0)) / 100, campaign.currency, selectedCurrency)}</Text>
          </FloatingCard>

          <View>
            <Text style={styles.section}>Fulfilment steps</Text>
            <FloatingCard style={{ gap: 10 }}>
              {STEPS.map((s, i) => {
                const done = i <= currentIndex;
                const skippedBranch = (s.status === "DISPATCHED" && fulfilment.method === "COLLECTION") || (s.status === "COLLECTED" && fulfilment.method === "DELIVERY");
                if (skippedBranch) return null;
                return (
                  <View key={s.status} style={styles.stepRow}>
                    <Ionicons name={done ? "checkmark-circle" : "ellipse-outline"} size={16} color={done ? "#076B51" : "#C7D2CB"} />
                    <Text style={[styles.stepLabel, done && { color: "#151E1B", fontFamily: "Manrope-SemiBold" }]}>{s.label}</Text>
                  </View>
                );
              })}
            </FloatingCard>
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
            <View>
              <Text style={styles.section}>Fulfilment plan</Text>
              <FloatingCard style={{ gap: 10 }}>
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
                  placeholderTextColor="#8AA194"
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                />
                <TouchableOpacity
                  onPress={() => void runAction("plan", () => communityBuyService.setFulfilmentPlan(id, { method, notes: notes.trim() || undefined }))}
                  disabled={busy !== null}
                  activeOpacity={0.88}
                  style={styles.primaryBtnInline}
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
              </FloatingCard>
            </View>
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
            <FloatingCard style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
              <Ionicons name="checkmark-circle-outline" size={18} color="#076B51" />
              <Text style={styles.outcomeText}>
                {fulfilment.status === "COMPLETED" ? "The organiser has confirmed this campaign is complete." : "Waiting for the organiser to confirm receipt."}
              </Text>
            </FloatingCard>
          ) : null}

          {payment ? (
            <View>
              <Text style={styles.section}>Your payment</Text>
              <FloatingCard style={{ gap: 8 }}>
                <View style={styles.paymentRow}>
                  <Text style={styles.paymentLabel}>Status</Text>
                  <StatusPill label={PAYMENT_LABEL[payment.status]} tone={PAYMENT_TONE[payment.status]} />
                </View>
                <View style={styles.paymentRow}>
                  <Text style={styles.paymentLabel}>Amount</Text>
                  <Text style={styles.paymentValue}>{formatDisplayMoney(payment.amount / 100, payment.currency, selectedCurrency)}</Text>
                </View>
                {payment.holdReason ? <Text style={styles.holdReason}>{payment.holdReason}</Text> : null}
              </FloatingCard>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  summaryLabel: { fontSize: 11, fontFamily: "Outfit-Regular", color: "#6A7B72", marginTop: 6 },
  summaryValue: { fontSize: 16, fontFamily: "Manrope-Bold", color: "#151E1B" },
  section: { fontSize: 15, fontFamily: "Manrope-ExtraBold", color: "#12221A", marginBottom: 10 },
  stepRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  stepLabel: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#8AA194" },
  hint: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#6A7B72", lineHeight: 17 },
  primaryBtn: { minHeight: 52, borderRadius: 14, backgroundColor: "#076B51", alignItems: "center", justifyContent: "center" },
  primaryBtnInline: { minHeight: 48, borderRadius: 14, backgroundColor: "#076B51", alignItems: "center", justifyContent: "center" },
  primaryBtnText: { fontSize: 14, fontFamily: "Manrope-Bold", color: "#FFFFFF" },
  secondaryBtn: { minHeight: 46, borderRadius: 14, borderWidth: 1, borderColor: "#076B51", alignItems: "center", justifyContent: "center" },
  secondaryBtnText: { fontSize: 13, fontFamily: "Manrope-SemiBold", color: "#076B51" },
  methodRow: { flexDirection: "row", gap: 8 },
  methodChip: { flex: 1, minHeight: 44, borderRadius: 12, backgroundColor: "#F4F6F5", alignItems: "center", justifyContent: "center" },
  methodChipActive: { backgroundColor: "#076B51" },
  methodChipText: { fontSize: 13, fontFamily: "Manrope-SemiBold", color: "#151E1B" },
  methodChipTextActive: { color: "#FFFFFF" },
  input: { backgroundColor: "#F4F6F5", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, fontFamily: "Outfit-Regular", color: "#151E1B" },
  inputMultiline: { minHeight: 70, textAlignVertical: "top" },
  outcomeText: { flex: 1, fontSize: 12, fontFamily: "Outfit-Regular", color: "#151E1B", lineHeight: 17 },
  paymentRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  paymentLabel: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#6A7B72" },
  paymentValue: { fontSize: 13, fontFamily: "Manrope-Bold", color: "#151E1B" },
  holdReason: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#D6552F" },
});
