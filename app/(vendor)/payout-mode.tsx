import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { payoutMethodService, type PayoutMethod } from "../../services/payoutMethodService";
import { goBackOrReplace } from "../../utils/navigation";

export default function PayoutModeScreen() {
  const router = useRouter();
  const [methods, setMethods] = useState<PayoutMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const payoutMethods = await payoutMethodService.list();
      setMethods(payoutMethods);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load payout settings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const handleSetDefault = async (id: string) => {
    setBusyId(id);
    try {
      const updated = await payoutMethodService.setDefault(id);
      setMethods((prev) =>
        prev.map((m) => ({ ...m, isDefault: m.id === updated.id })),
      );
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Could not set default method.");
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = (method: PayoutMethod) => {
    Alert.alert(
      "Delete payout method",
      `Remove ${method.label || method.type}?${method.isDefault ? " This is your default method." : ""}`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setBusyId(method.id);
            try {
              await payoutMethodService.remove(method.id);
              setMethods((prev) => prev.filter((m) => m.id !== method.id));
            } catch (err) {
              Alert.alert("Error", err instanceof Error ? err.message : "Could not delete method.");
            } finally {
              setBusyId(null);
            }
          },
        },
      ],
    );
  };

  const handleEdit = (method: PayoutMethod) => {
    router.push({
      pathname: "/(vendor)/payment-details" as any,
      params: { editId: method.id, editType: method.type },
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => goBackOrReplace(router, "/(vendor)/settings" as any)} activeOpacity={0.85} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color="#282828" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Payout Settings</Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Payout releases</Text>
          <Text style={styles.sectionSubtitle}>
            Released funds follow the live payout approval rules from the backend. This screen manages where approved withdrawals are sent.
          </Text>
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>Payout methods</Text>
              <Text style={styles.sectionSubtitle}>Add the destination account that receives your withdrawals.</Text>
            </View>
            <TouchableOpacity onPress={() => router.push("/(vendor)/payment-details" as any)} activeOpacity={0.85} style={styles.addMethodButton}>
              <Ionicons name="add" size={18} color="#076B51" />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.placeholder}>
              <ActivityIndicator color="#076B51" />
            </View>
          ) : methods.length === 0 ? (
            <TouchableOpacity onPress={() => router.push("/(vendor)/payment-details" as any)} activeOpacity={0.85} style={styles.emptyMethodCard}>
              <Ionicons name="card-outline" size={18} color="#076B51" />
              <Text style={styles.emptyMethodText}>Add a payout method</Text>
            </TouchableOpacity>
          ) : (
            methods.map((method) => {
              const descriptor = method.last4 ? `••••${method.last4}` : method.email ?? method.country ?? "";
              const isBusy = busyId === method.id;
              return (
                <View key={method.id} style={[styles.methodCard, method.isDefault && styles.methodCardActive]}>
                  <View style={styles.methodTop}>
                    <View style={styles.methodIcon}>
                      <Ionicons
                        name={method.type === "bank" ? "business-outline" : method.type === "stripe" ? "card-outline" : "logo-paypal"}
                        size={18}
                        color="#076B51"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.methodTitle}>{method.bankName ?? method.label ?? method.type}</Text>
                      <Text style={styles.methodSubtitle}>{descriptor || method.type}</Text>
                    </View>
                    {method.isDefault ? (
                      <View style={styles.defaultBadge}>
                        <Text style={styles.defaultBadgeText}>Default</Text>
                      </View>
                    ) : null}
                  </View>

                  <View style={styles.methodActions}>
                    {!method.isDefault ? (
                      <TouchableOpacity
                        onPress={() => handleSetDefault(method.id)}
                        disabled={isBusy}
                        activeOpacity={0.85}
                        style={styles.methodAction}
                      >
                        {isBusy ? (
                          <ActivityIndicator size={12} color="#076B51" />
                        ) : (
                          <Ionicons name="checkmark-circle-outline" size={14} color="#076B51" />
                        )}
                        <Text style={styles.methodActionText}>Set default</Text>
                      </TouchableOpacity>
                    ) : null}

                    <TouchableOpacity
                      onPress={() => handleEdit(method)}
                      disabled={isBusy}
                      activeOpacity={0.85}
                      style={styles.methodAction}
                    >
                      <Ionicons name="create-outline" size={14} color="#076B51" />
                      <Text style={styles.methodActionText}>Edit</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => handleDelete(method)}
                      disabled={isBusy}
                      activeOpacity={0.85}
                      style={styles.methodAction}
                    >
                      <Ionicons name="trash-outline" size={14} color="#FB6363" />
                      <Text style={[styles.methodActionText, { color: "#FB6363" }]}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F4F4F4" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 16, gap: 12, backgroundColor: "#FFFFFF" },
  backButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#F4F4F4", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 24, fontFamily: "Manrope-Bold", color: "#282828" },
  scrollContent: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 40 },
  card: { backgroundColor: "#FFFFFF", borderRadius: 24, padding: 18, marginBottom: 16 },
  sectionHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 14 },
  sectionTitle: { fontSize: 18, fontFamily: "Manrope-Bold", color: "#282828" },
  sectionSubtitle: { fontSize: 13, lineHeight: 19, fontFamily: "Outfit-Regular", color: "#687076", marginTop: 4 },
  placeholder: { paddingVertical: 24, alignItems: "center" },
  addMethodButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#EDF7F3", alignItems: "center", justifyContent: "center" },
  emptyMethodCard: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 16, borderWidth: 1, borderColor: "#D7E7E3", backgroundColor: "#F8FBFA", padding: 16 },
  emptyMethodText: { fontSize: 14, fontFamily: "Manrope-SemiBold", color: "#076B51" },
  methodCard: { borderRadius: 18, borderWidth: 1, borderColor: "#E9EEEC", padding: 14, marginBottom: 12 },
  methodCardActive: { borderColor: "#076B51", backgroundColor: "rgba(7,107,81,0.04)" },
  methodTop: { flexDirection: "row", alignItems: "center" },
  methodIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: "#EDF7F3", alignItems: "center", justifyContent: "center", marginRight: 12 },
  methodTitle: { fontSize: 15, fontFamily: "Manrope-Bold", color: "#282828" },
  methodSubtitle: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#687076", marginTop: 4 },
  defaultBadge: { borderRadius: 999, backgroundColor: "#EDF7F3", paddingHorizontal: 10, paddingVertical: 6 },
  defaultBadgeText: { color: "#076B51", fontSize: 11, fontFamily: "Manrope-Bold" },
  methodActions: { flexDirection: "row", gap: 18, marginTop: 12, paddingLeft: 52, flexWrap: "wrap" },
  methodAction: { flexDirection: "row", alignItems: "center", gap: 6 },
  methodActionText: { fontSize: 13, fontFamily: "Manrope-SemiBold", color: "#076B51" },
  errorText: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#FB6363", textAlign: "center", marginTop: 8 },
});
