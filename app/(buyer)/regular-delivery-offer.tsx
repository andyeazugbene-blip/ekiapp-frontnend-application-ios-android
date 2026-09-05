import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { goBackOrReplace } from "../../utils/navigation";
import { formatDisplayMoney } from "../../utils/currency";
import { useCurrencyStore } from "../../stores/currencyStore";
import { addressService, type SavedAddress } from "../../services/addressService";
import { presentSetupIntent } from "../../services/stripePayment";
import {
  ErrorState,
  FloatingCard,
  LoadingBlock,
  PremiumHeader,
  PrimaryButton,
  premiumStyles,
} from "../../components/shared/PremiumBlocks";
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
    if (!offer || !frequency || submitting) return;
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
    <View style={premiumStyles.page}>
      <PremiumHeader title="Regular Delivery" subtitle={offer?.vendor?.storeName} onBack={() => goBackOrReplace(router, "/(buyer)/regular-deliveries" as any)} />

      {loading ? (
        <LoadingBlock />
      ) : error || !offer ? (
        <View style={premiumStyles.block}>
          <ErrorState
            title="We couldn't load this offer"
            message={error || "Check your connection and try again."}
            onRetry={() => void load()}
          />
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={[premiumStyles.scrollContent, { paddingTop: 18 }]} showsVerticalScrollIndicator={false}>
          <View style={[premiumStyles.block, { gap: 18 }]}>
            <FloatingCard>
              <Text style={styles.offerTitle}>{offer.title}</Text>
              {offer.description ? <Text style={styles.offerDescription}>{offer.description}</Text> : null}
            </FloatingCard>

            <View>
              <Text style={styles.sectionTitle}>Products</Text>
              <View style={{ gap: 8 }}>
                {offer.products.map((p) => {
                  const selected = selectedProductIds.has(p.productId);
                  return (
                    <FloatingCard key={p.productId} style={[styles.productRow, !selected && styles.productRowMuted]}>
                      <TouchableOpacity onPress={() => toggleProduct(p.productId)} activeOpacity={0.8} style={[styles.checkbox, !selected && styles.checkboxOff]}>
                        {selected ? <Ionicons name="checkmark" size={14} color="#FFFFFF" /> : null}
                      </TouchableOpacity>
                      <View style={styles.productCopy}>
                        <Text style={styles.productTitle} numberOfLines={1}>{p.product.title}</Text>
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
                    </FloatingCard>
                  );
                })}
              </View>
            </View>

            <View>
              <Text style={styles.sectionTitle}>Frequency</Text>
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
            </View>

            <View>
              <Text style={styles.sectionTitle}>Delivery address</Text>
              <View style={{ gap: 8 }}>
                {addresses.map((a) => (
                  <TouchableOpacity key={a.id} onPress={() => setAddressId(a.id)} activeOpacity={0.85}>
                    <FloatingCard style={[styles.optionRow, addressId === a.id && styles.optionRowActive]}>
                      <Ionicons name={addressId === a.id ? "radio-button-on" : "radio-button-off"} size={18} color={addressId === a.id ? "#076B51" : "#C7D2CB"} />
                      <View style={styles.optionCopy}>
                        <Text style={styles.optionTitle}>{a.recipientName}</Text>
                        <Text style={styles.optionBody}>{a.line1}, {a.city}, {a.country}</Text>
                      </View>
                    </FloatingCard>
                  </TouchableOpacity>
                ))}
                {showAddAddress ? (
                  <FloatingCard style={{ gap: 8 }}>
                    <TextInput placeholder="Recipient name" placeholderTextColor="#8AA194" style={styles.input} value={newAddress.recipientName} onChangeText={(v) => setNewAddress((p) => ({ ...p, recipientName: v }))} />
                    <TextInput placeholder="Address line" placeholderTextColor="#8AA194" style={styles.input} value={newAddress.line1} onChangeText={(v) => setNewAddress((p) => ({ ...p, line1: v }))} />
                    <TextInput placeholder="City" placeholderTextColor="#8AA194" style={styles.input} value={newAddress.city} onChangeText={(v) => setNewAddress((p) => ({ ...p, city: v }))} />
                    <TextInput placeholder="Postal code" placeholderTextColor="#8AA194" style={styles.input} value={newAddress.postalCode} onChangeText={(v) => setNewAddress((p) => ({ ...p, postalCode: v }))} />
                    <TextInput placeholder="Country" placeholderTextColor="#8AA194" style={styles.input} value={newAddress.country} onChangeText={(v) => setNewAddress((p) => ({ ...p, country: v }))} />
                    <TextInput placeholder="Phone (optional)" placeholderTextColor="#8AA194" style={styles.input} value={newAddress.phone} onChangeText={(v) => setNewAddress((p) => ({ ...p, phone: v }))} />
                    <PrimaryButton label="Save address" onPress={() => void handleAddAddress()} loading={savingAddress} style={{ marginTop: 2 }} />
                  </FloatingCard>
                ) : (
                  <TouchableOpacity onPress={() => setShowAddAddress(true)} activeOpacity={0.85} style={styles.addRow}>
                    <Ionicons name="add-circle-outline" size={18} color="#076B51" />
                    <Text style={styles.addRowText}>Add delivery address</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <View>
              <Text style={styles.sectionTitle}>Payment method</Text>
              <View style={{ gap: 8 }}>
                {paymentMethods.map((m) => (
                  <TouchableOpacity key={m.id} onPress={() => setPaymentMethodId(m.id)} activeOpacity={0.85}>
                    <FloatingCard style={[styles.optionRow, paymentMethodId === m.id && styles.optionRowActive]}>
                      <Ionicons name={paymentMethodId === m.id ? "radio-button-on" : "radio-button-off"} size={18} color={paymentMethodId === m.id ? "#076B51" : "#C7D2CB"} />
                      <View style={styles.optionCopy}>
                        <Text style={styles.optionTitle}>{(m.brand ?? "Card").toUpperCase()} •••• {m.last4}</Text>
                      </View>
                    </FloatingCard>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity onPress={() => void handleAddCard()} disabled={addingCard} activeOpacity={0.85} style={styles.addRow}>
                  {addingCard ? <ActivityIndicator size="small" color="#076B51" /> : <Ionicons name="card-outline" size={18} color="#076B51" />}
                  <Text style={styles.addRowText}>{addingCard ? "Saving card..." : "Add a card"}</Text>
                </TouchableOpacity>
              </View>
            </View>

            <FloatingCard style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Estimated total per delivery</Text>
              <Text style={styles.summaryValue}>{formatDisplayMoney(totalMajor, currencyCode, selectedCurrency)}</Text>
            </FloatingCard>

            {submitError ? <Text style={styles.submitError}>{submitError}</Text> : null}

            <PrimaryButton label="Start Delivery" onPress={() => void handleStart()} loading={submitting} />
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  offerTitle: { fontSize: 19, fontFamily: "Manrope-ExtraBold", color: "#151E1B" },
  offerDescription: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#6A7B72", marginTop: 8, lineHeight: 18 },
  sectionTitle: { fontSize: 15, fontFamily: "Manrope-ExtraBold", color: "#12221A", marginBottom: 10 },
  productRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  productRowMuted: { opacity: 0.55 },
  checkbox: { width: 22, height: 22, borderRadius: 7, borderWidth: 1.5, borderColor: "#076B51", backgroundColor: "#076B51", alignItems: "center", justifyContent: "center" },
  checkboxOff: { backgroundColor: "transparent", borderColor: "#C7D2CB" },
  productCopy: { flex: 1 },
  productTitle: { fontSize: 13, fontFamily: "Manrope-SemiBold", color: "#151E1B" },
  productPrice: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#6A7B72", marginTop: 2 },
  stepper: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#F0F3F1", borderRadius: 12, paddingHorizontal: 8, paddingVertical: 5 },
  stepperBtn: { width: 22, height: 22, alignItems: "center", justifyContent: "center" },
  stepperValue: { fontSize: 13, fontFamily: "Manrope-Bold", color: "#151E1B", minWidth: 16, textAlign: "center" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E2E8E4" },
  chipActive: { backgroundColor: "#076B51", borderColor: "#076B51" },
  chipText: { fontSize: 12, fontFamily: "Manrope-SemiBold", color: "#516A60" },
  chipTextActive: { color: "#FFFFFF" },
  optionRow: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1.5, borderColor: "transparent" },
  optionRowActive: { borderColor: "#076B51" },
  optionCopy: { flex: 1 },
  optionTitle: { fontSize: 13, fontFamily: "Manrope-SemiBold", color: "#151E1B" },
  optionBody: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#6A7B72", marginTop: 2 },
  addRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6 },
  addRowText: { fontSize: 13, fontFamily: "Manrope-Bold", color: "#076B51" },
  input: { backgroundColor: "#F4F6F5", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 13, fontFamily: "Outfit-Regular", color: "#151E1B" },
  summaryCard: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  summaryLabel: { fontSize: 13, fontFamily: "Outfit-Medium", color: "#6A7B72", flexShrink: 1, marginRight: 8 },
  summaryValue: { fontSize: 18, fontFamily: "Manrope-ExtraBold", color: "#151E1B" },
  submitError: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#D6552F", textAlign: "center" },
});
