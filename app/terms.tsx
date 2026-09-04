import React from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

export default function TermsScreen() {
  return (
    <LegalPage
      title="Terms & Conditions"
      subtitle="These Terms and Conditions govern the use of the Eki platform, operated by Ehimare Co, 5 Marriott Street, Coundon, Coventry, CV6 1BB, England."
      canonicalUrl="https://culinarytales.app/terms"
      sections={[
        ["1. About Eki", "Eki is a technology platform that helps African foodstuff and ingredient vendors manage products, orders, customers, marketing campaigns, and business operations.\n\nEki is not the seller of products listed on the platform. Transactions are conducted between buyers and vendors."],
        ["2. Eligibility", "To use Eki you must:\n• Be at least 18 years old.\n• Provide accurate registration information.\n• Comply with all applicable laws and regulations.\n• Complete identity verification where required.\n\nWe reserve the right to suspend or terminate accounts that fail verification requirements."],
        ["3. Vendor Accounts", "Vendors may list products, receive orders, manage customers, send promotional offers to previous customers, and access analytics and business tools.\n\nVendors are solely responsible for product quality, descriptions, pricing, packaging, delivery arrangements, and compliance with food safety and import/export laws."],
        ["4. Buyer Accounts", "Buyers may browse products, place orders, make payments, and communicate with vendors through Eki.\n\nBuyers must provide accurate information when placing orders."],
        ["5. Subscription", "Eki may provide a limited free usage period. After the free usage period ends, continued access to vendor services may require an active subscription.\n\nSubscription fees are non-refundable except where required by law. Failure to maintain an active subscription may result in restricted access to vendor services."],
        ["6. Payments", "Eki uses third-party payment providers. Eki does not store payment card details. Payment processing is subject to the terms of the applicable payment provider."],
        ["7. Africa-Based Vendor Payment Protection", "For certain Africa-based vendor transactions, Eki may use a payment protection process whereby funds are temporarily held pending order completion.\n\nWhere applicable:\n• Funds may be released after delivery confirmation.\n• Funds may be released following successful OTP verification.\n• Funds may be released automatically after the applicable review period.\n\nEki is not a bank, financial institution, or regulated escrow provider. Any payment protection process is a platform feature intended to facilitate trust between buyers and vendors."],
        ["8. OTP Delivery Verification", "Where OTP verification is used:\n• An OTP may be generated for an order.\n• The OTP may be used to verify successful delivery.\n• Entering the correct OTP may constitute confirmation that goods have been received.\n\nFraudulent use of OTP verification may result in account suspension."],
        ["9. Vendor Marketing Features", "Vendors may use Eki to send offers and promotional campaigns to customers who have previously interacted with their business.\n\nVendors must use these features responsibly, comply with applicable privacy and marketing laws, and avoid misleading or deceptive communications.\n\nEki may suspend access to marketing features where abuse is detected."],
        ["10. Messaging", "Eki currently supports text-based messaging. Users must not harass others, send abusive content, attempt fraud, distribute illegal material, or circumvent platform restrictions.\n\nEki may monitor platform activity to protect users and enforce these Terms."],
        ["11. Prohibited Products", "The following may not be sold through Eki: illegal products, counterfeit goods, dangerous goods, restricted substances, and products prohibited by applicable laws.\n\nEki may remove listings without notice."],
        ["12. Account Suspension", "We may suspend or terminate accounts where false information is provided, fraud is suspected, verification requirements are not met, or these Terms are violated."],
        ["13. Intellectual Property", "The Eki platform, branding, software, design, and content are owned by Ehimare Co and protected by intellectual property laws.\n\nUsers may not copy, modify, distribute, or reverse engineer any part of the platform without permission."],
        ["14. Limitation of Liability", "Eki provides a technology platform only. To the maximum extent permitted by law, Eki shall not be liable for vendor conduct, buyer conduct, product quality, delivery delays, loss of profits, or indirect or consequential losses.\n\nUsers transact at their own risk."],
        ["15. Indemnity", "Users agree to indemnify and hold harmless Ehimare Co from claims arising from their use of the platform, their products, their business activities, or breach of these Terms."],
        ["16. Privacy", "Use of Eki is subject to the Eki Privacy Policy."],
        ["17. Changes to Terms", "We may update these Terms from time to time. Continued use of Eki after updates constitutes acceptance of the revised Terms."],
        ["18. Governing Law", "These Terms shall be governed by and interpreted in accordance with the laws of England and Wales. Any disputes shall be subject to the exclusive jurisdiction of the courts of England and Wales.\n\nContact: Ehimare Co, United Kingdom\nEmail: info@culinarytales.app"],
      ]}
    />
  );
}

export function LegalPage({ title, subtitle, sections, canonicalUrl }: { title: string; subtitle: string; sections: [string, string][]; canonicalUrl: string }) {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.85} accessibilityLabel="Go back" accessibilityRole="button" style={styles.backButton}>
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
  backButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  title: { fontSize: 24, fontFamily: "Manrope-Bold", color: "#17211D" },
  subtitle: { marginTop: 4, fontSize: 13, lineHeight: 19, fontFamily: "Outfit-Regular", color: "#6A746F" },
  content: { paddingHorizontal: 16, paddingBottom: 40 },
  card: { backgroundColor: "#FFFFFF", borderRadius: 18, padding: 16, borderWidth: 1, borderColor: "#E5EEE9", marginBottom: 12 },
  heading: { fontSize: 16, fontFamily: "Manrope-Bold", color: "#076B51" },
  body: { marginTop: 8, fontSize: 14, lineHeight: 21, fontFamily: "Outfit-Regular", color: "#26332E" },
  footer: { marginTop: 8, textAlign: "center", fontSize: 12, fontFamily: "Outfit-Regular", color: "#7B8781" },
});
