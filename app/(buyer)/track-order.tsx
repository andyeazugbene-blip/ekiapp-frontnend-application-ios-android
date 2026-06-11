import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ApiRequestError } from "../../services/api";
import {
  canBuyerConfirmDelivery,
  canBuyerOpenDispute,
  deriveEscrowStatus,
  getEscrowStatusColor,
  getEscrowStatusLabel,
  getEscrowTimeline,
} from "../../services/escrowStatus";
import { orderService, type Shipment } from "../../services/orderService";
import type { Order } from "../../types/order";
import { openConversationThread } from "../../utils/messaging";
import { vendorService } from "../../services/vendorService";
import { goBackOrReplace } from "../../utils/navigation";

const DISPUTE_OPTIONS = [
  { id: "not_received", label: "Order not received" },
  { id: "wrong_item", label: "Wrong item" },
  { id: "damaged", label: "Damaged item" },
  { id: "other", label: "Other" },
];

import { useCurrencyStore } from "../../stores/currencyStore";
import { formatDisplayMoney } from "../../utils/currency";

function paymentProviderLabel(order?: Order | null): string {
  const provider = (order?.paymentProvider ?? "").toLowerCase();
  if (provider === "paystack") return "Paystack";
  if (provider === "stripe") return "Stripe";
  if (provider === "wallet") return "Wallet";
  if ((order?.escrowType ?? "").toLowerCase() === "domestic_africa") return "Paystack";
  return "Provider unavailable";
}

function supportCopy(order?: Order | null): string {
  if ((order?.escrowType ?? "").toLowerCase() !== "domestic_africa") {
    return "This order uses standard payment protection.";
  }
  return "Your payment is protected and released to the vendor after delivery is confirmed or after the protection period.";
}

export default function TrackOrderScreen() {
  const { selectedCurrency } = useCurrencyStore();

  const formatMoney = (orderOrCurrency: any, amount?: number): string => {
    const sourceCurrency = typeof orderOrCurrency === "string"
      ? orderOrCurrency
      : (orderOrCurrency?.currency ?? "GBP");
    return formatDisplayMoney(amount ?? 0, sourceCurrency, selectedCurrency);
  };

  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; orderId?: string }>();
  const resolvedOrderId = typeof params.orderId === "string" && params.orderId.length > 0 ? params.orderId : params.id;

  const [order, setOrder] = useState<Order | null>(null);
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [confirmCode, setConfirmCode] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [resendingOtp, setResendingOtp] = useState(false);
  const [otpDeliveryHint, setOtpDeliveryHint] = useState("");
  const [disputeModalVisible, setDisputeModalVisible] = useState(false);
  const [disputeReason, setDisputeReason] = useState<string>(DISPUTE_OPTIONS[0].id);
  const [disputeSubmitting, setDisputeSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!resolvedOrderId) {
      setError("Missing order id.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const [nextOrder, nextShipment] = await Promise.all([
        orderService.getBuyerOrderById(resolvedOrderId),
        orderService.getShipmentByOrder(resolvedOrderId).catch(() => null),
      ]);
      setOrder(nextOrder);
      setShipment(nextShipment);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load order details.");
    } finally {
      setLoading(false);
    }
  }, [resolvedOrderId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const escrowStatus = useMemo(() => deriveEscrowStatus(order), [order]);
  const timeline = useMemo(() => getEscrowTimeline(order), [order]);
  const confirmDeliveryEnabled = canBuyerConfirmDelivery(order);
  const disputeEnabled = canBuyerOpenDispute(order);
  const isEscrowOrder = (order?.escrowType ?? "").toLowerCase() === "domestic_africa";

  const handleConfirmDelivery = async () => {
    if (!order) return;
    if (!confirmCode.trim()) {
      Alert.alert("Enter delivery code", "Ask the rider for the 6-digit delivery code and enter it here.");
      return;
    }

    setConfirming(true);
    try {
      await orderService.confirmBuyerDelivery(order.id, confirmCode.trim());
      setConfirmModalVisible(false);
      setConfirmCode("");
      await load();
      Alert.alert("Delivery confirmed", "Thank you. The backend will release the protected funds to the vendor.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not confirm delivery.";
      Alert.alert("Confirmation failed", message);
    } finally {
      setConfirming(false);
    }
  };

  const handleResendOtp = async () => {
    if (!order) return;
    setResendingOtp(true);
    try {
      const result = await orderService.resendBuyerDeliveryOtp(order.id);
      const hint = result.otpSentTo ? `A new OTP was sent to ${result.otpSentTo}.` : "A new OTP was sent.";
      setOtpDeliveryHint(hint);
      Alert.alert("OTP sent", hint);
    } catch (err) {
      Alert.alert("Could not resend OTP", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setResendingOtp(false);
    }
  };

  const handleDisputePress = () => {
    if (!order) return;

    if (!disputeEnabled) {
      Alert.alert(
        "Report unavailable",
        isEscrowOrder
          ? "You can only report an issue after the order is shipped and before payment is released or refunded."
          : "Support will need to review this issue manually for non-escrow orders.",
      );
      return;
    }

    setDisputeModalVisible(true);
  };

  const handleMessageVendor = () => {
    if (!order) return;
    const start = async () => {
      const vendor = await vendorService.getVendorById(order.vendorId);
      return openConversationThread({
        participantId: vendor.userId ?? order.vendorId,
        participantName: vendor.storeName || order.vendorName,
        participantAvatar: vendor.avatar ?? vendor.coverImage,
        participantRole: "vendor",
        orderId: order.id,
      });
    };
    start()
      .then(() => router.push("/(buyer)/message-chat" as any))
      .catch((err) => {
        Alert.alert("Message unavailable", err instanceof Error ? err.message : "Could not open the conversation.");
      });
  };

  const handleSubmitDispute = async () => {
    if (!order) return;
    const selectedIssue = DISPUTE_OPTIONS.find((item) => item.id === disputeReason);
    if (!selectedIssue) return;

    setDisputeSubmitting(true);
    try {
      await orderService.openBuyerDispute(order.id, selectedIssue.label);
      setDisputeModalVisible(false);
      await load();
      Alert.alert("Dispute opened", "The issue is now recorded and payment protection remains active while support reviews it.");
    } catch (err) {
      if (err instanceof ApiRequestError && err.status === 409) {
        Alert.alert("Dispute already exists", err.message);
      } else {
        Alert.alert("Could not open dispute", err instanceof Error ? err.message : "Please try again.");
      }
    } finally {
      setDisputeSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <Header onBack={() => goBackOrReplace(router, "/(buyer)/orders" as any)} />
        <View style={styles.stateScreen}>
          <ActivityIndicator color="#076B51" />
        </View>
      </SafeAreaView>
    );
  }

  if (!order) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <Header onBack={() => goBackOrReplace(router, "/(buyer)/orders" as any)} />
        <View style={styles.stateScreen}>
          <Text style={styles.errorText}>{error || "Order not found."}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Header onBack={() => goBackOrReplace(router, "/(buyer)/orders" as any)} />

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.summaryCard}>
          <View style={styles.summaryTop}>
            <View>
              <Text style={styles.summaryTitle}>Order summary</Text>
              <Text style={styles.orderNumber}>{order.orderNumber}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: `${getEscrowStatusColor(escrowStatus)}18` }]}>
              <Text style={[styles.statusBadgeText, { color: getEscrowStatusColor(escrowStatus) }]}>
                {getEscrowStatusLabel(escrowStatus)}
              </Text>
            </View>
          </View>

          <View style={styles.summaryGrid}>
            <InfoTile label="Payment provider" value={paymentProviderLabel(order)} />
            <InfoTile label="Total" value={formatMoney(order, order.total)} />
            <InfoTile label="Payment status" value={order.paymentStatus.replace(/\b\w/g, (char) => char.toUpperCase())} />
            <InfoTile label="Delivery country" value={order.deliveryDetails.country || "Unavailable"} />
          </View>

          {isEscrowOrder ? (
            <View style={styles.protectionCard}>
              <Ionicons name="shield-checkmark-outline" size={18} color="#076B51" />
              <Text style={styles.protectionText}>{supportCopy(order)}</Text>
            </View>
          ) : null}

          {shipment?.trackingNumber ? (
            <Text style={styles.shipmentMeta}>
              {shipment.carrier ? `${shipment.carrier} • ` : ""}
              {shipment.trackingNumber}
            </Text>
          ) : null}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Payment timeline</Text>
          {timeline.map((step, index) => (
            <View key={step.key} style={styles.timelineRow}>
              <View style={styles.timelineRail}>
                <View
                  style={[
                    styles.timelineDot,
                    step.done && styles.timelineDotDone,
                    step.current && styles.timelineDotCurrent,
                  ]}
                />
                {index < timeline.length - 1 ? (
                  <View
                    style={[
                      styles.timelineLine,
                      (step.done || step.current) && styles.timelineLineActive,
                    ]}
                  />
                ) : null}
              </View>
              <View style={styles.timelineCopy}>
                <Text style={styles.timelineLabel}>{step.label}</Text>
                <Text style={styles.timelineCaption}>{step.caption}</Text>
              </View>
            </View>
          ))}
        </View>

        {isEscrowOrder ? (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Delivery OTP</Text>
            <Text style={styles.deliveryText}>
              When the vendor dispatches this order, Eki sends a 6-digit delivery OTP to your phone. Enter it here after
              you receive the goods so the backend can confirm delivery and release payment safely.
            </Text>
            {otpDeliveryHint ? <Text style={styles.otpHintText}>{otpDeliveryHint}</Text> : null}
            <TouchableOpacity
              activeOpacity={0.86}
              onPress={() => setConfirmModalVisible(true)}
              disabled={!confirmDeliveryEnabled}
              style={[styles.otpActionButton, !confirmDeliveryEnabled && styles.buttonDisabled]}
            >
              <Ionicons name="keypad-outline" size={18} color="#FFFFFF" />
              <Text style={styles.otpActionButtonText}>
                {confirmDeliveryEnabled ? "Enter delivery OTP" : "Waiting for dispatch OTP"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.86}
              onPress={handleResendOtp}
              disabled={!confirmDeliveryEnabled || resendingOtp}
              style={[styles.otpResendButton, (!confirmDeliveryEnabled || resendingOtp) && styles.buttonDisabled]}
            >
              <Text style={styles.otpResendText}>{resendingOtp ? "Sending OTP..." : "Resend OTP to phone"}</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Delivery details</Text>
          <Text style={styles.deliveryText}>
            {order.deliveryAddress || order.deliveryDetails.address || "Delivery address unavailable."}
          </Text>
          {order.escrowExpiresAt ? (
            <Text style={styles.helperText}>
              Protection window ends {new Date(order.escrowExpiresAt).toLocaleString()}
            </Text>
          ) : null}
        </View>
      </ScrollView>

      <View style={styles.bottomActions}>
        {isEscrowOrder ? (
          <TouchableOpacity
            activeOpacity={0.86}
            onPress={() => setConfirmModalVisible(true)}
            disabled={!confirmDeliveryEnabled}
            style={[styles.primaryButton, !confirmDeliveryEnabled && styles.buttonDisabled]}
          >
            <Text style={styles.primaryButtonText}>Confirm Delivery</Text>
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity activeOpacity={0.86} onPress={handleMessageVendor} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Message Vendor</Text>
        </TouchableOpacity>

        <TouchableOpacity activeOpacity={0.86} onPress={handleDisputePress}>
          <Text style={[styles.disputeText, !disputeEnabled && styles.disputeTextMuted]}>
            {disputeEnabled ? "Open Dispute / Report Issue" : "Report Issue"}
          </Text>
        </TouchableOpacity>
      </View>

      <Modal visible={confirmModalVisible} transparent animationType="fade" onRequestClose={() => setConfirmModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Confirm delivery</Text>
            <Text style={styles.modalBody}>
              Enter the 6-digit OTP sent to your phone when the vendor dispatched the order. Payment is only released after the backend confirms this code.
            </Text>
            {otpDeliveryHint ? <Text style={styles.otpHintText}>{otpDeliveryHint}</Text> : null}

            <View style={styles.codeInputWrap}>
              <TextInput
                value={confirmCode}
                onChangeText={(value) => setConfirmCode(value.replace(/\D/g, "").slice(0, 6))}
                keyboardType="number-pad"
                placeholder="123456"
                placeholderTextColor="#8A8F94"
                maxLength={6}
                style={styles.codeInput}
              />
            </View>

            <TouchableOpacity
              activeOpacity={0.86}
              onPress={handleConfirmDelivery}
              disabled={confirming}
              style={[styles.modalPrimaryButton, confirming && styles.buttonDisabled]}
            >
              <Text style={styles.modalPrimaryButtonText}>{confirming ? "Confirming..." : "Confirm Delivery"}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.86}
              onPress={handleResendOtp}
              disabled={resendingOtp}
              style={styles.modalLinkButton}
            >
              <Text style={styles.modalLinkButtonText}>{resendingOtp ? "Sending OTP..." : "Resend OTP to phone"}</Text>
            </TouchableOpacity>

            <TouchableOpacity activeOpacity={0.86} onPress={() => setConfirmModalVisible(false)} style={styles.modalSecondaryButton}>
              <Text style={styles.modalSecondaryButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={disputeModalVisible} transparent animationType="fade" onRequestClose={() => setDisputeModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Report an issue</Text>
            <Text style={styles.modalBody}>Tell us what went wrong with your order.</Text>

            <View style={styles.disputeOptionList}>
              {DISPUTE_OPTIONS.map((option) => {
                const selected = disputeReason === option.id;
                return (
                  <TouchableOpacity
                    key={option.id}
                    onPress={() => setDisputeReason(option.id)}
                    activeOpacity={0.86}
                    style={[styles.disputeOption, selected && styles.disputeOptionActive]}
                  >
                    <Text style={[styles.disputeOptionText, selected && styles.disputeOptionTextActive]}>{option.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              activeOpacity={0.86}
              onPress={handleSubmitDispute}
              disabled={disputeSubmitting}
              style={[styles.disputeSubmitButton, disputeSubmitting && styles.buttonDisabled]}
            >
              <Ionicons name="warning-outline" size={16} color="#FFFFFF" />
              <Text style={styles.disputeSubmitButtonText}>{disputeSubmitting ? "Submitting..." : "Submit Issue"}</Text>
            </TouchableOpacity>

            <TouchableOpacity activeOpacity={0.86} onPress={() => setDisputeModalVisible(false)} style={styles.modalSecondaryButton}>
              <Text style={styles.modalSecondaryButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Header({ onBack }: { onBack: () => void }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={onBack} activeOpacity={0.86} style={styles.backButton}>
        <Ionicons name="arrow-back" size={22} color="#0A6C52" />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Track your order</Text>
    </View>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoTile}>
      <Text style={styles.infoTileLabel}>{label}</Text>
      <Text style={styles.infoTileValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FAF9F5" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  backButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#182722",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 3,
  },
  headerTitle: {
    color: "#2B2B2B",
    fontSize: 24,
    lineHeight: 30,
    fontFamily: "Manrope-ExtraBold",
  },
  stateScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  errorText: {
    color: "#FB6363",
    fontSize: 14,
    lineHeight: 20,
    fontFamily: "Outfit-Regular",
    textAlign: "center",
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 18,
  },
  summaryCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    padding: 20,
    shadowColor: "#182722",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 2,
  },
  summaryTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  summaryTitle: {
    color: "#8A8F94",
    fontSize: 13,
    lineHeight: 18,
    fontFamily: "Outfit-Regular",
  },
  orderNumber: {
    color: "#2B2B2B",
    fontSize: 20,
    lineHeight: 28,
    fontFamily: "Manrope-Bold",
    marginTop: 4,
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  statusBadgeText: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: "Manrope-SemiBold",
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 18,
  },
  infoTile: {
    width: "47%",
    backgroundColor: "#F6F7F7",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  infoTileLabel: {
    color: "#8A8F94",
    fontSize: 12,
    lineHeight: 16,
    fontFamily: "Outfit-Regular",
  },
  infoTileValue: {
    color: "#2B2B2B",
    fontSize: 15,
    lineHeight: 22,
    fontFamily: "Manrope-Bold",
    marginTop: 6,
  },
  protectionCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "rgba(7,107,81,0.08)",
    borderRadius: 18,
    padding: 14,
    marginTop: 16,
  },
  protectionText: {
    flex: 1,
    color: "#24564A",
    fontSize: 13,
    lineHeight: 19,
    fontFamily: "Outfit-Regular",
  },
  shipmentMeta: {
    color: "#076B51",
    fontSize: 12,
    lineHeight: 18,
    fontFamily: "Outfit-Medium",
    marginTop: 14,
  },
  sectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    padding: 20,
    shadowColor: "#182722",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.04,
    shadowRadius: 20,
    elevation: 2,
  },
  sectionTitle: {
    color: "#2B2B2B",
    fontSize: 18,
    lineHeight: 24,
    fontFamily: "Manrope-Bold",
    marginBottom: 18,
  },
  timelineRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    minHeight: 74,
  },
  timelineRail: {
    width: 30,
    alignItems: "center",
  },
  timelineDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#D6E3DD",
    marginTop: 4,
  },
  timelineDotDone: {
    backgroundColor: "#076B51",
  },
  timelineDotCurrent: {
    backgroundColor: "#D97706",
  },
  timelineLine: {
    width: 2,
    flex: 1,
    marginTop: 4,
    backgroundColor: "#D6E3DD",
  },
  timelineLineActive: {
    backgroundColor: "#076B51",
  },
  timelineCopy: {
    flex: 1,
    paddingLeft: 12,
    paddingBottom: 16,
  },
  timelineLabel: {
    color: "#2B2B2B",
    fontSize: 16,
    lineHeight: 22,
    fontFamily: "Manrope-Bold",
  },
  timelineCaption: {
    color: "#8A8F94",
    fontSize: 13,
    lineHeight: 19,
    fontFamily: "Outfit-Regular",
    marginTop: 4,
  },
  deliveryText: {
    color: "#2B2B2B",
    fontSize: 14,
    lineHeight: 21,
    fontFamily: "Outfit-Regular",
  },
  helperText: {
    color: "#8A8F94",
    fontSize: 12,
    lineHeight: 18,
    fontFamily: "Outfit-Regular",
    marginTop: 10,
  },
  otpActionButton: {
    height: 54,
    borderRadius: 16,
    backgroundColor: "#076B51",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 16,
  },
  otpActionButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    lineHeight: 21,
    fontFamily: "Manrope-Bold",
  },
  otpResendButton: {
    alignSelf: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 6,
  },
  otpResendText: {
    color: "#076B51",
    fontSize: 14,
    lineHeight: 20,
    fontFamily: "Manrope-SemiBold",
  },
  bottomActions: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 12,
    alignItems: "center",
  },
  primaryButton: {
    width: "100%",
    height: 56,
    borderRadius: 18,
    backgroundColor: "#076B51",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    lineHeight: 22,
    fontFamily: "Manrope-Bold",
  },
  secondaryButton: {
    width: "100%",
    height: 56,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: "#0A6C52",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    color: "#0A6C52",
    fontSize: 16,
    lineHeight: 22,
    fontFamily: "Manrope-Bold",
  },
  disputeText: {
    color: "#FB6363",
    fontSize: 15,
    lineHeight: 21,
    fontFamily: "Manrope-Bold",
  },
  disputeTextMuted: {
    color: "#C79595",
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(17,24,39,0.4)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  modalCard: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 22,
  },
  modalTitle: {
    color: "#2B2B2B",
    fontSize: 20,
    lineHeight: 28,
    fontFamily: "Manrope-Bold",
  },
  modalBody: {
    color: "#687076",
    fontSize: 14,
    lineHeight: 21,
    fontFamily: "Outfit-Regular",
    marginTop: 8,
  },
  otpHintText: {
    color: "#076B51",
    fontSize: 12,
    lineHeight: 18,
    fontFamily: "Outfit-Medium",
    marginTop: 10,
  },
  codeInputWrap: {
    marginTop: 18,
    backgroundColor: "#F6F7F7",
    borderRadius: 16,
    paddingHorizontal: 16,
  },
  codeInput: {
    height: 54,
    color: "#2B2B2B",
    fontSize: 18,
    lineHeight: 24,
    fontFamily: "Manrope-Bold",
    letterSpacing: 1.2,
  },
  modalPrimaryButton: {
    height: 54,
    borderRadius: 16,
    backgroundColor: "#076B51",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 18,
  },
  modalPrimaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    lineHeight: 21,
    fontFamily: "Manrope-Bold",
  },
  modalLinkButton: {
    alignSelf: "center",
    paddingVertical: 10,
    marginTop: 6,
  },
  modalLinkButtonText: {
    color: "#076B51",
    fontSize: 14,
    lineHeight: 20,
    fontFamily: "Manrope-SemiBold",
  },
  modalSecondaryButton: {
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
  modalSecondaryButtonText: {
    color: "#8A8F94",
    fontSize: 15,
    lineHeight: 21,
    fontFamily: "Manrope-Bold",
  },
  disputeOptionList: {
    marginTop: 18,
    gap: 10,
  },
  disputeOption: {
    borderRadius: 16,
    backgroundColor: "#F6F7F7",
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
  disputeOptionActive: {
    backgroundColor: "#2B2B2B",
  },
  disputeOptionText: {
    color: "#2B2B2B",
    fontSize: 15,
    fontFamily: "Manrope-SemiBold",
  },
  disputeOptionTextActive: {
    color: "#FFFFFF",
  },
  disputeSubmitButton: {
    height: 54,
    borderRadius: 16,
    backgroundColor: "#FB6363",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 18,
  },
  disputeSubmitButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    lineHeight: 21,
    fontFamily: "Manrope-Bold",
  },
});
