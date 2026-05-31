import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useCartStore } from "../../stores/cartStore";
import { walletService, type Wallet } from "../../services/walletService";
import { presentPayment, isPaymentSheetAvailable } from "../../services/stripePayment";
import { orderService } from "../../services/orderService";

type PaymentMethod = "stripe" | "wallet" | "wallet_stripe";

export default function CheckoutScreen() {
  const router = useRouter();
  const items = useCartStore((s) => s.items);
  const subtotal = useCartStore((s) => s.subtotal());
  const deliveryTotal = useCartStore((s) => s.deliveryTotal());
  const grandTotal = useCartStore((s) => s.grandTotal());
  const createCheckout = useCartStore((s) => s.createCheckout);
  const clearCart = useCartStore((s) => s.clearCart);
  const isLoading = useCartStore((s) => s.isLoading);

  const [address, setAddress] = useState("");
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [walletLoading, setWalletLoading] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("stripe");
  const [walletAmount, setWalletAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const [createdOrderIds, setCreatedOrderIds] = useState<string[]>([]);

  useEffect(() => {
    walletService
      .getWallet()
      .then((w) => {
        setWallet(w);
        setWalletLoading(false);
      })
      .catch(() => setWalletLoading(false));
  }, []);

  const walletBalance = wallet?.balance ?? 0;
  const parsedWalletAmount = Number(walletAmount) || 0;
  const canPayFullyWithWallet = walletBalance >= grandTotal;

  const handlePlaceOrder = async () => {
    setError("");
    if (!address.trim()) {
      setError("Please enter your delivery address.");
      return;
    }
    if (items.length === 0) {
      setError("Your cart is empty.");
      return;
    }
    if (paymentMethod === "wallet" && walletBalance < grandTotal) {
      setError("Insufficient wallet balance for full payment. Use Wallet + Card instead.");
      return;
    }
    if (paymentMethod === "wallet_stripe" && parsedWalletAmount > walletBalance) {
      setError("Wallet amount exceeds your balance.");
      return;
    }
    if (paymentMethod === "wallet_stripe" && parsedWalletAmount > grandTotal) {
      setError("Wallet amount exceeds order total.");
      return;
    }
    if ((paymentMethod === "stripe" || paymentMethod === "wallet_stripe") && !isPaymentSheetAvailable()) {
      setError("Stripe PaymentSheet is not available in Expo Go. Use a development build to test card payments.");
      return;
    }

    setSubmitting(true);
    try {
      // Create payment intent on backend — this creates orders + returns Stripe clientSecret
      const walletAmountCents =
        paymentMethod === "wallet"
          ? Math.round(grandTotal * 100)
          : paymentMethod === "wallet_stripe" && parsedWalletAmount > 0
            ? Math.round(parsedWalletAmount * 100)
            : undefined;

      const intent = await createCheckout(address.trim(), walletAmountCents);
      setCreatedOrderIds(intent.orderIds);

      if (intent.clientSecret === "wallet_paid") {
        await clearCart();
        setShowSuccess(true);
        return;
      }

      // ── STRIPE FLOW ──────────────────────────────────────────────────────
      // We have a clientSecret from the backend. Open native PaymentSheet.
      if (!intent.clientSecret) {
        setError("Payment not configured. Please contact support.");
        return;
      }

      const result = await presentPayment({
        clientSecret: intent.clientSecret,
        merchantDisplayName: "Eki Marketplace",
      });

      if (result.status === "succeeded") {
        // Stripe confirmed payment client-side. Backend webhook will mark
        // orders PAID independently — we refresh order state from backend
        // to get the authoritative status (don't fake it locally).
        await clearCart();
        // Best-effort refresh — if the webhook hasn't fired yet, the order
        // shows as PENDING in the orders screen; that's correct.
        for (const orderId of intent.orderIds) {
          await orderService.getBuyerOrderById(orderId).catch(() => {});
        }
        setShowSuccess(true);
        return;
      }

      if (result.status === "cancelled") {
        // Order was created but user cancelled the Stripe sheet.
        // Order remains as PENDING on the backend.
        setError("Payment cancelled. Your order is saved as pending.");
        return;
      }

      if (result.status === "unsupported") {
        // Expo Go/dev environment without native Stripe: do not clear the
        // cart or show a success state. The tester needs a dev-client build.
        setError(result.message);
        return;
      }

      // Failed
      setError(result.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.85} style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color="#282828" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Complete your order</Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Payment protection banner */}
        <View style={styles.protectionBanner}>
          <Ionicons name="shield-checkmark-outline" size={16} color="#076B51" />
          <Text style={styles.protectionText}>Your payment is protected until delivery is confirmed</Text>
        </View>

        {/* Delivery address */}
        <Text style={styles.fieldLabel}>Delivery address</Text>
        <View style={styles.inputWrap}>
          <TextInput style={styles.input} placeholder="Enter your full address" placeholderTextColor="#858585" value={address} onChangeText={setAddress} />
        </View>

        {/* Payment method selection */}
        <Text style={styles.fieldLabel}>Payment method</Text>
        <View style={styles.paymentOptions}>
          <TouchableOpacity
            onPress={() => setPaymentMethod("stripe")}
            style={[styles.paymentOption, paymentMethod === "stripe" && styles.paymentOptionActive]}
          >
            <Ionicons name="card-outline" size={18} color={paymentMethod === "stripe" ? "#076B51" : "#858585"} />
            <Text style={[styles.paymentOptionText, paymentMethod === "stripe" && styles.paymentOptionTextActive]}>Card (Stripe)</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => { setPaymentMethod("wallet"); setWalletAmount(String(grandTotal)); }}
            style={[styles.paymentOption, paymentMethod === "wallet" && styles.paymentOptionActive, !canPayFullyWithWallet && { opacity: 0.5 }]}
            disabled={!canPayFullyWithWallet}
          >
            <Ionicons name="wallet-outline" size={18} color={paymentMethod === "wallet" ? "#076B51" : "#858585"} />
            <Text style={[styles.paymentOptionText, paymentMethod === "wallet" && styles.paymentOptionTextActive]}>
              Wallet (£{walletBalance.toFixed(2)})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setPaymentMethod("wallet_stripe")}
            style={[styles.paymentOption, paymentMethod === "wallet_stripe" && styles.paymentOptionActive, walletBalance <= 0 && { opacity: 0.5 }]}
            disabled={walletBalance <= 0}
          >
            <Ionicons name="swap-horizontal-outline" size={18} color={paymentMethod === "wallet_stripe" ? "#076B51" : "#858585"} />
            <Text style={[styles.paymentOptionText, paymentMethod === "wallet_stripe" && styles.paymentOptionTextActive]}>Wallet + Card</Text>
          </TouchableOpacity>
        </View>

        {/* Stripe availability hint (Expo Go cannot run native PaymentSheet) */}
        {(paymentMethod === "stripe" || paymentMethod === "wallet_stripe") && !isPaymentSheetAvailable() ? (
          <View style={{ backgroundColor: "#FFF8E8", borderRadius: 12, padding: 12, marginBottom: 16, flexDirection: "row", gap: 8 }}>
            <Ionicons name="information-circle-outline" size={18} color="#856B0E" style={{ marginTop: 1 }} />
            <Text style={{ flex: 1, fontSize: 12, fontFamily: "Outfit-Regular", color: "#856B0E", lineHeight: 18 }}>
              Card payments need a development build. In Expo Go, only Wallet payment will complete.
            </Text>
          </View>
        ) : null}

        {/* Wallet amount input for wallet_stripe */}
        {paymentMethod === "wallet_stripe" && (
          <View style={{ marginBottom: 20 }}>
            <Text style={styles.fieldLabel}>Amount from wallet (max £{walletBalance.toFixed(2)})</Text>
            <View style={styles.inputWrap}>
              <TextInput
                style={styles.input}
                placeholder="0.00"
                placeholderTextColor="#858585"
                value={walletAmount}
                onChangeText={(v) => {
                  const num = Number(v) || 0;
                  if (num <= walletBalance && num <= grandTotal) setWalletAmount(v);
                }}
                keyboardType="decimal-pad"
              />
            </View>
            <Text style={{ fontSize: 12, fontFamily: "Outfit-Regular", color: "#858585", marginTop: 4 }}>
              Remaining £{(grandTotal - (Number(walletAmount) || 0)).toFixed(2)} will be charged to your card.
            </Text>
          </View>
        )}

        {/* Order summary */}
        <View style={styles.summarySection}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Items total</Text>
            <Text style={styles.summaryValue}>£{subtotal.toFixed(2)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Shipping</Text>
            <Text style={styles.summaryValue}>£{deliveryTotal.toFixed(2)}</Text>
          </View>
          {paymentMethod === "wallet_stripe" && parsedWalletAmount > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Wallet applied</Text>
              <Text style={[styles.summaryValue, { color: "#076B51" }]}>-£{parsedWalletAmount.toFixed(2)}</Text>
            </View>
          )}
          <View style={[styles.summaryRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Final total</Text>
            <Text style={styles.totalValue}>£{grandTotal.toFixed(2)}</Text>
          </View>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {/* Place order button */}
        <TouchableOpacity
          onPress={handlePlaceOrder}
          activeOpacity={0.85}
          style={[styles.placeOrderBtn, (submitting || items.length === 0) && { opacity: 0.6 }]}
          disabled={submitting || items.length === 0}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.placeOrderText}>Pay Securely</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Success Modal */}
      <Modal visible={showSuccess} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIcon}>
              <Ionicons name="checkmark-circle" size={40} color="#076B51" />
            </View>
            <Text style={styles.modalTitle}>Payment Submitted</Text>
            <Text style={styles.modalBody}>Your order is being confirmed. The vendor will be notified once payment is processed.</Text>
            <TouchableOpacity onPress={() => { setShowSuccess(false); router.push("/(buyer)/orders" as any); }} activeOpacity={0.85} style={styles.trackBtn}>
              <Text style={styles.trackBtnText}>View Orders</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setShowSuccess(false); router.replace("/(buyer)" as any); }} activeOpacity={0.85} style={styles.closeModalBtn}>
              <Text style={{ fontSize: 13, fontFamily: "Outfit-Medium", color: "#858585" }}>Continue Shopping</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 16, gap: 12 },
  backButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#F4F4F4", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 22, fontFamily: "Manrope-Bold", color: "#282828" },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  protectionBanner: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#F4F4F4", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 24 },
  protectionText: { flex: 1, fontSize: 12, fontFamily: "Outfit-Regular", color: "#282828" },
  fieldLabel: { fontSize: 14, fontFamily: "Outfit-Medium", color: "#858585", marginBottom: 8 },
  inputWrap: { backgroundColor: "#F4F4F4", borderRadius: 12, marginBottom: 20 },
  input: { height: 50, paddingHorizontal: 16, fontSize: 14, fontFamily: "Outfit-Regular", color: "#282828" },
  paymentOptions: { gap: 8, marginBottom: 20 },
  paymentOption: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#F4F4F4", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, borderWidth: 1.5, borderColor: "transparent" },
  paymentOptionActive: { borderColor: "#076B51", backgroundColor: "rgba(7,107,81,0.05)" },
  paymentOptionText: { fontSize: 14, fontFamily: "Outfit-Medium", color: "#282828" },
  paymentOptionTextActive: { color: "#076B51" },
  summarySection: { marginBottom: 16 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8 },
  summaryLabel: { fontSize: 14, fontFamily: "Outfit-Regular", color: "#858585" },
  summaryValue: { fontSize: 14, fontFamily: "Outfit-Medium", color: "#282828" },
  totalRow: { borderTopWidth: 1, borderTopColor: "#F0F0F0", marginTop: 8, paddingTop: 12 },
  totalLabel: { fontSize: 16, fontFamily: "Manrope-Bold", color: "#282828" },
  totalValue: { fontSize: 20, fontFamily: "Manrope-Bold", color: "#076B51" },
  errorText: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#FB6363", textAlign: "center", marginBottom: 12 },
  placeOrderBtn: { height: 56, borderRadius: 14, backgroundColor: "#076B51", alignItems: "center", justifyContent: "center" },
  placeOrderText: { fontSize: 16, fontFamily: "Manrope-SemiBold", color: "#FFFFFF" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", alignItems: "center", paddingHorizontal: 24 },
  modalCard: { width: "100%", backgroundColor: "#FFFFFF", borderRadius: 24, padding: 28, alignItems: "center" },
  modalIcon: { marginBottom: 16 },
  modalTitle: { fontSize: 20, fontFamily: "Manrope-Bold", color: "#282828", textAlign: "center" },
  modalBody: { fontSize: 14, fontFamily: "Outfit-Regular", color: "#858585", textAlign: "center", marginTop: 8, lineHeight: 21 },
  trackBtn: { width: "100%", height: 52, borderRadius: 14, backgroundColor: "#076B51", alignItems: "center", justifyContent: "center", marginTop: 20 },
  trackBtnText: { fontSize: 15, fontFamily: "Manrope-SemiBold", color: "#FFFFFF" },
  closeModalBtn: { width: "100%", height: 44, alignItems: "center", justifyContent: "center", marginTop: 10 },
});
