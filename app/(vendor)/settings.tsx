import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useAuthStore } from "../../stores/authStore";
import { marketingService } from "../../services/marketingService";
import { payoutMethodService } from "../../services/payoutMethodService";
import type { VendorProfile } from "../../types/auth";

interface SettingRowProps {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  description?: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
}

function SettingRow({ icon, label, description, value, onPress, danger }: SettingRowProps) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.75} style={styles.row}>
      <View style={[styles.iconContainer, danger ? styles.iconContainerDanger : styles.iconContainerPrimary]}>
        <Ionicons name={icon} size={18} color={danger ? "#FB6363" : "#076B51"} />
      </View>
      <View style={styles.rowTextContainer}>
        <Text style={[styles.rowLabel, danger && styles.rowLabelDanger]}>{label}</Text>
        {description ? <Text style={styles.rowDescription}>{description}</Text> : null}
      </View>
      {value ? <Text style={styles.rowValue}>{value}</Text> : null}
      {!danger ? <Ionicons name="chevron-forward" size={16} color="#D1D5DB" /> : null}
    </TouchableOpacity>
  );
}

export default function VendorSettingsScreen() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const vendor = user as VendorProfile | null;

  const [signingOut, setSigningOut] = useState(false);
  const [loadingCounts, setLoadingCounts] = useState(true);
  const [discountCount, setDiscountCount] = useState(0);
  const [payoutMethodCount, setPayoutMethodCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoadingCounts(true);

      Promise.all([
        marketingService.listDiscounts().catch(() => []),
        payoutMethodService.list().catch(() => []),
      ])
        .then(([discounts, payoutMethods]) => {
          if (!active) return;
          setDiscountCount(discounts.length);
          setPayoutMethodCount(payoutMethods.length);
        })
        .finally(() => {
          if (active) setLoadingCounts(false);
        });

      return () => {
        active = false;
      };
    }, []),
  );

  const handleLogout = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out of the vendor panel?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          setSigningOut(true);
          try {
            await logout();
            router.replace("/(auth)/role-select");
          } catch {
            Alert.alert("Error", "Could not sign out. Please try again.");
          } finally {
            setSigningOut(false);
          }
        },
      },
    ]);
  };

  const getPlanLabel = (plan: string | undefined) => {
    switch (plan?.toLowerCase()) {
      case "pro":
        return "Pro Plan";
      case "growth":
        return "Growth Plan";
      default:
        return "Free Trial";
    }
  };

  const getVerificationColor = (status: string | undefined) => {
    switch (status) {
      case "verified":
        return "#076B51";
      case "under_review":
        return "#D97706";
      case "rejected":
        return "#FB6363";
      default:
        return "#858585";
    }
  };

  const getVerificationText = (status: string | undefined) => {
    switch (status) {
      case "verified":
        return "Verified Store";
      case "under_review":
        return "Under Review";
      case "rejected":
        return "Rejected";
      default:
        return "Upload Documents";
    }
  };

  const payoutValue = loadingCounts ? "..." : `${payoutMethodCount}`;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Settings</Text>
        </View>

        <View style={styles.profileCard}>
          <View style={styles.profileRow}>
            <View style={styles.avatar}>
              {vendor?.avatar ? (
                <Image source={{ uri: vendor.avatar }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarText}>{(vendor?.storeName || vendor?.name || "S").charAt(0).toUpperCase()}</Text>
              )}
              <View style={styles.avatarBadge}>
                <Ionicons name="storefront" size={10} color="#FFFFFF" />
              </View>
            </View>
            <View style={styles.profileDetails}>
              <Text style={styles.storeName}>{vendor?.storeName ?? "My Store"}</Text>
              <Text style={styles.ownerText}>Owner: {vendor?.name ?? "Vendor"}</Text>
              <Text style={styles.emailText}>{vendor?.email ?? ""}</Text>

              <View style={styles.badgeRow}>
                <View style={styles.planBadge}>
                  <Text style={styles.planBadgeText}>{getPlanLabel(vendor?.subscriptionPlan)}</Text>
                </View>
                <View style={[styles.verifiedBadge, { borderColor: getVerificationColor(vendor?.verificationStatus) }]}>
                  <View style={[styles.dot, { backgroundColor: getVerificationColor(vendor?.verificationStatus) }]} />
                  <Text style={[styles.verifiedBadgeText, { color: getVerificationColor(vendor?.verificationStatus) }]}>
                    {getVerificationText(vendor?.verificationStatus)}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Store Management</Text>
        <View style={styles.card}>
          <SettingRow
            icon="storefront-outline"
            label="Edit Store Profile"
            description="Update store name, city, country, and public description"
            onPress={() => router.push("/(vendor)/edit-store-profile" as any)}
          />
          <SettingRow
            icon="shield-checkmark-outline"
            label="Verification Documents"
            description="Upload or review your ID and business verification steps"
            value={getVerificationText(vendor?.verificationStatus)}
            onPress={() => router.push("/(vendor-verification)" as any)}
          />
          <SettingRow
            icon="airplane-outline"
            label="Delivery Settings"
            description="Manage pricing, regions, and estimated delivery windows"
            onPress={() => router.push("/(vendor)/delivery" as any)}
          />
        </View>

        <Text style={styles.sectionTitle}>Marketing</Text>
        <View style={styles.card}>
          <SettingRow
            icon="megaphone-outline"
            label="Marketing Tools"
            description="Create coupons, message buyers, and share store links"
            onPress={() => router.push("/(vendor)/grow-sales" as any)}
          />
          <SettingRow
            icon="bar-chart-outline"
            label="Store Link Analytics"
            description="Track store visits, checkout starts, and web-store orders"
            onPress={() => router.push("/(vendor)/analytics" as any)}
          />
          <SettingRow
            icon="pricetag-outline"
            label="Coupons Created"
            description="Review created coupon codes, linked products, dates, and share links"
            value={loadingCounts ? "..." : String(discountCount)}
            onPress={() => router.push("/(vendor)/coupon-history" as any)}
          />
          <SettingRow
            icon="chatbubble-ellipses-outline"
            label="Buyer Messaging"
            description="Send private offers and follow-ups to past buyers"
            onPress={() => router.push("/(vendor)/send-offer" as any)}
          />
        </View>

        <Text style={styles.sectionTitle}>Payments & Wallet</Text>
        <View style={styles.card}>
          <SettingRow
            icon="wallet-outline"
            label="Earnings & Wallet"
            description="View protected balance, releases, and payout requests"
            onPress={() => router.push("/(vendor)/earnings" as any)}
          />
          <SettingRow
            icon="shield-checkmark-outline"
            label="How Escrow Works"
            description="Understand protected payments, delivery OTPs, disputes, and payout release"
            onPress={() => router.push("/(vendor)/escrow-guide" as any)}
          />
          <SettingRow
            icon="card-outline"
            label="Payout Methods"
            description="Add the bank, Stripe, or PayPal account used for withdrawals"
            value={payoutValue}
            onPress={() => router.push("/(vendor)/payout-mode" as any)}
          />
        </View>

        <Text style={styles.sectionTitle}>Subscriptions</Text>
        <View style={styles.card}>
          <SettingRow
            icon="ribbon-outline"
            label="Subscription Plan"
            description="View your current plan and limits. Purchases are handled outside the app."
            onPress={() => router.push("/(vendor)/subscription-plans" as any)}
          />
          <SettingRow
            icon="globe-outline"
            label="View Website"
            description="Open your public store link and sharing tools"
            onPress={() => router.push("/(vendor)/share-store-link" as any)}
          />
        </View>

        <Text style={styles.sectionTitle}>Account Settings</Text>
        <View style={styles.card}>
          <SettingRow
            icon="notifications-outline"
            label="Notifications"
            description="Control order, payout, and marketing alerts"
            onPress={() => router.push("/(vendor)/notifications" as any)}
          />
          <SettingRow
            icon="document-text-outline"
            label="Terms, Privacy & Support"
            description="Open app policies, support, and how Eki works"
            onPress={() => router.push("/how-eki-works" as any)}
          />
          <SettingRow
            icon="trash-outline"
            label="Delete Account"
            description="Start an account deletion request and review the data-retention policy"
            onPress={() => router.push("/account-deletion" as any)}
            danger
          />
        </View>

        <View style={styles.signOutContainer}>
          <TouchableOpacity onPress={handleLogout} disabled={signingOut} style={styles.signOutButton} activeOpacity={0.75}>
            <View style={styles.signOutIconContainer}>
              {signingOut ? <ActivityIndicator size="small" color="#FB6363" /> : <Ionicons name="log-out-outline" size={18} color="#FB6363" />}
            </View>
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9F9F9" },
  scrollContent: { paddingBottom: 120 },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  headerTitle: { fontSize: 24, fontFamily: "Manrope-Bold", color: "#282828" },
  profileCard: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  profileRow: { flexDirection: "row", alignItems: "center" },
  avatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "#076B5115",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    overflow: "hidden",
  },
  avatarImage: { width: "100%", height: "100%" },
  avatarText: { fontSize: 28, fontFamily: "Manrope-Bold", color: "#076B51" },
  avatarBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#076B51",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  profileDetails: { marginLeft: 16, flex: 1 },
  storeName: { fontSize: 18, fontFamily: "Manrope-Bold", color: "#282828" },
  ownerText: { fontSize: 12, color: "#858585", fontFamily: "Outfit-Regular", marginTop: 2 },
  emailText: { fontSize: 12, color: "#858585", fontFamily: "Outfit-Regular", marginTop: 2 },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  planBadge: {
    borderRadius: 999,
    backgroundColor: "#F0F7F4",
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  planBadgeText: { fontSize: 11, fontFamily: "Manrope-SemiBold", color: "#076B51" },
  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    gap: 6,
  },
  dot: { width: 7, height: 7, borderRadius: 3.5 },
  verifiedBadgeText: { fontSize: 11, fontFamily: "Manrope-SemiBold" },
  sectionTitle: {
    fontSize: 13,
    fontFamily: "Manrope-Bold",
    color: "#858585",
    paddingHorizontal: 16,
    marginTop: 20,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    marginHorizontal: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#F0F2F1",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E9EEEC",
  },
  iconContainer: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  iconContainerPrimary: { backgroundColor: "#EDF7F3" },
  iconContainerDanger: { backgroundColor: "#FFF2F2" },
  rowTextContainer: { flex: 1, marginLeft: 12, marginRight: 10 },
  rowLabel: { fontSize: 15, fontFamily: "Manrope-SemiBold", color: "#282828" },
  rowLabelDanger: { color: "#FB6363" },
  rowDescription: { fontSize: 12, lineHeight: 18, fontFamily: "Outfit-Regular", color: "#858585", marginTop: 4 },
  rowValue: { fontSize: 12, fontFamily: "Manrope-Bold", color: "#076B51", marginRight: 8 },
  signOutContainer: { paddingHorizontal: 16, marginTop: 24 },
  signOutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 56,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#F2D7D7",
  },
  signOutIconContainer: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#FFF2F2",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  signOutText: { fontSize: 16, fontFamily: "Manrope-SemiBold", color: "#FB6363" },
});
