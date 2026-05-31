import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  FormCard,
  OnboardingHeader,
  OutlineButton,
  PrimaryButton,
} from "../../components/onboarding/FigmaNativeUI";

const BULLETS = [
  "You choose where you want to sell",
  "Delivery cost is based on order weight",
  "You can update this anytime",
];

export default function DeliveryIntroScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <OnboardingHeader
        activeSegments={4}
        subtitle="Buyers will see delivery cost before they pay"
        title={"Set your delivery for\nbuyers abroad"}
      />

      <FormCard>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollBody}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.sectionTitle}>Delivery Intro</Text>

          <View style={styles.bullets}>
            {BULLETS.map((item) => (
              <View key={item} style={styles.bulletRow}>
                <View style={styles.bulletDot} />
                <Text style={styles.bulletText}>{item}</Text>
              </View>
            ))}
          </View>

          <View style={styles.infoCard}>
            <View style={styles.infoIcon}>
              <Ionicons name="card-outline" size={20} color="#FFFFFF" />
            </View>
            <Text style={styles.infoText}>
              Accurate delivery costs help build{"\n"}trust with international buyers.
            </Text>
          </View>

          <View style={{ flex: 1, minHeight: 60 }} />

          <View style={styles.buttons}>
            <PrimaryButton
              onPress={() => router.push("/(vendor-onboarding)/delivery-countries" as any)}
              title="Set Delivery"
            />
            <OutlineButton onPress={() => router.back()} title="Back" />
          </View>
          <View style={{ height: 12 }} />
        </ScrollView>
      </FormCard>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#076B51" },
  scrollBody: { flexGrow: 1, paddingBottom: 16 },
  sectionTitle: { color: "#1A1A1A", fontFamily: "Manrope-Bold", fontSize: 18, marginBottom: 22 },
  bullets: { gap: 14, marginBottom: 22 },
  bulletRow: { flexDirection: "row", alignItems: "center" },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#D8D8D8",
    marginRight: 12,
  },
  bulletText: { color: "#858585", fontFamily: "Outfit-Regular", fontSize: 14 },
  infoCard: {
    minHeight: 76,
    borderRadius: 16,
    backgroundColor: "#1A1A1A",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 14,
    gap: 14,
  },
  infoIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  infoText: {
    flex: 1,
    color: "#FFFFFF",
    fontFamily: "Outfit-Regular",
    fontSize: 14,
    lineHeight: 20,
  },
  buttons: { gap: 12 },
});
