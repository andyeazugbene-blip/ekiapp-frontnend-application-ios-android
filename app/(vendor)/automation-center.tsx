import React, { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { goBackOrReplace } from "../../utils/navigation";
import {
  automationService,
  AUTOMATION_LABELS,
  type AutomationRun,
  type AutomationType,
  type VendorAutomation,
} from "../../services/automationService";

const ICON_FOR_TYPE: Record<AutomationType, React.ComponentProps<typeof Ionicons>["name"]> = {
  FIRST_SALE: "rocket-outline",
  CART_RECOVERY: "cart-outline",
  BUYER_WIN_BACK: "heart-outline",
  REVIEW_REQUEST: "star-outline",
  LOW_STOCK_ALERT: "alert-circle-outline",
  BUYER_REFERRAL: "gift-outline",
  PAYMENT_RECOVERY: "card-outline",
  RENEWAL_REMINDER: "repeat-outline",
  PRICE_APPROVAL_REMINDER: "pricetag-outline",
  CAMPAIGN_MILESTONE: "flag-outline",
  CAMPAIGN_DEADLINE: "time-outline",
  CAMPAIGN_REFUND_UPDATE: "cash-outline",
};

function formatRelative(value?: string | null): string {
  if (!value) return "—";
  const ts = new Date(value).getTime();
  if (!Number.isFinite(ts)) return "—";
  const diff = Date.now() - ts;
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  if (days <= 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Date(value).toLocaleDateString();
}

export default function AutomationCenterScreen() {
  const router = useRouter();
  const [automations, setAutomations] = useState<VendorAutomation[]>([]);
  const [activity, setActivity] = useState<AutomationRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [togglingType, setTogglingType] = useState<AutomationType | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [list, runs] = await Promise.all([
        automationService.listVendorAutomations(),
        automationService.listVendorActivity(30),
      ]);
      setAutomations(list);
      setActivity(runs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load automations.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handleToggle = async (type: AutomationType, enabled: boolean) => {
    setAutomations((prev) => prev.map((a) => (a.type === type ? { ...a, enabled } : a)));
    setTogglingType(type);
    try {
      await automationService.setVendorAutomation(type, enabled);
    } catch {
      // Revert on failure — the backend state is authoritative.
      setAutomations((prev) => prev.map((a) => (a.type === type ? { ...a, enabled: !enabled } : a)));
    } finally {
      setTogglingType(null);
    }
  };

  const enabledCount = automations.filter((a) => a.enabled).length;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => goBackOrReplace(router, "/(vendor)" as any)} activeOpacity={0.85} style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color="#282828" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Automation Center</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.placeholder}>
            <ActivityIndicator color="#076B51" />
          </View>
        ) : error ? (
          <View style={styles.emptyState}>
            <Ionicons name="alert-circle-outline" size={28} color="#D6552F" />
            <Text style={styles.emptyTitle}>Couldn't load automations</Text>
            <Text style={styles.emptyText}>{error}</Text>
            <TouchableOpacity onPress={() => void load()} activeOpacity={0.86} style={styles.retryButton}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryValue}>{enabledCount}/{automations.length}</Text>
              <Text style={styles.summaryLabel}>automations active</Text>
            </View>

            <Text style={styles.section}>Automations</Text>
            {automations.map((a) => (
              <View key={a.type} style={styles.automationCard}>
                <View style={styles.automationIcon}>
                  <Ionicons name={ICON_FOR_TYPE[a.type] ?? "flash-outline"} size={18} color="#076B51" />
                </View>
                <View style={styles.automationCopy}>
                  <Text style={styles.automationTitle}>{AUTOMATION_LABELS[a.type] ?? a.type}</Text>
                  <Text style={styles.automationBody} numberOfLines={2}>{a.description}</Text>
                </View>
                {togglingType === a.type ? (
                  <ActivityIndicator size="small" color="#076B51" />
                ) : (
                  <Switch
                    value={a.enabled}
                    onValueChange={(value) => void handleToggle(a.type, value)}
                    trackColor={{ true: "#85C5AE" }}
                    thumbColor={a.enabled ? "#076B51" : "#F4F4F4"}
                  />
                )}
              </View>
            ))}

            <Text style={styles.section}>Recent activity</Text>
            {activity.length === 0 ? (
              <Text style={styles.emptyActivityText}>No automation runs yet. Activity will appear here once your automations start sending.</Text>
            ) : (
              activity.map((run) => (
                <View key={run.id} style={styles.activityRow}>
                  <View
                    style={[
                      styles.activityDot,
                      run.status === "SENT" && styles.activityDotSent,
                      run.status === "FAILED" && styles.activityDotFailed,
                    ]}
                  />
                  <View style={styles.activityCopy}>
                    <Text style={styles.activityTitle}>{AUTOMATION_LABELS[run.type] ?? run.type}</Text>
                    <Text style={styles.activityMeta}>
                      {run.status === "SENT" ? "Sent" : run.status === "FAILED" ? (run.failureReason ?? "Failed") : "Checking eligibility"}
                      {" · "}
                      {formatRelative(run.sentAt ?? run.createdAt)}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9F9F9" },
  header: { backgroundColor: "#FFFFFF", paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16, flexDirection: "row", alignItems: "center", gap: 12 },
  backButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#F4F4F4", alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, fontSize: 22, fontFamily: "Manrope-Bold", color: "#282828" },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 100, gap: 10 },
  placeholder: { paddingVertical: 60, alignItems: "center" },
  emptyState: { alignItems: "center", paddingVertical: 40, gap: 8 },
  emptyTitle: { fontSize: 14, fontFamily: "Manrope-Bold", color: "#282828" },
  emptyText: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#858585", textAlign: "center" },
  retryButton: { marginTop: 10, minHeight: 38, borderRadius: 12, borderWidth: 1, borderColor: "#076B51", paddingHorizontal: 18, alignItems: "center", justifyContent: "center" },
  retryButtonText: { fontSize: 13, fontFamily: "Manrope-SemiBold", color: "#076B51" },
  summaryCard: { backgroundColor: "#076B51", borderRadius: 18, padding: 18, alignItems: "center", marginBottom: 4 },
  summaryValue: { fontSize: 28, fontFamily: "Manrope-ExtraBold", color: "#FFFFFF" },
  summaryLabel: { fontSize: 12, fontFamily: "Outfit-Regular", color: "rgba(255,255,255,0.85)", marginTop: 2 },
  section: { fontSize: 15, fontFamily: "Manrope-Bold", color: "#282828", marginTop: 12, marginBottom: 2 },
  automationCard: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 16, padding: 14, gap: 12 },
  automationIcon: { width: 40, height: 40, borderRadius: 14, backgroundColor: "rgba(7,107,81,0.08)", alignItems: "center", justifyContent: "center" },
  automationCopy: { flex: 1 },
  automationTitle: { fontSize: 14, fontFamily: "Manrope-Bold", color: "#282828" },
  automationBody: { fontSize: 12, lineHeight: 17, fontFamily: "Outfit-Regular", color: "#858585", marginTop: 2 },
  emptyActivityText: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#858585", paddingVertical: 20, textAlign: "center" },
  activityRow: { flexDirection: "row", alignItems: "flex-start", backgroundColor: "#FFFFFF", borderRadius: 14, padding: 12, gap: 10 },
  activityDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#B0B0B0", marginTop: 5 },
  activityDotSent: { backgroundColor: "#076B51" },
  activityDotFailed: { backgroundColor: "#FB6363" },
  activityCopy: { flex: 1 },
  activityTitle: { fontSize: 13, fontFamily: "Outfit-Medium", color: "#282828" },
  activityMeta: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#858585", marginTop: 2 },
});
