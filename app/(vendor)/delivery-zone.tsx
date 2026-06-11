import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { deliveryService, type DeliveryZone } from "../../services/deliveryService";
import { goBackOrReplace } from "../../utils/navigation";

const CURRENCY_SYMBOL: Record<string, string> = {
  GBP: "£",
  USD: "$",
  CAD: "C$",
  EUR: "€",
};

export default function DeliveryZoneScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();

  const [zone, setZone] = useState<DeliveryZone | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [costPerKg, setCostPerKg] = useState("");
  const [minimumFee, setMinimumFee] = useState("");
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const list = await deliveryService.listZones();
        const found = list.find((z) => z.id === id);
        if (found) {
          setZone(found);
          setCostPerKg(String(found.costPerKg));
          setMinimumFee(String(found.minimumFee));
          setIsActive(found.active);
        } else {
          setError("Delivery zone not found.");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load delivery settings.");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const handleSave = async () => {
    if (!zone) return;
    setError("");
    setSubmitting(true);
    try {
      await deliveryService.updateZone(zone.id, {
        costPerKg: parseFloat(costPerKg) || 0,
        minimumFee: parseFloat(minimumFee) || 0,
        active: isActive,
      });
      Alert.alert("Success", "Delivery settings updated successfully.", [
        { text: "OK", onPress: () => goBackOrReplace(router, "/(vendor)/delivery" as any) },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save delivery settings.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = () => {
    if (!zone) return;
    Alert.alert(
      "Remove delivery country?",
      `This removes ${zone.country} from your store checkout immediately.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            setSubmitting(true);
            setError("");
            try {
              await deliveryService.deleteZone(zone.id);
              goBackOrReplace(router, "/(vendor)/delivery" as any);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Could not remove delivery country.");
            } finally {
              setSubmitting(false);
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <View style={styles.page}>
        <SafeAreaView edges={["top"]} style={styles.headerSafeArea}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => goBackOrReplace(router, "/(vendor)/delivery" as any)} style={styles.backButton}>
              <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Edit delivery</Text>
          </View>
        </SafeAreaView>
        <View style={styles.placeholder}>
          <ActivityIndicator color="#076B51" size="large" />
        </View>
      </View>
    );
  }

  if (error || !zone) {
    return (
      <View style={styles.page}>
        <SafeAreaView edges={["top"]} style={styles.headerSafeArea}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => goBackOrReplace(router, "/(vendor)/delivery" as any)} style={styles.backButton}>
              <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Edit delivery</Text>
          </View>
        </SafeAreaView>
        <View style={styles.placeholder}>
          <Text style={styles.errorText}>{error || "No zone selected."}</Text>
        </View>
      </View>
    );
  }

  const symbol = CURRENCY_SYMBOL[zone.currency] ?? "£";

  return (
    <View style={styles.page}>
      <SafeAreaView edges={["top"]} style={styles.headerSafeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => goBackOrReplace(router, "/(vendor)/delivery" as any)} style={styles.backButton}>
            <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit delivery</Text>
          <Text style={styles.headerSubtitle}>
            Update settings for {zone.country}
          </Text>
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          
          {/* Enable / Disable switch (Figma matching label) */}
          <View style={styles.card}>
            <View style={styles.toggleRow}>
              <View style={{ flex: 1, marginRight: 16 }}>
                <Text style={styles.toggleLabel}>Enable or disable delivery</Text>
                <Text style={styles.toggleSubLabel}>Enable or disable delivery for this country</Text>
              </View>
              <Switch
                value={isActive}
                onValueChange={setIsActive}
                trackColor={{ false: "#D7E4DC", true: "#076B51" }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>

          {/* Core inputs (Figma 044 matched) */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Delivery settings</Text>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Delivery cost per kg ({symbol})</Text>
              <TextInput
                value={costPerKg}
                onChangeText={setCostPerKg}
                placeholder="4.00"
                placeholderTextColor="#858585"
                keyboardType="decimal-pad"
                style={styles.input}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Minimum fee ({symbol})</Text>
              <TextInput
                value={minimumFee}
                onChangeText={setMinimumFee}
                placeholder="12.00"
                placeholderTextColor="#858585"
                keyboardType="decimal-pad"
                style={styles.input}
              />
            </View>
            <View style={styles.liveNotice}>
              <Ionicons name="checkmark-circle-outline" size={18} color="#076B51" />
              <Text style={styles.liveNoticeText}>
                These settings are saved to the live backend and used immediately at checkout.
              </Text>
            </View>
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity
            onPress={handleSave}
            disabled={submitting}
            activeOpacity={0.85}
            style={[styles.primaryButton, submitting && { opacity: 0.6 }]}
          >
            <Text style={styles.primaryButtonText}>
              {submitting ? "Saving..." : "Save Changes"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleDelete}
            disabled={submitting}
            activeOpacity={0.85}
            style={[styles.deleteButton, submitting && { opacity: 0.6 }]}
          >
            <Text style={styles.deleteButtonText}>Remove Delivery Country</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#F4F4F4" },
  headerSafeArea: { backgroundColor: "#076B51" },
  header: {
    backgroundColor: "#076B51",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 30,
    borderBottomLeftRadius: 35,
    borderBottomRightRadius: 35,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  headerTitle: { fontSize: 30, fontFamily: "Manrope-Bold", lineHeight: 30, color: "#FFFFFF" },
  headerSubtitle: { fontSize: 16, fontFamily: "Outfit-Light", color: "#FFFFFF", marginTop: 6 },
  scrollContent: { padding: 20, paddingBottom: 40 },
  placeholder: { flex: 1, paddingVertical: 100, alignItems: "center", justifyContent: "center" },
  errorText: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#FB6363", textAlign: "center", paddingHorizontal: 20 },
  card: { backgroundColor: "#FFFFFF", borderRadius: 30, padding: 20, marginBottom: 20 },
  sectionTitle: { fontSize: 18, fontFamily: "Manrope-Bold", color: "#282828", marginBottom: 16 },
  fieldGroup: { marginBottom: 16 },
  fieldLabel: { fontSize: 14, fontFamily: "Outfit-Medium", color: "#858585", marginBottom: 6 },
  input: {
    backgroundColor: "#F4F4F4",
    borderRadius: 10,
    height: 55,
    paddingHorizontal: 15,
    fontSize: 14,
    fontFamily: "Outfit-Regular",
    color: "#282828",
  },
  liveNotice: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: "#E8F4ED", borderRadius: 14, padding: 12 },
  liveNoticeText: { flex: 1, fontSize: 12, lineHeight: 18, fontFamily: "Outfit-Regular", color: "#24564A" },
  toggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  toggleLabel: { fontSize: 15, fontFamily: "Outfit-Medium", color: "#282828" },
  toggleSubLabel: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#858585", marginTop: 2 },
  primaryButton: {
    height: 56,
    borderRadius: 14,
    backgroundColor: "#076B51",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: { fontSize: 16, fontFamily: "Manrope-SemiBold", color: "#FFFFFF" },
  deleteButton: {
    height: 56,
    borderRadius: 14,
    backgroundColor: "#FFF1F1",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },
  deleteButtonText: { fontSize: 16, fontFamily: "Manrope-SemiBold", color: "#B42318" },
});

