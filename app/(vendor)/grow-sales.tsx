import React from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

const GRID_TOOLS = [
  { 
    icon: "pricetag-outline", 
    title: "Create coupon", 
    subtitle: "Share a real promo code",
    route: "/(vendor)/create-discount", 
    bg: "#FFFFFF", 
    iconBg: "rgba(7,107,81,0.08)", 
    iconColor: "#076B51", 
    textColor: "#282828",
    border: true
  },
  { 
    icon: "chatbubble-ellipses-outline", 
    title: "Message buyers", 
    subtitle: "Send a private offer",
    route: "/(vendor)/send-offer", 
    bg: "#076B51", 
    iconBg: "rgba(255,255,255,0.15)", 
    iconColor: "#FFFFFF", 
    textColor: "#FFFFFF",
    border: false
  },
  { 
    icon: "bar-chart-outline", 
    title: "View analytics", 
    subtitle: "Public store activity",
    route: "/(vendor)/analytics", 
    bg: "#282828", 
    iconBg: "rgba(255,255,255,0.15)", 
    iconColor: "#FFFFFF", 
    textColor: "#FFFFFF",
    border: false
  },
  { 
    icon: "share-social-outline", 
    title: "Share store link", 
    subtitle: "Get direct sales",
    route: "/(vendor)/share-store-link", 
    bg: "#FFFFFF", 
    iconBg: "rgba(7,107,81,0.08)", 
    iconColor: "#076B51", 
    textColor: "#282828",
    border: true
  },
];

export default function GrowSalesScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header section with curves */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.replace("/(vendor)/settings" as any)} activeOpacity={0.85} style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color="#076B51" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Grow your sales</Text>
        <Text style={styles.headerSubtitle}>Bring back past buyers and get more orders</Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>Marketing Campaigns</Text>

        {/* 2x2 Grid with exact mockup colors */}
        <View style={styles.grid}>
          {GRID_TOOLS.map((tool) => {
            return (
              <TouchableOpacity
                key={tool.title}
                onPress={() => router.push(tool.route as any)}
                activeOpacity={0.85}
                style={[
                  styles.gridCard, 
                  { backgroundColor: tool.bg },
                  tool.border && styles.gridCardBorder,
                ]}
              >
                <View style={[styles.gridIcon, { backgroundColor: tool.iconBg }]}>
                  <Ionicons name={tool.icon as any} size={22} color={tool.iconColor} />
                </View>
                <Text style={[styles.gridLabel, { color: tool.textColor }]}>{tool.title}</Text>
                <Text style={[styles.gridSubtitle, { color: tool.textColor === "#FFFFFF" ? "rgba(255,255,255,0.7)" : "#858585" }]}>
                  {tool.subtitle}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Send Offer Button with arrow-up-right */}
        <TouchableOpacity
          onPress={() => router.push("/(vendor)/send-offer" as any)}
          activeOpacity={0.85}
          style={styles.sendOfferButton}
        >
          <Text style={styles.sendOfferText}>Send offer to buyers</Text>
          <Ionicons name={"arrow-up-forward" as any} size={18} color="#FFFFFF" />
        </TouchableOpacity>

        {/* Premium Marketing Tip Gradient Card */}
        <LinearGradient
          colors={["#2C2C2C", "#000000"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.tipCard}
        >
          <Text style={styles.tipTitle}>Marketing Tip</Text>
          <Text style={styles.tipBody}>
            Coupon codes and direct buyer messages work best when the offer is short and the expiry is clear.
          </Text>
        </LinearGradient>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9F9F9" },
  header: { 
    backgroundColor: "#076B51", 
    paddingHorizontal: 24, 
    paddingTop: 16, 
    paddingBottom: 35, 
    borderBottomLeftRadius: 32, 
    borderBottomRightRadius: 32 
  },
  backButton: { 
    width: 40, 
    height: 40, 
    borderRadius: 20, 
    backgroundColor: "#FFFFFF", 
    alignItems: "center", 
    justifyContent: "center", 
    marginBottom: 16 
  },
  headerTitle: { 
    fontSize: 28, 
    fontFamily: "Manrope-Bold", 
    color: "#FFFFFF" 
  },
  headerSubtitle: { 
    fontSize: 14, 
    fontFamily: "Outfit-Regular", 
    color: "rgba(255,255,255,0.85)", 
    marginTop: 4 
  },
  scrollContent: { 
    paddingHorizontal: 16, 
    paddingTop: 24, 
    paddingBottom: 40 
  },
  sectionTitle: { 
    fontSize: 16, 
    fontFamily: "Manrope-Bold", 
    color: "#282828", 
    marginBottom: 16 
  },
  grid: { 
    flexDirection: "row", 
    flexWrap: "wrap", 
    gap: 12, 
    marginBottom: 16,
    justifyContent: "space-between"
  },
  gridCard: { 
    width: "48%", 
    borderRadius: 20, 
    paddingVertical: 24, 
    paddingHorizontal: 16, 
    alignItems: "center", 
    justifyContent: "center", 
    minHeight: 140,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2
  },
  gridCardBorder: {
    borderWidth: 1,
    borderColor: "#EAEAEA"
  },
  gridIcon: { 
    width: 50, 
    height: 50, 
    borderRadius: 25, 
    alignItems: "center", 
    justifyContent: "center", 
    marginBottom: 12 
  },
  gridLabel: { 
    fontSize: 13, 
    fontFamily: "Manrope-Bold", 
    textAlign: "center" 
  },
  gridSubtitle: {
    fontSize: 11,
    fontFamily: "Outfit-Regular",
    textAlign: "center",
    marginTop: 4
  },
  sendOfferButton: { 
    height: 54, 
    borderRadius: 14, 
    backgroundColor: "#076B51", 
    flexDirection: "row", 
    alignItems: "center", 
    justifyContent: "center", 
    gap: 8, 
    marginBottom: 20 
  },
  sendOfferText: { 
    fontSize: 15, 
    fontFamily: "Manrope-SemiBold", 
    color: "#FFFFFF" 
  },
  tipCard: { 
    borderRadius: 20, 
    padding: 20 
  },
  tipTitle: { 
    fontSize: 16, 
    fontFamily: "Manrope-Bold", 
    color: "#FFFFFF", 
    marginBottom: 6 
  },
  tipBody: { 
    fontSize: 13, 
    fontFamily: "Outfit-Regular", 
    color: "rgba(255,255,255,0.75)", 
    lineHeight: 19 
  },
});
