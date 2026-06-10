import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { CurrencySelector } from "../../components/ui/CurrencySelector";
import { ApiRequestError } from "../../services/api";
import { adminService, type AdminDispute } from "../../services/adminService";
import { canAdminResolveDispute } from "../../services/escrowStatus";
import { useCurrencyStore } from "../../stores/currencyStore";
import { formatDisplayMoney } from "../../utils/currency";

function formatDate(iso?: string) {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleString("en-GB", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function DisputeDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [dispute, setDispute] = useState<AdminDispute | null>(null);
  const [loading, setLoading] = useState(true);
  const [resolutionNote, setResolutionNote] = useState("");
  const [refundAmount, setRefundAmount] = useState("");
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [currencyModalVisible, setCurrencyModalVisible] = useState(false);
  const selectedCurrency = useCurrencyStore((s) => s.selectedCurrency);
  const hydrateCurrency = useCurrencyStore((s) => s.hydrate);
  const setSelectedCurrency = useCurrencyStore((s) => s.setSelectedCurrency);
  const ensureCurrency = useCurrencyStore((s) => s.ensureCurrency);

  useEffect(() => {
    void hydrateCurrency();
  }, [hydrateCurrency]);

  const load = useCallback(async () => {
    if (!id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const nextDispute = await adminService.getDispute(id);
      setDispute(nextDispute);
      if (nextDispute.order?.currency) {
        await ensureCurrency(nextDispute.order.currency);
      }
    } catch {
      setDispute(null);
    } finally {
      setLoading(false);
    }
  }, [ensureCurrency, id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const handleResolve = async (resolution: "buyer" | "vendor" | "partial") => {
    if (!id || !dispute) return;
    if (!resolutionNote.trim()) {
      Alert.alert("Resolution note required", "Add a short note explaining the decision before resolving the dispute.");
      return;
    }

    const parsedRefundAmount = refundAmount.trim() ? Number(refundAmount) : undefined;
    if (parsedRefundAmount !== undefined && (!Number.isFinite(parsedRefundAmount) || parsedRefundAmount < 0)) {
      Alert.alert("Invalid refund amount", "Enter a valid refund amount in major currency units.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await adminService.resolveDispute(id, {
        resolution,
        note: resolutionNote.trim(),
        refundAmount: parsedRefundAmount,
        twoFactorCode: twoFactorCode.trim() || undefined,
      });
      Alert.alert("Dispute resolved", `Backend response: ${result.status.replace(/_/g, " ")}`);
      await load();
    } catch (err) {
      if (err instanceof ApiRequestError && err.code === "2FA_REQUIRED") {
        Alert.alert("2FA required", "Provide the admin 2FA code in the field before resolving this dispute.");
      } else if (err instanceof ApiRequestError && err.status === 409) {
        Alert.alert("Already resolved", err.message);
      } else {
        Alert.alert("Could not resolve dispute", err instanceof Error ? err.message : "Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.stateScreen}>
          <ActivityIndicator color="#076B51" />
        </View>
      </SafeAreaView>
    );
  }

  if (!dispute) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.stateScreen}>
          <Text style={styles.errorText}>Dispute not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const resolvable = canAdminResolveDispute(dispute);
  const disputeCurrency = dispute.order?.currency ?? "GBP";

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.85} style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Dispute Detail</Text>
        <TouchableOpacity onPress={() => setCurrencyModalVisible(true)} activeOpacity={0.85} style={styles.currencyButton}>
          <Text style={styles.currencyButtonText}>{selectedCurrency}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <View style={styles.statusRow}>
            <Text style={styles.disputeId}>{(dispute.id ?? id ?? "").slice(0, 8).toUpperCase()}</Text>
            <View style={[styles.statusBadge, resolvable ? styles.statusOpen : styles.statusResolved]}>
              <Text style={[styles.statusText, resolvable ? styles.statusTextOpen : styles.statusTextResolved]}>
                {dispute.status.replace(/_/g, " ")}
              </Text>
            </View>
          </View>
          <Text style={styles.disputeReason}>{dispute.reason || "Issue reported"}</Text>
          <Text style={styles.disputeDate}>Opened: {formatDate(dispute.createdAt)}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Order Case</Text>
          <InfoRow label="Payment provider" value={dispute.order?.paymentProvider ?? "Stripe"} />
          <InfoRow label="Order" value={dispute.order?.orderNumber ?? dispute.orderId} />
          <InfoRow
            label="Order amount"
            value={
              dispute.order ? formatDisplayMoney(dispute.order.totalAmount, disputeCurrency, selectedCurrency) : "-"
            }
          />
          <InfoRow
            label="Vendor earnings"
            value={
              dispute.order?.vendorEarnings !== undefined
                ? formatDisplayMoney(dispute.order.vendorEarnings, disputeCurrency, selectedCurrency)
                : "-"
            }
          />
          <InfoRow label="Delivery address" value={dispute.order?.deliveryAddress ?? "Unavailable"} />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Order Items</Text>
          {(dispute.order?.items ?? []).length === 0 ? (
            <Text style={styles.emptyCopy}>No order items were returned by the backend.</Text>
          ) : (
            dispute.order?.items?.map((item, index) => (
              <View key={`${item.productTitle}-${index}`} style={[styles.itemRow, index > 0 && styles.itemBorder]}>
                <Text style={styles.itemName}>{item.productTitle}</Text>
                <Text style={styles.itemMeta}>
                  {item.quantity} x {formatDisplayMoney(item.totalAmount ?? 0, disputeCurrency, selectedCurrency)}
                </Text>
              </View>
            ))
          )}
        </View>

        {resolvable ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Resolution</Text>
            <View style={styles.inputWrap}>
              <TextInput
                style={styles.textArea}
                placeholder="Enter the admin resolution note..."
                placeholderTextColor="#858585"
                value={resolutionNote}
                onChangeText={setResolutionNote}
                multiline
                textAlignVertical="top"
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Refund amount (optional, major currency)</Text>
              <View style={styles.singleLineInputWrap}>
                <TextInput
                  style={styles.singleLineInput}
                  placeholder="0.00"
                  placeholderTextColor="#858585"
                  keyboardType="decimal-pad"
                  value={refundAmount}
                  onChangeText={setRefundAmount}
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Admin 2FA code (only if backend requests it)</Text>
              <View style={styles.singleLineInputWrap}>
                <TextInput
                  style={styles.singleLineInput}
                  placeholder="123456"
                  placeholderTextColor="#858585"
                  keyboardType="number-pad"
                  value={twoFactorCode}
                  onChangeText={setTwoFactorCode}
                />
              </View>
            </View>

            <View style={styles.actionButtons}>
              <TouchableOpacity onPress={() => handleResolve("buyer")} activeOpacity={0.85} style={[styles.resolveButton, submitting && styles.disabled]} disabled={submitting}>
                <Text style={styles.resolveButtonText}>Refund Buyer</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleResolve("vendor")} activeOpacity={0.85} style={[styles.vendorButton, submitting && styles.disabled]} disabled={submitting}>
                <Text style={styles.vendorButtonText}>Release Funds to Vendor</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={() => handleResolve("partial")} activeOpacity={0.85} style={[styles.partialButton, submitting && styles.disabled]} disabled={submitting}>
              <Text style={styles.partialButtonText}>Mark Partial Resolution</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.resolvedCard}>
            <Ionicons name="checkmark-circle" size={24} color="#076B51" />
            <Text style={styles.resolvedText}>Dispute already resolved on the backend.</Text>
          </View>
        )}
      </ScrollView>

      <CurrencySelector
        selectedCurrency={selectedCurrency}
        onChange={setSelectedCurrency}
        visible={currencyModalVisible}
        onClose={() => setCurrencyModalVisible(false)}
      />
    </SafeAreaView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F4F4F4" },
  stateScreen: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  errorText: { color: "#FB6363", fontSize: 14, fontFamily: "Outfit-Regular" },
  header: {
    backgroundColor: "#076B51",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 30,
    borderBottomLeftRadius: 35,
    borderBottomRightRadius: 35,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 24, fontFamily: "Manrope-Bold", color: "#FFFFFF", flex: 1 },
  currencyButton: { minWidth: 66, height: 36, borderRadius: 18, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  currencyButtonText: { color: "#076B51", fontSize: 12, fontFamily: "Manrope-Bold" },
  scrollContent: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 40, gap: 16 },
  card: { backgroundColor: "#FFFFFF", borderRadius: 30, padding: 20 },
  statusRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 8 },
  disputeId: { fontSize: 18, fontFamily: "Manrope-Bold", color: "#282828" },
  statusBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  statusOpen: { backgroundColor: "rgba(251,99,99,0.1)" },
  statusResolved: { backgroundColor: "rgba(7,107,81,0.1)" },
  statusText: { fontSize: 12, fontFamily: "Outfit-Medium" },
  statusTextOpen: { color: "#FB6363" },
  statusTextResolved: { color: "#076B51" },
  disputeReason: { fontSize: 16, fontFamily: "Outfit-Medium", color: "#282828" },
  disputeDate: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#858585", marginTop: 4 },
  sectionTitle: { fontSize: 18, fontFamily: "Manrope-Bold", color: "#282828", marginBottom: 14 },
  infoRow: { flexDirection: "row", justifyContent: "space-between", gap: 12, paddingVertical: 6 },
  infoLabel: { fontSize: 14, fontFamily: "Outfit-Regular", color: "#858585", flex: 1 },
  infoValue: { fontSize: 14, fontFamily: "Manrope-Bold", color: "#282828", flex: 1, textAlign: "right" },
  emptyCopy: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#858585" },
  itemRow: { paddingVertical: 10 },
  itemBorder: { borderTopWidth: 1, borderTopColor: "#F4F4F4" },
  itemName: { fontSize: 14, fontFamily: "Manrope-Bold", color: "#282828" },
  itemMeta: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#858585", marginTop: 4 },
  inputWrap: { backgroundColor: "#F4F4F4", borderRadius: 14, marginBottom: 16 },
  textArea: { height: 100, paddingHorizontal: 16, paddingTop: 14, fontSize: 14, fontFamily: "Outfit-Regular", color: "#282828" },
  fieldGroup: { marginBottom: 14 },
  fieldLabel: { fontSize: 13, fontFamily: "Outfit-Medium", color: "#687076", marginBottom: 6 },
  singleLineInputWrap: { backgroundColor: "#F4F4F4", borderRadius: 14 },
  singleLineInput: { height: 52, paddingHorizontal: 16, fontSize: 14, fontFamily: "Outfit-Regular", color: "#282828" },
  actionButtons: { gap: 10 },
  resolveButton: { height: 50, borderRadius: 14, backgroundColor: "#076B51", alignItems: "center", justifyContent: "center" },
  resolveButtonText: { fontSize: 14, fontFamily: "Manrope-SemiBold", color: "#FFFFFF" },
  vendorButton: { height: 50, borderRadius: 14, borderWidth: 1, borderColor: "#076B51", alignItems: "center", justifyContent: "center" },
  vendorButtonText: { fontSize: 14, fontFamily: "Manrope-SemiBold", color: "#076B51" },
  partialButton: { height: 50, borderRadius: 14, backgroundColor: "#FFF8E8", alignItems: "center", justifyContent: "center", marginTop: 10 },
  partialButtonText: { fontSize: 14, fontFamily: "Manrope-SemiBold", color: "#B8860B" },
  resolvedCard: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#E8F4ED", borderRadius: 16, padding: 16 },
  resolvedText: { fontSize: 14, fontFamily: "Outfit-Medium", color: "#076B51" },
  disabled: { opacity: 0.6 },
});
