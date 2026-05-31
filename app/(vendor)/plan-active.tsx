import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { premiumStyles } from "../../components/shared/PremiumBlocks";

export default function PlanActiveScreen() {
  const router = useRouter();
  return (
    <View style={[premiumStyles.page, { alignItems: "center", justifyContent: "center", paddingHorizontal: 24 }]}>
      <View style={{ width: 92, height: 92, borderRadius: 46, backgroundColor: "#E7F2EB", alignItems: "center", justifyContent: "center" }}>
        <Ionicons name="diamond-outline" size={38} color="#2E6957" />
      </View>
      <Text style={{ color: "#102118", fontSize: 28, fontFamily: "Manrope-Bold", marginTop: 26, textAlign: "center" }}>Plan Status</Text>
      <Text style={{ color: "#6A7B72", fontSize: 13, lineHeight: 20, marginTop: 10, textAlign: "center" }}>Your current plan status is synced from your account.</Text>
      <TouchableOpacity onPress={() => router.replace("/(vendor)/subscription-plans" as any)} style={{ marginTop: 28, minHeight: 52, minWidth: 210, borderRadius: 18, backgroundColor: "#076B51", alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: "#FFFFFF", fontSize: 14, fontFamily: "Manrope-Bold" }}>Back to plan status</Text>
      </TouchableOpacity>
    </View>
  );
}
