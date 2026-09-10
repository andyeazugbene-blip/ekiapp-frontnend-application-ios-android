import React, { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { formatDisplayMoney } from "../../utils/currency";
import { useCurrencyStore } from "../../stores/currencyStore";
import { ErrorState, FloatingCard, IconAvatar, LoadingBlock, PremiumHeader, premiumStyles } from "../../components/shared/PremiumBlocks";
import { communityBuyService, type Campaign, type Contribution } from "../../services/communityBuyService";

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
        <PremiumHeader title="Pledge confirmed" />
        <LoadingBlock />
      </View>
    );
  }

  if (error || !campaign || !contribution) {
    return (
      <View style={premiumStyles.page}>
        <PremiumHeader title="Pledge confirmed" />
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

  return (
    <View style={premiumStyles.page}>
      <PremiumHeader title="Pledge confirmed" />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={[premiumStyles.scrollContent, { paddingTop: 18 }]} showsVerticalScrollIndicator={false}>
        <View style={[premiumStyles.block, { gap: 16, alignItems: "center" }]}>
          <IconAvatar icon="bookmark-outline" tone="success" size={64} />
          <Text style={styles.title}>Your pledge is recorded</Text>
          <Text style={styles.body}>
            {contribution.quantity} share{contribution.quantity === 1 ? "" : "s"} of "{campaign.title}" — your payment method is saved for {formatDisplayMoney(contribution.amount / 100, contribution.currency, selectedCurrency)}. You will only be charged if this campaign reaches its minimum required quantity.
          </Text>

          <FloatingCard style={{ width: "100%", gap: 8 }}>
            <View style={styles.row}><Text style={styles.label}>Campaign</Text><Text style={styles.value} numberOfLines={1}>{campaign.title}</Text></View>
            <View style={styles.row}><Text style={styles.label}>Shares</Text><Text style={styles.value}>{contribution.quantity}</Text></View>
            <View style={styles.row}><Text style={styles.label}>Amount if successful</Text><Text style={styles.value}>{formatDisplayMoney(contribution.amount / 100, contribution.currency, selectedCurrency)}</Text></View>
            <View style={styles.row}><Text style={styles.label}>Status</Text><Text style={styles.value}>Not charged yet</Text></View>
          </FloatingCard>

          <FloatingCard style={{ width: "100%", flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
            <Ionicons name="information-circle-outline" size={18} color="#076B51" />
            <Text style={styles.infoText}>Track this campaign's progress and your pledge status any time from My Community Buys.</Text>
          </FloatingCard>

          <TouchableOpacity
            onPress={goToDashboard}
            activeOpacity={0.88}
            style={styles.primaryBtn}
            accessibilityRole="button"
            accessibilityLabel="Go to my Community Buys"
          >
            <Text style={styles.primaryBtnText}>Go to my Community Buys</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={goToCampaign}
            activeOpacity={0.85}
            style={styles.secondaryBtn}
            accessibilityRole="button"
            accessibilityLabel="Back to campaign"
          >
            <Text style={styles.secondaryBtnText}>Back to campaign</Text>
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
  primaryBtn: { width: "100%", minHeight: 52, borderRadius: 14, backgroundColor: "#076B51", alignItems: "center", justifyContent: "center" },
  primaryBtnText: { fontSize: 14, fontFamily: "Manrope-Bold", color: "#FFFFFF" },
  secondaryBtn: { width: "100%", minHeight: 46, borderRadius: 14, borderWidth: 1, borderColor: "#076B51", alignItems: "center", justifyContent: "center" },
  secondaryBtnText: { fontSize: 13, fontFamily: "Manrope-SemiBold", color: "#076B51" },
});
