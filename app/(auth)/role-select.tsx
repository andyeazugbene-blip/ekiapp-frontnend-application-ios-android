import React, { useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "../../stores/authStore";
import { setPendingIntent } from "../../stores/pendingIntent";

// Client correction: Eki is four independent entry points, not a
// vendor/buyer binary — "community_buy" and "supplier" are real product
// modules a person can enter directly, never gated behind first becoming a
// foodstuff vendor. "vendor"/"buyer" keep their exact original behavior.
type Role = "vendor" | "buyer" | "community_buy" | "supplier";

/**
 * "What do you want to do on Eki?" — Hero / role-selection screen.
 * Four selectable cards: Foodstuffs (sell), Buyers (buy), Community Buy,
 * Suppliers.
 */
export default function RoleSelectScreen() {
  const router = useRouter();
  const { ref } = useLocalSearchParams<{ ref?: string }>();
  const [selected, setSelected] = useState<Role>("vendor");
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const hasSeenOnboarding = useAuthStore((s) => s.hasSeenOnboarding);
  const refParams = typeof ref === "string" && ref.trim() ? { ref } : {};

  const handleContinue = () => {
    // If already logged in, route directly based on selection
    if (isAuthenticated && user) {
      // Community Buy Workstream 9 (universal account): destination access
      // is capability-based (hasVendor / canSupply / authentication only),
      // never role-based — so picking a card is a pure navigation choice
      // plus a local preference update, never a backend switchRole() call.
      if (selected === "vendor") {
        useAuthStore.getState().setLastDestination("sell");
        if (user.hasVendor) {
          router.replace("/(vendor)" as any);
          return;
        }
        // No vendor profile — route to onboarding
        router.replace("/(vendor-onboarding)/setup-store" as any);
        return;
      }
      if (selected === "buyer") {
        useAuthStore.getState().setLastDestination("buy");
        router.replace("/(buyer)" as any);
        return;
      }
      if (selected === "community_buy") {
        // Community Buy organiser/participant needs no vendor role at
        // all — (buyer)'s layout only requires authentication, so any
        // logged-in user (buyer or vendor) can go straight there.
        useAuthStore.getState().setLastDestination("community_buy");
        router.push("/(buyer)/community-buy" as any);
        return;
      }
      // selected === "supplier" — an independent SupplierAccount
      // capability (Workstream 1/3), never gated behind a Vendor row.
      // (vendor)/_layout.tsx no longer requires hasVendor for this specific
      // route, and the screen itself renders every state (apply / under
      // review / approved) from the real backend response — so every
      // authenticated user, Vendor or not, goes straight there. No role
      // pre-switch, no forced vendor-store-onboarding detour.
      useAuthStore.getState().setLastDestination("supply");
      router.push("/(supplier)/community-buy-supplier" as any);
      return;
    }

    if (selected === "community_buy") {
      // No vendor detour, no marketing splash — straight to account
      // creation, landing directly on Community Buy afterward.
      router.push({ pathname: "/(auth)/register", params: { role: "buyer", redirect: "/(buyer)/community-buy", ...refParams } });
      return;
    }
    if (selected === "supplier") {
      setPendingIntent("supplier");
      router.push({ pathname: "/(auth)/register", params: { role: "vendor", ...refParams } });
      return;
    }

    const sharedParams = { role: selected, ...refParams };

    if (!hasSeenOnboarding) {
      router.push({ pathname: "/(auth)/onboarding", params: sharedParams });
      return;
    }

    router.push({ pathname: "/(auth)/welcome", params: sharedParams });
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <LinearGradient
        colors={["#7DD8B0", "#A7E5C7", "#D4F1E0", "#F4F9F5"]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
        <ScrollView style={styles.content} contentContainerStyle={styles.contentInner} showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>What do you want{"\n"}to do on Eki?</Text>

          <RoleCard
            iconName="home-outline"
            title="Foodstuffs"
            subtitle="Start selling to buyers in UK, US,\nCanada and Europe"
            selected={selected === "vendor"}
            onPress={() => setSelected("vendor")}
          />

          <RoleCard
            iconName="bag-outline"
            title="Buyers"
            subtitle="Order authentic African foodstuff\nfrom trusted vendors"
            selected={selected === "buyer"}
            onPress={() => setSelected("buyer")}
          />

          <RoleCard
            iconName="people-outline"
            title="Community Buy"
            subtitle="Organise or join a bulk buy — no\nstore or vendor account required"
            selected={selected === "community_buy"}
            onPress={() => setSelected("community_buy")}
          />

          <RoleCard
            iconName="cube-outline"
            title="Suppliers"
            subtitle="Fulfil Community Buy campaigns\nas a verified Eki supplier"
            selected={selected === "supplier"}
            onPress={() => setSelected("supplier")}
          />
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity activeOpacity={0.86} onPress={handleContinue} style={styles.cta}>
            <Text style={styles.ctaText}>Continue</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

function RoleCard({
  iconName,
  title,
  subtitle,
  selected,
  onPress,
}: {
  iconName: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      activeOpacity={0.86}
      onPress={onPress}
      style={[styles.card, selected ? styles.cardSelected : styles.cardUnselected]}
    >
      <View style={[styles.cardIcon, selected ? styles.cardIconSelected : styles.cardIconUnselected]}>
        <Ionicons name={iconName} size={26} color={selected ? "#FFFFFF" : "#076B51"} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.cardTitle, selected && styles.cardTitleSelected]}>{title}</Text>
        <Text style={[styles.cardSubtitle, selected && styles.cardSubtitleSelected]}>{subtitle}</Text>
      </View>
      <View style={[styles.checkOuter, selected ? styles.checkOuterSelected : styles.checkOuterUnselected]}>
        {selected ? <Ionicons name="checkmark" size={14} color="#FFFFFF" /> : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  content: {
    flex: 1,
  },
  contentInner: {
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 12,
  },
  title: {
    fontSize: 28,
    fontFamily: "Manrope-ExtraBold",
    color: "#1A1A1A",
    lineHeight: 34,
    marginBottom: 36,
  },

  card: {
    width: "100%",
    minHeight: 110,
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginBottom: 16,
  },
  cardSelected: {
    backgroundColor: "#1F1F1F",
  },
  cardUnselected: {
    backgroundColor: "#FFFFFF",
  },
  cardIcon: {
    width: 56,
    height: 56,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  cardIconSelected: {
    backgroundColor: "rgba(255,255,255,0.10)",
  },
  cardIconUnselected: {
    backgroundColor: "#F4F8F6",
  },
  cardTitle: {
    fontSize: 17,
    fontFamily: "Manrope-Bold",
    color: "#1A1A1A",
  },
  cardTitleSelected: {
    color: "#FFFFFF",
  },
  cardSubtitle: {
    fontSize: 13,
    fontFamily: "Outfit-Regular",
    color: "#858585",
    marginTop: 4,
    lineHeight: 18,
  },
  cardSubtitleSelected: {
    color: "rgba(255,255,255,0.65)",
  },
  checkOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  checkOuterSelected: {
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.7)",
  },
  checkOuterUnselected: {
    borderWidth: 1.5,
    borderColor: "#D0D0D0",
    backgroundColor: "transparent",
  },

  footer: {
    paddingHorizontal: 22,
    paddingBottom: 8,
  },
  cta: {
    height: 56,
    borderRadius: 14,
    backgroundColor: "#076B51",
    alignItems: "center",
    justifyContent: "center",
  },
  ctaText: { color: "#FFFFFF", fontSize: 16, fontFamily: "Manrope-SemiBold" },
});
