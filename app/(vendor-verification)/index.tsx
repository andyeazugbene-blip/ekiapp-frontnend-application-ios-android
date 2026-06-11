import React, { useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { vendorService } from "../../services/vendorService";

const STEPS = [
  {
    step: "01",
    title: "Confirm your identity",
    body: "Upload a valid government-issued photo ID (passport, driver's licence, or national ID).",
    icon: "card-outline" as const,
  },
  {
    step: "02",
    title: "Business certificate",
    body: "If you're a registered business, upload your certificate of incorporation or business licence.",
    icon: "document-text-outline" as const,
  },
  {
    step: "03",
    title: "We review & verify",
    body: "Our team reviews your documents within 24–48 hours and notifies you by email.",
    icon: "shield-checkmark-outline" as const,
  },
];

const REQUIREMENTS = [
  "Government-issued photo ID (not expired)",
  "Clear, readable image — no blurry or cropped photos",
  "Business certificate (registered businesses only)",
  "All text must be fully visible",
];

export default function VerificationIntroScreen() {
  const router = useRouter();
  const [checkingStatus, setCheckingStatus] = useState(false);

  const startVerification = async () => {
    if (checkingStatus) return;
    setCheckingStatus(true);
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
      setCheckingStatus(false);
    }
  };

  return (
    <View style={styles.container}>
      <SafeAreaView edges={["top"]} style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <View style={styles.headerIconWrap}>
              <Ionicons name="shield-outline" size={26} color="#FFFFFF" />
            </View>
            <View>
              <Text style={styles.headerTitle}>Identity Verification</Text>
              <Text style={styles.headerSubtitle}>Secure your vendor account</Text>
            </View>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Why verify */}
        <View style={styles.whyCard}>
          <Text style={styles.whyTitle}>Why do we verify?</Text>
          <Text style={styles.whyBody}>
            Verification keeps our platform safe and ensures you can receive payments, build buyer trust, and unlock selling limits.
          </Text>
        </View>

        {/* Steps */}
        <Text style={styles.sectionTitle}>How it works</Text>
        <View style={styles.stepsContainer}>
          {STEPS.map((s) => (
            <View key={s.step} style={styles.stepCard}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>{s.step}</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>{s.title}</Text>
                <Text style={styles.stepBody}>{s.body}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Requirements */}
        <Text style={styles.sectionTitle}>Document requirements</Text>
        <View style={styles.requirementsCard}>
          {REQUIREMENTS.map((req, i) => (
            <View
              key={i}
              style={[
                styles.requirementRow,
                i < REQUIREMENTS.length - 1 && styles.requirementBorder,
              ]}
            >
              <Ionicons name="checkmark-circle" size={16} color="#076B51" style={{ marginTop: 1 }} />
              <Text style={styles.requirementText}>{req}</Text>
            </View>
          ))}
        </View>

        {/* Start Verification Button */}
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={startVerification}
          activeOpacity={0.8}
          disabled={checkingStatus}
        >
          <Text style={styles.primaryButtonText}>{checkingStatus ? "Checking status..." : "Start Verification"}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.back()} style={styles.laterButton}>
          <Text style={styles.laterButtonText}>I'll do this later</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F4F4F4",
  },
  safeArea: {
    backgroundColor: "#076B51",
  },
  header: {
    backgroundColor: "#076B51",
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 32,
    borderBottomLeftRadius: 35,
    borderBottomRightRadius: 35,
  },
  backButton: {
    width: 40,
    height: 40,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerIconWrap: {
    width: 48,
    height: 48,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 30,
    fontFamily: "Manrope-Bold",
    color: "#FFFFFF",
  },
  headerSubtitle: {
    fontSize: 16,
    fontFamily: "Outfit-Light",
    color: "#FFFFFF",
    marginTop: 2,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 40,
  },
  whyCard: {
    backgroundColor: "#E8F4ED",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 20,
  },
  whyTitle: {
    fontSize: 14,
    fontFamily: "Manrope-Bold",
    color: "#076B51",
    marginBottom: 8,
  },
  whyBody: {
    fontSize: 12,
    fontFamily: "Outfit-Regular",
    color: "#2E6957",
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: "Manrope-Bold",
    color: "#282828",
    marginBottom: 12,
  },
  stepsContainer: {
    gap: 12,
    marginBottom: 24,
  },
  stepCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 30,
    padding: 20,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  stepNumber: {
    width: 36,
    height: 36,
    backgroundColor: "#076B51",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    marginTop: 2,
  },
  stepNumberText: {
    fontSize: 12,
    fontFamily: "Manrope-Bold",
    color: "#FFFFFF",
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 14,
    fontFamily: "Manrope-Bold",
    color: "#282828",
  },
  stepBody: {
    fontSize: 12,
    fontFamily: "Outfit-Regular",
    color: "#858585",
    marginTop: 4,
    lineHeight: 18,
  },
  requirementsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 30,
    padding: 20,
    marginBottom: 24,
  },
  requirementRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 10,
  },
  requirementBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  requirementText: {
    fontSize: 13,
    fontFamily: "Outfit-Regular",
    color: "#282828",
    marginLeft: 10,
    flex: 1,
    lineHeight: 18,
  },
  primaryButton: {
    height: 56,
    borderRadius: 14,
    backgroundColor: "#076B51",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    fontSize: 16,
    fontFamily: "Manrope-SemiBold",
    color: "#FFFFFF",
  },
  laterButton: {
    marginTop: 16,
    alignItems: "center",
    paddingVertical: 8,
  },
  laterButtonText: {
    fontSize: 14,
    fontFamily: "Outfit-Regular",
    color: "#858585",
    textDecorationLine: "underline",
  },
});
