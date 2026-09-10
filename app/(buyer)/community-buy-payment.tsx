import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { goBackOrReplace } from "../../utils/navigation";
import { formatDisplayMoney } from "../../utils/currency";
import { useCurrencyStore } from "../../stores/currencyStore";
import { presentSetupIntent } from "../../services/stripePayment";
import { ErrorState, FloatingCard, LoadingBlock, PremiumHeader, premiumStyles } from "../../components/shared/PremiumBlocks";
import { communityBuyService, type Campaign } from "../../services/communityBuyService";
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
    setContributing(true);
    setContributeError("");
    try {
      const pledge = await communityBuyService.pledgeContribution(id, quantity, paymentMethodId);
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

  const amount = quantity * campaign.pricePerShareMinor;

  return (
    <View style={premiumStyles.page}>
      <PremiumHeader title="Payment method" subtitle={campaign.title} onBack={backToReview} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={[premiumStyles.scrollContent, { paddingTop: 18 }]} showsVerticalScrollIndicator={false}>
        <View style={[premiumStyles.block, { gap: 14 }]}>
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
              Your card will not be charged now. It will only be charged {formatDisplayMoney(amount / 100, campaign.currency, selectedCurrency)} if this campaign reaches its minimum or goal.
            </Text>
          </FloatingCard>

          {contributeError ? <Text style={styles.errorText}>{contributeError}</Text> : null}

          <TouchableOpacity
            onPress={() => void handlePledge()}
            disabled={contributing || !paymentMethodId}
            activeOpacity={0.88}
            accessibilityRole="button"
            accessibilityLabel={contributing ? "Submitting pledge" : "Pledge, no charge now"}
            accessibilityState={{ busy: contributing, disabled: contributing || !paymentMethodId }}
            style={[styles.primaryBtn, (contributing || !paymentMethodId) && { opacity: 0.6 }]}
          >
            {contributing ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.primaryBtnText}>Pledge — no charge now</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  optionRow: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1.5, borderColor: "transparent" },
  optionRowActive: { borderColor: "#076B51" },
  optionTitle: { fontSize: 13, fontFamily: "Manrope-SemiBold", color: "#151E1B" },
  addRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6 },
  addRowText: { fontSize: 13, fontFamily: "Manrope-Bold", color: "#076B51" },
  disclosureText: { fontSize: 11, fontFamily: "Outfit-Regular", color: "#6A7B72", lineHeight: 16 },
  errorText: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#D6552F" },
  primaryBtn: { minHeight: 52, borderRadius: 14, backgroundColor: "#076B51", alignItems: "center", justifyContent: "center" },
  primaryBtnText: { fontSize: 14, fontFamily: "Manrope-Bold", color: "#FFFFFF" },
});
