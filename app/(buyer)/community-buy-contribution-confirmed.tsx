import React, { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { formatDisplayMoney } from "../../utils/currency";
import { useCurrencyStore } from "../../stores/currencyStore";
import { ErrorState, FloatingCard, IconAvatar, LoadingBlock, PremiumHeader, premiumStyles } from "../../components/shared/PremiumBlocks";
import { communityBuyService, type Campaign, type Contribution } from "../../services/communityBuyService";
import { BUYER_SERVICE_FEE_MAX_MINOR, BUYER_SERVICE_FEE_MIN_MINOR, calculateBuyerServiceFee } from "../../utils/communityBuyFees";

export default function CommunityBuyContributionConfirmedScreen() {
  const router = useRouter();
  const { id, contributionId } = useLocalSearchParams<{ id: string; contributionId: string }>();
  const { selectedCurrency } = useCurrencyStore();

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [contribution, setContribution] = useState<Contribution | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!id || !contributionId) return;
    setLoading(true);
    setError("");
    try {
      const [c, contrib] = await Promise.all([
        communityBuyService.getCampaign(id),
        communityBuyService.getContribution(contributionId),
      ]);
      setCampaign(c);
      setContribution(contrib);
    } catch (err) {
      // The pledge itself already succeeded (we only get here after a real
      // 2xx from pledgeContribution) — a failure here just means we can't
      // re-display the details right now, not that the pledge didn't happen.
      setError(err instanceof Error ? err.message : "Your pledge was recorded, but we couldn't reload its details.");
    } finally {
      setLoading(false);
    }
  }, [id, contributionId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const goToDashboard = () => router.replace("/(buyer)/my-community-buys" as any);
  const goToCampaign = () => id && router.replace({ pathname: "/(buyer)/community-buy-campaign", params: { id } } as any);

  if (loading) {
    return (
      <View style={premiumStyles.page}>
        <PremiumHeader title="You're in the Community Buy" />
        <LoadingBlock />
      </View>
    );
  }

  if (error || !campaign || !contribution) {
    return (
      <View style={premiumStyles.page}>
        <PremiumHeader title="You're in the Community Buy" />
        <View style={premiumStyles.block}>
          <ErrorState message={error || "Something went wrong loading your pledge."} onRetry={() => void load()} />
          <TouchableOpacity
            onPress={goToDashboard}
            activeOpacity={0.85}
            style={[styles.primaryBtn, { marginTop: 14 }]}
            accessibilityRole="button"
            accessibilityLabel="Go to my Community Buys"
          >
            <Text style={styles.primaryBtnText}>Go to my Community Buys</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // buyerServiceFeeAmount is the authoritative value already computed by the
  // backend for this exact contribution; calculateBuyerServiceFee is only a
  // fallback preview for the (should-not-happen) case it's missing — same
  // pattern as the quantity/review/receipt screens.
  const serviceFee = contribution.buyerServiceFeeAmount ?? calculateBuyerServiceFee(contribution.amount);
  // Phase 6 (delivery + collection/tracking) — flat per pledge, real,
  // snapshotted by the backend at pledge time; never folded into serviceFee.
  const deliveryFee = contribution.deliveryFeeAmountMinor ?? 0;
  const maxTotal = contribution.amount + serviceFee + deliveryFee;
  const isDelivery = campaign.deliveryPreference === "DELIVERY";

  return (
    <View style={premiumStyles.page}>
      <PremiumHeader title="You're in the Community Buy" />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={[premiumStyles.scrollContent, { paddingTop: 18 }]} showsVerticalScrollIndicator={false}>
        <View style={[premiumStyles.block, { gap: 16, alignItems: "center" }]}>
          <IconAvatar icon="bookmark-outline" tone="success" size={64} />
          <Text style={styles.title}>{contribution.quantity} share{contribution.quantity === 1 ? "" : "s"} reserved</Text>
          <Text style={styles.body}>We'll update you as the campaign progresses.</Text>

          <FloatingCard style={{ width: "100%", gap: 8 }}>
            <View style={styles.row}><Text style={styles.label}>Campaign</Text><Text style={styles.value} numberOfLines={1}>{campaign.title}</Text></View>
            <View style={styles.row}><Text style={styles.label}>Shares</Text><Text style={styles.value}>{contribution.quantity}</Text></View>
            <View style={styles.row}><Text style={styles.label}>Product subtotal</Text><Text style={styles.value}>{formatDisplayMoney(contribution.amount / 100, contribution.currency, selectedCurrency)}</Text></View>
            <View style={styles.row}><Text style={styles.label}>Eki service fee (5%, min {formatDisplayMoney(BUYER_SERVICE_FEE_MIN_MINOR / 100, contribution.currency, selectedCurrency)}, max {formatDisplayMoney(BUYER_SERVICE_FEE_MAX_MINOR / 100, contribution.currency, selectedCurrency)})</Text><Text style={styles.value}>{formatDisplayMoney(serviceFee / 100, contribution.currency, selectedCurrency)}</Text></View>
            {isDelivery ? (
              <View style={styles.row}><Text style={styles.label}>Delivery fee</Text><Text style={styles.value}>{deliveryFee > 0 ? formatDisplayMoney(deliveryFee / 100, contribution.currency, selectedCurrency) : "Free"}</Text></View>
            ) : null}
            <View style={styles.row}><Text style={styles.label}>Receiving method</Text><Text style={styles.value}>{isDelivery ? "Home delivery" : "Collection point"}</Text></View>
            <View style={styles.row}><Text style={styles.label}>Total if campaign succeeds</Text><Text style={styles.value}>{formatDisplayMoney(maxTotal / 100, contribution.currency, selectedCurrency)}</Text></View>
            <View style={styles.row}><Text style={styles.label}>Status</Text><Text style={styles.value}>Not charged yet</Text></View>
          </FloatingCard>

          <FloatingCard style={{ width: "100%", gap: 6, backgroundColor: "#FFF8E1" }}>
            <Text style={styles.whatsNextTitle}>What happens next</Text>
            <Text style={styles.infoText}>
              Your payment is confirmed only once the campaign reaches its target. If it does, you'll be charged {formatDisplayMoney(maxTotal / 100, contribution.currency, selectedCurrency)} (including Eki's service fee{isDelivery ? " and delivery fee" : ""}). If it doesn't, you're never charged.
            </Text>
          </FloatingCard>

          <TouchableOpacity
            onPress={goToCampaign}
            activeOpacity={0.88}
            style={styles.primaryBtn}
            accessibilityRole="button"
            accessibilityLabel="View campaign progress"
          >
            <Text style={styles.primaryBtnText}>View campaign progress</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={goToDashboard}
            activeOpacity={0.85}
            style={styles.secondaryBtn}
            accessibilityRole="button"
            accessibilityLabel="Go to my Community Buys"
          >
            <Text style={styles.secondaryBtnText}>Go to my Community Buys</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 18, fontFamily: "Manrope-ExtraBold", color: "#151E1B", textAlign: "center" },
  body: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#4A5A52", textAlign: "center", lineHeight: 19 },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  label: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#6A7B72" },
  value: { flex: 1, fontSize: 13, fontFamily: "Manrope-SemiBold", color: "#151E1B", textAlign: "right" },
  infoText: { flex: 1, fontSize: 12, fontFamily: "Outfit-Regular", color: "#4A5A52", lineHeight: 17 },
  whatsNextTitle: { fontSize: 13, fontFamily: "Manrope-Bold", color: "#151E1B" },
  primaryBtn: { width: "100%", minHeight: 52, borderRadius: 14, backgroundColor: "#076B51", alignItems: "center", justifyContent: "center" },
  primaryBtnText: { fontSize: 14, fontFamily: "Manrope-Bold", color: "#FFFFFF" },
  secondaryBtn: { width: "100%", minHeight: 46, borderRadius: 14, borderWidth: 1, borderColor: "#076B51", alignItems: "center", justifyContent: "center" },
  secondaryBtnText: { fontSize: 13, fontFamily: "Manrope-SemiBold", color: "#076B51" },
});
