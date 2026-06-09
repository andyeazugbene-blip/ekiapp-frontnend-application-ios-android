import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useOnboardingStore } from "../../stores/onboardingStore";
import { useAuthStore } from "../../stores/authStore";
import { authService } from "../../services/authService";
import {
  FieldLabel,
  FormCard,
  OnboardingHeader,
  PrimaryButton,
} from "../../components/onboarding/FigmaNativeUI";

const OTP_PURPOSE = "vendor_onboarding_email";

/**
 * OTP confirmation — exact match for screenshot 5.
 *
 * The register form is rendered behind a dark scrim, with a centered modal
 * containing the code input + Verify + Resend + Edit details + a circular
 * close (✕) button below the modal.
 */
export default function OtpScreen() {
  const router = useRouter();
  const { setOtpVerified } = useOnboardingStore();
  const { user } = useAuthStore();

  const contact = (user?.email ?? "").trim();
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!contact) return;
    let cancelled = false;
    (async () => {
      try {
        await authService.sendOtp(contact, OTP_PURPOSE, "email");
      } catch {
        if (cancelled) return;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [contact]);

  const handleVerify = useCallback(async () => {
    const trimmed = code.trim();
    if (!trimmed) {
      Alert.alert("Missing code", "Please enter the code we sent to your email.");
      return;
    }
    if (!/^\d{4,6}$/.test(trimmed)) {
      Alert.alert("Invalid code", "Please enter the 4–6 digit code.");
      return;
    }
    if (!contact) {
      Alert.alert("Missing email", "Please go back and re-enter your email address.");
      return;
    }

    setVerifying(true);
    try {
      await authService.verifyOtp(contact, trimmed, OTP_PURPOSE);
      setOtpVerified(true);
      router.push("/(vendor-onboarding)/setup-store" as any);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      Alert.alert("Verification failed", msg || "Please try again.");
    } finally {
      setVerifying(false);
    }
  }, [code, contact, setOtpVerified, router]);

  const handleResend = useCallback(async () => {
    if (sending) return;
    if (!contact) {
      Alert.alert("Missing email", "Please go back and re-enter your email address.");
      return;
    }

    setSending(true);
    try {
      await authService.sendOtp(contact, OTP_PURPOSE, "email");
      setCode("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not resend code. Please try again.";
      Alert.alert("Could not resend code", msg);
    } finally {
      setSending(false);
    }
  }, [sending, contact]);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Behind: ghost register form */}
      <View style={styles.backdrop} pointerEvents="none">
        <OnboardingHeader activeSegments={0} title={"Create Your Vendor\nAccount"} />
        <FormCard>
          <Text style={styles.ghostTitle}>Create Account</Text>
          <View style={styles.ghostField}>
            <FieldLabel>Full name:</FieldLabel>
            <View style={styles.fakeInput} />
          </View>
          <View style={styles.ghostField}>
            <FieldLabel>Email address</FieldLabel>
            <View style={styles.fakeInput} />
          </View>
          <View style={styles.ghostField}>
            <FieldLabel>Password:</FieldLabel>
            <View style={styles.fakeInput} />
          </View>
          <View style={{ flex: 1 }} />
          <PrimaryButton title="Continue" onPress={() => undefined} disabled />
          <View style={{ height: 16 }} />
        </FormCard>
      </View>

      {/* Dark scrim */}
      <View style={styles.dimLayer} />

      {/* Centered modal */}
      <View style={styles.modal}>
        <Text style={styles.modalTitle}>Confirm Your Email</Text>
        <Text style={styles.modalSubtitle}>We sent a code to your email to confirm your account</Text>

        <TextInput
          autoFocus
          keyboardType="number-pad"
          maxLength={6}
          onChangeText={setCode}
          placeholder="Enter code"
          placeholderTextColor="#858585"
          style={styles.codeInput}
          value={code}
        />

        <TouchableOpacity
          accessibilityRole="button"
          activeOpacity={0.86}
          disabled={verifying}
          onPress={handleVerify}
          style={[styles.verifyButton, verifying && styles.disabled]}
        >
          <Text style={styles.verifyText}>{verifying ? "Verifying..." : "Verify"}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          accessibilityRole="button"
          activeOpacity={0.72}
          disabled={sending}
          onPress={handleResend}
          style={styles.linkButton}
        >
          <Text style={styles.linkText}>{sending ? "Sending..." : "Resend code"}</Text>
        </TouchableOpacity>

        <Text style={styles.editText}>
          Wrong email?{" "}
          <Text onPress={() => router.back()} style={styles.editLink}>
            Edit details
          </Text>
        </Text>
      </View>

      {/* Round close button */}
      <TouchableOpacity
        accessibilityLabel="Close"
        accessibilityRole="button"
        activeOpacity={0.72}
        onPress={() => router.back()}
        style={styles.closeButton}
      >
        <Ionicons name="close" size={22} color="#1A1A1A" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#076B51",
  },
  backdrop: {
    flex: 1,
    opacity: 0.6,
  },
  ghostTitle: {
    color: "#1A1A1A",
    fontFamily: "Manrope-Bold",
    fontSize: 18,
    marginBottom: 22,
  },
  ghostField: {
    marginBottom: 18,
  },
  fakeInput: {
    height: 52,
    borderRadius: 12,
    backgroundColor: "#F4F4F4",
  },
  dimLayer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.42)",
  },
  modal: {
    position: "absolute",
    left: 18,
    right: 18,
    top: "30%",
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    paddingHorizontal: 28,
    paddingTop: 28,
    paddingBottom: 26,
    alignItems: "center",
  },
  modalTitle: {
    color: "#1A1A1A",
    fontFamily: "Manrope-Bold",
    fontSize: 18,
    textAlign: "center",
  },
  modalSubtitle: {
    color: "#858585",
    fontFamily: "Outfit-Regular",
    fontSize: 13,
    textAlign: "center",
    marginTop: 10,
    marginBottom: 22,
  },
  codeInput: {
    alignSelf: "stretch",
    height: 52,
    borderRadius: 12,
    backgroundColor: "#F4F4F4",
    color: "#282828",
    fontFamily: "Outfit-Regular",
    fontSize: 14,
    paddingHorizontal: 18,
  },
  verifyButton: {
    alignSelf: "stretch",
    height: 54,
    borderRadius: 14,
    backgroundColor: "#076B51",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
  },
  verifyText: {
    color: "#FFFFFF",
    fontFamily: "Manrope-SemiBold",
    fontSize: 16,
  },
  linkButton: { marginTop: 14 },
  linkText: {
    color: "#076B51",
    fontFamily: "Outfit-Medium",
    fontSize: 14,
    textDecorationLine: "underline",
  },
  editText: {
    color: "#858585",
    fontFamily: "Outfit-Regular",
    fontSize: 13,
    marginTop: 12,
    textAlign: "center",
  },
  editLink: {
    color: "#076B51",
    fontFamily: "Outfit-Medium",
    textDecorationLine: "underline",
  },
  closeButton: {
    position: "absolute",
    top: "62%",
    alignSelf: "center",
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  disabled: { opacity: 0.62 },
});
