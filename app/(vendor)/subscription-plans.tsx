import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  subscriptionService,
  type ActiveSubscription,
  type SubscriptionLimits,
  type SubscriptionPlan,
} from "../../services/subscriptionService";
import { goBackOrReplace } from "../../utils/navigation";

function formatTimeLeft(currentPeriodEnd: string): string | null {
  if (!currentPeriodEnd) return null;
  const end = new Date(currentPeriodEnd).getTime();
  if (Number.isNaN(end)) return null;
  const diffMs = end - Date.now();
  if (diffMs <= 0) return "Expired";
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days >= 1) return `${days} day${days === 1 ? "" : "s"} left`;
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  if (hours >= 1) return `${hours} hour${hours === 1 ? "" : "s"} left`;
  const minutes = Math.max(1, Math.floor(diffMs / (1000 * 60)));
  return `${minutes} min left`;
}

export default function SubscriptionPlansScreen() {
  const router = useRouter();
  const [subscription, setSubscription] = useState<ActiveSubscription | null>(null);
  const [limits, setLimits] = useState<SubscriptionLimits | null>(null);
  const [currentPlanDetails, setCurrentPlanDetails] = useState<SubscriptionPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadPlanStatus = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError("");
    setMessage("");

    try {
      const [current, currentLimits, allPlans] = await Promise.all([
        subscriptionService.getCurrentSubscription(),
        subscriptionService.getLimits(),
        subscriptionService.getPlans(),
      ]);
      setSubscription(current);
      setLimits(currentLimits);
      const matched = allPlans.find((plan) => plan.slug === current?.slug) ?? null;
      setCurrentPlanDetails(matched);
      if (refresh) setMessage("Plan status refreshed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load plan status.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadPlanStatus();
  }, [loadPlanStatus]);

  const isActive = subscription?.status === "active";
  const planName = currentPlanDetails?.name ?? subscription?.planName ?? "Free";
  const priceLabel = currentPlanDetails
    ? currentPlanDetails.price > 0
      ? `${currentPlanDetails.currency === "GBP" ? "£" : currentPlanDetails.currency} ${currentPlanDetails.price.toFixed(2)}`
      : "Free"
    : null;
  const timeLeft = subscription ? formatTimeLeft(subscription.currentPeriodEnd) : null;
  const features = currentPlanDetails?.features ?? [];

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => goBackOrReplace(router, "/(vendor)/settings" as any)} activeOpacity={0.85} style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color="#282828" />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Seller Plan</Text>
          <Text style={styles.headerSubtitle}>Growth tools, success fee and plan details</Text>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.placeholder}>
            <ActivityIndicator color="#076B51" />
          </View>
        ) : error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : (
          <>
            <View style={styles.pricingCard}>
              <Text style={styles.cardLabel}>PRICING CARD</Text>
              <View style={styles.titleRow}>
                <Text style={styles.planName}>{planName}</Text>
                <View style={[styles.statusBadge, !isActive && styles.statusBadgeInactive]}>
                  <Text style={[styles.statusBadgeText, !isActive && styles.statusBadgeTextInactive]}>
                    {isActive ? "Active" : "Inactive"}
                  </Text>
                </View>
              </View>

              {priceLabel ? (
                <View style={styles.priceRow}>
                  <Text style={styles.priceValue} numberOfLines={1} adjustsFontSizeToFit>{priceLabel}</Text>
                  {currentPlanDetails && currentPlanDetails.price > 0 ? <Text style={styles.priceUnit}>/month</Text> : null}
                </View>
              ) : null}

              <Text style={styles.plusLabel}>PLUS</Text>
              <View style={styles.feeBanner}>
                <Text style={styles.feeBannerValue}>
                  {limits?.platformFeePercent ?? subscription?.platformFeePercent ?? "—"}
                </Text>
                <Text style={styles.feeBannerLabel}>only when you sell</Text>
              </View>

              {timeLeft ? (
                <View style={styles.timeLeftPill}>
                  <Ionicons name="time-outline" size={14} color="#076B51" />
                  <Text style={styles.timeLeftText}>{timeLeft}</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.statusCard}>
              <Text style={styles.sectionTitle}>What {planName} includes</Text>
              {features.length === 0 ? (
                <Text style={styles.statusBody}>No features configured for this plan yet.</Text>
              ) : (
                features.map((feature, index) => (
                  <View key={`${feature}-${index}`} style={styles.featureRow}>
                    <View style={styles.featureCheck}>
                      <Ionicons name="checkmark" size={14} color="#076B51" />
                    </View>
                    <Text style={styles.featureLabel}>{feature}</Text>
                  </View>
                ))
              )}
            </View>

            <View style={styles.statusCard}>
              <Text style={styles.sectionTitle}>Commission rules</Text>
              {(limits?.commissionTiers ?? subscription?.commissionTiers ?? []).filter((tier) => tier.isActive !== false).length === 0 ? (
                <Text style={styles.statusBody}>No commission tiers are configured for this seller plan.</Text>
              ) : (
                (limits?.commissionTiers ?? subscription?.commissionTiers ?? [])
                  .filter((tier) => tier.isActive !== false)
                  .map((tier) => (
                    <LimitRow
                      key={tier.id ?? `${tier.minSubtotalCents}-${tier.platformFeeBps}`}
                      icon="pricetag-outline"
                      label={tier.label ?? "Order subtotal tier"}
                      value={`${tier.platformFeePercent ?? `${tier.platformFeeBps / 100}%`} from ${(tier.minSubtotalCents / 100).toLocaleString("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 })}${tier.maxSubtotalCents ? ` to ${(tier.maxSubtotalCents / 100).toLocaleString("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 })}` : "+"}`}
                    />
                  ))
              )}
            </View>

            <View style={styles.statusCard}>
              <Text style={styles.sectionTitle}>Usage limits</Text>
              <LimitRow
                icon="cube-outline"
                label="Products"
                value={
                  limits
                    ? `${limits.currentProducts.toLocaleString("en-US")} / ${limits.maxProducts >= Number.MAX_SAFE_INTEGER ? "Unlimited" : limits.maxProducts.toLocaleString("en-US")}`
                    : "Unavailable"
                }
              />
              <LimitRow
                icon="receipt-outline"
                label="Orders"
                value={
                  limits
                    ? limits.maxOrders === null
                      ? limits.currentOrders.toLocaleString("en-US")
                      : `${limits.currentOrders.toLocaleString("en-US")} / ${limits.maxOrders.toLocaleString("en-US")}`
                    : "Unavailable"
                }
              />
              <LimitRow icon="mail-outline" label="Offers" value={limits?.canSendOffers ? "Available" : "Not available"} />
              <LimitRow icon="bar-chart-outline" label="Analytics" value={limits?.canAccessAnalytics ? "Available" : "Not available"} />
              <LimitRow icon="cube-outline" label="Bundles" value={limits?.bundles ? "Available" : "Not available"} />
              <LimitRow icon="flash-outline" label="Flash sales" value={limits?.flashSales ? "Available" : "Not available"} />
            </View>

            <View style={styles.statusCard}>
              <Text style={styles.sectionTitle}>Plan changes</Text>
              <Text style={styles.statusBody}>
                Plans are assigned by the Eki team. Contact support to discuss moving to a different plan — no payment is taken in the app.
              </Text>
            </View>

            {message ? <Text style={styles.messageText}>{message}</Text> : null}
          </>
        )}
      </ScrollView>

      <View style={styles.bottomBar}>
        <TouchableOpacity
          onPress={() => loadPlanStatus(true)}
          activeOpacity={0.85}
          style={[styles.refreshButton, refreshing && { opacity: 0.6 }]}
          disabled={refreshing}
        >
          {refreshing ? <ActivityIndicator color="#FFFFFF" size="small" /> : null}
          <Text style={styles.refreshButtonText}>Refresh plan status</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function LimitRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.limitRow}>
      <View style={styles.limitIcon}>
        <Ionicons name={icon} size={18} color="#076B51" />
      </View>
      <Text style={styles.limitLabel}>{label}</Text>
      <Text style={styles.limitValue} numberOfLines={2}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9F9F9" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  backButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#F0F0F0", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 20, fontFamily: "Manrope-Bold", color: "#282828" },
  headerSubtitle: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#858585", marginTop: 2 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 100 },
  placeholder: { paddingVertical: 60, alignItems: "center" },
  errorText: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#FB6363", textAlign: "center", paddingVertical: 30 },
  messageText: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#076B51", textAlign: "center", marginTop: 12 },
  pricingCard: { backgroundColor: "#FFFFFF", borderRadius: 18, padding: 20, marginBottom: 14, borderWidth: 1, borderColor: "#F0F0F0" },
  cardLabel: { fontSize: 11, fontFamily: "Outfit-Regular", color: "#858585", letterSpacing: 0.6, textTransform: "uppercase" },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 },
  planName: { fontSize: 26, fontFamily: "Manrope-Bold", color: "#282828" },
  statusBadge: { borderRadius: 999, backgroundColor: "rgba(7,107,81,0.10)", paddingHorizontal: 12, paddingVertical: 6 },
  statusBadgeInactive: { backgroundColor: "rgba(133,133,133,0.12)" },
  statusBadgeText: { fontSize: 12, fontFamily: "Manrope-SemiBold", color: "#076B51" },
  statusBadgeTextInactive: { color: "#858585" },
  priceRow: { flexDirection: "row", alignItems: "flex-end", gap: 6, marginTop: 14 },
  priceValue: { fontSize: 38, fontFamily: "Manrope-Bold", color: "#076B51" },
  priceUnit: { fontSize: 14, fontFamily: "Outfit-Regular", color: "#858585", marginBottom: 6 },
  plusLabel: { fontSize: 11, fontFamily: "Outfit-Regular", color: "#858585", letterSpacing: 0.6, textTransform: "uppercase", marginTop: 16 },
  feeBanner: { marginTop: 8, borderRadius: 14, backgroundColor: "#EEF8F0", borderWidth: 1, borderColor: "#D9EDE0", paddingHorizontal: 14, paddingVertical: 12, flexDirection: "row", alignItems: "baseline", gap: 8 },
  feeBannerValue: { fontSize: 22, fontFamily: "Manrope-Bold", color: "#076B51" },
  feeBannerLabel: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#282828" },
  timeLeftPill: { marginTop: 12, flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", backgroundColor: "#F6F8F7", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  timeLeftText: { fontSize: 12, fontFamily: "Manrope-SemiBold", color: "#076B51" },
  statusCard: { backgroundColor: "#FFFFFF", borderRadius: 18, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: "#F0F0F0" },
  statusBody: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#858585", lineHeight: 19 },
  sectionTitle: { fontSize: 16, fontFamily: "Manrope-Bold", color: "#282828", marginBottom: 12 },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 },
  featureCheck: { width: 22, height: 22, borderRadius: 11, backgroundColor: "#E8F4ED", alignItems: "center", justifyContent: "center" },
  featureLabel: { flex: 1, fontSize: 13, fontFamily: "Outfit-Regular", color: "#282828" },
  limitRow: { minHeight: 48, flexDirection: "row", alignItems: "center", borderTopWidth: 1, borderTopColor: "#F0F0F0", gap: 10 },
  limitIcon: { width: 30, height: 30, borderRadius: 10, backgroundColor: "#E8F4ED", alignItems: "center", justifyContent: "center" },
  limitLabel: { flex: 1, fontSize: 14, fontFamily: "Outfit-Regular", color: "#282828" },
  limitValue: { fontSize: 13, fontFamily: "Manrope-SemiBold", color: "#1A1A1A", flexShrink: 1, textAlign: "right" },
  bottomBar: { paddingHorizontal: 16, paddingVertical: 12 },
  refreshButton: { height: 56, borderRadius: 14, backgroundColor: "#076B51", alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
  refreshButtonText: { fontSize: 16, fontFamily: "Manrope-SemiBold", color: "#FFFFFF" },
});
