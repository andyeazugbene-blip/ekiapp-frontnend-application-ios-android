import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { deriveEscrowStatus, getEscrowStatusColor, getEscrowStatusLabel } from "../../services/escrowStatus";
import { orderService } from "../../services/orderService";
import { useAuthStore } from "../../stores/authStore";
import { Order } from "../../types/order";
import { useCurrencyStore } from "../../stores/currencyStore";
import { CurrencySelector } from "../../components/ui/CurrencySelector";
import { formatDisplayMoney } from "../../utils/currency";
type TabKey = "New" | "Accepted" | "Shipped" | "Disputed" | "Cancelled";

const TABS: TabKey[] = ["New", "Accepted", "Shipped", "Disputed", "Cancelled"];

const TAB_TO_STATUSES: Record<TabKey, string[]> = {
  New: ["pending"],
  Accepted: ["confirmed", "processing"],
  Shipped: ["dispatched", "in_transit", "delivered"],
  Disputed: ["disputed", "refunded"],
  Cancelled: ["cancelled"],
};

export default function OrdersScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const vendor = user?.role === "vendor" ? user : null;

  const [activeTab, setActiveTab] = useState<TabKey>("New");
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const selectedCurrency = useCurrencyStore((state) => state.selectedCurrency);
  const ensureCurrency = useCurrencyStore((state) => state.ensureCurrency);
  const setSelectedCurrency = useCurrencyStore((state) => state.setSelectedCurrency);

  const load = useCallback(async () => {
    if (!vendor) return;
    setLoading(true);
    setError("");
    try {
      const list = await orderService.getVendorOrders(vendor.id);
      setOrders(list ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load orders.");
    } finally {
      setLoading(false);
    }
  }, [vendor]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const filtered = useMemo(
    () => (orders ?? []).filter((order) => TAB_TO_STATUSES[activeTab].includes(order.status)),
    [activeTab, orders],
  );

  React.useEffect(() => {
    ensureCurrency(orders[0]?.currency).catch(() => undefined);
  }, [ensureCurrency, orders]);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Orders</Text>
        <TouchableOpacity onPress={() => setCurrencyOpen(true)} activeOpacity={0.85} style={styles.currencyButton}>
          <Text style={styles.currencyButtonText}>{selectedCurrency}</Text>
        </TouchableOpacity>
        <Text style={styles.headerSubtitle}>Manage your escrow and shipment workflow.</Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.tabContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRow}>
            {TABS.map((tab) => (
              <TouchableOpacity
                key={tab}
                onPress={() => setActiveTab(tab)}
                activeOpacity={0.85}
                style={[styles.tab, activeTab === tab && styles.tabActive]}
              >
                <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {loading ? (
          <View style={styles.placeholder}>
            <ActivityIndicator color="#076B51" size="large" />
          </View>
        ) : error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : filtered.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No {activeTab.toLowerCase()} orders right now.</Text>
          </View>
        ) : (
          filtered.map((order) => {
            const escrowStatus = deriveEscrowStatus(order);
            const escrowColor = getEscrowStatusColor(escrowStatus);
            const isEscrowOrder = (order.escrowType ?? "").toLowerCase() === "domestic_africa";
            const canAccept = order.status === "pending";

            return (
              <View key={order.id} style={styles.orderCard}>
                <View style={styles.orderCardHeader}>
                  <Text style={styles.orderCardTitle}>Order Summary</Text>
                  <View style={[styles.statusBadge, { backgroundColor: `${escrowColor}15` }]}>
                    <Text style={[styles.statusBadgeText, { color: escrowColor }]}>{getEscrowStatusLabel(escrowStatus)}</Text>
                  </View>
                </View>

                <View style={styles.orderRow}>
                  <Text style={styles.orderLabel}>Order</Text>
                  <Text style={styles.orderValue} numberOfLines={1}>{order.orderNumber || `#${order.id}`}</Text>
                </View>
                <View style={styles.orderRow}>
                  <Text style={styles.orderLabel}>Buyer</Text>
                  <Text style={styles.orderValue} numberOfLines={1}>{order.buyerName || "Buyer"}</Text>
                </View>
                <View style={styles.orderRow}>
                  <Text style={styles.orderLabel}>Country</Text>
                  <Text style={styles.orderValue} numberOfLines={1}>{order.deliveryDetails?.country ?? "—"}</Text>
                </View>
                <View style={styles.orderRow}>
                  <Text style={styles.orderLabel}>Total</Text>
                  <Text style={styles.orderValue}>{formatDisplayMoney(order.total, order.currency, selectedCurrency)}</Text>
                </View>

                {isEscrowOrder ? (
                  <Text style={styles.escrowNote}>Funds are held until buyer confirmation or protection expiry.</Text>
                ) : null}

                <TouchableOpacity
                  onPress={() => router.push({ pathname: "/(vendor)/order-detail", params: { id: order.id } } as any)}
                  activeOpacity={0.85}
                  style={styles.openButton}
                >
                  <Text style={styles.openButtonText}>{canAccept ? "Review Order" : "View Details"}</Text>
                </TouchableOpacity>
              </View>
            );
          })
        )}
      </ScrollView>

      <CurrencySelector
        selectedCurrency={selectedCurrency}
        onChange={setSelectedCurrency}
        visible={currencyOpen}
        onClose={() => setCurrencyOpen(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F4F4F4" },
  header: { backgroundColor: "#076B51", paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  headerTitle: { fontSize: 26, fontFamily: "Manrope-Bold", color: "#FFFFFF" },
  currencyButton: { position: "absolute", right: 20, top: 18, minWidth: 58, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.16)", alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  currencyButtonText: { fontSize: 12, fontFamily: "Manrope-Bold", color: "#FFFFFF" },
  headerSubtitle: { fontSize: 14, fontFamily: "Outfit-Light", color: "rgba(255,255,255,0.8)", marginTop: 4 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 100 },
  tabContainer: { marginBottom: 16 },
  tabRow: { flexDirection: "row", gap: 8, paddingVertical: 4 },
  tab: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E8E8E8" },
  tabActive: { backgroundColor: "#076B51", borderColor: "#076B51" },
  tabText: { fontSize: 14, fontFamily: "Outfit-Medium", color: "#858585" },
  tabTextActive: { color: "#FFFFFF", fontFamily: "Manrope-SemiBold" },
  placeholder: { paddingVertical: 50, alignItems: "center" },
  emptyCard: { backgroundColor: "#FFFFFF", borderRadius: 24, padding: 24, alignItems: "center", marginVertical: 8 },
  emptyText: { fontSize: 14, fontFamily: "Outfit-Regular", color: "#858585", textAlign: "center" },
  errorText: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#FB6363", textAlign: "center", marginBottom: 16 },
  orderCard: { backgroundColor: "#FFFFFF", borderRadius: 24, padding: 18, marginBottom: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  orderCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 14, borderBottomWidth: 1, borderBottomColor: "#F4F4F4", paddingBottom: 10 },
  orderCardTitle: { fontSize: 17, fontFamily: "Manrope-Bold", color: "#282828" },
  statusBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  statusBadgeText: { fontSize: 12, fontFamily: "Outfit-Medium" },
  orderRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 5, gap: 12 },
  orderLabel: { fontSize: 14, fontFamily: "Outfit-Regular", color: "#858585" },
  orderValue: { fontSize: 14, fontFamily: "Manrope-Bold", color: "#282828", maxWidth: "65%", textAlign: "right" },
  escrowNote: { fontSize: 12, lineHeight: 18, fontFamily: "Outfit-Regular", color: "#24564A", marginTop: 10 },
  openButton: { marginTop: 16, height: 50, borderRadius: 14, backgroundColor: "#076B51", alignItems: "center", justifyContent: "center" },
  openButtonText: { fontSize: 15, fontFamily: "Manrope-Bold", color: "#FFFFFF" },
});

