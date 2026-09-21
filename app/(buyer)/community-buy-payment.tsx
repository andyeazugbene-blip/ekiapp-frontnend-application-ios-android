import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { goBackOrReplace } from "../../utils/navigation";
import { formatDisplayMoney } from "../../utils/currency";
import { useCurrencyStore } from "../../stores/currencyStore";
import { presentSetupIntent } from "../../services/stripePayment";
import { ErrorState, FloatingCard, LoadingBlock, PremiumHeader, premiumStyles } from "../../components/shared/PremiumBlocks";
import { communityBuyService, type Campaign } from "../../services/communityBuyService";
import { BUYER_SERVICE_FEE_MAX_MINOR, BUYER_SERVICE_FEE_MIN_MINOR, calculateBuyerServiceFee } from "../../utils/communityBuyFees";
// The saved-card flow is generic (buyer/payment-methods), built for Regular
// Deliveries — reused as-is for Community Buy pledges rather than duplicated.
import { regularDeliveriesService, type BuyerPaymentMethod } from "../../services/regularDeliveriesService";

export default function CommunityBuyPaymentScreen() {
  const router = useRouter();
  const { id, quantity: quantityParam } = useLocalSearchParams<{ id: string; quantity: string }>();
  const { selectedCurrency } = useCurrencyStore();
  const quantity = Math.max(1, Math.round(Number(quantityParam)) || 1);

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [paymentMethods, setPaymentMethods] = useState<BuyerPaymentMethod[]>([]);
  const [paymentMethodId, setPaymentMethodId] = useState<string | null>(null);
  const [addingCard, setAddingCard] = useState(false);
  const [contributing, setContributing] = useState(false);
  const [contributeError, setContributeError] = useState("");
  // Phase 3 (address + privacy foundation) — collected only when the
  // campaign's deliveryPreference is DELIVERY; ignored/unused otherwise.
  const [recipientName, setRecipientName] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState("");
  const [postcode, setPostcode] = useState("");
  // Figma S25 "Prepare Home Deliveries" — optional, not required for pledging.
  const [phone, setPhone] = useState("");
  const [instructions, setInstructions] = useState("");

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError("");
    try {
      const [c, methods] = await Promise.all([
        communityBuyService.getCampaign(id),
        regularDeliveriesService.listPaymentMethods().catch(() => [] as BuyerPaymentMethod[]),
      ]);
      setCampaign(c);
      setPaymentMethods(methods);
      setPaymentMethodId((prev) => prev ?? methods.find((m) => m.isDefault)?.id ?? methods[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load this campaign.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleAddCard = async () => {
    setAddingCard(true);
    try {
      const { clientSecret } = await regularDeliveriesService.createSetupIntent();
      const result = await presentSetupIntent({ clientSecret });
      if (result.status === "succeeded") {
        // The client only confirms the SetupIntent completed — the backend
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

  /**
   * PLEDGE_THEN_CHARGE (client mandate 2026-09): this only saves a pledge
   * against an already-collected payment method. No charge happens now —
   * the amount is only captured later if the campaign actually succeeds.
   */
  const handlePledge = async () => {
    if (contributing || !id) return;
    if (!paymentMethodId) {
      setContributeError("Add a payment method to continue.");
      return;
    }
    if (campaign?.deliveryPreference === "DELIVERY" && (!recipientName.trim() || !addressLine1.trim() || !city.trim() || !postcode.trim())) {
      setContributeError("Enter your delivery address to continue.");
      return;
    }
    setContributing(true);
    setContributeError("");
    try {
      const deliveryAddress = campaign?.deliveryPreference === "DELIVERY"
        ? {
            recipientName: recipientName.trim(), addressLine1: addressLine1.trim(), addressLine2: addressLine2.trim() || undefined, city: city.trim(), postcode: postcode.trim(),
            phone: phone.trim() || undefined, instructions: instructions.trim() || undefined,
          }
        : undefined;
      const pledge = await communityBuyService.pledgeContribution(id, quantity, paymentMethodId, deliveryAddress);
      router.replace({ pathname: "/(buyer)/community-buy-contribution-confirmed", params: { id, contributionId: pledge.contributionId } } as any);
    } catch (err) {
      // Genuinely failed to create the pledge — no contribution exists and
      // no charge was ever attempted (PLEDGE_THEN_CHARGE never charges at
      // this step regardless). Stay on this screen and say so plainly.
      setContributeError(err instanceof Error ? err.message : "Could not record your pledge. Nothing was charged — you can try again.");
    } finally {
      setContributing(false);
    }
  };

  const backToReview = () => goBackOrReplace(router, { pathname: "/(buyer)/community-buy-review", params: { id, quantity: String(quantity) } } as any);

  if (loading) {
    return (
      <View style={premiumStyles.page}>
        <PremiumHeader title="Payment method" onBack={backToReview} />
        <LoadingBlock />
      </View>
    );
  }

  if (error || !campaign) {
    return (
      <View style={premiumStyles.page}>
        <PremiumHeader title="Payment method" onBack={backToReview} />
        <View style={premiumStyles.block}><ErrorState message={error || "Check your connection and try again."} onRetry={() => void load()} /></View>
      </View>
    );
  }

  // Nullable on a draft, but this screen only ever shows a LIVE campaign —
  // submit() (backend) guarantees these are set by then.
  const amount = quantity * campaign.pricePerShareMinor!;
  // Diaspora escrow reconciliation (final V1 settlement doc — required
  // buyer disclosure): Eki's 5% service fee, min £1.20 / max £5.00, on top
  // of the product subtotal. This is a PREVIEW using the campaign's current
  // rate — the amount actually charged is always the rate the backend
  // snapshots at pledge time (see CampaignContribution.buyerServiceFeeAmount).
  const serviceFee = calculateBuyerServiceFee(amount, campaign.perShareFeeEstimate?.feeBps);
  // Phase 6 (delivery + collection/tracking) — flat per pledge, real,
  // organiser-set; separate from Eki's service fee, never folded into it.
  const isDelivery = campaign.deliveryPreference === "DELIVERY";
  const deliveryFee = isDelivery ? campaign.deliveryFeeAmountMinor ?? 0 : 0;
  const maxTotal = amount + serviceFee + deliveryFee;
  const addressMissing = isDelivery && (!recipientName.trim() || !addressLine1.trim() || !city.trim() || !postcode.trim());
  const pledgeDisabled = contributing || !paymentMethodId || addressMissing;

  return (
    <View style={premiumStyles.page}>
      <PremiumHeader title="Payment method" subtitle={campaign.title} onBack={backToReview} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={[premiumStyles.scrollContent, { paddingTop: 18 }]} showsVerticalScrollIndicator={false}>
        <View style={[premiumStyles.block, { gap: 14 }]}>
          <FloatingCard style={{ gap: 10 }}>
            <Text style={styles.section}>Payment breakdown</Text>
            <View style={styles.previewRow}>
              <Text style={styles.fieldHint}>Product subtotal ({quantity} × {formatDisplayMoney(campaign.pricePerShareMinor! / 100, campaign.currency, selectedCurrency)})</Text>
              <Text style={styles.previewValue}>{formatDisplayMoney(amount / 100, campaign.currency, selectedCurrency)}</Text>
            </View>
            <View style={styles.previewRow}>
              <Text style={styles.fieldHint}>Eki service fee (5%, min {formatDisplayMoney(BUYER_SERVICE_FEE_MIN_MINOR / 100, campaign.currency, selectedCurrency)}, max {formatDisplayMoney(BUYER_SERVICE_FEE_MAX_MINOR / 100, campaign.currency, selectedCurrency)})</Text>
              <Text style={styles.previewValue}>{formatDisplayMoney(serviceFee / 100, campaign.currency, selectedCurrency)}</Text>
            </View>
            <View style={styles.previewRow}>
              <Text style={styles.fieldHint}>{isDelivery ? "Delivery fee" : "Fulfilment"}</Text>
              <Text style={styles.previewValue}>{isDelivery ? (deliveryFee > 0 ? formatDisplayMoney(deliveryFee / 100, campaign.currency, selectedCurrency) : "Free") : "Collection only — delivery not available"}</Text>
            </View>
            {!isDelivery ? (
              <Text style={styles.disclosureText}>Your collection code will be available here once payment succeeds.</Text>
            ) : null}
            <View style={[styles.previewRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>Total if campaign succeeds</Text>
              <Text style={styles.totalValue}>{formatDisplayMoney(maxTotal / 100, campaign.currency, selectedCurrency)}</Text>
            </View>
            <Text style={styles.disclosureText}>
              Organiser: {campaign.organiserDisplayName ?? "—"}{campaign.supplier?.vendor?.storeName || campaign.supplierAccount?.user?.name ? ` · Supplier: ${campaign.supplier?.vendor?.storeName ?? campaign.supplierAccount?.user?.name}` : ""}
            </Text>
          </FloatingCard>

          {isDelivery ? (
            <FloatingCard style={{ gap: 10 }}>
              <Text style={styles.section}>Delivery address</Text>
              <Text style={styles.disclosureText}>
                Required for this campaign. {campaign.deliveryResponsibility === "SUPPLIER"
                  ? "Shared only with the supplier responsible for delivering your order."
                  : campaign.deliveryResponsibility === "SHARED"
                    ? "Shared with the campaign organiser and the supplier responsible for delivering your order."
                    : "Only you and the campaign organiser can see this — never the supplier."}
              </Text>
              <TextInput style={styles.input} placeholder="Recipient name" placeholderTextColor="#8AA194" value={recipientName} onChangeText={setRecipientName} accessibilityLabel="Recipient name" />
              <TextInput style={styles.input} placeholder="Address line 1" placeholderTextColor="#8AA194" value={addressLine1} onChangeText={setAddressLine1} accessibilityLabel="Address line 1" />
              <TextInput style={styles.input} placeholder="Address line 2 (optional)" placeholderTextColor="#8AA194" value={addressLine2} onChangeText={setAddressLine2} accessibilityLabel="Address line 2" />
              <View style={{ flexDirection: "row", gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <TextInput style={styles.input} placeholder="City" placeholderTextColor="#8AA194" value={city} onChangeText={setCity} accessibilityLabel="City" />
                </View>
                <View style={{ flex: 1 }}>
                  <TextInput style={styles.input} placeholder="Postcode" placeholderTextColor="#8AA194" value={postcode} onChangeText={setPostcode} accessibilityLabel="Postcode" autoCapitalize="characters" />
                </View>
              </View>
              <TextInput style={styles.input} placeholder="Phone (optional)" placeholderTextColor="#8AA194" value={phone} onChangeText={setPhone} accessibilityLabel="Phone number" keyboardType="phone-pad" />
              <TextInput style={styles.input} placeholder="Delivery instructions (optional)" placeholderTextColor="#8AA194" value={instructions} onChangeText={setInstructions} accessibilityLabel="Delivery instructions" />
            </FloatingCard>
          ) : null}

          <FloatingCard style={{ gap: 10 }}>
            <View style={{ gap: 8 }}>
              {paymentMethods.map((m) => (
                <TouchableOpacity
                  key={m.id}
                  onPress={() => setPaymentMethodId(m.id)}
                  activeOpacity={0.85}
                  accessibilityRole="radio"
                  accessibilityLabel={`${(m.brand ?? "Card").toUpperCase()} ending ${m.last4}`}
                  accessibilityState={{ selected: paymentMethodId === m.id }}
                >
                  <FloatingCard style={[styles.optionRow, paymentMethodId === m.id && styles.optionRowActive]}>
                    <Ionicons name={paymentMethodId === m.id ? "radio-button-on" : "radio-button-off"} size={18} color={paymentMethodId === m.id ? "#076B51" : "#C7D2CB"} />
                    <Text style={styles.optionTitle}>{(m.brand ?? "Card").toUpperCase()} •••• {m.last4}</Text>
                  </FloatingCard>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                onPress={() => void handleAddCard()}
                disabled={addingCard}
                activeOpacity={0.85}
                style={styles.addRow}
                accessibilityRole="button"
                accessibilityLabel="Add a card"
                accessibilityState={{ busy: addingCard, disabled: addingCard }}
              >
                {addingCard ? <ActivityIndicator size="small" color="#076B51" /> : <Ionicons name="card-outline" size={18} color="#076B51" />}
                <Text style={styles.addRowText}>{addingCard ? "Saving card..." : "Add a card"}</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.disclosureText}>
              Your card will not be charged now. It will only be charged {formatDisplayMoney(maxTotal / 100, campaign.currency, selectedCurrency)} (including Eki's service fee{isDelivery ? " and delivery fee" : ""}) if this campaign reaches its minimum or goal. If the campaign doesn't succeed, you are never charged.
            </Text>
          </FloatingCard>

          {contributeError ? <Text style={styles.errorText}>{contributeError}</Text> : null}

          <TouchableOpacity
            onPress={() => void handlePledge()}
            disabled={pledgeDisabled}
            activeOpacity={0.88}
            accessibilityRole="button"
            accessibilityLabel={contributing ? "Submitting pledge" : "Pledge, no charge now"}
            accessibilityState={{ busy: contributing, disabled: pledgeDisabled }}
            style={[styles.primaryBtn, pledgeDisabled && { opacity: 0.6 }]}
          >
            {contributing ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.primaryBtnText}>Pledge — no charge now</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { fontSize: 13, fontFamily: "Manrope-ExtraBold", color: "#151E1B" },
  previewRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  fieldHint: { flex: 1, fontSize: 12, fontFamily: "Outfit-Regular", color: "#6A7B72" },
  previewValue: { fontSize: 12, fontFamily: "Manrope-SemiBold", color: "#151E1B" },
  totalRow: { borderTopWidth: 1, borderTopColor: "#EEF2EF", paddingTop: 8, marginTop: 2 },
  totalLabel: { fontSize: 13, fontFamily: "Manrope-Bold", color: "#151E1B" },
  totalValue: { fontSize: 14, fontFamily: "Manrope-ExtraBold", color: "#076B51" },
  optionRow: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1.5, borderColor: "transparent" },
  optionRowActive: { borderColor: "#076B51" },
  optionTitle: { fontSize: 13, fontFamily: "Manrope-SemiBold", color: "#151E1B" },
  input: { backgroundColor: "#F4F6F5", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 13, fontFamily: "Outfit-Regular", color: "#151E1B" },
  addRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6 },
  addRowText: { fontSize: 13, fontFamily: "Manrope-Bold", color: "#076B51" },
  disclosureText: { fontSize: 11, fontFamily: "Outfit-Regular", color: "#6A7B72", lineHeight: 16 },
  errorText: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#D6552F" },
  primaryBtn: { minHeight: 52, borderRadius: 14, backgroundColor: "#076B51", alignItems: "center", justifyContent: "center" },
  primaryBtnText: { fontSize: 14, fontFamily: "Manrope-Bold", color: "#FFFFFF" },
});
