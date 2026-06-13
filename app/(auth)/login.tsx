import React, { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { useAuthStore } from "../../stores/authStore";
import { goBackOrReplace } from "../../utils/navigation";

const ROLE_LABELS: Record<string, string> = {
  buyer: "Buyer",
  vendor: "Vendor",
  admin: "Admin",
};

export default function LoginScreen() {
  const router = useRouter();
  const { role, redirect } = useLocalSearchParams<{ role?: string; redirect?: string }>();
  const { login, isLoading, error, isAuthenticated, user, clearError, beginFreshAuthFlow, setLastRole } = useAuthStore();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const resolvedRole = role ?? "buyer";
  const roleLabel = ROLE_LABELS[resolvedRole] ?? "Buyer";
  const isAdmin = resolvedRole === "admin";

  useEffect(() => {
    if (isAuthenticated && user) {
      if (user.role === "admin") { router.replace("/(admin)"); return; }
      if (resolvedRole === "vendor" && user.hasVendor) { router.replace("/(vendor)"); return; }
      if (resolvedRole === "vendor" && !user.hasVendor) { router.replace("/(vendor-onboarding)"); return; }
      if (redirect) { router.replace(redirect as any); return; }
      router.replace("/(buyer)");
    }
  }, [isAuthenticated, router, user, redirect, resolvedRole]);

  useEffect(() => {
    clearError();
    setEmailError("");
    setPasswordError("");
  }, [clearError, resolvedRole, redirect]);

  const validate = () => {
    let valid = true;
    setEmailError("");
    setPasswordError("");

    if (!email.trim()) {
      setEmailError("Email is required");
      valid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setEmailError("Enter a valid email address");
      valid = false;
    }

    if (!password) {
      setPasswordError("Password is required");
      valid = false;
    } else if (password.length < 6) {
      setPasswordError("Password must be at least 6 characters");
      valid = false;
    }

    return valid;
  };

  const handleLogin = async () => {
    if (!validate()) return;
    clearError();
    if (isAuthenticated || user) {
      await beginFreshAuthFlow().catch(() => {});
    }
    setLastRole(resolvedRole);
    await login({
      email: email.trim().toLowerCase(),
      password,
      expectedRole: resolvedRole as any,
    });
  };

  if (isAdmin) {
    return (
      <SafeAreaView style={styles.adminPage} edges={["top", "bottom"]}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.adminKeyboard}>
          <ScrollView
            contentContainerStyle={styles.adminContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.adminPanel}>
              <View style={styles.adminIcon}>
                <Ionicons name="person-outline" size={56} color="#076B51" />
              </View>
              <Text style={styles.adminTitle}>Admin sign in</Text>
              <Text style={styles.adminSubtitle}>Eki Marketplace Control Portal</Text>

              {error ? (
                <View style={styles.errorBanner}>
                  <Ionicons name="alert-circle-outline" size={18} color="#FB6363" style={{ marginTop: 1 }} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <Input
                label="Email"
                placeholder="admin@eki.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="off"
                autoCorrect={false}
                value={email}
                onChangeText={(t) => {
                  setEmail(t);
                  setEmailError("");
                  if (error) clearError();
                }}
                error={emailError}
              />

              <Input
                label="Password"
                placeholder="Enter your password"
                isPassword
                autoComplete="off"
                autoCorrect={false}
                value={password}
                onChangeText={(t) => {
                  setPassword(t);
                  setPasswordError("");
                  if (error) clearError();
                }}
                error={passwordError}
              />

              <Button title="Sign In  ->" fullWidth loading={isLoading} onPress={handleLogin} />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.page}>
      <SafeAreaView edges={["top"]} style={styles.heroSafe}>
        <View style={styles.hero}>
          <TouchableOpacity onPress={() => goBackOrReplace(router, "/(auth)/role-select" as any)} activeOpacity={0.86} style={styles.backButton}>
            <Ionicons name="arrow-back" size={18} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={styles.heroPill}>
            <Text style={styles.heroPillText}>{isAdmin ? "Control Portal" : `${roleLabel} access`}</Text>
          </View>

          <Text style={styles.heroTitle}>
            {isAdmin ? "Eki Marketplace\nControl Portal" : `Welcome back,\n${roleLabel.toLowerCase()}`}
          </Text>
          <Text style={styles.heroBody}>
            {isAdmin
              ? "Sign in to review vendors, orders, disputes, and marketplace health."
              : "Sign in to continue with your premium marketplace flow."}
          </Text>
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.panel}>
            <View style={styles.panelTop}>
              <Text style={styles.panelTitle}>{isAdmin ? "Sign In" : "Log In"}</Text>
              <Text style={styles.panelCaption}>{isAdmin ? "Marketplace oversight" : "Protected buyer and vendor access"}</Text>
            </View>

            {error ? (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle-outline" size={18} color="#FB6363" style={{ marginTop: 1 }} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <Input
              label="Email address"
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="off"
              autoCorrect={false}
              value={email}
              onChangeText={(t) => {
                setEmail(t);
                setEmailError("");
                if (error) clearError();
              }}
              error={emailError}
            />

            <Input
              label="Password"
              placeholder="Enter your password"
              isPassword
              autoComplete="off"
              autoCorrect={false}
              value={password}
              onChangeText={(t) => {
                setPassword(t);
                setPasswordError("");
                if (error) clearError();
              }}
              error={passwordError}
            />

            <TouchableOpacity
              style={styles.forgotWrap}
              onPress={() => router.push({ pathname: "/(auth)/forgot-password", params: { role } })}
              activeOpacity={0.86}
            >
              <Text style={styles.forgotText}>Forgot password?</Text>
            </TouchableOpacity>

            <Button title={isAdmin ? "Sign In" : "Continue"} fullWidth loading={isLoading} onPress={handleLogin} />
          </View>

          <View style={styles.footerRow}>
            <Text style={styles.footerCopy}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => router.push({ pathname: "/(auth)/register", params: { role, redirect } })} activeOpacity={0.86}>
              <Text style={styles.footerLink}>Sign up</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  adminPage: {
    flex: 1,
    backgroundColor: "#F4F4F4",
  },
  adminKeyboard: {
    flex: 1,
  },
  adminContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 42,
  },
  adminPanel: {
    backgroundColor: "#FFFFFF",
    borderRadius: 26,
    paddingHorizontal: 28,
    paddingVertical: 40,
    shadowColor: "#282828",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 4,
  },
  adminIcon: {
    width: 86,
    height: 86,
    borderRadius: 28,
    backgroundColor: "#E4F0EC",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 28,
  },
  adminTitle: {
    color: "#282828",
    fontSize: 38,
    lineHeight: 44,
    fontWeight: "800",
    textAlign: "center",
  },
  adminSubtitle: {
    color: "#858585",
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 12,
    marginBottom: 34,
  },
  page: {
    flex: 1,
    backgroundColor: "#F4F4F4",
  },
  heroSafe: {
    backgroundColor: "#076B51",
  },
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
  heroPillText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
  },
  heroTitle: {
    color: "#FFFFFF",
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "800",
  },
  heroBody: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 10,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 52,
  },
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
  panelTop: {
    marginBottom: 14,
  },
  panelTitle: {
    color: "#102118",
    fontSize: 22,
    fontWeight: "800",
  },
  panelCaption: {
    color: "#70827A",
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "600",
    marginTop: 6,
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
  errorText: {
    flex: 1,
    color: "#FB6363",
    fontSize: 12,
    lineHeight: 17,
    marginLeft: 8,
  },
  forgotWrap: {
    alignSelf: "flex-end",
    marginTop: -2,
    marginBottom: 16,
  },
  forgotText: {
    color: "#2E6957",
    fontSize: 12,
    fontWeight: "800",
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 18,
  },
  footerCopy: {
    color: "#72857D",
    fontSize: 13,
  },
  footerLink: {
    color: "#2E6957",
    fontSize: 13,
    fontWeight: "800",
  },
});
