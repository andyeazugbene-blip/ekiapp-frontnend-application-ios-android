import React, { useEffect } from "react";
import { Platform, Text, View, StyleSheet } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";

export default function VendorSubscriptionRedirect() {
  const router = useRouter();
  const params = useLocalSearchParams();

  useEffect(() => {
    if (Platform.OS === "web") {
      const query = new URLSearchParams();
      if (params.success) query.set("success", String(params.success));
      if (params.cancelled) query.set("cancelled", String(params.cancelled));
      if (params.email) query.set("email", String(params.email));
      const qs = query.toString();
      router.replace(`/business-portal${qs ? `?${qs}` : ""}` as any);
    }
  }, [router, params]);

  return (
    <View style={styles.container}>
      <Text style={styles.text}>Redirecting to Business Portal...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F7FAF8", alignItems: "center", justifyContent: "center" },
  text: { color: "#66736D", fontSize: 14 },
});
