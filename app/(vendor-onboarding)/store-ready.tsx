import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "../../stores/authStore";
import { toCompactStoreSlug } from "../../utils/shareLinks";

export default function StoreReadyScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const vendor = user?.role === "vendor" ? user : null;

  const handleDashboard = () => {
    router.replace("/(vendor)" as any);
  };

  const handleViewStore = () => {
    const slug = toCompactStoreSlug(vendor?.storeSlug ?? vendor?.storeName);
    router.push({ pathname: "/store/[slug]", params: { slug, preview: "1" } } as any);
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Dim overlay */}
      <View style={styles.scrim} />

      {/* Modal card */}
      <View style={styles.modalWrap}>
        <View style={styles.modal}>
          <Text style={styles.emoji}>🎉</Text>
          <Text style={styles.title}>Your Store Is Ready</Text>
          <Text style={styles.subtitle}>
            Your foodstuff is now set up and your store is ready for activation
          </Text>

          <TouchableOpacity
            activeOpacity={0.86}
            onPress={handleDashboard}
            style={styles.primaryBtn}
          >
            <Text style={styles.primaryBtnText}>Go to Dashboard</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.86}
            onPress={handleViewStore}
            style={styles.outlineBtn}
          >
            <Text style={styles.outlineBtnText}>View My Store</Text>
          </TouchableOpacity>
        </View>

        {/* Close button */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={handleDashboard}
          style={styles.closeBtn}
        >
          <Ionicons name="close" size={20} color="#1A1A1A" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "transparent",
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  modalWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  modal: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 28,
    alignItems: "center",
  },
  emoji: {
    fontSize: 52,
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontFamily: "Manrope-Bold",
    color: "#1A1A1A",
    textAlign: "center",
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "Outfit-Regular",
    color: "#858585",
    textAlign: "center",
    lineHeight: 21,
    marginBottom: 28,
  },
  primaryBtn: {
    width: "100%",
    height: 54,
    borderRadius: 14,
    backgroundColor: "#076B51",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  primaryBtnText: {
    fontSize: 16,
    fontFamily: "Manrope-SemiBold",
    color: "#FFFFFF",
  },
  outlineBtn: {
    width: "100%",
    height: 54,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#076B51",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  outlineBtnText: {
    fontSize: 16,
    fontFamily: "Manrope-SemiBold",
    color: "#076B51",
  },
  closeBtn: {
    marginTop: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
});
