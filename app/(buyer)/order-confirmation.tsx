import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { deriveEscrowStatus, getEscrowStatusLabel } from "../../services/escrowStatus";

const CURRENCY_SYMBOL = "£";

export default function OrderConfirmationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    subtotal?: string;
    shipping?: string;
    total?: string;
    paymentProvider?: string;
    escrowType?: string;
    escrowStatus?: string;
  }>();

  const subtotal = Number(params.subtotal ?? 0);
  const shipping = Number(params.shipping ?? 0);
  const total = Number(params.total ?? 0);
  const isEscrowOrder = (params.escrowType ?? "").toLowerCase() === "domestic_africa";
  const escrowType = isEscrowOrder ? "domestic_africa" : "none";
  const derivedStatus = params.escrowStatus
    ? String(params.escrowStatus)
    : getEscrowStatusLabel(
        deriveEscrowStatus({
          escrowType,
          status: "pending",
          paymentStatus: "paid",
        }),
      );
  const paymentProvider =
    params.paymentProvider?.toLowerCase() === "paystack"
      ? "Paystack"
      : params.paymentProvider?.toLowerCase() === "wallet"
      ? "Wallet"
      : "Stripe";

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <View style={styles.iconCircle}>
            <Ionicons name="checkmark" size={32} color="#076B51" />
          </View>
        </View>

        <Text style={styles.title}>Order Placed Successfully</Text>
        <Text style={styles.subtitle}>
          {isEscrowOrder
            ? "Your payment is protected while the vendor prepares and dispatches your order."
            : "Your vendor has been notified and will process your order."}
        </Text>

        {isEscrowOrder ? (
          <View style={styles.protectionCard}>
            <Ionicons name="shield-checkmark-outline" size={18} color="#076B51" />
            <View style={{ flex: 1 }}>
              <Text style={styles.protectionTitle}>Protected payment</Text>
              <Text style={styles.protectionBody}>
                Funds stay held until delivery is confirmed or the protection window ends.
              </Text>
            </View>
          </View>
        ) : null}

        <TouchableOpacity onPress={() => router.replace("/(buyer)/orders" as any)} activeOpacity={0.85} style={styles.trackBtn}>
          <Text style={styles.trackBtnText}>Track Order</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.replace("/(buyer)" as any)} activeOpacity={0.85} style={styles.closeBtn}>
          <Ionicons name="close" size={18} color="#858585" />
        </TouchableOpacity>

        <View style={styles.summarySection}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Items total</Text>
            <Text style={styles.summaryValue}>{CURRENCY_SYMBOL}{subtotal.toFixed(2)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Shipping</Text>
            <Text style={styles.summaryValue}>{CURRENCY_SYMBOL}{shipping.toFixed(2)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Payment provider</Text>
            <Text style={styles.summaryValue}>{paymentProvider}</Text>
          </View>
          {isEscrowOrder ? (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Escrow status</Text>
              <Text style={[styles.summaryValue, styles.summaryValueEmphasis]}>{derivedStatus}</Text>
            </View>
          ) : null}
          <View style={[styles.summaryRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Final total</Text>
            <Text style={styles.totalValue}>{CURRENCY_SYMBOL}{total.toFixed(2)}</Text>
          </View>
        </View>

        <TouchableOpacity onPress={() => router.replace("/(buyer)" as any)} activeOpacity={0.85} style={styles.browseBtn}>
          <Text style={styles.browseBtnText}>Browse Foodstuff</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  content: { flex: 1, paddingHorizontal: 24, justifyContent: "center", alignItems: "center" },
  iconWrap: { marginBottom: 20 },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2.5,
    borderColor: "#076B51",
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 22, fontFamily: "Manrope-Bold", color: "#282828", textAlign: "center" },
  subtitle: { fontSize: 14, fontFamily: "Outfit-Regular", color: "#858585", textAlign: "center", marginTop: 8, lineHeight: 21 },
  protectionCard: {
    width: "100%",
    marginTop: 18,
    borderRadius: 16,
    backgroundColor: "#F3FBF7",
    borderWidth: 1,
    borderColor: "#D8EEE4",
    padding: 14,
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },
  protectionTitle: { fontSize: 14, fontFamily: "Manrope-Bold", color: "#076B51" },
  protectionBody: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#4B5563", lineHeight: 18, marginTop: 4 },
  trackBtn: { width: "100%", height: 52, borderRadius: 14, backgroundColor: "#076B51", alignItems: "center", justifyContent: "center", marginTop: 24 },
  trackBtnText: { fontSize: 15, fontFamily: "Manrope-SemiBold", color: "#FFFFFF" },
  closeBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: "#E0E0E0", alignItems: "center", justifyContent: "center", marginTop: 16 },
  summarySection: { width: "100%", marginTop: 24 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", gap: 12, paddingVertical: 8 },
  summaryLabel: { fontSize: 14, fontFamily: "Outfit-Regular", color: "#858585" },
  summaryValue: { flexShrink: 1, textAlign: "right", fontSize: 14, fontFamily: "Outfit-Medium", color: "#282828" },
  summaryValueEmphasis: { color: "#076B51", fontFamily: "Manrope-Bold" },
  totalRow: { borderTopWidth: 1, borderTopColor: "#F0F0F0", marginTop: 8, paddingTop: 12 },
  totalLabel: { fontSize: 16, fontFamily: "Manrope-Bold", color: "#282828" },
  totalValue: { fontSize: 20, fontFamily: "Manrope-Bold", color: "#076B51" },
  browseBtn: { width: "100%", height: 52, borderRadius: 14, backgroundColor: "#076B51", alignItems: "center", justifyContent: "center", marginTop: 20 },
  browseBtnText: { fontSize: 15, fontFamily: "Manrope-SemiBold", color: "#FFFFFF" },
});
