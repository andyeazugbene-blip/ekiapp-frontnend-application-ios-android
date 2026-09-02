import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { goBackOrReplace } from "../../utils/navigation";
import { formatDisplayMoney } from "../../utils/currency";
import { useCurrencyStore } from "../../stores/currencyStore";
import {
  regularDeliveriesService,
  FREQUENCY_LABELS,
  RENEWAL_STATUS_LABELS,
  type BuyerSubscription,
  type Renewal,
} from "../../services/regularDeliveriesService";

function formatDate(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export default function RegularDeliveryDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { selectedCurrency } = useCurrencyStore();

  const [sub, setSub] = useState<BuyerSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionBusy, setActionBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError("");
    try {
      setSub(await regularDeliveriesService.getSubscription(id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load this Regular Delivery.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const runAction = async (key: string, action: () => Promise<BuyerSubscription>) => {
    setActionBusy(key);
    try {
      setSub(await action());
    } catch (err) {
      Alert.alert("Couldn't complete that", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setActionBusy(null);
    }
  };

  const runRenewalAction = async (key: string, action: () => Promise<Renewal>) => {
    setActionBusy(key);
    try {
      await action();
      await load();
    } catch (err) {
      Alert.alert("Couldn't complete that", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setActionBusy(null);
    }
  };

  const confirmCancel = () => {
    Alert.alert("Cancel this Regular Delivery?", "Future renewals will stop. This can't be undone.", [
      { text: "Keep it", style: "cancel" },
      { text: "Cancel delivery", style: "destructive", onPress: () => runAction("cancel", () => regularDeliveriesService.cancelSubscription(id)) },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.placeholder}><ActivityIndicator color="#076B51" /></View>
      </SafeAreaView>
    );
  }

  if (error || !sub) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => goBackOrReplace(router, "/(buyer)/regular-deliveries" as any)} activeOpacity={0.85} style={styles.backButton}>
            <Ionicons name="arrow-back" size={20} color="#282828" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Regular Delivery</Text>
          <View style={{ width: 38 }} />
        </View>
        <View style={styles.emptyState}>
          <Ionicons name="alert-circle-outline" size={28} color="#D6552F" />
          <Text style={styles.emptyTitle}>Couldn't load this delivery</Text>
          <Text style={styles.emptyText}>{error}</Text>
          <TouchableOpacity onPress={() => void load()} activeOpacity={0.86} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const isActive = sub.status === "ACTIVE";
  const isPaused = sub.status === "PAUSED";
  const latestRenewal = sub.renewals?.[0];
  const needsPriceApproval = latestRenewal?.status === "AWAITING_PRICE_APPROVAL";
  const needsPaymentRetry = latestRenewal?.status === "PAYMENT_FAILED";

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => goBackOrReplace(router, "/(buyer)/regular-deliveries" as any)} activeOpacity={0.85} style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color="#282828" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{sub.offer?.title ?? "Regular Delivery"}</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {needsPriceApproval && latestRenewal ? (
          <View style={styles.alertCard}>
            <Ionicons name="pricetag-outline" size={18} color="#B48A00" />
            <View style={{ flex: 1 }}>
              <Text style={styles.alertTitle}>Price change needs your approval</Text>
              <Text style={styles.alertBody}>{sub.offer?.vendor?.storeName ?? "Your vendor"} updated a price on your next delivery.</Text>
              <View style={styles.alertActions}>
                <TouchableOpacity
                  disabled={actionBusy === "price-accept"}
                  onPress={() => void runRenewalAction("price-accept", () => regularDeliveriesService.decideRenewalPriceChange(latestRenewal.id, "accepted"))}
                  style={styles.alertBtnPrimary}
                >
                  <Text style={styles.alertBtnPrimaryText}>Approve</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  disabled={actionBusy === "price-decline"}
                  onPress={() => void runRenewalAction("price-decline", () => regularDeliveriesService.decideRenewalPriceChange(latestRenewal.id, "declined"))}
                  style={styles.alertBtnGhost}
                >
                  <Text style={styles.alertBtnGhostText}>Skip this delivery</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ) : null}

        {needsPaymentRetry && latestRenewal ? (
          <View style={[styles.alertCard, { backgroundColor: "rgba(214,85,47,0.08)" }]}>
            <Ionicons name="card-outline" size={18} color="#D6552F" />
            <View style={{ flex: 1 }}>
              <Text style={styles.alertTitle}>Payment failed</Text>
              <Text style={styles.alertBody}>{latestRenewal.failureReason ?? "We couldn't collect payment for your last delivery."}</Text>
              <TouchableOpacity
                disabled={actionBusy === "retry-payment"}
                onPress={() => void runRenewalAction("retry-payment", () => regularDeliveriesService.retryRenewalPayment(latestRenewal.id))}
                style={[styles.alertBtnPrimary, { alignSelf: "flex-start", marginTop: 8 }]}
              >
                <Text style={styles.alertBtnPrimaryText}>Retry payment</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        <View style={styles.summaryCard}>
          <Text style={styles.vendorName}>{sub.offer?.vendor?.storeName ?? "Vendor"}</Text>
          <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Frequency</Text><Text style={styles.summaryValue}>{FREQUENCY_LABELS[sub.frequency]}</Text></View>
          <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Next renewal</Text><Text style={styles.summaryValue}>{isPaused ? "Paused" : formatDate(sub.nextRenewalAt)}</Text></View>
          <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Status</Text><Text style={styles.summaryValue}>{sub.status.replace("_", " ")}</Text></View>
        </View>

        <Text style={styles.section}>Products</Text>
        {sub.items.map((item) => (
          <View key={item.id} style={styles.itemRow}>
            <Text style={styles.itemTitle}>{item.product.title}</Text>
            <Text style={styles.itemMeta}>x{item.quantity} · {formatDisplayMoney(item.product.priceInCents / 100, item.product.currency, selectedCurrency)}</Text>
          </View>
        ))}

        <View style={styles.actionsGrid}>
          {isActive ? (
            <>
              <ActionButton icon="pause-outline" label="Pause" busy={actionBusy === "pause"} onPress={() => void runAction("pause", () => regularDeliveriesService.pauseSubscription(sub.id))} />
              <ActionButton icon="play-skip-forward-outline" label="Skip next" busy={actionBusy === "skip"} onPress={() => void runAction("skip", () => regularDeliveriesService.skipNextRenewal(sub.id))} />
            </>
          ) : isPaused ? (
            <ActionButton icon="play-outline" label="Resume" busy={actionBusy === "resume"} onPress={() => void runAction("resume", () => regularDeliveriesService.resumeSubscription(sub.id))} />
          ) : null}
          {isActive || isPaused ? (
            <ActionButton icon="close-circle-outline" label="Cancel" tone="danger" busy={actionBusy === "cancel"} onPress={confirmCancel} />
          ) : null}
        </View>

        <Text style={styles.section}>Renewal history</Text>
        {(sub.renewals ?? []).length === 0 ? (
          <Text style={styles.emptyRenewals}>No renewals yet.</Text>
        ) : (
          (sub.renewals ?? []).map((r) => (
            <View key={r.id} style={styles.renewalRow}>
              <View>
                <Text style={styles.renewalDate}>{formatDate(r.cycleDate)}</Text>
                <Text style={styles.renewalStatus}>{RENEWAL_STATUS_LABELS[r.status]}</Text>
              </View>
              {r.subtotalAmount ? (
                <Text style={styles.renewalAmount}>{formatDisplayMoney(r.subtotalAmount / 100, r.currency, selectedCurrency)}</Text>
              ) : null}
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ActionButton({
  icon,
  label,
  onPress,
  busy,
  tone = "default",
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  onPress: () => void;
  busy?: boolean;
  tone?: "default" | "danger";
}) {
  return (
    <TouchableOpacity disabled={busy} onPress={onPress} activeOpacity={0.85} style={styles.actionButton}>
      {busy ? (
        <ActivityIndicator size="small" color={tone === "danger" ? "#FB6363" : "#076B51"} />
      ) : (
        <Ionicons name={icon} size={18} color={tone === "danger" ? "#FB6363" : "#076B51"} />
      )}
      <Text style={[styles.actionButtonText, tone === "danger" && { color: "#FB6363" }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9F9F9" },
  header: { backgroundColor: "#FFFFFF", paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16, flexDirection: "row", alignItems: "center", gap: 12 },
  backButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#F4F4F4", alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, fontSize: 18, fontFamily: "Manrope-Bold", color: "#282828" },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 100, gap: 10 },
  placeholder: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 8 },
  emptyTitle: { fontSize: 14, fontFamily: "Manrope-Bold", color: "#282828" },
  emptyText: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#858585", textAlign: "center" },
  retryButton: { marginTop: 10, minHeight: 38, borderRadius: 12, borderWidth: 1, borderColor: "#076B51", paddingHorizontal: 18, alignItems: "center", justifyContent: "center" },
  retryButtonText: { fontSize: 13, fontFamily: "Manrope-SemiBold", color: "#076B51" },
  alertCard: { flexDirection: "row", gap: 10, backgroundColor: "rgba(255,197,0,0.12)", borderRadius: 14, padding: 12 },
  alertTitle: { fontSize: 13, fontFamily: "Manrope-Bold", color: "#282828" },
  alertBody: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#5C5C5C", marginTop: 2, lineHeight: 17 },
  alertActions: { flexDirection: "row", gap: 8, marginTop: 8 },
  alertBtnPrimary: { backgroundColor: "#076B51", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  alertBtnPrimaryText: { fontSize: 12, fontFamily: "Manrope-SemiBold", color: "#FFFFFF" },
  alertBtnGhost: { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: "#DADADA" },
  alertBtnGhostText: { fontSize: 12, fontFamily: "Manrope-SemiBold", color: "#282828" },
  summaryCard: { backgroundColor: "#FFFFFF", borderRadius: 16, padding: 14, gap: 6 },
  vendorName: { fontSize: 12, fontFamily: "Outfit-Medium", color: "#858585", marginBottom: 4 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between" },
  summaryLabel: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#858585" },
  summaryValue: { fontSize: 13, fontFamily: "Manrope-SemiBold", color: "#282828", textTransform: "capitalize" },
  section: { fontSize: 15, fontFamily: "Manrope-Bold", color: "#282828", marginTop: 10, marginBottom: 2 },
  itemRow: { flexDirection: "row", justifyContent: "space-between", backgroundColor: "#FFFFFF", borderRadius: 12, padding: 12 },
  itemTitle: { fontSize: 13, fontFamily: "Outfit-Medium", color: "#282828" },
  itemMeta: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#858585" },
  actionsGrid: { flexDirection: "row", gap: 8, marginTop: 4 },
  actionButton: { flex: 1, alignItems: "center", gap: 4, backgroundColor: "#FFFFFF", borderRadius: 14, paddingVertical: 12 },
  actionButtonText: { fontSize: 12, fontFamily: "Manrope-SemiBold", color: "#076B51" },
  emptyRenewals: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#858585", paddingVertical: 12, textAlign: "center" },
  renewalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 12, padding: 12 },
  renewalDate: { fontSize: 13, fontFamily: "Outfit-Medium", color: "#282828" },
  renewalStatus: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#858585", marginTop: 2 },
  renewalAmount: { fontSize: 13, fontFamily: "Manrope-Bold", color: "#282828" },
});
