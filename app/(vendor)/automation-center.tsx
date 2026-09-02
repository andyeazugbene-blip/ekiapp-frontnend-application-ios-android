import React, { useCallback, useState } from "react";
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
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
  AUTOMATION_LABELS,
  CONFIGURABLE_AUTOMATION_TYPES,
  type AutomationRun,
  type AutomationType,
  type VendorAutomation,
} from "../../services/automationService";

// Preset choices per the doc's config screens (Cart Recovery reminder delay,
// Buyer Win-Back inactivity window). Only types in CONFIGURABLE_AUTOMATION_TYPES
// get a configurator at all.
const CONFIG_PRESETS: Partial<Record<AutomationType, { key: string; label: string; options: number[]; unit: string }>> = {
  CART_RECOVERY: { key: "reminderHours", label: "Remind buyers after", options: [1, 4, 24], unit: "h" },
  BUYER_WIN_BACK: { key: "inactivityDays", label: "Inactivity window", options: [30, 60, 90], unit: "d" },
};

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
  const [expandedType, setExpandedType] = useState<AutomationType | null>(null);
  const [savingConfigType, setSavingConfigType] = useState<AutomationType | null>(null);
  const [selectedRun, setSelectedRun] = useState<AutomationRun | null>(null);

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

  const handleConfigOption = async (type: AutomationType, key: string, value: number) => {
    const prev = automations.find((a) => a.type === type)?.config ?? {};
    const nextConfig = { ...prev, [key]: value };
    setAutomations((list) => list.map((a) => (a.type === type ? { ...a, config: nextConfig } : a)));
    setSavingConfigType(type);
    try {
      const setting = automations.find((a) => a.type === type);
      await automationService.setVendorAutomation(type, setting?.enabled ?? true, nextConfig);
    } catch {
      setAutomations((list) => list.map((a) => (a.type === type ? { ...a, config: prev } : a)));
    } finally {
      setSavingConfigType(null);
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
            <View style={[premiumStyles.block, { gap: 10 }]}>
              {automations.map((a) => {
                const preset = CONFIG_PRESETS[a.type];
                const isConfigurable = CONFIGURABLE_AUTOMATION_TYPES.includes(a.type) && preset;
                const isExpanded = expandedType === a.type;
                return (
                  <FloatingCard key={a.type} style={{ padding: 0, overflow: "hidden" }}>
                    <TouchableOpacity
                      activeOpacity={isConfigurable ? 0.8 : 1}
                      disabled={!isConfigurable}
                      onPress={() => setExpandedType(isExpanded ? null : a.type)}
                      style={styles.automationRow}
                    >
                      <IconAvatar icon={ICON_FOR_TYPE[a.type] ?? "flash-outline"} tone={a.enabled ? "success" : "neutral"} />
                      <View style={styles.automationCopy}>
                        <Text style={styles.automationTitle}>{AUTOMATION_LABELS[a.type] ?? a.type}</Text>
                        <Text style={styles.automationBody} numberOfLines={2}>{a.description}</Text>
                      </View>
                      {isConfigurable ? (
                        <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={16} color="#8AA194" style={{ marginRight: 2 }} />
                      ) : null}
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
                    </TouchableOpacity>

                    {isConfigurable && isExpanded ? (
                      <View style={styles.configPanel}>
                        <Text style={styles.configLabel}>{preset!.label}</Text>
                        <View style={styles.configOptions}>
                          {preset!.options.map((value) => {
                            const current = a.config?.[preset!.key] ?? value;
                            const selected = current === value;
                            return (
                              <TouchableOpacity
                                key={value}
                                onPress={() => void handleConfigOption(a.type, preset!.key, value)}
                                disabled={savingConfigType === a.type}
                                activeOpacity={0.8}
                                style={[styles.configChip, selected && styles.configChipActive]}
                              >
                                <Text style={[styles.configChipText, selected && styles.configChipTextActive]}>
                                  {value}{preset!.unit}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                          {savingConfigType === a.type ? <ActivityIndicator size="small" color="#076B51" /> : null}
                        </View>
                      </View>
                    ) : null}
                  </FloatingCard>
                );
              })}
            </View>

            <View style={premiumStyles.block}>
              <View style={styles.sectionRow}>
                <Text style={styles.sectionTitle}>Recent activity</Text>
                {recentFailures > 0 ? <StatusPill label={`${recentFailures} failed`} tone="error" /> : null}
              </View>

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
                  {activity.map((run) => (
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
  configPanel: { paddingHorizontal: 14, paddingBottom: 14, paddingTop: 4, borderTopWidth: 1, borderTopColor: "#F0F0F0" },
  configLabel: { fontSize: 12, fontFamily: "Manrope-SemiBold", color: "#6A7B72", marginBottom: 8 },
  configOptions: { flexDirection: "row", gap: 8, alignItems: "center" },
  configChip: { paddingHorizontal: 14, height: 34, borderRadius: 17, backgroundColor: "#F0F3F1", alignItems: "center", justifyContent: "center" },
  configChipActive: { backgroundColor: "#076B51" },
  configChipText: { fontSize: 12, fontFamily: "Manrope-Bold", color: "#6A7B72" },
  configChipTextActive: { color: "#FFFFFF" },
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
