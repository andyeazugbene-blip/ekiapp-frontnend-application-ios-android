import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Avatar } from "../../components/ui/Avatar";
import { adminService, type AdminUser } from "../../services/adminService";
import { formatDate } from "../../utils/formatters";

const ROLE_TABS = [
  { id: "all", label: "All" },
  { id: "buyer", label: "Buyers" },
  { id: "vendor", label: "Vendors" },
  { id: "admin", label: "Admins" },
] as const;

const STATUS_TABS = [
  { id: "all", label: "Any status" },
  { id: "active", label: "Active" },
  { id: "suspended", label: "Suspended" },
] as const;

export default function AdminUsersScreen() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [roleTab, setRoleTab] = useState<(typeof ROLE_TABS)[number]["id"]>("all");
  const [statusTab, setStatusTab] = useState<(typeof STATUS_TABS)[number]["id"]>("all");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<{ user: AdminUser; action: "suspend" | "unsuspend" | "delete" } | null>(null);
  const [actionInput, setActionInput] = useState("");

  const load = useCallback(async () => {
    try {
      const nextUsers = await adminService.getUsers({
        role: roleTab === "all" ? undefined : roleTab,
        status: statusTab === "all" ? undefined : statusTab,
      });
      setUsers(nextUsers);
    } catch (err) {
      Alert.alert("Could not load users", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [roleTab, statusTab]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return users;
    return users.filter((user) => {
      return (
        user.name.toLowerCase().includes(needle) ||
        user.email.toLowerCase().includes(needle) ||
        user.id.toLowerCase().includes(needle)
      );
    });
  }, [query, users]);

  const counts = useMemo(() => {
    return users.reduce(
      (acc, user) => {
        acc.total += 1;
        if (user.status === "suspended") acc.suspended += 1;
        if (user.role === "buyer") acc.buyers += 1;
        if (user.role === "vendor") acc.vendors += 1;
        return acc;
      },
      { total: 0, buyers: 0, vendors: 0, suspended: 0 },
    );
  }, [users]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const promptSensitiveAction = (user: AdminUser, action: "suspend" | "unsuspend" | "delete") => {
    if (user.role === "admin") {
      Alert.alert("Protected account", "Admin accounts cannot be moderated from this screen.");
      return;
    }

    setActionInput("");
    setPendingAction({ user, action });
  };

  const runUserAction = async (user: AdminUser, action: "suspend" | "unsuspend" | "delete", text?: string) => {
    const value = text?.trim();
    const twoFactorCode = value && /^\d{6}$/.test(value) ? value : undefined;
    const reason = value && !twoFactorCode ? value : undefined;
    setSavingId(user.id);
    try {
      if (action === "suspend") await adminService.suspendUser(user.id, { reason, twoFactorCode });
      if (action === "unsuspend") await adminService.unsuspendUser(user.id, { twoFactorCode });
      if (action === "delete") await adminService.deleteUser(user.id, { reason, twoFactorCode });
      setPendingAction(null);
      setActionInput("");
      await load();
    } catch (err) {
      Alert.alert("Action failed", err instanceof Error ? err.message : "Could not update this user.");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>User Management</Text>
        <Text style={styles.headerSubtitle}>Moderate buyers, vendors, and account access</Text>
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={16} color="#858585" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search name, email, or user ID"
          placeholderTextColor="#858585"
          value={query}
          onChangeText={setQuery}
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery("")} activeOpacity={0.85}>
            <Ionicons name="close-circle" size={16} color="#858585" />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.metricRow}>
        <Metric label="Users" value={counts.total} />
        <Metric label="Buyers" value={counts.buyers} />
        <Metric label="Vendors" value={counts.vendors} />
        <Metric label="Suspended" value={counts.suspended} danger />
      </View>

      <View style={styles.tabsWrap}>
        <FlatList
          data={ROLE_TABS}
          horizontal
          keyExtractor={(item) => item.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabList}
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => setRoleTab(item.id)} activeOpacity={0.85} style={[styles.tab, roleTab === item.id && styles.tabActive]}>
              <Text style={[styles.tabText, roleTab === item.id && styles.tabTextActive]}>{item.label}</Text>
            </TouchableOpacity>
          )}
        />
        <FlatList
          data={STATUS_TABS}
          horizontal
          keyExtractor={(item) => item.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabList}
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => setStatusTab(item.id)} activeOpacity={0.85} style={[styles.tab, statusTab === item.id && styles.tabActive]}>
              <Text style={[styles.tabText, statusTab === item.id && styles.tabTextActive]}>{item.label}</Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {loading ? (
        <View style={styles.stateScreen}>
          <ActivityIndicator size="large" color="#076B51" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#076B51" colors={["#076B51"]} />}
          ListEmptyComponent={
            <View style={styles.stateScreen}>
              <Ionicons name="people-outline" size={34} color="#C5C5C5" />
              <Text style={styles.emptyTitle}>No users found</Text>
              <Text style={styles.emptyText}>Try a different search or filter.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const suspended = item.status === "suspended";
            const saving = savingId === item.id;
            return (
              <View style={styles.userCard}>
                <View style={styles.userTop}>
                  <Avatar name={item.name || item.email} size="md" />
                  <View style={styles.userInfo}>
                    <Text style={styles.userName} numberOfLines={1}>{item.name || "Unnamed user"}</Text>
                    <Text style={styles.userEmail} numberOfLines={1}>{item.email}</Text>
                    <Text style={styles.userMeta}>{item.role.toUpperCase()} - Joined {formatDate(item.createdAt)}</Text>
                  </View>
                  <View style={[styles.statusBadge, suspended && styles.statusBadgeDanger]}>
                    <Text style={[styles.statusText, suspended && styles.statusTextDanger]}>{item.status}</Text>
                  </View>
                </View>

                {item.suspendedReason ? <Text style={styles.reasonText}>Reason: {item.suspendedReason}</Text> : null}

                <View style={styles.actionRow}>
                  {suspended ? (
                    <TouchableOpacity
                      onPress={() => promptSensitiveAction(item, "unsuspend")}
                      disabled={saving}
                      activeOpacity={0.85}
                      style={styles.primaryAction}
                    >
                      <Ionicons name="refresh-outline" size={15} color="#FFFFFF" />
                      <Text style={styles.primaryActionText}>{saving ? "Working..." : "Reactivate"}</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      onPress={() => promptSensitiveAction(item, "suspend")}
                      disabled={saving}
                      activeOpacity={0.85}
                      style={styles.warningAction}
                    >
                      <Ionicons name="pause-circle-outline" size={15} color="#FFFFFF" />
                      <Text style={styles.primaryActionText}>{saving ? "Working..." : "Suspend"}</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    onPress={() => promptSensitiveAction(item, "delete")}
                    disabled={saving || item.role === "admin"}
                    activeOpacity={0.85}
                    style={[styles.deleteAction, item.role === "admin" && styles.actionDisabled]}
                  >
                    <Ionicons name="trash-outline" size={15} color="#FB6363" />
                    <Text style={styles.deleteActionText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
        />
      )}

      <Modal visible={Boolean(pendingAction)} transparent animationType="fade" onRequestClose={() => setPendingAction(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIcon}>
              <Ionicons
                name={pendingAction?.action === "unsuspend" ? "refresh-outline" : pendingAction?.action === "delete" ? "trash-outline" : "pause-circle-outline"}
                size={22}
                color={pendingAction?.action === "delete" ? "#FB6363" : "#076B51"}
              />
            </View>
            <Text style={styles.modalTitle}>
              {pendingAction?.action === "suspend" ? "Suspend user" : pendingAction?.action === "unsuspend" ? "Reactivate user" : "Delete user data"}
            </Text>
            <Text style={styles.modalText}>
              {pendingAction?.action === "delete"
                ? "This requests account deletion/anonymization. Enter a reason, or enter a 6-digit 2FA code if required."
                : pendingAction?.action === "suspend"
                  ? "This blocks login and invalidates current sessions. Enter a reason, or a 6-digit 2FA code if required."
                  : "This restores account access. Enter a 6-digit 2FA code if required."}
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder={pendingAction?.action === "unsuspend" ? "Optional 2FA code" : "Reason or 2FA code"}
              placeholderTextColor="#858585"
              value={actionInput}
              onChangeText={setActionInput}
              autoCapitalize="none"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setPendingAction(null)} activeOpacity={0.85} style={styles.modalCancel}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => pendingAction && runUserAction(pendingAction.user, pendingAction.action, actionInput)}
                activeOpacity={0.85}
                disabled={!pendingAction || savingId === pendingAction.user.id}
                style={[styles.modalConfirm, pendingAction?.action === "delete" && styles.modalConfirmDanger]}
              >
                <Text style={styles.modalConfirmText}>
                  {savingId === pendingAction?.user.id ? "Working..." : pendingAction?.action === "delete" ? "Delete" : pendingAction?.action === "suspend" ? "Suspend" : "Reactivate"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Metric({ label, value, danger }: { label: string; value: number; danger?: boolean }) {
  return (
    <View style={styles.metricCard}>
      <Text style={[styles.metricValue, danger && styles.metricValueDanger]}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F4F4F4" },
  header: { backgroundColor: "#076B51", paddingHorizontal: 20, paddingTop: 18, paddingBottom: 24, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  headerTitle: { fontSize: 26, fontFamily: "Manrope-Bold", color: "#FFFFFF" },
  headerSubtitle: { fontSize: 13, fontFamily: "Outfit-Regular", color: "rgba(255,255,255,0.75)", marginTop: 4 },
  searchWrap: { marginHorizontal: 16, marginTop: 14, flexDirection: "row", alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 14, height: 48, paddingHorizontal: 14, gap: 10 },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "Outfit-Regular", color: "#282828" },
  metricRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16, marginTop: 12 },
  metricCard: { flex: 1, backgroundColor: "#FFFFFF", borderRadius: 14, paddingVertical: 12, alignItems: "center", borderWidth: 1, borderColor: "#EEEEEE" },
  metricValue: { fontSize: 18, fontFamily: "Manrope-Bold", color: "#076B51" },
  metricValueDanger: { color: "#FB6363" },
  metricLabel: { fontSize: 10, fontFamily: "Outfit-Regular", color: "#858585", marginTop: 2 },
  tabsWrap: { paddingTop: 10 },
  tabList: { paddingHorizontal: 16, gap: 8, paddingBottom: 8 },
  tab: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E8E8E8" },
  tabActive: { backgroundColor: "#076B51", borderColor: "#076B51" },
  tabText: { fontSize: 12, fontFamily: "Outfit-Medium", color: "#858585" },
  tabTextActive: { color: "#FFFFFF", fontFamily: "Manrope-Bold" },
  stateScreen: { alignItems: "center", justifyContent: "center", paddingVertical: 42, paddingHorizontal: 24 },
  listContent: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 110 },
  userCard: { backgroundColor: "#FFFFFF", borderRadius: 18, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: "#EEEEEE" },
  userTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  userInfo: { flex: 1 },
  userName: { fontSize: 15, fontFamily: "Manrope-Bold", color: "#282828" },
  userEmail: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#858585", marginTop: 2 },
  userMeta: { fontSize: 11, fontFamily: "Outfit-Regular", color: "#858585", marginTop: 4 },
  statusBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: "rgba(7,107,81,0.08)" },
  statusBadgeDanger: { backgroundColor: "rgba(251,99,99,0.1)" },
  statusText: { fontSize: 11, fontFamily: "Manrope-Bold", color: "#076B51", textTransform: "capitalize" },
  statusTextDanger: { color: "#FB6363" },
  reasonText: { marginTop: 10, fontSize: 12, fontFamily: "Outfit-Regular", color: "#7C6515", backgroundColor: "#FFF8E8", borderRadius: 10, padding: 10 },
  actionRow: { flexDirection: "row", gap: 10, marginTop: 14 },
  primaryAction: { flex: 1, height: 42, borderRadius: 12, backgroundColor: "#076B51", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  warningAction: { flex: 1, height: 42, borderRadius: 12, backgroundColor: "#D97706", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  primaryActionText: { fontSize: 13, fontFamily: "Manrope-Bold", color: "#FFFFFF" },
  deleteAction: { width: 108, height: 42, borderRadius: 12, borderWidth: 1, borderColor: "rgba(251,99,99,0.35)", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  actionDisabled: { opacity: 0.4 },
  deleteActionText: { fontSize: 13, fontFamily: "Manrope-Bold", color: "#FB6363" },
  emptyTitle: { fontSize: 16, fontFamily: "Manrope-Bold", color: "#282828", marginTop: 10 },
  emptyText: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#858585", marginTop: 4, textAlign: "center" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.42)", alignItems: "center", justifyContent: "center", padding: 20 },
  modalCard: { width: "100%", maxWidth: 420, backgroundColor: "#FFFFFF", borderRadius: 24, padding: 20 },
  modalIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: "rgba(7,107,81,0.08)", alignItems: "center", justifyContent: "center", marginBottom: 14 },
  modalTitle: { fontSize: 20, fontFamily: "Manrope-Bold", color: "#282828" },
  modalText: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#858585", lineHeight: 19, marginTop: 8 },
  modalInput: { height: 50, borderRadius: 12, backgroundColor: "#F4F4F4", paddingHorizontal: 14, fontSize: 14, fontFamily: "Outfit-Regular", color: "#282828", marginTop: 16 },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 16 },
  modalCancel: { flex: 1, height: 46, borderRadius: 12, borderWidth: 1, borderColor: "#E0E0E0", alignItems: "center", justifyContent: "center" },
  modalCancelText: { fontSize: 14, fontFamily: "Manrope-Bold", color: "#282828" },
  modalConfirm: { flex: 1, height: 46, borderRadius: 12, backgroundColor: "#076B51", alignItems: "center", justifyContent: "center" },
  modalConfirmDanger: { backgroundColor: "#FB6363" },
  modalConfirmText: { fontSize: 14, fontFamily: "Manrope-Bold", color: "#FFFFFF" },
});
