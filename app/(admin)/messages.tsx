import React, { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { messageService } from "../../services/messageService";
import { useMessageStore } from "../../stores/messageStore";

export default function AdminMessagesScreen() {
  const router = useRouter();
  const setSelectedConversation = useMessageStore((state) => state.setSelectedConversation);
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      messageService.getConversations()
        .then((data) => { if (!cancelled) setConversations(data ?? []); })
        .catch(() => { if (!cancelled) setConversations([]); })
        .finally(() => { if (!cancelled) setLoading(false); });
      return () => { cancelled = true; };
    }, [])
  );

  const timeAgo = (iso: string) => {
    try {
      const diff = Date.now() - new Date(iso).getTime();
      const mins = Math.floor(diff / 60000);
      if (mins < 1) return "Just now";
      if (mins < 60) return `${mins}m ago`;
      const hrs = Math.floor(mins / 60);
      if (hrs < 24) return `${hrs}h ago`;
      const days = Math.floor(hrs / 24);
      if (days === 1) return "Yesterday";
      return `${days}d ago`;
    } catch { return ""; }
  };

  const openConversation = (conversation: any) => {
    setSelectedConversation(conversation);
    router.push({ pathname: "/(admin)/message-chat", params: { id: conversation.id } } as any);
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>Communication Hub</Text>
            <Text style={styles.headerSubtitle}>Messages from vendors and buyers</Text>
          </View>
          <TouchableOpacity onPress={() => router.push("/(admin)/create-message" as any)} activeOpacity={0.85} style={styles.composeButton}>
            <Ionicons name="create-outline" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          {loading ? (
            <ActivityIndicator color="#076B51" style={{ paddingVertical: 24 }} />
          ) : conversations.length === 0 ? (
            <View style={{ alignItems: "center", paddingVertical: 24 }}>
              <Ionicons name="chatbubbles-outline" size={32} color="#C5C5C5" />
              <Text style={{ fontSize: 14, color: "#858585", marginTop: 8 }}>No messages yet</Text>
            </View>
          ) : conversations.map((conv, index) => {
            const name = conv.otherParticipantName || conv.participantName || "User";
            const lastMsg = conv.lastMessage || conv.lastMessageText || "";
            const unread = conv.unreadCount > 0;
            return (
              <TouchableOpacity key={conv.id} onPress={() => openConversation(conv)} activeOpacity={0.85} style={[styles.msgItem, index < conversations.length - 1 && styles.msgBorder]}>
                <View style={styles.msgAvatar}>
                  <Text style={styles.msgAvatarText}>{name.charAt(0)}</Text>
                </View>
                <View style={styles.msgContent}>
                  <View style={styles.msgTop}>
                    <Text style={styles.msgFrom}>{name}</Text>
                    <Text style={styles.msgTime}>{timeAgo(conv.updatedAt || conv.createdAt)}</Text>
                  </View>
                  <Text style={styles.msgText} numberOfLines={1}>{lastMsg}</Text>
                </View>
                {unread && <View style={styles.unreadDot} />}
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity onPress={() => router.push("/(admin)/create-message" as any)} activeOpacity={0.85} style={styles.broadcastButton}>
          <Ionicons name="megaphone-outline" size={18} color="#FFFFFF" />
          <Text style={styles.broadcastText}>Send Broadcast</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F4F4F4" },
  header: { backgroundColor: "#076B51", paddingHorizontal: 20, paddingTop: 16, paddingBottom: 30, borderBottomLeftRadius: 35, borderBottomRightRadius: 35 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  headerTitle: { fontSize: 24, fontFamily: "Manrope-Bold", color: "#FFFFFF" },
  headerSubtitle: { fontSize: 14, fontFamily: "Outfit-Light", color: "rgba(255,255,255,0.7)", marginTop: 4 },
  composeButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
  scrollContent: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 40 },
  card: { backgroundColor: "#FFFFFF", borderRadius: 30, padding: 20, marginBottom: 16 },
  msgItem: { flexDirection: "row", alignItems: "center", paddingVertical: 14 },
  msgBorder: { borderBottomWidth: 1, borderBottomColor: "#F4F4F4" },
  msgAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(7,107,81,0.1)", alignItems: "center", justifyContent: "center", marginRight: 12 },
  msgAvatarText: { fontSize: 16, fontWeight: "700", color: "#076B51" },
  msgContent: { flex: 1 },
  msgTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  msgFrom: { fontSize: 14, fontWeight: "700", color: "#282828" },
  msgTime: { fontSize: 11, fontWeight: "400", color: "#858585" },
  msgTypeBadge: { backgroundColor: "rgba(7,107,81,0.1)", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, alignSelf: "flex-start", marginBottom: 4 },
  msgTypeText: { fontSize: 10, fontWeight: "600", color: "#076B51" },
  msgText: { fontSize: 13, fontWeight: "400", color: "#858585" },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#076B51", marginLeft: 8 },
  broadcastButton: { height: 56, borderRadius: 14, backgroundColor: "#076B51", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  broadcastText: { fontSize: 16, fontFamily: "Manrope-SemiBold", color: "#FFFFFF" },
});
