import React from "react";
import { StyleSheet, Text, TouchableOpacity, View, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

const HERO_BG = "#076B51";
const PAGE_BG = "#F4F4F4";

export function PremiumHeader({
  title,
  subtitle,
  onBack,
  right,
  children,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <SafeAreaView edges={["top"]} style={{ backgroundColor: HERO_BG }}>
      <View style={styles.hero}>
        <View style={styles.heroTopRow}>
          <View style={styles.heroTitleWrap}>
            {onBack ? (
              <TouchableOpacity onPress={onBack} activeOpacity={0.82} style={styles.backButton}>
                <Ionicons name="arrow-back" size={18} color="#FFFFFF" />
              </TouchableOpacity>
            ) : null}
            <View style={{ flex: 1 }}>
              <Text style={styles.heroTitle}>{title}</Text>
              {subtitle ? <Text style={styles.heroSubtitle}>{subtitle}</Text> : null}
            </View>
          </View>
          {right}
        </View>
        {children}
      </View>
    </SafeAreaView>
  );
}

export function PremiumSectionTitle({
  title,
  action,
}: {
  title: string;
  action?: string;
}) {
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action ? <Text style={styles.sectionAction}>{action}</Text> : null}
    </View>
  );
}

export function FloatingCard({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Pill({
  label,
  dark = false,
}: {
  label: string;
  dark?: boolean;
}) {
  return (
    <View style={[styles.pill, dark && styles.pillDark]}>
      <Text style={[styles.pillText, dark && styles.pillTextDark]}>{label}</Text>
    </View>
  );
}

export const premiumStyles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: PAGE_BG,
  },
  scrollContent: {
    paddingBottom: 128,
  },
  block: {
    marginTop: 22,
    paddingHorizontal: 16,
  },
});

const styles = StyleSheet.create({
  hero: {
    backgroundColor: HERO_BG,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 24,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heroTitleWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  heroTitle: {
    color: "#FFFFFF",
    fontSize: 28,
    lineHeight: 32,
    fontFamily: "Manrope-Bold",
  },
  heroSubtitle: {
    marginTop: 4,
    color: "rgba(255,255,255,0.72)",
    fontSize: 13,
    lineHeight: 18,
    fontFamily: "Outfit-Medium",
  },
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    color: "#12221A",
    fontSize: 20,
    fontFamily: "Manrope-ExtraBold",
  },
  sectionAction: {
    color: "#2E6957",
    fontSize: 13,
    fontFamily: "Manrope-Bold",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 30,
    padding: 16,
    shadowColor: "#282828",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 8,
  },
  pill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: "#E8F4ED",
  },
  pillDark: {
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  pillText: {
    color: "#2E6957",
    fontSize: 11,
    fontFamily: "Manrope-Bold",
  },
  pillTextDark: {
    color: "#FFFFFF",
  },
});
