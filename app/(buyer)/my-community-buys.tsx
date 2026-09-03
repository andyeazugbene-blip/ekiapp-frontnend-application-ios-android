import React, { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { goBackOrReplace } from "../../utils/navigation";
import { formatDisplayMoney } from "../../utils/currency";
import { useCurrencyStore } from "../../stores/currencyStore";
import {
  EmptyState,
  ErrorState,
  FloatingCard,
  LoadingBlock,
  PremiumHeader,
  StatusPill,
  premiumStyles,
  type Tone,
} from "../../components/shared/PremiumBlocks";
import { communityBuyService, type ContributionStatus, type MyCommunityBuy } from "../../services/communityBuyService";

// Client mandate (2026-09): accurate states only — never show "Payment
// successful" when only a payment method has been saved.
const PLEDGE_TONE: Partial<Record<ContributionStatus, Tone>> = {
  PLEDGED: "info",
  PAYMENT_PROCESSING: "info",
  PAID: "success",
  CHARGE_FAILED: "error",
  CANCELLED: "neutral",
};

const PLEDGE_LABEL: Partial<Record<ContributionStatus, string>> = {
  PLEDGED: "Payment method saved — awaiting outcome",
  PAYMENT_PROCESSING: "Payment pending",
  PAID: "Payment confirmed",
  CHARGE_FAILED: "Payment failed",
  CANCELLED: "Pledge cancelled",
};

const REFUND_TONE: Record<NonNullable<MyCommunityBuy["refundStatus"]>, Tone> = {
  REFUND_PENDING: "warning",
  REFUND_PROCESSING: "warning",
  REFUNDED: "success",
  REFUND_FAILED: "error",
};

const REFUND_LABEL: Record<NonNullable<MyCommunityBuy["refundStatus"]>, string> = {
  REFUND_PENDING: "Refund started",
  REFUND_PROCESSING: "Refund in progress",
  REFUNDED: "Refund completed",
  REFUND_FAILED: "Refund needs attention",
};

function formatDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export default function MyCommunityBuysScreen() {
  const router = useRouter();
  const { selectedCurrency } = useCurrencyStore();
  const [items, setItems] = useState<MyCommunityBuy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setItems(await communityBuyService.listMyContributions());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load your Community Buys.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <View style={premiumStyles.page}>
      <PremiumHeader
        title="My Community Buys"
        onBack={() => goBackOrReplace(router, "/(buyer)/community-buy" as any)}
        right={
          <TouchableOpacity onPress={() => router.push("/(buyer)/community-buy-support-cases" as any)} activeOpacity={0.85} style={styles.headerIconBtn}>
            <Ionicons name="flag-outline" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        }
      />

      <ScrollView style={{ flex: 1 }} contentContainerStyle={[premiumStyles.scrollContent, { paddingTop: 18 }]} showsVerticalScrollIndicator={false}>
        {loading ? (
          <LoadingBlock />
        ) : error ? (
          <View style={premiumStyles.block}><ErrorState message={error} onRetry={() => void load()} /></View>
        ) : items.length === 0 ? (
          <View style={premiumStyles.block}>
            <FloatingCard>
              <EmptyState icon="people-circle-outline" title="No contributions yet" body="Campaigns you contribute to will show up here." />
            </FloatingCard>
          </View>
        ) : (
          <View style={[premiumStyles.block, { gap: 10 }]}>
            {items.map((item) => (
              <TouchableOpacity
                key={item.campaign.id}
                activeOpacity={0.85}
                onPress={() => router.push({ pathname: "/(buyer)/community-buy-campaign", params: { id: item.campaign.id } } as any)}
              >
                <FloatingCard style={{ gap: 8 }}>
                  <View style={styles.cardTop}>
                    <Text style={styles.cardTitle} numberOfLines={1}>{item.campaign.title}</Text>
                    {item.refundStatus ? (
                      <StatusPill label={REFUND_LABEL[item.refundStatus]} tone={REFUND_TONE[item.refundStatus]} />
                    ) : PLEDGE_LABEL[item.latestContribution.status] ? (
                      <StatusPill label={PLEDGE_LABEL[item.latestContribution.status]!} tone={PLEDGE_TONE[item.latestContribution.status] ?? "neutral"} />
                    ) : null}
                  </View>
                  <Text style={styles.cardVendor}>{item.campaign.supplier?.vendor?.storeName ?? "Community Buy"}</Text>
                  <View style={styles.cardMetaRow}>
                    <Text style={styles.cardMetaText}>
                      {item.totalPaid > 0
                        ? `${item.totalQuantity} share${item.totalQuantity === 1 ? "" : "s"} · ${formatDisplayMoney(item.totalPaid / 100, item.campaign.currency, selectedCurrency)} charged`
                        : `${formatDisplayMoney(item.totalPledged / 100, item.campaign.currency, selectedCurrency)} pledged — not charged yet`}
                    </Text>
                    <Text style={styles.cardMetaText}>{formatDate(item.campaign.deadline)}</Text>
                  </View>
                </FloatingCard>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  headerIconBtn: { width: 38, height: 38, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.14)", alignItems: "center", justifyContent: "center" },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  cardTitle: { flex: 1, fontSize: 15, fontFamily: "Manrope-Bold", color: "#151E1B" },
  cardVendor: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#6A7B72" },
  cardMetaRow: { flexDirection: "row", justifyContent: "space-between" },
  cardMetaText: { fontSize: 12, fontFamily: "Outfit-Medium", color: "#151E1B" },
});
