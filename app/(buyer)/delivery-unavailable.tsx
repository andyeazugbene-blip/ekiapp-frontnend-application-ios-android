import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { goBackOrReplace } from "../../utils/navigation";

export default function DeliveryUnavailableScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => goBackOrReplace(router, "/(buyer)/cart" as any)} activeOpacity={0.85} style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <Ionicons name="location-outline" size={48} color="#858585" />
        </View>
        <Text style={styles.title}>Delivery Unavailable</Text>
        <Text style={styles.subtitle}>Sorry, this vendor doesn't deliver to your location yet. Try a different vendor or check back later.</Text>

        <TouchableOpacity onPress={() => goBackOrReplace(router, "/(buyer)/explore" as any)} activeOpacity={0.85} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>Browse Other Vendors</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push("/(buyer)" as any)} activeOpacity={0.85} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Go Home</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F4F4F4" },
  header: { backgroundColor: "#076B51", paddingHorizontal: 20, paddingTop: 16, paddingBottom: 30, borderBottomLeftRadius: 35, borderBottomRightRadius: 35 },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
  content: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
  iconWrap: { width: 96, height: 96, borderRadius: 48, backgroundColor: "#F0F0F0", alignItems: "center", justifyContent: "center", marginBottom: 24 },
  title: { fontSize: 22, fontFamily: "Manrope-Bold", color: "#282828", textAlign: "center" },
  subtitle: { fontSize: 14, fontFamily: "Outfit-Regular", color: "#858585", textAlign: "center", marginTop: 10, lineHeight: 21 },
  primaryButton: { width: "100%", height: 56, borderRadius: 14, backgroundColor: "#076B51", alignItems: "center", justifyContent: "center", marginTop: 32 },
  primaryButtonText: { fontSize: 16, fontFamily: "Manrope-SemiBold", color: "#FFFFFF" },
  secondaryButton: { width: "100%", height: 56, borderRadius: 14, borderWidth: 1, borderColor: "#076B51", alignItems: "center", justifyContent: "center", marginTop: 12 },
  secondaryButtonText: { fontSize: 16, fontFamily: "Manrope-SemiBold", color: "#076B51" },
});
