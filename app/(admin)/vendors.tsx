import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { vendorService } from "../../services/vendorService";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const TABS = ["All", "Pending", "Active", "Suspended", "Rejected"] as const;
type TabKey = (typeof TABS)[number];
const TAB_STATUS_MAP: Record<TabKey, string | undefined> = {
  All: undefined,
  Pending: "PENDING",
  Active: "VERIFIED",
  Suspended: undefined,
  Rejected: "REJECTED",
};

const SORT_OPTIONS = [
  { label: "Newest", value: "newest" },
  { label: "Revenue ↓", value: "revenue_desc" },
  { label: "Orders ↓", value: "orders_desc" },
  { label: "Name A-Z", value: "name_asc" },
] as const;

interface VendorStats {
  total: number;
  active: number;
  pending: number;
  rejected: number;
  suspended: number;
  verified: number;
  unverified: number;
  withOrders: number;
  withoutOrders: number;
  avgRevenue: number;
  gmv: number;
}

function formatCurrency(amount: number): string {
  if (amount >= 1_000_000) return `£${(amount / 100_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `£${(amount / 100_000).toFixed(1)}K`;
  return `£${(amount / 100).toFixed(0)}`;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function getVendorDisplayStatus(v: any): string {
  if (v.isSuspended) return "Suspended";
  if (v.verificationStatus === "VERIFIED") return "Active";
  if (v.verificationStatus === "REJECTED") return "Rejected";
  return "Pending";
}

function getStatusColor(status: string): { bg: string; text: string } {
  switch (status) {
    case "Active": return { bg: "rgba(7,107,81,0.10)", text: "#076B51" };
    case "Suspended": return { bg: "rgba(251,99,99,0.10)", text: "#E53935" };
    case "Rejected": return { bg: "rgba(217,119,6,0.10)", text: "#D97706" };
    default: return { bg: "rgba(33,150,243,0.10)", text: "#2196F3" };
  }
}

export default function VendorsScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabKey>("All");
  const [vendors, setVendors] = useState<any[]>([]);
  const [stats, setStats] = useState<VendorStats | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkMode, setBulkMode] = useState(false);
  const [sortBy, setSortBy] = useState<string>("newest");
  const [showSort, setShowSort] = useState(false);
  const bulkBarAnim = useRef(new Animated.Value(0)).current;
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadStats = useCallback(async () => {
    try {
      const s = await vendorService.getVendorStats();
      setStats(s);
    } catch {}
  }, []);

  const loadVendors = useCallback(async (status?: string, query?: string) => {
    try {
      const data = await vendorService.getAllVendors({
        status: status === "suspended" || status === "rejected" ? undefined : status,
        search: query || undefined,
        admin: true,
        limit: 100,
      });
      const list = data ?? [];
      if (status === "suspended") {
        setVendors(list.filter((v: any) => v.isSuspended));
      } else if (status === "rejected") {
        setVendors(list.filter((v: any) => !v.isSuspended && v.verificationStatus === "REJECTED"));
      } else {
        setVendors(list);
      }
    } catch {
      setVendors([]);
    }
  }, []);

  const loadAll = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    const statusKey = activeTab === "Suspended" ? "suspended" : activeTab === "Rejected" ? "rejected" : TAB_STATUS_MAP[activeTab];
    await Promise.all([loadVendors(statusKey, search), loadStats()]);
    setLoading(false);
  }, [activeTab, search, loadVendors, loadStats]);

  useFocusEffect(useCallback(() => { loadAll(); }, [loadAll]));

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAll(true);
    setRefreshing(false);
  }, [loadAll]);

  const handleTabChange = (tab: TabKey) => {
    setActiveTab(tab);
    setSelectedIds(new Set());
    setBulkMode(false);
    const statusKey = tab === "Suspended" ? "suspended" : tab === "Rejected" ? "rejected" : TAB_STATUS_MAP[tab];
    setLoading(true);
    loadVendors(statusKey, search).then(() => setLoading(false));
  };

  const handleSearch = (text: string) => {
    setSearch(text);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      const statusKey = activeTab === "Suspended" ? "suspended" : activeTab === "Rejected" ? "rejected" : TAB_STATUS_MAP[activeTab];
      loadVendors(statusKey, text);
    }, 400);
  };

  const runAction = async (vendorId: string, action: "approve" | "reject" | "suspend" | "unsuspend") => {
    setSavingId(vendorId);
    try {
      if (action === "approve") await vendorService.approveVendor(vendorId);
      if (action === "reject") await vendorService.rejectVendor(vendorId);
      if (action === "suspend") await vendorService.suspendVendor(vendorId);
      if (action === "unsuspend") await vendorService.unsuspendVendor(vendorId);
      await loadAll(true);
    } catch (err) {
      Alert.alert("Action failed", err instanceof Error ? err.message : "Could not update vendor.");
    } finally {
      setSavingId(null);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === vendors.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(vendors.map((v) => v.id)));
    }
  };

  const toggleBulkMode = () => {
    const next = !bulkMode;
    setBulkMode(next);
    if (!next) setSelectedIds(new Set());
    Animated.spring(bulkBarAnim, { toValue: next ? 1 : 0, useNativeDriver: true, tension: 80, friction: 10 }).start();
  };

  const runBulkAction = async (action: "approve" | "reject" | "suspend") => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    const label = action === "approve" ? "approve" : action === "reject" ? "reject" : "suspend";
    Alert.alert(
      `Bulk ${label}`,
      `${label.charAt(0).toUpperCase() + label.slice(1)} ${ids.length} vendor${ids.length > 1 ? "s" : ""}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: label.charAt(0).toUpperCase() + label.slice(1),
          style: action === "approve" ? "default" : "destructive",
          onPress: async () => {
            setSavingId("bulk");
            try {
              if (action === "approve") await vendorService.bulkApproveVendors(ids);
              if (action === "reject") await vendorService.bulkRejectVendors(ids);
              if (action === "suspend") await vendorService.bulkSuspendVendors(ids);
              setSelectedIds(new Set());
              setBulkMode(false);
              await loadAll(true);
            } catch (err) {
              Alert.alert("Bulk action failed", err instanceof Error ? err.message : "Operation failed.");
            } finally {
              setSavingId(null);
            }
          },
        },
      ],
    );
  };

  const sortedVendors = useMemo(() => {
    const list = [...vendors];
    switch (sortBy) {
      case "revenue_desc": return list.sort((a, b) => (b.totalRevenue ?? 0) - (a.totalRevenue ?? 0));
      case "orders_desc": return list.sort((a, b) => (b.orderCount ?? 0) - (a.orderCount ?? 0));
      case "name_asc": return list.sort((a, b) => (a.storeName ?? "").localeCompare(b.storeName ?? ""));
      default: return list;
    }
  }, [vendors, sortBy]);

  const kpiCards = useMemo(() => {
    if (!stats) return [];
    return [
      { label: "Total Vendors", value: formatNumber(stats.total), icon: "storefront-outline" as const, color: "#076B51" },
      { label: "Active", value: formatNumber(stats.active), icon: "checkmark-circle-outline" as const, color: "#2E7D32" },
      { label: "Pending", value: formatNumber(stats.pending), icon: "time-outline" as const, color: "#2196F3" },
      { label: "Suspended", value: formatNumber(stats.suspended), icon: "ban-outline" as const, color: "#E53935" },
      { label: "With Orders", value: formatNumber(stats.withOrders), icon: "cart-outline" as const, color: "#7B1FA2" },
      { label: "Total GMV", value: formatCurrency(stats.gmv), icon: "trending-up-outline" as const, color: "#F57C00" },
      { label: "Avg Revenue", value: formatCurrency(stats.avgRevenue), icon: "bar-chart-outline" as const, color: "#0277BD" },
      { label: "Rejected", value: formatNumber(stats.rejected), icon: "close-circle-outline" as const, color: "#D97706" },
    ];
  }, [stats]);

  const renderKpiCard = ({ item }: { item: (typeof kpiCards)[number] }) => (
    <View style={styles.kpiCard}>
      <View style={[styles.kpiIconWrap, { backgroundColor: item.color + "14" }]}>
        <Ionicons name={item.icon} size={20} color={item.color} />
      </View>
      <Text style={styles.kpiValue}>{item.value}</Text>
      <Text style={styles.kpiLabel}>{item.label}</Text>
    </View>
  );

  const renderVendorCard = ({ item: vendor }: { item: any }) => {
    const status = getVendorDisplayStatus(vendor);
    const sc = getStatusColor(status);
    const isSelected = selectedIds.has(vendor.id);

    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => {
          if (bulkMode) { toggleSelect(vendor.id); return; }
          router.push({ pathname: "/(admin)/vendor-detail", params: { id: vendor.id } } as any);
        }}
        onLongPress={() => { if (!bulkMode) { toggleBulkMode(); toggleSelect(vendor.id); } }}
        style={[styles.vendorCard, isSelected && styles.vendorCardSelected]}
      >
        <View style={styles.vendorCardTop}>
          {bulkMode && (
            <TouchableOpacity onPress={() => toggleSelect(vendor.id)} style={styles.checkbox} activeOpacity={0.85}>
              <View style={[styles.checkboxInner, isSelected && styles.checkboxChecked]}>
                {isSelected && <Ionicons name="checkmark" size={14} color="#FFF" />}
              </View>
            </TouchableOpacity>
          )}
          <View style={styles.vendorAvatar}>
            <Text style={styles.vendorAvatarText}>
              {(vendor.storeName || "V").charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.vendorMainInfo}>
            <Text style={styles.vendorName} numberOfLines={1}>
              {vendor.storeName || vendor.ownerName || "Vendor"}
            </Text>
            <Text style={styles.vendorEmail} numberOfLines={1}>
              {vendor.user?.email || vendor.contactEmail || "—"}
            </Text>
          </View>
          <View style={[styles.statusPill, { backgroundColor: sc.bg }]}>
            <Text style={[styles.statusPillText, { color: sc.text }]}>{status}</Text>
          </View>
        </View>

        <View style={styles.vendorMetrics}>
          <View style={styles.metricItem}>
            <Ionicons name="cart-outline" size={14} color="#858585" />
            <Text style={styles.metricValue}>{vendor.orderCount ?? 0}</Text>
            <Text style={styles.metricLabel}>Orders</Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metricItem}>
            <Ionicons name="trending-up-outline" size={14} color="#858585" />
            <Text style={styles.metricValue}>{formatCurrency(vendor.totalRevenue ?? 0)}</Text>
            <Text style={styles.metricLabel}>Revenue</Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metricItem}>
            <Ionicons name="ribbon-outline" size={14} color="#858585" />
            <Text style={styles.metricValue}>{vendor.subscriptionPlan ?? "FREE"}</Text>
            <Text style={styles.metricLabel}>Plan</Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metricItem}>
            <Ionicons name="location-outline" size={14} color="#858585" />
            <Text style={styles.metricValue} numberOfLines={1}>{vendor.country || vendor.city || "—"}</Text>
            <Text style={styles.metricLabel}>Location</Text>
          </View>
        </View>

        {!bulkMode && (
          <View style={styles.vendorActions}>
            {status === "Pending" && (
              <>
                <TouchableOpacity onPress={() => runAction(vendor.id, "approve")} disabled={savingId === vendor.id} style={styles.actionBtnPrimary} activeOpacity={0.85}>
                  <Ionicons name="checkmark" size={16} color="#FFF" />
                  <Text style={styles.actionBtnPrimaryText}>{savingId === vendor.id ? "..." : "Approve"}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => runAction(vendor.id, "reject")} disabled={savingId === vendor.id} style={styles.actionBtnDanger} activeOpacity={0.85}>
                  <Ionicons name="close" size={16} color="#E53935" />
                  <Text style={styles.actionBtnDangerText}>{savingId === vendor.id ? "..." : "Reject"}</Text>
                </TouchableOpacity>
              </>
            )}
            {status === "Active" && (
              <TouchableOpacity onPress={() => runAction(vendor.id, "suspend")} disabled={savingId === vendor.id} style={styles.actionBtnDanger} activeOpacity={0.85}>
                <Ionicons name="ban-outline" size={14} color="#E53935" />
                <Text style={styles.actionBtnDangerText}>{savingId === vendor.id ? "..." : "Suspend"}</Text>
              </TouchableOpacity>
            )}
            {status === "Suspended" && (
              <TouchableOpacity onPress={() => runAction(vendor.id, "unsuspend")} disabled={savingId === vendor.id} style={styles.actionBtnPrimary} activeOpacity={0.85}>
                <Ionicons name="refresh-outline" size={14} color="#FFF" />
                <Text style={styles.actionBtnPrimaryText}>{savingId === vendor.id ? "..." : "Reactivate"}</Text>
              </TouchableOpacity>
            )}
            {status === "Rejected" && (
              <TouchableOpacity onPress={() => runAction(vendor.id, "approve")} disabled={savingId === vendor.id} style={styles.actionBtnPrimary} activeOpacity={0.85}>
                <Ionicons name="checkmark" size={16} color="#FFF" />
                <Text style={styles.actionBtnPrimaryText}>{savingId === vendor.id ? "..." : "Approve"}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={() => router.push({ pathname: "/(admin)/vendor-detail", params: { id: vendor.id } } as any)}
              style={styles.actionBtnOutline}
              activeOpacity={0.85}
            >
              <Ionicons name="eye-outline" size={14} color="#282828" />
              <Text style={styles.actionBtnOutlineText}>Details</Text>
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const ListHeader = (
    <>
      {/* KPI Summary Cards */}
      {stats && (
        <View style={styles.kpiSection}>
          <Text style={styles.kpiSectionTitle}>Overview</Text>
          <FlatList
            data={kpiCards}
            renderItem={renderKpiCard}
            keyExtractor={(_, i) => `kpi-${i}`}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.kpiList}
          />
        </View>
      )}

      {/* Tabs */}
      <View style={styles.tabRow}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab;
          const count = stats
            ? tab === "All" ? stats.total
              : tab === "Active" ? stats.active
              : tab === "Pending" ? stats.pending
              : tab === "Suspended" ? stats.suspended
              : stats.rejected
            : null;
          return (
            <TouchableOpacity
              key={tab}
              onPress={() => handleTabChange(tab)}
              activeOpacity={0.85}
              style={[styles.tab, isActive && styles.tabActive]}
            >
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{tab}</Text>
              {count !== null && (
                <View style={[styles.tabBadge, isActive && styles.tabBadgeActive]}>
                  <Text style={[styles.tabBadgeText, isActive && styles.tabBadgeTextActive]}>{count}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Controls Row */}
      <View style={styles.controlsRow}>
        <Text style={styles.resultCount}>{vendors.length} vendor{vendors.length !== 1 ? "s" : ""}</Text>
        <View style={styles.controlsRight}>
          <TouchableOpacity onPress={toggleBulkMode} style={[styles.controlBtn, bulkMode && styles.controlBtnActive]} activeOpacity={0.85}>
            <Ionicons name="checkbox-outline" size={16} color={bulkMode ? "#FFF" : "#858585"} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowSort(!showSort)} style={styles.controlBtn} activeOpacity={0.85}>
            <Ionicons name="funnel-outline" size={16} color="#858585" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Sort Dropdown */}
      {showSort && (
        <View style={styles.sortDropdown}>
          {SORT_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              onPress={() => { setSortBy(opt.value); setShowSort(false); }}
              style={[styles.sortOption, sortBy === opt.value && styles.sortOptionActive]}
              activeOpacity={0.85}
            >
              <Text style={[styles.sortOptionText, sortBy === opt.value && styles.sortOptionTextActive]}>{opt.label}</Text>
              {sortBy === opt.value && <Ionicons name="checkmark" size={16} color="#076B51" />}
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Bulk Select All */}
      {bulkMode && (
        <View style={styles.bulkSelectRow}>
          <TouchableOpacity onPress={toggleSelectAll} style={styles.selectAllBtn} activeOpacity={0.85}>
            <View style={[styles.checkboxInner, selectedIds.size === vendors.length && vendors.length > 0 && styles.checkboxChecked]}>
              {selectedIds.size === vendors.length && vendors.length > 0 && <Ionicons name="checkmark" size={14} color="#FFF" />}
            </View>
            <Text style={styles.selectAllText}>Select all ({vendors.length})</Text>
          </TouchableOpacity>
        </View>
      )}
    </>
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerTitle}>Vendor Management</Text>
            <Text style={styles.headerSubtitle}>Monitor, approve and manage all vendors</Text>
          </View>
        </View>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color="rgba(255,255,255,0.6)" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name, email, city..."
            placeholderTextColor="rgba(255,255,255,0.5)"
            value={search}
            onChangeText={handleSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => handleSearch("")} activeOpacity={0.85}>
              <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.5)" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.loadingWrap}><ActivityIndicator color="#076B51" size="large" /></View>
      ) : (
        <FlatList
          data={sortedVendors}
          renderItem={renderVendorCard}
          keyExtractor={(v) => v.id}
          ListHeaderComponent={ListHeader}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <View style={styles.emptyIcon}>
                <Ionicons name="storefront-outline" size={40} color="#C5C5C5" />
              </View>
              <Text style={styles.emptyTitle}>No vendors found</Text>
              <Text style={styles.emptySubtitle}>Try adjusting your filters or search</Text>
            </View>
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#076B51" colors={["#076B51"]} />
          }
        />
      )}

      {/* Bulk Action Bar */}
      {bulkMode && selectedIds.size > 0 && (
        <Animated.View
          style={[
            styles.bulkBar,
            { transform: [{ translateY: bulkBarAnim.interpolate({ inputRange: [0, 1], outputRange: [100, 0] }) }] },
          ]}
        >
          <Text style={styles.bulkBarText}>{selectedIds.size} selected</Text>
          <View style={styles.bulkBarActions}>
            <TouchableOpacity onPress={() => runBulkAction("approve")} style={styles.bulkBtnApprove} activeOpacity={0.85} disabled={savingId === "bulk"}>
              <Ionicons name="checkmark-circle" size={18} color="#FFF" />
              <Text style={styles.bulkBtnText}>Approve</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => runBulkAction("reject")} style={styles.bulkBtnReject} activeOpacity={0.85} disabled={savingId === "bulk"}>
              <Ionicons name="close-circle" size={18} color="#FFF" />
              <Text style={styles.bulkBtnText}>Reject</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => runBulkAction("suspend")} style={styles.bulkBtnSuspend} activeOpacity={0.85} disabled={savingId === "bulk"}>
              <Ionicons name="ban" size={18} color="#FFF" />
              <Text style={styles.bulkBtnText}>Suspend</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F6FA" },

  // Header
  header: {
    backgroundColor: "#076B51",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 },
  headerTitle: { fontSize: 26, fontWeight: "700", color: "#FFFFFF", letterSpacing: -0.5 },
  headerSubtitle: { fontSize: 13, color: "rgba(255,255,255,0.7)", marginTop: 4 },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 14,
    height: 46,
    paddingHorizontal: 14,
    gap: 10,
  },
  searchInput: { flex: 1, fontSize: 14, color: "#FFFFFF" },

  // Loading
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  listContent: { paddingHorizontal: 16, paddingBottom: 120 },

  // KPI Section
  kpiSection: { marginTop: 20, marginBottom: 8 },
  kpiSectionTitle: { fontSize: 16, fontWeight: "700", color: "#282828", marginBottom: 12, paddingHorizontal: 4 },
  kpiList: { gap: 10, paddingRight: 16 },
  kpiCard: {
    width: (SCREEN_WIDTH - 64) / 2.5,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#F0F0F0",
    ...Platform.select({ ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8 }, android: { elevation: 2 } }),
  },
  kpiIconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  kpiValue: { fontSize: 22, fontWeight: "700", color: "#1A1A1A", letterSpacing: -0.5 },
  kpiLabel: { fontSize: 12, fontWeight: "500", color: "#858585", marginTop: 4 },

  // Tabs
  tabRow: { flexDirection: "row", marginTop: 20, marginBottom: 16, gap: 6, flexWrap: "wrap" },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E8E8E8",
    gap: 6,
  },
  tabActive: { backgroundColor: "#076B51", borderColor: "#076B51" },
  tabText: { fontSize: 13, fontWeight: "500", color: "#858585" },
  tabTextActive: { color: "#FFFFFF", fontWeight: "600" },
  tabBadge: { minWidth: 22, height: 22, borderRadius: 11, backgroundColor: "#F0F0F0", alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
  tabBadgeActive: { backgroundColor: "rgba(255,255,255,0.2)" },
  tabBadgeText: { fontSize: 11, fontWeight: "600", color: "#858585" },
  tabBadgeTextActive: { color: "#FFFFFF" },

  // Controls
  controlsRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  resultCount: { fontSize: 13, fontWeight: "500", color: "#858585" },
  controlsRight: { flexDirection: "row", gap: 8 },
  controlBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E8E8E8",
    alignItems: "center",
    justifyContent: "center",
  },
  controlBtnActive: { backgroundColor: "#076B51", borderColor: "#076B51" },

  // Sort
  sortDropdown: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#F0F0F0",
    overflow: "hidden",
    ...Platform.select({ ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12 }, android: { elevation: 4 } }),
  },
  sortOption: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#F5F5F5" },
  sortOptionActive: { backgroundColor: "rgba(7,107,81,0.04)" },
  sortOptionText: { fontSize: 14, fontWeight: "500", color: "#282828" },
  sortOptionTextActive: { color: "#076B51", fontWeight: "600" },

  // Bulk select
  bulkSelectRow: { marginBottom: 12 },
  selectAllBtn: { flexDirection: "row", alignItems: "center", gap: 10 },
  selectAllText: { fontSize: 13, fontWeight: "500", color: "#282828" },

  // Vendor Card
  vendorCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#F0F0F0",
    ...Platform.select({ ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8 }, android: { elevation: 2 } }),
  },
  vendorCardSelected: { borderColor: "#076B51", borderWidth: 2, backgroundColor: "rgba(7,107,81,0.02)" },
  vendorCardTop: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  checkbox: { marginRight: 0 },
  checkboxInner: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#D5D5D5",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: { backgroundColor: "#076B51", borderColor: "#076B51" },
  vendorAvatar: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#076B51",
    alignItems: "center",
    justifyContent: "center",
  },
  vendorAvatarText: { fontSize: 18, fontWeight: "700", color: "#FFFFFF" },
  vendorMainInfo: { flex: 1 },
  vendorName: { fontSize: 15, fontWeight: "700", color: "#1A1A1A" },
  vendorEmail: { fontSize: 12, color: "#858585", marginTop: 2 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  statusPillText: { fontSize: 11, fontWeight: "600" },

  // Metrics Row
  vendorMetrics: {
    flexDirection: "row",
    backgroundColor: "#FAFAFA",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 4,
    marginBottom: 12,
  },
  metricItem: { flex: 1, alignItems: "center", gap: 2 },
  metricValue: { fontSize: 13, fontWeight: "700", color: "#1A1A1A" },
  metricLabel: { fontSize: 10, fontWeight: "400", color: "#A0A0A0" },
  metricDivider: { width: 1, backgroundColor: "#ECECEC", marginVertical: 4 },

  // Actions
  vendorActions: { flexDirection: "row", gap: 8 },
  actionBtnPrimary: {
    flex: 1,
    flexDirection: "row",
    height: 38,
    borderRadius: 10,
    backgroundColor: "#076B51",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  actionBtnPrimaryText: { fontSize: 13, fontWeight: "600", color: "#FFFFFF" },
  actionBtnDanger: {
    flex: 1,
    flexDirection: "row",
    height: 38,
    borderRadius: 10,
    backgroundColor: "rgba(229,57,53,0.06)",
    borderWidth: 1,
    borderColor: "rgba(229,57,53,0.2)",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  actionBtnDangerText: { fontSize: 13, fontWeight: "600", color: "#E53935" },
  actionBtnOutline: {
    flex: 1,
    flexDirection: "row",
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  actionBtnOutlineText: { fontSize: 13, fontWeight: "600", color: "#282828" },

  // Empty
  emptyWrap: { alignItems: "center", paddingVertical: 60 },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#F5F5F5",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: { fontSize: 17, fontWeight: "700", color: "#282828" },
  emptySubtitle: { fontSize: 13, color: "#858585", marginTop: 6 },

  // Bulk Bar
  bulkBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#1A1A1A",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: Platform.OS === "ios" ? 34 : 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  bulkBarText: { fontSize: 14, fontWeight: "600", color: "#FFFFFF" },
  bulkBarActions: { flexDirection: "row", gap: 8 },
  bulkBtnApprove: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#076B51", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  bulkBtnReject: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#D97706", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  bulkBtnSuspend: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#E53935", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  bulkBtnText: { fontSize: 12, fontWeight: "600", color: "#FFFFFF" },
});
