import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { CurrencySelector } from "../../components/ui/CurrencySelector";
import { deriveEscrowStatus, getEscrowStatusColor, getEscrowStatusLabel } from "../../services/escrowStatus";
import { orderService } from "../../services/orderService";
import { useCurrencyStore } from "../../stores/currencyStore";
import type { Order } from "../../types/order";
import { formatDisplayMoney } from "../../utils/currency";

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("en-GB", { month: "short", day: "numeric" });
  } catch {
    return iso;
  }
}

function displayOrderNumber(order: Order) {
  if (order.orderNumber?.startsWith("EKI-")) return order.orderNumber;
  const tail = (order.orderNumber || order.id || "").slice(-8).toUpperCase();
  return `EKI-${tail}`;
}

export default function AdminOrdersScreen() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currencyModalVisible, setCurrencyModalVisible] = useState(false);
  const selectedCurrency = useCurrencyStore((s) => s.selectedCurrency);
  const hydrateCurrency = useCurrencyStore((s) => s.hydrate);
  const setSelectedCurrency = useCurrencyStore((s) => s.setSelectedCurrency);
  const ensureCurrency = useCurrencyStore((s) => s.ensureCurrency);

  useEffect(() => {
    void hydrateCurrency();
  }, [hydrateCurrency]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      setError("");
      orderService
        .getAllOrders()
        .then((data) => {
          if (!cancelled) {
            setOrders(data ?? []);
            void ensureCurrency(data?.[0]?.currency);
          }
        })
        .catch((err) => {
          if (!cancelled) setError(err instanceof Error ? err.message : "Could not load admin orders.");
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });

      return () => {
        cancelled = true;
      };
    }, [ensureCurrency]),
  );

  const totalOrders = orders.length;
  const shippedCount = orders.filter(
    (order) =>
      ["dispatched", "in_transit", "delivered"].includes(order.status) ||
      ["DISPATCHED", "IN_TRANSIT", "DELIVERED", "COMPLETED", "AUTO_RELEASED"].includes((order.backendStatus ?? "").toUpperCase()),
  ).length;
  const disputedCount = orders.filter(
    (order) =>
      ["disputed", "refunded"].includes(order.status) ||
      ["DISPUTED", "REFUNDED"].includes((order.backendStatus ?? "").toUpperCase()),
  ).length;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.headerCopy}>
            <Text style={styles.headerTitle}>Order Monitoring</Text>
            <Text style={styles.headerSubtitle}>Track marketplace payment and order states across {totalOrders} orders</Text>
          </View>
          <TouchableOpacity onPress={() => setCurrencyModalVisible(true)} activeOpacity={0.85} style={styles.currencyButton}>
            <Ionicons name="swap-horizontal-outline" size={16} color="#076B51" />
            <Text style={styles.currencyButtonText}>{selectedCurrency}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.stateScreen}>
          <ActivityIndicator color="#076B51" />
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={styles.statsRow}>
            <StatCard label="All orders" value={totalOrders} />
            <StatCard label="Shipped" value={shippedCount} />
            <StatCard label="Disputed" value={disputedCount} />
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Recent Orders</Text>

            {orders.length === 0 ? (
              <Text style={styles.emptyText}>No orders yet.</Text>
            ) : (
              orders.slice(0, 25).map((order, index) => {
                const escrowStatus = deriveEscrowStatus(order);
                const color = getEscrowStatusColor(escrowStatus);
                return (
                  <TouchableOpacity
                    key={order.id}
                    onPress={() => router.push({ pathname: "/(admin)/order-detail", params: { id: order.id } } as any)}
                    activeOpacity={0.85}
                    style={[styles.orderItem, index < Math.min(orders.length, 25) - 1 && styles.orderBorder]}
                  >
                    <View style={styles.orderTop}>
                      <Text style={styles.orderId} numberOfLines={1}>
                        {displayOrderNumber(order)}
                      </Text>
                      <Text style={[styles.orderStatus, { color }]}>{getEscrowStatusLabel(escrowStatus)}</Text>
                    </View>
                    <Text style={styles.orderParties}>
                      {order.vendorName ?? "Vendor"} to {order.buyerName ?? "Buyer"}
                    </Text>
                    <View style={styles.orderBottom}>
                      <Text style={styles.orderDate}>{formatDate(order.createdAt)}</Text>
                      <Text style={styles.orderAmount}>{formatDisplayMoney(order.total, order.currency, selectedCurrency)}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        </ScrollView>
      )}

      <CurrencySelector
        selectedCurrency={selectedCurrency}
        onChange={setSelectedCurrency}
        visible={currencyModalVisible}
        onClose={() => setCurrencyModalVisible(false)}
      />
    </SafeAreaView>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F4F4F4" },
  header: {
    backgroundColor: "#076B51",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 30,
    borderBottomLeftRadius: 35,
    borderBottomRightRadius: 35,
    gap: 6,
  },
  headerTop: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  headerCopy: { flex: 1 },
  headerTitle: { fontSize: 30, fontFamily: "Manrope-Bold", lineHeight: 30, color: "#FFFFFF" },
  headerSubtitle: { fontSize: 16, fontFamily: "Outfit-Light", color: "#FFFFFF", marginTop: 6 },
  currencyButton: {
    minWidth: 84,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 12,
  },
  currencyButtonText: { fontSize: 12, fontFamily: "Manrope-Bold", color: "#076B51" },
  stateScreen: { flex: 1, alignItems: "center", justifyContent: "center" },
  scrollContent: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 40 },
  errorText: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#FB6363", textAlign: "center", marginBottom: 16 },
  statsRow: { flexDirection: "row", gap: 12, marginBottom: 16 },
  statCard: { flex: 1, backgroundColor: "#FFFFFF", borderRadius: 20, padding: 16, alignItems: "center" },
  statValue: { fontSize: 22, fontFamily: "Manrope-Bold", color: "#282828" },
  statLabel: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#858585", marginTop: 4 },
  card: { backgroundColor: "#FFFFFF", borderRadius: 30, padding: 20 },
  sectionTitle: { fontSize: 18, fontFamily: "Manrope-Bold", color: "#282828", marginBottom: 16 },
  emptyText: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#858585" },
  orderItem: { paddingVertical: 14 },
  orderBorder: { borderBottomWidth: 1, borderBottomColor: "#F4F4F4" },
  orderTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 4 },
  orderId: { fontSize: 16, fontFamily: "Manrope-Bold", color: "#282828", flex: 1 },
  orderStatus: { fontSize: 12, fontFamily: "Manrope-SemiBold" },
  orderParties: { fontSize: 14, fontFamily: "Outfit-Regular", color: "#858585", marginBottom: 6 },
  orderBottom: { flexDirection: "row", justifyContent: "space-between" },
  orderDate: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#858585" },
  orderAmount: { fontSize: 16, fontFamily: "Manrope-Bold", color: "#282828" },
});
