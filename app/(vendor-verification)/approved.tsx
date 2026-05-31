import React from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "../../stores/authStore";

const UNLOCKED = [
  "Receive payouts to your bank account",
  "Show a verified badge on your store",
  "Unlock higher selling limits",
  "Increase buyer trust at checkout",
];

export default function VerificationApprovedScreen() {
  const router = useRouter();
  const { user } = useAuthStore();

  return (
    <View style={styles.container}>
      <SafeAreaView edges={["top"]} style={styles.safeArea}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Verification Complete</Text>
          <Text style={styles.headerSubtitle}>Your account is now verified</Text>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Success Card */}
        <View style={styles.card}>
          <View style={styles.successIconWrap}>
            <View style={styles.successIconInner}>
              <Ionicons name="shield-checkmark" size={32} color="#FFFFFF" />
            </View>
          </View>
          <Text style={styles.successTitle}>You're Verified!</Text>
          <Text style={styles.successBody}>
            Congratulations! Your identity has been verified. You now have full access to all vendor features.
          </Text>
        </View>

        {/* What's unlocked */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>What's now unlocked</Text>
          <View style={styles.unlockedList}>
            {UNLOCKED.map((item) => (
              <View key={item} style={styles.unlockedRow}>
                <View style={styles.unlockedIcon}>
                  <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                </View>
                <Text style={styles.unlockedText}>{item}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Go to Dashboard Button */}
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => router.replace("/(vendor)" as any)}
          activeOpacity={0.8}
        >
          <Text style={styles.primaryButtonText}>Go to Dashboard</Text>
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
  successIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 32,
    backgroundColor: "#E8F4ED",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  successIconInner: {
    width: 64,
    height: 64,
    borderRadius: 22,
    backgroundColor: "#076B51",
    alignItems: "center",
    justifyContent: "center",
  },
  successTitle: {
    fontSize: 22,
    fontFamily: "Manrope-Bold",
    color: "#282828",
    textAlign: "center",
  },
  successBody: {
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
  unlockedList: {
    gap: 14,
    alignSelf: "stretch",
  },
  unlockedRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  unlockedIcon: {
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: "#076B51",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  unlockedText: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Outfit-Regular",
    color: "#282828",
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
