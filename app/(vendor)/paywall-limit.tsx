import React, { useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { subscriptionService } from "../../services/subscriptionService";

const TITLES: Record<string, string> = {
  product_limit: "Product limit reached",
  offers: "Offers unavailable",
  discounts: "Discounts unavailable",
  bundles: "Bundles unavailable",
  flash_sales: "Flash sales unavailable",
  analytics: "Analytics unavailable",
  default: "Feature unavailable",
};

const LOCKED_COPY = "This feature is not available on your current plan.";

export default function PaywallLimitScreen() {
  const router = useRouter();
  const { feature } = useLocalSearchParams<{ feature?: string }>();
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const title = TITLES[feature ?? "default"] ?? TITLES.default;

  const refreshPlanStatus = async () => {
    setRefreshing(true);
    setMessage("");
    setError("");
    try {
      await Promise.all([
        subscriptionService.getCurrentSubscription(),
        subscriptionService.getLimits(),
      ]);
      setMessage("Plan status refreshed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not refresh plan status.");
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.85} style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Plan Access</Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent}>
        <View style={styles.iconWrap}>
          <Ionicons name="lock-closed-outline" size={36} color="#076B51" />
        </View>

        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{LOCKED_COPY}</Text>

        {message ? <Text style={styles.messageText}>{message}</Text> : null}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={styles.buttons}>
          <TouchableOpacity
            onPress={refreshPlanStatus}
            activeOpacity={0.85}
            style={[styles.primaryButton, refreshing && { opacity: 0.6 }]}
            disabled={refreshing}
          >
            {refreshing ? <ActivityIndicator color="#FFFFFF" size="small" /> : null}
            <Text style={styles.primaryButtonText}>Refresh plan status</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.85} style={styles.secondaryButton}>
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
  iconWrap: { width: 92, height: 92, borderRadius: 32, backgroundColor: "#E8F4ED", alignItems: "center", justifyContent: "center", marginBottom: 24 },
  title: { fontSize: 22, fontFamily: "Manrope-Bold", color: "#1A1A1A", textAlign: "center" },
  body: { fontSize: 14, fontFamily: "Outfit-Regular", color: "#858585", textAlign: "center", marginTop: 10, lineHeight: 21 },
  messageText: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#076B51", textAlign: "center", marginTop: 16 },
  errorText: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#FB6363", textAlign: "center", marginTop: 16 },
  buttons: { width: "100%", marginTop: 28, gap: 12 },
  primaryButton: { height: 56, borderRadius: 14, backgroundColor: "#076B51", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  primaryButtonText: { fontSize: 16, fontFamily: "Manrope-SemiBold", color: "#FFFFFF" },
  secondaryButton: { height: 56, borderRadius: 14, borderWidth: 1, borderColor: "#076B51", alignItems: "center", justifyContent: "center" },
  secondaryButtonText: { fontSize: 16, fontFamily: "Manrope-SemiBold", color: "#076B51" },
});
