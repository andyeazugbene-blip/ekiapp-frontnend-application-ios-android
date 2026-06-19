import React, { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { deriveEscrowStatus, getEscrowStatusColor, getEscrowStatusLabel } from "../../services/escrowStatus";
import { orderService } from "../../services/orderService";
import { Order } from "../../types/order";
import { goBackOrReplace } from "../../utils/navigation";
import { useCurrencyStore } from "../../stores/currencyStore";
import { formatDisplayMoney } from "../../utils/currency";

const STATUS_COLOR: Record<string, string> = {
  pending: "#858585",
  confirmed: "#076B51",
  processing: "#D97706",
  dispatched: "#D97706",
  in_transit: "#D97706",
  delivered: "#076B51",
  disputed: "#FB6363",
  cancelled: "#FB6363",
  refunded: "#FB6363",
};

function formatDate(value: string): string {
  try {
    const d = new Date(value);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 86400000) return "Today";
    if (diff < 172800000) return "Yesterday";
    if (diff < 604800000) return `${Math.floor(diff / 86400000)} days ago`;
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return value;
  }
}

function statusLabel(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function OrdersScreen() {
  const router = useRouter();
  const { selectedCurrency } = useCurrencyStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      setError("");
      orderService
        .getBuyerOrders()
        .then((data) => setOrders(data ?? []))
        .catch((err) => setError(err instanceof Error ? err.message : "Could not load orders."))
        .finally(() => setLoading(false));
    }, []),
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => goBackOrReplace(router, "/(buyer)" as any)} activeOpacity={0.86} style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>My Orders</Text>
          <Text style={styles.headerSubtitle}>Track your purchases</Text>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.stateBlock}>
            <ActivityIndicator color="#076B51" />
          </View>
        ) : error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : orders.length === 0 ? (
          <View style={styles.stateBlock}>
            <Ionicons name="receipt-outline" size={48} color="#858585" />
            <Text style={styles.emptyTitle}>No orders yet</Text>
            <Text style={styles.emptyBody}>Your order history will appear here.</Text>
            <TouchableOpacity
              onPress={() => router.push({ pathname: "/(buyer)/explore", params: { view: "products" } } as any)}
              activeOpacity={0.85}
              style={styles.browseButton}
            >
              <Text style={styles.browseButtonText}>Browse Foodstuff</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.card}>
            {orders.map((order, index) => {
              const escrowStatus = deriveEscrowStatus(order);
              const isEscrowOrder = (order.escrowType ?? "").toLowerCase() === "domestic_africa";
              const color = isEscrowOrder ? getEscrowStatusColor(escrowStatus) : STATUS_COLOR[order.status] ?? "#858585";
              const label = isEscrowOrder ? getEscrowStatusLabel(escrowStatus) : statusLabel(order.status);

              return (
                <TouchableOpacity
                  key={order.id}
                  onPress={() => router.push({ pathname: "/(buyer)/track-order", params: { orderId: order.id } } as any)}
                  activeOpacity={0.85}
                  style={[styles.orderItem, index < orders.length - 1 && styles.orderBorder]}
                >
                  <View style={styles.orderTop}>
                    <Text style={styles.orderId}>{order.orderNumber}</Text>
                    <Text style={[styles.orderStatus, { color }]}>{label}</Text>
                  </View>
                  <Text style={styles.orderStore}>{order.vendorName}</Text>
                  <View style={styles.orderBottom}>
                    <Text style={styles.orderMeta}>
                      {order.items.length} item{order.items.length !== 1 ? "s" : ""} • {formatDate(order.createdAt)}
                    </Text>
                    <Text style={styles.orderAmount}>{formatDisplayMoney(order.total, order.currency, selectedCurrency)}</Text>
                  </View>
                  {isEscrowOrder ? <Text style={styles.escrowHint}>Protected payment</Text> : null}
                  {(order.status === "delivered" || order.status === "completed") && (
                    <TouchableOpacity
                      onPress={(event) => {
                        event.stopPropagation?.();
                        router.push({ pathname: "/(buyer)/leave-review", params: { orderId: order.id, vendorId: order.vendorId } } as any);
                      }}
                      activeOpacity={0.85}
                      style={styles.reviewBtn}
                    >
                      <Ionicons name="star-outline" size={14} color="#076B51" />
                      <Text style={styles.reviewBtnText}>Leave Review</Text>
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F4F4F4" },
  header: { backgroundColor: "#076B51", flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingTop: 16, paddingBottom: 30, borderBottomLeftRadius: 35, borderBottomRightRadius: 35, gap: 12 },
  backButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(255,255,255,0.14)", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 30, fontFamily: "Manrope-Bold", lineHeight: 30, color: "#FFFFFF" },
  headerSubtitle: { fontSize: 16, fontFamily: "Outfit-Light", color: "#FFFFFF" },
  scrollContent: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 40 },
  card: { backgroundColor: "#FFFFFF", borderRadius: 30, padding: 20 },
  stateBlock: { paddingVertical: 60, alignItems: "center" },
  errorText: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#FB6363", textAlign: "center", paddingVertical: 30 },
  emptyTitle: { fontSize: 16, fontFamily: "Manrope-Bold", color: "#282828", marginTop: 16 },
  emptyBody: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#858585", marginTop: 6 },
  browseButton: { marginTop: 20, height: 44, borderRadius: 12, backgroundColor: "#076B51", paddingHorizontal: 24, alignItems: "center", justifyContent: "center" },
  browseButtonText: { fontSize: 14, fontFamily: "Manrope-SemiBold", color: "#FFFFFF" },
  orderItem: { paddingVertical: 16 },
  orderBorder: { borderBottomWidth: 1, borderBottomColor: "#F4F4F4" },
  orderTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 4 },
  orderId: { flex: 1, fontSize: 16, fontFamily: "Manrope-Bold", color: "#282828" },
  orderStatus: { fontSize: 12, fontFamily: "Manrope-SemiBold" },
  orderStore: { fontSize: 14, fontFamily: "Outfit-Regular", color: "#858585", marginBottom: 8 },
  orderBottom: { flexDirection: "row", justifyContent: "space-between" },
  orderMeta: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#858585" },
  orderAmount: { fontSize: 16, fontFamily: "Manrope-Bold", color: "#282828" },
  escrowHint: { fontSize: 12, fontFamily: "Outfit-Medium", color: "#076B51", marginTop: 8 },
  reviewBtn: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10, alignSelf: "flex-start", backgroundColor: "rgba(7,107,81,0.08)", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  reviewBtnText: { fontSize: 12, fontFamily: "Manrope-SemiBold", color: "#076B51" },
});
