import React, { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { adminService, type AdminDispute, type AdminEscrowHealth } from "../../services/adminService";

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("en-GB", { month: "short", day: "numeric" });
  } catch {
    return iso;
  }
}

export default function DisputesScreen() {
  const router = useRouter();
  const [disputes, setDisputes] = useState<AdminDispute[]>([]);
  const [health, setHealth] = useState<AdminEscrowHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      setError("");

      Promise.all([
        adminService.getDisputes({ limit: 50 }).catch(() => []),
        adminService.getEscrowHealth().catch(() => null),
      ])
        .then(([nextDisputes, nextHealth]) => {
          if (cancelled) return;
          setDisputes(nextDisputes);
          setHealth(nextHealth);
        })
        .catch((err) => {
          if (!cancelled) setError(err instanceof Error ? err.message : "Could not load disputes.");
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });

      return () => {
        cancelled = true;
      };
    }, []),
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Dispute Management</Text>
        <Text style={styles.headerSubtitle}>Resolve buyer-vendor escrow disputes</Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {health ? (
          <View style={styles.healthCard}>
            <Text style={styles.healthTitle}>Escrow Health</Text>
            <View style={styles.healthGrid}>
              <HealthTile label="Outstanding orders" value={String(health.outstandingOrders)} />
              <HealthTile label="Outstanding amount" value={`${(health.outstandingAmount / 100).toFixed(2)} ${health.currency.toUpperCase()}`} />
            </View>
            <View style={styles.breakdownWrap}>
              {Object.entries(health.statusBreakdown).map(([status, data]) => (
                <View key={status} style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>{status.replace(/_/g, " ")}</Text>
                  <Text style={styles.breakdownValue}>{data.count} • {(data.amount / 100).toFixed(2)} {health.currency.toUpperCase()}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Active Disputes</Text>

          {loading ? (
            <ActivityIndicator color="#076B51" style={{ paddingVertical: 24 }} />
          ) : error ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : disputes.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="shield-checkmark-outline" size={32} color="#C5C5C5" />
              <Text style={styles.emptyText}>No disputes</Text>
            </View>
          ) : (
            disputes.map((dispute, index) => (
              <TouchableOpacity
                key={dispute.id}
                onPress={() => router.push({ pathname: "/(admin)/dispute-detail", params: { id: dispute.id } } as any)}
                activeOpacity={0.85}
                style={[styles.disputeItem, index < disputes.length - 1 && styles.disputeBorder]}
              >
                <View style={styles.disputeTop}>
                  <Text style={styles.disputeId}>{dispute.id.slice(0, 8).toUpperCase()}</Text>
                  <View style={[styles.statusBadge, dispute.status === "OPEN" ? styles.statusOpen : styles.statusResolved]}>
                    <Text style={[styles.statusText, dispute.status === "OPEN" ? styles.statusTextOpen : styles.statusTextResolved]}>
                      {dispute.status.replace(/_/g, " ")}
                    </Text>
                  </View>
                </View>
                <Text style={styles.disputeReason}>{dispute.reason || "Issue reported"}</Text>
                <Text style={styles.disputeParties}>
                  Order {dispute.order?.orderNumber ?? dispute.orderId}
                </Text>
                <View style={styles.disputeBottom}>
                  <Text style={styles.disputeOrder}>{dispute.order ? `${(dispute.order.totalAmount ?? 0).toFixed(2)} ${dispute.order.currency}` : "—"}</Text>
                  <Text style={styles.disputeDate}>{formatDate(dispute.createdAt)}</Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function HealthTile({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.healthTile}>
      <Text style={styles.healthTileLabel}>{label}</Text>
      <Text style={styles.healthTileValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F4F4F4" },
  header: { backgroundColor: "#076B51", paddingHorizontal: 20, paddingTop: 16, paddingBottom: 30, borderBottomLeftRadius: 35, borderBottomRightRadius: 35, gap: 6 },
  headerTitle: { fontSize: 30, fontFamily: "Manrope-Bold", lineHeight: 30, color: "#FFFFFF" },
  headerSubtitle: { fontSize: 16, fontFamily: "Outfit-Light", color: "#FFFFFF" },
  scrollContent: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 40, gap: 16 },
  healthCard: { backgroundColor: "#FFFFFF", borderRadius: 26, padding: 18 },
  healthTitle: { fontSize: 18, fontFamily: "Manrope-Bold", color: "#282828", marginBottom: 14 },
  healthGrid: { flexDirection: "row", gap: 12 },
  healthTile: { flex: 1, backgroundColor: "#F7F8F8", borderRadius: 16, padding: 14 },
  healthTileLabel: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#687076" },
  healthTileValue: { fontSize: 16, fontFamily: "Manrope-Bold", color: "#282828", marginTop: 6 },
  breakdownWrap: { marginTop: 16, gap: 8 },
  breakdownRow: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  breakdownLabel: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#687076" },
  breakdownValue: { fontSize: 13, fontFamily: "Manrope-Bold", color: "#282828" },
  card: { backgroundColor: "#FFFFFF", borderRadius: 30, padding: 20 },
  sectionTitle: { fontSize: 18, fontFamily: "Manrope-Bold", color: "#282828", marginBottom: 16 },
  emptyState: { alignItems: "center", paddingVertical: 24 },
  emptyText: { fontSize: 14, color: "#858585", marginTop: 8, fontFamily: "Outfit-Regular" },
  errorText: { fontSize: 13, color: "#FB6363", textAlign: "center", paddingVertical: 24, fontFamily: "Outfit-Regular" },
  disputeItem: { paddingVertical: 16 },
  disputeBorder: { borderBottomWidth: 1, borderBottomColor: "#F4F4F4" },
  disputeTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 6 },
  disputeId: { fontSize: 16, fontFamily: "Manrope-Bold", color: "#282828" },
  statusBadge: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  statusOpen: { backgroundColor: "rgba(251,99,99,0.1)" },
  statusResolved: { backgroundColor: "rgba(7,107,81,0.1)" },
  statusText: { fontSize: 11, fontFamily: "Outfit-Medium" },
  statusTextOpen: { color: "#FB6363" },
  statusTextResolved: { color: "#076B51" },
  disputeReason: { fontSize: 14, fontFamily: "Manrope-SemiBold", color: "#282828", marginBottom: 4 },
  disputeParties: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#858585", marginBottom: 8 },
  disputeBottom: { flexDirection: "row", justifyContent: "space-between" },
  disputeOrder: { fontSize: 12, fontFamily: "Manrope-SemiBold", color: "#076B51" },
  disputeDate: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#858585" },
});
