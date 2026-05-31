import React, { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useMessageStore, type Conversation } from "../../stores/messageStore";

type MsgTab = "buyer" | "order";

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "?";
}

export default function MessagesScreen() {
  const router = useRouter();
  const { conversations, isLoading, loadConversations, setSelectedConversation } = useMessageStore();
  const [activeTab, setActiveTab] = useState<MsgTab>("buyer");

  useFocusEffect(
    useCallback(() => {
      loadConversations();
    }, [loadConversations])
  );

  const filtered = activeTab === "order"
    ? conversations.filter((c) => !!c.orderId)
    : conversations.filter((c) => !c.orderId);

  const openConversation = (convo: Conversation) => {
    setSelectedConversation(convo);
    router.push("/(vendor)/message-chat" as any);
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.85} style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color="#282828" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Messages</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          onPress={() => setActiveTab("buyer")}
          activeOpacity={0.85}
          style={[styles.tab, activeTab === "buyer" && styles.tabActive]}
        >
          <Text style={[styles.tabText, activeTab === "buyer" && styles.tabTextActive]}>Buyer messages</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setActiveTab("order")}
          activeOpacity={0.85}
          style={[styles.tab, activeTab === "order" && styles.tabActive]}
        >
          <Text style={[styles.tabText, activeTab === "order" && styles.tabTextActive]}>Order messages</Text>
        </TouchableOpacity>
      </View>

      {/* Security warning banner */}
      <View style={styles.noticeBanner}>
        <Ionicons name="shield-checkmark-outline" size={14} color="#076B51" />
        <Text style={styles.noticeText}>Keep all communication on Eki for secure transactions</Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          {isLoading && filtered.length === 0 ? (
            <View style={styles.placeholder}>
              <ActivityIndicator color="#076B51" />
            </View>
          ) : filtered.length === 0 ? (
            <Text style={styles.emptyText}>No conversations yet. Buyers can message you about their orders.</Text>
          ) : (
            filtered.map((convo, index) => (
              <TouchableOpacity
                key={convo.id}
                onPress={() => openConversation(convo)}
                activeOpacity={0.85}
                style={[styles.convoItem, index < filtered.length - 1 && styles.convoBorder]}
              >
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{getInitials(convo.participantName)}</Text>
                </View>
                <View style={styles.convoContent}>
                  <View style={styles.convoTop}>
                    <Text style={styles.convoName} numberOfLines={1}>{convo.participantName}</Text>
                    <Text style={styles.convoTime}>{convo.lastMessageAt}</Text>
                  </View>
                  <View style={styles.convoBottom}>
                    <Text style={styles.convoMessage} numberOfLines={1}>{convo.lastMessage || "No messages yet"}</Text>
                    {convo.unreadCount > 0 && (
                      <View style={styles.unreadBadge}>
                        <Text style={styles.unreadText}>{convo.unreadCount}</Text>
                      </View>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F4F4F4" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 16, gap: 12, backgroundColor: "#FFFFFF" },
  backButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#F4F4F4", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 24, fontFamily: "Manrope-Bold", color: "#282828" },
  tabRow: { flexDirection: "row", paddingHorizontal: 16, gap: 8, paddingBottom: 12, backgroundColor: "#FFFFFF" },
  tab: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20, backgroundColor: "#F4F4F4" },
  tabActive: { backgroundColor: "#076B51" },
  tabText: { fontSize: 13, fontFamily: "Manrope-SemiBold", color: "#858585" },
  tabTextActive: { color: "#FFFFFF" },
  noticeBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    backgroundColor: "#E8F4ED",
    marginHorizontal: 16,
    marginTop: 10,
    borderRadius: 10,
  },
  noticeText: {
    fontSize: 12,
    fontFamily: "Outfit-Medium",
    color: "#076B51",
  },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40 },
  card: { backgroundColor: "#FFFFFF", borderRadius: 30, padding: 20, minHeight: 120 },
  placeholder: { paddingVertical: 30, alignItems: "center" },
  emptyText: { fontSize: 14, fontFamily: "Outfit-Regular", color: "#858585", textAlign: "center", paddingVertical: 20 },
  convoItem: { flexDirection: "row", alignItems: "center", paddingVertical: 14 },
  convoBorder: { borderBottomWidth: 1, borderBottomColor: "#F4F4F4" },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: "rgba(7,107,81,0.1)", alignItems: "center", justifyContent: "center", marginRight: 12 },
  avatarText: { fontSize: 16, fontFamily: "Manrope-Bold", color: "#076B51" },
  convoContent: { flex: 1 },
  convoTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  convoName: { fontSize: 16, fontFamily: "Manrope-Bold", color: "#282828", flex: 1, marginRight: 8 },
  convoTime: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#858585" },
  convoBottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  convoMessage: { flex: 1, fontSize: 14, fontFamily: "Outfit-Regular", color: "#858585", marginRight: 8 },
  unreadBadge: { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, backgroundColor: "#076B51", alignItems: "center", justifyContent: "center" },
  unreadText: { fontSize: 11, fontFamily: "Manrope-Bold", color: "#FFFFFF" },
});
