import React, { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { goBackOrReplace } from "../../utils/navigation";
import { Ionicons } from "@expo/vector-icons";
import { notificationService, type AppNotification } from "../../services/notificationService";

const ICON_FOR_TYPE: Record<AppNotification["type"], React.ComponentProps<typeof Ionicons>["name"]> = {
  order: "cart-outline",
  message: "chatbubble-outline",
  payout: "cash-outline",
  stock: "alert-circle-outline",
  verification: "shield-checkmark-outline",
  system: "information-circle-outline",
};

function formatRelative(value: string): string {
  try {
    const ts = new Date(value).getTime();
    if (!Number.isFinite(ts)) return value;
    const diff = Date.now() - ts;
    const minutes = Math.round(diff / 60000);
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
    const days = Math.round(hours / 24);
    if (days <= 7) return `${days} day${days === 1 ? "" : "s"} ago`;
    return new Date(value).toLocaleDateString();
  } catch {
    return value;
  }
}

export default function NotificationsScreen() {
  const router = useRouter();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [smsMarketing, setSmsMarketing] = useState(false);
  const [smsTransactional, setSmsTransactional] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [list, preferences] = await Promise.all([
        notificationService.getNotifications(),
        notificationService.getPreferences(),
      ]);
      setItems(list ?? []);
      setSmsMarketing(preferences.smsMarketing);
      setSmsTransactional(preferences.smsTransactional);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load notifications.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handleMarkAsRead = async (id: string) => {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    try {
      await notificationService.markAsRead(id);
    } catch {
      // Silent — UI already updated optimistically.
    }
  };

  const handleMarkAllAsRead = async () => {
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await notificationService.markAllAsRead();
    } catch {}
  };

  const hasUnread = items.some((n) => !n.read);

  const updatePreferences = async (next: { smsMarketing?: boolean; smsTransactional?: boolean }) => {
    if (next.smsMarketing !== undefined) setSmsMarketing(next.smsMarketing);
    if (next.smsTransactional !== undefined) setSmsTransactional(next.smsTransactional);
    try {
      const saved = await notificationService.updatePreferences(next);
      setSmsMarketing(saved.smsMarketing);
      setSmsTransactional(saved.smsTransactional);
    } catch {
      await load();
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => goBackOrReplace(router, "/(vendor)/settings" as any)} activeOpacity={0.85} style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color="#282828" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        {hasUnread ? (
          <TouchableOpacity onPress={handleMarkAllAsRead} activeOpacity={0.85} style={styles.markAllBtn}>
            <Text style={styles.markAllText}>Mark all read</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.preferenceCard}>
          <View style={styles.preferenceCopy}><Text style={styles.preferenceTitle}>Transactional SMS</Text><Text style={styles.preferenceBody}>Delivery OTP, escrow, payout, and security updates.</Text></View>
          <Switch value={smsTransactional} onValueChange={(value) => void updatePreferences({ smsTransactional: value })} trackColor={{ true: "#85C5AE" }} thumbColor={smsTransactional ? "#076B51" : "#F4F4F4"} />
        </View>
        <View style={styles.preferenceCard}>
          <View style={styles.preferenceCopy}><Text style={styles.preferenceTitle}>Admin marketing SMS</Text><Text style={styles.preferenceBody}>Optional targeted updates and marketplace campaigns.</Text></View>
          <Switch value={smsMarketing} onValueChange={(value) => void updatePreferences({ smsMarketing: value })} trackColor={{ true: "#85C5AE" }} thumbColor={smsMarketing ? "#076B51" : "#F4F4F4"} />
        </View>
        {loading && items.length === 0 ? (
          <View style={styles.placeholder}>
            <ActivityIndicator color="#076B51" />
          </View>
        ) : error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : items.length === 0 ? (
          <Text style={styles.emptyText}>You're all caught up. New activity will appear here.</Text>
        ) : (
          items.map((notif) => {
            const iconName = ICON_FOR_TYPE[notif.type] ?? "notifications-outline";
            return (
              <TouchableOpacity
                key={notif.id}
                onPress={() => !notif.read && handleMarkAsRead(notif.id)}
                activeOpacity={0.85}
                style={styles.notifCard}
              >
                <View style={[styles.notifIcon, !notif.read && styles.notifIconUnread]}>
                  <Ionicons name={iconName} size={18} color={!notif.read ? "#076B51" : "#858585"} />
                </View>
                <View style={styles.notifContent}>
                  <Text style={[styles.notifTitle, !notif.read && styles.notifTitleUnread]}>{notif.title}</Text>
                  <Text style={styles.notifBody} numberOfLines={2}>{notif.body}</Text>
                </View>
                <Text style={styles.notifTime}>{formatRelative(notif.createdAt)}</Text>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9F9F9" },
  header: { backgroundColor: "#FFFFFF", paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16, flexDirection: "row", alignItems: "center", gap: 12 },
  backButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#F4F4F4", alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, fontSize: 24, fontFamily: "Manrope-Bold", color: "#282828" },
  markAllBtn: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: "#F4F4F4", borderRadius: 12 },
  markAllText: { fontSize: 12, fontFamily: "Outfit-Medium", color: "#076B51" },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 100, gap: 10 },
  preferenceCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#FFFFFF", borderRadius: 16, padding: 14 },
  preferenceCopy: { flex: 1 },
  preferenceTitle: { fontSize: 14, fontFamily: "Manrope-Bold", color: "#282828" },
  preferenceBody: { marginTop: 3, fontSize: 12, lineHeight: 17, fontFamily: "Outfit-Regular", color: "#858585" },
  placeholder: { paddingVertical: 60, alignItems: "center" },
  emptyText: { fontSize: 14, fontFamily: "Outfit-Regular", color: "#858585", textAlign: "center", paddingVertical: 60 },
  errorText: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#FB6363", textAlign: "center", paddingVertical: 30 },
  notifCard: { flexDirection: "row", alignItems: "flex-start", backgroundColor: "#FFFFFF", borderRadius: 16, padding: 14, gap: 12 },
  notifIcon: { width: 40, height: 40, borderRadius: 14, backgroundColor: "#F4F4F4", alignItems: "center", justifyContent: "center" },
  notifIconUnread: { backgroundColor: "rgba(7,107,81,0.1)" },
  notifContent: { flex: 1 },
  notifTitle: { fontSize: 14, fontFamily: "Outfit-Medium", color: "#282828" },
  notifTitleUnread: { fontFamily: "Manrope-Bold" },
  notifBody: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#858585", marginTop: 2, lineHeight: 18 },
  notifTime: { fontSize: 11, fontFamily: "Outfit-Regular", color: "#B0B0B0" },
});
