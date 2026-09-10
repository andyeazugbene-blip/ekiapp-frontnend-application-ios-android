import React, { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { goBackOrReplace } from "../../utils/navigation";
import { formatDisplayMoney } from "../../utils/currency";
import { useCurrencyStore } from "../../stores/currencyStore";
import { ErrorState, FloatingCard, LoadingBlock, PremiumHeader, premiumStyles } from "../../components/shared/PremiumBlocks";
import {
  communityBuyService,
  FULFILMENT_METHOD_LABELS,
  type Campaign,
  type CampaignFulfilment,
} from "../../services/communityBuyService";

export default function CommunityBuyQuantityScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { selectedCurrency } = useCurrencyStore();

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [fulfilment, setFulfilment] = useState<CampaignFulfilment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [quantity, setQuantity] = useState("1");

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError("");
    try {
      const [c, f] = await Promise.all([
        communityBuyService.getCampaign(id),
        communityBuyService.getCampaignFulfilment(id).catch(() => null),
      ]);
      setCampaign(c);
      setFulfilment(f);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load this campaign.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) {
    return (
      <View style={premiumStyles.page}>
        <PremiumHeader title="Choose quantity" onBack={() => goBackOrReplace(router, { pathname: "/(buyer)/community-buy-campaign", params: { id } } as any)} />
        <LoadingBlock />
      </View>
    );
  }

  if (error || !campaign) {
    return (
      <View style={premiumStyles.page}>
        <PremiumHeader title="Choose quantity" onBack={() => goBackOrReplace(router, { pathname: "/(buyer)/community-buy-campaign", params: { id } } as any)} />
        <View style={premiumStyles.block}><ErrorState message={error || "Check your connection and try again."} onRetry={() => void load()} /></View>
      </View>
    );
  }

  const remainingCapacity = Math.max(0, campaign.maximumShares - campaign.confirmedShares);
  const parsedQuantity = Math.round(Number(quantity)) || 0;
  const quantityValid = parsedQuantity > 0 && parsedQuantity <= remainingCapacity;
  const subtotal = parsedQuantity * campaign.pricePerShareMinor;

  const validationMessage =
    parsedQuantity <= 0
      ? "Enter at least 1 share."
      : parsedQuantity > remainingCapacity
        ? `Only ${remainingCapacity} share${remainingCapacity === 1 ? "" : "s"} remain available for this campaign.`
        : "";

  const goToReview = () => {
    if (!quantityValid) return;
    router.push({ pathname: "/(buyer)/community-buy-review", params: { id: campaign.id, quantity: String(parsedQuantity) } } as any);
  };

  return (
    <View style={premiumStyles.page}>
      <PremiumHeader title="Choose quantity" subtitle={campaign.title} onBack={() => goBackOrReplace(router, { pathname: "/(buyer)/community-buy-campaign", params: { id } } as any)} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={[premiumStyles.scrollContent, { paddingTop: 18 }]} showsVerticalScrollIndicator={false}>
        <View style={[premiumStyles.block, { gap: 14 }]}>
          <FloatingCard style={{ gap: 10 }}>
            <Text style={styles.fieldLabel}>Price per share</Text>
            <Text style={styles.priceValue}>{formatDisplayMoney(campaign.pricePerShareMinor / 100, campaign.currency, selectedCurrency)}</Text>

            <View style={styles.quantityRow}>
              <TouchableOpacity
                onPress={() => setQuantity(String(Math.max(1, (Number(quantity) || 1) - 1)))}
                activeOpacity={0.85}
                style={styles.stepperBtn}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                accessibilityRole="button"
                accessibilityLabel="Decrease quantity"
              >
                <Ionicons name="remove" size={18} color="#076B51" />
              </TouchableOpacity>
              <TextInput
                style={styles.quantityInput}
                placeholder="1"
                placeholderTextColor="#8AA194"
                keyboardType="number-pad"
                value={quantity}
                onChangeText={setQuantity}
                accessibilityLabel="Number of shares"
              />
              <TouchableOpacity
                onPress={() => setQuantity(String(Math.min(remainingCapacity || 1, (Number(quantity) || 0) + 1)))}
                activeOpacity={0.85}
                style={styles.stepperBtn}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                accessibilityRole="button"
                accessibilityLabel="Increase quantity"
              >
                <Ionicons name="add" size={18} color="#076B51" />
              </TouchableOpacity>
            </View>
            <Text style={styles.helperText}>{remainingCapacity} share{remainingCapacity === 1 ? "" : "s"} remain available (maximum {campaign.maximumShares}).</Text>
            {validationMessage ? <Text style={styles.errorText}>{validationMessage}</Text> : null}

            <View style={styles.amountRow}>
              <Text style={styles.fieldLabel}>Amount if this campaign succeeds</Text>
              <Text style={styles.amountValue}>{formatDisplayMoney(subtotal / 100, campaign.currency, selectedCurrency)}</Text>
            </View>
          </FloatingCard>

          <View>
            <Text style={styles.sectionTitle}>Financial disclosure</Text>
            <FloatingCard style={{ gap: 8 }}>
              <Text style={styles.disclosureText}>
                You pay exactly {formatDisplayMoney(subtotal / 100, campaign.currency, selectedCurrency)} for {parsedQuantity || 0} share{parsedQuantity === 1 ? "" : "s"} — nothing more. Eki's processing fee comes out of the amount the supplier receives, not added on top of your payment.
              </Text>
              <Text style={styles.disclosureText}>
                Your card is not charged now. It will only be charged if this campaign reaches its minimum required quantity.
              </Text>
              <Text style={styles.disclosureText}>
                If this campaign does not reach its minimum, it fails and your card is never charged — there is nothing to refund because nothing was taken.
              </Text>
            </FloatingCard>
          </View>

          <View>
            <Text style={styles.sectionTitle}>Fulfilment</Text>
            <FloatingCard style={{ gap: 4 }}>
              {fulfilment?.method ? (
                <Text style={styles.fulfilmentText}>This campaign fulfils by: {FULFILMENT_METHOD_LABELS[fulfilment.method]}.</Text>
              ) : (
                <Text style={styles.fulfilmentText}>The fulfilment method will be confirmed by the organiser once this campaign succeeds.</Text>
              )}
            </FloatingCard>
          </View>

          <TouchableOpacity
            onPress={goToReview}
            disabled={!quantityValid}
            activeOpacity={0.88}
            style={[styles.primaryBtn, !quantityValid && { opacity: 0.5 }]}
            accessibilityRole="button"
            accessibilityLabel="Continue to review"
            accessibilityState={{ disabled: !quantityValid }}
          >
            <Text style={styles.primaryBtnText}>Continue to review</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  fieldLabel: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#6A7B72" },
  priceValue: { fontSize: 20, fontFamily: "Manrope-ExtraBold", color: "#151E1B" },
  quantityRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 4 },
  stepperBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: "rgba(7,107,81,0.08)", alignItems: "center", justifyContent: "center" },
  quantityInput: { flex: 1, backgroundColor: "#F4F6F5", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, fontFamily: "Manrope-Bold", color: "#151E1B", textAlign: "center" },
  helperText: { fontSize: 11, fontFamily: "Outfit-Regular", color: "#6A7B72" },
  errorText: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#D6552F" },
  amountRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 6, borderTopWidth: 1, borderTopColor: "#F0F0F0", paddingTop: 10 },
  amountValue: { fontSize: 15, fontFamily: "Manrope-Bold", color: "#151E1B" },
  sectionTitle: { fontSize: 15, fontFamily: "Manrope-ExtraBold", color: "#12221A", marginBottom: 10 },
  disclosureText: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#4A5A52", lineHeight: 17 },
  fulfilmentText: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#4A5A52" },
  primaryBtn: { minHeight: 52, borderRadius: 14, backgroundColor: "#076B51", alignItems: "center", justifyContent: "center" },
  primaryBtnText: { fontSize: 14, fontFamily: "Manrope-Bold", color: "#FFFFFF" },
});
