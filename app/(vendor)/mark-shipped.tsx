import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { canVendorMarkShipped, deriveEscrowStatus, getEscrowStatusLabel } from "../../services/escrowStatus";
import { orderService } from "../../services/orderService";
import { Order } from "../../types/order";
import { formatDisplayMoney } from "../../utils/currency";
import { goBackOrReplace } from "../../utils/navigation";

export default function MarkShippedScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [carrier, setCarrier] = useState("");

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
  const paymentLabel = isEscrowOrder
    ? getEscrowStatusLabel(deriveEscrowStatus(order))
    : (order?.paymentStatus ?? order?.status ?? "pending").replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());

  const shipmentPayload = () => ({
    carrier: carrier.trim(),
    trackingNumber: trackingNumber.trim() || undefined,
  });

  const ensureShipment = async () => {
    if (!order) return;

    try {
      await orderService.createShipment(order.id, shipmentPayload());
    } catch (shipmentErr) {
      const message = shipmentErr instanceof Error ? shipmentErr.message.toLowerCase() : "";
      if (!message.includes("already exists")) {
        throw shipmentErr;
      }

      const existing = await orderService.getShipmentByOrder(order.id);
      if (existing?.id) {
        await orderService.updateShipment(existing.id, shipmentPayload());
      }
    }
  };

  const dispatchStandardOrder = async () => {
    if (!order) return;

    await ensureShipment();

    const currentStatus = order.status;
    const allowedFromPaid = currentStatus === "paid" || currentStatus === "pending";

    // If order is at PAID/PENDING, go to PROCESSING first
    if (currentStatus === "confirmed" || allowedFromPaid) {
      try {
        await orderService.updateOrderStatus(order.id, "processing", shipmentPayload());
      } catch (statusErr) {
        // May already be processing or accepted - that's fine
      }
    }

    // Now go to dispatched
    try {
      await orderService.updateOrderStatus(order.id, "dispatched", shipmentPayload());
    } catch (dispatchErr) {
      const message = dispatchErr instanceof Error ? dispatchErr.message.toLowerCase() : "";
      const alreadyDispatched =
        message.includes("already dispatched") ||
        message.includes("already shipped") ||
        message.includes("invalid transition") ||
        message.includes("current status") ||
        message.includes("cannot transition");

      if (!alreadyDispatched) {
        throw dispatchErr;
      }
    }
  };

  const handleConfirm = async () => {
    if (!order) return;
    if (!canVendorMarkShipped(order)) {
      Alert.alert("Shipment blocked", "This order is not yet ready for dispatch or is frozen by its current status.");
      return;
    }
    if (!carrier.trim()) {
      setError("Please enter a shipping carrier.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      if (isEscrowOrder) {
        await ensureShipment();
        const dispatch = await orderService.dispatchVendorEscrowOrder(order.id);

        router.push({
          pathname: "/(vendor)/order-completed",
          params: { id: order.id, deliveryCode: dispatch.deliveryCode, expiresAt: dispatch.expiresAt },
        } as any);
        return;
      }

      await dispatchStandardOrder();
      router.push({ pathname: "/(vendor)/order-completed", params: { id: order.id } } as any);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not mark as shipped.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => goBackOrReplace(router, { pathname: "/(vendor)/order-detail", params: { id } } as any)} activeOpacity={0.85} style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mark as Shipped</Text>
        <Text style={styles.headerSubtitle}>Add shipping details for this order</Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {loading ? (
          <View style={styles.placeholder}>
            <ActivityIndicator color="#076B51" />
          </View>
        ) : !order ? (
          <Text style={styles.errorText}>{error || "Order not found."}</Text>
        ) : (
          <>
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Shipping Details</Text>

              <View style={styles.orderBanner}>
                <Ionicons name="cube-outline" size={18} color="#076B51" />
                <Text style={styles.orderBannerText}>
                  {order.orderNumber || `#${order.id}`} - {order.items?.length ?? 0} items - {formatDisplayMoney(order.total, order.currency, order.currency)}
                </Text>
              </View>

              <View style={styles.statusCard}>
                <Text style={styles.statusLabel}>Payment status</Text>
                <Text style={styles.statusValue}>{paymentLabel}</Text>
                {isEscrowOrder ? (
                  <Text style={styles.statusHint}>
                    Dispatching will generate the buyer delivery code and keep funds held until confirmation.
                  </Text>
                ) : null}
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Courier Name</Text>
                <View style={styles.inputWrap}>
                  <TextInput
                    style={styles.input}
                    placeholder="DHL, FedEx"
                    placeholderTextColor="#858585"
                    value={carrier}
                    onChangeText={(value) => {
                      setCarrier(value);
                      if (error) setError("");
                    }}
                  />
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Tracking Number</Text>
                <View style={styles.inputWrap}>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter tracking number"
                    placeholderTextColor="#858585"
                    value={trackingNumber}
                    onChangeText={setTrackingNumber}
                  />
                </View>
              </View>

              <View style={styles.noteCard}>
                <Ionicons name="information-circle-outline" size={16} color="#D97706" />
                <Text style={styles.noteText}>
                  {isEscrowOrder
                    ? "The buyer will need the delivery code generated by the backend to confirm receipt."
                    : "The buyer will be notified that their order has been shipped and can track delivery progress."}
                </Text>
              </View>
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <TouchableOpacity onPress={handleConfirm} activeOpacity={0.85} style={[styles.primaryButton, submitting && styles.disabled]} disabled={submitting}>
              <Text style={styles.primaryButtonText}>{submitting ? "Processing..." : "Mark as Shipped"}</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => goBackOrReplace(router, { pathname: "/(vendor)/order-detail", params: { id: order.id } } as any)} activeOpacity={0.85} style={styles.secondaryButton} disabled={submitting}>
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F4F4F4" },
  header: { backgroundColor: "#076B51", paddingHorizontal: 20, paddingTop: 16, paddingBottom: 30, borderBottomLeftRadius: 35, borderBottomRightRadius: 35, gap: 4 },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center", marginBottom: 8 },
  headerTitle: { fontSize: 30, fontFamily: "Manrope-Bold", lineHeight: 30, color: "#FFFFFF" },
  headerSubtitle: { fontSize: 16, fontFamily: "Outfit-Light", color: "#FFFFFF" },
  scrollContent: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 40 },
  placeholder: { paddingVertical: 60, alignItems: "center" },
  card: { backgroundColor: "#FFFFFF", borderRadius: 30, padding: 20, marginBottom: 20 },
  sectionTitle: { fontSize: 18, fontFamily: "Manrope-Bold", color: "#282828", marginBottom: 16 },
  orderBanner: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#E8F4ED", borderRadius: 12, padding: 12, marginBottom: 16 },
  orderBannerText: { fontSize: 13, fontFamily: "Outfit-Medium", color: "#076B51", flex: 1 },
  statusCard: { backgroundColor: "#F7F8F8", borderRadius: 14, padding: 14, marginBottom: 18 },
  statusLabel: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#858585" },
  statusValue: { fontSize: 15, fontFamily: "Manrope-Bold", color: "#282828", marginTop: 4 },
  statusHint: { fontSize: 12, lineHeight: 18, fontFamily: "Outfit-Regular", color: "#687076", marginTop: 8 },
  fieldGroup: { marginBottom: 16 },
  fieldLabel: { fontSize: 14, fontFamily: "Outfit-Medium", color: "#858585", marginBottom: 6 },
  inputWrap: { backgroundColor: "#F4F4F4", borderRadius: 10 },
  input: { height: 55, paddingHorizontal: 15, fontSize: 14, fontFamily: "Outfit-Regular", color: "#282828" },
  noteCard: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: "#FFF8E8", borderRadius: 12, padding: 12 },
  noteText: { flex: 1, fontSize: 12, fontFamily: "Outfit-Regular", color: "#B8860B", lineHeight: 18 },
  errorText: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#FB6363", textAlign: "center", marginBottom: 12 },
  primaryButton: { height: 56, borderRadius: 14, backgroundColor: "#076B51", alignItems: "center", justifyContent: "center" },
  primaryButtonText: { fontSize: 16, fontFamily: "Manrope-SemiBold", color: "#FFFFFF" },
  secondaryButton: { height: 56, borderRadius: 14, borderWidth: 1, borderColor: "#076B51", alignItems: "center", justifyContent: "center", marginTop: 12 },
  secondaryButtonText: { fontSize: 16, fontFamily: "Manrope-SemiBold", color: "#076B51" },
  disabled: { opacity: 0.6 },
});
