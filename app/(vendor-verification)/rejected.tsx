import React from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useOnboardingStore } from "../../stores/onboardingStore";

const COMMON_REASONS = [
  {
    title: "Blurry or unclear photo",
    body: "Make sure the document is fully in frame and captured in bright, even light.",
  },
  {
    title: "Text not fully visible",
    body: "All edges and details must be readable. Avoid cropped or cut-off images.",
  },
  {
    title: "Expired document",
    body: "Use a valid ID or business document that is still in date.",
  },
  {
    title: "Name mismatch",
    body: "The uploaded identity document should match the name used during registration.",
  },
];

export default function VerificationRejectedScreen() {
  const router = useRouter();
  const { setVerificationStatus } = useOnboardingStore();

  const onRetry = () => {
    setVerificationStatus("not_started");
    router.replace("/(vendor-verification)/upload-id" as any);
  };

  return (
    <View style={styles.container}>
      <SafeAreaView edges={["top"]} style={styles.safeArea}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Verification Failed</Text>
          <Text style={styles.headerSubtitle}>Your documents were not accepted</Text>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Status Card */}
        <View style={styles.card}>
          <View style={styles.statusIconWrap}>
            <Ionicons name="close-circle" size={40} color="#FB6363" />
          </View>
          <Text style={styles.statusTitle}>Verification Unsuccessful</Text>
          <Text style={styles.statusBody}>
            Your documents could not be verified. Please review the reasons below and try again.
          </Text>
        </View>

        {/* Common Reasons */}
        <View style={[styles.card, { alignItems: "flex-start" }]}>
          <Text style={styles.sectionTitle}>Common reasons</Text>
          <View style={styles.reasonList}>
            {COMMON_REASONS.map((item) => (
              <View key={item.title} style={styles.reasonRow}>
                <View style={styles.reasonIcon}>
                  <Ionicons name="close" size={14} color="#FB6363" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.reasonTitle}>{item.title}</Text>
                  <Text style={styles.reasonBody}>{item.body}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Try Again Button */}
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={onRetry}
          activeOpacity={0.8}
        >
          <Text style={styles.primaryButtonText}>Try Again</Text>
        </TouchableOpacity>

        {/* Contact Support Button */}
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => router.replace("/(vendor)" as any)}
          activeOpacity={0.8}
        >
          <Text style={styles.secondaryButtonText}>Contact Support</Text>
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
    paddingTop: 16,
    paddingBottom: 32,
    borderBottomLeftRadius: 35,
    borderBottomRightRadius: 35,
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
    marginTop: 4,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 30,
    padding: 20,
    marginBottom: 16,
    alignItems: "center",
  },
  statusIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#FDECEC",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  statusTitle: {
    fontSize: 22,
    fontFamily: "Manrope-Bold",
    color: "#282828",
    textAlign: "center",
  },
  statusBody: {
    fontSize: 14,
    fontFamily: "Outfit-Regular",
    color: "#858585",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 22,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: "Manrope-Bold",
    color: "#282828",
    marginBottom: 16,
  },
  reasonList: {
    gap: 16,
    alignSelf: "stretch",
  },
  reasonRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  reasonIcon: {
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: "#FDECEC",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  reasonTitle: {
    fontSize: 14,
    fontFamily: "Manrope-Bold",
    color: "#282828",
  },
  reasonBody: {
    fontSize: 13,
    fontFamily: "Outfit-Regular",
    color: "#858585",
    marginTop: 4,
    lineHeight: 18,
  },
  primaryButton: {
    height: 56,
    borderRadius: 14,
    backgroundColor: "#076B51",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  primaryButtonText: {
    fontSize: 16,
    fontFamily: "Manrope-SemiBold",
    color: "#FFFFFF",
  },
  secondaryButton: {
    height: 56,
    borderRadius: 14,
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#076B51",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontFamily: "Manrope-SemiBold",
    color: "#076B51",
  },
});
