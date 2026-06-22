import React, { useEffect, useState } from "react";
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useAuthStore } from "../../stores/authStore";
import { useCartStore } from "../../stores/cartStore";
import { useCurrencyStore } from "../../stores/currencyStore";
import { walletService, type Wallet } from "../../services/walletService";
import { campaignService, type Campaign } from "../../services/campaignService";
import { presentPayment, isPaymentSheetAvailable } from "../../services/stripePayment";
import { orderService } from "../../services/orderService";
import { CurrencySelector } from "../../components/ui/CurrencySelector";
import { formatDisplayMoney } from "../../utils/currency";
import { goBackOrReplace } from "../../utils/navigation";

type PaymentMethod = "stripe" | "wallet";

function inferCountryFromCurrency(currency?: string): string {
  switch ((currency ?? "").toUpperCase()) {
    case "EUR":
      return "Europe";
    case "USD":
      return "United States";
    case "CAD":
      return "Canada";
    case "NGN":
      return "Nigeria";
    case "GBP":
    default:
      return "United Kingdom";
  }
}

export default function CheckoutScreen() {
  const router = useRouter();
  const items = useCartStore((s) => s.items);
  const subtotal = useCartStore((s) => s.subtotal());
  const deliveryTotal = useCartStore((s) => s.deliveryTotal());
  const grandTotal = useCartStore((s) => s.grandTotal());
  const createCheckout = useCartStore((s) => s.createCheckout);
  const calculateDelivery = useCartStore((s) => s.calculateDelivery);
  const clearCart = useCartStore((s) => s.clearCart);
  const storeDeliveryCountry = useCartStore((s) => s.deliveryCountry);
  const setDeliveryCountry = useCartStore((s) => s.setDeliveryCountry);
  const selectedCurrency = useCurrencyStore((s) => s.selectedCurrency);
  const ensureCurrency = useCurrencyStore((s) => s.ensureCurrency);
  const setSelectedCurrency = useCurrencyStore((s) => s.setSelectedCurrency);
  const user = useAuthStore((s) => s.user);

  const [address, setAddress] = useState("");
  const [country, setCountry] = useState("");
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("stripe");
  const [walletAmount, setWalletAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const [createdOrderIds, setCreatedOrderIds] = useState<string[]>([]);
  const [appliedCampaign, setAppliedCampaign] = useState<{ title: string; discount: number } | null>(null);
  const [eligibleDeal, setEligibleDeal] = useState<Campaign | null>(null);
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [promoCode, setPromoCode] = useState("");

  const walletBalance = wallet?.balance ?? 0;
  const checkoutCurrency = items[0]?.product.currency ?? wallet?.currency ?? "GBP";
  const walletCurrency = wallet?.currency ?? checkoutCurrency;
  const walletMatchesCheckoutCurrency = walletCurrency.toUpperCase() === checkoutCurrency.toUpperCase();
  const parsedWalletAmount = Number(walletAmount) || 0;
  const parsedWalletAmountInCheckoutCurrency = walletMatchesCheckoutCurrency ? parsedWalletAmount : 0;
  const canPayFullyWithWallet = walletMatchesCheckoutCurrency && walletBalance >= grandTotal;

  const estimatedDiscount = eligibleDeal && eligibleDeal.discountValue != null
    ? eligibleDeal.discountType === "PERCENTAGE"
      ? grandTotal * eligibleDeal.discountValue / 100
      : Math.min(eligibleDeal.discountValue / 100, grandTotal)
    : 0;
  const estimatedTotal = Math.max(0, grandTotal - estimatedDiscount);

  useEffect(() => {
    walletService
      .getWallet()
      .then((nextWallet) => setWallet(nextWallet))
      .catch(() => {});
    campaignService
      .getMyCampaigns()
      .then((campaigns) => {
        const best = campaigns.find(
          (c) => c.type === "HOT_DEAL" && c.discountType && c.discountValue != null && c.discountValue > 0,
        );
        setEligibleDeal(best ?? null);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    ensureCurrency(checkoutCurrency).catch(() => undefined);
  }, [checkoutCurrency, ensureCurrency]);

  useEffect(() => {
    const profileCountry =
      user && "country" in user && typeof user.country === "string"
        ? user.country.trim()
        : "";
    const nextCountry = profileCountry || storeDeliveryCountry || inferCountryFromCurrency(checkoutCurrency);
    setCountry((current) => current || nextCountry);
    setDeliveryCountry(nextCountry);
  }, [checkoutCurrency, setDeliveryCountry, storeDeliveryCountry, user]);

  useEffect(() => {
    if (!items.length || !country.trim()) return;
    calculateDelivery(country.trim()).catch((err) => {
      setError(err instanceof Error ? err.message : "Could not calculate delivery for this country.");
    });
  }, [calculateDelivery, country, items.length]);

  const handlePlaceOrder = async () => {
    setError("");

    if (!country.trim()) {
      setError("Please enter your delivery country.");
      return;
    }
    if (!address.trim()) {
      setError("Please enter your delivery address.");
      return;
    }
    if (items.length === 0) {
      setError("Your cart is empty.");
      return;
    }
    if (paymentMethod === "wallet" && !walletMatchesCheckoutCurrency) {
      setError("Wallet currency doesn't match this checkout. Use Card instead.");
      return;
    }
    if (paymentMethod === "wallet" && walletBalance < grandTotal) {
      setError("Insufficient wallet balance. Use Card instead.");
      return;
    }
    if (paymentMethod === "stripe" && !isPaymentSheetAvailable()) {
      setError("Card payment is not available on this device. Please use wallet payment or try again.");
      return;
    }

    setSubmitting(true);
    try {
      const walletCents = paymentMethod === "wallet" ? Math.round(grandTotal * 100) : undefined;
      const trimmedPromo = promoCode.trim() || undefined;
      const intent = await createCheckout(address.trim(), walletCents, country.trim(), trimmedPromo);
      setCreatedOrderIds(intent.orderIds);
      setAppliedCampaign(
        intent.campaignTitle && intent.campaignDiscount
          ? { title: intent.campaignTitle, discount: intent.campaignDiscount }
          : null,
      );
      if (intent.clientSecret === "wallet_paid") {
        await clearCart(); setShowSuccess(true); return;
      }
      if (paymentMethod === "wallet") {
        setError("Wallet payment could not be completed. Please try again."); return;
      }
      if (!intent.clientSecret || intent.clientSecret === "") {
        setError("Payment could not be processed. Please try again."); return;
      }
      const result = await presentPayment({ clientSecret: intent.clientSecret, merchantDisplayName: "Eki" });
      if (result.status === "succeeded") { await clearCart(); setShowSuccess(true); return; }
      if (result.status === "cancelled") { setError("Cancelled."); return; }
      setError(result.message);
    } catch (err) { setError(err instanceof Error ? err.message : "Failed."); }
    finally { setSubmitting(false); }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => goBackOrReplace(router, "/(buyer)/cart" as any)} activeOpacity={0.85} style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color="#282828" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Complete your order</Text>
        <TouchableOpacity onPress={() => setCurrencyOpen(true)} activeOpacity={0.85} style={styles.currencyButton}>
          <Text style={styles.currencyButtonText}>{selectedCurrency}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.protectionBanner}>
          <Ionicons name="shield-checkmark-outline" size={16} color="#076B51" />
          <Text style={styles.protectionText}>Your payment is protected until delivery is confirmed</Text>
        </View>

        <Text style={styles.fieldLabel}>Delivery country</Text>
        <View style={styles.inputWrap}>
          <TextInput
            style={styles.input}
            placeholder="Delivery country"
            placeholderTextColor="#858585"
            value={country}
            autoCapitalize="words"
            onChangeText={(value) => {
              setCountry(value);
              setDeliveryCountry(value);
              if (error) setError("");
            }}
          />
        </View>

        <Text style={styles.fieldLabel}>Delivery address</Text>
        <View style={styles.inputWrap}>
          <TextInput
            style={styles.input}
            placeholder="Enter your full address"
            placeholderTextColor="#858585"
            value={address}
            onChangeText={(value) => {
              setAddress(value);
              if (error) setError("");
            }}
          />
        </View>

        <Text style={styles.fieldLabel}>Promo code</Text>
        <View style={styles.inputWrap}>
          <TextInput
            style={styles.input}
            placeholder="Enter promo or deal code (optional)"
            placeholderTextColor="#858585"
            value={promoCode}
            autoCapitalize="characters"
            onChangeText={(value) => {
              setPromoCode(value);
              if (error) setError("");
            }}
          />
        </View>

        <Text style={styles.fieldLabel}>Pay with</Text>
        <View style={styles.paymentOptions}>
          <TouchableOpacity
            onPress={() => setPaymentMethod("stripe")}
            style={[styles.paymentOption, paymentMethod === "stripe" && styles.paymentOptionActive]}
          >
            <Ionicons name="card-outline" size={18} color={paymentMethod === "stripe" ? "#076B51" : "#858585"} />
            <Text style={[styles.paymentOptionText, paymentMethod === "stripe" && styles.paymentOptionTextActive]}>💳 Card</Text>
            <Text style={styles.paymentOptionHint}>Pay full amount with card</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setPaymentMethod("wallet")}
            style={[styles.paymentOption, paymentMethod === "wallet" && styles.paymentOptionActive, !canPayFullyWithWallet && styles.paymentOptionDisabled]}
            disabled={!canPayFullyWithWallet}
          >
            <Ionicons name="wallet-outline" size={18} color={paymentMethod === "wallet" ? "#076B51" : "#858585"} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.paymentOptionText, paymentMethod === "wallet" && styles.paymentOptionTextActive]}>💰 Wallet</Text>
              <Text style={styles.paymentOptionHint}>
                {canPayFullyWithWallet ? `Balance: ${formatDisplayMoney(walletBalance, walletCurrency, checkoutCurrency)}` : "Insufficient balance"}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {!walletMatchesCheckoutCurrency && wallet ? (
          <View style={styles.infoBanner}>
            <Ionicons name="information-circle-outline" size={18} color="#856B0E" style={{ marginTop: 1 }} />
            <Text style={styles.infoBannerText}>
              Your wallet is {walletCurrency}. This checkout is {checkoutCurrency}, so wallet funds are display-only here.
            </Text>
          </View>
        ) : null}

        {paymentMethod === "stripe" && !isPaymentSheetAvailable() ? (
          <View style={styles.infoBanner}>
            <Ionicons name="information-circle-outline" size={18} color="#856B0E" style={{ marginTop: 1 }} />
            <Text style={styles.infoBannerText}>
              Card payment is not available on this device. Please use wallet payment instead.
            </Text>
          </View>
        ) : null}

        {paymentMethod === "wallet" ? (
          <View style={styles.infoBanner}>
            <Ionicons name="wallet-outline" size={18} color="#076B51" style={{ marginTop: 1 }} />
            <Text style={[styles.infoBannerText, { color: "#076B51" }]}>
              Full amount deducted from your wallet.
            </Text>
          </View>
        ) : null}

        <View style={styles.summarySection}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Items total</Text>
            <Text style={styles.summaryValue}>{formatDisplayMoney(subtotal, checkoutCurrency, checkoutCurrency)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Shipping</Text>
            <Text style={styles.summaryValue}>{formatDisplayMoney(deliveryTotal, checkoutCurrency, checkoutCurrency)}</Text>
          </View>
          {eligibleDeal && estimatedDiscount > 0 ? (
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: "#D6552F" }]}>{eligibleDeal.title}</Text>
              <Text style={[styles.summaryValue, { color: "#D6552F" }]}>
                −{formatDisplayMoney(estimatedDiscount, checkoutCurrency, checkoutCurrency)}
              </Text>
            </View>
          ) : null}
          {paymentMethod === "wallet" ? (
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: "#076B51" }]}>Paid with wallet</Text>
              <Text style={[styles.summaryValue, { color: "#076B51" }]}>
                {formatDisplayMoney(estimatedDiscount > 0 ? estimatedTotal : grandTotal, checkoutCurrency, checkoutCurrency)}
              </Text>
            </View>
          ) : null}
          <View style={[styles.summaryRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Final total</Text>
            <Text style={styles.totalValue}>{formatDisplayMoney(estimatedDiscount > 0 ? estimatedTotal : grandTotal, checkoutCurrency, checkoutCurrency)}</Text>
          </View>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <TouchableOpacity
          onPress={handlePlaceOrder}
          activeOpacity={0.85}
          style={[styles.placeOrderBtn, (submitting || items.length === 0) && { opacity: 0.6 }]}
          disabled={submitting || items.length === 0}
        >
          {submitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.placeOrderText}>Pay Securely</Text>}
        </TouchableOpacity>
      </ScrollView>

      <Modal visible={showSuccess} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIcon}>
              <Ionicons name="checkmark-circle" size={40} color="#076B51" />
            </View>
            <Text style={styles.modalTitle}>Payment Successful</Text>
            <Text style={styles.modalBody}>Your order has been placed and the vendor has been notified.</Text>
            {appliedCampaign ? (
              <Text style={styles.modalDiscount}>
                {appliedCampaign.title} applied: −{formatDisplayMoney(appliedCampaign.discount / 100, checkoutCurrency, checkoutCurrency)}
              </Text>
            ) : null}
            <TouchableOpacity onPress={() => { setShowSuccess(false); router.push("/(buyer)/orders" as any); }} activeOpacity={0.85} style={styles.trackBtn}>
              <Text style={styles.trackBtnText}>View Orders</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                setShowSuccess(false);
                router.push({ pathname: "/(buyer)/explore", params: { view: "products" } } as any);
              }}
              activeOpacity={0.85}
              style={styles.closeModalBtn}
            >
              <Text style={styles.closeModalText}>Continue Shopping</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 16, gap: 12 },
  backButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#F4F4F4", alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, fontSize: 22, fontFamily: "Manrope-Bold", color: "#282828" },
  currencyButton: { minWidth: 58, height: 38, borderRadius: 19, backgroundColor: "#EAF5F0", alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  currencyButtonText: { fontSize: 12, fontFamily: "Manrope-Bold", color: "#076B51" },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  protectionBanner: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#F4F4F4", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 24 },
  protectionText: { flex: 1, fontSize: 12, fontFamily: "Outfit-Regular", color: "#282828" },
  fieldLabel: { fontSize: 14, fontFamily: "Outfit-Medium", color: "#858585", marginBottom: 8 },
  inputWrap: { backgroundColor: "#F4F4F4", borderRadius: 12, marginBottom: 20 },
  input: { minHeight: 50, paddingHorizontal: 16, fontSize: 14, fontFamily: "Outfit-Regular", color: "#282828" },
  paymentOptions: { gap: 8, marginBottom: 20 },
  paymentOption: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#F4F4F4", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, borderWidth: 1.5, borderColor: "transparent" },
  paymentOptionActive: { borderColor: "#076B51", backgroundColor: "rgba(7,107,81,0.05)" },
  paymentOptionDisabled: { opacity: 0.5 },
  paymentOptionText: { fontSize: 14, fontFamily: "Outfit-Medium", color: "#282828" },
  paymentOptionTextActive: { color: "#076B51" },
  paymentOptionHint: { fontSize: 11, fontFamily: "Outfit-Regular", color: "#858585", marginTop: 2 },
  infoBanner: { backgroundColor: "#FFF8E8", borderRadius: 12, padding: 12, marginBottom: 16, flexDirection: "row", gap: 8 },
  infoBannerText: { flex: 1, fontSize: 12, fontFamily: "Outfit-Regular", color: "#856B0E", lineHeight: 18 },
  helpText: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#858585", marginTop: 4 },
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
  modalDiscount: { fontSize: 13, fontFamily: "Outfit-Medium", color: "#076B51", textAlign: "center", marginTop: 8 },
  trackBtn: { width: "100%", height: 52, borderRadius: 14, backgroundColor: "#076B51", alignItems: "center", justifyContent: "center", marginTop: 20 },
  trackBtnText: { fontSize: 15, fontFamily: "Manrope-SemiBold", color: "#FFFFFF" },
  closeModalBtn: { width: "100%", height: 44, alignItems: "center", justifyContent: "center", marginTop: 10 },
  closeModalText: { fontSize: 13, fontFamily: "Outfit-Medium", color: "#858585" },
});

