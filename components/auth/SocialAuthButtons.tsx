import React, { useEffect, useState } from "react";
import { ActivityIndicator, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";

import { authService } from "../../services/authService";
import { GOOGLE_ANDROID_CLIENT_ID, GOOGLE_IOS_CLIENT_ID, GOOGLE_WEB_CLIENT_ID } from "../../services/api/config";
import type { OAuthOutcome } from "../../types/auth";

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_CONFIGURED = Boolean(GOOGLE_IOS_CLIENT_ID || GOOGLE_ANDROID_CLIENT_ID || GOOGLE_WEB_CLIENT_ID);

const BASE64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** Minimal base64 decoder — avoids depending on `atob`/`Buffer`, neither of which is guaranteed to exist in the Hermes RN runtime. */
function decodeBase64(input: string): string {
  const clean = input.replace(/=+$/, "");
  let bits = "";
  for (const char of clean) {
    const index = BASE64_CHARS.indexOf(char);
    if (index === -1) continue;
    bits += index.toString(2).padStart(6, "0");
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return decodeURIComponent(bytes.map((b) => "%" + b.toString(16).padStart(2, "0")).join(""));
}

/** Decodes (never verifies — that's the server's job) a JWT payload to read the `name` claim for display prefill only. */
function decodeNameClaim(idToken: string): string | undefined {
  try {
    const payloadB64Url = idToken.split(".")[1]?.replace(/-/g, "+").replace(/_/g, "/");
    if (!payloadB64Url) return undefined;
    const json = JSON.parse(decodeBase64(payloadB64Url));
    return typeof json.name === "string" ? json.name : undefined;
  } catch {
    return undefined;
  }
}

interface SocialAuthButtonsProps {
  /** Called with a resolved outcome, or null on user cancellation (no error to show). */
  onOutcome: (outcome: OAuthOutcome) => void;
  /** Called on a real provider/network/verification error — show this as the existing error banner. */
  onError: (message: string) => void;
  disabled?: boolean;
}

/**
 * "Continue with Google" / "Continue with Apple" — added to the existing
 * login/register screens without redesigning them. Self-contained styling
 * so it looks consistent on both screens' white card backgrounds.
 */
export function SocialAuthButtons({ onOutcome, onError, disabled }: SocialAuthButtonsProps) {
  const [busyProvider, setBusyProvider] = useState<"google" | "apple" | null>(null);
  const [appleAvailable, setAppleAvailable] = useState(false);

  useEffect(() => {
    if (Platform.OS === "ios") {
      AppleAuthentication.isAvailableAsync().then(setAppleAvailable).catch(() => setAppleAvailable(false));
    }
  }, []);

  // useAuthRequest validates synchronously per-platform and THROWS if the
  // platform-appropriate client ID is missing (e.g. web demands
  // webClientId, even if iosClientId/androidClientId are set) — it doesn't
  // just leave the button inert. Since real client IDs aren't configured
  // yet, an unconditional call here would crash the ENTIRE login/register
  // screen on every platform, not just hide the Google button. Falling
  // back to a placeholder keeps the hook from throwing; GOOGLE_CONFIGURED
  // (below) is what actually gates whether the button renders/works —
  // this placeholder is never exercised because promptAsync() is only
  // ever called from a press handler that checks GOOGLE_CONFIGURED first.
  // responseType is intentionally left unset. expo-auth-session's own
  // Google provider defaults installed apps (iOS/Android) to
  // ResponseType.Code — the real production bug was overriding that to
  // "id_token" here, which sends response_type=id_token to Google's
  // authorization endpoint. Google's iOS-type OAuth client (registered
  // for the native code+PKCE flow, no client secret) rejects that
  // implicit response type with "Error 400: unsupported_response_type"
  // (real TestFlight error, confirmed against expo-auth-session@57.0.11's
  // published source: the code flow auto-exchanges via PKCE, no secret
  // needed, and populates result.params.id_token from the exchange —
  // the exact same field this component already reads below, so no
  // other change is needed.
  const [, googleResponse, promptGoogleAsync] = Google.useAuthRequest({
    iosClientId: GOOGLE_IOS_CLIENT_ID || "unconfigured.apps.googleusercontent.com",
    androidClientId: GOOGLE_ANDROID_CLIENT_ID || "unconfigured.apps.googleusercontent.com",
    webClientId: GOOGLE_WEB_CLIENT_ID || "unconfigured.apps.googleusercontent.com",
    scopes: ["openid", "profile", "email"],
  });

  useEffect(() => {
    if (!googleResponse) return;
    if (googleResponse.type === "cancel" || googleResponse.type === "dismiss") {
      setBusyProvider(null);
      return;
    }
    if (googleResponse.type === "error") {
      setBusyProvider(null);
      onError(googleResponse.error?.message ?? "Google sign-in failed. Please try again.");
      return;
    }
    if (googleResponse.type === "success") {
      const idToken = googleResponse.params.id_token ?? googleResponse.authentication?.idToken;
      if (!idToken) {
        setBusyProvider(null);
        onError("Google did not return a valid identity token. Please try again.");
        return;
      }
      const name = decodeNameClaim(idToken);
      authService
        .continueWithGoogle(idToken, name)
        .then(onOutcome)
        .catch((err) => onError(err instanceof Error ? err.message : "Google sign-in failed. Please try again."))
        .finally(() => setBusyProvider(null));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [googleResponse]);

  const handleGooglePress = () => {
    if (!GOOGLE_CONFIGURED || disabled || busyProvider) return;
    setBusyProvider("google");
    promptGoogleAsync().catch((err) => {
      setBusyProvider(null);
      onError(err instanceof Error ? err.message : "Google sign-in failed. Please try again.");
    });
  };

  const handleApplePress = async () => {
    if (disabled || busyProvider) return;
    setBusyProvider("apple");
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
      });
      // fullName is ONLY populated on the user's first-ever authorization
      // for this app — Apple never sends it again on subsequent logins.
      const fullName = [credential.fullName?.givenName, credential.fullName?.familyName].filter(Boolean).join(" ").trim() || undefined;
      const outcome = await authService.continueWithApple(credential.identityToken ?? "", fullName);
      onOutcome(outcome);
    } catch (err: any) {
      if (err?.code === "ERR_REQUEST_CANCELED" || err?.code === "ERR_CANCELED") {
        // User cancelled — not an error, nothing to show.
      } else {
        onError(err instanceof Error ? err.message : "Apple sign-in failed. Please try again.");
      }
    } finally {
      setBusyProvider(null);
    }
  };

  const showApple = Platform.OS === "ios" && appleAvailable;
  if (!GOOGLE_CONFIGURED && !showApple) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>or</Text>
        <View style={styles.dividerLine} />
      </View>

      {GOOGLE_CONFIGURED ? (
        <TouchableOpacity
          accessibilityRole="button"
          activeOpacity={0.86}
          disabled={disabled || busyProvider !== null}
          onPress={handleGooglePress}
          style={[styles.socialButton, (disabled || busyProvider !== null) && styles.socialButtonDisabled]}
        >
          {busyProvider === "google" ? (
            <ActivityIndicator size="small" color="#282828" />
          ) : (
            <>
              <Ionicons name="logo-google" size={18} color="#282828" style={styles.socialIcon} />
              <Text style={styles.socialText}>Continue with Google</Text>
            </>
          )}
        </TouchableOpacity>
      ) : null}

      {showApple ? (
        <TouchableOpacity
          accessibilityRole="button"
          activeOpacity={0.86}
          disabled={disabled || busyProvider !== null}
          onPress={handleApplePress}
          style={[styles.socialButton, styles.appleButton, (disabled || busyProvider !== null) && styles.socialButtonDisabled]}
        >
          {busyProvider === "apple" ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="logo-apple" size={20} color="#FFFFFF" style={styles.socialIcon} />
              <Text style={[styles.socialText, styles.appleText]}>Continue with Apple</Text>
            </>
          )}
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 6, marginBottom: 4 },
  dividerRow: { flexDirection: "row", alignItems: "center", marginBottom: 14 },
  dividerLine: { flex: 1, height: 1, backgroundColor: "#E4E9E7" },
  dividerText: { color: "#9AA6A1", fontSize: 12, fontWeight: "700", marginHorizontal: 10 },
  socialButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E4E9E7",
    backgroundColor: "#FFFFFF",
    marginBottom: 10,
  },
  socialButtonDisabled: { opacity: 0.55 },
  appleButton: { backgroundColor: "#000000", borderColor: "#000000" },
  socialIcon: { marginRight: 8 },
  socialText: { color: "#282828", fontSize: 14, fontWeight: "700" },
  appleText: { color: "#FFFFFF" },
});
