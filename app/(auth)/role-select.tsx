import React, { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

type Role = "vendor" | "buyer";

/**
 * "What do you want to do on Eki?" — exact match for screenshot 2.
 * Two selectable role cards (vendor / buyer) with continue button.
 */
export default function RoleSelectScreen() {
  const router = useRouter();
  const [selected, setSelected] = useState<Role>("vendor");

  const handleContinue = () => {
    router.push({ pathname: "/(auth)/welcome", params: { role: selected } });
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
        <View style={styles.content}>
          <Text style={styles.title}>What do you want{"\n"}to do on Eki?</Text>

          <RoleCard
            iconName="home-outline"
            title="Sell Foodstuff"
            subtitle="Start selling to buyers in UK, US,\nCanada and Europe"
            selected={selected === "vendor"}
            onPress={() => setSelected("vendor")}
          />

          <RoleCard
            iconName="bag-outline"
            title="Buy Foodstuff"
            subtitle="Order authentic African foodstuff\nfrom trusted vendors"
            selected={selected === "buyer"}
            onPress={() => setSelected("buyer")}
          />
        </View>

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
    paddingHorizontal: 22,
    paddingTop: 20,
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
