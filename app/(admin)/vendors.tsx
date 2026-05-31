import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { vendorService } from "../../services/vendorService";

const TABS = ["All", "Pending", "Active", "Suspended"];
const TAB_STATUS_MAP: Record<string, string | undefined> = { All: undefined, Pending: "PENDING", Active: "VERIFIED", Suspended: "suspended" };

export default function VendorsScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("All");
  const [vendors, setVendors] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const loadVendors = useCallback(async (status?: string, query?: string) => {
    setLoading(true);
    try {
      const data = await vendorService.getAllVendors({
        status: status === "suspended" ? undefined : status as any,
        search: query || undefined,
        admin: true,
      });
      const list = data ?? [];
      setVendors(status === "suspended" ? list.filter((v) => v.adminStatus === "suspended") : list);
    } catch {} finally { setLoading(false); }
  }, []);

  const runVendorAction = async (vendorId: string, action: "approve" | "reject" | "suspend" | "unsuspend") => {
    setSavingId(vendorId);
    try {
      if (action === "approve") await vendorService.approveVendor(vendorId);
      if (action === "reject") await vendorService.rejectVendor(vendorId);
      if (action === "suspend") await vendorService.suspendVendor(vendorId);
      if (action === "unsuspend") await vendorService.unsuspendVendor(vendorId);
      await loadVendors(TAB_STATUS_MAP[activeTab], search);
    } catch (err) {
      Alert.alert("Action failed", err instanceof Error ? err.message : "Could not update this vendor.");
    } finally {
      setSavingId(null);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadVendors(TAB_STATUS_MAP[activeTab], search);
    }, [activeTab, loadVendors])
  );

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    loadVendors(TAB_STATUS_MAP[tab], search);
  };

  const handleSearch = (text: string) => {
    setSearch(text);
    clearTimeout((globalThis as any).__vendorSearchTimer);
    (globalThis as any).__vendorSearchTimer = setTimeout(() => loadVendors(TAB_STATUS_MAP[activeTab], text), 400);
  };

  const getDisplayStatus = (v: any) => {
    if (v.adminStatus === "active") return "Active";
    if (v.adminStatus === "suspended") return "Suspended";
    return "Pending";
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Vendor Management</Text>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color="#858585" />
          <TextInput style={styles.searchInput} placeholder="Search vendors" placeholderTextColor="#858585" value={search} onChangeText={handleSearch} />
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.tabRow}>
          {TABS.map((tab) => (
            <TouchableOpacity key={tab} onPress={() => handleTabChange(tab)} activeOpacity={0.85} style={[styles.tab, activeTab === tab && styles.tabActive]}>
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <View style={{ paddingVertical: 40, alignItems: "center" }}><ActivityIndicator color="#076B51" /></View>
        ) : vendors.length === 0 ? (
          <View style={{ paddingVertical: 40, alignItems: "center" }}>
            <Ionicons name="storefront-outline" size={32} color="#C5C5C5" />
            <Text style={{ fontSize: 14, color: "#858585", marginTop: 8 }}>No vendors found</Text>
          </View>
        ) : vendors.map((vendor) => {
          const status = getDisplayStatus(vendor);
          return (
            <View key={vendor.id} style={styles.vendorCard}>
              <View style={styles.vendorTop}>
                <View style={styles.vendorImage}>
                  <Ionicons name="storefront" size={24} color="#858585" />
                </View>
                <View style={styles.vendorInfo}>
                  <Text style={styles.vendorName}>{vendor.storeName || vendor.ownerName || "Vendor"}</Text>
                  <Text style={styles.vendorLocation}>{[vendor.city, vendor.country].filter(Boolean).join(", ") || "—"}</Text>
                </View>
                <View style={[styles.statusBadge, status === "Active" && styles.statusActive, status === "Suspended" && styles.statusSuspended]}>
                  <Text style={[styles.statusText, status === "Active" && styles.statusTextActive, status === "Suspended" && styles.statusTextSuspended]}>{status}</Text>
                </View>
              </View>

              {status === "Pending" && (
                <>
                  <View style={styles.actionRow}>
                    <TouchableOpacity onPress={() => runVendorAction(vendor.id, "reject")} disabled={savingId === vendor.id} activeOpacity={0.85} style={styles.rejectButton}>
                      <Text style={styles.rejectButtonText}>{savingId === vendor.id ? "..." : "Reject"}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => runVendorAction(vendor.id, "approve")} disabled={savingId === vendor.id} activeOpacity={0.85} style={styles.approveButton}>
                      <Text style={styles.approveButtonText}>{savingId === vendor.id ? "..." : "Approve"}</Text>
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity onPress={() => router.push({ pathname: "/(admin)/vendor-detail", params: { id: vendor.id } } as any)} activeOpacity={0.85} style={styles.outlineButton}>
                    <Text style={styles.outlineButtonText}>Review verification</Text>
                  </TouchableOpacity>
                </>
              )}
              {status === "Active" && (
                <>
                  <View style={styles.actionRow}>
                    <TouchableOpacity onPress={() => runVendorAction(vendor.id, "suspend")} disabled={savingId === vendor.id} activeOpacity={0.85} style={styles.suspendButton}>
                      <Text style={styles.suspendButtonText}>{savingId === vendor.id ? "..." : "Suspend"}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => router.push({ pathname: "/(admin)/vendor-detail", params: { id: vendor.id } } as any)} activeOpacity={0.85} style={styles.viewActivationButton}>
                      <Text style={styles.viewActivationText}>View activation</Text>
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity onPress={() => router.push({ pathname: "/(admin)/vendor-detail", params: { id: vendor.id } } as any)} activeOpacity={0.85} style={styles.outlineButton}>
                    <Text style={styles.outlineButtonText}>View Details</Text>
                  </TouchableOpacity>
                </>
              )}
              {status === "Suspended" && (
                <>
                  <TouchableOpacity onPress={() => runVendorAction(vendor.id, "unsuspend")} disabled={savingId === vendor.id} activeOpacity={0.85} style={styles.reactivateButton}>
                    <Text style={styles.reactivateButtonText}>{savingId === vendor.id ? "..." : "Reactivate account"}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => router.push({ pathname: "/(admin)/vendor-detail", params: { id: vendor.id } } as any)} activeOpacity={0.85} style={styles.outlineButton}>
                    <Text style={styles.outlineButtonText}>View Details</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F4F4F4" },
  header: { backgroundColor: "#076B51", paddingHorizontal: 20, paddingTop: 20, paddingBottom: 20, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  headerTitle: { fontSize: 26, fontWeight: "700", color: "#FFFFFF", marginBottom: 16 },
  searchBar: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 14, height: 48, paddingHorizontal: 14, gap: 10 },
  searchInput: { flex: 1, fontSize: 14, color: "#282828" },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 100 },
  tabRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  tab: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E8E8E8" },
  tabActive: { backgroundColor: "#076B51", borderColor: "#076B51" },
  tabText: { fontSize: 13, fontWeight: "500", color: "#858585" },
  tabTextActive: { color: "#FFFFFF", fontWeight: "600" },
  vendorCard: { backgroundColor: "#FFFFFF", borderRadius: 18, padding: 16, marginBottom: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 },
  vendorTop: { flexDirection: "row", alignItems: "center", marginBottom: 14 },
  vendorImage: { width: 52, height: 52, borderRadius: 12, backgroundColor: "#F4F4F4", alignItems: "center", justifyContent: "center", marginRight: 12 },
  vendorInfo: { flex: 1 },
  vendorName: { fontSize: 16, fontWeight: "700", color: "#282828" },
  vendorLocation: { fontSize: 13, fontWeight: "400", color: "#858585", marginTop: 2 },
  statusBadge: { borderWidth: 1, borderColor: "#D97706", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3 },
  statusActive: { borderColor: "#076B51" },
  statusSuspended: { borderColor: "#FB6363" },
  statusText: { fontSize: 12, fontWeight: "500", color: "#D97706" },
  statusTextActive: { color: "#076B51" },
  statusTextSuspended: { color: "#FB6363" },
  actionRow: { flexDirection: "row", gap: 10, marginBottom: 10 },
  rejectButton: { flex: 1, height: 44, borderRadius: 12, backgroundColor: "#FB6363", alignItems: "center", justifyContent: "center" },
  rejectButtonText: { fontSize: 14, fontWeight: "600", color: "#FFFFFF" },
  approveButton: { flex: 1.5, height: 44, borderRadius: 12, backgroundColor: "#076B51", alignItems: "center", justifyContent: "center" },
  approveButtonText: { fontSize: 14, fontWeight: "600", color: "#FFFFFF" },
  suspendButton: { flex: 1, height: 44, borderRadius: 12, backgroundColor: "#FB6363", alignItems: "center", justifyContent: "center" },
  suspendButtonText: { fontSize: 14, fontWeight: "600", color: "#FFFFFF" },
  viewActivationButton: { flex: 1.5, height: 44, borderRadius: 12, backgroundColor: "#076B51", alignItems: "center", justifyContent: "center" },
  viewActivationText: { fontSize: 14, fontWeight: "600", color: "#FFFFFF" },
  reactivateButton: { height: 44, borderRadius: 12, backgroundColor: "#FB6363", alignItems: "center", justifyContent: "center", marginBottom: 10 },
  reactivateButtonText: { fontSize: 14, fontWeight: "600", color: "#FFFFFF" },
  outlineButton: { height: 44, borderRadius: 12, borderWidth: 1, borderColor: "#E0E0E0", alignItems: "center", justifyContent: "center" },
  outlineButtonText: { fontSize: 14, fontWeight: "600", color: "#282828" },
});
