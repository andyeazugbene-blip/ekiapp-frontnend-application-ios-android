import React, { useEffect, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
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
import { addressService, type SavedAddress } from "../../services/addressService";
import { formatDisplayMoney } from "../../utils/currency";
import { goBackOrReplace } from "../../utils/navigation";

function formatAddress(a: SavedAddress): string {
  return [a.line1, a.line2, a.city, a.postalCode, a.country].filter(Boolean).join(", ");
}

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
  const cartCurrency = useCartStore((s) => s.currency);
  const subtotal = useCartStore((s) => s.subtotal());
  const deliveryTotal = useCartStore((s) => s.deliveryTotal());
  const grandTotal = useCartStore((s) => s.grandTotal());
  const deliveryEstimates = useCartStore((s) => s.deliveryEstimates);
  const createCheckout = useCartStore((s) => s.createCheckout);
  const syncWithServer = useCartStore((s) => s.syncWithServer);
  const calculateDelivery = useCartStore((s) => s.calculateDelivery);
  const clearCart = useCartStore((s) => s.clearCart);
  const storeDeliveryCountry = useCartStore((s) => s.deliveryCountry);
  const setDeliveryCountry = useCartStore((s) => s.setDeliveryCountry);
  const ensureCurrency = useCurrencyStore((s) => s.ensureCurrency);
  const user = useAuthStore((s) => s.user);

  const [address, setAddress] = useState("");
  const [country, setCountry] = useState("");
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [loadingAddresses, setLoadingAddresses] = useState(true);
  const [showAddressPicker, setShowAddressPicker] = useState(false);
  const [showAddAddressForm, setShowAddAddressForm] = useState(false);
  const [newAddress, setNewAddress] = useState({ recipientName: "", line1: "", city: "", postalCode: "", country: "", phone: "" });
  const [savingAddress, setSavingAddress] = useState(false);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("stripe");
  const [walletAmount, setWalletAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const [createdOrderIds, setCreatedOrderIds] = useState<string[]>([]);
  const [appliedCampaign, setAppliedCampaign] = useState<{ title: string; discount: number } | null>(null);
  const [eligibleDeal, setEligibleDeal] = useState<Campaign | null>(null);
  const [promoCode, setPromoCode] = useState("");

  const walletBalance = wallet?.balance ?? 0;
  const checkoutCurrency = cartCurrency || items[0]?.product.currency || wallet?.currency || "GBP";
  const walletCurrency = wallet?.currency ?? checkoutCurrency;
  const walletMatchesCheckoutCurrency = walletCurrency.toUpperCase() === checkoutCurrency.toUpperCase();
  const parsedWalletAmount = Number(walletAmount) || 0;
  const parsedWalletAmountInCheckoutCurrency = walletMatchesCheckoutCurrency ? parsedWalletAmount : 0;
  const canPayFullyWithWallet = walletMatchesCheckoutCurrency && walletBalance >= grandTotal;
  const hasNoSavedAddress = !loadingAddresses && addresses.length === 0;
  // A delivery/currency-zone error (e.g. this address's country has no
  // matching delivery zone) clears deliveryEstimates and sets `error` — but
  // previously left the Pay button fully enabled, so the buyer could tap
  // into a payment attempt from a screen that was already showing a
  // blocking error. Once there's at least one item, a resolved (non-zero)
  // delivery estimate AND a selected address are required before payment.
  const deliveryUnresolved = items.length > 0 && deliveryEstimates.length === 0;
  const canSubmitOrder = !submitting && items.length > 0 && !deliveryUnresolved && Boolean(selectedAddressId);

  const estimatedDiscount = eligibleDeal && eligibleDeal.discountValue != null
    ? eligibleDeal.discountType === "PERCENTAGE"
      ? grandTotal * eligibleDeal.discountValue / 100
      : Math.min(eligibleDeal.discountValue / 100, grandTotal)
    : 0;
  const estimatedTotal = Math.max(0, grandTotal - estimatedDiscount);

  useEffect(() => {
    // Checkout can be reached without passing back through the cart screen
    // (backgrounded app resumed here, a deep link, a slow re-render) — always
    // re-sync with the server on mount so the price/stock shown here, and
    // used to compute the total the buyer is about to pay, is live rather
    // than whatever was cached from whenever the cart was last touched.
    syncWithServer().catch(() => {});
    walletService
      .getWallet()
      .then((nextWallet) => setWallet(nextWallet))
      .catch(() => {});
    campaignService
      .getMyCampaigns()
      .then((campaigns) => {
        const best = campaigns.find(
          (c) => c.type === "HOT_DEAL" && c.eligible && c.discountType && c.discountValue != null && c.discountValue > 0,
        );
        setEligibleDeal(best ?? null);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    ensureCurrency(checkoutCurrency).catch(() => undefined);
  }, [checkoutCurrency, ensureCurrency]);

  useEffect(() => {
    let cancelled = false;
    addressService
      .getAddresses()
      .then((list) => {
        if (cancelled) return;
        setAddresses(list);
        const preferred = list.find((a) => a.isDefault) ?? list[0];
        if (preferred) {
          setSelectedAddressId(preferred.id);
          setAddress(formatAddress(preferred));
          setCountry(preferred.country);
          setDeliveryCountry(preferred.country);
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoadingAddresses(false); });
    return () => { cancelled = true; };
    // Runs once on mount — the buyer's address book doesn't change from
    // anything else on this screen re-rendering.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Only fall back to a currency-inferred country when the buyer genuinely
    // has no saved address yet — once an address exists, IT is the source
    // of truth for delivery country, not a currency guess.
    if (addresses.length > 0 || loadingAddresses) return;
    const profileCountry =
      user && "country" in user && typeof user.country === "string"
        ? user.country.trim()
        : "";
    const nextCountry = profileCountry || storeDeliveryCountry || inferCountryFromCurrency(checkoutCurrency);
    setCountry((current) => current || nextCountry);
    setDeliveryCountry(nextCountry);
  }, [addresses.length, checkoutCurrency, loadingAddresses, setDeliveryCountry, storeDeliveryCountry, user]);

  useEffect(() => {
    if (!items.length || !country.trim()) return;
    calculateDelivery(country.trim()).catch((err) => {
      setError(err instanceof Error ? err.message : "Could not calculate delivery for this country.");
    });
  }, [calculateDelivery, country, items.length]);

  const selectAddress = (a: SavedAddress) => {
    setSelectedAddressId(a.id);
    setAddress(formatAddress(a));
    setCountry(a.country);
    setDeliveryCountry(a.country);
    setShowAddressPicker(false);
    setShowAddAddressForm(false);
    if (error) setError("");
  };

  const handleSaveNewAddress = async () => {
    if (!newAddress.recipientName.trim() || !newAddress.line1.trim() || !newAddress.city.trim() || !newAddress.country.trim()) {
      setError("Enter a recipient name, address line, city, and country to save this address.");
      return;
    }
    setSavingAddress(true);
    try {
      const saved = await addressService.createAddress({
        recipientName: newAddress.recipientName.trim(),
        line1: newAddress.line1.trim(),
        city: newAddress.city.trim(),
        postalCode: newAddress.postalCode.trim(),
        country: newAddress.country.trim(),
        phone: newAddress.phone.trim() || undefined,
        isDefault: addresses.length === 0,
      });
      setAddresses((prev) => [...prev, saved]);
      selectAddress(saved);
      setNewAddress({ recipientName: "", line1: "", city: "", postalCode: "", country: "", phone: "" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save this address.");
    } finally {
      setSavingAddress(false);
    }
  };

  const handlePlaceOrder = async () => {
    // Re-entrancy guard: `disabled={submitting}` on the button stops a
    // SECOND real tap once React has re-rendered, but two rapid taps in the
    // same event-loop tick (before that re-render lands) can both invoke
    // this handler — this is the actual gate that stops a real double
    // checkout attempt, not just the visual disabled state.
    if (submitting) return;
    if (!selectedAddressId || !address.trim()) {
      setError("Add a delivery address to continue.");
      return;
    }
    if (deliveryUnresolved) {
      setError("We can't deliver to this address yet. Choose another address or check the vendor's delivery area.");
      return;
    }
    setError("");

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
      const walletCents = paymentMethod === "wallet" ? Math.round(walletBalance * 100) : undefined;
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
        setError("Wallet payment failed. Please try again or use Card."); return;
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
        <TouchableOpacity onPress={() => goBackOrReplace(router, "/(buyer)/cart" as any)} activeOpacity={0.85} accessibilityLabel="Go back" accessibilityRole="button" style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color="#282828" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Complete your order</Text>
        {/* This always shows the real currency the buyer is being charged
            in — it is not an editable display preference. Checkout currency
            is fixed by what's in the cart, so letting a stale/unrelated
            "preferred currency" from browsing show here (while every actual
            amount below was already computed correctly) was the exact
            confusing-checkout bug this badge used to cause. */}
        <View style={styles.currencyButton}>
          <Text style={styles.currencyButtonText}>{checkoutCurrency.toUpperCase()}</Text>
        </View>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.protectionBanner}>
          <Ionicons name="shield-checkmark-outline" size={16} color="#076B51" />
          <Text style={styles.protectionText}>Your payment is protected until delivery is confirmed</Text>
        </View>

        <Text style={styles.fieldLabel}>Delivery address</Text>
        {loadingAddresses ? (
          <View style={styles.addressCard}>
            <ActivityIndicator color="#076B51" size="small" />
          </View>
        ) : hasNoSavedAddress && !showAddAddressForm ? (
          <View style={styles.addressEmptyCard}>
            <Ionicons name="location-outline" size={22} color="#858585" />
            <Text style={styles.addressEmptyText}>Add a delivery address to continue.</Text>
            <TouchableOpacity onPress={() => setShowAddAddressForm(true)} activeOpacity={0.85} style={styles.addAddressBtn}>
              <Text style={styles.addAddressBtnText}>Add address</Text>
            </TouchableOpacity>
          </View>
        ) : showAddAddressForm ? (
          <View style={styles.addressFormCard}>
            <TextInput style={styles.input} placeholder="Recipient name" placeholderTextColor="#858585" value={newAddress.recipientName} onChangeText={(v) => setNewAddress((p) => ({ ...p, recipientName: v }))} />
            <TextInput style={[styles.input, { marginTop: 8 }]} placeholder="Address line" placeholderTextColor="#858585" value={newAddress.line1} onChangeText={(v) => setNewAddress((p) => ({ ...p, line1: v }))} />
            <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
              <TextInput style={[styles.input, { flex: 1 }]} placeholder="City" placeholderTextColor="#858585" value={newAddress.city} onChangeText={(v) => setNewAddress((p) => ({ ...p, city: v }))} />
              <TextInput style={[styles.input, { flex: 1 }]} placeholder="Postal code" placeholderTextColor="#858585" value={newAddress.postalCode} onChangeText={(v) => setNewAddress((p) => ({ ...p, postalCode: v }))} />
            </View>
            <TextInput style={[styles.input, { marginTop: 8 }]} placeholder="Country" placeholderTextColor="#858585" autoCapitalize="words" value={newAddress.country} onChangeText={(v) => setNewAddress((p) => ({ ...p, country: v }))} />
            <TextInput style={[styles.input, { marginTop: 8 }]} placeholder="Phone (optional)" placeholderTextColor="#858585" keyboardType="phone-pad" value={newAddress.phone} onChangeText={(v) => setNewAddress((p) => ({ ...p, phone: v }))} />
            <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
              <TouchableOpacity onPress={handleSaveNewAddress} disabled={savingAddress} activeOpacity={0.85} style={[styles.addAddressBtn, { flex: 1 }, savingAddress && { opacity: 0.6 }]}>
                {savingAddress ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.addAddressBtnText}>Save address</Text>}
              </TouchableOpacity>
              {addresses.length > 0 ? (
                <TouchableOpacity onPress={() => setShowAddAddressForm(false)} activeOpacity={0.85} style={styles.addressCancelBtn}>
                  <Text style={styles.addressCancelBtnText}>Cancel</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        ) : (
          <View style={styles.addressCard}>
            <View style={{ flex: 1 }}>
              {addresses.find((a) => a.id === selectedAddressId) ? (
                <>
                  <Text style={styles.addressName}>{addresses.find((a) => a.id === selectedAddressId)!.recipientName}</Text>
                  <Text style={styles.addressText}>{address}</Text>
                </>
              ) : (
                <Text style={styles.addressText}>{address}</Text>
              )}
            </View>
            <TouchableOpacity onPress={() => setShowAddressPicker(true)} activeOpacity={0.85} style={styles.changeAddressBtn}>
              <Text style={styles.changeAddressBtnText}>Change</Text>
            </TouchableOpacity>
          </View>
        )}

        {showAddressPicker ? (
          <View style={styles.addressPickerCard}>
            {addresses.map((a) => (
              <TouchableOpacity key={a.id} onPress={() => selectAddress(a)} activeOpacity={0.85} style={styles.addressPickerRow}>
                <Ionicons name={a.id === selectedAddressId ? "radio-button-on" : "radio-button-off"} size={18} color="#076B51" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.addressName}>{a.recipientName}</Text>
                  <Text style={styles.addressText}>{formatAddress(a)}</Text>
                </View>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              onPress={() => { setShowAddressPicker(false); setShowAddAddressForm(true); }}
              activeOpacity={0.85}
              style={styles.addressPickerRow}
            >
              <Ionicons name="add-circle-outline" size={18} color="#076B51" />
              <Text style={[styles.addressName, { color: "#076B51" }]}>Add new address</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowAddressPicker(false)} activeOpacity={0.85} style={styles.addressCancelBtn}>
              <Text style={styles.addressCancelBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {deliveryUnresolved && selectedAddressId ? (
          <View style={[styles.infoBanner, { backgroundColor: "#FDEDED" }]}>
            <Ionicons name="alert-circle-outline" size={18} color="#B3261E" style={{ marginTop: 1 }} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.infoBannerText, { color: "#B3261E" }]}>
                We can't deliver to this address yet. Choose another address or check the vendor's delivery area.
              </Text>
              <TouchableOpacity onPress={() => setShowAddressPicker(true)} activeOpacity={0.85} style={styles.chooseAnotherBtn}>
                <Text style={styles.chooseAnotherBtnText}>Choose another address</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

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
            accessibilityRole="radio"
            accessibilityState={{ checked: paymentMethod === "stripe" }}
            accessibilityLabel="Pay with card"
            style={[styles.paymentOption, paymentMethod === "stripe" && styles.paymentOptionActive]}
          >
            <Ionicons name="card-outline" size={18} color={paymentMethod === "stripe" ? "#076B51" : "#858585"} />
            <Text style={[styles.paymentOptionText, paymentMethod === "stripe" && styles.paymentOptionTextActive]}>💳 Card</Text>
            <Text style={styles.paymentOptionHint}>Pay full amount with card</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setPaymentMethod("wallet")}
            accessibilityRole="radio"
            accessibilityState={{ checked: paymentMethod === "wallet", disabled: !canPayFullyWithWallet }}
            accessibilityLabel={canPayFullyWithWallet ? "Pay with wallet" : "Pay with wallet — insufficient balance"}
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

        {/* The delivery-unresolved case already has its own dedicated
            banner (with a "Choose another address" action) right after the
            address section above — showing it again here as a second,
            duplicate banner is exactly the "repeated warning" this screen
            used to have. This generic line only ever shows OTHER errors
            (payment failures, validation messages) that aren't already
            covered by a dedicated banner elsewhere on the screen. */}
        {error && !deliveryUnresolved ? <Text style={styles.errorText}>{error}</Text> : null}

        <TouchableOpacity
          onPress={handlePlaceOrder}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={submitting ? "Processing payment" : canSubmitOrder ? "Pay securely" : !selectedAddressId ? "Add a delivery address to continue" : "Resolve delivery issue to continue"}
          accessibilityState={{ busy: submitting, disabled: !canSubmitOrder }}
          style={[styles.placeOrderBtn, !canSubmitOrder && { opacity: 0.6 }]}
          disabled={!canSubmitOrder}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.placeOrderText}>
              {!selectedAddressId ? "Add a delivery address to continue" : deliveryUnresolved ? "Resolve delivery issue to continue" : "Pay Securely"}
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={showSuccess} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIcon}>
              <Ionicons name="checkmark-circle" size={40} color="#076B51" />
            </View>
            <Text style={styles.modalTitle}>Payment Successful</Text>
            <Text style={styles.modalBody}>
              {createdOrderIds.length > 1
                ? `Your order has been split across ${createdOrderIds.length} sellers — each has been notified and will fulfil their part separately.`
                : "Your order has been placed and the vendor has been notified."}
            </Text>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 16, gap: 12 },
  backButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#F4F4F4", alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, fontSize: 22, fontFamily: "Manrope-Bold", color: "#282828" },
  currencyButton: { minWidth: 58, height: 38, borderRadius: 19, backgroundColor: "#EAF5F0", alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  currencyButtonText: { fontSize: 12, fontFamily: "Manrope-Bold", color: "#076B51" },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  protectionBanner: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#F4F4F4", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 24 },
  protectionText: { flex: 1, fontSize: 12, fontFamily: "Outfit-Regular", color: "#282828" },
  fieldLabel: { fontSize: 14, fontFamily: "Outfit-Medium", color: "#858585", marginBottom: 8 },
  inputWrap: { backgroundColor: "#F4F4F4", borderRadius: 12, marginBottom: 20 },
  input: { minHeight: 50, paddingHorizontal: 16, fontSize: 14, fontFamily: "Outfit-Regular", color: "#282828", backgroundColor: "#F4F4F4", borderRadius: 12 },
  addressCard: { flexDirection: "row", alignItems: "center", backgroundColor: "#F4F4F4", borderRadius: 12, padding: 16, marginBottom: 20, gap: 12 },
  addressEmptyCard: { alignItems: "center", backgroundColor: "#F4F4F4", borderRadius: 12, padding: 20, marginBottom: 20, gap: 10 },
  addressEmptyText: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#858585", textAlign: "center" },
  addressFormCard: { backgroundColor: "#F9F9F9", borderRadius: 12, padding: 14, marginBottom: 20, borderWidth: 1, borderColor: "#EEEEEE" },
  addAddressBtn: { height: 44, borderRadius: 10, backgroundColor: "#076B51", alignItems: "center", justifyContent: "center", paddingHorizontal: 20 },
  addAddressBtnText: { fontSize: 13, fontFamily: "Manrope-SemiBold", color: "#FFFFFF" },
  addressCancelBtn: { height: 44, borderRadius: 10, alignItems: "center", justifyContent: "center", paddingHorizontal: 16, borderWidth: 1, borderColor: "#E0E0E0" },
  addressCancelBtnText: { fontSize: 13, fontFamily: "Manrope-SemiBold", color: "#858585" },
  changeAddressBtn: { height: 36, borderRadius: 10, borderWidth: 1, borderColor: "#076B51", alignItems: "center", justifyContent: "center", paddingHorizontal: 14 },
  changeAddressBtnText: { fontSize: 12, fontFamily: "Manrope-SemiBold", color: "#076B51" },
  addressName: { fontSize: 14, fontFamily: "Manrope-Bold", color: "#282828" },
  addressText: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#687076", marginTop: 2 },
  addressPickerCard: { backgroundColor: "#FFFFFF", borderRadius: 12, borderWidth: 1, borderColor: "#EEEEEE", padding: 12, marginBottom: 20, gap: 4 },
  addressPickerRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10 },
  chooseAnotherBtn: { marginTop: 8, alignSelf: "flex-start", height: 36, borderRadius: 10, backgroundColor: "#B3261E", alignItems: "center", justifyContent: "center", paddingHorizontal: 14 },
  chooseAnotherBtnText: { fontSize: 12, fontFamily: "Manrope-SemiBold", color: "#FFFFFF" },
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

