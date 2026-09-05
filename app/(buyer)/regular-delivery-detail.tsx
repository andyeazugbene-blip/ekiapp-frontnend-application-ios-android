import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
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
} from "../../components/shared/PremiumBlocks";
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
  const [editingItems, setEditingItems] = useState(false);
  const [draftQuantities, setDraftQuantities] = useState<Record<string, number>>({});
  const [savingItems, setSavingItems] = useState(false);
  const [itemsError, setItemsError] = useState("");

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

  const startEditingItems = () => {
    if (!sub) return;
    setItemsError("");
    setDraftQuantities(Object.fromEntries(sub.items.map((item) => [item.productId, item.quantity])));
    setEditingItems(true);
  };

  const cancelEditingItems = () => {
    setEditingItems(false);
    setItemsError("");
  };

  const changeDraftQuantity = (productId: string, delta: number) => {
    setDraftQuantities((prev) => {
      const next = Math.max(0, (prev[productId] ?? 0) + delta);
      return { ...prev, [productId]: next };
    });
  };

  const saveItemChanges = async () => {
    if (!sub) return;
    const items = Object.entries(draftQuantities)
      .filter(([, quantity]) => quantity > 0)
      .map(([productId, quantity]) => ({ productId, quantity }));
    if (items.length === 0) {
      setItemsError("Keep at least one product, or cancel this delivery instead.");
      return;
    }
    setSavingItems(true);
    setItemsError("");
    try {
      setSub(await regularDeliveriesService.updateSubscriptionItems(sub.id, items));
      setEditingItems(false);
    } catch (err) {
      setItemsError(err instanceof Error ? err.message : "Couldn't save these changes.");
    } finally {
      setSavingItems(false);
    }
  };

  const confirmCancel = () => {
    Alert.alert("Cancel this Regular Delivery?", "Future renewals will stop. This can't be undone.", [
      { text: "Keep it", style: "cancel" },
      { text: "Cancel delivery", style: "destructive", onPress: () => runAction("cancel", () => regularDeliveriesService.cancelSubscription(id)) },
    ]);
  };

  const isActive = sub?.status === "ACTIVE";
  const isPaused = sub?.status === "PAUSED";
  const latestRenewal = sub?.renewals?.[0];
  const needsPriceApproval = latestRenewal?.status === "AWAITING_PRICE_APPROVAL";
  const needsPaymentRetry = latestRenewal?.status === "PAYMENT_FAILED";

  return (
    <View style={premiumStyles.page}>
      <PremiumHeader title={sub?.offer?.title ?? "Regular Delivery"} subtitle={sub?.offer?.vendor?.storeName} onBack={() => goBackOrReplace(router, "/(buyer)/regular-deliveries" as any)} />

      {loading ? (
        <LoadingBlock />
      ) : error || !sub ? (
        <View style={premiumStyles.block}>
          <ErrorState
            title="We couldn't load this Regular Delivery"
            message={error || "Check your connection and try again."}
            onRetry={() => void load()}
          />
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={[premiumStyles.scrollContent, { paddingTop: 18 }]} showsVerticalScrollIndicator={false}>
          <View style={[premiumStyles.block, { gap: 16 }]}>
            {needsPriceApproval && latestRenewal ? (
              <FloatingCard style={styles.alertCardWarning}>
                <View style={styles.alertRow}>
                  <Ionicons name="pricetag-outline" size={18} color="#B48A00" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.alertTitle}>Price change needs your approval</Text>
                    <Text style={styles.alertBody}>{sub.offer?.vendor?.storeName ?? "Your vendor"} updated a price on your next delivery.</Text>
                  </View>
                </View>
                <View style={styles.alertActions}>
                  <TouchableOpacity
                    disabled={actionBusy === "price-accept"}
                    onPress={() => void runRenewalAction("price-accept", () => regularDeliveriesService.decideRenewalPriceChange(latestRenewal.id, "accepted"))}
                    style={styles.alertBtnPrimary}
                  >
                    {actionBusy === "price-accept" ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.alertBtnPrimaryText}>Approve</Text>}
                  </TouchableOpacity>
                  <TouchableOpacity
                    disabled={actionBusy === "price-decline"}
                    onPress={() => void runRenewalAction("price-decline", () => regularDeliveriesService.decideRenewalPriceChange(latestRenewal.id, "declined"))}
                    style={styles.alertBtnGhost}
                  >
                    {actionBusy === "price-decline" ? <ActivityIndicator size="small" color="#516A60" /> : <Text style={styles.alertBtnGhostText}>Skip this delivery</Text>}
                  </TouchableOpacity>
                </View>
              </FloatingCard>
            ) : null}

            {needsPaymentRetry && latestRenewal ? (
              <FloatingCard style={styles.alertCardError}>
                <View style={styles.alertRow}>
                  <Ionicons name="card-outline" size={18} color="#D6552F" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.alertTitle}>Payment failed</Text>
                    <Text style={styles.alertBody}>{latestRenewal.failureReason ?? "We couldn't collect payment for your last delivery."}</Text>
                  </View>
                </View>
                <TouchableOpacity
                  disabled={actionBusy === "retry-payment"}
                  onPress={() => void runRenewalAction("retry-payment", () => regularDeliveriesService.retryRenewalPayment(latestRenewal.id))}
                  style={[styles.alertBtnPrimary, { backgroundColor: "#D6552F", alignSelf: "flex-start", marginTop: 10 }]}
                >
                  {actionBusy === "retry-payment" ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.alertBtnPrimaryText}>Retry payment</Text>}
                </TouchableOpacity>
              </FloatingCard>
            ) : null}

            <FloatingCard>
              <View style={styles.summaryTopRow}>
                <StatusPill
                  label={sub.status.replace("_", " ")}
                  tone={isActive ? "success" : isPaused ? "warning" : sub.status === "PAYMENT_ATTENTION" ? "error" : "neutral"}
                />
                <Text style={styles.summaryFrequency}>{FREQUENCY_LABELS[sub.frequency]}</Text>
              </View>
              <Text style={styles.nextRenewalLabel}>Next renewal</Text>
              <Text style={styles.nextRenewalValue}>{isPaused ? "Paused" : formatDate(sub.nextRenewalAt)}</Text>
            </FloatingCard>

            <View>
              <View style={styles.sectionTitleRow}>
                <Text style={styles.sectionTitle}>Products</Text>
                {(isActive || isPaused) && !editingItems ? (
                  <TouchableOpacity onPress={startEditingItems} activeOpacity={0.85}>
                    <Text style={styles.editLink}>Edit</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
              <FloatingCard style={{ padding: 0, overflow: "hidden" }}>
                {sub.items.map((item, index) => (
                  <View key={item.id} style={[styles.itemRow, index > 0 && styles.itemRowBorder]}>
                    <Text style={styles.itemTitle} numberOfLines={1}>{item.product.title}</Text>
                    {editingItems ? (
                      <View style={styles.editQuantityRow}>
                        <TouchableOpacity onPress={() => changeDraftQuantity(item.productId, -1)} activeOpacity={0.85} style={styles.editStepperBtn}>
                          <Ionicons name="remove" size={14} color="#076B51" />
                        </TouchableOpacity>
                        <Text style={styles.editQuantityValue}>{draftQuantities[item.productId] ?? item.quantity}</Text>
                        <TouchableOpacity onPress={() => changeDraftQuantity(item.productId, 1)} activeOpacity={0.85} style={styles.editStepperBtn}>
                          <Ionicons name="add" size={14} color="#076B51" />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <Text style={styles.itemMeta}>x{item.quantity} · {formatDisplayMoney(item.product.priceInCents / 100, item.product.currency, selectedCurrency)}</Text>
                    )}
                  </View>
                ))}
              </FloatingCard>
              {editingItems ? (
                <View style={{ marginTop: 10 }}>
                  {itemsError ? <Text style={styles.itemsErrorText}>{itemsError}</Text> : null}
                  <Text style={styles.editHint}>Set a product to 0 to remove it. Changes apply from your next renewal.</Text>
                  <View style={styles.editActionsRow}>
                    <TouchableOpacity onPress={cancelEditingItems} disabled={savingItems} activeOpacity={0.85} style={styles.editCancelBtn}>
                      <Text style={styles.editCancelBtnText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => void saveItemChanges()} disabled={savingItems} activeOpacity={0.85} style={styles.editSaveBtn}>
                      {savingItems ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.editSaveBtnText}>Save changes</Text>}
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null}
            </View>

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

            <View>
              <Text style={styles.sectionTitle}>Renewal history</Text>
              {(sub.renewals ?? []).length === 0 ? (
                <FloatingCard><Text style={styles.emptyRenewals}>No renewals yet.</Text></FloatingCard>
              ) : (
                <View style={{ gap: 8 }}>
                  {(sub.renewals ?? []).map((r) => {
                    const trackable = Boolean(r.orderId);
                    const card = (
                      <FloatingCard style={styles.renewalRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.renewalDate}>{formatDate(r.cycleDate)}</Text>
                          <View style={{ marginTop: 6 }}>
                            <StatusPill
                              label={RENEWAL_STATUS_LABELS[r.status]}
                              tone={r.status === "ORDER_CREATED" ? "success" : r.status === "PAYMENT_FAILED" ? "error" : "neutral"}
                            />
                          </View>
                        </View>
                        {r.subtotalAmount ? (
                          <Text style={styles.renewalAmount}>{formatDisplayMoney(r.subtotalAmount / 100, r.currency, selectedCurrency)}</Text>
                        ) : null}
                        {trackable ? <Ionicons name="chevron-forward" size={16} color="#C7D2CB" /> : null}
                      </FloatingCard>
                    );
                    return trackable ? (
                      <TouchableOpacity key={r.id} activeOpacity={0.85} onPress={() => router.push({ pathname: "/(buyer)/track-order", params: { id: r.orderId! } } as any)}>
                        {card}
                      </TouchableOpacity>
                    ) : (
                      <View key={r.id}>{card}</View>
                    );
                  })}
                </View>
              )}
            </View>
          </View>
        </ScrollView>
      )}
    </View>
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
    <TouchableOpacity disabled={busy} onPress={onPress} activeOpacity={0.85} style={{ flex: 1 }}>
      <FloatingCard style={styles.actionButton}>
        {busy ? (
          <ActivityIndicator size="small" color={tone === "danger" ? "#D6552F" : "#076B51"} />
        ) : (
          <Ionicons name={icon} size={18} color={tone === "danger" ? "#D6552F" : "#076B51"} />
        )}
        <Text style={[styles.actionButtonText, tone === "danger" && { color: "#D6552F" }]}>{label}</Text>
      </FloatingCard>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  alertCardWarning: { backgroundColor: "#FFFBEF" },
  alertCardError: { backgroundColor: "#FFF6F3" },
  alertRow: { flexDirection: "row", gap: 10 },
  alertTitle: { fontSize: 13, fontFamily: "Manrope-Bold", color: "#151E1B" },
  alertBody: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#6A7B72", marginTop: 2, lineHeight: 17 },
  alertActions: { flexDirection: "row", gap: 8, marginTop: 10 },
  alertBtnPrimary: { backgroundColor: "#076B51", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9, alignItems: "center", justifyContent: "center" },
  alertBtnPrimaryText: { fontSize: 12, fontFamily: "Manrope-Bold", color: "#FFFFFF" },
  alertBtnGhost: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9, borderWidth: 1, borderColor: "#DCE3DF", alignItems: "center", justifyContent: "center" },
  alertBtnGhostText: { fontSize: 12, fontFamily: "Manrope-Bold", color: "#516A60" },
  summaryTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  summaryFrequency: { fontSize: 12, fontFamily: "Manrope-SemiBold", color: "#6A7B72" },
  nextRenewalLabel: { fontSize: 11, fontFamily: "Outfit-Regular", color: "#8AA194", marginTop: 14 },
  nextRenewalValue: { fontSize: 20, fontFamily: "Manrope-ExtraBold", color: "#151E1B", marginTop: 2, textTransform: "capitalize" },
  sectionTitle: { fontSize: 15, fontFamily: "Manrope-ExtraBold", color: "#12221A", marginBottom: 10 },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  editLink: { fontSize: 13, fontFamily: "Manrope-Bold", color: "#076B51", marginBottom: 10 },
  editQuantityRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  editStepperBtn: { width: 28, height: 28, borderRadius: 9, backgroundColor: "rgba(7,107,81,0.08)", alignItems: "center", justifyContent: "center" },
  editQuantityValue: { fontSize: 13, fontFamily: "Manrope-Bold", color: "#151E1B", minWidth: 18, textAlign: "center" },
  editHint: { fontSize: 11, fontFamily: "Outfit-Regular", color: "#8AA194", marginBottom: 10 },
  itemsErrorText: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#D6552F", marginBottom: 8 },
  editActionsRow: { flexDirection: "row", gap: 10 },
  editCancelBtn: { flex: 1, minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: "#DCE3DF", alignItems: "center", justifyContent: "center" },
  editCancelBtnText: { fontSize: 13, fontFamily: "Manrope-SemiBold", color: "#516A60" },
  editSaveBtn: { flex: 1, minHeight: 44, borderRadius: 12, backgroundColor: "#076B51", alignItems: "center", justifyContent: "center" },
  editSaveBtnText: { fontSize: 13, fontFamily: "Manrope-Bold", color: "#FFFFFF" },
  itemRow: { flexDirection: "row", justifyContent: "space-between", padding: 14, alignItems: "center" },
  itemRowBorder: { borderTopWidth: 1, borderTopColor: "#F0F0F0" },
  itemTitle: { flex: 1, fontSize: 13, fontFamily: "Manrope-SemiBold", color: "#151E1B" },
  itemMeta: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#6A7B72" },
  actionsGrid: { flexDirection: "row", gap: 10 },
  actionButton: { alignItems: "center", gap: 6, paddingVertical: 6 },
  actionButtonText: { fontSize: 12, fontFamily: "Manrope-Bold", color: "#076B51" },
  emptyRenewals: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#6A7B72", paddingVertical: 12, textAlign: "center" },
  renewalRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  renewalDate: { fontSize: 13, fontFamily: "Manrope-SemiBold", color: "#151E1B" },
  renewalAmount: { fontSize: 13, fontFamily: "Manrope-Bold", color: "#151E1B" },
});
