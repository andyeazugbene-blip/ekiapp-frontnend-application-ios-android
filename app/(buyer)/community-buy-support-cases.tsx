import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { goBackOrReplace } from "../../utils/navigation";
import {
  communityBuyService,
  SUPPORT_CASE_STATUS_LABELS,
  SUPPORT_CASE_TYPE_LABELS,
  type SupportCase,
  type SupportCaseType,
} from "../../services/communityBuyService";

const CASE_TYPES: SupportCaseType[] = ["PAYMENT_ISSUE", "REFUND_ISSUE", "FULFILMENT_ISSUE", "ORGANISER_CONDUCT", "SUPPLIER_CONDUCT", "OTHER"];

const STATUS_COLOR: Record<string, { color: string; bg: string }> = {
  OPEN: { color: "#B48A00", bg: "rgba(255,197,0,0.15)" },
  IN_PROGRESS: { color: "#076B51", bg: "rgba(7,107,81,0.1)" },
  ESCALATED: { color: "#D6552F", bg: "rgba(214,85,47,0.12)" },
  RESOLVED: { color: "#076B51", bg: "rgba(7,107,81,0.1)" },
  CLOSED: { color: "#858585", bg: "#F4F4F4" },
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
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => goBackOrReplace(router, "/(buyer)/community-buy" as any)} activeOpacity={0.85} style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color="#282828" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Support cases</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {campaignId ? (
          <View style={styles.formCard}>
            <View style={styles.formHeaderRow}>
              <Text style={styles.formTitle}>Report an issue{campaignTitle ? ` — ${campaignTitle}` : ""}</Text>
              <TouchableOpacity onPress={() => setShowForm((v) => !v)} activeOpacity={0.85}>
                <Ionicons name={showForm ? "chevron-up" : "chevron-down"} size={18} color="#282828" />
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
                  placeholderTextColor="#9AA3A0"
                  value={description}
                  onChangeText={setDescription}
                  multiline
                />
                <TouchableOpacity onPress={() => void handleSubmit()} disabled={submitting} activeOpacity={0.88} style={styles.primaryBtn}>
                  {submitting ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.primaryBtnText}>Submit report</Text>}
                </TouchableOpacity>
              </>
            ) : null}
          </View>
        ) : null}

        <Text style={styles.section}>My reports</Text>
        {loading ? (
          <View style={styles.placeholder}><ActivityIndicator color="#076B51" /></View>
        ) : error ? (
          <View style={styles.emptyState}>
            <Ionicons name="alert-circle-outline" size={28} color="#D6552F" />
            <Text style={styles.emptyText}>{error}</Text>
            <TouchableOpacity onPress={() => void load()} activeOpacity={0.86} style={styles.retryButton}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : cases.length === 0 ? (
          <Text style={styles.emptyActivityText}>No reports yet.</Text>
        ) : (
          cases.map((c) => {
            const isExpanded = expandedId === c.id;
            const statusStyle = STATUS_COLOR[c.status] ?? STATUS_COLOR.OPEN;
            return (
              <TouchableOpacity key={c.id} activeOpacity={0.85} onPress={() => setExpandedId(isExpanded ? null : c.id)} style={styles.card}>
                <View style={styles.cardTop}>
                  <Text style={styles.cardTitle} numberOfLines={1}>{c.campaign?.title ?? "Campaign"}</Text>
                  <View style={[styles.badge, { backgroundColor: statusStyle.bg }]}>
                    <Text style={[styles.badgeText, { color: statusStyle.color }]}>{SUPPORT_CASE_STATUS_LABELS[c.status]}</Text>
                  </View>
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
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9F9F9" },
  header: { backgroundColor: "#FFFFFF", paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16, flexDirection: "row", alignItems: "center", gap: 12 },
  backButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#F4F4F4", alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, fontSize: 18, fontFamily: "Manrope-Bold", color: "#282828" },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 100, gap: 10 },
  placeholder: { paddingVertical: 40, alignItems: "center" },
  emptyState: { alignItems: "center", paddingVertical: 40, gap: 8 },
  emptyText: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#858585", textAlign: "center" },
  emptyActivityText: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#858585", paddingVertical: 12, textAlign: "center" },
  retryButton: { marginTop: 6, minHeight: 38, borderRadius: 12, borderWidth: 1, borderColor: "#076B51", paddingHorizontal: 18, alignItems: "center", justifyContent: "center" },
  retryButtonText: { fontSize: 13, fontFamily: "Manrope-SemiBold", color: "#076B51" },
  formCard: { backgroundColor: "#FFFFFF", borderRadius: 16, padding: 16, gap: 8 },
  formHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  formTitle: { flex: 1, fontSize: 14, fontFamily: "Manrope-Bold", color: "#282828" },
  label: { fontSize: 12, fontFamily: "Outfit-Medium", color: "#858585", marginTop: 4 },
  typeRow: { gap: 8, paddingVertical: 4 },
  typeChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, backgroundColor: "#F4F4F4" },
  typeChipActive: { backgroundColor: "#076B51" },
  typeChipText: { fontSize: 12, fontFamily: "Manrope-SemiBold", color: "#282828" },
  typeChipTextActive: { color: "#FFFFFF" },
  input: { backgroundColor: "#F4F4F4", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, fontFamily: "Outfit-Regular", color: "#282828" },
  inputMultiline: { minHeight: 80, textAlignVertical: "top" },
  primaryBtn: { minHeight: 48, borderRadius: 14, backgroundColor: "#076B51", alignItems: "center", justifyContent: "center", marginTop: 4 },
  primaryBtnText: { fontSize: 14, fontFamily: "Manrope-Bold", color: "#FFFFFF" },
  section: { fontSize: 15, fontFamily: "Manrope-Bold", color: "#282828", marginTop: 6 },
  card: { backgroundColor: "#FFFFFF", borderRadius: 14, padding: 14, gap: 4 },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  cardTitle: { flex: 1, fontSize: 14, fontFamily: "Manrope-Bold", color: "#282828" },
  cardMeta: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#858585" },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  badgeText: { fontSize: 10, fontFamily: "Manrope-Bold" },
  expandedBlock: { marginTop: 8, borderTopWidth: 1, borderTopColor: "#F0F0F0", paddingTop: 8, gap: 4 },
  expandedLabel: { fontSize: 11, fontFamily: "Outfit-Medium", color: "#858585", textTransform: "uppercase", letterSpacing: 0.3 },
  expandedText: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#282828", lineHeight: 18, marginBottom: 6 },
  expandedHint: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#B0B0B0" },
});
