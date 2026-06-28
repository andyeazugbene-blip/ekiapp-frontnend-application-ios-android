import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  subscriptionService,
  type PaidSubscriptionPlan,
  type SubscriptionPlan,
} from "../../services/subscriptionService";

const BRAND = "#076B51";
const DARK = "#0D1B16";
const MUTED = "#66736D";
const SURFACE = "#FFFFFF";
const BORDER = "#DDE7E2";

function formatPrice(plan: SubscriptionPlan) {
  if (!plan.price) return "Free";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: plan.currency || "GBP",
    maximumFractionDigits: 0,
  }).format(plan.price);
}

function paidPlanId(plan: SubscriptionPlan): PaidSubscriptionPlan | null {
  if (!plan.price || plan.price <= 0 || plan.slug === "starter" || plan.slug === "free") return null;
  return plan.slug || plan.id;
}

export default function VendorWebSubscriptionPage() {
  const router = useRouter();
  const params = useLocalSearchParams<{ success?: string; cancelled?: string; email?: string }>();
  const { width } = useWindowDimensions();
  const isCompact = width < 760;
  const isWeb = Platform.OS === "web";

  const [email, setEmail] = useState(typeof params.email === "string" ? params.email : "");
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<PaidSubscriptionPlan>("growth");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;

    async function loadPlans() {
      setLoading(true);
      setError("");
      try {
        const result = await subscriptionService.getPlans();
        if (!alive) return;
        const paid = result.filter((plan) => paidPlanId(plan));
        setPlans(paid);
        const first = paid.map(paidPlanId).find(Boolean);
        if (first) setSelectedPlan(first);
      } catch (err) {
        if (!alive) return;
        setError(err instanceof Error ? err.message : "Could not load subscription plans.");
      } finally {
        if (alive) setLoading(false);
      }
    }

    loadPlans();
    return () => {
      alive = false;
    };
  }, []);

  const selectedPlanConfig = useMemo(
    () => plans.find((plan) => paidPlanId(plan) === selectedPlan),
    [plans, selectedPlan],
  );

  async function startCheckout() {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setError("Enter the email used by your Eki vendor account.");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const { checkoutUrl } = await subscriptionService.createWebCheckout(cleanEmail, selectedPlan);
      await Linking.openURL(checkoutUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start checkout. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!isWeb) {
    return (
      <View style={styles.nativeFallback}>
        <View style={styles.nativeIcon}>
          <Ionicons name="globe-outline" size={28} color={BRAND} />
        </View>
        <Text style={styles.nativeTitle}>Account status</Text>
        <Text style={styles.nativeText}>
          Your current vendor services and limits are shown in the app. Contact support for account changes.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.pageContent}>
      <View style={styles.nav}>
        <TouchableOpacity style={styles.logoButton} activeOpacity={0.85} onPress={() => router.replace("/")}>
          <Text style={styles.logo}>eki</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navLink} activeOpacity={0.85} onPress={() => router.replace("/")}>
          <Text style={styles.navLinkText}>Home</Text>
          <Ionicons name="arrow-forward" size={14} color={BRAND} />
        </TouchableOpacity>
      </View>

      <View style={[styles.hero, isCompact && styles.heroCompact]}>
        <View style={styles.heroCopy}>
          <Text style={styles.kicker}>Vendor Services</Text>
          <Text style={styles.title}>Manage your vendor account on the web.</Text>
          <Text style={styles.subtitle}>
            Enter the same email used for your Eki vendor account. After Stripe confirms payment, your vendor services,
            commission rules, limits, and tools update automatically.
          </Text>
          <View style={styles.note}>
            <Ionicons name="shield-checkmark-outline" size={18} color={BRAND} />
            <Text style={styles.noteText}>Vendor account billing is managed through the Business Portal.</Text>
          </View>
        </View>

        <View style={styles.checkoutPanel}>
          <Text style={styles.panelTitle}>Choose vendor services</Text>
          <Text style={styles.panelSubtitle}>Billing starts on Stripe after you confirm.</Text>

          {params.success === "true" ? (
            <View style={styles.successBanner}>
              <Ionicons name="checkmark-circle" size={18} color={BRAND} />
              <Text style={styles.successText}>Payment received. Open the app and refresh plan status.</Text>
            </View>
          ) : null}
          {params.cancelled === "true" ? (
            <View style={styles.warningBanner}>
              <Ionicons name="alert-circle-outline" size={18} color="#A15C00" />
              <Text style={styles.warningText}>Checkout was cancelled. You can start again when ready.</Text>
            </View>
          ) : null}

          <Text style={styles.label}>Vendor account email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="vendor@eki.app"
            placeholderTextColor="#97A39D"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
          />

          {loading ? (
            <View style={styles.loadingPlans}>
              <ActivityIndicator color={BRAND} />
            </View>
          ) : plans.length === 0 ? (
            <Text style={styles.errorText}>{error || "No paid plans are currently available."}</Text>
          ) : (
            <View style={styles.planList}>
              {plans.map((plan) => {
                const planId = paidPlanId(plan);
                if (!planId) return null;
                const active = selectedPlan === planId;
                return (
                  <TouchableOpacity
                    key={plan.id}
                    activeOpacity={0.88}
                    style={[styles.planCard, active && styles.planCardActive]}
                    onPress={() => setSelectedPlan(planId)}
                  >
                    <View style={styles.planTop}>
                      <View>
                        <Text style={styles.planName}>{plan.name}</Text>
                        <Text style={styles.planFee}>
                          {plan.platformFeePercent} platform fee / {plan.withdrawalFeePercent ?? "configured"} withdrawal fee
                        </Text>
                      </View>
                      <View style={[styles.radio, active && styles.radioActive]}>
                        {active ? <Ionicons name="checkmark" size={14} color="#FFFFFF" /> : null}
                      </View>
                    </View>
                    <Text style={styles.planPrice}>
                      {formatPrice(plan)} <Text style={styles.planInterval}>/ month</Text>
                    </Text>
                    <View style={styles.featureList}>
                      {plan.commissionTiers?.filter((tier) => tier.isActive !== false).slice(0, 3).map((tier) => (
                        <View key={tier.id ?? `${tier.minSubtotalCents}-${tier.platformFeeBps}`} style={styles.featureRow}>
                          <Ionicons name="pricetag-outline" size={15} color={BRAND} />
                          <Text style={styles.featureText}>
                            {tier.platformFeePercent} commission from {(tier.minSubtotalCents / 100).toLocaleString("en-GB", { style: "currency", currency: plan.currency || "GBP", maximumFractionDigits: 0 })}
                            {tier.maxSubtotalCents ? ` to ${(tier.maxSubtotalCents / 100).toLocaleString("en-GB", { style: "currency", currency: plan.currency || "GBP", maximumFractionDigits: 0 })}` : "+"}
                          </Text>
                        </View>
                      ))}
                      {plan.features.slice(0, 5).map((feature) => (
                        <View key={feature} style={styles.featureRow}>
                          <Ionicons name="checkmark-circle-outline" size={15} color={BRAND} />
                          <Text style={styles.featureText}>{feature}</Text>
                        </View>
                      ))}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {selectedPlanConfig ? (
            <View style={styles.summary}>
              <Text style={styles.summaryLabel}>Selected</Text>
              <Text style={styles.summaryValue}>
                {selectedPlanConfig.name} - {formatPrice(selectedPlanConfig)}/month
              </Text>
            </View>
          ) : null}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity
            activeOpacity={0.9}
            style={[styles.checkoutButton, (submitting || loading || plans.length === 0) && styles.checkoutButtonDisabled]}
            onPress={startCheckout}
            disabled={submitting || loading || plans.length === 0}
          >
            {submitting ? <ActivityIndicator color="#FFFFFF" size="small" /> : null}
            <Text style={styles.checkoutButtonText}>Continue to Stripe</Text>
            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#F7FAF8" },
  pageContent: { minHeight: "100%", paddingHorizontal: 24, paddingBottom: 48 },
  nav: {
    width: "100%",
    maxWidth: 1180,
    alignSelf: "center",
    paddingVertical: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  logoButton: { backgroundColor: BRAND, borderRadius: 8, paddingHorizontal: 18, paddingVertical: 8 },
  logo: { color: "#FFFFFF", fontFamily: "Manrope-ExtraBold", fontSize: 15, letterSpacing: 0 },
  navLink: { flexDirection: "row", alignItems: "center", gap: 6 },
  navLinkText: { color: BRAND, fontFamily: "Manrope-SemiBold", fontSize: 14 },
  hero: {
    width: "100%",
    maxWidth: 1180,
    alignSelf: "center",
    flexDirection: "row",
    gap: 28,
    alignItems: "stretch",
    paddingTop: 34,
  },
  heroCompact: { flexDirection: "column", paddingTop: 16 },
  heroCopy: {
    flex: 1,
    backgroundColor: DARK,
    borderRadius: 28,
    padding: 34,
    justifyContent: "center",
    minHeight: 520,
  },
  kicker: { color: "#9BE0BC", fontSize: 13, fontFamily: "Manrope-SemiBold", marginBottom: 12 },
  title: { color: "#FFFFFF", fontSize: 46, lineHeight: 52, fontFamily: "Manrope-ExtraBold", maxWidth: 560 },
  subtitle: { color: "rgba(255,255,255,0.78)", fontSize: 17, lineHeight: 26, fontFamily: "Outfit-Regular", marginTop: 18, maxWidth: 620 },
  note: {
    marginTop: 26,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderColor: "rgba(255,255,255,0.16)",
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  noteText: { flex: 1, color: "rgba(255,255,255,0.82)", fontSize: 14, lineHeight: 20, fontFamily: "Outfit-Regular" },
  checkoutPanel: {
    width: "100%",
    maxWidth: 430,
    backgroundColor: SURFACE,
    borderRadius: 28,
    padding: 24,
    borderWidth: 1,
    borderColor: BORDER,
    shadowColor: "#0A2B21",
    shadowOpacity: 0.08,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 14 },
  },
  panelTitle: { color: DARK, fontSize: 26, fontFamily: "Manrope-ExtraBold" },
  panelSubtitle: { color: MUTED, fontSize: 14, lineHeight: 20, fontFamily: "Outfit-Regular", marginTop: 6 },
  successBanner: {
    marginTop: 18,
    borderRadius: 12,
    backgroundColor: "#EAF8EF",
    borderWidth: 1,
    borderColor: "#CBEED9",
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  successText: { flex: 1, color: BRAND, fontSize: 13, lineHeight: 18, fontFamily: "Outfit-Regular" },
  warningBanner: {
    marginTop: 18,
    borderRadius: 12,
    backgroundColor: "#FFF7E8",
    borderWidth: 1,
    borderColor: "#F2D399",
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  warningText: { flex: 1, color: "#A15C00", fontSize: 13, lineHeight: 18, fontFamily: "Outfit-Regular" },
  label: { marginTop: 20, color: DARK, fontSize: 13, fontFamily: "Manrope-SemiBold" },
  input: {
    marginTop: 8,
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    color: DARK,
    fontFamily: "Outfit-Regular",
    fontSize: 15,
  },
  loadingPlans: { paddingVertical: 30, alignItems: "center" },
  planList: { marginTop: 16, gap: 12 },
  planCard: { borderRadius: 18, borderWidth: 1, borderColor: BORDER, backgroundColor: "#FFFFFF", padding: 16 },
  planCardActive: { borderColor: BRAND, backgroundColor: "#F1FAF5" },
  planTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  planName: { color: DARK, fontSize: 18, fontFamily: "Manrope-Bold" },
  planFee: { color: MUTED, fontSize: 12, fontFamily: "Outfit-Regular", marginTop: 4 },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 1, borderColor: "#B7C6BF", alignItems: "center", justifyContent: "center" },
  radioActive: { backgroundColor: BRAND, borderColor: BRAND },
  planPrice: { marginTop: 14, color: BRAND, fontSize: 28, fontFamily: "Manrope-ExtraBold" },
  planInterval: { color: MUTED, fontSize: 13, fontFamily: "Outfit-Regular" },
  featureList: { marginTop: 12, gap: 7 },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  featureText: { flex: 1, color: "#34423C", fontSize: 13, lineHeight: 18, fontFamily: "Outfit-Regular" },
  summary: { marginTop: 18, borderRadius: 14, backgroundColor: "#F6F8F7", padding: 14 },
  summaryLabel: { color: MUTED, fontSize: 12, fontFamily: "Outfit-Regular" },
  summaryValue: { color: DARK, fontSize: 15, fontFamily: "Manrope-Bold", marginTop: 4 },
  errorText: { color: "#C33A3A", fontSize: 13, lineHeight: 18, fontFamily: "Outfit-Regular", marginTop: 12 },
  checkoutButton: {
    minHeight: 56,
    borderRadius: 16,
    backgroundColor: BRAND,
    marginTop: 18,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  checkoutButtonDisabled: { opacity: 0.65 },
  checkoutButtonText: { color: "#FFFFFF", fontSize: 16, fontFamily: "Manrope-Bold" },
  nativeFallback: { flex: 1, backgroundColor: "#F7FAF8", alignItems: "center", justifyContent: "center", padding: 26 },
  nativeIcon: { width: 64, height: 64, borderRadius: 22, backgroundColor: "#E7F4ED", alignItems: "center", justifyContent: "center" },
  nativeTitle: { marginTop: 18, color: DARK, fontSize: 23, fontFamily: "Manrope-Bold", textAlign: "center" },
  nativeText: { marginTop: 10, color: MUTED, fontSize: 14, lineHeight: 22, fontFamily: "Outfit-Regular", textAlign: "center", maxWidth: 360 },
});
