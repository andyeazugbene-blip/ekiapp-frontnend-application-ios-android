import React from "react";
import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "../stores/authStore";
import { goBackOrReplace } from "../utils/navigation";

const SUPPORT_EMAIL = "adminandy@eki.app";

const SECTIONS: [string, string][] = [
  ["Order help", "Open the order screen, use Track Order, and keep messages inside Eki so support can review the full timeline."],
  ["Order disputes", "If goods are missing, damaged, or incorrect, open a dispute from the order screen. Admins review the order timeline, messages, and payment status before deciding next steps."],
  ["Vendor help", "Vendors can contact support for verification, payout methods, account limits, product uploads, and delivery settings."],
];

export default function SupportScreen() {
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hasVendor = useAuthStore((s) => s.user?.hasVendor === true);
  const role = useAuthStore((s) => s.user?.role);
  const isVendor = hasVendor && role !== "buyer";

  const openInApp = () => {
    router.push((isVendor ? "/(vendor)/contact-support" : "/(buyer)/contact-support") as any);
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => goBackOrReplace(router, "/" as any)} activeOpacity={0.85} accessibilityLabel="Go back" accessibilityRole="button" style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color="#17211D" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Support</Text>
          <Text style={styles.subtitle}>Where buyers and vendors can get help with orders, payments, payouts, verification, and accounts.</Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {SECTIONS.map(([heading, body]) => (
          <View key={heading} style={styles.card}>
            <Text style={styles.heading}>{heading}</Text>
            <Text style={styles.body}>{body}</Text>
          </View>
        ))}

        <View style={styles.card}>
          <Text style={styles.heading}>Contact</Text>
          {isAuthenticated ? (
            <>
              <Text style={styles.body}>Message our support team from inside the app. A real admin replies in your Messages, and you get a notification when they do.</Text>
              <TouchableOpacity onPress={openInApp} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel="Message support in the app" style={styles.primaryBtn}>
                <Ionicons name="chatbubble-ellipses-outline" size={16} color="#FFFFFF" />
                <Text style={styles.primaryBtnText}>Message support</Text>
              </TouchableOpacity>
              <Text style={[styles.body, { marginTop: 14 }]}>Prefer email? Write to {SUPPORT_EMAIL} with your account email, order number, store name, and screenshots if available.</Text>
            </>
          ) : (
            <Text style={styles.body}>Sign in to message support from inside the app. Otherwise email {SUPPORT_EMAIL} with your account email, order number, store name, and screenshots if available.</Text>
          )}
          <TouchableOpacity onPress={() => void Linking.openURL(`mailto:${SUPPORT_EMAIL}`)} activeOpacity={0.85} accessibilityRole="link" accessibilityLabel={`Email ${SUPPORT_EMAIL}`} style={styles.linkBtn}>
            <Text style={styles.linkBtnText}>Email {SUPPORT_EMAIL}</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.footer}>Canonical URL: https://culinarytales.app/support</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F7FAF8" },
  header: { flexDirection: "row", gap: 12, alignItems: "flex-start", paddingHorizontal: 16, paddingVertical: 16 },
  backButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  title: { fontSize: 24, fontFamily: "Manrope-Bold", color: "#17211D" },
  subtitle: { marginTop: 4, fontSize: 13, lineHeight: 19, fontFamily: "Outfit-Regular", color: "#6A746F" },
  content: { paddingHorizontal: 16, paddingBottom: 40 },
  card: { backgroundColor: "#FFFFFF", borderRadius: 18, padding: 16, borderWidth: 1, borderColor: "#E5EEE9", marginBottom: 12 },
  heading: { fontSize: 16, fontFamily: "Manrope-Bold", color: "#076B51" },
  body: { marginTop: 8, fontSize: 14, lineHeight: 21, fontFamily: "Outfit-Regular", color: "#26332E" },
  primaryBtn: { marginTop: 14, height: 50, borderRadius: 14, backgroundColor: "#076B51", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  primaryBtnText: { fontSize: 15, fontFamily: "Manrope-Bold", color: "#FFFFFF" },
  linkBtn: { marginTop: 10, minHeight: 44, justifyContent: "center" },
  linkBtnText: { fontSize: 14, fontFamily: "Manrope-Bold", color: "#076B51", textDecorationLine: "underline" },
  footer: { marginTop: 8, textAlign: "center", fontSize: 12, fontFamily: "Outfit-Regular", color: "#7B8781" },
});
