import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Linking, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { vendorService } from "../../services/vendorService";
import { goBackOrReplace } from "../../utils/navigation";

const BUSINESS_PORTAL_URL = "https://culinarytales.app/business-portal";

export default function UpgradePromptScreen() {
  const router = useRouter();
  const [account, setAccount] = useState<Awaited<ReturnType<typeof vendorService.getVendorAccount>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadAccount = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError("");

    try {
      const data = await vendorService.getVendorAccount();
      setAccount(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load account status.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadAccount();
  }, [loadAccount]);

  const serviceName = account?.serviceName ?? "Vendor Account";
  const active = account?.accountStatus === "active";

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => goBackOrReplace(router, "/(vendor)/subscription-plans" as any)} activeOpacity={0.85} style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Business Limit</Text>
        <Text style={styles.headerSubtitle}>Current account access</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Ionicons name="alert-circle-outline" size={32} color="#D97706" />
          </View>

          {loading ? (
            <ActivityIndicator color="#076B51" />
          ) : (
            <>
              <Text style={styles.title}>{serviceName}</Text>
              <Text style={styles.statusText}>{active ? "Business Account Active" : "Inactive"}</Text>
              <Text style={styles.subtitle}>
                You have reached a business limit on your current vendor services. Visit the Business Portal to adjust your account.
              </Text>
              {error ? <Text style={styles.errorText}>{error}</Text> : null}
            </>
          )}
        </View>

        <View style={styles.buttons}>
          <TouchableOpacity
            onPress={() => Linking.openURL(BUSINESS_PORTAL_URL)}
            activeOpacity={0.85}
            style={styles.primaryButton}
          >
            <Ionicons name="globe-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.primaryButtonText}>Open Business Portal</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => loadAccount(true)}
            activeOpacity={0.85}
            style={[styles.outlineButton, refreshing && { opacity: 0.6 }]}
            disabled={refreshing}
          >
            {refreshing ? <ActivityIndicator color="#076B51" size="small" /> : null}
            <Text style={styles.outlineButtonText}>Refresh account status</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => goBackOrReplace(router, "/(vendor)/subscription-plans" as any)} activeOpacity={0.85} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F4F4F4" },
  header: { backgroundColor: "#076B51", paddingHorizontal: 20, paddingTop: 16, paddingBottom: 30, borderBottomLeftRadius: 35, borderBottomRightRadius: 35, gap: 4 },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center", marginBottom: 8 },
  headerTitle: { fontSize: 30, fontFamily: "Manrope-Bold", lineHeight: 30, color: "#FFFFFF" },
  headerSubtitle: { fontSize: 16, fontFamily: "Outfit-Light", color: "#FFFFFF" },
  content: { flex: 1, paddingHorizontal: 16, paddingTop: 24, justifyContent: "space-between", paddingBottom: 40 },
  card: { backgroundColor: "#FFFFFF", borderRadius: 30, padding: 24, alignItems: "center" },
  iconWrap: { width: 72, height: 72, borderRadius: 24, backgroundColor: "#FFF8F0", alignItems: "center", justifyContent: "center", marginBottom: 16 },
  title: { fontSize: 20, fontFamily: "Manrope-Bold", color: "#282828", textAlign: "center" },
  statusText: { fontSize: 13, fontFamily: "Manrope-SemiBold", color: "#076B51", marginTop: 8 },
  subtitle: { fontSize: 14, fontFamily: "Outfit-Regular", color: "#858585", textAlign: "center", marginTop: 8, lineHeight: 21 },
  errorText: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#FB6363", textAlign: "center", marginTop: 12 },
  buttons: { gap: 12 },
  primaryButton: { height: 56, borderRadius: 14, backgroundColor: "#076B51", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4 },
  primaryButtonText: { fontSize: 16, fontFamily: "Manrope-SemiBold", color: "#FFFFFF" },
  outlineButton: { height: 56, borderRadius: 14, borderWidth: 1, borderColor: "#076B51", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  outlineButtonText: { fontSize: 16, fontFamily: "Manrope-SemiBold", color: "#076B51" },
  secondaryButton: { height: 56, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  secondaryButtonText: { fontSize: 16, fontFamily: "Outfit-Regular", color: "#858585", textDecorationLine: "underline" },
});
