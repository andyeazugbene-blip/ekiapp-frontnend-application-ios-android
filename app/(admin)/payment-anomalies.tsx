import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { adminService, type AdminPaymentAnomaly } from "../../services/adminService";

function titleCase(value: string) {
  return value.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function AdminPaymentAnomaliesScreen() {
  const router = useRouter();
  const { anomalyKey } = useLocalSearchParams<{ anomalyKey?: string }>();
  const [items, setItems] = useState<AdminPaymentAnomaly[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setItems(await adminService.getPaymentAnomalies());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load payment incidents.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const orderedItems = useMemo(() => [...items].sort((a, b) => {
    if (a.dedupeKey === anomalyKey) return -1;
    if (b.dedupeKey === anomalyKey) return 1;
    return Date.parse(b.lastSeenAt) - Date.parse(a.lastSeenAt);
  }), [items, anomalyKey]);

  const resolveIncident = async (item: AdminPaymentAnomaly) => {
    setResolvingId(item.id);
    setError("");
    try {
      await adminService.resolvePaymentAnomaly(item.id, "Resolved from the authenticated admin incident queue.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not resolve this incident.");
    } finally {
      setResolvingId(null);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F7F9F8" }} edges={["top"]}>
      <View style={{ height: 58, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", gap: 12 }}>
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={22} color="#0A6C52" />
        </TouchableOpacity>
        <Text style={{ color: "#17211D", fontSize: 19, fontFamily: "Manrope-Bold" }}>Payment incidents</Text>
        <TouchableOpacity onPress={() => void load()} style={{ marginLeft: "auto" }} accessibilityRole="button" accessibilityLabel="Refresh incidents">
          <Ionicons name="refresh-outline" size={21} color="#0A6C52" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: "center" }}><ActivityIndicator color="#0A6C52" /></View>
      ) : error ? (
        <View style={{ margin: 18, padding: 18, borderRadius: 16, backgroundColor: "#FFFFFF" }}>
          <Text style={{ color: "#8A3B34", fontFamily: "Manrope-SemiBold" }}>{error}</Text>
          <Text style={{ color: "#66716C", marginTop: 8, fontFamily: "Manrope-Regular" }}>
            Access requires the admin reports.read permission.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 36, gap: 12 }}>
          {orderedItems.length === 0 ? (
            <View style={{ padding: 20, borderRadius: 16, backgroundColor: "#FFFFFF" }}>
              <Text style={{ color: "#17211D", fontFamily: "Manrope-Bold", fontSize: 16 }}>No payment incidents found</Text>
              <Text style={{ color: "#66716C", marginTop: 6, fontFamily: "Manrope-Regular" }}>
                The incident may have been resolved or your account may not have permission to view the queue.
              </Text>
            </View>
          ) : orderedItems.map((item) => {
            const focused = item.dedupeKey === anomalyKey;
            return (
              <View key={item.id} style={{ padding: 16, borderRadius: 16, borderWidth: focused ? 2 : 1, borderColor: focused ? "#D98A16" : "#E6ECE8", backgroundColor: "#FFFFFF" }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={{ flex: 1, color: "#17211D", fontSize: 15, fontFamily: "Manrope-Bold" }}>{titleCase(item.kind)}</Text>
                  <Text style={{ color: item.status === "OPEN" ? "#A64C26" : "#66716C", fontSize: 11, fontFamily: "Manrope-SemiBold" }}>{titleCase(item.status)}</Text>
                </View>
                <Text selectable style={{ color: "#38443E", marginTop: 9, fontFamily: "Manrope-SemiBold" }}>
                  {item.businessRefType} · {item.businessRefId}
                </Text>
                <Text selectable style={{ color: "#66716C", marginTop: 6, fontSize: 12, fontFamily: "Manrope-Regular" }}>
                  Incident key: {item.dedupeKey}
                </Text>
                <Text style={{ color: "#66716C", marginTop: 6, fontSize: 12, fontFamily: "Manrope-Regular" }}>
                  Last observed: {new Date(item.lastSeenAt).toLocaleString()}
                </Text>
                {item.note ? <Text style={{ color: "#66716C", marginTop: 8, fontFamily: "Manrope-Regular" }}>Review note: {item.note}</Text> : null}
                {item.status !== "RESOLVED" ? (
                  <TouchableOpacity
                    onPress={() => void resolveIncident(item)}
                    disabled={resolvingId !== null}
                    accessibilityRole="button"
                    accessibilityLabel={`Resolve ${titleCase(item.kind)} incident`}
                    style={{ marginTop: 14, alignSelf: "flex-start", borderRadius: 10, backgroundColor: "#0A6C52", paddingHorizontal: 14, paddingVertical: 10, opacity: resolvingId && resolvingId !== item.id ? 0.55 : 1 }}
                  >
                    {resolvingId === item.id ? <ActivityIndicator color="#FFFFFF" /> : <Text style={{ color: "#FFFFFF", fontFamily: "Manrope-SemiBold" }}>Resolve incident</Text>}
                  </TouchableOpacity>
                ) : null}
              </View>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
