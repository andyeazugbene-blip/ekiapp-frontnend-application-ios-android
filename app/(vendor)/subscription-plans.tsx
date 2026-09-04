import React, { useCallback, useState } from "react";
import { ActivityIndicator, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { vendorService } from "../../services/vendorService";
import { goBackOrReplace } from "../../utils/navigation";

const BUSINESS_PORTAL_URL = "https://culinarytales.app/business-portal";

type VendorAccount = Awaited<ReturnType<typeof vendorService.getVendorAccount>>;

function statusColor(status: string): string {
  switch (status) {
    case "active":
    case "open":
    case "verified":
      return "#076B51";
    case "pending":
    case "pending_docs":
    case "under_review":
    case "setup":
      return "#D97706";
    case "suspended":
    case "rejected":
    case "closed":
    case "inactive":
      return "#FB6363";
    default:
      return "#858585";
  }
}

function statusLabel(status: string): string {
  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatLimit(value: number | null): string {
  if (value === null || value === -1) return "Unlimited";
  return String(value);
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default function VendorAccountScreen() {
  const router = useRouter();
  const [account, setAccount] = useState<VendorAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadAccount = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await vendorService.getVendorAccount();
      setAccount(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load vendor account.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadAccount();
    }, [loadAccount])
  );

  const openBusinessPortal = () => {
    Linking.openURL(BUSINESS_PORTAL_URL);
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => goBackOrReplace(router, "/(vendor)/settings" as any)} activeOpacity={0.85} accessibilityLabel="Go back" accessibilityRole="button" style={styles.backButton}>
          <Ionicons name="chevron-back" size={22} color="#282828" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Vendor Account</Text>
          <Text style={styles.headerSubtitle}>Account status, limits, and business details</Text>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.placeholder}>
            <ActivityIndicator color="#076B51" />
          </View>
        ) : error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : account ? (
          <>
            {/* ── Status Overview ──────────────────────────────── */}
            <View style={styles.statusCard}>
              <Text style={styles.cardLabel}>ACCOUNT OVERVIEW</Text>
              <View style={styles.statusGrid}>
                <StatusTile label="Vendor Status" value={statusLabel(account.vendorStatus)} color={statusColor(account.vendorStatus)} />
                <StatusTile label="Store Status" value={statusLabel(account.storeStatus)} color={statusColor(account.storeStatus)} />
                <StatusTile label="Verification" value={statusLabel(account.verificationStatus)} color={statusColor(account.verificationStatus)} />
                <StatusTile label="Account Status" value={statusLabel(account.accountStatus)} color={statusColor(account.accountStatus)} />
              </View>
            </View>

            {/* ── Vendor Services ──────────────────────────────── */}
            <View style={styles.sectionCard}>
              <Text style={styles.cardLabel}>VENDOR SERVICES</Text>
              <View style={styles.serviceRow}>
                <View style={styles.serviceIcon}>
                  <Ionicons name="briefcase-outline" size={20} color="#076B51" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.serviceName}>{account.serviceName}</Text>
                  <Text style={styles.serviceLevel}>Service Level: {account.serviceLevel}</Text>
                </View>
                <View style={[styles.activeBadge, account.accountStatus !== "active" && styles.inactiveBadge]}>
                  <Text style={[styles.activeBadgeText, account.accountStatus !== "active" && styles.inactiveBadgeText]}>
                    {account.accountStatus === "active" ? "Active" : "Inactive"}
                  </Text>
                </View>
              </View>
              {account.platformFeePercent ? (
                <View style={styles.renewalRow}>
                  <Ionicons name="cash-outline" size={14} color="#858585" />
                  <Text style={styles.renewalText}>Platform Fee: {account.platformFeePercent}</Text>
                </View>
              ) : null}
              <View style={styles.renewalRow}>
                <Ionicons name="calendar-outline" size={14} color="#858585" />
                <Text style={styles.renewalText}>Renewal Date: {formatDate(account.renewalDate)}</Text>
              </View>
              <View style={styles.renewalRow}>
                <Ionicons name="sync-outline" size={14} color="#858585" />
                <Text style={styles.renewalText}>Last Sync: {formatDate(account.lastSync)}</Text>
              </View>
            </View>

            {/* ── Current Limits ───────────────────────────────── */}
            <View style={styles.sectionCard}>
              <Text style={styles.cardLabel}>CURRENT LIMITS</Text>
              <LimitRow label="Products" current={account.limits.currentProducts} max={account.limits.maxProducts} />
              <LimitRow label="Orders" current={account.limits.currentOrders} max={account.limits.maxOrders} />
              {account.limits.ordersRemaining !== null ? (
                <View style={styles.remainingPill}>
                  <Ionicons name="alert-circle-outline" size={14} color={account.limits.ordersRemaining <= 5 ? "#FB6363" : "#D97706"} />
                  <Text style={[styles.remainingText, account.limits.ordersRemaining <= 5 && { color: "#FB6363" }]}>
                    {account.limits.ordersRemaining} orders remaining
                  </Text>
                </View>
              ) : null}
              <LimitRow label="Coupons" current={account.limits.currentCoupons} max={account.limits.maxCoupons} />
              <LimitRow label="Bundles" current={0} max={account.limits.maxBundles ?? null} />
            </View>

            {/* ── Store Capabilities ──────────────────────────── */}
            <View style={styles.sectionCard}>
              <Text style={styles.cardLabel}>ENABLED SERVICES</Text>
              {account.features ? (
                <>
                  <FeatureRow label="Order Management" enabled={account.features.canReceiveOrders} />
                  <FeatureRow label="Customer Database" enabled={account.features.customerDatabase} />
                  <FeatureRow label="Repeat Buyer Marketing" enabled={account.features.repeatBuyerMarketing} />
                  <FeatureRow label="Sales Analytics" enabled={account.features.analytics} />
                  <FeatureRow label="Flash Sales" enabled={account.features.flashSales} />
                  <FeatureRow label="Product Bundles" enabled={account.features.bundles} />
                  <FeatureRow label="Professional Storefront" enabled={account.features.professionalStorefront} />
                  <FeatureRow label="Store Link Sharing" enabled={account.features.storeLinkSharing} />
                  <FeatureRow label="Discount Campaigns" enabled={account.features.discounts} />
                  <FeatureRow label="Marketing Tools" enabled={account.features.marketingTools} />
                  <FeatureRow label="Priority Support" enabled={account.features.prioritySupport} />
                </>
              ) : (
                <>
                  <FeatureRow label="Receive Orders" enabled={account.limits.canReceiveOrders} />
                  <FeatureRow label="Analytics" enabled={account.limits.canAccessAnalytics} />
                  <FeatureRow label="Discounts" enabled={account.limits.discounts} />
                  <FeatureRow label="Bundles" enabled={account.limits.bundles} />
                  <FeatureRow label="Flash Sales" enabled={account.limits.flashSales} />
                  <FeatureRow label="Marketing Tools" enabled={account.limits.canSendOffers} />
                </>
              )}
            </View>

            {/* ── Usage Summary ────────────────────────────────── */}
            <View style={styles.sectionCard}>
              <Text style={styles.cardLabel}>USAGE SUMMARY</Text>
              <View style={styles.usageGrid}>
                <UsageTile label="Products" value={account.usage.products} icon="cube-outline" />
                <UsageTile label="Orders" value={account.usage.orders} icon="receipt-outline" />
                <UsageTile label="Coupons" value={account.usage.coupons} icon="pricetag-outline" />
              </View>
            </View>
          </>
        ) : null}
      </ScrollView>

      {/* ── Bottom CTA ──────────────────────────────────────── */}
      <View style={styles.bottomBar}>
        <TouchableOpacity onPress={openBusinessPortal} activeOpacity={0.85} style={styles.ctaButton}>
          <Ionicons name="globe-outline" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
          <Text style={styles.ctaButtonText}>Manage Vendor Account</Text>
        </TouchableOpacity>
        <Text style={styles.ctaHint}>Opens Business Portal in your browser</Text>
      </View>
    </SafeAreaView>
  );
}

function StatusTile({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.statusTile}>
      <Text style={styles.statusTileLabel}>{label}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
        <View style={[styles.statusDot, { backgroundColor: color }]} />
        <Text style={[styles.statusTileValue, { color }]}>{value}</Text>
      </View>
    </View>
  );
}

function LimitRow({ label, current, max }: { label: string; current: number; max: number | null }) {
  const maxDisplay = formatLimit(max);
  const isUnlimited = max === null || max === -1;
  const pct = isUnlimited ? 0 : max > 0 ? Math.min(current / max, 1) : 0;
  const barColor = pct >= 0.9 ? "#FB6363" : pct >= 0.7 ? "#D97706" : "#076B51";

  return (
    <View style={styles.limitRow}>
      <View style={styles.limitHeader}>
        <Text style={styles.limitLabel}>{label}</Text>
        <Text style={styles.limitValue}>{current} / {maxDisplay}</Text>
      </View>
      {!isUnlimited ? (
        <View style={styles.limitBar}>
          <View style={[styles.limitBarFill, { width: `${Math.max(pct * 100, 2)}%`, backgroundColor: barColor }]} />
        </View>
      ) : null}
    </View>
  );
}

function FeatureRow({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <View style={styles.featureRow}>
      <View style={[styles.featureIcon, !enabled && styles.featureIconDisabled]}>
        <Ionicons name={enabled ? "checkmark" : "close"} size={12} color={enabled ? "#076B51" : "#858585"} />
      </View>
      <Text style={[styles.featureLabel, !enabled && styles.featureLabelDisabled]}>{label}</Text>
      <Text style={[styles.featureStatus, enabled ? { color: "#076B51" } : { color: "#858585" }]}>
        {enabled ? "Included" : "Not included"}
      </Text>
    </View>
  );
}

function UsageTile({ label, value, icon }: { label: string; value: number; icon: React.ComponentProps<typeof Ionicons>["name"] }) {
  return (
    <View style={styles.usageTile}>
      <Ionicons name={icon} size={18} color="#076B51" />
      <Text style={styles.usageTileValue}>{value}</Text>
      <Text style={styles.usageTileLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9F9F9" },

  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 18, paddingVertical: 16, gap: 14, borderBottomWidth: 1, borderBottomColor: "#F0F0F0" },
  backButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#F0F0F0", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 22, fontFamily: "Manrope-Bold", color: "#282828" },
  headerSubtitle: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#858585", marginTop: 2 },

  scrollContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 140 },
  placeholder: { paddingVertical: 60, alignItems: "center" },
  errorText: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#FB6363", textAlign: "center", paddingVertical: 30 },

  cardLabel: { fontSize: 11, fontFamily: "Outfit-Medium", color: "#858585", letterSpacing: 1, textTransform: "uppercase", marginBottom: 14 },

  statusCard: { backgroundColor: "#FFFFFF", borderRadius: 20, padding: 20, marginBottom: 14, borderWidth: 1, borderColor: "#ECECEC" },
  statusGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  statusTile: { width: "48%", backgroundColor: "#F9FAFB", borderRadius: 14, padding: 14 },
  statusTileLabel: { fontSize: 11, fontFamily: "Outfit-Regular", color: "#858585" },
  statusTileValue: { fontSize: 14, fontFamily: "Manrope-Bold" },
  statusDot: { width: 8, height: 8, borderRadius: 4 },

  sectionCard: { backgroundColor: "#FFFFFF", borderRadius: 20, padding: 20, marginBottom: 14, borderWidth: 1, borderColor: "#ECECEC" },

  serviceRow: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 14 },
  serviceIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: "#E8F4ED", alignItems: "center", justifyContent: "center" },
  serviceName: { fontSize: 18, fontFamily: "Manrope-Bold", color: "#1A1A1A" },
  serviceLevel: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#858585", marginTop: 2 },
  activeBadge: { borderRadius: 999, backgroundColor: "rgba(7,107,81,0.10)", paddingHorizontal: 14, paddingVertical: 7 },
  inactiveBadge: { backgroundColor: "rgba(133,133,133,0.12)" },
  activeBadgeText: { fontSize: 13, fontFamily: "Manrope-SemiBold", color: "#076B51" },
  inactiveBadgeText: { color: "#858585" },
  renewalRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  renewalText: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#858585" },

  limitRow: { marginBottom: 16 },
  limitHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  limitLabel: { fontSize: 14, fontFamily: "Manrope-SemiBold", color: "#1A1A1A" },
  limitValue: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#858585" },
  limitBar: { height: 6, borderRadius: 3, backgroundColor: "#F0F0F0" },
  limitBarFill: { height: 6, borderRadius: 3 },
  remainingPill: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", backgroundColor: "#FFF8F0", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, marginBottom: 12, borderWidth: 1, borderColor: "#FFE8CC" },
  remainingText: { fontSize: 12, fontFamily: "Manrope-SemiBold", color: "#D97706" },

  featureRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
  featureIcon: { width: 22, height: 22, borderRadius: 11, backgroundColor: "#E8F4ED", alignItems: "center", justifyContent: "center" },
  featureIconDisabled: { backgroundColor: "#F0F0F0" },
  featureLabel: { flex: 1, fontSize: 14, fontFamily: "Manrope-SemiBold", color: "#1A1A1A" },
  featureLabelDisabled: { color: "#858585" },
  featureStatus: { fontSize: 12, fontFamily: "Outfit-Regular" },

  usageGrid: { flexDirection: "row", gap: 10 },
  usageTile: { flex: 1, backgroundColor: "#F9FAFB", borderRadius: 14, padding: 14, alignItems: "center", gap: 4 },
  usageTileValue: { fontSize: 22, fontFamily: "Manrope-Bold", color: "#1A1A1A" },
  usageTileLabel: { fontSize: 11, fontFamily: "Outfit-Regular", color: "#858585" },

  bottomBar: { paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: 1, borderTopColor: "#F0F0F0", backgroundColor: "#FFFFFF" },
  ctaButton: { height: 56, borderRadius: 16, backgroundColor: "#076B51", flexDirection: "row", alignItems: "center", justifyContent: "center" },
  ctaButtonText: { fontSize: 16, fontFamily: "Manrope-SemiBold", color: "#FFFFFF" },
  ctaHint: { fontSize: 11, fontFamily: "Outfit-Regular", color: "#858585", textAlign: "center", marginTop: 6 },
});
