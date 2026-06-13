import React, { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { payoutService, type PayoutRequest } from "../../services/payoutService";
import { useCurrencyStore } from "../../stores/currencyStore";
import { CurrencySelector } from "../../components/ui/CurrencySelector";
import { formatDisplayMoney } from "../../utils/currency";
import { goBackOrReplace } from "../../utils/navigation";

function formatPayoutDate(value: string): string {
  try {
    return new Date(value).toLocaleDateString("en-GB", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return value;
  }
}

const STATUS_COLORS: Record<string, string> = {
  pending: "#F4A100",
  approved: "#0076D6",
  processing: "#6B5BFF",
  paid: "#076B51",
  rejected: "#FB6363",
};

export default function PayoutHistoryScreen() {
  const router = useRouter();
  const [payouts, setPayouts] = useState<PayoutRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const selectedCurrency = useCurrencyStore((state) => state.selectedCurrency);
  const setSelectedCurrency = useCurrencyStore((state) => state.setSelectedCurrency);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      setError("");
      payoutService.getPayoutHistory()
        .then((data) => {
          if (!cancelled) setPayouts(data);
        })
        .catch((err) => {
          if (!cancelled) setError(err instanceof Error ? err.message : "Could not load payout history.");
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => { cancelled = true; };
    }, []),
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => goBackOrReplace(router, "/(vendor)/earnings" as any)} activeOpacity={0.85} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "#F0F0F0", alignItems: "center", justifyContent: "center", marginRight: 8 }}>
            <Ionicons name="arrow-back" size={18} color="#202124" />
          </TouchableOpacity>
          <View style={styles.earningsLabel}>
            <Text style={styles.earningsLabelText}>Payout History</Text>
          </View>
          <TouchableOpacity activeOpacity={0.85} style={styles.walletButton} onPress={() => setCurrencyOpen(true)}>
            <Text style={styles.walletButtonText}>{selectedCurrency}</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.headerSubtitle}>All your past and pending payout requests</Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {loading ? (
          <View style={styles.placeholder}>
            <ActivityIndicator color="#076B51" size="large" />
          </View>
        ) : error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : payouts.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="receipt-outline" size={40} color="#C5C5C5" />
            <Text style={styles.emptyTitle}>No payouts yet</Text>
            <Text style={styles.emptyText}>Your payout requests will appear here after you make your first withdrawal.</Text>
            <TouchableOpacity
              onPress={() => router.push("/(vendor)/earnings" as any)}
              activeOpacity={0.85}
              style={styles.primaryButton}
            >
              <Text style={styles.primaryButtonText}>Go to Earnings</Text>
            </TouchableOpacity>
          </View>
        ) : (
          payouts.map((payout) => {
            const statusColor = STATUS_COLORS[payout.status] ?? "#858585";
            return (
              <View key={payout.id} style={styles.payoutCard}>
                <View style={styles.payoutHeader}>
                  <Text style={styles.payoutAmount}>
                    {formatDisplayMoney(payout.amount, payout.currency, selectedCurrency)}
                  </Text>
                  <View style={[styles.statusBadge, { backgroundColor: `${statusColor}18` }]}>
                    <Text style={[styles.statusText, { color: statusColor }]}>
                      {payout.status.charAt(0).toUpperCase() + payout.status.slice(1)}
                    </Text>
                  </View>
                </View>
                <Text style={styles.payoutDate}>{formatPayoutDate(payout.createdAt)}</Text>
                {payout.method ? (
                  <Text style={styles.payoutMethod}>Via {payout.method}</Text>
                ) : null}
              </View>
            );
          })
        )}
      </ScrollView>

      <CurrencySelector
        selectedCurrency={selectedCurrency}
        onChange={setSelectedCurrency}
        visible={currencyOpen}
        onClose={() => setCurrencyOpen(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9F9F9" },
  header: { backgroundColor: "#121212", paddingHorizontal: 20, paddingTop: 20, paddingBottom: 26, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  headerTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  earningsLabel: { backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
  earningsLabelText: { fontSize: 12, fontFamily: "Outfit-Medium", color: "#FFFFFF" },
  walletButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(255,255,255,0.08)", alignItems: "center", justifyContent: "center" },
  walletButtonText: { fontSize: 11, fontFamily: "Manrope-Bold", color: "#FFFFFF" },
  headerSubtitle: { fontSize: 13, fontFamily: "Outfit-Regular", color: "rgba(255,255,255,0.55)" },
  scrollContent: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 60 },
  placeholder: { paddingVertical: 80, alignItems: "center" },
  errorText: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#FB6363", textAlign: "center", marginBottom: 16 },
  emptyState: { alignItems: "center", paddingTop: 60, paddingHorizontal: 20 },
  emptyTitle: { fontSize: 18, fontFamily: "Manrope-Bold", color: "#282828", marginTop: 12 },
  emptyText: { fontSize: 14, fontFamily: "Outfit-Regular", color: "#858585", textAlign: "center", marginTop: 8, lineHeight: 20 },
  primaryButton: { marginTop: 24, height: 50, borderRadius: 14, backgroundColor: "#076B51", alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
  primaryButtonText: { fontSize: 15, fontFamily: "Manrope-SemiBold", color: "#FFFFFF" },
  payoutCard: { backgroundColor: "#FFFFFF", borderRadius: 20, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: "#EAEAEA" },
  payoutHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  payoutAmount: { fontSize: 20, fontFamily: "Manrope-Bold", color: "#282828" },
  statusBadge: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  statusText: { fontSize: 12, fontFamily: "Manrope-Bold" },
  payoutDate: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#858585", marginTop: 8 },
  payoutMethod: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#687076", marginTop: 4 },
});
