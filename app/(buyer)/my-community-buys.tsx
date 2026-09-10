import React, { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { useFocusRefresh } from "../../hooks/useFocusRefresh";
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
  RangeProgressBar,
  StatusPill,
  premiumStyles,
} from "../../components/shared/PremiumBlocks";
import {
  communityBuyService,
  CAMPAIGN_STATUS_LABELS,
  CAMPAIGN_STATUS_TONE,
  CONTRIBUTION_STATUS_LABELS,
  CONTRIBUTION_STATUS_TONE,
  type MyCommunityBuy,
} from "../../services/communityBuyService";

function formatDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function daysLeft(deadline: string): string {
  const ms = new Date(deadline).getTime() - Date.now();
  if (ms <= 0) return "Closing";
  const days = Math.ceil(ms / (24 * 60 * 60 * 1000));
  return days === 1 ? "1 day left" : `${days} days left`;
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

  useFocusRefresh(load);

  return (
    <View style={premiumStyles.page}>
      <PremiumHeader
        title="My Community Buys"
        onBack={() => goBackOrReplace(router, "/(buyer)/community-buy" as any)}
        right={
          <TouchableOpacity
            onPress={() => router.push("/(buyer)/community-buy-support-cases" as any)}
            activeOpacity={0.85}
            style={styles.headerIconBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Support cases"
          >
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
                accessibilityRole="button"
                accessibilityLabel={`${item.campaign.title}, ${CAMPAIGN_STATUS_LABELS[item.campaign.status]}`}
              >
                <FloatingCard style={{ gap: 8 }}>
                  <View style={styles.cardTop}>
                    <Text style={styles.cardTitle} numberOfLines={1}>{item.campaign.title}</Text>
                    <StatusPill label={CAMPAIGN_STATUS_LABELS[item.campaign.status]} tone={CAMPAIGN_STATUS_TONE[item.campaign.status]} />
                  </View>
                  <Text style={styles.cardVendor}>{item.campaign.supplier?.vendor?.storeName ?? "Community Buy"}</Text>

                  {item.refundStatus ? (
                    <StatusPill label={CONTRIBUTION_STATUS_LABELS[item.refundStatus]} tone={CONTRIBUTION_STATUS_TONE[item.refundStatus]} />
                  ) : null}

                  {item.campaign.status === "LIVE" || item.campaign.status === "RESCUE_WINDOW" || item.campaign.status === "PAUSED" ? (
                    <>
                      <RangeProgressBar
                        value={item.campaign.confirmedShares}
                        min={item.campaign.minimumShares}
                        goal={item.campaign.goalShares}
                        max={item.campaign.maximumShares}
                      />
                      <Text style={styles.cardMetaText}>
                        {item.campaign.confirmedShares} of {item.campaign.maximumShares} slots filled
                        {item.campaign.status === "RESCUE_WINDOW" && item.campaign.rescueEndsAt
                          ? ` · Completion period ends ${formatDate(item.campaign.rescueEndsAt)}`
                          : ` · ${daysLeft(item.campaign.deadline)}`}
                      </Text>
                    </>
                  ) : null}

                  <View style={styles.cardMetaRow}>
                    <Text style={styles.cardMetaText}>
                      {item.totalPaid > 0
                        ? `${item.totalQuantity} share${item.totalQuantity === 1 ? "" : "s"} · ${formatDisplayMoney(item.totalPaid / 100, item.campaign.currency, selectedCurrency)} charged`
                        : !item.refundStatus
                          ? CONTRIBUTION_STATUS_LABELS[item.latestContribution.status]
                          : `${formatDisplayMoney(item.totalPledged / 100, item.campaign.currency, selectedCurrency)} pledged — not charged`}
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
