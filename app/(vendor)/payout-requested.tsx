import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";

export default function PayoutRequestedScreen() {
  const router = useRouter();
  const { id, amount, currency } = useLocalSearchParams<{ id?: string; amount?: string; currency?: string }>();

  const symbolMap: Record<string, string> = { GBP: "£", USD: "$", EUR: "€" };
  const symbol = symbolMap[currency ?? "GBP"] ?? "£";
  const parsedAmount = amount ? Number(amount) : null;

  return (
    <View style={styles.page}>
      <View style={styles.iconCircle}>
        <Ionicons name="checkmark" size={40} color="#076B51" />
      </View>

      <Text style={styles.title}>Payout requested</Text>
      <Text style={styles.body}>
        We've received your request. We'll notify you once your money has been sent.
      </Text>

      {parsedAmount ? (
        <View style={styles.summaryBlock}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Amount</Text>
            <Text style={styles.summaryValue}>{symbol}{parsedAmount.toFixed(2)}</Text>
          </View>
          {id ? (
            <View style={[styles.summaryRow, { borderTopWidth: 1, borderTopColor: "#F4F4F4", paddingTop: 8, marginTop: 8 }]}>
              <Text style={styles.summaryLabel}>Reference</Text>
              <Text style={styles.summaryValue}>{id}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      <TouchableOpacity
        onPress={() => router.push("/(vendor)/earnings" as any)}
        activeOpacity={0.85}
        style={styles.primaryButton}
      >
        <Text style={styles.primaryButtonText}>View Earnings</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#F4F4F4", alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
  iconCircle: { width: 92, height: 92, borderRadius: 46, backgroundColor: "#E8F4ED", alignItems: "center", justifyContent: "center" },
  title: { fontSize: 26, fontFamily: "Manrope-ExtraBold", color: "#1A1A1A", marginTop: 26, textAlign: "center" },
  body: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#6A7B72", lineHeight: 20, marginTop: 10, textAlign: "center" },
  summaryBlock: { width: "100%", marginTop: 22, backgroundColor: "#FFFFFF", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#E8E8E8" },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  summaryLabel: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#858585" },
  summaryValue: { fontSize: 14, fontFamily: "Manrope-Bold", color: "#282828" },
  primaryButton: { marginTop: 28, minHeight: 52, minWidth: 220, borderRadius: 14, backgroundColor: "#076B51", alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
  primaryButtonText: { fontSize: 14, fontFamily: "Manrope-SemiBold", color: "#FFFFFF" },
});
