import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { goBackOrReplace } from "../../utils/navigation";
import {
  ErrorState,
  FloatingCard,
  LoadingBlock,
  PremiumHeader,
  StatusPill,
  premiumStyles,
  type Tone,
} from "../../components/shared/PremiumBlocks";
import {
  communityBuyService,
  SUPPORT_CASE_STATUS_LABELS,
  SUPPORT_CASE_TYPE_LABELS,
  type SupportCase,
  type SupportCaseType,
} from "../../services/communityBuyService";

const CASE_TYPES: SupportCaseType[] = ["PAYMENT_ISSUE", "REFUND_ISSUE", "FULFILMENT_ISSUE", "ORGANISER_CONDUCT", "SUPPLIER_CONDUCT", "OTHER"];

const STATUS_TONE: Record<string, Tone> = {
  OPEN: "warning",
  IN_PROGRESS: "success",
  ESCALATED: "error",
  RESOLVED: "success",
  CLOSED: "neutral",
};

function formatDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export default function CommunityBuySupportCasesScreen() {
  const router = useRouter();
  const { campaignId, campaignTitle } = useLocalSearchParams<{ campaignId?: string; campaignTitle?: string }>();

  const [cases, setCases] = useState<SupportCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(Boolean(campaignId));
  const [caseType, setCaseType] = useState<SupportCaseType>("OTHER");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setCases(await communityBuyService.listMySupportCases());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load your support cases.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleSubmit = async () => {
    if (!campaignId) return;
    if (!description.trim()) return Alert.alert("Description required", "Tell us what went wrong.");
    setSubmitting(true);
    try {
      await communityBuyService.createSupportCase(campaignId, { caseType, description: description.trim() });
      setDescription("");
      setShowForm(false);
      Alert.alert("Reported", "We've received your report and will follow up.");
      await load();
    } catch (err) {
      Alert.alert("Couldn't submit this", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={premiumStyles.page}>
      <PremiumHeader title="Support cases" onBack={() => goBackOrReplace(router, "/(buyer)/community-buy" as any)} />

      <ScrollView style={{ flex: 1 }} contentContainerStyle={[premiumStyles.scrollContent, { paddingTop: 18 }]} showsVerticalScrollIndicator={false}>
        <View style={[premiumStyles.block, { gap: 14 }]}>
          {campaignId ? (
            <FloatingCard style={{ gap: 10 }}>
              <View style={styles.formHeaderRow}>
                <Text style={styles.formTitle}>Report an issue{campaignTitle ? ` — ${campaignTitle}` : ""}</Text>
                <TouchableOpacity onPress={() => setShowForm((v) => !v)} activeOpacity={0.85}>
                  <Ionicons name={showForm ? "chevron-up" : "chevron-down"} size={18} color="#151E1B" />
                </TouchableOpacity>
              </View>
              {showForm ? (
                <>
                  <Text style={styles.label}>Type</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.typeRow}>
                    {CASE_TYPES.map((t) => (
                      <TouchableOpacity key={t} onPress={() => setCaseType(t)} activeOpacity={0.85} style={[styles.typeChip, caseType === t && styles.typeChipActive]}>
                        <Text style={[styles.typeChipText, caseType === t && styles.typeChipTextActive]}>{SUPPORT_CASE_TYPE_LABELS[t]}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                  <Text style={styles.label}>What happened?</Text>
                  <TextInput
                    style={[styles.input, styles.inputMultiline]}
                    placeholder="Describe the issue in detail"
                    placeholderTextColor="#8AA194"
                    value={description}
                    onChangeText={setDescription}
                    multiline
                  />
                  <TouchableOpacity onPress={() => void handleSubmit()} disabled={submitting} activeOpacity={0.88} style={styles.primaryBtn}>
                    {submitting ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.primaryBtnText}>Submit report</Text>}
                  </TouchableOpacity>
                </>
              ) : null}
            </FloatingCard>
          ) : null}

          <Text style={styles.section}>My reports</Text>
          {loading ? (
            <LoadingBlock />
          ) : error ? (
            <ErrorState message={error} onRetry={() => void load()} />
          ) : cases.length === 0 ? (
            <Text style={styles.emptyText}>No reports yet.</Text>
          ) : (
            <View style={{ gap: 8 }}>
              {cases.map((c) => {
                const isExpanded = expandedId === c.id;
                return (
                  <TouchableOpacity key={c.id} activeOpacity={0.85} onPress={() => setExpandedId(isExpanded ? null : c.id)}>
                    <FloatingCard style={{ gap: 4 }}>
                      <View style={styles.cardTop}>
                        <Text style={styles.cardTitle} numberOfLines={1}>{c.campaign?.title ?? "Campaign"}</Text>
                        <StatusPill label={SUPPORT_CASE_STATUS_LABELS[c.status]} tone={STATUS_TONE[c.status] ?? "neutral"} />
                      </View>
                      <Text style={styles.cardMeta}>{SUPPORT_CASE_TYPE_LABELS[c.caseType]} · {formatDate(c.createdAt)}</Text>
                      {isExpanded ? (
                        <View style={styles.expandedBlock}>
                          <Text style={styles.expandedLabel}>Your report</Text>
                          <Text style={styles.expandedText}>{c.description}</Text>
                          {c.customerVisibleResponse ? (
                            <>
                              <Text style={styles.expandedLabel}>Response from Eki</Text>
                              <Text style={styles.expandedText}>{c.customerVisibleResponse}</Text>
                            </>
                          ) : (
                            <Text style={styles.expandedHint}>No response yet — we'll notify you when there's an update.</Text>
                          )}
                        </View>
                      ) : null}
                    </FloatingCard>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  formHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  formTitle: { flex: 1, fontSize: 14, fontFamily: "Manrope-Bold", color: "#151E1B" },
  label: { fontSize: 12, fontFamily: "Manrope-SemiBold", color: "#516A60" },
  typeRow: { gap: 8, paddingVertical: 4 },
  typeChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, backgroundColor: "#F4F6F5" },
  typeChipActive: { backgroundColor: "#076B51" },
  typeChipText: { fontSize: 12, fontFamily: "Manrope-SemiBold", color: "#151E1B" },
  typeChipTextActive: { color: "#FFFFFF" },
  input: { backgroundColor: "#F4F6F5", borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, fontFamily: "Outfit-Regular", color: "#151E1B" },
  inputMultiline: { minHeight: 80, textAlignVertical: "top" },
  primaryBtn: { minHeight: 48, borderRadius: 14, backgroundColor: "#076B51", alignItems: "center", justifyContent: "center" },
  primaryBtnText: { fontSize: 14, fontFamily: "Manrope-Bold", color: "#FFFFFF" },
  section: { fontSize: 15, fontFamily: "Manrope-ExtraBold", color: "#12221A" },
  emptyText: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#6A7B72", paddingVertical: 12, textAlign: "center" },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  cardTitle: { flex: 1, fontSize: 14, fontFamily: "Manrope-Bold", color: "#151E1B" },
  cardMeta: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#6A7B72" },
  expandedBlock: { marginTop: 8, borderTopWidth: 1, borderTopColor: "#F0F0F0", paddingTop: 8, gap: 4 },
  expandedLabel: { fontSize: 11, fontFamily: "Outfit-Medium", color: "#8AA194", textTransform: "uppercase", letterSpacing: 0.3 },
  expandedText: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#151E1B", lineHeight: 18, marginBottom: 6 },
  expandedHint: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#8AA194" },
});
