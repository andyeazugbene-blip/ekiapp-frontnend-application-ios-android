import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { vendorService } from "../../services/vendorService";

type Step = "prompt" | "why" | "identity";

const WHY_ITEMS = [
  { icon: "home-outline" as const, label: "Receive orders safely" },
  { icon: "wallet-outline" as const, label: "Get paid securely" },
  { icon: "person-outline" as const, label: "Show buyers your store is trusted" },
];

export default function VerificationIntroScreen() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("prompt");
  const [checking, setChecking] = useState(false);

  const startVerification = async () => {
    if (checking) return;
    setChecking(true);
    try {
      const profile = await vendorService.getMyProfile();
      if (profile.verificationStatus === "verified") {
        router.replace("/(vendor-verification)/approved" as any);
        return;
      }
      router.push("/(vendor-verification)/upload-id" as any);
    } catch {
      router.push("/(vendor-verification)/upload-id" as any);
    } finally {
      setChecking(false);
    }
  };

  const onClose = () => router.replace("/(vendor)" as any);

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      {/* green dashboard peek */}
      <View style={styles.dashboardPeek}>
        <Text style={styles.peekTitle}>Get your first order</Text>
        <Text style={styles.peekSub}>Complete the steps below to start selling</Text>
      </View>

      <View style={styles.cardWrap}>
        {/* STEP 1: Verify prompt */}
        {step === "prompt" && (
          <View style={styles.card}>
            <Text style={styles.title}>Verify Your Account To{"\n"}Receive Orders</Text>
            <Text style={styles.subtitle}>
              This helps protect your payment, build buyer trust, and keep the platform secure
            </Text>

            <TouchableOpacity style={styles.primaryButton} onPress={() => setStep("why")} activeOpacity={0.8}>
              <Text style={styles.primaryButtonText}>Verify Now</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.outlineButton} onPress={onClose} activeOpacity={0.8}>
              <Text style={styles.outlineButtonText}>Do This Later</Text>
            </TouchableOpacity>

            <View style={styles.noticeBanner}>
              <Text style={styles.noticeText}>
                Your dashboard will still work, but buyers cannot place orders until your account is verified.
              </Text>
            </View>
          </View>
        )}

        {/* STEP 2: Why verification matters */}
        {step === "why" && (
          <View style={styles.card}>
            <Text style={styles.title}>Why Verification Matters</Text>

            {WHY_ITEMS.map((item, i) => (
              <View key={i} style={styles.whyRow}>
                <View style={styles.whyIcon}>
                  <Ionicons name={item.icon} size={20} color="#076B51" />
                </View>
                <Text style={styles.whyLabel}>{item.label}</Text>
              </View>
            ))}

            <TouchableOpacity style={[styles.primaryButton, { marginTop: 8 }]} onPress={() => setStep("identity")} activeOpacity={0.8}>
              <Text style={styles.primaryButtonText}>Continue to Verification</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* STEP 3: Secure identity check */}
        {step === "identity" && (
          <View style={styles.card}>
            <Text style={styles.title}>Secure Identity Check</Text>
            <Text style={styles.subtitle}>You'll need a valid ID and a quick face scan.</Text>

            <TouchableOpacity
              style={[styles.primaryButton, checking && styles.primaryButtonDisabled]}
              onPress={startVerification}
              activeOpacity={0.8}
              disabled={checking}
            >
              {checking ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryButtonText}>Start Verification Now</Text>
              )}
            </TouchableOpacity>

            <View style={styles.timeBanner}>
              <Ionicons name="time-outline" size={16} color="#856B0E" />
              <Text style={styles.timeText}>This usually takes only a few minutes</Text>
            </View>
          </View>
        )}

        <TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.8}>
          <Ionicons name="close" size={20} color="#282828" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#EBEBEB" },
  dashboardPeek: {
    backgroundColor: "#076B51",
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 28,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  peekTitle: { fontSize: 22, fontFamily: "Manrope-Bold", color: "#FFFFFF" },
  peekSub: { fontSize: 13, fontFamily: "Outfit-Regular", color: "rgba(255,255,255,0.75)", marginTop: 4 },
  cardWrap: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    padding: 28,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 6,
  },
  title: {
    fontSize: 20,
    fontFamily: "Manrope-Bold",
    color: "#1A1A1A",
    textAlign: "center",
    marginBottom: 10,
    lineHeight: 28,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "Outfit-Regular",
    color: "#6F7478",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  primaryButton: {
    height: 52,
    borderRadius: 14,
    backgroundColor: "#076B51",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  primaryButtonDisabled: { opacity: 0.55 },
  primaryButtonText: { fontSize: 15, fontFamily: "Manrope-SemiBold", color: "#FFFFFF" },
  outlineButton: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#076B51",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  outlineButtonText: { fontSize: 15, fontFamily: "Manrope-SemiBold", color: "#076B51" },
  noticeBanner: {
    backgroundColor: "#FEFBE8",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  noticeText: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#856B0E", lineHeight: 20, textAlign: "center" },
  whyRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F6F6F6",
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
  },
  whyIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "#E8F4ED",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  whyLabel: { fontSize: 15, fontFamily: "Outfit-Medium", color: "#1A1A1A", flex: 1 },
  timeBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FEFBE8",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 4,
    gap: 8,
  },
  timeText: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#856B0E" },
  closeButton: {
    marginTop: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
});
