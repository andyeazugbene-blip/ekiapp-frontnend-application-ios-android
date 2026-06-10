import React from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

export default function TermsScreen() {
  return (
    <LegalPage
      title="Terms of Service"
      subtitle="Rules for using Eki as a buyer, vendor, or admin-managed marketplace participant."
      canonicalUrl="https://culinarytales.app/terms"
      sections={[
        ["Marketplace role", "Eki connects buyers with independent foodstuff vendors. Vendors are responsible for accurate listings, stock, packaging, delivery handoff, and lawful product information."],
        ["Payments and order protection", "Physical-goods orders use secure checkout. Vendors accept and ship orders, buyers confirm receipt from tracking, and admins can review disputes when something goes wrong."],
        ["Accounts", "You must provide accurate account details, keep login credentials safe, and use the correct buyer or vendor role. We may suspend accounts that abuse payments, messaging, uploads, or reviews."],
        ["Content and uploads", "Product photos, store images, verification files, and messages must belong to you or be authorized for use. Verification documents are used only for review and compliance."],
        ["Disputes", "Buyers and vendors should keep communication in Eki. Admins may review order records, messages, uploads, and payment status before resolving a case."],
      ]}
    />
  );
}

export function LegalPage({ title, subtitle, sections, canonicalUrl }: { title: string; subtitle: string; sections: [string, string][]; canonicalUrl: string }) {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.85} style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color="#17211D" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {sections.map(([heading, body]) => (
          <View key={heading} style={styles.card}>
            <Text style={styles.heading}>{heading}</Text>
            <Text style={styles.body}>{body}</Text>
          </View>
        ))}
        <Text style={styles.footer}>Canonical URL: {canonicalUrl}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F7FAF8" },
  header: { flexDirection: "row", gap: 12, alignItems: "flex-start", paddingHorizontal: 16, paddingVertical: 16 },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  title: { fontSize: 24, fontFamily: "Manrope-Bold", color: "#17211D" },
  subtitle: { marginTop: 4, fontSize: 13, lineHeight: 19, fontFamily: "Outfit-Regular", color: "#6A746F" },
  content: { paddingHorizontal: 16, paddingBottom: 40 },
  card: { backgroundColor: "#FFFFFF", borderRadius: 18, padding: 16, borderWidth: 1, borderColor: "#E5EEE9", marginBottom: 12 },
  heading: { fontSize: 16, fontFamily: "Manrope-Bold", color: "#076B51" },
  body: { marginTop: 8, fontSize: 14, lineHeight: 21, fontFamily: "Outfit-Regular", color: "#26332E" },
  footer: { marginTop: 8, textAlign: "center", fontSize: 12, fontFamily: "Outfit-Regular", color: "#7B8781" },
});
