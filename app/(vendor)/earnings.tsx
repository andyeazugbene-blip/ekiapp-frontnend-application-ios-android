import React, { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { goBackOrReplace } from "../../utils/navigation";
import { Ionicons } from "@expo/vector-icons";
import { payoutService } from "../../services/payoutService";
import { VendorEarnings, Payout } from "../../types/order";
import { useCurrencyStore } from "../../stores/currencyStore";
import { CurrencySelector } from "../../components/ui/CurrencySelector";
import { formatDisplayMoney } from "../../utils/currency";

function formatPayoutDate(value: string): string {
  try {
    return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return value;
  }
}

export default function EarningsScreen() {
  const router = useRouter();
  const [earnings, setEarnings] = useState<VendorEarnings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [payoutsOpen, setPayoutsOpen] = useState(true);
  const [modeOpen, setModeOpen] = useState(true);
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const selectedCurrency = useCurrencyStore((state) => state.selectedCurrency);
  const ensureCurrency = useCurrencyStore((state) => state.ensureCurrency);
  const setSelectedCurrency = useCurrencyStore((state) => state.setSelectedCurrency);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await payoutService.getEarnings();
      setEarnings(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load earnings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const available = earnings?.availableBalance ?? 0;
  const pending = earnings?.pendingPayout ?? 0;
  const recentPayouts: Payout[] = earnings?.recentPayouts ?? [];
  const payoutEligible = available > 0;
  const payoutModeLabel = earnings?.payoutMode === "weekly" ? "Weekly release" : "Per order release";

  React.useEffect(() => {
    ensureCurrency(earnings?.currency).catch(() => undefined);
  }, [earnings?.currency, ensureCurrency]);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => goBackOrReplace(router, "/(vendor)" as any)} activeOpacity={0.85} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "#F0F0F0", alignItems: "center", justifyContent: "center", marginRight: 8 }}>
            <Ionicons name="arrow-back" size={18} color="#202124" />
          </TouchableOpacity>
          <View style={styles.earningsLabel}>
            <Text style={styles.earningsLabelText}>Your Earnings</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <TouchableOpacity activeOpacity={0.85} style={styles.walletButton} onPress={() => setCurrencyOpen(true)}>
              <Text style={styles.walletButtonText}>{selectedCurrency}</Text>
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.85} onPress={() => router.push("/(vendor)/settings" as any)} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "#F0F0F0", alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="settings-outline" size={18} color="#202124" />
            </TouchableOpacity>
          </View>
        </View>
        <Text style={styles.balanceLabel}>Available Balance</Text>
        <Text style={styles.balanceValue}>{formatDisplayMoney(available, earnings?.currency, selectedCurrency)}</Text>
        <View style={styles.readyBadge}>
          <Text style={styles.readyBadgeText}>{payoutEligible ? "Eligible for release" : "Waiting for release"}</Text>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {loading && !earnings ? (
          <View style={styles.placeholder}>
            <ActivityIndicator color="#076B51" size="large" />
          </View>
        ) : (
          <>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <View style={styles.pendingCard}>
              <View style={styles.pendingTop}>
                <Text style={styles.pendingLabel}>Pending Balance</Text>
                <Ionicons name="time-outline" size={18} color="#FFFFFF" />
              </View>
              <Text style={styles.pendingValue}>{formatDisplayMoney(pending, earnings?.currency, selectedCurrency)}</Text>
              <View style={styles.progressBarWrapper}>
                <View style={styles.progressBarTrack} />
                <View style={[styles.progressBarFill, { width: pending > 0 ? "75%" : "0%" }]} />
                <View style={[styles.progressDot, styles.dotActive, { left: "0%" }]} />
                <View style={[styles.progressDot, pending > 0 ? styles.dotActive : styles.dotInactive, { left: "33%" }]} />
                <View style={[styles.progressDot, pending > 0 ? styles.dotActive : styles.dotInactive, { left: "66%" }]} />
                <View style={[styles.progressDot, styles.dotInactive, { left: "100%" }]} />
              </View>
              <Text style={styles.pendingSub}>Pending funds become available after the order is fulfilled and any required review is complete.</Text>
            </View>

            <View style={styles.accordionSection}>
              <TouchableOpacity activeOpacity={0.85} onPress={() => setPayoutsOpen(!payoutsOpen)} style={styles.accordionHeader}>
                <Text style={styles.sectionTitle}>Recent payouts</Text>
                <Ionicons name={payoutsOpen ? "chevron-up" : "chevron-down"} size={20} color="#076B51" />
              </TouchableOpacity>

              {payoutsOpen ? (
                <View style={styles.accordionBody}>
                  {recentPayouts.length === 0 ? (
                    <Text style={styles.emptyText}>No payouts yet — request a payout when your available balance is ready.</Text>
                  ) : (
                    recentPayouts.map((payout) => {
                      return (
                        <View key={payout.id} style={styles.payoutItem}>
                          <View style={styles.payoutLeft}>
                            <View style={styles.payoutIconWrap}>
                              <Ionicons name="checkmark" size={16} color="#076B51" />
                            </View>
                            <Text style={styles.payoutAmount}>{formatDisplayMoney(payout.amount, payout.currency, selectedCurrency)}</Text>
                          </View>
                          <View style={styles.payoutRight}>
                            <Text style={styles.payoutStatus}>{payout.status.replace(/\b\w/g, (char) => char.toUpperCase())}</Text>
                            <Text style={styles.payoutDate}>{formatPayoutDate(payout.createdAt)}</Text>
                          </View>
                        </View>
                      );
                    })
                  )}
                </View>
              ) : null}
            </View>
            {recentPayouts.length > 0 ? (
              <TouchableOpacity
                onPress={() => router.push("/(vendor)/payout-history" as any)}
                activeOpacity={0.85}
                style={styles.viewAllButton}
              >
                <Text style={styles.viewAllButtonText}>View all payouts</Text>
                <Ionicons name="arrow-forward" size={14} color="#076B51" />
              </TouchableOpacity>
            ) : null}

            <View style={styles.accordionSection}>
              <TouchableOpacity activeOpacity={0.85} onPress={() => setModeOpen(!modeOpen)} style={styles.accordionHeader}>
                <Text style={styles.sectionTitle}>Current payout mode</Text>
                <Ionicons name={modeOpen ? "chevron-up" : "chevron-down"} size={20} color="#076B51" />
              </TouchableOpacity>

              {modeOpen ? (
                <View style={styles.accordionBody}>
                  <View style={styles.modeItem}>
                    <Text style={styles.modeText}>{payoutModeLabel}</Text>
                    <View style={[styles.statusChip, styles.statusChipActive]}>
                      <Text style={styles.statusChipText}>Synced</Text>
                    </View>
                  </View>
                  <Text style={styles.modeNote}>
                    Release timing follows the live payout rules on the backend. Payout destination accounts are managed in payout settings.
                  </Text>
                  <TouchableOpacity
                    onPress={() => router.push("/(vendor)/payout-mode" as any)}
                    activeOpacity={0.85}
                    style={styles.secondaryButton}
                  >
                    <Text style={styles.secondaryButtonText}>Manage payout methods</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>

            <View style={styles.protectionCard}>
              <Ionicons name="shield-checkmark" size={16} color="#076B51" />
              <Text style={styles.protectionText}>Pending balance becomes available after fulfillment review. Available balance can be paid out.</Text>
            </View>

            <TouchableOpacity
              onPress={() => payoutEligible && router.push("/(vendor)/withdraw-payout" as any)}
              activeOpacity={0.85}
              style={[styles.withdrawButton, !payoutEligible && styles.disabled]}
              disabled={!payoutEligible}
            >
              <Text style={styles.withdrawButtonText}>{payoutEligible ? "Request Payout" : "No Available Payout Yet"}</Text>
            </TouchableOpacity>
          </>
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
  balanceLabel: { fontSize: 13, fontFamily: "Outfit-Regular", color: "rgba(255,255,255,0.55)" },
  balanceValue: { fontSize: 34, fontFamily: "Manrope-Bold", color: "#FFFFFF", marginTop: 4 },
  readyBadge: { backgroundColor: "rgba(7,107,81,0.18)", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 5, alignSelf: "flex-start", marginTop: 10 },
  readyBadgeText: { fontSize: 11, fontFamily: "Outfit-Medium", color: "#00E6A6" },
  scrollContent: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 60 },
  placeholder: { paddingVertical: 80, alignItems: "center" },
  errorText: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#FB6363", textAlign: "center", marginBottom: 16 },
  pendingCard: { backgroundColor: "#076B51", borderRadius: 24, padding: 20, marginBottom: 20 },
  pendingTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  pendingLabel: { fontSize: 13, fontFamily: "Outfit-Regular", color: "rgba(255,255,255,0.75)" },
  pendingValue: { fontSize: 30, fontFamily: "Manrope-Bold", color: "#FFFFFF", marginTop: 6 },
  progressBarWrapper: { height: 6, backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 3, marginTop: 18, marginBottom: 12, position: "relative" },
  progressBarTrack: { ...StyleSheet.absoluteFill },
  progressBarFill: { height: "100%", backgroundColor: "#FFFFFF", borderRadius: 3 },
  progressDot: { width: 10, height: 10, borderRadius: 5, position: "absolute", top: -2 },
  dotActive: { backgroundColor: "#FFFFFF", borderWidth: 1.5, borderColor: "#076B51" },
  dotInactive: { backgroundColor: "rgba(255,255,255,0.3)" },
  pendingSub: { fontSize: 12, fontFamily: "Outfit-Regular", color: "rgba(255,255,255,0.75)", marginTop: 6, lineHeight: 18 },
  accordionSection: { backgroundColor: "#FFFFFF", borderRadius: 20, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 14, borderWidth: 1, borderColor: "#EAEAEA" },
  accordionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  accordionBody: { marginTop: 14, borderTopWidth: 1, borderTopColor: "#F5F5F5", paddingTop: 12 },
  sectionTitle: { fontSize: 16, fontFamily: "Manrope-Bold", color: "#076B51" },
  emptyText: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#858585", textAlign: "center", paddingVertical: 12 },
  payoutItem: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#FAFAFA" },
  payoutLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  payoutIconWrap: { width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(7,107,81,0.08)", alignItems: "center", justifyContent: "center" },
  payoutAmount: { fontSize: 16, fontFamily: "Manrope-Bold", color: "#282828" },
  payoutRight: { alignItems: "flex-end" },
  payoutStatus: { fontSize: 13, fontFamily: "Manrope-Bold", color: "#076B51" },
  payoutDate: { fontSize: 11, fontFamily: "Outfit-Regular", color: "#858585", marginTop: 2 },
  modeItem: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#F9F9F9", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 8, borderWidth: 1, borderColor: "#EFEFEF" },
  modeText: { fontSize: 14, fontFamily: "Outfit-Medium", color: "#282828" },
  statusChip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  statusChipActive: { backgroundColor: "rgba(7,107,81,0.10)" },
  statusChipText: { fontSize: 11, fontFamily: "Manrope-Bold", color: "#076B51" },
  modeNote: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#858585", marginTop: 6 },
  secondaryButton: { height: 46, borderRadius: 12, borderWidth: 1, borderColor: "#D5E4DC", alignItems: "center", justifyContent: "center", marginTop: 12 },
  secondaryButtonText: { fontSize: 14, fontFamily: "Manrope-SemiBold", color: "#076B51" },
  protectionCard: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(7,107,81,0.05)", borderWidth: 1, borderColor: "rgba(7,107,81,0.15)", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 18 },
  protectionText: { flex: 1, fontSize: 12, fontFamily: "Outfit-Medium", color: "#282828" },
  withdrawButton: { height: 54, borderRadius: 14, backgroundColor: "#076B51", alignItems: "center", justifyContent: "center" },
  withdrawButtonText: { fontSize: 16, fontFamily: "Manrope-SemiBold", color: "#FFFFFF" },
  disabled: { opacity: 0.55 },
  viewAllButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, marginTop: 6 },
  viewAllButtonText: { fontSize: 13, fontFamily: "Manrope-SemiBold", color: "#076B51" },
});
