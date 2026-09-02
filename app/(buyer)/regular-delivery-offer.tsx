import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { goBackOrReplace } from "../../utils/navigation";
import { formatDisplayMoney } from "../../utils/currency";
import { useCurrencyStore } from "../../stores/currencyStore";
import { addressService, type SavedAddress } from "../../services/addressService";
import { presentSetupIntent } from "../../services/stripePayment";
import {
  regularDeliveriesService,
  FREQUENCY_LABELS,
  type BuyerPaymentMethod,
  type SubscriptionFrequency,
  type SubscriptionOffer,
} from "../../services/regularDeliveriesService";

export default function RegularDeliveryOfferScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { selectedCurrency } = useCurrencyStore();

  const [offer, setOffer] = useState<SubscriptionOffer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [frequency, setFrequency] = useState<SubscriptionFrequency | null>(null);

  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [addressId, setAddressId] = useState<string | null>(null);
  const [showAddAddress, setShowAddAddress] = useState(false);
  const [newAddress, setNewAddress] = useState({ recipientName: "", line1: "", city: "", postalCode: "", country: "", phone: "" });
  const [savingAddress, setSavingAddress] = useState(false);

  const [paymentMethods, setPaymentMethods] = useState<BuyerPaymentMethod[]>([]);
  const [paymentMethodId, setPaymentMethodId] = useState<string | null>(null);
  const [addingCard, setAddingCard] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError("");
    try {
      const [offerData, addressList, methods] = await Promise.all([
        regularDeliveriesService.getOffer(id),
        addressService.getAddresses().catch(() => [] as SavedAddress[]),
        regularDeliveriesService.listPaymentMethods().catch(() => [] as BuyerPaymentMethod[]),
      ]);
      setOffer(offerData);
      setFrequency(offerData.frequencies[0] ?? null);
      setSelectedProductIds(new Set(offerData.products.map((p) => p.productId)));
      const qty: Record<string, number> = {};
      offerData.products.forEach((p) => { qty[p.productId] = 1; });
      setQuantities(qty);

      setAddresses(addressList);
      const defaultAddress = addressList.find((a) => a.isDefault) ?? addressList[0];
      setAddressId(defaultAddress?.id ?? null);

      setPaymentMethods(methods);
      const defaultMethod = methods.find((m) => m.isDefault) ?? methods[0];
      setPaymentMethodId(defaultMethod?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load this Regular Delivery offer.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const currencyCode = offer?.products[0]?.product.currency ?? "GBP";
  const totalMajor = useMemo(() => {
    if (!offer) return 0;
    let cents = 0;
    for (const p of offer.products) {
      if (!selectedProductIds.has(p.productId)) continue;
      cents += p.product.priceInCents * (quantities[p.productId] ?? 1);
    }
    return cents / 100;
  }, [offer, selectedProductIds, quantities]);

  const toggleProduct = (productId: string) => {
    setSelectedProductIds((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId); else next.add(productId);
      return next;
    });
  };

  const adjustQty = (productId: string, delta: number) => {
    setQuantities((prev) => ({ ...prev, [productId]: Math.max(1, (prev[productId] ?? 1) + delta) }));
  };

  const handleAddAddress = async () => {
    if (!newAddress.recipientName || !newAddress.line1 || !newAddress.city || !newAddress.country) {
      Alert.alert("Missing details", "Please fill in recipient name, address, city, and country.");
      return;
    }
    setSavingAddress(true);
    try {
      const saved = await addressService.createAddress({ ...newAddress, isDefault: addresses.length === 0 });
      setAddresses((prev) => [...prev, saved]);
      setAddressId(saved.id);
      setShowAddAddress(false);
      setNewAddress({ recipientName: "", line1: "", city: "", postalCode: "", country: "", phone: "" });
    } catch (err) {
      Alert.alert("Could not save address", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setSavingAddress(false);
    }
  };

  const handleAddCard = async () => {
    setAddingCard(true);
    try {
      const { clientSecret } = await regularDeliveriesService.createSetupIntent();
      const result = await presentSetupIntent({ clientSecret });
      if (result.status === "succeeded") {
        // The client only confirms the intent was completed — the backend
        // re-verifies it server-side before actually saving the card.
        const setupIntentId = clientSecret.split("_secret_")[0];
        await regularDeliveriesService.confirmSetupIntent(setupIntentId);
        const methods = await regularDeliveriesService.listPaymentMethods();
        setPaymentMethods(methods);
        setPaymentMethodId(methods.find((m) => m.isDefault)?.id ?? methods[0]?.id ?? null);
      } else if (result.status !== "cancelled") {
        Alert.alert("Could not save card", result.message ?? "Please try again.");
      }
    } catch (err) {
      Alert.alert("Could not save card", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setAddingCard(false);
    }
  };

  const handleStart = async () => {
    if (!offer || !frequency) return;
    const items = Array.from(selectedProductIds).map((productId) => ({ productId, quantity: quantities[productId] ?? 1 }));
    if (items.length === 0) {
      setSubmitError("Choose at least one product.");
      return;
    }
    if (!addressId) {
      setSubmitError("Add a delivery address to continue.");
      return;
    }
    if (!paymentMethodId) {
      setSubmitError("Add a payment method to continue.");
      return;
    }
    setSubmitting(true);
    setSubmitError("");
    try {
      const subscription = await regularDeliveriesService.createSubscription({
        offerId: offer.id,
        frequency,
        deliveryAddressId: addressId,
        paymentMethodId,
        items,
      });
      router.replace({ pathname: "/(buyer)/regular-delivery-detail", params: { id: subscription.id } } as any);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Could not start this Regular Delivery.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => goBackOrReplace(router, "/(buyer)/regular-deliveries" as any)} activeOpacity={0.85} style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color="#282828" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Regular Delivery</Text>
        <View style={{ width: 38 }} />
      </View>

      {loading ? (
        <View style={styles.placeholder}><ActivityIndicator color="#076B51" /></View>
      ) : error || !offer ? (
        <View style={styles.emptyState}>
          <Ionicons name="alert-circle-outline" size={28} color="#D6552F" />
          <Text style={styles.emptyTitle}>Couldn't load this offer</Text>
          <Text style={styles.emptyText}>{error || "This Regular Delivery offer is not available."}</Text>
          <TouchableOpacity onPress={() => void load()} activeOpacity={0.86} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.offerCard}>
            <Text style={styles.vendorName}>{offer.vendor?.storeName ?? "Vendor"}</Text>
            <Text style={styles.offerTitle}>{offer.title}</Text>
            {offer.description ? <Text style={styles.offerDescription}>{offer.description}</Text> : null}
          </View>

          <Text style={styles.section}>Products</Text>
          {offer.products.map((p) => {
            const selected = selectedProductIds.has(p.productId);
            return (
              <View key={p.productId} style={[styles.productRow, !selected && styles.productRowMuted]}>
                <TouchableOpacity onPress={() => toggleProduct(p.productId)} activeOpacity={0.8} style={styles.checkbox}>
                  {selected ? <Ionicons name="checkmark" size={14} color="#FFFFFF" /> : null}
                </TouchableOpacity>
                <View style={styles.productCopy}>
                  <Text style={styles.productTitle}>{p.product.title}</Text>
                  <Text style={styles.productPrice}>{formatDisplayMoney(p.product.priceInCents / 100, p.product.currency, selectedCurrency)}</Text>
                </View>
                {selected ? (
                  <View style={styles.stepper}>
                    <TouchableOpacity onPress={() => adjustQty(p.productId, -1)} style={styles.stepperBtn}>
                      <Ionicons name="remove" size={14} color="#076B51" />
                    </TouchableOpacity>
                    <Text style={styles.stepperValue}>{quantities[p.productId] ?? 1}</Text>
                    <TouchableOpacity onPress={() => adjustQty(p.productId, 1)} style={styles.stepperBtn}>
                      <Ionicons name="add" size={14} color="#076B51" />
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>
            );
          })}

          <Text style={styles.section}>Frequency</Text>
          <View style={styles.chipRow}>
            {offer.frequencies.map((f) => (
              <TouchableOpacity
                key={f}
                onPress={() => setFrequency(f)}
                activeOpacity={0.85}
                style={[styles.chip, frequency === f && styles.chipActive]}
              >
                <Text style={[styles.chipText, frequency === f && styles.chipTextActive]}>{FREQUENCY_LABELS[f]}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.section}>Delivery address</Text>
          {addresses.map((a) => (
            <TouchableOpacity key={a.id} onPress={() => setAddressId(a.id)} activeOpacity={0.85} style={[styles.optionRow, addressId === a.id && styles.optionRowActive]}>
              <Ionicons name={addressId === a.id ? "radio-button-on" : "radio-button-off"} size={18} color={addressId === a.id ? "#076B51" : "#9AA3A0"} />
              <View style={styles.optionCopy}>
                <Text style={styles.optionTitle}>{a.recipientName}</Text>
                <Text style={styles.optionBody}>{a.line1}, {a.city}, {a.country}</Text>
              </View>
            </TouchableOpacity>
          ))}
          {showAddAddress ? (
            <View style={styles.addForm}>
              <TextInput placeholder="Recipient name" placeholderTextColor="#9AA3A0" style={styles.input} value={newAddress.recipientName} onChangeText={(v) => setNewAddress((p) => ({ ...p, recipientName: v }))} />
              <TextInput placeholder="Address line" placeholderTextColor="#9AA3A0" style={styles.input} value={newAddress.line1} onChangeText={(v) => setNewAddress((p) => ({ ...p, line1: v }))} />
              <TextInput placeholder="City" placeholderTextColor="#9AA3A0" style={styles.input} value={newAddress.city} onChangeText={(v) => setNewAddress((p) => ({ ...p, city: v }))} />
              <TextInput placeholder="Postal code" placeholderTextColor="#9AA3A0" style={styles.input} value={newAddress.postalCode} onChangeText={(v) => setNewAddress((p) => ({ ...p, postalCode: v }))} />
              <TextInput placeholder="Country" placeholderTextColor="#9AA3A0" style={styles.input} value={newAddress.country} onChangeText={(v) => setNewAddress((p) => ({ ...p, country: v }))} />
              <TextInput placeholder="Phone (optional)" placeholderTextColor="#9AA3A0" style={styles.input} value={newAddress.phone} onChangeText={(v) => setNewAddress((p) => ({ ...p, phone: v }))} />
              <TouchableOpacity onPress={handleAddAddress} disabled={savingAddress} activeOpacity={0.86} style={styles.primaryBtn}>
                {savingAddress ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.primaryBtnText}>Save address</Text>}
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity onPress={() => setShowAddAddress(true)} activeOpacity={0.85} style={styles.addRow}>
              <Ionicons name="add-circle-outline" size={18} color="#076B51" />
              <Text style={styles.addRowText}>Add delivery address</Text>
            </TouchableOpacity>
          )}

          <Text style={styles.section}>Payment method</Text>
          {paymentMethods.map((m) => (
            <TouchableOpacity key={m.id} onPress={() => setPaymentMethodId(m.id)} activeOpacity={0.85} style={[styles.optionRow, paymentMethodId === m.id && styles.optionRowActive]}>
              <Ionicons name={paymentMethodId === m.id ? "radio-button-on" : "radio-button-off"} size={18} color={paymentMethodId === m.id ? "#076B51" : "#9AA3A0"} />
              <View style={styles.optionCopy}>
                <Text style={styles.optionTitle}>{(m.brand ?? "Card").toUpperCase()} •••• {m.last4}</Text>
              </View>
            </TouchableOpacity>
          ))}
          <TouchableOpacity onPress={handleAddCard} disabled={addingCard} activeOpacity={0.85} style={styles.addRow}>
            {addingCard ? <ActivityIndicator size="small" color="#076B51" /> : <Ionicons name="card-outline" size={18} color="#076B51" />}
            <Text style={styles.addRowText}>{addingCard ? "Saving card..." : "Add a card"}</Text>
          </TouchableOpacity>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Estimated total per delivery</Text>
            <Text style={styles.summaryValue}>{formatDisplayMoney(totalMajor, currencyCode, selectedCurrency)}</Text>
          </View>

          {submitError ? <Text style={styles.submitError}>{submitError}</Text> : null}

          <TouchableOpacity onPress={handleStart} disabled={submitting} activeOpacity={0.88} style={[styles.primaryBtn, submitting && { opacity: 0.7 }]}>
            {submitting ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.primaryBtnText}>Start Delivery</Text>}
          </TouchableOpacity>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9F9F9" },
  header: { backgroundColor: "#FFFFFF", paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16, flexDirection: "row", alignItems: "center", gap: 12 },
  backButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#F4F4F4", alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, fontSize: 20, fontFamily: "Manrope-Bold", color: "#282828" },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 120, gap: 10 },
  placeholder: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 8 },
  emptyTitle: { fontSize: 14, fontFamily: "Manrope-Bold", color: "#282828" },
  emptyText: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#858585", textAlign: "center" },
  retryButton: { marginTop: 10, minHeight: 38, borderRadius: 12, borderWidth: 1, borderColor: "#076B51", paddingHorizontal: 18, alignItems: "center", justifyContent: "center" },
  retryButtonText: { fontSize: 13, fontFamily: "Manrope-SemiBold", color: "#076B51" },
  offerCard: { backgroundColor: "#076B51", borderRadius: 18, padding: 18 },
  vendorName: { fontSize: 12, fontFamily: "Outfit-Medium", color: "rgba(255,255,255,0.8)" },
  offerTitle: { fontSize: 20, fontFamily: "Manrope-ExtraBold", color: "#FFFFFF", marginTop: 4 },
  offerDescription: { fontSize: 13, fontFamily: "Outfit-Regular", color: "rgba(255,255,255,0.85)", marginTop: 8, lineHeight: 18 },
  section: { fontSize: 15, fontFamily: "Manrope-Bold", color: "#282828", marginTop: 14, marginBottom: 2 },
  productRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 14, padding: 12, gap: 12 },
  productRowMuted: { opacity: 0.5 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: "#076B51", backgroundColor: "#076B51", alignItems: "center", justifyContent: "center" },
  productCopy: { flex: 1 },
  productTitle: { fontSize: 13, fontFamily: "Outfit-Medium", color: "#282828" },
  productPrice: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#858585", marginTop: 2 },
  stepper: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#F4F4F4", borderRadius: 10, paddingHorizontal: 6, paddingVertical: 4 },
  stepperBtn: { width: 22, height: 22, alignItems: "center", justifyContent: "center" },
  stepperValue: { fontSize: 13, fontFamily: "Manrope-Bold", color: "#282828", minWidth: 16, textAlign: "center" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#DADADA" },
  chipActive: { backgroundColor: "#076B51", borderColor: "#076B51" },
  chipText: { fontSize: 12, fontFamily: "Outfit-Medium", color: "#282828" },
  chipTextActive: { color: "#FFFFFF" },
  optionRow: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#FFFFFF", borderRadius: 14, padding: 12, borderWidth: 1, borderColor: "transparent" },
  optionRowActive: { borderColor: "#076B51" },
  optionCopy: { flex: 1 },
  optionTitle: { fontSize: 13, fontFamily: "Outfit-Medium", color: "#282828" },
  optionBody: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#858585", marginTop: 2 },
  addRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10 },
  addRowText: { fontSize: 13, fontFamily: "Manrope-SemiBold", color: "#076B51" },
  addForm: { backgroundColor: "#FFFFFF", borderRadius: 14, padding: 12, gap: 8 },
  input: { backgroundColor: "#F4F4F4", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, fontFamily: "Outfit-Regular", color: "#282828" },
  summaryCard: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#FFFFFF", borderRadius: 14, padding: 14, marginTop: 8 },
  summaryLabel: { fontSize: 13, fontFamily: "Outfit-Medium", color: "#858585" },
  summaryValue: { fontSize: 16, fontFamily: "Manrope-ExtraBold", color: "#282828" },
  submitError: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#FB6363", textAlign: "center" },
  primaryBtn: { minHeight: 52, borderRadius: 14, backgroundColor: "#076B51", alignItems: "center", justifyContent: "center", marginTop: 6 },
  primaryBtnText: { fontSize: 14, fontFamily: "Manrope-Bold", color: "#FFFFFF" },
});
