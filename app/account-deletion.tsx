import React, { useState } from "react";
import { Alert, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { ApiRequestError } from "../services/api";
import { useAuthStore } from "../stores/authStore";

const PRIVACY_URL = "https://culinarytales.app/account-deletion";
const ROLE_SELECT_ROUTE = "/(auth)/role-select";

export default function AccountDeletionScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const deleteAccount = useAuthStore((state) => state.deleteAccount);
  const isLoading = useAuthStore((state) => state.isLoading);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleOpenPrivacy = async () => {
    const canOpen = await Linking.canOpenURL(PRIVACY_URL).catch(() => false);
    if (!canOpen) {
      Alert.alert("Cannot open link", PRIVACY_URL);
      return;
    }

    await Linking.openURL(PRIVACY_URL).catch(() => {
      Alert.alert("Cannot open link", PRIVACY_URL);
    });
  };

  const confirmDeletion = () => {
    Alert.alert(
      "Delete account?",
      "This permanently removes your app access and anonymizes personal data that can legally be erased. Active orders must be completed first.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete account",
          style: "destructive",
          onPress: () => {
            void handleDeleteAccount();
          },
        },
      ]
    );
  };

  const handleDeleteAccount = async () => {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    try {
      const message = await deleteAccount();
      Alert.alert("Account deleted", message, [
        {
          text: "OK",
          onPress: () => router.replace(ROLE_SELECT_ROUTE as any),
        },
      ]);
    } catch (error: unknown) {
      if (error instanceof ApiRequestError) {
        Alert.alert("Deletion blocked", error.message);
      } else {
        Alert.alert("Deletion failed", "We could not complete the request right now. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.8} style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Delete Account</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons name="warning-outline" size={22} color="#FB6363" />
          </View>
          <Text style={styles.heroTitle}>Delete this account in-app</Text>
          <Text style={styles.heroText}>
            We now submit this request directly to the secure account service. Pending buyer orders, payout obligations, or compliance holds can still block deletion until they are resolved.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Before you continue</Text>
          <Text style={styles.cardText}>
            Signed in as <Text style={styles.highlight}>{user?.email ?? "your account"}</Text>
          </Text>
          <View style={styles.bulletList}>
            <Text style={styles.bullet}>• Completed financial records may be retained where required by law.</Text>
            <Text style={styles.bullet}>• Active orders and payout obligations must be cleared first.</Text>
            <Text style={styles.bullet}>• This removes app access immediately after the backend confirms the request.</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Review policy</Text>
          <TouchableOpacity onPress={handleOpenPrivacy} activeOpacity={0.85} style={styles.secondaryButton}>
            <Ionicons name="document-text-outline" size={18} color="#076B51" />
            <Text style={styles.secondaryButtonText}>Open privacy and data deletion policy</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Delete now</Text>
          <TouchableOpacity
            onPress={confirmDeletion}
            activeOpacity={0.85}
            disabled={isSubmitting || isLoading}
            style={[styles.primaryButton, (isSubmitting || isLoading) && styles.primaryButtonDisabled]}
          >
            <Ionicons name="trash-outline" size={18} color="#FFFFFF" />
            <Text style={styles.primaryButtonText}>{isSubmitting || isLoading ? "Deleting account..." : "Delete my account"}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F7F7F7" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 20, fontFamily: "Manrope-Bold", color: "#111827" },
  headerSpacer: { width: 40 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  hero: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
  },
  heroIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FFF1F2",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  heroTitle: { fontSize: 22, fontFamily: "Manrope-Bold", color: "#111827", marginBottom: 8 },
  heroText: { fontSize: 14, lineHeight: 22, fontFamily: "Outfit-Regular", color: "#6B7280" },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
  },
  cardTitle: { fontSize: 17, fontFamily: "Manrope-SemiBold", color: "#111827", marginBottom: 10 },
  cardText: { fontSize: 14, lineHeight: 22, fontFamily: "Outfit-Regular", color: "#6B7280" },
  highlight: { fontFamily: "Outfit-SemiBold", color: "#111827" },
  bulletList: { marginTop: 12, gap: 8 },
  bullet: { fontSize: 14, lineHeight: 22, fontFamily: "Outfit-Regular", color: "#4B5563" },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 54,
    borderRadius: 16,
    backgroundColor: "#C53A3A",
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: { fontSize: 15, fontFamily: "Manrope-SemiBold", color: "#FFFFFF" },
  secondaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#D1E5DE",
    backgroundColor: "#F6FCF9",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  secondaryButtonText: {
    flex: 1,
    textAlign: "center",
    fontSize: 15,
    lineHeight: 20,
    fontFamily: "Manrope-SemiBold",
    color: "#076B51",
  },
});
