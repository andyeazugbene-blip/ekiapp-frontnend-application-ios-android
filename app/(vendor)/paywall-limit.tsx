import React, { useState } from "react";
import { ActivityIndicator, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { vendorService } from "../../services/vendorService";
import { goBackOrReplace } from "../../utils/navigation";

const BUSINESS_PORTAL_URL = "https://culinarytales.app/business-portal";

const TITLES: Record<string, string> = {
  product_limit: "Product limit reached",
  offers: "Offers limit reached",
  discounts: "Discount limit reached",
  bundles: "Bundle limit reached",
  flash_sales: "Flash sale limit reached",
  analytics: "Analytics not included",
  default: "Business limit reached",
};

const DESCRIPTIONS: Record<string, string> = {
  product_limit: "You have reached the maximum number of products for your current vendor services.",
  offers: "Your current vendor services do not include offers. Visit the Business Portal to adjust your account.",
  discounts: "Your current vendor services do not include discounts. Visit the Business Portal to adjust your account.",
  bundles: "Your current vendor services do not include bundles. Visit the Business Portal to adjust your account.",
  flash_sales: "Your current vendor services do not include flash sales. Visit the Business Portal to adjust your account.",
  analytics: "Your current vendor services do not include analytics. Visit the Business Portal to adjust your account.",
  default: "You have reached a business limit. Visit the Business Portal to review your vendor account.",
};

export default function PaywallLimitScreen() {
  const router = useRouter();
  const { feature } = useLocalSearchParams<{ feature?: string }>();
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const title = TITLES[feature ?? "default"] ?? TITLES.default;
  const description = DESCRIPTIONS[feature ?? "default"] ?? DESCRIPTIONS.default;

  const refreshAccountStatus = async () => {
    setRefreshing(true);
    setMessage("");
    setError("");
    try {
      await vendorService.getVendorAccount();
      setMessage("Account status refreshed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not refresh account status.");
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => goBackOrReplace(router, "/(vendor)/subscription-plans" as any)} activeOpacity={0.85} style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Business Limit</Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent}>
        <View style={styles.iconWrap}>
          <Ionicons name="alert-circle-outline" size={36} color="#D97706" />
        </View>

        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{description}</Text>

        {message ? <Text style={styles.messageText}>{message}</Text> : null}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={styles.buttons}>
          <TouchableOpacity
            onPress={() => Linking.openURL(BUSINESS_PORTAL_URL)}
            activeOpacity={0.85}
            style={styles.primaryButton}
          >
            <Ionicons name="globe-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.primaryButtonText}>Open Business Portal</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={refreshAccountStatus}
            activeOpacity={0.85}
            style={[styles.outlineButton, refreshing && { opacity: 0.6 }]}
            disabled={refreshing}
          >
            {refreshing ? <ActivityIndicator color="#076B51" size="small" /> : null}
            <Text style={styles.outlineButtonText}>Refresh account status</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => goBackOrReplace(router, "/(vendor)/subscription-plans" as any)} activeOpacity={0.85} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Back</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9F9F9" },
  header: { backgroundColor: "#076B51", paddingHorizontal: 20, paddingTop: 16, paddingBottom: 30, borderBottomLeftRadius: 35, borderBottomRightRadius: 35, flexDirection: "row", alignItems: "center", gap: 12 },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 24, fontFamily: "Manrope-Bold", color: "#FFFFFF" },
  scrollContent: { paddingHorizontal: 24, paddingTop: 36, paddingBottom: 40, alignItems: "center" },
  iconWrap: { width: 92, height: 92, borderRadius: 32, backgroundColor: "#FFF8F0", alignItems: "center", justifyContent: "center", marginBottom: 24 },
  title: { fontSize: 22, fontFamily: "Manrope-Bold", color: "#1A1A1A", textAlign: "center" },
  body: { fontSize: 14, fontFamily: "Outfit-Regular", color: "#858585", textAlign: "center", marginTop: 10, lineHeight: 21 },
  messageText: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#076B51", textAlign: "center", marginTop: 16 },
  errorText: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#FB6363", textAlign: "center", marginTop: 16 },
  buttons: { width: "100%", marginTop: 28, gap: 12 },
  primaryButton: { height: 56, borderRadius: 14, backgroundColor: "#076B51", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4 },
  primaryButtonText: { fontSize: 16, fontFamily: "Manrope-SemiBold", color: "#FFFFFF" },
  outlineButton: { height: 56, borderRadius: 14, borderWidth: 1, borderColor: "#076B51", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  outlineButtonText: { fontSize: 16, fontFamily: "Manrope-SemiBold", color: "#076B51" },
  secondaryButton: { height: 56, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  secondaryButtonText: { fontSize: 16, fontFamily: "Manrope-SemiBold", color: "#858585" },
});
