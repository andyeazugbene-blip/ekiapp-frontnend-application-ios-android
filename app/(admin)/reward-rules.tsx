import React from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";

export default function AdminRewardRulesScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.85} style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color="#282828" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Reward Rules</Text>
          <Text style={styles.headerSubtitle}>This build only shows backend-managed reward state.</Text>
        </View>
      </View>

      <View style={styles.body}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Ionicons name="shield-checkmark-outline" size={22} color="#076B51" />
          </View>
          <Text style={styles.cardTitle}>Local reward editing removed</Text>
          <Text style={styles.cardBody}>
            Reward rules are no longer created or stored on-device. That prevents the app from showing fake admin
            settings that are not backed by the API.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>What is live today</Text>
          <Text style={styles.listItem}>• Referral codes and referral earnings come from the backend.</Text>
          <Text style={styles.listItem}>• Wallet reward balances come from wallet transactions on the API.</Text>
          <Text style={styles.listItem}>• Promo codes remain managed through the real promo-code backend routes.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>What still needs backend work</Text>
          <Text style={styles.cardBody}>
            Editable reward-rule management needs dedicated backend endpoints and persistence before it should return to
            the admin app.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F4F4F4" },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 24, fontFamily: "Manrope-Bold", color: "#282828" },
  headerSubtitle: { fontSize: 13, lineHeight: 18, fontFamily: "Outfit-Regular", color: "#687076", marginTop: 4 },
  body: { paddingHorizontal: 16, paddingBottom: 40, gap: 16 },
  card: { backgroundColor: "#FFFFFF", borderRadius: 24, padding: 18 },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(7,107,81,0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  cardTitle: { fontSize: 18, fontFamily: "Manrope-Bold", color: "#282828", marginBottom: 8 },
  cardBody: { fontSize: 14, lineHeight: 21, fontFamily: "Outfit-Regular", color: "#556067" },
  listItem: { fontSize: 14, lineHeight: 21, fontFamily: "Outfit-Regular", color: "#556067", marginBottom: 6 },
});
