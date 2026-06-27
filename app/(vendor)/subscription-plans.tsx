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

interface StructuredFeature {
  title: string;
  description: string;
}

const GROWTH_FEATURES: StructuredFeature[] = [
  { title: "Unlimited Products", description: "List all your foodstuff without limits." },
  { title: "Unlimited Orders", description: "Keep selling without restrictions." },
  { title: "Customer Database", description: "Know exactly who bought from you and when." },
  { title: "Repeat Buyer Marketing", description: "Bring previous customers back before they buy elsewhere." },
  { title: "Sales Analytics", description: "Track revenue, repeat buyers and best-selling foodstuff." },
  { title: "Flash Sales", description: "Create urgency and sell more stock quickly." },
  { title: "Product Bundles", description: "Increase average order value with product bundles." },
  { title: "Professional Storefront", description: "Give customers a professional place to order and buy." },
  { title: "Order Management", description: "Manage products, orders and customers from one place." },
  { title: "Store Link Sharing", description: "Share your store on WhatsApp, Instagram, Facebook" },
];

const FREE_FEATURES: StructuredFeature[] = [
  { title: "Limited Products", description: "List a set number of products to get started." },
  { title: "Limited Orders", description: "Receive a set number of orders per month." },
  { title: "Basic Dashboard", description: "View your orders and manage your store." },
  { title: "Store Link Sharing", description: "Share your store on WhatsApp, Instagram, Facebook" },
];

const PRO_FEATURES: StructuredFeature[] = [
  ...GROWTH_FEATURES,
  { title: "Priority Support", description: "Get faster help when you need it." },
  { title: "Advanced Analytics", description: "Deeper insights into your business performance." },
];

function getFeaturesForPlan(slug: string): StructuredFeature[] {
  if (slug === "growth") return GROWTH_FEATURES;
  if (slug === "pro" || slug === "premium") return PRO_FEATURES;
  return FREE_FEATURES;
}

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

function formatCurrencySymbol(currency: string): string {
  if (currency === "GBP") return "£";
  if (currency === "USD") return "$";
  if (currency === "EUR") return "€";
  if (currency === "NGN") return "₦";
  return currency + " ";
}

export default function SubscriptionPlansScreen() {
  const router = useRouter();
  const [subscription, setSubscription] = useState<ActiveSubscription | null>(null);
  const [limits, setLimits] = useState<SubscriptionLimits | null>(null);
  const [currentPlanDetails, setCurrentPlanDetails] = useState<SubscriptionPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadPlanStatus = useCallback(async () => {
    setLoading(true);
    setError("");
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load plan status.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPlanStatus();
  }, [loadPlanStatus]);

  const isActive = subscription?.status === "active";
  const planSlug = currentPlanDetails?.slug ?? subscription?.slug ?? "free";
  const planName = currentPlanDetails?.name ?? subscription?.planName ?? "Free";
  const displayName = planSlug === "free" ? "Free" : planSlug === "growth" ? "Eki Growth" : planSlug === "pro" ? "Eki Pro" : planName;
  const currency = currentPlanDetails?.currency ?? "GBP";
  const currencySymbol = formatCurrencySymbol(currency);
  const price = currentPlanDetails?.price ?? 0;
  const feePercent = limits?.platformFeePercent ?? subscription?.platformFeePercent ?? "—";
  const timeLeft = subscription ? formatTimeLeft(subscription.currentPeriodEnd) : null;
  const structuredFeatures = getFeaturesForPlan(planSlug);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => goBackOrReplace(router, "/(vendor)/settings" as any)} activeOpacity={0.85} style={styles.backButton}>
          <Ionicons name="chevron-back" size={22} color="#282828" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
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
            {/* ── Pricing Card ──────────────────────────────────── */}
            <View style={styles.pricingCard}>
              <Text style={styles.cardLabel}>PRICING CARD</Text>

              <View style={styles.titleRow}>
                <Text style={styles.planName}>{displayName}</Text>
                <View style={[styles.statusBadge, !isActive && styles.statusBadgeInactive]}>
                  <Text style={[styles.statusBadgeText, !isActive && styles.statusBadgeTextInactive]}>
                    {isActive ? "Active" : "Inactive"}
                  </Text>
                </View>
              </View>

              {price > 0 ? (
                <View style={styles.priceRow}>
                  <Text style={styles.priceValue}>{currencySymbol}{price.toFixed(2)}</Text>
                  <Text style={styles.priceUnit}>/month</Text>
                </View>
              ) : (
                <View style={styles.priceRow}>
                  <Text style={styles.priceValue}>Free</Text>
                </View>
              )}

              <Text style={styles.plusLabel}>PLUS</Text>
              <View style={styles.feeBanner}>
                <Text style={styles.feeBannerValue}>{feePercent}</Text>
                <Text style={styles.feeBannerLabel}>   only when you sell</Text>
              </View>

              <View style={styles.noSalesPill}>
                <Text style={styles.noSalesLabel}>No sales?</Text>
                <Text style={styles.noSalesValue}>  No transaction fee.</Text>
              </View>

              {timeLeft ? (
                <View style={styles.timeLeftPill}>
                  <Ionicons name="time-outline" size={14} color="#076B51" />
                  <Text style={styles.timeLeftText}>{timeLeft}</Text>
                </View>
              ) : null}
            </View>

            {/* ── Why this pays for itself ──────────────────────── */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Why this pays for itself</Text>
              <Text style={styles.sectionBody}>
                One repeat buyer can cover your monthly plan.
              </Text>
              <Text style={styles.payoffHighlight}>
                Bring back old buyers before they buy elsewhere.
              </Text>
            </View>

            {/* ── What plan includes ───────────────────────────── */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>What {planSlug === "free" ? "Free" : planSlug === "growth" ? "Growth" : "Pro"} includes</Text>
              {structuredFeatures.map((feat, index) => (
                <View key={index} style={styles.featureRow}>
                  <View style={styles.featureCheck}>
                    <Ionicons name="checkmark" size={13} color="#076B51" />
                  </View>
                  <View style={styles.featureTextGroup}>
                    <Text style={styles.featureTitle}>{feat.title}</Text>
                    <Text style={styles.featureDesc}>{feat.description}</Text>
                  </View>
                </View>
              ))}
            </View>

            {/* ── Why vendors upgrade ──────────────────────────── */}
            <View style={styles.upgradeReasonCard}>
              <Text style={styles.sectionTitle}>Why vendors upgrade</Text>
              <UpgradeReasonRow label="More repeat customers" />
              <UpgradeReasonRow label="Less WhatsApp chaos" />
              <UpgradeReasonRow label="A more professional foodstuff business" />
            </View>
          </>
        )}
      </ScrollView>

      {/* ── Bottom CTA ──────────────────────────────────────── */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          onPress={() => goBackOrReplace(router, "/(vendor)" as any)}
          activeOpacity={0.85}
          style={styles.ctaButton}
        >
          <Text style={styles.ctaButtonText}>Continue Growing My Business</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function UpgradeReasonRow({ label }: { label: string }) {
  return (
    <View style={styles.upgradeReasonRow}>
      <View style={styles.upgradeReasonCheck}>
        <Ionicons name="checkmark" size={13} color="#076B51" />
      </View>
      <Text style={styles.upgradeReasonLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9F9F9" },

  // Header
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 18, paddingVertical: 16, gap: 14, borderBottomWidth: 1, borderBottomColor: "#F0F0F0" },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#F0F0F0", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 22, fontFamily: "Manrope-Bold", color: "#282828" },
  headerSubtitle: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#858585", marginTop: 2 },

  // Scroll
  scrollContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 110 },
  placeholder: { paddingVertical: 60, alignItems: "center" },
  errorText: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#FB6363", textAlign: "center", paddingVertical: 30 },

  // Pricing Card
  pricingCard: { backgroundColor: "#FFFFFF", borderRadius: 20, padding: 22, marginBottom: 14, borderWidth: 1, borderColor: "#ECECEC" },
  cardLabel: { fontSize: 11, fontFamily: "Outfit-Medium", color: "#858585", letterSpacing: 1, textTransform: "uppercase" },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 10 },
  planName: { fontSize: 28, fontFamily: "Manrope-Bold", color: "#1A1A1A" },
  statusBadge: { borderRadius: 999, backgroundColor: "rgba(7,107,81,0.10)", paddingHorizontal: 14, paddingVertical: 7 },
  statusBadgeInactive: { backgroundColor: "rgba(133,133,133,0.12)" },
  statusBadgeText: { fontSize: 13, fontFamily: "Manrope-SemiBold", color: "#076B51" },
  statusBadgeTextInactive: { color: "#858585" },
  priceRow: { flexDirection: "row", alignItems: "flex-end", gap: 4, marginTop: 16 },
  priceValue: { fontSize: 42, fontFamily: "Manrope-Bold", color: "#076B51" },
  priceUnit: { fontSize: 15, fontFamily: "Outfit-Regular", color: "#858585", marginBottom: 8 },
  plusLabel: { fontSize: 11, fontFamily: "Outfit-Medium", color: "#858585", letterSpacing: 1, textTransform: "uppercase", marginTop: 18 },
  feeBanner: { marginTop: 10, borderRadius: 14, backgroundColor: "#076B51", paddingHorizontal: 16, paddingVertical: 14, flexDirection: "row", alignItems: "baseline" },
  feeBannerValue: { fontSize: 24, fontFamily: "Manrope-Bold", color: "#FFFFFF" },
  feeBannerLabel: { fontSize: 14, fontFamily: "Outfit-Regular", color: "#FFFFFF" },
  noSalesPill: { marginTop: 14, flexDirection: "row", alignItems: "center", alignSelf: "flex-start", backgroundColor: "#F6F8F7", borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1, borderColor: "#E8E8E8" },
  noSalesLabel: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#858585" },
  noSalesValue: { fontSize: 13, fontFamily: "Manrope-SemiBold", color: "#076B51" },
  timeLeftPill: { marginTop: 14, flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", backgroundColor: "#F6F8F7", borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  timeLeftText: { fontSize: 12, fontFamily: "Manrope-SemiBold", color: "#076B51" },

  // Section Cards
  sectionCard: { backgroundColor: "#FFFFFF", borderRadius: 20, padding: 20, marginBottom: 14, borderWidth: 1, borderColor: "#ECECEC" },
  sectionTitle: { fontSize: 20, fontFamily: "Manrope-Bold", color: "#1A1A1A", marginBottom: 12 },
  sectionBody: { fontSize: 14, fontFamily: "Outfit-Regular", color: "#858585", lineHeight: 20 },
  payoffHighlight: { fontSize: 14, fontFamily: "Manrope-SemiBold", color: "#076B51", marginTop: 6, lineHeight: 22 },

  // Feature rows with title + description
  featureRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingVertical: 8 },
  featureCheck: { width: 24, height: 24, borderRadius: 12, backgroundColor: "#E8F4ED", alignItems: "center", justifyContent: "center", marginTop: 1 },
  featureTextGroup: { flex: 1 },
  featureTitle: { fontSize: 15, fontFamily: "Manrope-Bold", color: "#1A1A1A", lineHeight: 20 },
  featureDesc: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#858585", lineHeight: 18, marginTop: 2 },

  // Upgrade reason card
  upgradeReasonCard: { backgroundColor: "#F6FBF8", borderRadius: 20, padding: 20, marginBottom: 14, borderWidth: 1, borderColor: "#D9EDE0" },
  upgradeReasonRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 },
  upgradeReasonCheck: { width: 22, height: 22, borderRadius: 11, backgroundColor: "#E8F4ED", alignItems: "center", justifyContent: "center" },
  upgradeReasonLabel: { flex: 1, fontSize: 14, fontFamily: "Manrope-SemiBold", color: "#076B51" },

  // Bottom CTA
  bottomBar: { paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: 1, borderTopColor: "#F0F0F0", backgroundColor: "#FFFFFF" },
  ctaButton: { height: 56, borderRadius: 16, backgroundColor: "#076B51", alignItems: "center", justifyContent: "center" },
  ctaButtonText: { fontSize: 16, fontFamily: "Manrope-SemiBold", color: "#FFFFFF" },
});
