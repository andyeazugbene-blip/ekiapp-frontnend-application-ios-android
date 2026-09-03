import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { useAuthStore } from "../../stores/authStore";
import { authService } from "../../services/authService";
import { goBackOrReplace } from "../../utils/navigation";

/**
 * An Eki account already exists for the email a Google/Apple sign-in just
 * verified. Per the security requirement: provider login must NOT
 * auto-link just because the email matches — the user must prove they
 * own the EXISTING account by entering its real password first.
 */
export default function OAuthLinkScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ ticket: string; email: string; redirect?: string; role?: string }>();

  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLink = async () => {
    if (!password) {
      setError("Enter your Eki account password to continue.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const { user, token } = await authService.linkOAuthAccount(params.ticket, params.email, password);
      useAuthStore.getState().finalizeOAuthSession(user, token);

      if (user.role === "admin") router.replace("/(admin)" as any);
      else if (user.role === "vendor" && !user.hasVendor) router.replace("/(vendor-onboarding)/setup-store" as any);
      else if (user.role === "vendor") router.replace("/(vendor)" as any);
      else if (params.redirect) router.replace(params.redirect as any);
      else router.replace("/(buyer)" as any);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not verify your password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.page}>
      <SafeAreaView edges={["top"]} style={styles.heroSafe}>
        <View style={styles.hero}>
          <TouchableOpacity onPress={() => goBackOrReplace(router, "/(auth)/login" as any)} activeOpacity={0.86} style={styles.backButton}>
            <Ionicons name="arrow-back" size={18} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.heroTitle}>Confirm it's you</Text>
          <Text style={styles.heroBody}>
            An Eki account already exists for {params.email}. Enter its password to link your sign-in — this keeps your account secure.
          </Text>
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.panel}>
            {error ? (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle-outline" size={18} color="#FB6363" style={{ marginTop: 1 }} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <Input
              label="Password"
              placeholder="Enter your Eki account password"
              isPassword
              autoComplete="off"
              autoCorrect={false}
              value={password}
              onChangeText={(t) => { setPassword(t); setError(""); }}
            />

            <Button title="Link and continue" fullWidth loading={loading} onPress={handleLink} />
          </View>

          <View style={styles.footerRow}>
            <TouchableOpacity onPress={() => router.push({ pathname: "/(auth)/forgot-password" })} activeOpacity={0.86}>
              <Text style={styles.footerLink}>Forgot password?</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#F4F4F4" },
  heroSafe: { backgroundColor: "#076B51" },
  hero: {
    backgroundColor: "#076B51",
    paddingHorizontal: 24,
    paddingTop: 6,
    paddingBottom: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  backButton: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  heroTitle: { color: "#FFFFFF", fontSize: 22, lineHeight: 26, fontWeight: "800" },
  heroBody: { color: "rgba(255,255,255,0.78)", fontSize: 13, lineHeight: 19, marginTop: 8 },
  content: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 22, paddingBottom: 52 },
  panel: {
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    padding: 22,
    shadowColor: "#282828",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 6,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FFF2F2",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
  },
  errorText: { flex: 1, color: "#FB6363", fontSize: 12, lineHeight: 17, marginLeft: 8 },
  footerRow: { flexDirection: "row", justifyContent: "center", marginTop: 18 },
  footerLink: { color: "#2E6957", fontSize: 13, fontWeight: "800" },
});
