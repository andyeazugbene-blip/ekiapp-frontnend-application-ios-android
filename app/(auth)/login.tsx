import React, { useCallback, useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { SocialAuthButtons } from "../../components/auth/SocialAuthButtons";
import { useAuthStore } from "../../stores/authStore";
import { goBackOrReplace } from "../../utils/navigation";
import type { OAuthOutcome } from "../../types/auth";

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
  const pendingRoleRef = useRef(false);
  const scrollRef = useRef<ScrollView>(null);
  const emailInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);

  const scrollToInput = useCallback((inputRef: React.RefObject<TextInput | null>) => () => {
    setTimeout(() => {
      // Fabric requires a host-component ref here, not a legacy node handle —
      // findNodeHandle() is rejected at runtime ("must be called with a ref
      // to a native component").
      const scrollNode = scrollRef.current?.getNativeScrollRef();
      if (!inputRef.current || !scrollNode) return;
      inputRef.current.measureLayout(
        scrollNode,
        (_x: number, y: number) => {
          scrollRef.current?.scrollTo({ y: Math.max(y - 16, 0), animated: true });
        },
        () => {}
      );
    }, 80);
  }, []);

  const resolvedRole = role ?? "buyer";
  const roleLabel = ROLE_LABELS[resolvedRole] ?? "Buyer";
  const isAdmin = resolvedRole === "admin";

  useEffect(() => {
    if (isAuthenticated && user) {
      // If handleLogin is actively switching roles, skip effect navigation
      if (pendingRoleRef.current) return;
      // For vendor+hasVendor, only navigate if role is already flipped
      if (resolvedRole === "vendor" && user.hasVendor && user.role !== "vendor") return;
      if (user.role === "admin") { router.replace("/(admin)"); return; }
      if (resolvedRole === "vendor" && !user.hasVendor) { router.replace("/(vendor-onboarding)/setup-store" as any); return; }
      if (resolvedRole === "vendor" && user.hasVendor) { router.replace("/(vendor)"); return; }
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
    // A failed login leaves isAuthenticated false — stay on this screen so
    // the error banner set by the store is visible, instead of falling
    // through to the unconditional navigation below.
    if (!useAuthStore.getState().isAuthenticated) return;
    // ⚡ After login, read the LATEST zustand state and handle vendor role
    // directly — no timing issues, no race conditions.
    let currentUser = useAuthStore.getState().user;
    if (currentUser && resolvedRole === "vendor" && currentUser.hasVendor && currentUser.role !== "vendor") {
      pendingRoleRef.current = true;
      try { await useAuthStore.getState().switchRole(); } catch {}
      currentUser = useAuthStore.getState().user;
    }
    // Navigate directly after all state is final
    if (currentUser) {
      if (currentUser.role === "admin") { router.replace("/(admin)"); return; }
      if (resolvedRole === "vendor" && !currentUser.hasVendor) { router.replace("/(vendor-onboarding)/setup-store" as any); return; }
      if (resolvedRole === "vendor" && currentUser.hasVendor) { router.replace("/(vendor)"); return; }
    }
    if (redirect) { router.replace(redirect as any); return; }
    router.replace("/(buyer)");
  };

  const [socialError, setSocialError] = useState("");

  const handleOAuthOutcome = async (outcome: OAuthOutcome) => {
    setSocialError("");
    if (outcome.status === "LOGIN") {
      if (isAuthenticated || user) {
        await beginFreshAuthFlow().catch(() => {});
      }
      useAuthStore.getState().finalizeOAuthSession(outcome.user, outcome.token);
      const loggedInUser = outcome.user;
      if (loggedInUser.role === "admin") { router.replace("/(admin)"); return; }
      if (loggedInUser.role === "vendor" && !loggedInUser.hasVendor) { router.replace("/(vendor-onboarding)/setup-store" as any); return; }
      if (loggedInUser.role === "vendor") { router.replace("/(vendor)"); return; }
      if (redirect) { router.replace(redirect as any); return; }
      router.replace("/(buyer)");
      return;
    }
    if (outcome.status === "LINK_REQUIRED") {
      router.push({ pathname: "/(auth)/oauth-link", params: { ticket: outcome.ticket, email: outcome.email, redirect: redirect ?? "", role: resolvedRole } });
      return;
    }
    router.push({
      pathname: "/(auth)/oauth-complete-signup",
      params: {
        ticket: outcome.ticket,
        prefillName: outcome.prefill.name ?? "",
        prefillEmail: outcome.prefill.email ?? "",
        missingFields: outcome.missingFields.join(","),
        role: resolvedRole,
        redirect: redirect ?? "",
      },
    });
  };

  if (isAdmin) {
    return (
      <SafeAreaView style={styles.adminPage} edges={["top", "bottom"]}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.adminKeyboard}>
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
              : "Sign in to browse, order, and manage your marketplace account."}
          </Text>
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView
          ref={scrollRef}
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
              ref={emailInputRef}
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
              onFocus={scrollToInput(emailInputRef)}
              error={emailError}
            />

            <Input
              ref={passwordInputRef}
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
              onFocus={scrollToInput(passwordInputRef)}
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

            {socialError ? (
              <View style={[styles.errorBanner, { marginTop: 12, marginBottom: 0 }]}>
                <Ionicons name="alert-circle-outline" size={18} color="#FB6363" style={{ marginTop: 1 }} />
                <Text style={styles.errorText}>{socialError}</Text>
              </View>
            ) : null}

            <SocialAuthButtons onOutcome={handleOAuthOutcome} onError={setSocialError} disabled={isLoading} />
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
    paddingTop: 6,
    paddingBottom: 16,
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
    marginBottom: 10,
  },
  heroPill: {
    alignSelf: "flex-start",
    minHeight: 26,
    borderRadius: 13,
    backgroundColor: "rgba(255,255,255,0.12)",
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  heroPillText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
  },
  heroTitle: {
    color: "#FFFFFF",
    fontSize: 22,
    lineHeight: 26,
    fontWeight: "800",
  },
  heroBody: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 12,
    lineHeight: 17,
    marginTop: 6,
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
