import React from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { goBackOrReplace } from "../../utils/navigation";
import { Ionicons } from "@expo/vector-icons";

const STEPS = [
  ["Set up vendor services", "Your vendor services determine product limits, available tools, platform fee, and withdrawal fee."],
  ["Share your store", "Use your public Eki store link to sell to diaspora buyers through secure checkout."],
  ["Accept paid orders", "Review each paid order, accept it, and prepare the package for dispatch."],
  ["Ship with tracking", "Add carrier and tracking details so buyers can follow the order from their account."],
  ["Get paid", "Eligible earnings move through payout review using the platform rules for your vendor services."],
  ["Resolve issues in Eki", "Keep order messages and support cases inside Eki so the admin team can help quickly."],
] as const;

export default function VendorPlanGuideScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => goBackOrReplace(router, "/(vendor)/settings" as any)} activeOpacity={0.85} style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color="#17211D" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>How vendor services work</Text>
          <Text style={styles.subtitle}>Vendor services are managed through the Business Portal.</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Ionicons name="briefcase-outline" size={28} color="#FFFFFF" />
          <Text style={styles.heroTitle}>Your vendor services determine your selling tools.</Text>
          <Text style={styles.heroText}>Vendor services are managed through the Eki Business Portal. The app shows your account status, commission tier, limits, and available tools.</Text>
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
