import React, { useCallback, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { goBackOrReplace } from "../../utils/navigation";
import { formatDisplayMoney } from "../../utils/currency";
import { useCurrencyStore } from "../../stores/currencyStore";
import { addressService, type SavedAddress } from "../../services/addressService";
import { presentSetupIntent } from "../../services/stripePayment";
import { CountrySelectField } from "../../components/shared/CountrySelectField";
import { COUNTRIES, countryCodeForName, countryDisplayName } from "../../utils/countries";
import { useLaunchSettings } from "../../services/launchSettingsService";
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
  FULFILMENT_METHOD_LABELS,
  SUBSTITUTION_MODE_LABELS,
  type BuyerPaymentMethod,
  type SubscriptionFrequency,
  type SubscriptionOffer,
} from "../../services/regularDeliveriesService";

// Mirrors the backend's subscribe check (buyer-subscriptions.service.ts), so a
// paused or sold-out product is never preselected and rejected on submit.
function isOfferProductAvailable(p: SubscriptionOffer["products"][number]): boolean {
  return !p.pausedAt && p.product.isActive !== false && (p.product.stock === undefined || p.product.stock > 0);
}

const STEPS = ["basket", "frequency", "firstDate", "address", "payment", "review", "active"] as const;
type Step = (typeof STEPS)[number];

const FREQUENCY_CHOICES: Record<SubscriptionFrequency, string> = {
  WEEKLY: "Every week",
  BIWEEKLY: "Every 2 weeks",
  EVERY_4_WEEKS: "Every 4 weeks",
  MONTHLY: "Monthly",
};

// Stays clear of the backend's minimum lead time (buyer-subscriptions.service.ts),
// which leaves room for the reminder a buyer must get before being charged.
function availableFirstDates(renewalCutoffHours: number): string[] {
  const leadDays = Math.ceil((Math.max(renewalCutoffHours, 48) + 24) / 24);
  const noonToday = new Date();
  noonToday.setUTCHours(12, 0, 0, 0);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(noonToday);
    date.setUTCDate(date.getUTCDate() + leadDays + index);
    return date.toISOString();
  });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "long" });
}

export default function RegularDeliveryOfferScreen() {
  const router = useRouter();
  const { id, items: requestedItems } = useLocalSearchParams<{ id: string; items?: string }>();
  const { selectedCurrency } = useCurrencyStore();

  const [offer, setOffer] = useState<SubscriptionOffer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [frequency, setFrequency] = useState<SubscriptionFrequency | null>(null);
  const [step, setStep] = useState<Step>("basket");
  const [firstDate, setFirstDate] = useState<string | null>(null);
  const [consented, setConsented] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);

  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [addressId, setAddressId] = useState<string | null>(null);
  const [showAddAddress, setShowAddAddress] = useState(false);
  const { ukLaunchMode, launchMarket } = useLaunchSettings();
  const [newAddress, setNewAddress] = useState({ recipientName: "", line1: "", city: "", postalCode: "", country: "", phone: "" });
  const [savingAddress, setSavingAddress] = useState(false);

  const [paymentMethods, setPaymentMethods] = useState<BuyerPaymentMethod[]>([]);
  const [paymentMethodId, setPaymentMethodId] = useState<string | null>(null);
  const [addingCard, setAddingCard] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const hasLoaded = useRef(false);

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
      setFrequency((current) => current ?? offerData.frequencies[0] ?? null);
      setFirstDate((current) => current ?? availableFirstDates(offerData.renewalCutoffHours)[0]);
      // Entered from a product or basket: start from exactly those items.
      const requested = new Map(
        (requestedItems ?? "").split(",").filter(Boolean).map((entry) => {
          const [productId, quantity] = entry.split(":");
          return [productId, Math.max(1, Number(quantity) || 1)] as const;
        }),
      );
      const available = offerData.products.filter(isOfferProductAvailable);
      const startingItems = available.filter((p) => requested.has(p.productId));
      if (!hasLoaded.current) {
        setSelectedProductIds(new Set((startingItems.length > 0 ? startingItems : available).map((p) => p.productId)));
        const qty: Record<string, number> = {};
        offerData.products.forEach((p) => { qty[p.productId] = requested.get(p.productId) ?? 1; });
        setQuantities(qty);
      }

      setAddresses(addressList);
      setAddressId((current) => current ?? (addressList.find((a) => a.isDefault) ?? addressList[0])?.id ?? null);

      setPaymentMethods(methods);
      setPaymentMethodId((current) => current ?? (methods.find((m) => m.isDefault) ?? methods[0])?.id ?? null);
      hasLoaded.current = true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load this Foodstuff Subscription offer.");
    } finally {
      setLoading(false);
    }
  }, [id, requestedItems]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const currencyCode = offer?.products[0]?.product.currency ?? "GBP";
  const estimateMajor = useMemo(() => {
    if (!offer) return 0;
    let cents = 0;
    for (const p of offer.products) {
      if (!selectedProductIds.has(p.productId)) continue;
      cents += p.product.priceInCents * (quantities[p.productId] ?? 1);
    }
    return (cents * (1 - (offer.discountPercent ?? 0) / 100)) / 100;
  }, [offer, selectedProductIds, quantities]);
  const firstDates = useMemo(() => (offer ? availableFirstDates(offer.renewalCutoffHours) : []), [offer]);
  const basket = offer?.products.filter((p) => selectedProductIds.has(p.productId)) ?? [];
  const selectedAddress = addresses.find((a) => a.id === addressId);
  const selectedMethod = paymentMethods.find((m) => m.id === paymentMethodId);

  const goToStep = (next: Step) => {
    setSubmitError("");
    setStep(next);
  };

  const goBack = () => {
    const index = STEPS.indexOf(step);
    if (index > 0 && step !== "active") goToStep(STEPS[index - 1]);
    else goBackOrReplace(router, "/(buyer)/regular-deliveries" as any);
  };

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
      const saved = await addressService.createAddress({ ...newAddress, country: ukLaunchMode ? countryDisplayName(launchMarket) : newAddress.country, isDefault: addresses.length === 0 });
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

  const handleConfirm = async () => {
    if (!offer || !frequency || !firstDate || !addressId || !paymentMethodId || submitting) return;
    if (!consented) {
      setSubmitError("Please tick the box to confirm you understand this is a recurring subscription.");
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
        items: Array.from(selectedProductIds).map((productId) => ({ productId, quantity: quantities[productId] ?? 1 })),
        recurringConsent: true,
        firstDeliveryDate: firstDate,
      });
      setCreatedId(subscription.id);
      goToStep("active");
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Could not start this Foodstuff Subscription.");
    } finally {
      setSubmitting(false);
    }
  };

  const renderStep = () => {
    if (!offer) return null;
    switch (step) {
      case "basket":
        return (
          <>
            <View>
              <Text style={styles.stepTitle}>Build your Foodstuff Subscription</Text>
              <Text style={styles.stepBody}>Add foodstuff from {offer.vendor?.storeName ?? "this store"}.</Text>
            </View>
            <FloatingCard>
              <Text style={styles.offerTitle}>{offer.title}</Text>
              {offer.description ? <Text style={styles.offerDescription}>{offer.description}</Text> : null}
            </FloatingCard>
            <FloatingCard style={{ gap: 10 }}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Delivery method</Text>
                <Text style={styles.detailValue}>{FULFILMENT_METHOD_LABELS[offer.fulfilmentMethod]}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Substitutions</Text>
                <Text style={styles.detailValue}>{SUBSTITUTION_MODE_LABELS[offer.substitutionMode]}</Text>
              </View>
              {offer.substitutionMode === "ALLOW_SIMILAR" && offer.substitutionPolicy ? (
                <Text style={styles.detailNote}>{offer.substitutionPolicy}</Text>
              ) : null}
            </FloatingCard>
            <View style={{ gap: 8 }}>
              {offer.products.map((p) => {
                const selected = selectedProductIds.has(p.productId);
                const available = isOfferProductAvailable(p);
                return (
                  <FloatingCard key={p.productId} style={[styles.productRow, !selected && styles.productRowMuted]}>
                    <TouchableOpacity
                      onPress={() => toggleProduct(p.productId)}
                      disabled={!available}
                      activeOpacity={0.8}
                      style={[styles.checkbox, !selected && styles.checkboxOff]}
                      accessibilityRole="checkbox"
                      accessibilityLabel={p.product.title}
                      accessibilityState={{ checked: selected, disabled: !available }}
                    >
                      {selected ? <Ionicons name="checkmark" size={14} color="#FFFFFF" /> : null}
                    </TouchableOpacity>
                    <View style={styles.productCopy}>
                      <Text style={styles.productTitle} numberOfLines={1}>{p.product.title}</Text>
                      <Text style={styles.productPrice}>
                        {available ? formatDisplayMoney(p.product.priceInCents / 100, p.product.currency, selectedCurrency) : "Currently unavailable"}
                      </Text>
                    </View>
                    {selected ? (
                      <View style={styles.stepper}>
                        <TouchableOpacity onPress={() => adjustQty(p.productId, -1)} style={styles.stepperBtn} accessibilityRole="button" accessibilityLabel={`Remove one ${p.product.title}`}>
                          <Ionicons name="remove" size={14} color="#076B51" />
                        </TouchableOpacity>
                        <Text style={styles.stepperValue}>{quantities[p.productId] ?? 1}</Text>
                        <TouchableOpacity onPress={() => adjustQty(p.productId, 1)} style={styles.stepperBtn} accessibilityRole="button" accessibilityLabel={`Add one ${p.product.title}`}>
                          <Ionicons name="add" size={14} color="#076B51" />
                        </TouchableOpacity>
                      </View>
                    ) : null}
                  </FloatingCard>
                );
              })}
            </View>
            <FloatingCard style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Estimated basket</Text>
              <Text style={styles.summaryValue}>{formatDisplayMoney(estimateMajor, currencyCode, selectedCurrency)}</Text>
            </FloatingCard>
            {offer.discountPercent ? <Text style={styles.detailNote}>Includes your {offer.discountPercent}% Foodstuff Subscription discount.</Text> : null}
            <Text style={styles.stepNote}>Prices may change before a future renewal. You will be notified when approval is required.</Text>
            <PrimaryButton
              label="Choose frequency"
              onPress={() => (basket.length === 0 ? setSubmitError("Choose at least one product.") : goToStep("frequency"))}
            />
          </>
        );
      case "frequency":
        return (
          <>
            <Text style={styles.stepTitle}>How often would you like this delivery?</Text>
            <View style={{ gap: 8 }}>
              {offer.frequencies.map((f) => (
                <OptionRow key={f} selected={frequency === f} title={FREQUENCY_CHOICES[f]} onPress={() => setFrequency(f)} />
              ))}
            </View>
            <PrimaryButton label="Continue" onPress={() => goToStep("firstDate")} />
          </>
        );
      case "firstDate":
        return (
          <>
            <Text style={styles.stepTitle}>Choose your first delivery</Text>
            <Text style={styles.sectionTitle}>Available dates</Text>
            <View style={{ gap: 8 }}>
              {firstDates.map((date) => (
                <OptionRow key={date} selected={firstDate === date} title={formatDate(date)} onPress={() => setFirstDate(date)} />
              ))}
            </View>
            <Text style={styles.stepNote}>Your future renewals will follow this schedule unless you pause, skip or change it.</Text>
            <PrimaryButton label="Continue" onPress={() => goToStep("address")} />
          </>
        );
      case "address":
        return (
          <>
            <Text style={styles.stepTitle}>{offer.fulfilmentMethod === "COLLECTION" ? "Where would you like to collect?" : "Where should we deliver?"}</Text>
            {offer.fulfilmentMethod === "COLLECTION" ? (
              <Text style={styles.detailValue}>Collect from {offer.vendor?.storeName ?? "the vendor"}. They'll confirm the collection point before your first order. We use your address below to contact you.</Text>
            ) : null}
            <Text style={styles.sectionTitle}>Select address</Text>
            <View style={{ gap: 8 }}>
              {addresses.map((a) => (
                <OptionRow key={a.id} selected={addressId === a.id} title={a.recipientName} body={`${a.line1}, ${a.city}, ${a.country}`} onPress={() => setAddressId(a.id)} />
              ))}
              {showAddAddress ? (
                <FloatingCard style={{ gap: 8 }}>
                  <TextInput placeholder="Recipient name" placeholderTextColor="#8AA194" style={styles.input} value={newAddress.recipientName} onChangeText={(v) => setNewAddress((p) => ({ ...p, recipientName: v }))} />
                  <TextInput placeholder="Address line" placeholderTextColor="#8AA194" style={styles.input} value={newAddress.line1} onChangeText={(v) => setNewAddress((p) => ({ ...p, line1: v }))} />
                  <TextInput placeholder="City" placeholderTextColor="#8AA194" style={styles.input} value={newAddress.city} onChangeText={(v) => setNewAddress((p) => ({ ...p, city: v }))} />
                  <TextInput placeholder="Postal code" placeholderTextColor="#8AA194" style={styles.input} value={newAddress.postalCode} onChangeText={(v) => setNewAddress((p) => ({ ...p, postalCode: v }))} />
                  {ukLaunchMode ? null : (
                    <CountrySelectField
                      options={COUNTRIES}
                      value={countryCodeForName(newAddress.country)}
                      onSelect={(code) => setNewAddress((p) => ({ ...p, country: countryDisplayName(code) }))}
                      placeholder="Select country"
                      sheetTitle="Select country"
                    />
                  )}
                  <TextInput placeholder="Phone (optional)" placeholderTextColor="#8AA194" style={styles.input} value={newAddress.phone} onChangeText={(v) => setNewAddress((p) => ({ ...p, phone: v }))} />
                  <PrimaryButton label="Save address" onPress={() => void handleAddAddress()} loading={savingAddress} style={{ marginTop: 2 }} />
                </FloatingCard>
              ) : (
                <TouchableOpacity onPress={() => setShowAddAddress(true)} activeOpacity={0.85} style={styles.addRow} accessibilityRole="button">
                  <Ionicons name="add-circle-outline" size={18} color="#076B51" />
                  <Text style={styles.addRowText}>Add a new address</Text>
                </TouchableOpacity>
              )}
            </View>
            <PrimaryButton
              label="Use this address"
              onPress={() => (addressId ? goToStep("payment") : setSubmitError("Add a delivery address to continue."))}
            />
          </>
        );
      case "payment":
        return (
          <>
            <View>
              <Text style={styles.stepTitle}>Choose a payment method</Text>
              <Text style={styles.stepBody}>This payment method may be charged for future renewals after you receive the required reminder.</Text>
            </View>
            <View style={{ gap: 8 }}>
              {paymentMethods.map((m) => (
                <OptionRow key={m.id} selected={paymentMethodId === m.id} title={`Card ending ${m.last4}`} onPress={() => setPaymentMethodId(m.id)} />
              ))}
              <TouchableOpacity onPress={() => void handleAddCard()} disabled={addingCard} activeOpacity={0.85} style={styles.addRow} accessibilityRole="button">
                {addingCard ? <ActivityIndicator size="small" color="#076B51" /> : <Ionicons name="card-outline" size={18} color="#076B51" />}
                <Text style={styles.addRowText}>{addingCard ? "Saving card..." : "Add payment method"}</Text>
              </TouchableOpacity>
            </View>
            <PrimaryButton
              label="Continue"
              onPress={() => (paymentMethodId ? goToStep("review") : setSubmitError("Add a payment method to continue."))}
            />
          </>
        );
      case "review":
        return (
          <>
            <Text style={styles.stepTitle}>Review your Foodstuff Subscription</Text>
            <FloatingCard style={{ gap: 12 }}>
              <ReviewRow label="Store" value={offer.vendor?.storeName ?? ""} />
              <ReviewRow label="Foodstuff" value={basket.map((p) => `${p.product.title} × ${quantities[p.productId] ?? 1}`).join("\n")} />
              <ReviewRow label="Frequency" value={frequency ? FREQUENCY_CHOICES[frequency] : ""} />
              <ReviewRow label="First delivery" value={firstDate ? formatDate(firstDate) : ""} />
              <ReviewRow label="Delivery method" value={FULFILMENT_METHOD_LABELS[offer.fulfilmentMethod]} />
              <ReviewRow label="Delivery address" value={selectedAddress ? `${selectedAddress.line1}, ${selectedAddress.city}` : ""} />
              <ReviewRow label="Payment method" value={selectedMethod ? `Card ending ${selectedMethod.last4}` : ""} />
              <ReviewRow label="Estimated first payment" value={formatDisplayMoney(estimateMajor, currencyCode, selectedCurrency)} />
            </FloatingCard>
            <Text style={styles.stepNote}>Prices and availability can change. You will be notified before material changes or when your approval is required.</Text>
            <Text style={styles.stepNote}>By confirming, you authorise eligible repeat payments according to the Foodstuff Subscription terms.</Text>
            <TouchableOpacity
              onPress={() => { setConsented((v) => !v); setSubmitError(""); }}
              activeOpacity={0.85}
              style={styles.consentRow}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: consented }}
            >
              <View style={[styles.checkbox, !consented && styles.checkboxOff]}>
                {consented ? <Ionicons name="checkmark" size={14} color="#FFFFFF" /> : null}
              </View>
              <Text style={styles.consentText}>I understand that this is a recurring subscription and future eligible renewals may be charged using my selected payment method.</Text>
            </TouchableOpacity>
            {submitting ? (
              <View>
                <Text style={styles.sectionTitle}>Confirming your Foodstuff Subscription</Text>
                <Text style={styles.consentText}>Please wait while we verify your payment and create your subscription.</Text>
              </View>
            ) : null}
            <PrimaryButton label="Confirm Foodstuff Subscription" onPress={() => void handleConfirm()} loading={submitting} />
          </>
        );
      case "active":
        return (
          <>
            <View style={styles.activeIcon}>
              <Ionicons name="checkmark-circle" size={56} color="#076B51" />
            </View>
            <Text style={[styles.stepTitle, { textAlign: "center" }]}>Your Foodstuff Subscription is active</Text>
            <Text style={[styles.stepBody, { textAlign: "center" }]}>Your first renewal is scheduled for {firstDate ? formatDate(firstDate) : ""}.</Text>
            <Text style={[styles.stepBody, { textAlign: "center", marginTop: -8 }]}>We will remind you before payment.</Text>
            <PrimaryButton
              label="View Foodstuff Subscription"
              onPress={() => router.replace({ pathname: "/(buyer)/regular-delivery-detail", params: { id: createdId ?? "" } } as any)}
            />
            <TouchableOpacity onPress={() => router.replace("/(buyer)" as any)} activeOpacity={0.85} style={styles.secondaryAction} accessibilityRole="button">
              <Text style={styles.addRowText}>Continue shopping</Text>
            </TouchableOpacity>
          </>
        );
    }
  };

  return (
    <View style={premiumStyles.page}>
      <PremiumHeader title="Foodstuff Subscription" subtitle={offer?.vendor?.storeName} onBack={goBack} />

      {loading && !offer ? (
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
            {renderStep()}
            {submitError ? <Text style={styles.submitError}>{submitError}</Text> : null}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

function OptionRow({ selected, title, body, onPress }: { selected: boolean; title: string; body?: string; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} accessibilityRole="radio" accessibilityState={{ selected }}>
      <FloatingCard style={[styles.optionRow, selected && styles.optionRowActive]}>
        <Ionicons name={selected ? "radio-button-on" : "radio-button-off"} size={18} color={selected ? "#076B51" : "#C7D2CB"} />
        <View style={styles.optionCopy}>
          <Text style={styles.optionTitle}>{title}</Text>
          {body ? <Text style={styles.optionBody}>{body}</Text> : null}
        </View>
      </FloatingCard>
    </TouchableOpacity>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.reviewRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.reviewValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stepTitle: { fontSize: 20, fontFamily: "Manrope-ExtraBold", color: "#151E1B" },
  stepBody: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#6A7B72", marginTop: 6, lineHeight: 19 },
  stepNote: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#6A7B72", lineHeight: 18 },
  reviewRow: { gap: 3 },
  reviewValue: { fontSize: 13, fontFamily: "Manrope-SemiBold", color: "#151E1B", lineHeight: 19 },
  consentRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  consentText: { flex: 1, fontSize: 13, fontFamily: "Outfit-Medium", color: "#151E1B", lineHeight: 19 },
  activeIcon: { alignItems: "center", marginTop: 24 },
  secondaryAction: { alignItems: "center", paddingVertical: 8 },
  offerTitle: { fontSize: 19, fontFamily: "Manrope-ExtraBold", color: "#151E1B" },
  offerDescription: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#6A7B72", marginTop: 8, lineHeight: 18 },
  sectionTitle: { fontSize: 15, fontFamily: "Manrope-ExtraBold", color: "#12221A", marginBottom: -8 },
  detailRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  detailLabel: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#6A7B72" },
  detailValue: { fontSize: 13, fontFamily: "Manrope-SemiBold", color: "#151E1B" },
  detailNote: { fontSize: 11, fontFamily: "Outfit-Regular", color: "#8AA194", lineHeight: 16 },
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
