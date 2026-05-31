import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { payoutService } from "../../services/payoutService";
import { payoutMethodService, type PayoutMethod } from "../../services/payoutMethodService";
import { VendorEarnings } from "../../types/order";

const CURRENCY_SYMBOL: Record<string, string> = { GBP: "£", USD: "$", EUR: "€" };
const MIN_WITHDRAWAL = 50;

export default function WithdrawPayoutScreen() {
  const router = useRouter();

  const [earnings, setEarnings] = useState<VendorEarnings | null>(null);
  const [methods, setMethods] = useState<PayoutMethod[]>([]);
  const [selectedMethodId, setSelectedMethodId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [e, m] = await Promise.all([
          payoutService.getEarnings(),
          payoutMethodService.list(),
        ]);
        if (cancelled) return;
        setEarnings(e);
        setMethods(m);
        const def = m.find((x) => x.isDefault) ?? m[0];
        if (def) setSelectedMethodId(def.id);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load payout details.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const symbol = CURRENCY_SYMBOL[earnings?.currency ?? "GBP"] ?? "£";
  const available = earnings?.availableBalance ?? 0;
  const selectedMethod = useMemo(
    () => methods.find((m) => m.id === selectedMethodId) ?? null,
    [methods, selectedMethodId]
  );

  const handleSubmit = async () => {
    setError("");
    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError("Enter a valid amount.");
      return;
    }
    if (parsed < MIN_WITHDRAWAL) {
      setError(`Minimum withdrawal is ${symbol}${MIN_WITHDRAWAL}.`);
      return;
    }
    if (parsed > available) {
      setError("Amount exceeds your available balance.");
      return;
    }
    if (!selectedMethod) {
      setError("Please add or choose a payout method first.");
      return;
    }

    setSubmitting(true);
    try {
      const request = await payoutService.requestPayout(parsed, selectedMethod.id);
      router.replace({ pathname: "/(vendor)/payout-requested", params: { id: request.id, amount: String(parsed) } } as any);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not request payout.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.85} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color="#282828" />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>Withdraw payout</Text>
          <Text style={styles.headerSubtitle}>Transfer your earnings to your destination account.</Text>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {loading ? (
          <View style={styles.placeholder}>
            <ActivityIndicator color="#076B51" />
          </View>
        ) : (
          <>
            <View style={styles.balanceCard}>
              <Text style={styles.balanceLabel}>Available Balance</Text>
              <Text style={styles.balanceValue}>{symbol}{available.toFixed(2)}</Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Amount to withdraw</Text>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Amount</Text>
                <View style={styles.inputWrap}>
                  <TextInput
                    style={styles.input}
                    placeholder={`${symbol}0.00`}
                    placeholderTextColor="#858585"
                    value={amount}
                    onChangeText={(t) => { setAmount(t); if (error) setError(""); }}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>

              <View style={styles.quickAmounts}>
                {["100", "250", "500", "1000"].map((val) => (
                  <TouchableOpacity key={val} onPress={() => setAmount(val)} activeOpacity={0.85} style={styles.quickAmount}>
                    <Text style={styles.quickAmountText}>{symbol}{val}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.infoRow}>
                <Ionicons name="information-circle-outline" size={16} color="#858585" />
                <Text style={styles.infoText}>Minimum withdrawal: {symbol}{MIN_WITHDRAWAL}. Processing time: 1–3 business days.</Text>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Destination account</Text>

              {selectedMethod ? (
                <View style={styles.payoutMethod}>
                  <Ionicons
                    name={selectedMethod.type === "bank" ? "business-outline" : selectedMethod.type === "stripe" ? "card-outline" : "logo-paypal"}
                    size={20}
                    color="#076B51"
                  />
                  <View style={styles.payoutInfo}>
                    <Text style={styles.payoutName}>
                      {selectedMethod.bankName ?? selectedMethod.label ?? selectedMethod.type}
                    </Text>
                    <Text style={styles.payoutAccount}>
                      {selectedMethod.last4 ? `••••${selectedMethod.last4}` : selectedMethod.email ?? ""}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => router.push("/(vendor)/payout-mode" as any)} activeOpacity={0.85}>
                    <Text style={styles.changeText}>Change</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  onPress={() => router.push("/(vendor)/payment-details" as any)}
                  activeOpacity={0.85}
                  style={styles.addMethodRow}
                >
                  <Ionicons name="add-circle-outline" size={20} color="#076B51" />
                  <Text style={styles.addMethodText}>Add a payout method</Text>
                </TouchableOpacity>
              )}
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <TouchableOpacity
              onPress={handleSubmit}
              activeOpacity={0.85}
              style={[styles.primaryButton, (submitting || !selectedMethod) && { opacity: 0.6 }]}
              disabled={submitting || !selectedMethod}
            >
              <Text style={styles.primaryButtonText}>
                {submitting ? "Submitting..." : "Withdraw Now"}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F4F4F4" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 16, gap: 12, backgroundColor: "#FFFFFF" },
  backButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#F4F4F4", alignItems: "center", justifyContent: "center" },
  headerInfo: { flex: 1 },
  headerTitle: { fontSize: 24, fontFamily: "Manrope-Bold", color: "#282828" },
  headerSubtitle: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#858585", marginTop: 4, lineHeight: 18 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 40 },
  placeholder: { paddingVertical: 60, alignItems: "center" },
  balanceCard: { backgroundColor: "#076B51", borderRadius: 20, padding: 20, alignItems: "center", marginBottom: 16 },
  balanceLabel: { fontSize: 14, fontFamily: "Outfit-Regular", color: "rgba(255,255,255,0.7)" },
  balanceValue: { fontSize: 28, fontFamily: "Manrope-Bold", color: "#FFFFFF", marginTop: 4 },
  card: { backgroundColor: "#FFFFFF", borderRadius: 30, padding: 20, marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontFamily: "Manrope-Bold", color: "#282828", marginBottom: 16 },
  fieldGroup: { marginBottom: 16 },
  fieldLabel: { fontSize: 14, fontFamily: "Outfit-Medium", color: "#858585", marginBottom: 6 },
  inputWrap: { backgroundColor: "#F4F4F4", borderRadius: 10 },
  input: { height: 55, paddingHorizontal: 15, fontSize: 18, fontFamily: "Manrope-Bold", color: "#282828" },
  quickAmounts: { flexDirection: "row", gap: 10, marginBottom: 16 },
  quickAmount: { flex: 1, height: 40, borderRadius: 10, backgroundColor: "#F4F4F4", alignItems: "center", justifyContent: "center" },
  quickAmountText: { fontSize: 14, fontFamily: "Manrope-SemiBold", color: "#282828" },
  infoRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  infoText: { flex: 1, fontSize: 12, fontFamily: "Outfit-Regular", color: "#858585" },
  payoutMethod: { flexDirection: "row", alignItems: "center", gap: 12 },
  payoutInfo: { flex: 1 },
  payoutName: { fontSize: 14, fontFamily: "Manrope-Bold", color: "#282828" },
  payoutAccount: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#858585", marginTop: 2 },
  changeText: { fontSize: 14, fontFamily: "Manrope-SemiBold", color: "#076B51" },
  addMethodRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8 },
  addMethodText: { fontSize: 14, fontFamily: "Manrope-SemiBold", color: "#076B51" },
  errorText: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#FB6363", textAlign: "center", marginBottom: 12 },
  primaryButton: { height: 56, borderRadius: 14, backgroundColor: "#076B51", alignItems: "center", justifyContent: "center" },
  primaryButtonText: { fontSize: 16, fontFamily: "Manrope-SemiBold", color: "#FFFFFF" },
});
