import React, { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useAuthStore } from "../../stores/authStore";
import { authService } from "../../services/authService";
import { FieldLabel, FormCard, OnboardingHeader, OptionRow, PrimaryButton } from "../../components/onboarding/FigmaNativeUI";

/**
 * "Complete your Eki profile" — shown only when Google/Apple didn't supply
 * everything Eki needs, or the user is genuinely new. Only renders the
 * fields the backend actually reported missing (missingFields param) —
 * never re-asks for name/email that were already prefilled and verified.
 */
export default function OAuthCompleteSignupScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    ticket: string;
    prefillName?: string;
    prefillEmail?: string;
    missingFields?: string;
    role?: string;
    redirect?: string;
  }>();

  const missing = new Set((params.missingFields ?? "").split(",").filter(Boolean));
  const needsName = missing.has("name");
  const needsEmail = missing.has("email");

  const [name, setName] = useState(params.prefillName ?? "");
  const [email, setEmail] = useState(params.prefillEmail ?? "");
  const [role, setRole] = useState<"BUYER" | "VENDOR">(params.role === "vendor" ? "VENDOR" : "BUYER");
  const [submitting, setSubmitting] = useState(false);

  const handleContinue = async () => {
    if (needsName && !name.trim()) {
      Alert.alert("Missing details", "Full name is required.");
      return;
    }
    if (needsEmail && !email.trim()) {
      Alert.alert("Missing details", "Email address is required.");
      return;
    }

    setSubmitting(true);
    try {
      const { user, token } = await authService.completeOAuthSignup({
        ticket: params.ticket,
        name: needsName ? name.trim() : undefined,
        email: needsEmail ? email.trim().toLowerCase() : undefined,
        role,
      });
      useAuthStore.getState().finalizeOAuthSession(user, token);

      if (role === "VENDOR") {
        router.replace("/(vendor-onboarding)/otp" as any);
      } else if (params.redirect) {
        router.replace(params.redirect as any);
      } else {
        router.replace("/(buyer)" as any);
      }
    } catch (err) {
      Alert.alert("Could not complete sign-up", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
        <OnboardingHeader title="Complete your Eki profile" subtitle="Just a couple more details" activeSegments={0} compact />
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <FormCard>
            {!needsName && name ? (
              <View style={styles.prefilledRow}>
                <Ionicons name="checkmark-circle" size={16} color="#0A8062" />
                <Text style={styles.prefilledText}>{name}</Text>
              </View>
            ) : null}
            {!needsEmail && email ? (
              <View style={styles.prefilledRow}>
                <Ionicons name="checkmark-circle" size={16} color="#0A8062" />
                <Text style={styles.prefilledText}>{email}</Text>
              </View>
            ) : null}

            {needsName ? (
              <>
                <FieldLabel>Full name</FieldLabel>
                <TextInput style={styles.input} placeholder="Your full name" value={name} onChangeText={setName} autoCapitalize="words" />
              </>
            ) : null}

            {needsEmail ? (
              <>
                <FieldLabel>Email address</FieldLabel>
                <TextInput style={styles.input} placeholder="you@example.com" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
              </>
            ) : null}

            <FieldLabel>I want to</FieldLabel>
            <OptionRow label="Buy foodstuff (Buyer)" selected={role === "BUYER"} onPress={() => setRole("BUYER")} />
            <OptionRow label="Sell foodstuff (Vendor)" selected={role === "VENDOR"} onPress={() => setRole("VENDOR")} />

            <View style={styles.buttonSpacer} />
            <PrimaryButton title={submitting ? "Creating account..." : "Continue"} onPress={handleContinue} disabled={submitting} />
          </FormCard>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#076B51" },
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: 40 },
  prefilledRow: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  prefilledText: { marginLeft: 6, color: "#334653", fontSize: 14, fontWeight: "600" },
  input: {
    borderWidth: 1,
    borderColor: "#E1E7E4",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#101820",
    marginBottom: 16,
  },
  buttonSpacer: { height: 8 },
});
