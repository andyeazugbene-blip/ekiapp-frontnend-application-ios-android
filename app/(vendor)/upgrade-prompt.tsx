import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { subscriptionService, type ActiveSubscription } from "../../services/subscriptionService";

const PLAN_LABELS: Record<ActiveSubscription["slug"], string> = {
  free: "Free",
  growth: "Growth",
  pro: "Pro",
};

export default function UpgradePromptScreen() {
  const router = useRouter();
  const [subscription, setSubscription] = useState<ActiveSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadPlanStatus = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError("");

    try {
      const current = await subscriptionService.getCurrentSubscription();
      setSubscription(current);
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

  const planName = subscription ? PLAN_LABELS[subscription.slug] : "Free";
  const active = subscription?.status === "active";

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.85} style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Plan Status</Text>
        <Text style={styles.headerSubtitle}>Current account access</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Ionicons name="lock-closed-outline" size={32} color="#076B51" />
          </View>

          {loading ? (
            <ActivityIndicator color="#076B51" />
          ) : (
            <>
              <Text style={styles.title}>{planName} Plan</Text>
              <Text style={styles.statusText}>{active ? "Active" : "Inactive"}</Text>
              <Text style={styles.subtitle}>This feature is not available on your current plan.</Text>
              {error ? <Text style={styles.errorText}>{error}</Text> : null}
            </>
          )}
        </View>

        <View style={styles.buttons}>
          <TouchableOpacity
            onPress={() => loadPlanStatus(true)}
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
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F4F4F4" },
  header: { backgroundColor: "#076B51", paddingHorizontal: 20, paddingTop: 16, paddingBottom: 30, borderBottomLeftRadius: 35, borderBottomRightRadius: 35, gap: 4 },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center", marginBottom: 8 },
  headerTitle: { fontSize: 30, fontFamily: "Manrope-Bold", lineHeight: 30, color: "#FFFFFF" },
  headerSubtitle: { fontSize: 16, fontFamily: "Outfit-Light", color: "#FFFFFF" },
  content: { flex: 1, paddingHorizontal: 16, paddingTop: 24, justifyContent: "space-between", paddingBottom: 40 },
  card: { backgroundColor: "#FFFFFF", borderRadius: 30, padding: 24, alignItems: "center" },
  iconWrap: { width: 72, height: 72, borderRadius: 24, backgroundColor: "#E8F4ED", alignItems: "center", justifyContent: "center", marginBottom: 16 },
  title: { fontSize: 20, fontFamily: "Manrope-Bold", color: "#282828", textAlign: "center" },
  statusText: { fontSize: 13, fontFamily: "Manrope-SemiBold", color: "#076B51", marginTop: 8 },
  subtitle: { fontSize: 14, fontFamily: "Outfit-Regular", color: "#858585", textAlign: "center", marginTop: 8, lineHeight: 21 },
  errorText: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#FB6363", textAlign: "center", marginTop: 12 },
  buttons: { gap: 12 },
  primaryButton: { height: 56, borderRadius: 14, backgroundColor: "#076B51", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  primaryButtonText: { fontSize: 16, fontFamily: "Manrope-SemiBold", color: "#FFFFFF" },
  secondaryButton: { height: 56, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  secondaryButtonText: { fontSize: 16, fontFamily: "Outfit-Regular", color: "#858585", textDecorationLine: "underline" },
});
