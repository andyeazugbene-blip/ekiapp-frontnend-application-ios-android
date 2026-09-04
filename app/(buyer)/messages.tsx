import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useMessageStore, type Conversation } from "../../stores/messageStore";
import { RemoteImage } from "../../components/ui/RemoteImage";
import { goBackOrReplace } from "../../utils/navigation";

export default function BuyerMessagesScreen() {
  const router = useRouter();
  const { conversationId: deepLinkConversationId } = useLocalSearchParams<{ conversationId?: string }>();
  const { conversations: rawConversations, isLoading, loadConversations, setSelectedConversation } = useMessageStore();
  const conversations = rawConversations ?? [];
  const [activeTab, setActiveTab] = useState<"vendor" | "order">("vendor");

  const filteredConversations = useMemo(
    () => conversations.filter((conversation) => (activeTab === "order" ? Boolean(conversation.orderId) : !conversation.orderId)),
    [activeTab, conversations],
  );
  const vendorConversationCount = useMemo(() => conversations.filter((conversation) => !conversation.orderId).length, [conversations]);
  const orderConversationCount = useMemo(() => conversations.filter((conversation) => Boolean(conversation.orderId)).length, [conversations]);

  useFocusEffect(
    useCallback(() => {
      loadConversations();
    }, [loadConversations])
  );

  const openConversation = (convo: Conversation) => {
    setSelectedConversation(convo);
    router.push("/(buyer)/message-chat" as any);
  };

  // Opened via a "new message" push notification tap — jump straight into
  // that thread once the conversation list has loaded, instead of leaving
  // the recipient to find it themselves.
  //
  // The `conversationId` route param never clears itself, and this list
  // reloads on every focus (below) — including the focus that happens when
  // the user presses Back OUT of the thread this effect just opened. Without
  // a latch, `conversations` gets a new array identity on every reload, the
  // effect re-fires, and it force-navigates back into the thread — Back
  // becomes permanently non-functional and the nav stack grows without
  // bound. The ref latches per conversationId so this only ever fires once
  // for a given deep link, not once per list refresh.
  const openedDeepLinkRef = useRef<string | null>(null);
  useEffect(() => {
    if (!deepLinkConversationId || openedDeepLinkRef.current === deepLinkConversationId) return;
    const target = conversations.find((c) => c.id === deepLinkConversationId);
    if (target) {
      openedDeepLinkRef.current = deepLinkConversationId;
      openConversation(target);
    }
  }, [deepLinkConversationId, conversations]);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => goBackOrReplace(router, "/(buyer)" as any)} activeOpacity={0.85} style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color="#282828" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Messages</Text>
      </View>

      <View style={styles.segmentWrap}>
        <TouchableOpacity
          onPress={() => setActiveTab("vendor")}
          activeOpacity={0.86}
          style={activeTab === "vendor" ? styles.segmentActive : styles.segmentInactive}
        >
          <Text style={activeTab === "vendor" ? styles.segmentActiveText : styles.segmentInactiveText}>Vendor messages ({vendorConversationCount})</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setActiveTab("order")}
          activeOpacity={0.86}
          style={activeTab === "order" ? styles.segmentActive : styles.segmentInactive}
        >
          <Text style={activeTab === "order" ? styles.segmentActiveText : styles.segmentInactiveText}>Order messages ({orderConversationCount})</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {isLoading && filteredConversations.length === 0 ? (
          <View style={styles.placeholder}>
            <ActivityIndicator color="#076B51" />
          </View>
        ) : filteredConversations.length === 0 ? (
          <Text style={styles.emptyText}>
            {activeTab === "order"
              ? "No order messages yet. Order conversations will appear here once a vendor starts chatting on an order."
              : "No vendor messages yet. Reach out to a vendor from any store or product page."}
          </Text>
        ) : (
          filteredConversations.map((convo) => (
            <TouchableOpacity
              key={convo.id}
              onPress={() => openConversation(convo)}
              activeOpacity={0.85}
              style={styles.convoItem}
            >
              <RemoteImage
                uri={convo.participantAvatar}
                style={styles.avatar}
                borderRadius={28}
                fallbackIcon={convo.participantRole === "vendor" ? "storefront-outline" : "person-outline"}
                fallbackBg="#F3F5F4"
              />
              <View style={styles.convoContent}>
                <Text style={styles.convoName} numberOfLines={1}>{convo.participantName}</Text>
                <View style={[styles.messageTypePill, convo.orderId ? styles.orderTypePill : styles.vendorTypePill]}>
                  <Text style={[styles.messageTypeText, convo.orderId ? styles.orderTypeText : styles.vendorTypeText]}>
                    {convo.orderNumber ? `Order ${convo.orderNumber}` : convo.orderId ? "Order chat" : "Vendor chat"}
                  </Text>
                </View>
                <Text style={styles.convoMessage} numberOfLines={1}>
                  {convo.lastMessage || "No messages yet"}
                </Text>
              </View>
              <View style={styles.convoRight}>
                <Text style={styles.convoTime}>{formatConversationTime(convo.lastMessageAt)}</Text>
                {convo.unreadCount > 0 && (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadText}>{convo.unreadCount}</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function formatConversationTime(value: string) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return value;
  return new Date(parsed).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 16, gap: 12 },
  backButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#F4F4F4", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 22, fontFamily: "Manrope-Bold", color: "#282828" },
  segmentWrap: { flexDirection: "row", gap: 10, paddingHorizontal: 16, paddingBottom: 14 },
  segmentActive: { flex: 1, height: 52, borderRadius: 26, backgroundColor: "#076B51", alignItems: "center", justifyContent: "center" },
  segmentInactive: { flex: 1, height: 52, borderRadius: 26, backgroundColor: "#F4F4F4", alignItems: "center", justifyContent: "center" },
  segmentActiveText: { fontSize: 15, fontFamily: "Manrope-SemiBold", color: "#FFFFFF" },
  segmentInactiveText: { fontSize: 15, fontFamily: "Manrope-SemiBold", color: "#282828" },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 100 },
  placeholder: { paddingVertical: 40, alignItems: "center" },
  emptyText: { fontSize: 14, fontFamily: "Outfit-Regular", color: "#858585", textAlign: "center", paddingVertical: 40 },
  convoItem: { flexDirection: "row", alignItems: "center", paddingVertical: 16, paddingHorizontal: 16, borderRadius: 24, marginBottom: 12, backgroundColor: "#FFFFFF" },
  avatar: { width: 56, height: 56, borderRadius: 28, marginRight: 14 },
  convoContent: { flex: 1 },
  convoName: { fontSize: 15, fontFamily: "Manrope-Bold", color: "#282828" },
  messageTypePill: { alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, marginTop: 5 },
  vendorTypePill: { backgroundColor: "#EEF8F3" },
  orderTypePill: { backgroundColor: "#FFF6E7" },
  messageTypeText: { fontSize: 10, fontFamily: "Outfit-Medium" },
  vendorTypeText: { color: "#076B51" },
  orderTypeText: { color: "#A05A00" },
  convoMessage: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#858585", marginTop: 3 },
  orderMeta: { fontSize: 11, fontFamily: "Outfit-Medium", color: "#076B51", marginTop: 4 },
  convoRight: { alignItems: "flex-end", gap: 4 },
  convoTime: { fontSize: 11, fontFamily: "Outfit-Regular", color: "#858585" },
  unreadBadge: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, backgroundColor: "#076B51", alignItems: "center", justifyContent: "center" },
  unreadText: { fontSize: 11, fontFamily: "Manrope-Bold", color: "#FFFFFF" },
});
