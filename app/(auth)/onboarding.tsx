import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { useAuthStore } from "../../stores/authStore";

/**
 * Onboarding splash — exact match for screenshot 1.
 * Vendor-flavored hero: floating dashboard cards + headline +
 * "Get Started" CTA + trust badges. Built with real components only.
 */
export default function OnboardingScreen() {
  const router = useRouter();
  const { ref } = useLocalSearchParams<{ ref?: string }>();
  const setHasSeenOnboarding = useAuthStore((s) => s.setHasSeenOnboarding);

  const handleGetStarted = () => {
    setHasSeenOnboarding();
    router.replace({ pathname: "/(auth)/role-select", params: typeof ref === "string" && ref.trim() ? { ref } : {} } as any);
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      {/* Top hero with green gradient */}
      <LinearGradient
        colors={["#A7DFC9", "#D4F0E5", "#F4F9F5"]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.hero}
      >
        <SafeAreaView edges={["top"]} style={{ flex: 1 }}>
          {/* Top-right floating "Sales this week" card */}
          <View style={styles.weekCard}>
            <View style={styles.weekCardIcon}>
              <Ionicons name="calendar-outline" size={22} color="#FFFFFF" />
            </View>
            <View>
              <Text style={styles.weekCardLabel}>Sales this week</Text>
              <Text style={styles.weekCardValue}>$540</Text>
              <Text style={styles.weekCardSub}>≈ ₦810,000</Text>
            </View>
          </View>

          {/* Center floating tasks card */}
          <View style={styles.tasksCard}>
            <TaskRow
              iconName="cart-outline"
              iconBg="rgba(7,107,81,0.10)"
              iconColor="#076B51"
              label="Orders requiring action"
              count={3}
            />
            <View style={styles.taskDivider} />
            <TaskRow
              iconName="cube-outline"
              iconBg="rgba(7,107,81,0.10)"
              iconColor="#076B51"
              label="Low stock alerts"
              count={3}
            />
            <View style={styles.taskDivider} />
            <TaskRow
              iconName="chatbubble-ellipses-outline"
              iconBg="rgba(7,107,81,0.10)"
              iconColor="#076B51"
              label="Unread buyer messages"
              count={5}
            />
          </View>

          {/* "Sales today" floating card */}
          <View style={styles.todayCard}>
            <View style={styles.todayIcon}>
              <Ionicons name="sunny-outline" size={22} color="#076B51" />
            </View>
            <View>
              <Text style={styles.todayLabel}>Sales today</Text>
              <Text style={styles.todayValue}>$120</Text>
              <Text style={styles.todaySub}>≈ ₦180,000</Text>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* Bottom content */}
      <View style={styles.bottom}>
        <Text style={styles.headline}>Sell your foodstuff{"\n"}to buyers abroad</Text>
        <Text style={styles.subhead}>
          Get orders, receive secure payment,{"\n"}and grow your business with Eki
        </Text>

        <TouchableOpacity activeOpacity={0.86} onPress={handleGetStarted} style={styles.cta}>
          <Text style={styles.ctaText}>Get Started</Text>
          <View style={styles.ctaArrow}>
            <Ionicons name="arrow-up" size={14} color="#FFFFFF" style={{ transform: [{ rotate: "45deg" }] }} />
          </View>
        </TouchableOpacity>

        <View style={styles.trustRow}>
          <TrustBadge icon="shield-checkmark-outline" label="Trusted selling" />
          <TrustBadge icon="lock-closed-outline" label="Secure payment" />
          <TrustBadge icon="car-outline" label="Smooth delivery" />
        </View>
      </View>
    </View>
  );
}

function TaskRow({
  iconName,
  iconBg,
  iconColor,
  label,
  count,
}: {
  iconName: keyof typeof Ionicons.glyphMap;
  iconBg: string;
  iconColor: string;
  label: string;
  count: number;
}) {
  return (
    <View style={styles.taskRow}>
      <View style={[styles.taskIcon, { backgroundColor: iconBg }]}>
        <Ionicons name={iconName} size={18} color={iconColor} />
      </View>
      <Text style={styles.taskLabel}>{label}</Text>
      <View style={styles.countPill}>
        <Text style={styles.countText}>{count}</Text>
      </View>
      <View style={styles.arrowPill}>
        <Ionicons name="arrow-up" size={14} color="#076B51" style={{ transform: [{ rotate: "45deg" }] }} />
      </View>
    </View>
  );
}

function TrustBadge({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <View style={styles.trustBadge}>
      <Ionicons name={icon} size={14} color="#076B51" />
      <Text style={styles.trustText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },

  hero: {
    height: "62%",
    paddingHorizontal: 18,
  },

  // Top-right "Sales this week" card (dark green)
  weekCard: {
    position: "absolute",
    right: -16,
    top: 80,
    width: 240,
    height: 110,
    borderRadius: 22,
    backgroundColor: "#0F7A5A",
    paddingHorizontal: 18,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    transform: [{ rotate: "-3deg" }],
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 6,
  },
  weekCardIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  weekCardLabel: { color: "rgba(255,255,255,0.85)", fontSize: 13, fontFamily: "Outfit-Regular" },
  weekCardValue: { color: "#FFFFFF", fontSize: 22, fontFamily: "Manrope-Bold", marginTop: 2 },
  weekCardSub: { color: "rgba(255,255,255,0.55)", fontSize: 11, fontFamily: "Outfit-Regular", textDecorationLine: "line-through" },

  // Center tasks card (white)
  tasksCard: {
    position: "absolute",
    left: 14,
    right: 24,
    top: 165,
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 10,
    transform: [{ rotate: "-2deg" }],
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.10,
    shadowRadius: 18,
    elevation: 6,
  },
  taskRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 4,
    gap: 12,
  },
  taskIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  taskLabel: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Manrope-SemiBold",
    color: "#282828",
  },
  countPill: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#FFE5E5",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  countText: { fontSize: 11, fontFamily: "Manrope-Bold", color: "#FB6363" },
  arrowPill: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#E8F5F0",
    alignItems: "center",
    justifyContent: "center",
  },
  taskDivider: { height: 1, backgroundColor: "#F0F0F0", marginHorizontal: 8 },

  // "Sales today" card
  todayCard: {
    position: "absolute",
    left: 18,
    bottom: 50,
    right: 80,
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.10,
    shadowRadius: 14,
    elevation: 5,
  },
  todayIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(7,107,81,0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  todayLabel: { color: "#858585", fontSize: 12, fontFamily: "Outfit-Regular" },
  todayValue: { color: "#1A1A1A", fontSize: 22, fontFamily: "Manrope-Bold", marginTop: 2 },
  todaySub: { color: "#858585", fontSize: 11, fontFamily: "Outfit-Regular", textDecorationLine: "line-through" },

  // Bottom content
  bottom: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 30,
    alignItems: "center",
    justifyContent: "flex-start",
  },
  headline: {
    fontSize: 28,
    fontFamily: "Manrope-ExtraBold",
    color: "#1A1A1A",
    textAlign: "center",
    lineHeight: 34,
  },
  subhead: {
    fontSize: 14,
    fontFamily: "Outfit-Regular",
    color: "#858585",
    textAlign: "center",
    lineHeight: 20,
    marginTop: 14,
  },
  cta: {
    width: "100%",
    height: 56,
    borderRadius: 14,
    backgroundColor: "#076B51",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 22,
  },
  ctaText: { color: "#FFFFFF", fontSize: 16, fontFamily: "Manrope-SemiBold" },
  ctaArrow: {
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  trustRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    columnGap: 18,
    rowGap: 8,
    marginTop: 20,
  },
  trustBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  trustText: { color: "#076B51", fontSize: 12, fontFamily: "Manrope-SemiBold" },
});
