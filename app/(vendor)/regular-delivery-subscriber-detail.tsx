import React, { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
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
} from "../../components/shared/PremiumBlocks";
import {
  regularDeliveriesService,
  FREQUENCY_LABELS,
  RENEWAL_STATUS_LABELS,
  type BuyerSubscription,
} from "../../services/regularDeliveriesService";

function formatDate(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export default function VendorSubscriberDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { selectedCurrency } = useCurrencyStore();
  const [subscription, setSubscription] = useState<BuyerSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError("");
    try {
      setSubscription(await regularDeliveriesService.getSubscriberDetail(id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load this subscriber.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <View style={premiumStyles.page}>
      <PremiumHeader
        title={subscription?.buyer?.name ?? "Subscriber"}
        subtitle={subscription ? FREQUENCY_LABELS[subscription.frequency] : undefined}
        onBack={() => goBackOrReplace(router, "/(vendor)/regular-deliveries" as any)}
      />

      <ScrollView style={{ flex: 1 }} contentContainerStyle={[premiumStyles.scrollContent, { paddingTop: 18 }]} showsVerticalScrollIndicator={false}>
        {loading ? (
          <LoadingBlock />
        ) : error ? (
          <View style={premiumStyles.block}><ErrorState message={error} onRetry={() => void load()} /></View>
        ) : !subscription ? null : (
          <View style={[premiumStyles.block, { gap: 10 }]}>
            <FloatingCard>
              <Text style={styles.buyerName}>{subscription.buyer?.name ?? "Buyer"}</Text>
              {subscription.buyer?.email ? <Text style={styles.buyerEmail}>{subscription.buyer.email}</Text> : null}
              <View style={styles.metaRow}>
                <StatusPill label={subscription.status.replace("_", " ")} tone={subscription.status === "ACTIVE" ? "success" : "neutral"} />
                <Text style={styles.metaText}>Next renewal {formatDate(subscription.nextRenewalAt)}</Text>
              </View>
            </FloatingCard>

            <Text style={styles.sectionTitle}>Items on this subscription</Text>
            <FloatingCard style={{ padding: 0, overflow: "hidden" }}>
              {subscription.items.map((item, index) => (
                <View key={item.id} style={[styles.itemRow, index > 0 && styles.itemRowBorder]}>
                  <Text style={styles.itemName} numberOfLines={1}>{item.product.title}</Text>
                  <Text style={styles.itemMeta}>
                    x{item.quantity} · {formatDisplayMoney(item.product.priceInCents / 100, item.product.currency, selectedCurrency)}
                  </Text>
                </View>
              ))}
            </FloatingCard>

            <Text style={styles.sectionTitle}>Renewal history</Text>
            {!subscription.renewals || subscription.renewals.length === 0 ? (
              <FloatingCard><EmptyState icon="time-outline" title="No renewal cycles yet" /></FloatingCard>
            ) : (
              <View style={{ gap: 8 }}>
                {subscription.renewals.map((r) => (
                  <FloatingCard key={r.id}>
                    <View style={styles.renewalTop}>
                      <Text style={styles.renewalDate}>{formatDate(r.cycleDate)}</Text>
                      {r.subtotalAmount ? (
                        <Text style={styles.renewalAmount}>{formatDisplayMoney(r.subtotalAmount / 100, r.currency, selectedCurrency)}</Text>
                      ) : null}
                    </View>
                    <StatusPill
                      label={RENEWAL_STATUS_LABELS[r.status]}
                      tone={r.status === "ORDER_CREATED" ? "success" : r.status === "PAYMENT_FAILED" ? "error" : "neutral"}
                    />
                    {r.failureReason ? <Text style={styles.renewalFailure}>{r.failureReason}</Text> : null}
                  </FloatingCard>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  buyerName: { fontSize: 17, fontFamily: "Manrope-Bold", color: "#151E1B" },
  buyerEmail: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#6A7B72", marginTop: 2 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10 },
  metaText: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#6A7B72" },
  sectionTitle: { fontSize: 15, fontFamily: "Manrope-ExtraBold", color: "#12221A", marginTop: 4 },
  itemRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8, padding: 14 },
  itemRowBorder: { borderTopWidth: 1, borderTopColor: "#F0F0F0" },
  itemName: { flex: 1, fontSize: 13, fontFamily: "Manrope-SemiBold", color: "#151E1B" },
  itemMeta: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#6A7B72" },
  renewalTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  renewalDate: { fontSize: 13, fontFamily: "Manrope-SemiBold", color: "#151E1B" },
  renewalAmount: { fontSize: 14, fontFamily: "Manrope-ExtraBold", color: "#076B51" },
  renewalFailure: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#D6552F", marginTop: 6 },
});
