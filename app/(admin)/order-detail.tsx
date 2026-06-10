import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { CurrencySelector } from "../../components/ui/CurrencySelector";
import { deriveEscrowStatus, getEscrowStatusColor, getEscrowStatusLabel } from "../../services/escrowStatus";
import { orderService } from "../../services/orderService";
import { useCurrencyStore } from "../../stores/currencyStore";
import type { Order } from "../../types/order";
import { formatDisplayMoney } from "../../utils/currency";

function formatDate(iso?: string) {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleString("en-GB", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function paymentProviderLabel(order?: Order | null): string {
  const provider = (order?.paymentProvider ?? "").toLowerCase();
  if (provider === "paystack") return "Paystack";
  if (provider === "stripe") return "Stripe";
  if (provider === "wallet") return "Wallet";
  if ((order?.escrowType ?? "").toLowerCase() === "domestic_africa") return "Paystack";
  return "Provider unavailable";
}

export default function AdminOrderDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
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
      if (!id) {
        setLoading(false);
        return;
      }
      let cancelled = false;
      setLoading(true);
      orderService
        .getOrderById(id)
        .then((nextOrder) => {
          if (!cancelled) {
            setOrder(nextOrder);
            void ensureCurrency(nextOrder.currency);
          }
        })
        .catch(() => {
          if (!cancelled) setOrder(null);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, [ensureCurrency, id]),
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.stateScreen}>
          <ActivityIndicator color="#076B51" />
        </View>
      </SafeAreaView>
    );
  }

  if (!order) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.stateScreen}>
          <Text style={styles.errorText}>Order not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const escrowStatus = deriveEscrowStatus(order);
  const statusColor = getEscrowStatusColor(escrowStatus);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.85} style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Order Details</Text>
        <TouchableOpacity onPress={() => setCurrencyModalVisible(true)} activeOpacity={0.85} style={styles.currencyButton}>
          <Text style={styles.currencyButtonText}>{selectedCurrency}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <View style={styles.statusRow}>
            <Text style={styles.orderId}>{order.orderNumber || order.id}</Text>
            <View style={[styles.statusBadge, { backgroundColor: `${statusColor}15` }]}>
              <Text style={[styles.statusText, { color: statusColor }]}>{getEscrowStatusLabel(escrowStatus)}</Text>
            </View>
          </View>
          <Text style={styles.orderDate}>Placed: {formatDate(order.createdAt)}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Payment Summary</Text>
          <InfoRow label="Payment provider" value={paymentProviderLabel(order)} />
          <InfoRow label="Payment status" value={order.paymentStatus.replace(/\b\w/g, (char) => char.toUpperCase())} />
          <InfoRow label="Vendor earnings" value={formatDisplayMoney(order.vendorEarnings ?? 0, order.currency, selectedCurrency)} />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Parties</Text>
          <InfoRow label="Vendor" value={order.vendorName ?? "-"} />
          <InfoRow label="Buyer" value={order.buyerName ?? "-"} />
          <InfoRow label="Delivery country" value={order.deliveryDetails?.country ?? "-"} />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Items</Text>
          {(order.items ?? []).length === 0 ? (
            <Text style={styles.emptyText}>No items</Text>
          ) : (
            order.items.map((item, index) => (
              <View key={`${item.product.id}-${index}`} style={[styles.itemRow, index > 0 && styles.itemBorder]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName}>{item.product.name}</Text>
                  <Text style={styles.itemMeta}>Qty {item.quantity}</Text>
                </View>
                <Text style={styles.itemTotal}>
                  {formatDisplayMoney(item.product.price * item.quantity, order.currency, selectedCurrency)}
                </Text>
              </View>
            ))
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Admin Actions</Text>
          <TouchableOpacity
            onPress={() =>
              Alert.alert(
                "Refund route",
                "Use the dispute detail flow for buyer/vendor resolutions. Direct order refund UI is not connected in mobile yet.",
              )
            }
            activeOpacity={0.85}
            style={styles.actionButton}
          >
            <Ionicons name="cash-outline" size={16} color="#076B51" />
            <Text style={styles.actionText}>Refund Buyer</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push("/(admin)/disputes" as any)} activeOpacity={0.85} style={styles.actionButton}>
            <Ionicons name="shield-checkmark-outline" size={16} color="#076B51" />
            <Text style={styles.actionText}>Open Disputes</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <CurrencySelector
        selectedCurrency={selectedCurrency}
        onChange={setSelectedCurrency}
        visible={currencyModalVisible}
        onClose={() => setCurrencyModalVisible(false)}
      />
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
  stateScreen: { flex: 1, alignItems: "center", justifyContent: "center" },
  errorText: { color: "#FB6363", fontFamily: "Outfit-Regular", fontSize: 14 },
  header: {
    backgroundColor: "#076B51",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 30,
    borderBottomLeftRadius: 35,
    borderBottomRightRadius: 35,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 24, fontFamily: "Manrope-Bold", color: "#FFFFFF", flex: 1 },
  currencyButton: {
    minWidth: 66,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  currencyButtonText: { color: "#076B51", fontSize: 12, fontFamily: "Manrope-Bold" },
  scrollContent: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 40, gap: 16 },
  card: { backgroundColor: "#FFFFFF", borderRadius: 30, padding: 20 },
  statusRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 6 },
  orderId: { fontSize: 20, fontFamily: "Manrope-Bold", color: "#282828", flex: 1 },
  statusBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontSize: 12, fontFamily: "Outfit-Medium" },
  orderDate: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#858585" },
  sectionTitle: { fontSize: 18, fontFamily: "Manrope-Bold", color: "#282828", marginBottom: 14 },
  infoRow: { flexDirection: "row", justifyContent: "space-between", gap: 12, paddingVertical: 8 },
  infoLabel: { fontSize: 14, fontFamily: "Outfit-Regular", color: "#858585", flex: 1 },
  infoValue: { fontSize: 14, fontFamily: "Manrope-Bold", color: "#282828", flex: 1, textAlign: "right" },
  emptyText: { fontSize: 14, color: "#858585", fontFamily: "Outfit-Regular" },
  itemRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10 },
  itemBorder: { borderTopWidth: 1, borderTopColor: "#F4F4F4" },
  itemName: { fontSize: 14, fontFamily: "Manrope-Bold", color: "#282828" },
  itemMeta: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#858585", marginTop: 2 },
  itemTotal: { fontSize: 14, fontFamily: "Manrope-Bold", color: "#282828" },
  actionButton: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#F4F4F4" },
  actionText: { fontSize: 14, fontFamily: "Outfit-Medium", color: "#076B51" },
});
