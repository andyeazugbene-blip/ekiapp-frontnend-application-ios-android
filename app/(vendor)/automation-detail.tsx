import React, { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { goBackOrReplace } from "../../utils/navigation";
import {
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
  CONFIGURABLE_AUTOMATION_TYPES,
  VENDOR_AUTOMATION_TYPES,
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

const CONFIG_PRESETS: Partial<Record<AutomationType, { key: string; label: string; options: number[]; unit: string }>> = {
  CART_RECOVERY: { key: "reminderHours", label: "Remind buyers after", options: [1, 4, 24], unit: "h" },
  BUYER_WIN_BACK: { key: "inactivityDays", label: "Inactivity window", options: [30, 60, 90], unit: "d" },
};

export default function AutomationDetailScreen() {
  const router = useRouter();
  const { type: rawType } = useLocalSearchParams<{ type?: string | string[] }>();
  // expo-router can hand back string[] for a query-style param depending on
  // how navigation reached this screen — casting straight to AutomationType
  // (as the previous code did) silently made VENDOR_AUTOMATION_TYPES.includes()
  // always false for an array value, with nothing distinguishing that from
  // a real network failure. Always resolve to a single string first.
  const type = Array.isArray(rawType) ? rawType[0] : rawType;
  const automationType = (type ?? "") as AutomationType;
  const isValidType = VENDOR_AUTOMATION_TYPES.includes(automationType);

  const [automation, setAutomation] = useState<VendorAutomation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toggling, setToggling] = useState(false);
  const [savingConfigKey, setSavingConfigKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    // A missing/invalid route param is a navigation problem, not a network
    // one — say so explicitly instead of falling through to "automation"
    // staying null with no error set, which rendered the generic "Check
    // your connection and try again" fallback for a completely different
    // real cause.
    if (!isValidType) {
      setLoading(false);
      setError(type ? `"${type}" isn't a recognized automation. Go back to Automation Center and try again.` : "No automation was specified. Go back to Automation Center and try again.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const list = await automationService.listVendorAutomations();
      const found = list.find((a) => a.type === automationType);
      if (!found) throw new Error(`This automation isn't available for your account yet. Go back to Automation Center and try again.`);
      setAutomation(found);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load this automation. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, [automationType, isValidType, type]);

  // useFocusEffect alone only reruns on a genuine focus event — if the
  // route param arrives or changes a tick after this screen is already
  // considered focused (a real timing edge case with useLocalSearchParams),
  // the stale "invalid type" result from the first pass would never be
  // retried. A plain effect keyed on the actual param value closes that gap.
  useFocusEffect(useCallback(() => { load(); }, [load]));
  React.useEffect(() => { load(); }, [load]);

  const handleToggle = async () => {
    if (!automation) return;
    const nextEnabled = !automation.enabled;
    setAutomation({ ...automation, enabled: nextEnabled });
    setToggling(true);
    try {
      await automationService.setVendorAutomation(automation.type, nextEnabled);
    } catch (err) {
      setAutomation({ ...automation, enabled: !nextEnabled });
    } finally {
      setToggling(false);
    }
  };

  const handleConfigOption = async (key: string, value: number) => {
    if (!automation) return;
    const nextConfig = { ...(automation.config ?? {}), [key]: value };
    const prevConfig = automation.config;
    setAutomation({ ...automation, config: nextConfig });
    setSavingConfigKey(key);
    try {
      await automationService.setVendorAutomation(automation.type, automation.enabled, nextConfig);
    } catch {
      setAutomation({ ...automation, config: prevConfig ?? null });
    } finally {
      setSavingConfigKey(null);
    }
  };

  const preset = automationType ? CONFIG_PRESETS[automationType] : undefined;
  const isConfigurable = automationType ? CONFIGURABLE_AUTOMATION_TYPES.includes(automationType) && preset : false;

  return (
    <View style={premiumStyles.page}>
      <PremiumHeader
        title={isValidType ? AUTOMATION_LABELS[automationType] : "Automation"}
        onBack={() => goBackOrReplace(router, "/(vendor)/automation-center" as any)}
      />

      {loading ? (
        <LoadingBlock />
      ) : error || !automation ? (
        <View style={premiumStyles.block}>
          <ErrorState
            title="We couldn't load this automation"
            message={error || "Check your connection and try again."}
            onRetry={() => void load()}
          />
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={[premiumStyles.scrollContent, { paddingTop: 18 }]} showsVerticalScrollIndicator={false}>
          <View style={[premiumStyles.block, { gap: 16 }]}>
            <FloatingCard style={{ gap: 14 }}>
              <View style={styles.headRow}>
                <IconAvatar icon={ICON_FOR_TYPE[automationType] ?? "flash-outline"} tone={automation.enabled ? "success" : "neutral"} size={52} />
                <View style={{ flex: 1 }}>
                  <StatusPill label={automation.enabled ? "Active" : "Not active"} tone={automation.enabled ? "success" : "neutral"} />
                </View>
              </View>
              <Text style={styles.explainer}>{AUTOMATION_EXPLAINER[automationType] ?? "Details for this automation are being prepared."}</Text>

              <TouchableOpacity onPress={() => void handleToggle()} disabled={toggling} activeOpacity={0.88} style={[styles.toggleBtn, automation.enabled && styles.toggleBtnActive]}>
                {toggling ? (
                  <ActivityIndicator color={automation.enabled ? "#FFFFFF" : "#076B51"} size="small" />
                ) : (
                  <Text style={[styles.toggleBtnText, automation.enabled && styles.toggleBtnTextActive]}>
                    {automation.enabled ? "Deactivate" : "Activate automation"}
                  </Text>
                )}
              </TouchableOpacity>
            </FloatingCard>

            {isConfigurable && preset ? (
              <View>
                <Text style={styles.sectionTitle}>{preset.label}</Text>
                <FloatingCard>
                  <View style={styles.configOptions}>
                    {preset.options.map((value) => {
                      const current = automation.config?.[preset.key] ?? value;
                      const selected = current === value;
                      return (
                        <TouchableOpacity
                          key={value}
                          onPress={() => void handleConfigOption(preset.key, value)}
                          disabled={savingConfigKey === preset.key}
                          activeOpacity={0.8}
                          style={[styles.configChip, selected && styles.configChipActive]}
                        >
                          <Text style={[styles.configChipText, selected && styles.configChipTextActive]}>{value}{preset.unit}</Text>
                        </TouchableOpacity>
                      );
                    })}
                    {savingConfigKey === preset.key ? <ActivityIndicator size="small" color="#076B51" /> : null}
                  </View>
                </FloatingCard>
              </View>
            ) : null}

            <TouchableOpacity onPress={() => router.push({ pathname: "/(vendor)/automation-activity", params: { type: automationType } } as any)} activeOpacity={0.85}>
              <FloatingCard style={styles.activityLinkRow}>
                <Ionicons name="pulse-outline" size={18} color="#076B51" />
                <Text style={styles.activityLinkText}>View activity for this automation</Text>
                <Ionicons name="chevron-forward" size={16} color="#C7D2CB" />
              </FloatingCard>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  headRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  explainer: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#4A5A52", lineHeight: 19 },
  toggleBtn: { minHeight: 50, borderRadius: 16, borderWidth: 1.5, borderColor: "#076B51", backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  toggleBtnActive: { backgroundColor: "#076B51" },
  toggleBtnText: { fontSize: 14, fontFamily: "Manrope-Bold", color: "#076B51" },
  toggleBtnTextActive: { color: "#FFFFFF" },
  sectionTitle: { fontSize: 15, fontFamily: "Manrope-ExtraBold", color: "#12221A", marginBottom: 10 },
  configOptions: { flexDirection: "row", gap: 8, alignItems: "center", flexWrap: "wrap" },
  configChip: { paddingHorizontal: 14, height: 38, borderRadius: 19, backgroundColor: "#F0F3F1", alignItems: "center", justifyContent: "center" },
  configChipActive: { backgroundColor: "#076B51" },
  configChipText: { fontSize: 13, fontFamily: "Manrope-Bold", color: "#6A7B72" },
  configChipTextActive: { color: "#FFFFFF" },
  activityLinkRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  activityLinkText: { flex: 1, fontSize: 13, fontFamily: "Manrope-SemiBold", color: "#151E1B" },
});
