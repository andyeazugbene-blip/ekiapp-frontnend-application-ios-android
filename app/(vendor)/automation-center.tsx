import React, { useCallback, useState } from "react";
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { goBackOrReplace } from "../../utils/navigation";
import {
  EmptyState,
  ErrorState,
  FloatingCard,
  IconAvatar,
  LoadingBlock,
  PremiumHeader,
  StatusPill,
  premiumStyles,
} from "../../components/shared/PremiumBlocks";
import {
  automationService,
  AUTOMATION_EXPLAINER,
  AUTOMATION_LABELS,
  type AutomationRun,
  type AutomationType,
  type VendorAutomation,
} from "../../services/automationService";
import { useFocusRefresh } from "../../hooks/useFocusRefresh";
import { pushTokenService, type PushPermissionStatus } from "../../services/notificationService";

function describeRun(run: AutomationRun): string {
  const data = run.data ?? {};
  if (typeof data.order_number === "string") return `Order ${data.order_number}`;
  if (typeof data.product_count === "string") return `${data.product_count} product(s) low on stock`;
  if (typeof data.referral_code === "string") return `Referral code ${data.referral_code}`;
  if (typeof data.store_name === "string") return String(data.store_name);
  return "No additional order or sales detail was recorded for this run.";
}

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
  const [selectedRun, setSelectedRun] = useState<AutomationRun | null>(null);
  const [notifStatus, setNotifStatus] = useState<PushPermissionStatus | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [list, runs, notif] = await Promise.all([
        automationService.listVendorAutomations(),
        automationService.listVendorActivity(30),
        pushTokenService.getPermissionStatus(),
      ]);
      setAutomations(list);
      setActivity(runs);
      setNotifStatus(notif.status);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load automations.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Skips redundant refetch when returning to this screen within 30s of
  // the last load — see hooks/useFocusRefresh.ts.
  useFocusRefresh(load);

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
  const recentFailures = activity.filter((r) => r.status === "FAILED").length;

  return (
    <View style={premiumStyles.page}>
      <PremiumHeader
        title="Automation Center"
        subtitle={loading ? undefined : `${enabledCount} of ${automations.length} automations active`}
        onBack={() => goBackOrReplace(router, "/(vendor)" as any)}
      />

      <ScrollView style={{ flex: 1 }} contentContainerStyle={[premiumStyles.scrollContent, { paddingTop: 18 }]} showsVerticalScrollIndicator={false}>
        {loading ? (
          <LoadingBlock />
        ) : error ? (
          <View style={premiumStyles.block}>
            <ErrorState message={error} onRetry={() => void load()} />
          </View>
        ) : (
          <>
            {notifStatus && notifStatus !== "granted" && notifStatus !== "unsupported" ? (
              <View style={premiumStyles.block}>
                <TouchableOpacity onPress={() => router.push("/(vendor)/notification-permission" as any)} activeOpacity={0.85}>
                  <FloatingCard style={styles.notifBanner}>
                    <IconAvatar icon="notifications-outline" tone="warning" size={40} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.notifBannerTitle}>Turn on notifications</Text>
                      <Text style={styles.notifBannerBody}>Get alerted the moment an automation sends, so you never miss an order or a low-stock warning.</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color="#C7D2CB" />
                  </FloatingCard>
                </TouchableOpacity>
              </View>
            ) : null}

            <View style={[premiumStyles.block, { gap: 10 }]}>
              {automations.map((a) => {
                return (
                  <TouchableOpacity
                    key={a.type}
                    activeOpacity={0.85}
                    onPress={() => router.push({ pathname: "/(vendor)/automation-detail", params: { type: a.type } } as any)}
                  >
                    <FloatingCard style={{ padding: 0, overflow: "hidden" }}>
                      <View style={styles.automationRow}>
                        <IconAvatar icon={ICON_FOR_TYPE[a.type] ?? "flash-outline"} tone={a.enabled ? "success" : "neutral"} />
                        <View style={styles.automationCopy}>
                          <Text style={styles.automationTitle}>{AUTOMATION_LABELS[a.type] ?? a.type}</Text>
                          <Text style={styles.automationBody} numberOfLines={2}>{AUTOMATION_EXPLAINER[a.type] ?? "Details for this automation are being prepared."}</Text>
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
                    </FloatingCard>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={premiumStyles.block}>
              <View style={styles.sectionRow}>
                <Text style={styles.sectionTitle}>Recent activity</Text>
                {recentFailures > 0 ? <StatusPill label={`${recentFailures} failed`} tone="error" /> : null}
              </View>

              {activity.length > 0 ? (
                <TouchableOpacity onPress={() => router.push("/(vendor)/automation-activity" as any)} activeOpacity={0.85} style={{ marginBottom: 10 }}>
                  <Text style={styles.viewAllLink}>View all automation activity</Text>
                </TouchableOpacity>
              ) : null}

              {activity.length === 0 ? (
                <FloatingCard>
                  <EmptyState
                    icon="pulse-outline"
                    title="No automation runs yet"
                    body="Activity will appear here once your automations start sending."
                  />
                </FloatingCard>
              ) : (
                <View style={{ gap: 8 }}>
                  {activity.slice(0, 5).map((run) => (
                    <TouchableOpacity key={run.id} activeOpacity={0.85} onPress={() => setSelectedRun(run)}>
                      <FloatingCard style={styles.activityCard}>
                        <IconAvatar
                          icon={run.status === "FAILED" ? "close" : run.status === "SENT" ? "checkmark" : "time-outline"}
                          tone={run.status === "SENT" ? "success" : run.status === "FAILED" ? "error" : "neutral"}
                          size={38}
                        />
                        <View style={styles.activityCopy}>
                          <Text style={styles.activityTitle}>{AUTOMATION_LABELS[run.type] ?? run.type}</Text>
                          <Text style={styles.activityMeta} numberOfLines={1}>
                            {run.status === "SENT" ? "Sent" : run.status === "FAILED" ? (run.failureReason ?? "Failed") : "Checking eligibility"}
                            {" · "}
                            {formatRelative(run.sentAt ?? run.createdAt)}
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color="#C7D2CB" />
                      </FloatingCard>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>

      <Modal visible={!!selectedRun} transparent animationType="fade" onRequestClose={() => setSelectedRun(null)}>
        <View style={styles.modalScrim}>
          <View style={styles.modalCard}>
            {selectedRun ? (
              <>
                <View style={styles.modalHeaderRow}>
                  <Text style={styles.modalTitle}>{AUTOMATION_LABELS[selectedRun.type] ?? selectedRun.type}</Text>
                  <TouchableOpacity onPress={() => setSelectedRun(null)} style={styles.modalClose}>
                    <Ionicons name="close" size={18} color="#282828" />
                  </TouchableOpacity>
                </View>
                <StatusPill
                  label={`${selectedRun.status === "SENT" ? "Sent" : selectedRun.status === "FAILED" ? "Failed" : "Checking eligibility"} · ${formatRelative(selectedRun.sentAt ?? selectedRun.createdAt)}`}
                  tone={selectedRun.status === "SENT" ? "success" : selectedRun.status === "FAILED" ? "error" : "neutral"}
                />
                <Text style={styles.modalDetailLabel}>Order / sales detail</Text>
                <Text style={styles.modalDetailText}>{describeRun(selectedRun)}</Text>
                {selectedRun.status === "FAILED" && selectedRun.failureReason ? (
                  <>
                    <Text style={styles.modalDetailLabel}>Why it failed</Text>
                    <Text style={[styles.modalDetailText, { color: "#D6552F" }]}>{selectedRun.failureReason}</Text>
                  </>
                ) : null}
                <Text style={styles.modalHint}>
                  "Influenced" means Eki sent this message and the buyer had not already completed the action it prompted.
                </Text>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  sectionTitle: { fontSize: 18, fontFamily: "Manrope-ExtraBold", color: "#12221A" },
  automationRow: { flexDirection: "row", alignItems: "center", padding: 14, gap: 12 },
  automationCopy: { flex: 1 },
  automationTitle: { fontSize: 14, fontFamily: "Manrope-Bold", color: "#151E1B" },
  automationBody: { fontSize: 12, lineHeight: 17, fontFamily: "Outfit-Regular", color: "#6A7B72", marginTop: 2 },
  viewAllLink: { fontSize: 12, fontFamily: "Manrope-Bold", color: "#076B51" },
  notifBanner: { flexDirection: "row", alignItems: "center", gap: 12 },
  notifBannerTitle: { fontSize: 13, fontFamily: "Manrope-Bold", color: "#151E1B" },
  notifBannerBody: { fontSize: 11, fontFamily: "Outfit-Regular", color: "#6A7B72", marginTop: 2, lineHeight: 15 },
  activityCard: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  activityCopy: { flex: 1 },
  activityTitle: { fontSize: 13, fontFamily: "Manrope-Bold", color: "#151E1B" },
  activityMeta: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#6A7B72", marginTop: 2 },
  modalScrim: { flex: 1, backgroundColor: "rgba(11,33,25,0.55)", justifyContent: "center", padding: 24 },
  modalCard: { backgroundColor: "#FFFFFF", borderRadius: 26, padding: 22, gap: 4 },
  modalHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  modalTitle: { fontSize: 17, fontFamily: "Manrope-Bold", color: "#151E1B", flex: 1 },
  modalClose: { width: 30, height: 30, borderRadius: 15, backgroundColor: "#F4F4F4", alignItems: "center", justifyContent: "center" },
  modalDetailLabel: { fontSize: 11, fontFamily: "Manrope-SemiBold", color: "#8AA194", marginTop: 14, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.4 },
  modalDetailText: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#282828", lineHeight: 18 },
  modalHint: { fontSize: 11, fontFamily: "Outfit-Regular", color: "#B0B0B0", marginTop: 16, lineHeight: 15 },
});
