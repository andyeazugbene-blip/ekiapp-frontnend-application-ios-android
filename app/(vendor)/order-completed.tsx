import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { orderService } from "../../services/orderService";
import { Order } from "../../types/order";
import { goBackOrReplace } from "../../utils/navigation";

const CURRENCY_SYMBOL: Record<string, string> = { GBP: "£", USD: "$", EUR: "€", NGN: "₦", GHS: "GH₵", KES: "KSh" };

export default function OrderCompletedScreen() {
  const router = useRouter();
  const { id, deliveryCode, expiresAt } = useLocalSearchParams<{ id?: string; deliveryCode?: string; expiresAt?: string }>();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(Boolean(id));

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const o = await orderService.getVendorOrderById(id);
        if (!cancelled) setOrder(o);
      } catch {
        // Silent: fall back to generic copy
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  const symbol = order ? CURRENCY_SYMBOL[order.currency] ?? "£" : "£";
  const itemsCount = order?.items?.length ?? 0;
  const total = order?.total ?? 0;
  // Show 90% of total as estimated earnings if backend hasn't surfaced a precise number.
  const earnings = total * 0.9;
  const isDelivered = order?.status === "delivered";

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{isDelivered ? "Order Complete" : "Shipment Confirmed"}</Text>
        <Text style={styles.headerSubtitle}>
          {isDelivered ? "This order has been fulfilled" : "Buyer has been notified"}
        </Text>
      </View>

      {loading ? (
        <View style={styles.placeholder}>
          <ActivityIndicator color="#076B51" />
        </View>
      ) : (
        <View style={styles.content}>
          <View style={styles.card}>
            <View style={styles.iconWrap}>
              <View style={styles.iconCircle}>
                <Ionicons name={isDelivered ? "checkmark-done" : "airplane-outline"} size={36} color="#FFFFFF" />
              </View>
            </View>
            <Text style={styles.title}>{isDelivered ? "Order Delivered!" : "Shipment Confirmed"}</Text>
            <Text style={styles.subtitle}>
              {order
                ? `Order ${order.orderNumber || `#${order.id}`} ${isDelivered ? "has been successfully delivered to the buyer" : "is on its way to the buyer"}.`
                : "The order has been updated."}
            </Text>

            {typeof deliveryCode === "string" && deliveryCode.length > 0 ? (
              <View style={styles.codeCard}>
                <Text style={styles.codeCardLabel}>Delivery confirmation code</Text>
                <Text style={styles.codeCardValue}>{deliveryCode}</Text>
                <Text style={styles.codeCardHint}>
                  Share this code with the rider or buyer. It expires {typeof expiresAt === "string" && expiresAt ? new Date(expiresAt).toLocaleString() : "after the protection window"}.
                </Text>
              </View>
            ) : null}

            {order ? (
              <View style={styles.summaryBox}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Items</Text>
                  <Text style={styles.summaryValue}>{itemsCount} products</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Total</Text>
                  <Text style={styles.summaryValue}>{symbol}{total.toFixed(2)}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Estimated earnings</Text>
                  <Text style={[styles.summaryValue, { color: "#076B51" }]}>{symbol}{earnings.toFixed(2)}</Text>
                </View>
              </View>
            ) : null}

            <View style={styles.noteRow}>
              <Ionicons name="wallet-outline" size={16} color="#076B51" />
              <Text style={styles.noteText}>Earnings will be available for withdrawal after delivery is confirmed.</Text>
            </View>
          </View>

          <View style={styles.buttons}>
            <TouchableOpacity onPress={() => router.push("/(vendor)/orders" as any)} activeOpacity={0.85} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>View Orders</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() =>
                order?.id
                  ? goBackOrReplace(router, { pathname: "/(vendor)/order-detail", params: { id: order.id } } as any)
                  : goBackOrReplace(router, "/(vendor)/orders" as any)
              }
              activeOpacity={0.85}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryButtonText}>View Order Details</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F4F4F4" },
  header: { backgroundColor: "#076B51", paddingHorizontal: 20, paddingTop: 16, paddingBottom: 30, borderBottomLeftRadius: 35, borderBottomRightRadius: 35, gap: 4 },
  headerTitle: { fontSize: 30, fontFamily: "Manrope-Bold", lineHeight: 30, color: "#FFFFFF" },
  headerSubtitle: { fontSize: 16, fontFamily: "Outfit-Light", color: "#FFFFFF" },
  placeholder: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { flex: 1, paddingHorizontal: 16, paddingTop: 24, justifyContent: "space-between", paddingBottom: 40 },
  card: { backgroundColor: "#FFFFFF", borderRadius: 30, padding: 24, alignItems: "center" },
  iconWrap: { width: 88, height: 88, borderRadius: 32, backgroundColor: "#E8F4ED", alignItems: "center", justifyContent: "center", marginBottom: 20 },
  iconCircle: { width: 64, height: 64, borderRadius: 22, backgroundColor: "#076B51", alignItems: "center", justifyContent: "center" },
  title: { fontSize: 22, fontFamily: "Manrope-Bold", color: "#282828", textAlign: "center" },
  subtitle: { fontSize: 14, fontFamily: "Outfit-Regular", color: "#858585", textAlign: "center", marginTop: 8, lineHeight: 21 },
  summaryBox: { width: "100%", marginTop: 20, backgroundColor: "#F9F9F9", borderRadius: 16, padding: 16 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
  summaryLabel: { fontSize: 14, fontFamily: "Outfit-Regular", color: "#858585" },
  summaryValue: { fontSize: 14, fontFamily: "Manrope-Bold", color: "#282828" },
  noteRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 16 },
  noteText: { flex: 1, fontSize: 12, fontFamily: "Outfit-Regular", color: "#076B51", lineHeight: 18 },
  codeCard: { width: "100%", marginTop: 18, backgroundColor: "#FFF8E8", borderRadius: 16, padding: 16 },
  codeCardLabel: { fontSize: 12, fontFamily: "Outfit-Medium", color: "#856B0E" },
  codeCardValue: { fontSize: 28, fontFamily: "Manrope-Bold", color: "#282828", marginTop: 6, letterSpacing: 1.2 },
  codeCardHint: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#856B0E", lineHeight: 18, marginTop: 8 },
  buttons: { gap: 12 },
  primaryButton: { height: 56, borderRadius: 14, backgroundColor: "#076B51", alignItems: "center", justifyContent: "center" },
  primaryButtonText: { fontSize: 16, fontFamily: "Manrope-SemiBold", color: "#FFFFFF" },
  secondaryButton: { height: 56, borderRadius: 14, borderWidth: 1, borderColor: "#076B51", alignItems: "center", justifyContent: "center" },
  secondaryButtonText: { fontSize: 16, fontFamily: "Manrope-SemiBold", color: "#076B51" },
});
