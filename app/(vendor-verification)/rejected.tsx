import React from "react";
import { Linking, View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useOnboardingStore } from "../../stores/onboardingStore";

const SUPPORT_EMAIL = "adminandy@eki.app";

export default function VerificationRejectedScreen() {
  const router = useRouter();
  const { setVerificationStatus } = useOnboardingStore();

  const onRetry = () => {
    setVerificationStatus("not_started");
    router.replace("/(vendor-verification)/upload-id" as any);
  };

  const onContactSupport = () => {
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=Verification%20Help`).catch(() => {});
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      {/* green dashboard peek */}
      <View style={styles.dashboardPeek}>
        <Text style={styles.peekTitle}>Get your first order</Text>
        <Text style={styles.peekSub}>Complete the steps below to start selling</Text>
      </View>

      <View style={styles.cardWrap}>
        <View style={styles.card}>
          <View style={styles.iconSquare}>
            <Ionicons name="information-circle-outline" size={30} color="#076B51" />
          </View>

          <Text style={styles.title}>We Couldn't Complete{"\n"}Your Verification</Text>
          <Text style={styles.body}>
            Please recheck your ID photo or try again
          </Text>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={onRetry}
            activeOpacity={0.8}
          >
            <Text style={styles.primaryButtonText}>Try Again</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={onContactSupport}
            activeOpacity={0.8}
          >
            <Ionicons name="help-circle-outline" size={16} color="#076B51" style={{ marginRight: 6 }} />
            <Text style={styles.secondaryButtonText}>Contact Support</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => router.replace("/(vendor)" as any)}
          activeOpacity={0.8}
        >
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
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 6,
  },
  iconSquare: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: "#E8F4ED",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontFamily: "Manrope-Bold",
    color: "#1A1A1A",
    textAlign: "center",
    marginBottom: 10,
    lineHeight: 28,
  },
  body: {
    fontSize: 14,
    fontFamily: "Outfit-Regular",
    color: "#6F7478",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 28,
  },
  primaryButton: {
    width: "100%",
    height: 52,
    borderRadius: 14,
    backgroundColor: "#076B51",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  primaryButtonText: {
    fontSize: 15,
    fontFamily: "Manrope-SemiBold",
    color: "#FFFFFF",
  },
  secondaryButton: {
    width: "100%",
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#076B51",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    fontSize: 15,
    fontFamily: "Manrope-SemiBold",
    color: "#076B51",
  },
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
