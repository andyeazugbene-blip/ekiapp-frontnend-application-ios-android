import React, { useCallback, useEffect, useMemo, useState } from "react";
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
  type ActiveSubscription,
  type PaidSubscriptionPlan,
  type SubscriptionLimits,
  type SubscriptionPlan,
} from "../services/subscriptionService";

const BRAND = "#076B51";
const DARK = "#0D1B16";
const MUTED = "#66736D";
const SURFACE = "#FFFFFF";
const BORDER = "#DDE7E2";
const BG = "#F7FAF8";

type PortalView = "dashboard" | "manage-service" | "billing" | "help";

interface NavItem {
  key: PortalView;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  section?: string;
}

const NAV_ITEMS: NavItem[] = [
  { key: "dashboard", label: "Dashboard", icon: "grid-outline", section: "Vendor Account" },
  { key: "manage-service", label: "Manage Service", icon: "swap-horizontal-outline", section: "Billing & Services" },
  { key: "billing", label: "Billing & Invoices", icon: "receipt-outline", section: "Billing & Services" },
  { key: "help", label: "Help & Support", icon: "help-circle-outline" },
];

function formatPrice(plan: SubscriptionPlan) {
  if (!plan.price) return "Free";
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: plan.currency || "GBP", maximumFractionDigits: 0 }).format(plan.price);
}

function paidPlanId(plan: SubscriptionPlan): PaidSubscriptionPlan | null {
  if (!plan.price || plan.price <= 0 || plan.slug === "starter" || plan.slug === "free") return null;
  return plan.slug || plan.id;
}

function InfoRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={s.infoRow}>
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={[s.infoValue, accent && { color: BRAND }]}>{value}</Text>
    </View>
  );
}

function SectionCard({ title, children, icon }: { title: string; children: React.ReactNode; icon?: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={s.sectionCard}>
      <View style={s.sectionHeader}>
        {icon && <Ionicons name={icon} size={18} color={BRAND} />}
        <Text style={s.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function StatusDot({ color }: { color: string }) {
  return <View style={[s.statusDot, { backgroundColor: color }]} />;
}

// ═══════════════════════════════════════
// DASHBOARD VIEW
// ═══════════════════════════════════════

function DashboardView({ subscription, limits, plans, email }: {
  subscription: ActiveSubscription | null;
  limits: SubscriptionLimits | null;
  plans: SubscriptionPlan[];
  email: string;
}) {
  const currentPlan = plans.find(p => p.slug === subscription?.slug || p.id === subscription?.planId);
  const renewalDate = subscription?.currentPeriodEnd
    ? new Date(subscription.currentPeriodEnd).toLocaleDateString("en-GB", { month: "long", day: "numeric", year: "numeric" })
    : "—";
  const isActive = subscription?.status === "active";

  return (
    <View style={s.viewContainer}>
      <Text style={s.viewTitle}>Vendor Account</Text>
      <Text style={s.viewSubtitle}>Overview of your business account and current service.</Text>

      <View style={s.cardGrid}>
        <SectionCard title="Account Status" icon="person-circle-outline">
          <InfoRow label="Account Email" value={email || "Not set"} />
          <InfoRow label="Account Status" value={isActive ? "Active" : "Inactive"} accent={isActive} />
          <InfoRow label="Store Status" value={isActive ? "Published" : "Unpublished"} />
          <InfoRow label="Verification" value="Managed in App" />
        </SectionCard>

        <SectionCard title="Current Service" icon="layers-outline">
          <InfoRow label="Plan" value={currentPlan?.name ?? subscription?.planName ?? "Starter"} accent />
          <InfoRow label="Platform Fee" value={subscription?.platformFeePercent ?? limits?.platformFeePercent ?? "—"} />
          <InfoRow label="Withdrawal Fee" value={subscription?.withdrawalFeePercent ?? limits?.withdrawalFeePercent ?? "—"} />
          <InfoRow label="Renewal Date" value={renewalDate} />
          {subscription?.cancelAtPeriodEnd && (
            <View style={s.warningBanner}>
              <Ionicons name="alert-circle-outline" size={16} color="#A15C00" />
              <Text style={s.warningText}>Cancels at period end</Text>
            </View>
          )}
        </SectionCard>

        <SectionCard title="Current Limits" icon="speedometer-outline">
          <InfoRow label="Products" value={`${limits?.currentProducts ?? 0} / ${limits?.maxProducts === Number.MAX_SAFE_INTEGER ? "Unlimited" : limits?.maxProducts ?? 0}`} />
          <InfoRow label="Orders" value={limits?.maxOrders ? `${limits.currentOrders} / ${limits.maxOrders}` : `${limits?.currentOrders ?? 0} / Unlimited`} />
          <InfoRow label="Remaining Orders" value={limits?.ordersRemaining != null ? String(limits.ordersRemaining) : "Unlimited"} />
          <InfoRow label="Can Receive Orders" value={limits?.canReceiveOrders ? "Yes" : "No"} accent={limits?.canReceiveOrders} />
        </SectionCard>

        <SectionCard title="Usage & Features" icon="analytics-outline">
          <InfoRow label="Analytics" value={limits?.canAccessAnalytics ? "Enabled" : "Disabled"} accent={limits?.canAccessAnalytics} />
          <InfoRow label="Discount Campaigns" value={limits?.discounts ? "Enabled" : "Disabled"} accent={limits?.discounts} />
          <InfoRow label="Flash Sales" value={limits?.flashSales ? "Enabled" : "Disabled"} accent={limits?.flashSales} />
          <InfoRow label="Marketing Tools" value={limits?.marketingTools ? "Enabled" : "Disabled"} accent={limits?.marketingTools} />
          <InfoRow label="Bundle Deals" value={limits?.bundles ? "Enabled" : "Disabled"} accent={limits?.bundles} />
        </SectionCard>
      </View>
    </View>
  );
}

// ═══════════════════════════════════════
// MANAGE SERVICE VIEW
// ═══════════════════════════════════════

function ManageServiceView({ plans, email, subscription, onEmailChange }: {
  plans: SubscriptionPlan[];
  email: string;
  subscription: ActiveSubscription | null;
  onEmailChange: (e: string) => void;
}) {
  const [selectedPlan, setSelectedPlan] = useState<PaidSubscriptionPlan>(subscription?.slug ?? "growth");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const params = useLocalSearchParams<{ success?: string; cancelled?: string }>();

  const selectedPlanConfig = useMemo(
    () => plans.find(p => paidPlanId(p) === selectedPlan),
    [plans, selectedPlan],
  );

  async function handleContinue() {
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

  return (
    <View style={s.viewContainer}>
      <View style={s.breadcrumb}>
        <Text style={s.breadcrumbText}>Billing & Services</Text>
        <Ionicons name="chevron-forward" size={14} color={MUTED} />
        <Text style={s.breadcrumbActive}>Manage Service</Text>
      </View>

      <Text style={s.viewTitle}>Select Your Service</Text>
      <Text style={s.viewSubtitle}>Select the service that best matches your business.</Text>

      {params.success === "true" && (
        <View style={s.successBanner}>
          <Ionicons name="checkmark-circle" size={18} color={BRAND} />
          <Text style={s.successText}>Payment received. Open the app and refresh your account status.</Text>
        </View>
      )}
      {params.cancelled === "true" && (
        <View style={s.warningBanner}>
          <Ionicons name="alert-circle-outline" size={18} color="#A15C00" />
          <Text style={s.warningText}>Checkout was cancelled. You can try again when ready.</Text>
        </View>
      )}

      <View style={s.emailSection}>
        <Text style={s.fieldLabel}>Vendor account email</Text>
        <TextInput
          value={email}
          onChangeText={onEmailChange}
          placeholder="vendor@business.com"
          placeholderTextColor="#97A39D"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          style={s.input}
        />
      </View>

      <View style={s.planGrid}>
        {plans.map(plan => {
          const planId = paidPlanId(plan);
          if (!planId) return null;
          const active = selectedPlan === planId;
          return (
            <TouchableOpacity
              key={plan.id}
              activeOpacity={0.88}
              style={[s.planCard, active && s.planCardActive]}
              onPress={() => setSelectedPlan(planId)}
            >
              <View style={s.planTop}>
                <View style={{ flex: 1 }}>
                  <Text style={s.planName}>{plan.name}</Text>
                  <Text style={s.planFee}>
                    {plan.platformFeePercent} platform fee · {plan.withdrawalFeePercent ?? "—"} withdrawal
                  </Text>
                </View>
                <View style={[s.radio, active && s.radioActive]}>
                  {active && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                </View>
              </View>
              <Text style={s.planPrice}>
                {formatPrice(plan)} <Text style={s.planInterval}>/ month</Text>
              </Text>
              <View style={s.featureList}>
                {plan.commissionTiers?.filter(t => t.isActive !== false).slice(0, 3).map(tier => (
                  <View key={tier.id ?? `${tier.minSubtotalCents}-${tier.platformFeeBps}`} style={s.featureRow}>
                    <Ionicons name="pricetag-outline" size={14} color={BRAND} />
                    <Text style={s.featureText}>
                      {tier.platformFeePercent} from {(tier.minSubtotalCents / 100).toLocaleString("en-GB", { style: "currency", currency: plan.currency || "GBP", maximumFractionDigits: 0 })}
                      {tier.maxSubtotalCents ? ` to ${(tier.maxSubtotalCents / 100).toLocaleString("en-GB", { style: "currency", currency: plan.currency || "GBP", maximumFractionDigits: 0 })}` : "+"}
                    </Text>
                  </View>
                ))}
                {plan.features.slice(0, 5).map(f => (
                  <View key={f} style={s.featureRow}>
                    <Ionicons name="checkmark-circle-outline" size={14} color={BRAND} />
                    <Text style={s.featureText}>{f}</Text>
                  </View>
                ))}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {selectedPlanConfig && (
        <View style={s.summary}>
          <Text style={s.summaryLabel}>Selected service</Text>
          <Text style={s.summaryValue}>{selectedPlanConfig.name} — {formatPrice(selectedPlanConfig)}/month</Text>
        </View>
      )}

      {error ? <Text style={s.errorText}>{error}</Text> : null}

      <TouchableOpacity
        activeOpacity={0.9}
        style={[s.ctaButton, (submitting || plans.length === 0) && s.ctaButtonDisabled]}
        onPress={handleContinue}
        disabled={submitting || plans.length === 0}
      >
        {submitting && <ActivityIndicator color="#FFFFFF" size="small" />}
        <Text style={s.ctaButtonText}>Continue</Text>
        <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
      </TouchableOpacity>

      <View style={s.securityNote}>
        <Ionicons name="shield-checkmark-outline" size={16} color={BRAND} />
        <Text style={s.securityText}>Billing is managed securely through your Vendor Account.</Text>
      </View>
    </View>
  );
}

// ═══════════════════════════════════════
// BILLING VIEW
// ═══════════════════════════════════════

function BillingView({ subscription }: { subscription: ActiveSubscription | null }) {
  const renewalDate = subscription?.currentPeriodEnd
    ? new Date(subscription.currentPeriodEnd).toLocaleDateString("en-GB", { month: "long", day: "numeric", year: "numeric" })
    : "—";

  return (
    <View style={s.viewContainer}>
      <Text style={s.viewTitle}>Billing & Invoices</Text>
      <Text style={s.viewSubtitle}>View your billing information, invoices, and payment history.</Text>

      <View style={s.cardGrid}>
        <SectionCard title="Payment Method" icon="card-outline">
          <InfoRow label="Provider" value="Stripe" />
          <InfoRow label="Status" value={subscription ? "Active" : "No active service"} accent={!!subscription} />
          <View style={s.noteBox}>
            <Text style={s.noteBoxText}>Payment methods are managed through Stripe. Changes to your card or billing details can be made during checkout.</Text>
          </View>
        </SectionCard>

        <SectionCard title="Current Billing" icon="calendar-outline">
          <InfoRow label="Service" value={subscription?.planName ?? "Starter (Free)"} />
          <InfoRow label="Status" value={subscription?.status === "active" ? "Active" : (subscription?.status ?? "Inactive")} accent={subscription?.status === "active"} />
          <InfoRow label="Next Renewal" value={renewalDate} />
          <InfoRow label="Cancellation" value={subscription?.cancelAtPeriodEnd ? "Scheduled" : "None"} />
        </SectionCard>

        <SectionCard title="Billing History" icon="time-outline">
          <View style={s.emptyState}>
            <Ionicons name="document-text-outline" size={32} color="#C8D5CE" />
            <Text style={s.emptyTitle}>No billing history available</Text>
            <Text style={s.emptyText}>Your transaction history will appear here once billing activity is recorded through Stripe.</Text>
          </View>
        </SectionCard>

        <SectionCard title="Invoices & Receipts" icon="receipt-outline">
          <View style={s.emptyState}>
            <Ionicons name="folder-open-outline" size={32} color="#C8D5CE" />
            <Text style={s.emptyTitle}>No invoices yet</Text>
            <Text style={s.emptyText}>Invoices and receipts from Stripe will be listed here as they become available.</Text>
          </View>
        </SectionCard>

        <SectionCard title="Tax Information" icon="document-outline">
          <View style={s.noteBox}>
            <Text style={s.noteBoxText}>Tax documentation and business details are managed through your Stripe billing profile. Contact support if you need assistance with VAT or tax-related queries.</Text>
          </View>
        </SectionCard>
      </View>
    </View>
  );
}

// ═══════════════════════════════════════
// HELP VIEW
// ═══════════════════════════════════════

function HelpView() {
  return (
    <View style={s.viewContainer}>
      <Text style={s.viewTitle}>Help & Support</Text>
      <Text style={s.viewSubtitle}>Get help with your vendor account and services.</Text>

      <View style={s.cardGrid}>
        <SectionCard title="Frequently Asked Questions" icon="chatbubble-ellipses-outline">
          {[
            { q: "How do I change my service?", a: "Go to Manage Service from the sidebar to view available services and select a different plan." },
            { q: "How is billing handled?", a: "All billing is processed securely through Stripe. Your payment details are never stored on our servers." },
            { q: "Can I cancel my service?", a: "You can manage your subscription through Stripe. Your service remains active until the end of the current billing period." },
            { q: "What happens when I reach my limits?", a: "You will be notified in the app when approaching limits. You can upgrade your service at any time to increase your capacity." },
          ].map((item, i) => (
            <View key={i} style={s.faqItem}>
              <Text style={s.faqQ}>{item.q}</Text>
              <Text style={s.faqA}>{item.a}</Text>
            </View>
          ))}
        </SectionCard>

        <SectionCard title="Contact Support" icon="mail-outline">
          <View style={s.noteBox}>
            <Text style={s.noteBoxText}>For account issues, billing questions, or technical support, please contact us through the Eki app or email support. Our team typically responds within 24 hours.</Text>
          </View>
        </SectionCard>

        <SectionCard title="Business Details" icon="business-outline">
          <View style={s.noteBox}>
            <Text style={s.noteBoxText}>Your store information, business documents, and verification status are managed through the Eki vendor app. Open the app to update your business profile.</Text>
          </View>
        </SectionCard>
      </View>
    </View>
  );
}

// ═══════════════════════════════════════
// MAIN PORTAL
// ═══════════════════════════════════════

export default function BusinessPortalPage() {
  const router = useRouter();
  const params = useLocalSearchParams<{ success?: string; cancelled?: string; email?: string }>();
  const { width } = useWindowDimensions();
  const isCompact = width < 860;
  const isWeb = Platform.OS === "web";

  const [activeView, setActiveView] = useState<PortalView>("dashboard");
  const [email, setEmail] = useState(typeof params.email === "string" ? params.email : "");
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [allPlans, setAllPlans] = useState<SubscriptionPlan[]>([]);
  const [subscription, setSubscription] = useState<ActiveSubscription | null>(null);
  const [limits, setLimits] = useState<SubscriptionLimits | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (params.success === "true" || params.cancelled === "true") {
      setActiveView("manage-service");
    }
  }, [params.success, params.cancelled]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await subscriptionService.getPlans();
      setAllPlans(result);
      setPlans(result.filter(p => paidPlanId(p)));

      try {
        const sub = await subscriptionService.getCurrentSubscription();
        setSubscription(sub);
      } catch { /* unauthenticated — expected for web portal */ }

      try {
        const lim = await subscriptionService.getLimits();
        setLimits(lim);
      } catch { /* unauthenticated */ }
    } catch { /* plan loading failed silently */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  if (!isWeb) {
    return (
      <View style={s.nativeFallback}>
        <View style={s.nativeIcon}>
          <Ionicons name="globe-outline" size={28} color={BRAND} />
        </View>
        <Text style={s.nativeTitle}>Business Portal</Text>
        <Text style={s.nativeText}>
          Your vendor account and services are managed through the Business Portal on the web. Open culinarytales.app/business-portal in your browser.
        </Text>
      </View>
    );
  }

  const sections = NAV_ITEMS.reduce<{ label: string; items: NavItem[] }[]>((acc, item) => {
    const sectionLabel = item.section ?? "General";
    const existing = acc.find(g => g.label === sectionLabel);
    if (existing) existing.items.push(item);
    else acc.push({ label: sectionLabel, items: [item] });
    return acc;
  }, []);

  return (
    <View style={s.portalRoot}>
      {/* Sidebar */}
      {(isCompact && mobileMenuOpen) && (
        <TouchableOpacity
          style={s.overlay}
          activeOpacity={1}
          onPress={() => setMobileMenuOpen(false)}
        />
      )}

      <View style={[
        s.sidebar,
        isCompact && s.sidebarMobile,
        isCompact && !mobileMenuOpen && s.sidebarHidden,
      ]}>
        <View style={s.sidebarHeader}>
          <TouchableOpacity style={s.logoButton} activeOpacity={0.85} onPress={() => setActiveView("dashboard")}>
            <Text style={s.logo}>eki</Text>
          </TouchableOpacity>
          <Text style={s.portalLabel}>Business Portal</Text>
        </View>

        <ScrollView style={s.sidebarNav} showsVerticalScrollIndicator={false}>
          {sections.map(section => (
            <View key={section.label} style={s.navSection}>
              <Text style={s.navSectionLabel}>{section.label}</Text>
              {section.items.map(item => {
                const active = activeView === item.key;
                return (
                  <TouchableOpacity
                    key={item.key}
                    style={[s.navItem, active && s.navItemActive]}
                    activeOpacity={0.85}
                    onPress={() => { setActiveView(item.key); setMobileMenuOpen(false); }}
                  >
                    <Ionicons name={item.icon} size={18} color={active ? BRAND : MUTED} />
                    <Text style={[s.navItemText, active && s.navItemTextActive]}>{item.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </ScrollView>

        <View style={s.sidebarFooter}>
          <View style={s.statusRow}>
            <StatusDot color={subscription?.status === "active" ? "#34D399" : "#FCD34D"} />
            <Text style={s.statusText}>{subscription?.status === "active" ? "Service Active" : "No Active Service"}</Text>
          </View>
          <TouchableOpacity style={s.homeLink} activeOpacity={0.85} onPress={() => router.replace("/")}>
            <Ionicons name="arrow-back" size={14} color={MUTED} />
            <Text style={s.homeLinkText}>Back to Eki</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Content */}
      <View style={[s.mainContent, !isCompact && { marginLeft: 260 }]}>
        {/* Top bar (mobile) */}
        {isCompact && (
          <View style={s.topBar}>
            <TouchableOpacity style={s.menuBtn} activeOpacity={0.85} onPress={() => setMobileMenuOpen(true)}>
              <Ionicons name="menu" size={22} color={DARK} />
            </TouchableOpacity>
            <Text style={s.topBarTitle}>Business Portal</Text>
            <View style={{ width: 36 }} />
          </View>
        )}

        <ScrollView style={s.scrollContent} contentContainerStyle={s.scrollInner} showsVerticalScrollIndicator={false}>
          {loading ? (
            <View style={s.loadingContainer}>
              <ActivityIndicator color={BRAND} size="large" />
              <Text style={s.loadingText}>Loading your account...</Text>
            </View>
          ) : (
            <>
              {activeView === "dashboard" && (
                <DashboardView subscription={subscription} limits={limits} plans={allPlans} email={email} />
              )}
              {activeView === "manage-service" && (
                <ManageServiceView plans={plans} email={email} subscription={subscription} onEmailChange={setEmail} />
              )}
              {activeView === "billing" && <BillingView subscription={subscription} />}
              {activeView === "help" && <HelpView />}
            </>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  portalRoot: { flex: 1, flexDirection: "row", backgroundColor: BG, minHeight: "100%" as any },

  // Overlay
  overlay: { position: "absolute" as any, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.3)", zIndex: 90 },

  // Sidebar
  sidebar: {
    width: 260, position: "fixed" as any, top: 0, left: 0, bottom: 0, backgroundColor: SURFACE,
    borderRightWidth: 1, borderRightColor: BORDER, zIndex: 100,
  },
  sidebarMobile: { position: "absolute" as any },
  sidebarHidden: { transform: [{ translateX: -280 }] },
  sidebarHeader: { paddingHorizontal: 22, paddingTop: 28, paddingBottom: 18, borderBottomWidth: 1, borderBottomColor: BORDER },
  logoButton: { backgroundColor: BRAND, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 7, alignSelf: "flex-start" },
  logo: { color: "#FFFFFF", fontWeight: "800", fontSize: 15 },
  portalLabel: { marginTop: 12, color: DARK, fontSize: 13, fontWeight: "700", letterSpacing: -0.2 },
  sidebarNav: { flex: 1, paddingTop: 8 },
  navSection: { paddingHorizontal: 14, marginBottom: 4 },
  navSectionLabel: { color: MUTED, fontSize: 10, fontWeight: "700", textTransform: "uppercase" as any, letterSpacing: 0.8, paddingHorizontal: 10, paddingTop: 14, paddingBottom: 6 },
  navItem: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 10, paddingVertical: 9, borderRadius: 10, marginBottom: 2 },
  navItemActive: { backgroundColor: "#EFF8F3" },
  navItemText: { color: MUTED, fontSize: 13, fontWeight: "500" },
  navItemTextActive: { color: BRAND, fontWeight: "600" },
  sidebarFooter: { paddingHorizontal: 22, paddingVertical: 18, borderTopWidth: 1, borderTopColor: BORDER },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { color: MUTED, fontSize: 12, fontWeight: "500" },
  homeLink: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12 },
  homeLinkText: { color: MUTED, fontSize: 12, fontWeight: "500" },

  // Main
  mainContent: { flex: 1, minHeight: "100%" as any },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: BORDER, backgroundColor: SURFACE },
  menuBtn: { width: 36, height: 36, borderRadius: 10, borderWidth: 1, borderColor: BORDER, alignItems: "center", justifyContent: "center" },
  topBarTitle: { color: DARK, fontSize: 15, fontWeight: "700" },
  scrollContent: { flex: 1 },
  scrollInner: { padding: 28, maxWidth: 1100, alignSelf: "center" as any, width: "100%" },

  // Views
  viewContainer: { gap: 20 },
  viewTitle: { color: DARK, fontSize: 28, fontWeight: "800", letterSpacing: -0.5 },
  viewSubtitle: { color: MUTED, fontSize: 15, lineHeight: 22, marginTop: -8 },
  breadcrumb: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: -8 },
  breadcrumbText: { color: MUTED, fontSize: 12, fontWeight: "500" },
  breadcrumbActive: { color: BRAND, fontSize: 12, fontWeight: "600" },

  // Cards
  cardGrid: { gap: 16 },
  sectionCard: { backgroundColor: SURFACE, borderRadius: 18, borderWidth: 1, borderColor: BORDER, padding: 22 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 },
  sectionTitle: { color: DARK, fontSize: 16, fontWeight: "700" },
  infoRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#F2F5F3" },
  infoLabel: { color: MUTED, fontSize: 13 },
  infoValue: { color: DARK, fontSize: 13, fontWeight: "600" },

  // Plan cards
  emailSection: { marginBottom: 4 },
  fieldLabel: { color: DARK, fontSize: 13, fontWeight: "600", marginBottom: 8 },
  input: { minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: BORDER, backgroundColor: SURFACE, paddingHorizontal: 14, color: DARK, fontSize: 15 },
  planGrid: { gap: 14 },
  planCard: { borderRadius: 16, borderWidth: 1, borderColor: BORDER, backgroundColor: SURFACE, padding: 18 },
  planCardActive: { borderColor: BRAND, backgroundColor: "#F1FAF5" },
  planTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  planName: { color: DARK, fontSize: 18, fontWeight: "700" },
  planFee: { color: MUTED, fontSize: 12, marginTop: 3 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 1, borderColor: "#B7C6BF", alignItems: "center", justifyContent: "center" },
  radioActive: { backgroundColor: BRAND, borderColor: BRAND },
  planPrice: { marginTop: 12, color: BRAND, fontSize: 26, fontWeight: "800" },
  planInterval: { color: MUTED, fontSize: 13, fontWeight: "400" },
  featureList: { marginTop: 12, gap: 6 },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  featureText: { flex: 1, color: "#34423C", fontSize: 13, lineHeight: 18 },
  summary: { borderRadius: 14, backgroundColor: "#F6F8F7", padding: 14 },
  summaryLabel: { color: MUTED, fontSize: 12 },
  summaryValue: { color: DARK, fontSize: 15, fontWeight: "700", marginTop: 3 },

  // CTA
  ctaButton: { minHeight: 52, borderRadius: 14, backgroundColor: BRAND, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
  ctaButtonDisabled: { opacity: 0.6 },
  ctaButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  securityNote: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#F1FAF5", borderRadius: 12, padding: 14 },
  securityText: { flex: 1, color: BRAND, fontSize: 13, lineHeight: 18 },

  // Banners
  successBanner: { borderRadius: 12, backgroundColor: "#EAF8EF", borderWidth: 1, borderColor: "#CBEED9", padding: 12, flexDirection: "row", alignItems: "center", gap: 8 },
  successText: { flex: 1, color: BRAND, fontSize: 13, lineHeight: 18 },
  warningBanner: { borderRadius: 12, backgroundColor: "#FFF7E8", borderWidth: 1, borderColor: "#F2D399", padding: 12, flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  warningText: { flex: 1, color: "#A15C00", fontSize: 13, lineHeight: 18 },

  // Empty / Note
  noteBox: { backgroundColor: "#F6F8F7", borderRadius: 12, padding: 14, marginTop: 8 },
  noteBoxText: { color: MUTED, fontSize: 13, lineHeight: 20 },
  emptyState: { alignItems: "center", paddingVertical: 28, gap: 8 },
  emptyTitle: { color: DARK, fontSize: 14, fontWeight: "600" },
  emptyText: { color: MUTED, fontSize: 13, lineHeight: 20, textAlign: "center" as any, maxWidth: 320 },

  // FAQ
  faqItem: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#F2F5F3" },
  faqQ: { color: DARK, fontSize: 14, fontWeight: "600" },
  faqA: { color: MUTED, fontSize: 13, lineHeight: 20, marginTop: 4 },

  // States
  errorText: { color: "#C33A3A", fontSize: 13, lineHeight: 18 },
  loadingContainer: { alignItems: "center", justifyContent: "center", paddingVertical: 80, gap: 16 },
  loadingText: { color: MUTED, fontSize: 14 },
  nativeFallback: { flex: 1, backgroundColor: BG, alignItems: "center", justifyContent: "center", padding: 26 },
  nativeIcon: { width: 64, height: 64, borderRadius: 22, backgroundColor: "#E7F4ED", alignItems: "center", justifyContent: "center" },
  nativeTitle: { marginTop: 18, color: DARK, fontSize: 23, fontWeight: "700", textAlign: "center" as any },
  nativeText: { marginTop: 10, color: MUTED, fontSize: 14, lineHeight: 22, textAlign: "center" as any, maxWidth: 360 },
});
