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

// Doc §"Workstream 2" per-automation explainer copy (Screens 09-13). Only
// covers the types a vendor can actually see/toggle — CAMPAIGN_* types are
// buyer-facing and never reach this screen.
const EXPLAINER: Partial<Record<AutomationType, string>> = {
  FIRST_SALE: "Eki guides new stores through completing their store, sharing their store link, creating an introductory offer, and following up with interested buyers — to help your store get its first completed order.",
  CART_RECOVERY: "Eki reminds eligible buyers when they leave foodstuff without completing payment.",
  BUYER_WIN_BACK: "Eki reconnects with buyers who have not ordered recently.",
  REVIEW_REQUEST: "Eki asks buyers to review a completed order.",
  LOW_STOCK_ALERT: "Eki lets you know when your foodstuff is running low so buyers aren't disappointed.",
  BUYER_REFERRAL: "Eki rewards buyers who introduce new customers to your store. A referral qualifies only after the new buyer's first order is paid and completed.",
  PAYMENT_RECOVERY: "Eki follows up when a payment for an order or renewal fails, so you don't lose the sale.",
  RENEWAL_REMINDER: "Eki reminds Regular Delivery subscribers before their next renewal is charged.",
  PRICE_APPROVAL_REMINDER: "Eki reminds buyers when a price change on their Regular Delivery needs their approval.",
};

const CONFIG_PRESETS: Partial<Record<AutomationType, { key: string; label: string; options: number[]; unit: string }>> = {
  CART_RECOVERY: { key: "reminderHours", label: "Remind buyers after", options: [1, 4, 24], unit: "h" },
  BUYER_WIN_BACK: { key: "inactivityDays", label: "Inactivity window", options: [30, 60, 90], unit: "d" },
};

export default function AutomationDetailScreen() {
  const router = useRouter();
  const { type } = useLocalSearchParams<{ type?: string }>();
  const automationType = (type ?? "") as AutomationType;
  const isValidType = VENDOR_AUTOMATION_TYPES.includes(automationType);

  const [automation, setAutomation] = useState<VendorAutomation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toggling, setToggling] = useState(false);
  const [savingConfigKey, setSavingConfigKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isValidType) { setLoading(false); return; }
    setLoading(true);
    setError("");
    try {
      const list = await automationService.listVendorAutomations();
      const found = list.find((a) => a.type === automationType);
      if (!found) throw new Error("Automation not found");
      setAutomation(found);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load this automation.");
    } finally {
      setLoading(false);
    }
  }, [automationType, isValidType]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

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
          <ErrorState message={error || "This automation is not available."} onRetry={() => void load()} />
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
              <Text style={styles.explainer}>{EXPLAINER[automationType] ?? automation.description}</Text>

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
