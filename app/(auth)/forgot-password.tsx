import React, { useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { authService } from "../../services/authService";

type ScreenState = "idle" | "loading" | "success" | "error";

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { role } = useLocalSearchParams<{ role?: string }>();
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [screenState, setScreenState] = useState<ScreenState>("idle");
  const [apiError, setApiError] = useState("");

  const submit = async () => {
    if (!email.trim()) {
      setEmailError("Email is required");
      return;
    }
    setScreenState("loading");
    setApiError("");
    try {
      await authService.forgotPassword(email.trim().toLowerCase());
      setScreenState("success");
    } catch {
      setApiError("Something went wrong. Please try again.");
      setScreenState("error");
    }
  };

  return (
    <View style={styles.page}>
      <SafeAreaView edges={["top"]} style={styles.heroSafe}>
        <View style={styles.hero}>
          <TouchableOpacity onPress={() => router.push({ pathname: "/(auth)/login", params: { role } })} activeOpacity={0.86} style={styles.backButton}>
            <Ionicons name="arrow-back" size={18} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.heroPill}>
            <Text style={styles.heroPillText}>Secure reset</Text>
          </View>
          <Text style={styles.heroTitle}>Reset your password</Text>
          <Text style={styles.heroBody}>Enter your account email and we will send a secure reset link.</Text>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.content}>
        {screenState === "success" ? (
          <View style={styles.panelSuccess}>
            <View style={styles.successIconWrap}>
              <Ionicons name="checkmark-circle" size={40} color="#2E6957" />
            </View>
            <Text style={styles.successTitle}>Check your inbox</Text>
            <Text style={styles.successBody}>We sent a password reset link to {email.trim().toLowerCase()}.</Text>
            <TouchableOpacity onPress={() => setScreenState("idle")} activeOpacity={0.86} style={styles.successLinkWrap}>
              <Text style={styles.successLink}>Try a different email</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Forgot password?</Text>
            <Text style={styles.panelCaption}>We will send a secure reset link so you can get back in quickly.</Text>
            {apiError ? <Text style={styles.errorText}>{apiError}</Text> : null}
            <Input label="Email address" placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={(value) => { setEmail(value); setEmailError(""); setApiError(""); }} error={emailError} />
            <View style={{ marginTop: 8 }}>
              <Button title={screenState === "loading" ? "Sending..." : "Send Reset Link"} fullWidth loading={screenState === "loading"} onPress={submit} />
            </View>
          </View>
        )}

        <TouchableOpacity onPress={() => router.push({ pathname: "/(auth)/login", params: { role } })} activeOpacity={0.86} style={styles.footerLinkWrap}>
          {screenState === "loading" ? <ActivityIndicator size="small" color="#2E6957" /> : <Text style={styles.footerLink}>Back to Sign In</Text>}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#F4F4F4" },
  heroSafe: { backgroundColor: "#076B51" },
  hero: {
    backgroundColor: "#076B51",
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 28,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  heroPill: {
    alignSelf: "flex-start",
    minHeight: 30,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.12)",
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  heroPillText: { color: "#FFFFFF", fontSize: 11, fontWeight: "800" },
  heroTitle: { color: "#FFFFFF", fontSize: 30, lineHeight: 36, fontWeight: "800" },
  heroBody: { color: "rgba(255,255,255,0.72)", fontSize: 13, lineHeight: 19, marginTop: 10 },
  content: { paddingHorizontal: 20, paddingTop: 22, paddingBottom: 40 },
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
  panelSuccess: {
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    padding: 26,
    alignItems: "center",
    shadowColor: "#282828",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 6,
  },
  panelTitle: { color: "#102118", fontSize: 22, fontWeight: "800" },
  panelCaption: { color: "#70827A", fontSize: 12, lineHeight: 17, fontWeight: "600", marginTop: 6, marginBottom: 14 },
  errorText: { color: "#FB6363", fontSize: 13, marginBottom: 12 },
  successIconWrap: {
    width: 74,
    height: 74,
    borderRadius: 24,
    backgroundColor: "#E9F4EE",
    alignItems: "center",
    justifyContent: "center",
  },
  successTitle: { color: "#102118", fontSize: 24, fontWeight: "800", marginTop: 18 },
  successBody: { color: "#72857D", fontSize: 13, textAlign: "center", lineHeight: 20, marginTop: 10 },
  successLinkWrap: { marginTop: 16 },
  successLink: { color: "#2E6957", fontSize: 13, fontWeight: "800" },
  footerLinkWrap: { marginTop: 18, alignItems: "center" },
  footerLink: { color: "#2E6957", fontSize: 13, fontWeight: "800" },
});
