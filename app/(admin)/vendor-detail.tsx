import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { vendorService } from "../../services/vendorService";

export default function VendorDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [vendor, setVendor] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadVendor = useCallback(async (cancelledRef?: { current: boolean }) => {
    if (!id) { setLoading(false); return; }
    setLoading(true);
    try {
      const v = await vendorService.getVendorById(id, { admin: true });
      if (!cancelledRef?.current) setVendor(v);
    } catch (err) {
      if (!cancelledRef?.current) {
        Alert.alert("Could not load vendor", err instanceof Error ? err.message : "Vendor not found.");
      }
    } finally {
      if (!cancelledRef?.current) setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      if (!id) { setLoading(false); return; }
      const cancelledRef = { current: false };
      loadVendor(cancelledRef);
      return () => { cancelledRef.current = true; };
    }, [id, loadVendor])
  );

  const runAction = async (action: "approve" | "reject" | "suspend" | "unsuspend") => {
    if (!id) return;
    setSaving(true);
    try {
      if (action === "approve") await vendorService.approveVendor(id);
      if (action === "reject") await vendorService.rejectVendor(id);
      if (action === "suspend") await vendorService.suspendVendor(id);
      if (action === "unsuspend") await vendorService.unsuspendVendor(id);
      await loadVendor();
    } catch (err) {
      Alert.alert("Action failed", err instanceof Error ? err.message : "Could not update this vendor.");
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (iso?: string) => {
    if (!iso) return "—";
    try { return new Date(iso).toLocaleDateString("en-GB", { month: "short", day: "numeric", year: "numeric" }); }
    catch { return iso; }
  };

  const displayStatus = vendor?.adminStatus === "active" ? "Active" : vendor?.adminStatus === "suspended" ? "Suspended" : "Pending Approve";
  const statusColor = vendor?.adminStatus === "active" ? "#076B51" : vendor?.adminStatus === "suspended" ? "#FB6363" : "#D97706";

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color="#076B51" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.85} style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color="#282828" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Vendor details</Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.vendorImage}>
          <Ionicons name="storefront" size={40} color="#858585" />
        </View>

        <View style={styles.vendorInfoRow}>
          <View>
            <Text style={styles.vendorName}>{vendor?.storeName || "Vendor"}</Text>
            <View style={styles.ownerRow}>
              <View style={styles.ownerAvatar} />
              <Text style={styles.ownerName}>{vendor?.ownerName || "—"}</Text>
            </View>
          </View>
          <View>
            <Text style={styles.joinedText}>Joined {formatDate(vendor?.createdAt)}</Text>
            <View style={[styles.statusBadge, { borderColor: statusColor }]}>
              <Text style={[styles.statusText, { color: statusColor }]}>{displayStatus}</Text>
            </View>
          </View>
        </View>

        <View style={styles.locationRow}>
          <View style={styles.locationCard}>
            <Ionicons name="globe-outline" size={20} color="#076B51" />
            <Text style={styles.locationLabel}>Country:</Text>
            <Text style={styles.locationValue}>{vendor?.country || "—"}</Text>
          </View>
          <View style={styles.locationCard}>
            <Ionicons name="globe-outline" size={20} color="#076B51" />
            <Text style={styles.locationLabel}>City:</Text>
            <Text style={styles.locationValue}>{vendor?.city || "—"}</Text>
          </View>
        </View>

        <Text style={styles.descTitle}>Description</Text>
        <Text style={styles.descText}>{vendor?.description || "No description provided."}</Text>
        <View style={styles.divider} />

        <View style={styles.infoCards}>
          <View style={styles.infoCard}>
            <Ionicons name="document-outline" size={22} color="#076B51" />
            <Text style={styles.infoCardLabel}>Verification</Text>
            <Text style={styles.infoCardValue}>{vendor?.verificationStatus || "Not submitted"}</Text>
          </View>
          <View style={styles.infoCard}>
            <Ionicons name="globe-outline" size={22} color="#076B51" />
            <Text style={styles.infoCardLabel}>Subscription</Text>
            <Text style={styles.infoCardValue}>{vendor?.subscriptionPlan || "Free Plan"}</Text>
          </View>
        </View>

        <View style={styles.orderStats}>
          <View style={styles.orderStatCard}>
            <View style={styles.orderStatIcon}>
              <Ionicons name="cart-outline" size={16} color="#FFFFFF" />
            </View>
            <Text style={styles.orderStatLabel}>Total orders:</Text>
            <Text style={styles.orderStatValue}>{vendor?.totalOrders ?? 0}</Text>
          </View>
          <View style={styles.orderStatCardLight}>
            <View style={styles.orderStatIconLight}>
              <Ionicons name="time-outline" size={16} color="#076B51" />
            </View>
            <Text style={styles.orderStatLabelLight}>Pending:</Text>
            <Text style={styles.orderStatValueLight}>{vendor?.pendingOrders ?? 0}</Text>
          </View>
        </View>

        {vendor?.adminStatus !== "active" && vendor?.adminStatus !== "suspended" && (
          <TouchableOpacity onPress={() => runAction("approve")} disabled={saving} activeOpacity={0.85} style={styles.approveButton}>
            <Text style={styles.approveButtonText}>{saving ? "Updating..." : "Approve Vendor"}</Text>
          </TouchableOpacity>
        )}
        <View style={styles.bottomActions}>
          {vendor?.adminStatus !== "suspended" && (
            <TouchableOpacity onPress={() => runAction(vendor?.adminStatus === "active" ? "suspend" : "reject")} disabled={saving} activeOpacity={0.85} style={styles.rejectButton}>
              <Text style={styles.rejectButtonText}>{saving ? "..." : vendor?.adminStatus === "active" ? "Suspend" : "Reject"}</Text>
            </TouchableOpacity>
          )}
          {vendor?.adminStatus === "suspended" && (
            <TouchableOpacity onPress={() => runAction("unsuspend")} disabled={saving} activeOpacity={0.85} style={styles.rejectButton}>
              <Text style={styles.rejectButtonText}>{saving ? "..." : "Reactivate"}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => Alert.alert("Message vendor", "Admin vendor messaging is not connected to a mobile backend endpoint yet.")}
            activeOpacity={0.85}
            style={styles.messageButton}
          >
            <Text style={styles.messageButtonText}>Message</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9F9F9" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, gap: 12 },
  backButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#F0F0F0", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 20, fontFamily: "Manrope-Bold", color: "#282828" },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 40 },
  vendorImage: { width: "100%", height: 160, borderRadius: 16, backgroundColor: "#E8E8E8", alignItems: "center", justifyContent: "center", marginBottom: 16 },
  vendorInfoRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 },
  vendorName: { fontSize: 20, fontFamily: "Manrope-Bold", color: "#282828" },
  ownerRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },
  ownerAvatar: { width: 22, height: 22, borderRadius: 11, backgroundColor: "#E8E8E8" },
  ownerName: { fontSize: 13, fontWeight: "400", color: "#858585" },
  joinedText: { fontSize: 12, fontWeight: "400", color: "#858585", textAlign: "right" },
  statusBadge: { borderWidth: 1, borderColor: "#D97706", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3, marginTop: 6 },
  statusText: { fontSize: 11, fontWeight: "500", color: "#D97706" },
  locationRow: { flexDirection: "row", gap: 12, marginBottom: 20 },
  locationCard: { flex: 1, backgroundColor: "#FFFFFF", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "#F0F0F0", alignItems: "center", gap: 4 },
  locationLabel: { fontSize: 11, fontWeight: "400", color: "#858585" },
  locationValue: { fontSize: 16, fontWeight: "700", color: "#282828" },
  descTitle: { fontSize: 16, fontWeight: "700", color: "#282828", marginBottom: 6 },
  descText: { fontSize: 14, fontWeight: "400", color: "#858585", lineHeight: 20 },
  divider: { height: 1, backgroundColor: "#F0F0F0", marginVertical: 16 },
  infoCards: { flexDirection: "row", gap: 12, marginBottom: 20 },
  infoCard: { flex: 1, backgroundColor: "#FFFFFF", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "#F0F0F0", alignItems: "center", gap: 6 },
  infoCardLabel: { fontSize: 11, fontWeight: "400", color: "#858585" },
  infoCardValue: { fontSize: 14, fontWeight: "700", color: "#282828" },
  progressTitle: { fontSize: 16, fontWeight: "700", color: "#282828", marginBottom: 14 },
  progressList: { gap: 14, marginBottom: 20 },
  progressItem: { flexDirection: "row", alignItems: "center", gap: 12 },
  progressDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: "#E0E0E0", alignItems: "center", justifyContent: "center" },
  progressDotDone: { backgroundColor: "#076B51" },
  progressDotPending: { backgroundColor: "#E0E0E0" },
  progressLabel: { fontSize: 14, fontWeight: "500", color: "#282828" },
  orderStats: { flexDirection: "row", gap: 12, marginBottom: 20 },
  orderStatCard: { flex: 1, backgroundColor: "#076B51", borderRadius: 14, padding: 14, flexDirection: "row", alignItems: "center", gap: 8 },
  orderStatIcon: { width: 28, height: 28, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  orderStatLabel: { fontSize: 11, fontWeight: "400", color: "rgba(255,255,255,0.7)" },
  orderStatValue: { fontSize: 18, fontWeight: "700", color: "#FFFFFF" },
  orderStatCardLight: { flex: 1, backgroundColor: "#FFFFFF", borderRadius: 14, padding: 14, flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: "#F0F0F0" },
  orderStatIconLight: { width: 28, height: 28, borderRadius: 14, backgroundColor: "rgba(7,107,81,0.1)", alignItems: "center", justifyContent: "center" },
  orderStatLabelLight: { fontSize: 11, fontWeight: "400", color: "#858585" },
  orderStatValueLight: { fontSize: 18, fontWeight: "700", color: "#282828" },
  approveButton: { height: 52, borderRadius: 14, backgroundColor: "#282828", alignItems: "center", justifyContent: "center", marginBottom: 10 },
  approveButtonText: { fontSize: 15, fontFamily: "Manrope-SemiBold", color: "#FFFFFF" },
  bottomActions: { flexDirection: "row", gap: 10 },
  rejectButton: { flex: 1, height: 48, borderRadius: 12, backgroundColor: "#FB6363", alignItems: "center", justifyContent: "center" },
  rejectButtonText: { fontSize: 14, fontWeight: "600", color: "#FFFFFF" },
  messageButton: { flex: 1, height: 48, borderRadius: 12, borderWidth: 1, borderColor: "#076B51", alignItems: "center", justifyContent: "center" },
  messageButtonText: { fontSize: 14, fontWeight: "600", color: "#076B51" },
});
