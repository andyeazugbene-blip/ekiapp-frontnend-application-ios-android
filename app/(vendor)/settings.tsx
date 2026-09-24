import React, { useState } from "react";
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
import { useRouter } from "expo-router";
import { useAuthStore } from "../../stores/authStore";
import type { VendorProfile } from "../../types/auth";
import { goBackOrReplace } from "../../utils/navigation";

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
        return "Pro";
      case "growth":
        return "Growth";
      default:
        return "Starter";
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

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <TouchableOpacity
            accessibilityLabel="Go back"
            accessibilityRole="button"
            onPress={() => goBackOrReplace(router, "/(vendor)" as any)}
            activeOpacity={0.85}
            style={styles.backButton}
          >
            <Ionicons name="chevron-back" size={20} color="#282828" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Settings</Text>
        </View>

        <View style={styles.profileCard}>
          <View style={styles.profileRow}>
            <View style={styles.avatar}>
              <View style={styles.avatarCircle}>
                {vendor?.avatar ? (
                  <Image source={{ uri: vendor.avatar }} style={styles.avatarImage} />
                ) : (
                  <Text style={styles.avatarText}>{(vendor?.storeName || vendor?.name || "S").charAt(0).toUpperCase()}</Text>
                )}
              </View>
              <View style={styles.avatarBadge}>
                <Ionicons name="storefront" size={10} color="#FFFFFF" />
              </View>
            </View>
            <View style={styles.profileDetails}>
              <Text style={styles.storeName} numberOfLines={1}>{vendor?.storeName ?? "My Store"}</Text>
              <Text style={styles.ownerText} numberOfLines={1}>Owner: {vendor?.name ?? "Vendor"}</Text>
              <Text style={styles.emailText} numberOfLines={1}>{vendor?.email ?? ""}</Text>

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
            icon="person-outline"
            label="Edit Personal Profile"
            description="Update your name, phone, country, and avatar"
            onPress={() => router.push("/(vendor)/edit-personal-profile" as any)}
          />
          <SettingRow
            icon="storefront-outline"
            label="Edit Store Profile"
            description="Update store name, city, country, and public description"
            onPress={() => router.push("/(vendor)/edit-store-profile" as any)}
          />
          <SettingRow
            icon="earth-outline"
            label="Markets You Serve"
            description="Add or remove the approved markets your store operates in"
            onPress={() => router.push("/(vendor)/markets" as any)}
          />
          <SettingRow
            icon="shield-checkmark-outline"
            label="Verification Documents"
            description="Upload or review your ID and business verification steps"
            value={getVerificationText(vendor?.verificationStatus)}
            onPress={() => {
              if (vendor?.verificationStatus === "verified") {
                Alert.alert("Already Verified", "Your store is already verified. No further action is needed.");
                return;
              }
              router.push("/(vendor-verification)" as any);
            }}
          />
          <SettingRow
            icon="airplane-outline"
            label="Delivery Settings"
            description="Manage pricing, regions, and estimated delivery windows"
            onPress={() => router.push("/(vendor)/delivery" as any)}
          />
        </View>

        {/* Marketing, Payments & Wallet, and Vendor Account moved to their
            own standalone sidebar entries (components/vendor/Drawer.tsx) —
            grow-sales.tsx, earnings.tsx, and subscription-plans.tsx are each
            already the canonical hub for that area, so Settings no longer
            duplicates them. */}

        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.card}>
          <SettingRow
            icon="swap-horizontal-outline"
            label="Switch to Buyer"
            description="Go to the buyer side of the app"
            onPress={() => {
              // Community Buy Workstream 9 (universal account): Buyer
              // access has never required any role — this is a pure
              // navigation + preference update now, no backend call.
              // An explicit destination must always win over incidental
              // back-history — replace(), not goBackOrReplace() (see the
              // history note this fix originally carried: Settings is only
              // ever reached by pushing forward from inside Vendor, so
              // router.back() would just pop to the prior Vendor screen).
              useAuthStore.getState().setLastDestination("buy");
              router.replace("/(buyer)" as any);
            }}
          />
          <SettingRow
            icon="notifications-outline"
            label="Notifications"
            description="Control order, payout, and marketing alerts"
            onPress={() => router.push("/(vendor)/notifications" as any)}
          />
          <SettingRow
            icon="help-circle-outline"
            label="How Eki Works"
            description="A guide to buying, selling, and order tracking"
            onPress={() => router.push("/how-eki-works" as any)}
          />
          <SettingRow
            icon="document-text-outline"
            label="Terms & Conditions"
            onPress={() => router.push("/terms" as any)}
          />
          <SettingRow
            icon="shield-checkmark-outline"
            label="Privacy Policy"
            onPress={() => router.push("/privacy" as any)}
          />
          <SettingRow
            icon="briefcase-outline"
            label="Vendor Agreement"
            onPress={() => router.push("/vendor-agreement" as any)}
          />
          <SettingRow
            icon="card-outline"
            label="Refund & Cancellation"
            onPress={() => router.push("/refund-policy" as any)}
          />
          <SettingRow
            icon="receipt-outline"
            label="Billing & Services"
            onPress={() => router.push("/subscription-policy" as any)}
          />
          <SettingRow
            icon="finger-print-outline"
            label="Cookie Policy"
            onPress={() => router.push("/cookie-policy" as any)}
          />
          <SettingRow
            icon="checkmark-circle-outline"
            label="Acceptable Use"
            onPress={() => router.push("/acceptable-use" as any)}
          />
          <SettingRow
            icon="chatbox-ellipses-outline"
            label="Help & Support"
            onPress={() => router.push("/support" as any)}
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
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    borderWidth: 1,
    borderColor: "#EEF0EF",
  },
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
  // Outer wrapper is NOT clipped — the storefront badge is positioned at its
  // corner and would otherwise be cut off by the inner circle's own
  // overflow:hidden (needed to round off the avatar image/initial).
  avatar: {
    width: 68,
    height: 68,
    position: "relative",
  },
  avatarCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "#076B5115",
    alignItems: "center",
    justifyContent: "center",
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
