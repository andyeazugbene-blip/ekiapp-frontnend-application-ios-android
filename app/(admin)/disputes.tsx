import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { adminService, type AdminDispute, type AdminEscrowHealth, type AdminUser } from "../../services/adminService";

function formatDateTime(value?: string) {
  if (!value) return "Awaiting review";
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return value;
  return new Date(parsed).toLocaleString("en-GB", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatSummaryAmount(value: number, currency = "GBP") {
  return `${currency.toUpperCase()} ${(value / 100).toFixed(2)}`;
}

function toTitleCase(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function resolveBuyerName(dispute: AdminDispute, buyers: AdminUser[]) {
  const match = buyers.find((buyer) => buyer.id === dispute.buyerId);
  if (match?.name) return match.name;
  if (match?.email) return match.email;
  return dispute.buyerId ? `Buyer ${dispute.buyerId.slice(0, 6)}` : "Unknown buyer";
}

function resolveIssueTone(dispute: AdminDispute) {
  const status = dispute.status.toUpperCase();
  if (status.includes("OPEN") || status.includes("PENDING")) return "awaiting";
  if (status.includes("INVESTIGATION") || status.includes("REVIEW")) return "urgent";
  if (status.includes("READY")) return "ready";
  if (status.includes("RESOLVED")) return "resolved";
  return "awaiting";
}

export default function AdminDisputesScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [disputes, setDisputes] = useState<AdminDispute[]>([]);
  const [escrowHealth, setEscrowHealth] = useState<AdminEscrowHealth | null>(null);
  const [buyers, setBuyers] = useState<AdminUser[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [nextDisputes, nextHealth, nextBuyers] = await Promise.all([
        adminService.getDisputes({ limit: 50 }).catch(() => []),
        adminService.getEscrowHealth().catch(() => null),
        adminService.getUsers({ role: "buyer" }).catch(() => []),
      ]);
      setDisputes(nextDisputes);
      setEscrowHealth(nextHealth);
      setBuyers(nextBuyers);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load disputes.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const urgentDisputes = useMemo(
    () => disputes.filter((dispute) => resolveIssueTone(dispute) === "urgent").length,
    [disputes],
  );
  const awaitingDisputes = useMemo(
    () => disputes.filter((dispute) => resolveIssueTone(dispute) === "awaiting").length,
    [disputes],
  );
  const paymentsOnHold = escrowHealth?.statusBreakdown?.HELD_IN_ESCROW?.count ?? escrowHealth?.outstandingOrders ?? 0;
  const readyForRelease =
    escrowHealth?.statusBreakdown?.READY_FOR_RELEASE?.count ??
    escrowHealth?.statusBreakdown?.DELIVERED?.count ??
    0;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.85} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color="#0A6C52" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Disputes</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionHeading}>Reported issues</Text>

        <View style={styles.summaryRow}>
          <SummaryPill tone="soft" label="Disputes" value={String(disputes.length).padStart(2, "0")} />
          <SummaryPill tone="danger" label="Urgent" value={String(urgentDisputes).padStart(2, "0")} />
          <SummaryPill tone="warning" label="Awaiting" value={String(awaitingDisputes).padStart(2, "0")} />
        </View>

        <Text style={[styles.sectionHeading, styles.queueTitle]}>Dispute queue</Text>

        {loading ? (
          <View style={styles.stateCard}>
            <ActivityIndicator color="#0A6C52" />
          </View>
        ) : error ? (
          <View style={styles.stateCard}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : disputes.length === 0 ? (
          <View style={styles.stateCard}>
            <Ionicons name="shield-checkmark-outline" size={30} color="#BFC8C3" />
            <Text style={styles.emptyTitle}>No disputes right now</Text>
            <Text style={styles.emptyBody}>Fresh buyer-vendor issues will appear here as soon as they are opened.</Text>
          </View>
        ) : (
          disputes.slice(0, 3).map((dispute) => {
            const tone = resolveIssueTone(dispute);
            return (
              <View key={dispute.id} style={styles.disputeCard}>
                <View style={styles.disputeCardTop}>
                  <View style={styles.orderTag}>
                    <Text style={styles.orderTagText}>
                      {dispute.order?.orderNumber ? `Order ${dispute.order.orderNumber}` : `Order ${dispute.id.slice(0, 6)}`}
                    </Text>
                  </View>
                  <View style={styles.timeRow}>
                    <Ionicons name="time-outline" size={14} color="#8B9196" />
                    <Text style={styles.timeText}>{formatDateTime(dispute.createdAt)}</Text>
                  </View>
                </View>

                <View style={styles.metaTable}>
                  <MetaRow label="Buyer:" value={resolveBuyerName(dispute, buyers)} />
                  <MetaRow label="Issue:" value={dispute.reason || "Issue reported"} />
                  <MetaRow label="Status:" value={toTitleCase(dispute.status)} tone={tone} />
                </View>

                <View style={styles.actionRow}>
                  <TouchableOpacity
                    onPress={() => router.push({ pathname: "/(admin)/dispute-detail", params: { id: dispute.id } } as any)}
                    activeOpacity={0.85}
                    style={styles.secondaryAction}
                  >
                    <Text style={styles.secondaryActionText}>
                      {tone === "ready" ? "Release payment" : "View Details"}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => router.push({ pathname: "/(admin)/dispute-detail", params: { id: dispute.id } } as any)}
                    activeOpacity={0.85}
                    style={[
                      styles.primaryAction,
                      tone === "ready" ? styles.primaryActionDark : undefined,
                    ]}
                  >
                    <Text style={styles.primaryActionText}>
                      {tone === "ready" ? "Hold payment" : "Resolve Dispute"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}

        <Text style={[styles.sectionHeading, styles.queueTitle]}>Escrow decision summary</Text>

        <View style={styles.summaryCardsRow}>
          <SummaryCard
            icon="hand-left-outline"
            label="Payments on hold"
            value={String(paymentsOnHold).padStart(2, "0")}
            tone="soft"
            footer={escrowHealth ? formatSummaryAmount(escrowHealth.outstandingAmount, escrowHealth.currency) : undefined}
          />
          <SummaryCard
            icon="rocket-outline"
            label="Ready for release"
            value={String(readyForRelease).padStart(2, "0")}
            tone="cool"
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function MetaRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "urgent" | "awaiting" | "ready" | "resolved";
}) {
  const toneStyle =
    tone === "urgent"
      ? styles.metaValueUrgent
      : tone === "awaiting"
        ? styles.metaValueAwaiting
        : tone === "ready"
          ? styles.metaValueReady
          : styles.metaValueDefault;

  return (
    <View style={styles.metaRow}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={[styles.metaValue, toneStyle]}>{value}</Text>
    </View>
  );
}

function SummaryPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "soft" | "danger" | "warning";
}) {
  return (
    <View
      style={[
        styles.summaryPill,
        tone === "danger" ? styles.summaryPillDanger : tone === "warning" ? styles.summaryPillWarning : styles.summaryPillSoft,
      ]}
    >
      <Text style={styles.summaryPillLabel}>{label}:</Text>
      <Text
        style={[
          styles.summaryPillValue,
          tone === "danger" ? styles.summaryPillValueDanger : tone === "warning" ? styles.summaryPillValueWarning : styles.summaryPillValueSoft,
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  tone,
  footer,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  value: string;
  tone: "soft" | "cool";
  footer?: string;
}) {
  return (
    <View style={styles.summaryCard}>
      <View style={[styles.summaryCardIcon, tone === "cool" ? styles.summaryCardIconCool : undefined]}>
        <Ionicons name={icon} size={22} color="#0A6C52" />
      </View>
      <Text style={styles.summaryCardLabel}>{label}</Text>
      <Text style={styles.summaryCardValue}>{value}</Text>
      {footer ? <Text style={styles.summaryCardFooter}>{footer}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F4F4F4" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 12,
  },
  backButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#ECEFEC",
  },
  headerTitle: {
    fontSize: 30,
    lineHeight: 36,
    fontFamily: "Manrope-ExtraBold",
    color: "#282828",
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 118,
  },
  sectionHeading: {
    fontSize: 19,
    lineHeight: 24,
    fontFamily: "Manrope-ExtraBold",
    color: "#282828",
    marginTop: 18,
    marginBottom: 14,
  },
  summaryRow: {
    flexDirection: "row",
    gap: 12,
  },
  summaryPill: {
    flex: 1,
    borderRadius: 28,
    paddingVertical: 17,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  summaryPillSoft: { backgroundColor: "#E7F5F0", borderColor: "#B7DED0" },
  summaryPillDanger: { backgroundColor: "#FFF0F0", borderColor: "#F5CACA" },
  summaryPillWarning: { backgroundColor: "#FFF7E7", borderColor: "#E8D59C" },
  summaryPillLabel: { fontSize: 13, fontFamily: "Manrope-SemiBold", color: "#2B2B2B" },
  summaryPillValue: { fontSize: 18, fontFamily: "Manrope-ExtraBold", marginTop: 4 },
  summaryPillValueSoft: { color: "#0A6C52" },
  summaryPillValueDanger: { color: "#FF7B7B" },
  summaryPillValueWarning: { color: "#C69015" },
  queueTitle: { marginTop: 28 },
  stateCard: {
    borderRadius: 28,
    backgroundColor: "#FFFFFF",
    paddingVertical: 28,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  errorText: { color: "#D92D20", fontSize: 13, fontFamily: "Outfit-Regular", textAlign: "center" },
  emptyTitle: { color: "#282828", fontSize: 17, fontFamily: "Manrope-Bold", marginTop: 10 },
  emptyBody: { color: "#7B8388", fontSize: 13, fontFamily: "Outfit-Regular", marginTop: 6, textAlign: "center" },
  disputeCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 30,
    padding: 16,
    marginBottom: 16,
  },
  disputeCardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 18,
  },
  orderTag: {
    borderRadius: 16,
    backgroundColor: "#EAF7F1",
    borderWidth: 1,
    borderColor: "#BDE1D1",
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  orderTagText: {
    color: "#0A6C52",
    fontSize: 14,
    fontFamily: "Manrope-Bold",
  },
  timeRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  timeText: { color: "#8B9196", fontSize: 12, fontFamily: "Outfit-Regular" },
  metaTable: { gap: 12 },
  metaRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
  },
  metaLabel: {
    flex: 1,
    color: "#8A8F94",
    fontSize: 13,
    fontFamily: "Outfit-Regular",
  },
  metaValue: {
    flex: 1,
    textAlign: "right",
    fontSize: 13,
    fontFamily: "Manrope-SemiBold",
  },
  metaValueDefault: { color: "#282828" },
  metaValueUrgent: { color: "#E06464" },
  metaValueAwaiting: { color: "#7A6A20" },
  metaValueReady: { color: "#0A6C52" },
  metaValueResolved: { color: "#0A6C52" },
  actionRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 18,
  },
  secondaryAction: {
    flex: 1,
    minHeight: 52,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: "#0A6C52",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryActionText: {
    color: "#0A6C52",
    fontSize: 15,
    fontFamily: "Manrope-Bold",
  },
  primaryAction: {
    flex: 1,
    minHeight: 52,
    borderRadius: 18,
    backgroundColor: "#0A6C52",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryActionDark: {
    backgroundColor: "#0B6F56",
  },
  primaryActionText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontFamily: "Manrope-Bold",
  },
  summaryCardsRow: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 12,
  },
  summaryCard: {
    flex: 1,
    minHeight: 168,
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    padding: 18,
  },
  summaryCardIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#EEF8F3",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  summaryCardIconCool: {
    backgroundColor: "#EEF5FF",
  },
  summaryCardLabel: {
    color: "#8A8F94",
    fontSize: 13,
    lineHeight: 18,
    fontFamily: "Outfit-Regular",
  },
  summaryCardValue: {
    color: "#282828",
    fontSize: 34,
    lineHeight: 40,
    fontFamily: "Manrope-ExtraBold",
    marginTop: 10,
  },
  summaryCardFooter: {
    color: "#0A6C52",
    fontSize: 12,
    lineHeight: 17,
    fontFamily: "Manrope-SemiBold",
    marginTop: 10,
  },
});
