import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "../stores/authStore";

/**
 * Entry route. While the auth store rehydrates from secure storage we show
 * a brand splash. Once we know whether the user is signed in we either:
 *  - replace to the role home (/(buyer) | /(vendor) | /(admin)), OR
 *  - show the splash CTA that takes the user to the onboarding/role flow.
 *
 * No PNG mockups, no fake "9:41" status bar. Real components only.
 */
export default function Index() {
  const router = useRouter();
  const { ref } = useLocalSearchParams<{ ref?: string }>();
  const hasNavigated = useRef(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let attempts = 0;
    const maxAttempts = 50;

    const check = () => {
      if (hasNavigated.current) return;
      const state = useAuthStore.getState();

      if (state.isInitializing && attempts < maxAttempts) {
        attempts += 1;
        setTimeout(check, 100);
        return;
      }

      if (state.isAuthenticated) {
        hasNavigated.current = true;
        if (state.user?.role === "vendor") router.replace("/(vendor)" as any);
        else if (state.user?.role === "admin") router.replace("/(admin)" as any);
        else router.replace("/(buyer)" as any);
        return;
      }

      // Not signed in — if onboarding has been seen, go straight to role-select.
      if (state.hasSeenOnboarding) {
        hasNavigated.current = true;
        router.replace({ pathname: "/(auth)/role-select", params: typeof ref === "string" && ref.trim() ? { ref } : {} } as any);
        return;
      }

      setReady(true);
    };

    setTimeout(check, 120);
  }, [router]);

  const handleGetStarted = () => {
    if (hasNavigated.current) return;
    hasNavigated.current = true;
    router.replace({ pathname: "/(auth)/onboarding", params: typeof ref === "string" && ref.trim() ? { ref } : {} } as any);
  };

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <LinearGradient
        colors={["#064E3B", "#076B51", "#0B8E6B"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView edges={["top", "bottom"]} style={styles.body}>
        <View style={styles.heroBlock}>
          <Image
            source={require("../assets/branding/logo-wordmark-white.png")}
            resizeMode="contain"
            style={styles.logoImage}
          />
          <Text style={styles.tagline}>African foodstuff,{"\n"}delivered worldwide</Text>
        </View>

        {ready ? (
          <View style={styles.ctaBlock}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Get Started"
              activeOpacity={0.86}
              onPress={handleGetStarted}
              style={styles.cta}
            >
              <Text style={styles.ctaText}>Get Started</Text>
              <Ionicons name="arrow-forward" size={16} color="#076B51" />
            </TouchableOpacity>
            <View style={styles.legalRow}>
              <Text style={styles.legal}>By continuing you agree to our </Text>
              <TouchableOpacity onPress={() => router.push("/terms" as any)} activeOpacity={0.8}>
                <Text style={styles.legalLink}>Terms</Text>
              </TouchableOpacity>
              <Text style={styles.legal}> & </Text>
              <TouchableOpacity onPress={() => router.push("/privacy" as any)} activeOpacity={0.8}>
                <Text style={styles.legalLink}>Privacy</Text>
              </TouchableOpacity>
              <Text style={styles.legal}>.</Text>
            </View>
          </View>
        ) : (
          <View style={styles.loadingBlock}>
            <ActivityIndicator size="small" color="rgba(255,255,255,0.78)" />
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#076B51" },
  body: {
    flex: 1,
    paddingHorizontal: 28,
    paddingBottom: 24,
    justifyContent: "space-between",
  },
  heroBlock: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  logoImage: {
    width: 270,
    height: 126,
    marginBottom: 18,
  },
  tagline: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 15,
    fontFamily: "Outfit-Regular",
    textAlign: "center",
    lineHeight: 22,
    marginTop: 12,
  },
  ctaBlock: {
    width: "100%",
    alignItems: "center",
    gap: 14,
  },
  cta: {
    width: "100%",
    height: 56,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
  },
  ctaText: { color: "#076B51", fontSize: 16, fontFamily: "Manrope-SemiBold" },
  legal: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 11,
    fontFamily: "Outfit-Regular",
    textAlign: "center",
  },
  legalRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
  },
  legalLink: {
    color: "#FFFFFF",
    fontSize: 11,
    fontFamily: "Manrope-Bold",
    textDecorationLine: "underline",
  },
  loadingBlock: {
    paddingVertical: 28,
    alignItems: "center",
  },
});
