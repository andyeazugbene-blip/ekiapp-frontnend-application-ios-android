import React, { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { goBackOrReplace } from "../../utils/navigation";
import { formatDisplayMoney } from "../../utils/currency";
import { useCurrencyStore } from "../../stores/currencyStore";
import { ErrorState, FloatingCard, LoadingBlock, PremiumHeader, premiumStyles } from "../../components/shared/PremiumBlocks";
import { communityBuyService, FULFILMENT_METHOD_LABELS, type Campaign, type CampaignFulfilment } from "../../services/communityBuyService";
import { countryDisplayName } from "../../utils/countries";

function formatDeadline(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export default function CommunityBuyReviewScreen() {
  const router = useRouter();
  const { id, quantity: quantityParam } = useLocalSearchParams<{ id: string; quantity: string }>();
  const { selectedCurrency } = useCurrencyStore();
  const quantity = Math.max(1, Math.round(Number(quantityParam)) || 1);

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [fulfilment, setFulfilment] = useState<CampaignFulfilment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  const backToQuantity = () => goBackOrReplace(router, { pathname: "/(buyer)/community-buy-quantity", params: { id } } as any);

  if (loading) {
    return (
      <View style={premiumStyles.page}>
        <PremiumHeader title="Review your pledge" onBack={backToQuantity} />
        <LoadingBlock />
      </View>
    );
  }

  if (error || !campaign) {
    return (
      <View style={premiumStyles.page}>
        <PremiumHeader title="Review your pledge" onBack={backToQuantity} />
        <View style={premiumStyles.block}><ErrorState message={error || "Check your connection and try again."} onRetry={() => void load()} /></View>
      </View>
    );
  }

  const amount = quantity * campaign.pricePerShareMinor;

  return (
    <View style={premiumStyles.page}>
      <PremiumHeader title="Review your pledge" onBack={backToQuantity} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={[premiumStyles.scrollContent, { paddingTop: 18 }]} showsVerticalScrollIndicator={false}>
        <View style={[premiumStyles.block, { gap: 14 }]}>
          <FloatingCard style={{ gap: 10 }}>
            <View style={styles.row}><Text style={styles.label}>Campaign</Text><Text style={styles.value} numberOfLines={1}>{campaign.title}</Text></View>
            <View style={styles.row}><Text style={styles.label}>Supplier</Text><Text style={styles.value} numberOfLines={1}>{campaign.supplier?.vendor?.storeName ?? "Verified supplier"}</Text></View>
            <View style={styles.row}><Text style={styles.label}>Market</Text><Text style={styles.value}>{countryDisplayName(campaign.country)}</Text></View>
            <View style={styles.row}><Text style={styles.label}>Quantity</Text><Text style={styles.value}>{quantity} share{quantity === 1 ? "" : "s"}</Text></View>
            <View style={styles.row}><Text style={styles.label}>Price per share</Text><Text style={styles.value}>{formatDisplayMoney(campaign.pricePerShareMinor / 100, campaign.currency, selectedCurrency)}</Text></View>
            <View style={[styles.row, styles.totalRow]}>
              <Text style={styles.totalLabel}>Amount if this campaign succeeds</Text>
              <Text style={styles.totalValue}>{formatDisplayMoney(amount / 100, campaign.currency, selectedCurrency)}</Text>
            </View>
          </FloatingCard>

          <View>
            <Text style={styles.sectionTitle}>Fulfilment</Text>
            <FloatingCard>
              <Text style={styles.bodyText}>
                {fulfilment?.method ? `Fulfils by: ${FULFILMENT_METHOD_LABELS[fulfilment.method]}.` : "The fulfilment method will be confirmed by the organiser once this campaign succeeds."}
              </Text>
            </FloatingCard>
          </View>

          <View>
            <Text style={styles.sectionTitle}>Important conditions</Text>
            <FloatingCard style={{ gap: 8 }}>
              <Text style={styles.bodyText}>• Your card is not charged now — only saved against this pledge.</Text>
              <Text style={styles.bodyText}>• You are only charged {formatDisplayMoney(amount / 100, campaign.currency, selectedCurrency)} if this campaign reaches its minimum required quantity by {formatDeadline(campaign.deadline)}.</Text>
              <Text style={styles.bodyText}>• Reaching the goal is not required — the campaign proceeds at the minimum.</Text>
              <Text style={styles.bodyText}>• If the campaign fails, nothing is charged — there is nothing to refund.</Text>
            </FloatingCard>
          </View>

          <TouchableOpacity
            onPress={() => router.push({ pathname: "/(buyer)/community-buy-payment", params: { id: campaign.id, quantity: String(quantity) } } as any)}
            activeOpacity={0.88}
            style={styles.primaryBtn}
            accessibilityRole="button"
            accessibilityLabel="Continue to payment"
          >
            <Text style={styles.primaryBtnText}>Continue to payment</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  label: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#6A7B72" },
  value: { flex: 1, fontSize: 13, fontFamily: "Manrope-SemiBold", color: "#151E1B", textAlign: "right" },
  totalRow: { borderTopWidth: 1, borderTopColor: "#F0F0F0", paddingTop: 10, marginTop: 2 },
  totalLabel: { fontSize: 12, fontFamily: "Manrope-SemiBold", color: "#151E1B" },
  totalValue: { fontSize: 16, fontFamily: "Manrope-ExtraBold", color: "#076B51" },
  sectionTitle: { fontSize: 15, fontFamily: "Manrope-ExtraBold", color: "#12221A", marginBottom: 10 },
  bodyText: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#4A5A52", lineHeight: 17 },
  primaryBtn: { minHeight: 52, borderRadius: 14, backgroundColor: "#076B51", alignItems: "center", justifyContent: "center" },
  primaryBtnText: { fontSize: 14, fontFamily: "Manrope-Bold", color: "#FFFFFF" },
});
