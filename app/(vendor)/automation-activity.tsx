import React, { useCallback, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useFocusRefresh } from "../../hooks/useFocusRefresh";
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
  VENDOR_AUTOMATION_TYPES,
  type AutomationRun,
  type AutomationType,
} from "../../services/automationService";

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

export default function AutomationActivityScreen() {
  const router = useRouter();
  const { type: initialType } = useLocalSearchParams<{ type?: string }>();
  const [activity, setActivity] = useState<AutomationRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<AutomationType | "ALL">((initialType as AutomationType) ?? "ALL");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setActivity(await automationService.listVendorActivity(100));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load automation activity.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusRefresh(load);

  const typesPresent = useMemo(
    () => VENDOR_AUTOMATION_TYPES.filter((t) => activity.some((r) => r.type === t)),
    [activity],
  );
  const filtered = filter === "ALL" ? activity : activity.filter((r) => r.type === filter);

  return (
    <View style={premiumStyles.page}>
      <PremiumHeader title="Automation activity" onBack={() => goBackOrReplace(router, "/(vendor)/automation-center" as any)} />

      <ScrollView style={{ flex: 1 }} contentContainerStyle={[premiumStyles.scrollContent, { paddingTop: 18 }]} showsVerticalScrollIndicator={false}>
        {loading ? (
          <LoadingBlock />
        ) : error ? (
          <View style={premiumStyles.block}><ErrorState message={error} onRetry={() => void load()} /></View>
        ) : (
          <View style={[premiumStyles.block, { gap: 14 }]}>
            {typesPresent.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
                <TouchableOpacity onPress={() => setFilter("ALL")} activeOpacity={0.85} style={[styles.chip, filter === "ALL" && styles.chipActive]}>
                  <Text style={[styles.chipText, filter === "ALL" && styles.chipTextActive]}>All</Text>
                </TouchableOpacity>
                {typesPresent.map((t) => (
                  <TouchableOpacity key={t} onPress={() => setFilter(t)} activeOpacity={0.85} style={[styles.chip, filter === t && styles.chipActive]}>
                    <Text style={[styles.chipText, filter === t && styles.chipTextActive]}>{AUTOMATION_LABELS[t]}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : null}

            {filtered.length === 0 ? (
              <FloatingCard>
                <EmptyState icon="pulse-outline" title="No activity yet" body="Automation activity will appear here after Eki begins sending messages." />
              </FloatingCard>
            ) : (
              <View style={{ gap: 8 }}>
                {filtered.map((run) => (
                  <FloatingCard key={run.id} style={styles.activityCard}>
                    <IconAvatar
                      icon={run.status === "FAILED" ? "close" : run.status === "SENT" ? "checkmark" : "time-outline"}
                      tone={run.status === "SENT" ? "success" : run.status === "FAILED" ? "error" : "neutral"}
                      size={38}
                    />
                    <View style={styles.activityCopy}>
                      <Text style={styles.activityTitle}>{AUTOMATION_LABELS[run.type] ?? run.type}</Text>
                      <View style={{ marginTop: 4 }}>
                        <StatusPill
                          label={run.status === "SENT" ? "Sent" : run.status === "FAILED" ? (run.failureReason ?? "Failed") : "Checking eligibility"}
                          tone={run.status === "SENT" ? "success" : run.status === "FAILED" ? "error" : "neutral"}
                        />
                      </View>
                      <Text style={styles.activityMeta}>{formatRelative(run.sentAt ?? run.createdAt)}</Text>
                    </View>
                  </FloatingCard>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  filterRow: { gap: 8, paddingBottom: 2 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 14, backgroundColor: "#F4F6F5" },
  chipActive: { backgroundColor: "#076B51" },
  chipText: { fontSize: 12, fontFamily: "Manrope-SemiBold", color: "#516A60" },
  chipTextActive: { color: "#FFFFFF" },
  activityCard: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  activityCopy: { flex: 1 },
  activityTitle: { fontSize: 13, fontFamily: "Manrope-Bold", color: "#151E1B" },
  activityMeta: { fontSize: 11, fontFamily: "Outfit-Regular", color: "#8AA194", marginTop: 4 },
});
