import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ApiRequestError } from "../../services/api";
import { orderService } from "../../services/orderService";
import type { Order } from "../../types/order";

const ISSUES = [
  { id: "not_received", label: "Order not received", detail: "The order has not arrived as expected." },
  { id: "wrong_item", label: "Wrong item", detail: "The delivered goods do not match what was ordered." },
  { id: "damaged", label: "Damaged item", detail: "The items arrived damaged or unusable." },
  { id: "other", label: "Other issue", detail: "Another delivery or escrow issue needs support." },
];

export default function ReportIssueScreen() {
  const router = useRouter();
  const { orderId } = useLocalSearchParams<{ orderId?: string }>();
  const initialOrderId = typeof orderId === "string" && orderId.length > 0 ? orderId : undefined;
  const [selected, setSelected] = useState<string | null>(ISSUES[0]?.id ?? null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string | undefined>(initialOrderId);
  const [loadingOrders, setLoadingOrders] = useState(!initialOrderId);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const resolvedIssue = useMemo(
    () => ISSUES.find((issue) => issue.id === selected) ?? ISSUES[0],
    [selected],
  );

  useEffect(() => {
    if (initialOrderId) return;
    let active = true;
    setLoadingOrders(true);
    orderService
      .getBuyerOrders()
      .then((list) => {
        if (!active) return;
        const eligible = (list ?? []).filter((order) => !["cancelled", "refunded"].includes(order.status));
        setOrders(eligible);
        setSelectedOrderId((current) => current ?? eligible[0]?.id);
      })
      .catch(() => {
        if (active) setOrders([]);
      })
      .finally(() => {
        if (active) setLoadingOrders(false);
      });
    return () => {
      active = false;
    };
  }, [initialOrderId]);

  const selectedOrder = useMemo(
    () => orders.find((order) => order.id === selectedOrderId) ?? null,
    [orders, selectedOrderId],
  );

  const canSubmit = typeof selectedOrderId === "string" && selectedOrderId.length > 0;

  const submitIssue = async () => {
    const targetOrderId = selectedOrderId;
    if (!targetOrderId) {
      Alert.alert("Support required", "This screen needs a real order before a dispute can be opened.");
      return;
    }
    if (!resolvedIssue) return;

    const reason = [resolvedIssue.label, notes.trim()].filter(Boolean).join(" — ");

    setSubmitting(true);
    try {
      await orderService.openBuyerDispute(targetOrderId, reason);
      setSubmitted(true);
      Alert.alert("Dispute opened", "The escrow is now frozen while support reviews the case.");
    } catch (err) {
      if (err instanceof ApiRequestError && err.status === 409) {
        Alert.alert("Dispute already exists", err.message);
      } else {
        Alert.alert("Could not open dispute", err instanceof Error ? err.message : "Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.85} style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color="#282828" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Report an issue</Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Buyer protection</Text>
          <Text style={styles.sectionBody}>
            If this escrow order was shipped but something went wrong, open a dispute here. The backend keeps funds frozen until an admin resolves it.
          </Text>
          {initialOrderId ? (
            <Text style={styles.orderMeta}>Order reference: {initialOrderId}</Text>
          ) : loadingOrders ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color="#076B51" size="small" />
              <Text style={styles.loadingText}>Loading your orders...</Text>
            </View>
          ) : orders.length > 0 ? (
            <View style={styles.orderPicker}>
              <Text style={styles.pickerLabel}>Choose the order</Text>
              {orders.map((order) => {
                const active = order.id === selectedOrderId;
                return (
                  <TouchableOpacity
                    key={order.id}
                    onPress={() => setSelectedOrderId(order.id)}
                    activeOpacity={0.85}
                    style={[styles.orderChoice, active && styles.orderChoiceActive]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.orderChoiceTitle, active && styles.orderChoiceTitleActive]}>
                        {order.orderNumber}
                      </Text>
                      <Text style={[styles.orderChoiceMeta, active && styles.orderChoiceMetaActive]} numberOfLines={1}>
                        {order.vendorName} - {order.items.length} item{order.items.length === 1 ? "" : "s"}
                      </Text>
                    </View>
                    <Ionicons name={active ? "radio-button-on" : "radio-button-off"} size={18} color={active ? "#076B51" : "#A8B0B6"} />
                  </TouchableOpacity>
                );
              })}
              {selectedOrder ? <Text style={styles.orderMeta}>Selected: {selectedOrder.orderNumber}</Text> : null}
            </View>
          ) : (
            <Text style={[styles.orderMeta, styles.warningText]}>
              No eligible order was found. Open a specific order from My Orders if you need support.
            </Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>What happened?</Text>
          <View style={styles.issueList}>
            {ISSUES.map((issue) => {
              const active = issue.id === selected;
              return (
                <TouchableOpacity
                  key={issue.id}
                  onPress={() => setSelected(issue.id)}
                  activeOpacity={0.85}
                  style={[styles.issueItem, active && styles.issueItemActive]}
                >
                  <View style={styles.issueCopy}>
                    <Text style={[styles.issueTitle, active && styles.issueTitleActive]}>{issue.label}</Text>
                    <Text style={[styles.issueDetail, active && styles.issueDetailActive]}>{issue.detail}</Text>
                  </View>
                  <View style={[styles.radio, active && styles.radioActive]}>
                    {active ? <View style={styles.radioInner} /> : null}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Add details</Text>
          <View style={styles.textAreaWrap}>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              multiline
              textAlignVertical="top"
              placeholder="Describe what happened so support can review the escrow case."
              placeholderTextColor="#8A8F94"
              style={styles.textArea}
            />
          </View>
          <Text style={styles.helperText}>
            Keep communication on Eki so support can follow the full timeline.
          </Text>
        </View>

        <TouchableOpacity
          onPress={submitIssue}
          activeOpacity={0.85}
          style={[styles.submitBtn, (!canSubmit || submitting || submitted) && styles.submitBtnDisabled]}
          disabled={!canSubmit || submitting || submitted}
        >
          <Ionicons name="warning-outline" size={16} color="#FFFFFF" />
          <Text style={styles.submitBtnText}>
            {submitted ? "Dispute submitted" : submitting ? "Submitting..." : "Open Dispute"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push("/(buyer)/messages" as any)} activeOpacity={0.85} style={styles.messageBtn}>
          <Text style={styles.messageBtnText}>Message Vendor</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FAF9F5" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 16, gap: 12 },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#F4F4F4", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 22, fontFamily: "Manrope-Bold", color: "#282828" },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40, gap: 16 },
  card: { backgroundColor: "#FFFFFF", borderRadius: 24, padding: 18 },
  sectionTitle: { fontSize: 18, fontFamily: "Manrope-Bold", color: "#282828", marginBottom: 10 },
  sectionBody: { fontSize: 14, lineHeight: 21, fontFamily: "Outfit-Regular", color: "#687076" },
  orderMeta: { fontSize: 12, lineHeight: 18, fontFamily: "Outfit-Medium", color: "#076B51", marginTop: 12 },
  warningText: { color: "#D97706" },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 14 },
  loadingText: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#687076" },
  orderPicker: { marginTop: 14, gap: 8 },
  pickerLabel: { fontSize: 12, fontFamily: "Manrope-Bold", color: "#282828" },
  orderChoice: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 14, padding: 12 },
  orderChoiceActive: { borderColor: "#076B51", backgroundColor: "#F0F7F4" },
  orderChoiceTitle: { fontSize: 13, fontFamily: "Manrope-Bold", color: "#282828" },
  orderChoiceTitleActive: { color: "#076B51" },
  orderChoiceMeta: { fontSize: 11, fontFamily: "Outfit-Regular", color: "#687076", marginTop: 2 },
  orderChoiceMetaActive: { color: "#24564A" },
  issueList: { gap: 10 },
  issueItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#ECECEC",
    padding: 14,
  },
  issueItemActive: {
    borderColor: "#076B51",
    backgroundColor: "rgba(7,107,81,0.05)",
  },
  issueCopy: { flex: 1 },
  issueTitle: { fontSize: 15, lineHeight: 21, fontFamily: "Manrope-Bold", color: "#282828" },
  issueTitleActive: { color: "#076B51" },
  issueDetail: { fontSize: 13, lineHeight: 19, fontFamily: "Outfit-Regular", color: "#687076", marginTop: 4 },
  issueDetailActive: { color: "#24564A" },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: "#C8CCD0",
    alignItems: "center",
    justifyContent: "center",
  },
  radioActive: { borderColor: "#076B51" },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#076B51" },
  textAreaWrap: { backgroundColor: "#F6F7F7", borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  textArea: { minHeight: 110, fontSize: 14, lineHeight: 20, fontFamily: "Outfit-Regular", color: "#282828" },
  helperText: { fontSize: 12, lineHeight: 18, fontFamily: "Outfit-Regular", color: "#8A8F94", marginTop: 10 },
  submitBtn: {
    height: 54,
    borderRadius: 16,
    backgroundColor: "#FB6363",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  submitBtnDisabled: { opacity: 0.55 },
  submitBtnText: { fontSize: 15, fontFamily: "Manrope-Bold", color: "#FFFFFF" },
  messageBtn: {
    height: 54,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "#076B51",
    alignItems: "center",
    justifyContent: "center",
  },
  messageBtnText: { fontSize: 15, fontFamily: "Manrope-Bold", color: "#076B51" },
});
