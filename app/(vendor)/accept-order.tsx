import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { canVendorConfirmEscrowOrder, deriveEscrowStatus, getEscrowStatusLabel } from "../../services/escrowStatus";
import { orderService } from "../../services/orderService";
import { Order } from "../../types/order";

const CURRENCY_SYMBOL: Record<string, string> = { GBP: "£", USD: "$", EUR: "€", NGN: "₦", GHS: "GH₵", KES: "KSh" };

export default function AcceptOrderScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) {
      setError("Missing order id.");
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const nextOrder = await orderService.getVendorOrderById(id);
        if (!cancelled) setOrder(nextOrder);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load order.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const isEscrowOrder = (order?.escrowType ?? "").toLowerCase() === "domestic_africa";
  const escrowLabel = getEscrowStatusLabel(deriveEscrowStatus(order));
  const canConfirmEscrow = canVendorConfirmEscrowOrder(order);

  const handleAccept = async () => {
    if (!order) return;
    if (isEscrowOrder && !canConfirmEscrow) {
      setError("Funds are held, but this order is not yet in the backend PAYMENT_SECURED state required for vendor confirmation.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      if (isEscrowOrder) {
        await orderService.confirmVendorEscrowOrder(order.id);
      } else {
        await orderService.updateOrderStatus(order.id, "confirmed");
      }
      router.replace({ pathname: "/(vendor)/order-detail", params: { id: order.id } } as any);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not accept order.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDecline = () => {
    if (!order) return;

    if (isEscrowOrder) {
      Alert.alert(
        "Support required",
        "Escrow decline and refund is not exposed on the mobile API yet. Please handle this case through admin support.",
      );
      return;
    }

    Alert.alert(
      "Decline this order?",
      "The buyer will be notified and refunded.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Decline",
          style: "destructive",
          onPress: async () => {
            setSubmitting(true);
            try {
              await orderService.updateOrderStatus(order.id, "cancelled");
              router.back();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Could not decline order.");
            } finally {
              setSubmitting(false);
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.85} style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Accept Order</Text>
      </View>

      {loading ? (
        <View style={styles.placeholder}>
          <ActivityIndicator color="#076B51" />
        </View>
      ) : !order ? (
        <View style={styles.placeholder}>
          <Text style={styles.errorText}>{error || "Order not found."}</Text>
        </View>
      ) : (
        <View style={styles.content}>
          <View style={styles.card}>
            <View style={styles.iconWrap}>
              <View style={styles.iconCircle}>
                <Ionicons name="shield-checkmark-outline" size={32} color="#076B51" />
              </View>
            </View>
            <Text style={styles.title}>Accept this order?</Text>
            <Text style={styles.subtitle}>
              {isEscrowOrder
                ? "Funds are held in escrow and only move after delivery confirmation or the protection timeout."
                : "Payment will be released after buyer confirmation based on the platform rules."}
            </Text>

            <View style={styles.noticeBox}>
              <Ionicons name="alert-circle-outline" size={16} color="#B8860B" />
              <Text style={styles.noticeText}>
                {isEscrowOrder
                  ? canConfirmEscrow
                    ? "Accepting moves this order into the vendor-confirmed escrow stage so you can prepare shipment."
                    : "This order is protected, but the backend has not exposed the PAYMENT_SECURED state yet. Wait for the escrow state to advance before confirming."
                  : "You have 24 hours to accept new orders. Once accepted, begin processing the foodstuff for delivery."}
              </Text>
            </View>

            <View style={styles.orderInfo}>
              <InfoRow label="Order" value={order.orderNumber || `#${order.id}`} />
              <InfoRow label="Items" value={`${order.items?.length ?? 0} products`} />
              <InfoRow label="Total" value={`${CURRENCY_SYMBOL[order.currency] ?? "£"}${order.total.toFixed(2)}`} />
              <InfoRow label="Escrow status" value={escrowLabel} />
            </View>
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={styles.buttons}>
            <TouchableOpacity
              onPress={handleAccept}
              activeOpacity={0.85}
              style={[styles.acceptButton, (submitting || (isEscrowOrder && !canConfirmEscrow)) && styles.disabled]}
              disabled={submitting || (isEscrowOrder && !canConfirmEscrow)}
            >
              <Text style={styles.acceptButtonText}>
                {submitting ? "Accepting..." : isEscrowOrder ? (canConfirmEscrow ? "Confirm Escrow Order" : "Awaiting Escrow Secure") : "Accept Order"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleDecline} activeOpacity={0.85} style={[styles.declineButton, submitting && styles.disabled]} disabled={submitting}>
              <Text style={styles.declineButtonText}>{isEscrowOrder ? "Need Support" : "Decline"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F4F4F4" },
  header: { backgroundColor: "#076B51", paddingHorizontal: 20, paddingTop: 16, paddingBottom: 30, borderBottomLeftRadius: 35, borderBottomRightRadius: 35, flexDirection: "row", alignItems: "center", gap: 12 },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 24, fontFamily: "Manrope-Bold", color: "#FFFFFF" },
  placeholder: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  content: { flex: 1, paddingHorizontal: 16, paddingTop: 24, justifyContent: "space-between", paddingBottom: 40 },
  card: { backgroundColor: "#FFFFFF", borderRadius: 30, padding: 24, alignItems: "center" },
  iconWrap: { width: 80, height: 80, borderRadius: 30, backgroundColor: "#E8F4ED", alignItems: "center", justifyContent: "center", marginBottom: 20 },
  iconCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: "#E8F4ED", alignItems: "center", justifyContent: "center" },
  title: { fontSize: 20, fontFamily: "Manrope-Bold", color: "#282828", textAlign: "center" },
  subtitle: { fontSize: 14, fontFamily: "Outfit-Regular", color: "#858585", textAlign: "center", marginTop: 8, lineHeight: 21 },
  noticeBox: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#FFF9E6", borderRadius: 12, padding: 12, marginTop: 14, width: "100%" },
  noticeText: { flex: 1, fontSize: 12, fontFamily: "Outfit-Medium", color: "#856B0E", lineHeight: 16 },
  orderInfo: { width: "100%", marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: "#F4F4F4" },
  infoRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, gap: 10 },
  infoLabel: { fontSize: 14, fontFamily: "Outfit-Regular", color: "#858585" },
  infoValue: { flexShrink: 1, textAlign: "right", fontSize: 14, fontFamily: "Manrope-Bold", color: "#282828" },
  errorText: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#FB6363", textAlign: "center", marginVertical: 8 },
  buttons: { gap: 12 },
  acceptButton: { height: 56, borderRadius: 14, backgroundColor: "#076B51", alignItems: "center", justifyContent: "center" },
  acceptButtonText: { fontSize: 16, fontFamily: "Manrope-SemiBold", color: "#FFFFFF" },
  declineButton: { height: 56, borderRadius: 14, borderWidth: 1.5, borderColor: "#076B51", alignItems: "center", justifyContent: "center" },
  declineButtonText: { fontSize: 16, fontFamily: "Manrope-SemiBold", color: "#076B51" },
  disabled: { opacity: 0.6 },
});
