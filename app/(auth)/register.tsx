import React, { useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuthStore } from "../../stores/authStore";
import { UserRole } from "../../types/auth";
import {
  FieldLabel,
  FormCard,
  OnboardingHeader,
  PrimaryButton,
} from "../../components/onboarding/FigmaNativeUI";

export default function RegisterScreen() {
  const router = useRouter();
  const { role, redirect, ref } = useLocalSearchParams<{ role?: string; redirect?: string; ref?: string }>();
  const { register, isLoading, error, isAuthenticated, user, clearError, beginFreshAuthFlow } =
    useAuthStore();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const resolvedRole = (role ?? "buyer") as UserRole;
  const isVendor = resolvedRole === "vendor";

  useEffect(() => {
    if (!isAuthenticated || !user) return;
    if (user.role !== resolvedRole) return;

    if (isVendor && user.role === "vendor") {
      router.replace("/(vendor-onboarding)/otp" as any);
      return;
    }

    if (user.role === "vendor") {
      router.replace("/(vendor)" as any);
    } else if (user.role === "admin") {
      router.replace("/(admin)" as any);
    } else if (redirect) {
      router.replace(redirect as any);
    } else {
      router.replace("/(buyer)" as any);
    }
  }, [isAuthenticated, user, isVendor, router, redirect]);

  useEffect(() => {
    if (!isAuthenticated || !user) return;
    if (user.role !== resolvedRole) {
      beginFreshAuthFlow().catch(() => {});
    }
  }, [beginFreshAuthFlow, isAuthenticated, resolvedRole, user]);

  useEffect(() => {
    if (error) {
      Alert.alert("Registration failed", error);
    }
  }, [error]);

  useEffect(() => {
    clearError();
  }, [clearError, resolvedRole, redirect]);

  const handleContinue = async () => {
    if (!name.trim()) {
      Alert.alert("Missing details", "Full name is required.");
      return;
    }
    if (!email.trim()) {
      Alert.alert("Missing details", "Email address is required.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      Alert.alert("Invalid email", "Enter a valid email address.");
      return;
    }
    if (!password.trim()) {
      Alert.alert("Missing details", "Password is required.");
      return;
    }

    clearError();
    if (isAuthenticated || user) {
      await beginFreshAuthFlow().catch(() => {});
    }
    await register({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
      role: resolvedRole,
      referralCode: typeof ref === "string" ? ref.trim() || undefined : undefined,
    });
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <OnboardingHeader
          activeSegments={0}
          title={isVendor ? "Create your vendor account" : "Create your buyer account"}
          subtitle={
            isVendor
              ? "Use your email to set up your store and seller profile."
              : "Use your email to start shopping with Eki."
          }
        />

        <FormCard>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scrollBody}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.sectionTitle}>Create Account</Text>

            <View style={styles.fieldGroup}>
              <FieldLabel>Full name:</FieldLabel>
              <TextInput
                autoCapitalize="words"
                onChangeText={(value) => {
                  setName(value);
                  if (error) clearError();
                }}
                placeholder="e.g johnson"
                placeholderTextColor="#858585"
                style={styles.input}
                value={name}
              />
            </View>

            <View style={styles.fieldGroup}>
              <FieldLabel>Email address</FieldLabel>
              <TextInput
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                onChangeText={(value) => {
                  setEmail(value);
                  if (error) clearError();
                }}
                placeholder="e.g name@email.com"
                placeholderTextColor="#858585"
                style={styles.input}
                textContentType="emailAddress"
                value={email}
              />
            </View>

            <View style={styles.fieldGroup}>
              <FieldLabel>Password:</FieldLabel>
              <TextInput
                onChangeText={(value) => {
                  setPassword(value);
                  if (error) clearError();
                }}
                placeholder="Enter your password"
                placeholderTextColor="#858585"
                secureTextEntry
                style={styles.input}
                value={password}
              />
            </View>

            <View style={{ flex: 1 }} />

            {!isVendor ? (
              <View style={styles.rewardCard}>
                <Text style={styles.rewardTitle}>Buyer rewards on signup</Text>
                <Text style={styles.rewardItem}>
                  - Your personal referral code is created on your Eki account after signup.
                </Text>
                <Text style={styles.rewardItem}>
                  - Referral credit is added after the invited buyer completes their first paid order.
                </Text>
                <Text style={styles.rewardItem}>
                  - Earned wallet credits and referral totals stay synced with your live account.
                </Text>
              </View>
            ) : null}

            {isVendor ? (
              <Text style={styles.note}>You'll set up your store in the next step</Text>
            ) : null}

            <PrimaryButton
              disabled={isLoading}
              onPress={handleContinue}
              title={isLoading ? "Loading..." : "Continue"}
            />

            <View style={styles.footerRow}>
              <Text style={styles.footerText}>Already have an account? </Text>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() =>
                  router.push({
                    pathname: "/(auth)/login",
                    params: { role: resolvedRole, redirect },
                  })
                }
              >
                <Text style={styles.footerLink}>Log In</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </FormCard>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#076B51" },
  flex: { flex: 1 },
  scrollBody: { flexGrow: 1, paddingBottom: 16 },
  sectionTitle: {
    color: "#1A1A1A",
    fontFamily: "Manrope-Bold",
    fontSize: 18,
    marginBottom: 22,
  },
  fieldGroup: {
    marginBottom: 18,
  },
  input: {
    height: 52,
    borderRadius: 12,
    backgroundColor: "#F4F4F4",
    color: "#282828",
    fontFamily: "Outfit-Regular",
    fontSize: 14,
    paddingHorizontal: 18,
  },
  note: {
    color: "#858585",
    fontFamily: "Outfit-Medium",
    fontSize: 13,
    textAlign: "center",
    marginBottom: 14,
    marginTop: 16,
  },
  rewardCard: {
    borderRadius: 16,
    backgroundColor: "#F0F7F4",
    padding: 14,
    marginTop: 8,
    marginBottom: 14,
  },
  rewardTitle: {
    color: "#076B51",
    fontFamily: "Manrope-Bold",
    fontSize: 14,
    marginBottom: 8,
  },
  rewardItem: {
    color: "#24564A",
    fontFamily: "Outfit-Regular",
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 4,
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 18,
    paddingBottom: 8,
  },
  footerText: {
    color: "#1A1A1A",
    fontFamily: "Manrope-SemiBold",
    fontSize: 13,
  },
  footerLink: {
    color: "#076B51",
    fontFamily: "Manrope-Bold",
    fontSize: 13,
  },
});
