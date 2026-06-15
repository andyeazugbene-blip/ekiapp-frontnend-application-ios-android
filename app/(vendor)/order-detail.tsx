import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  canVendorConfirmEscrowOrder,
  canVendorMarkShipped,
  deriveEscrowStatus,
  getEscrowStatusLabel,
  getEscrowTimeline,
} from "../../services/escrowStatus";
import { orderService, type Shipment } from "../../services/orderService";
import { payoutService } from "../../services/payoutService";
import type { Order, VendorEarnings } from "../../types/order";
import { openConversationThread } from "../../utils/messaging";
import { goBackOrReplace } from "../../utils/navigation";

import { useCurrencyStore } from "../../stores/currencyStore";
import { formatDisplayMoney } from "../../utils/currency";

function paymentProviderLabel(order?: Order | null) {
  const provider = (order?.paymentProvider ?? "").toLowerCase();
  if (provider === "paystack") return "Paystack";
  if (provider === "stripe") return "Stripe";
  if (provider === "wallet") return "Wallet";
  if ((order?.escrowType ?? "").toLowerCase() === "domestic_africa") return "Paystack";
  return "Provider unavailable";
}

function formatShipmentStatus(status?: Shipment["status"]): string {
  if (!status) return "Not created";
  return status.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function deriveDeliveryLabel(order: Order, shipment: Shipment | null): string {
  if (shipment?.estimatedDelivery) return shipment.estimatedDelivery;
  if (order.status === "delivered" && order.deliveredAt) {
    return `Delivered ${new Date(order.deliveredAt).toLocaleDateString()}`;
  }
  if (order.status === "dispatched" || order.status === "in_transit") {
    return "In transit";
  }
  return order.deliveryDetails.estimatedDays || "2-4 days";
}

export default function OrderDetailScreen() {
  const { selectedCurrency } = useCurrencyStore();

  const formatMoney = (orderOrCurrency: any, amount?: number) => {
    const sourceCurrency = typeof orderOrCurrency === "string"
      ? orderOrCurrency
      : (orderOrCurrency?.currency ?? "GBP");
    return formatDisplayMoney(amount ?? 0, sourceCurrency, selectedCurrency);
  };

  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [earnings, setEarnings] = useState<VendorEarnings | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!id) {
      setError("Missing order id.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const [nextOrder, nextShipment, nextEarnings] = await Promise.all([
        orderService.getVendorOrderById(id),
        orderService.getShipmentByOrder(id).catch(() => null),
        payoutService.getEarnings().catch(() => null),
      ]);
      setOrder(nextOrder);
      setShipment(nextShipment);
      setEarnings(nextEarnings);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load order.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const escrowStatus = useMemo(() => deriveEscrowStatus(order), [order]);
  const timeline = useMemo(() => getEscrowTimeline(order), [order]);
  const isEscrowOrder = (order?.escrowType ?? "").toLowerCase() === "domestic_africa";
  const canConfirmEscrow = canVendorConfirmEscrowOrder(order);
  const canShip = canVendorMarkShipped(order);
  const standardOrderStatus = (order?.status ?? "").replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
  const displayStatusLabel = isEscrowOrder ? getEscrowStatusLabel(escrowStatus) : standardOrderStatus;
  const actionEnabled = isEscrowOrder ? canConfirmEscrow : order?.status === "pending" || order?.status === "paid";
  const actionDeadlineText = order?.escrowExpiresAt
    ? `Protection expires ${new Date(order.escrowExpiresAt).toLocaleString()}`
    : "Review the order details and confirm when everything is correct.";

  const handleAccept = async () => {
    if (!order) return;
    if (isEscrowOrder && !canConfirmEscrow) {
      Alert.alert("Awaiting secure confirmation", "This order cannot be accepted until payment is marked secure.");
      return;
    }

      setSubmitting(true);
    try {
      await orderService.acceptEscrowOrStandardOrder(order);
      await load();
    } catch (err) {
      Alert.alert("Could not accept order", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleMessageBuyer = async () => {
    if (!order) return;
    try {
      await openConversationThread({ participantId: order.buyerId, orderId: order.id });
      router.push("/(vendor)/message-chat" as any);
    } catch (err) {
      Alert.alert("Message unavailable", err instanceof Error ? err.message : "Could not open the conversation.");
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.stateScreen} edges={["top"]}>
        <ActivityIndicator color="#076B51" />
      </SafeAreaView>
    );
  }

  if (!order) {
    return (
      <SafeAreaView style={styles.stateScreen} edges={["top"]}>
        <Text style={styles.errorText}>{error || "Order not found."}</Text>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={["#0B6C52", "#0A7B5D"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <SafeAreaView edges={["top"]}>
            <View style={styles.headerRow}>
              <TouchableOpacity onPress={() => goBackOrReplace(router, "/(vendor)/orders" as any)} activeOpacity={0.86} style={styles.heroButton}>
                <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Order Details</Text>
              <TouchableOpacity onPress={handleMessageBuyer} activeOpacity={0.86} style={styles.heroButton}>
                <Ionicons name="chatbubble-ellipses-outline" size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <View style={styles.heroSummary}>
              <View style={styles.heroSummaryIcon}>
                <Ionicons name="cube-outline" size={24} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.heroLabel}>Order Summary</Text>
                <Text style={styles.heroOrderNumber}>#{order.orderNumber}</Text>
              </View>
              <View style={styles.heroBadge}>
                <Text style={styles.heroBadgeText}>{order.status === "pending" ? "New Order" : displayStatusLabel}</Text>
              </View>
            </View>

            <View style={styles.heroFooter}>
              <View>
                <Text style={styles.heroFooterLabel}>Order date</Text>
                <Text style={styles.heroFooterValue}>{new Date(order.createdAt).toLocaleDateString()}</Text>
              </View>
              <View>
                <Text style={styles.heroFooterLabel}>Payment provider</Text>
                <Text style={styles.heroFooterValue}>{paymentProviderLabel(order)}</Text>
              </View>
            </View>
          </SafeAreaView>
        </LinearGradient>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Buyer Information</Text>
          <View style={styles.buyerRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{(order.buyerName || "B").charAt(0).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.buyerName}>{order.buyerName || "Buyer"}</Text>
              <Text style={styles.buyerMeta}>Top rated buyer</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={18} color="#0A6C52" />
            <View style={{ flex: 1 }}>
              <Text style={styles.infoTitle}>Delivery Address</Text>
              <Text style={styles.infoValue}>{order.deliveryAddress || order.deliveryDetails.address || "Address unavailable"}</Text>
            </View>
          </View>

          <TouchableOpacity onPress={handleMessageBuyer} activeOpacity={0.86} style={styles.primaryAction}>
            <Text style={styles.primaryActionText}>Message Buyer</Text>
            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={styles.hintPill}>
            <Text style={styles.hintPillText}>Keep communication on Eki for secure transactions</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Foodstuff Ordered</Text>
          {(order.items ?? []).map((item, index) => (
            <View key={`${item.product.id}-${index}`} style={[styles.lineItem, index > 0 && styles.lineItemBorder]}>
              <View style={styles.lineItemThumb}>
                <Ionicons name="cube-outline" size={18} color="#0A6C52" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.lineItemName}>{item.product.name}</Text>
                <Text style={styles.lineItemMeta}>{item.quantity} x {formatMoney(order, item.product.price)}</Text>
              </View>
              <Text style={styles.lineItemTotal}>{formatMoney(order, item.product.price * item.quantity)}</Text>
            </View>
          ))}

          <View style={styles.summaryRows}>
            <SummaryRow label="Total items" value={String(order.items?.length ?? 0).padStart(2, "0")} />
            <SummaryRow label="Subtotal" value={formatMoney(order, order.subtotal)} />
            <SummaryRow label="Logistics fee" value={formatMoney(order, order.deliveryCost)} />
          </View>

          <View style={styles.totalBar}>
            <Text style={styles.totalBarLabel}>Order Total</Text>
            <Text style={styles.totalBarValue}>{formatMoney(order, order.total)}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Delivery Details</Text>
          <View style={styles.tileGrid}>
            <InfoTile label="Total Weight" value={`${order.deliveryDetails.totalWeight || 0}kg`} icon="barbell-outline" />
            <InfoTile label="Delivery Country" value={order.deliveryDetails.country || "Not set"} icon="globe-outline" />
            <InfoTile label="Delivery Cost" value={formatMoney(order, order.deliveryDetails.deliveryCost || order.deliveryCost)} icon="wallet-outline" />
            <InfoTile label="Estimated Delivery" value={deriveDeliveryLabel(order, shipment)} icon="car-outline" dark />
          </View>
        </View>

        <LinearGradient colors={["#151515", "#2A2A2A"]} style={styles.paymentCard}>
          <View style={styles.paymentTop}>
            <View>
              <Text style={styles.paymentTitle}>Payment Status</Text>
              <Text style={styles.paymentSubtitle}>Payment: {displayStatusLabel}</Text>
            </View>
            <View style={[styles.paymentIcon, { backgroundColor: "rgba(255,255,255,0.14)" }]}>
              <Ionicons name="card-outline" size={18} color="#FFFFFF" />
            </View>
          </View>
          <View style={styles.paymentNotice}>
            <Text style={styles.paymentNoticeText}>
              {isEscrowOrder
                ? escrowStatus === "RELEASED"
                  ? "Eligible funds are now visible in your available balance."
                  : `Payment is protected until delivery confirmation. Available balance: ${formatMoney(order, earnings?.availableBalance)}.`
                : `Payment is confirmed. Payout timing follows your seller plan and platform review rules. Available balance: ${formatMoney(order, earnings?.availableBalance)}.`}
            </Text>
          </View>

          <View style={styles.shipmentGrid}>
            <ShipmentMeta label="Shipment status" value={formatShipmentStatus(shipment?.status)} />
            <ShipmentMeta label="Estimated delivery" value={deriveDeliveryLabel(order, shipment)} />
            <ShipmentMeta label="Carrier" value={shipment?.carrier || "Not assigned"} />
            <ShipmentMeta label="Tracking number" value={shipment?.trackingNumber || "Not added yet"} />
          </View>
        </LinearGradient>

        {shipment?.events?.length ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Shipment Updates</Text>
            {shipment.events.map((event, index) => (
              <View key={`${event.timestamp}-${index}`} style={[styles.timelineRow, index > 0 && styles.shipmentEventBorder]}>
                <View style={styles.timelineRail}>
                  <View style={[styles.timelineDot, styles.timelineDotDone]} />
                  {index < shipment.events.length - 1 ? <View style={[styles.timelineLine, styles.timelineLineActive]} /> : null}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.timelineLabel}>{formatShipmentStatus(event.status as Shipment["status"])}</Text>
                  <Text style={styles.timelineCaption}>
                    {event.description}
                    {event.location ? ` - ${event.location}` : ""}
                    {"\n"}
                    {new Date(event.timestamp).toLocaleString()}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Order Timeline</Text>
          {timeline.map((step, index) => (
            <View key={step.key} style={styles.timelineRow}>
              <View style={styles.timelineRail}>
                <View style={[styles.timelineDot, step.done && styles.timelineDotDone, step.current && styles.timelineDotCurrent]} />
                {index < timeline.length - 1 ? <View style={[styles.timelineLine, (step.done || step.current) && styles.timelineLineActive]} /> : null}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.timelineLabel}>{step.label}</Text>
                <Text style={styles.timelineCaption}>{step.caption}</Text>
              </View>
            </View>
          ))}
        </View>

        <LinearGradient colors={["#173D33", "#0D5B46"]} style={styles.actionCard}>
          <View style={styles.actionHeader}>
            <Text style={styles.actionTitle}>Action Required</Text>
            <View style={styles.actionTimer}>
              <Ionicons name="timer-outline" size={18} color="#FFFFFF" />
            </View>
          </View>
          <Text style={styles.actionBody}>{actionDeadlineText}</Text>

          {actionEnabled ? (
            <TouchableOpacity onPress={handleAccept} activeOpacity={0.86} disabled={submitting} style={[styles.acceptButton, submitting && styles.buttonDisabled]}>
              <Text style={styles.acceptButtonText}>{submitting ? "Updating..." : "Accept Order"}</Text>
            </TouchableOpacity>
          ) : null}

          {canShip ? (
            <TouchableOpacity
              onPress={() => router.push({ pathname: "/(vendor)/mark-shipped", params: { id: order.id } } as any)}
              activeOpacity={0.86}
              style={styles.secondaryAction}
            >
              <Text style={styles.secondaryActionText}>Mark Shipped</Text>
            </TouchableOpacity>
          ) : null}

          {order.status === "pending" || order.status === "paid" ? (
            <TouchableOpacity
              onPress={() => {
                Alert.alert("Cancel order?", "Are you sure you want to cancel this order?", [
                  { text: "No", style: "cancel" },
                  { text: "Yes, cancel", style: "destructive", onPress: async () => {
                    setSubmitting(true);
                    try {
                      await orderService.updateOrderStatus(order.id, "cancelled");
                      await load();
                      Alert.alert("Cancelled", "The order has been cancelled.");
                    } catch (err) {
                      Alert.alert("Could not cancel", err instanceof Error ? err.message : "Please try again.");
                    } finally {
                      setSubmitting(false);
                    }
                  }},
                ]);
              }}
              disabled={submitting}
              activeOpacity={0.86}
              style={[styles.secondaryAction, submitting && styles.buttonDisabled]}
            >
              <Text style={[styles.secondaryActionText, { color: "#e55353" }]}>{submitting ? "Cancelling..." : "Cancel Order"}</Text>
            </TouchableOpacity>
          ) : null}
        </LinearGradient>

        {error ? <Text style={styles.footerError}>{error}</Text> : null}
      </ScrollView>
    </View>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

function ShipmentMeta({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.shipmentMetaCard}>
      <Text style={styles.shipmentMetaLabel}>{label}</Text>
      <Text style={styles.shipmentMetaValue}>{value}</Text>
    </View>
  );
}

function InfoTile({
  label,
  value,
  icon,
  dark,
}: {
  label: string;
  value: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  dark?: boolean;
}) {
  return (
    <View style={[styles.tile, dark && styles.tileDark]}>
      <View style={[styles.tileIcon, dark && styles.tileIconDark]}>
        <Ionicons name={icon} size={18} color={dark ? "#FFFFFF" : "#0A6C52"} />
      </View>
      <Text style={[styles.tileLabel, dark && styles.tileLabelDark]}>{label}</Text>
      <Text style={[styles.tileValue, dark && styles.tileValueDark]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F5F2" },
  stateScreen: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#F5F5F2", paddingHorizontal: 24 },
  errorText: { fontSize: 14, fontFamily: "Outfit-Regular", color: "#FB6363", textAlign: "center" },
  hero: { paddingHorizontal: 16, paddingBottom: 26, borderBottomLeftRadius: 34, borderBottomRightRadius: 34, marginBottom: 18 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 10 },
  heroButton: { width: 48, height: 48, borderRadius: 24, backgroundColor: "rgba(255,255,255,0.16)", alignItems: "center", justifyContent: "center" },
  headerTitle: { color: "#FFFFFF", fontSize: 20, fontFamily: "Manrope-Bold" },
  heroSummary: { flexDirection: "row", alignItems: "center", gap: 14, marginTop: 26 },
  heroSummaryIcon: { width: 58, height: 58, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.14)", alignItems: "center", justifyContent: "center" },
  heroLabel: { color: "rgba(255,255,255,0.8)", fontSize: 14, fontFamily: "Outfit-Regular" },
  heroOrderNumber: { color: "#FFFFFF", fontSize: 28, fontFamily: "Manrope-ExtraBold", marginTop: 4 },
  heroBadge: { borderRadius: 999, backgroundColor: "rgba(255,255,255,0.16)", paddingHorizontal: 14, paddingVertical: 10, alignSelf: "flex-start" },
  heroBadgeText: { color: "#FFFFFF", fontSize: 12, fontFamily: "Manrope-SemiBold" },
  heroFooter: { flexDirection: "row", justifyContent: "space-between", marginTop: 22 },
  heroFooterLabel: { color: "rgba(255,255,255,0.74)", fontSize: 13, fontFamily: "Outfit-Regular" },
  heroFooterValue: { color: "#FFFFFF", fontSize: 16, fontFamily: "Manrope-Bold", marginTop: 6 },
  scrollContent: { paddingHorizontal: 14, paddingBottom: 30 },
  card: { borderRadius: 26, backgroundColor: "#FFFFFF", padding: 18, marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontFamily: "Manrope-Bold", color: "#282828", marginBottom: 14 },
  buyerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: "#E8F1ED", alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 18, fontFamily: "Manrope-Bold", color: "#076B51" },
  buyerName: { fontSize: 16, fontFamily: "Manrope-Bold", color: "#282828" },
  buyerMeta: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#858585", marginTop: 4 },
  infoRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginTop: 16 },
  infoTitle: { fontSize: 15, fontFamily: "Manrope-Bold", color: "#282828" },
  infoValue: { fontSize: 13, lineHeight: 19, fontFamily: "Outfit-Regular", color: "#687076", marginTop: 4 },
  primaryAction: { height: 54, borderRadius: 16, backgroundColor: "#076B51", alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, marginTop: 18 },
  primaryActionText: { fontSize: 15, fontFamily: "Manrope-Bold", color: "#FFFFFF" },
  hintPill: { alignSelf: "center", borderRadius: 999, backgroundColor: "#F1F3F2", paddingHorizontal: 14, paddingVertical: 9, marginTop: 12 },
  hintPillText: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#7A7F84" },
  lineItem: { flexDirection: "row", alignItems: "center", minHeight: 74, gap: 12 },
  lineItemBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#DADADA" },
  lineItemThumb: { width: 50, height: 50, borderRadius: 16, backgroundColor: "#EEF7F3", alignItems: "center", justifyContent: "center" },
  lineItemName: { fontSize: 15, fontFamily: "Manrope-Bold", color: "#282828" },
  lineItemMeta: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#858585", marginTop: 4 },
  lineItemTotal: { fontSize: 15, fontFamily: "Manrope-Bold", color: "#282828" },
  summaryRows: { marginTop: 8 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
  summaryLabel: { fontSize: 14, fontFamily: "Outfit-Regular", color: "#687076" },
  summaryValue: { fontSize: 14, fontFamily: "Manrope-Bold", color: "#282828" },
  totalBar: { marginTop: 12, borderRadius: 18, backgroundColor: "#2B2B2B", paddingHorizontal: 18, paddingVertical: 16, flexDirection: "row", justifyContent: "space-between" },
  totalBarLabel: { color: "#FFFFFF", fontSize: 16, fontFamily: "Manrope-Bold" },
  totalBarValue: { color: "#FFFFFF", fontSize: 18, fontFamily: "Manrope-ExtraBold" },
  tileGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  tile: { width: "47.5%", borderRadius: 18, backgroundColor: "#F4F8F6", padding: 14 },
  tileDark: { backgroundColor: "#2B2B2B" },
  tileIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: "#E8F1ED", alignItems: "center", justifyContent: "center", marginBottom: 12 },
  tileIconDark: { backgroundColor: "rgba(255,255,255,0.14)" },
  tileLabel: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#7A7F84" },
  tileLabelDark: { color: "rgba(255,255,255,0.66)" },
  tileValue: { fontSize: 18, fontFamily: "Manrope-Bold", color: "#282828", marginTop: 8 },
  tileValueDark: { color: "#FFFFFF" },
  paymentCard: { borderRadius: 26, padding: 18, marginBottom: 16 },
  paymentTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  paymentTitle: { color: "#FFFFFF", fontSize: 18, fontFamily: "Manrope-Bold" },
  paymentSubtitle: { color: "rgba(255,255,255,0.82)", fontSize: 14, fontFamily: "Outfit-Regular", marginTop: 4 },
  paymentIcon: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  paymentNotice: { borderRadius: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.14)", backgroundColor: "rgba(255,255,255,0.08)", padding: 14, marginTop: 16 },
  paymentNoticeText: { color: "rgba(255,255,255,0.86)", fontSize: 13, lineHeight: 19, fontFamily: "Outfit-Regular" },
  shipmentGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 16 },
  shipmentMetaCard: { width: "47.5%", borderRadius: 16, backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", padding: 12 },
  shipmentMetaLabel: { color: "rgba(255,255,255,0.66)", fontSize: 12, fontFamily: "Outfit-Regular" },
  shipmentMetaValue: { color: "#FFFFFF", fontSize: 14, fontFamily: "Manrope-SemiBold", marginTop: 6 },
  timelineRow: { flexDirection: "row", minHeight: 68 },
  timelineRail: { width: 26, alignItems: "center" },
  timelineDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: "#D6E3DD", marginTop: 4 },
  timelineDotDone: { backgroundColor: "#076B51" },
  timelineDotCurrent: { backgroundColor: "#D97706" },
  timelineLine: { width: 2, flex: 1, marginTop: 4, backgroundColor: "#D6E3DD" },
  timelineLineActive: { backgroundColor: "#076B51" },
  timelineLabel: { fontSize: 15, fontFamily: "Manrope-Bold", color: "#282828" },
  timelineCaption: { fontSize: 13, lineHeight: 19, fontFamily: "Outfit-Regular", color: "#687076", marginTop: 4, paddingBottom: 14 },
  shipmentEventBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#E4E7E5", paddingTop: 14 },
  actionCard: { borderRadius: 26, padding: 18 },
  actionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  actionTitle: { color: "#FFFFFF", fontSize: 18, fontFamily: "Manrope-Bold" },
  actionTimer: { width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" },
  actionBody: { color: "rgba(255,255,255,0.84)", fontSize: 14, lineHeight: 20, fontFamily: "Outfit-Regular", marginTop: 12 },
  acceptButton: { height: 54, borderRadius: 16, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center", marginTop: 18 },
  acceptButtonText: { color: "#173D33", fontSize: 16, fontFamily: "Manrope-Bold" },
  secondaryAction: { height: 54, borderRadius: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.4)", alignItems: "center", justifyContent: "center", marginTop: 12 },
  secondaryActionText: { color: "#FFFFFF", fontSize: 16, fontFamily: "Manrope-SemiBold" },
  buttonDisabled: { opacity: 0.65 },
  footerError: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#FB6363", textAlign: "center", marginTop: 14 },
});
