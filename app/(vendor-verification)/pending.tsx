import React from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useOnboardingStore } from "../../stores/onboardingStore";

export default function VerificationPendingScreen() {
  const router = useRouter();
  const { setVerificationStatus } = useOnboardingStore();

  return (
    <View style={styles.container}>
      <SafeAreaView edges={["top"]} style={styles.safeArea}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Verification Pending</Text>
          <Text style={styles.headerSubtitle}>Your documents are being reviewed</Text>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Status Card */}
        <View style={styles.card}>
          <View style={styles.statusIconWrap}>
            <Ionicons name="time-outline" size={40} color="#076B51" />
          </View>
          <Text style={styles.statusTitle}>Under Review</Text>
          <Text style={styles.statusBody}>
            We're reviewing your documents. This usually takes 24-48 hours.
          </Text>
        </View>

        {/* What happens next */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>What happens next</Text>
          <View style={styles.bulletList}>
            <View style={styles.bulletRow}>
              <Ionicons name="checkmark-circle-outline" size={16} color="#076B51" />
              <Text style={styles.bulletText}>
                You will receive an email and in-app update once a decision is ready.
              </Text>
            </View>
            <View style={styles.bulletRow}>
              <Ionicons name="checkmark-circle-outline" size={16} color="#076B51" />
              <Text style={styles.bulletText}>
                Approved vendors can move straight into payouts and store growth steps.
              </Text>
            </View>
            <View style={styles.bulletRow}>
              <Ionicons name="checkmark-circle-outline" size={16} color="#076B51" />
              <Text style={styles.bulletText}>
                If anything is unclear, you will be guided to resubmit with specific feedback.
              </Text>
            </View>
          </View>
        </View>

        {/* Back to Dashboard Button */}
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => router.replace("/(vendor)" as any)}
          activeOpacity={0.8}
        >
          <Text style={styles.primaryButtonText}>Back to Dashboard</Text>
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
    backgroundColor: "#E8F4ED",
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
    alignSelf: "flex-start",
  },
  bulletList: {
    gap: 14,
    alignSelf: "stretch",
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  bulletText: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Outfit-Regular",
    color: "#858585",
    marginLeft: 10,
    lineHeight: 20,
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
});
