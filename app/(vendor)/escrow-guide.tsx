import React from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { goBackOrReplace } from "../../utils/navigation";
import { Ionicons } from "@expo/vector-icons";

const STEPS = [
  ["Buyer pays", "The buyer pays through a supported secure checkout provider. The order remains protected while payment is confirmed."],
  ["Funds are secured", "Vendor earnings are held as pending balance. You can prepare the order, but payout is not released yet."],
  ["You confirm and dispatch", "Confirm the secured order, then mark it dispatched. For supported African escrow, the buyer receives a delivery OTP."],
  ["Buyer confirms delivery", "The buyer enters the OTP from the track-order flow after receiving the goods."],
  ["Funds release", "If the OTP is correct, or the protection window expires without a dispute, eligible funds move to available balance."],
  ["Disputes freeze release", "If a buyer opens a dispute, release pauses until admin reviews evidence and resolves the case."],
] as const;

export default function VendorEscrowGuideScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => goBackOrReplace(router, "/(vendor)/settings" as any)} activeOpacity={0.85} style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color="#17211D" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>How escrow works</Text>
          <Text style={styles.subtitle}>Protected payments keep buyers confident and vendors paid after confirmed delivery.</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Ionicons name="shield-checkmark" size={28} color="#FFFFFF" />
          <Text style={styles.heroTitle}>Your payout is protected by order state.</Text>
          <Text style={styles.heroText}>Never dispatch outside Eki for protected orders. Keep messages, shipment updates, OTP confirmation, and disputes inside the app.</Text>
        </View>

        {STEPS.map(([title, body], index) => (
          <View key={title} style={styles.step}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>{index + 1}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.stepTitle}>{title}</Text>
              <Text style={styles.stepBody}>{body}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F7FAF8" },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingHorizontal: 16, paddingVertical: 16 },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  title: { fontSize: 24, fontFamily: "Manrope-Bold", color: "#17211D" },
  subtitle: { marginTop: 4, fontSize: 13, lineHeight: 19, fontFamily: "Outfit-Regular", color: "#6A746F" },
  content: { paddingHorizontal: 16, paddingBottom: 40 },
  hero: { backgroundColor: "#076B51", borderRadius: 24, padding: 20, marginBottom: 16 },
  heroTitle: { marginTop: 12, fontSize: 20, fontFamily: "Manrope-Bold", color: "#FFFFFF" },
  heroText: { marginTop: 8, fontSize: 13, lineHeight: 20, fontFamily: "Outfit-Regular", color: "rgba(255,255,255,0.78)" },
  step: { flexDirection: "row", gap: 12, backgroundColor: "#FFFFFF", borderRadius: 18, padding: 16, borderWidth: 1, borderColor: "#E5EEE9", marginBottom: 12 },
  stepNumber: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#E7F4EE", alignItems: "center", justifyContent: "center" },
  stepNumberText: { fontSize: 13, fontFamily: "Manrope-Bold", color: "#076B51" },
  stepTitle: { fontSize: 15, fontFamily: "Manrope-Bold", color: "#17211D" },
  stepBody: { marginTop: 5, fontSize: 13, lineHeight: 19, fontFamily: "Outfit-Regular", color: "#53615A" },
});
