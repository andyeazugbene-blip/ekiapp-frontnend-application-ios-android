import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ChatMessage, useMessageStore } from "../../stores/messageStore";

export default function AdminMessageChatScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const {
    conversations,
    selectedConversation,
    messages,
    isLoading,
    isSending,
    loadConversations,
    selectConversation,
    sendMessage,
    stopPolling,
  } = useMessageStore();
  const [input, setInput] = useState("");
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    let active = true;

    const bootstrapConversation = async () => {
      if (!id || selectedConversation?.id === id) return;

      let availableConversations = conversations;
      if (availableConversations.length === 0) {
        await loadConversations();
        availableConversations = useMessageStore.getState().conversations;
      }

      const match = availableConversations.find((conversation) => conversation.id === id);
      if (match && active) {
        await selectConversation(match);
      }
    };

    bootstrapConversation().catch(() => {});

    return () => {
      active = false;
    };
  }, [conversations, id, loadConversations, selectConversation, selectedConversation?.id]);

  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 120);
    }
  }, [messages.length]);

  const conversation = selectedConversation;

  const onSend = () => {
    const text = input.trim();
    if (!text || !conversation || isSending) return;
    sendMessage(conversation.id, text);
    setInput("");
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const showAttachmentUnavailable = () => {
    Alert.alert("Attachments unavailable", "Only text messages are available in this build.");
  };

  if (!conversation) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.emptyPage}>
          {isLoading ? (
            <ActivityIndicator color="#076B51" />
          ) : (
            <>
              <Text style={styles.emptyTitle}>Conversation unavailable</Text>
              <Text style={styles.emptyText}>This admin chat could not be loaded from the backend.</Text>
              <TouchableOpacity onPress={() => router.back()} activeOpacity={0.85} style={styles.backToListButton}>
                <Text style={styles.backToListText}>Back to Messages</Text>
              </TouchableOpacity>
            </>
          )}
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
        <View style={styles.headerAvatar}>
          <Text style={styles.headerAvatarText}>{conversation.participantName.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.headerName} numberOfLines={1}>{conversation.participantName}</Text>
          <Text style={styles.headerSub}>
            {conversation.orderNumber ? `Order ${conversation.orderNumber}` : "Marketplace conversation"}
          </Text>
        </View>
      </View>

      <View style={styles.noticeBanner}>
        <Ionicons name="shield-checkmark-outline" size={14} color="#076B51" />
        <Text style={styles.noticeText}>Admin messages are auditable and synced from the backend conversation log.</Text>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        {isLoading && messages.length === 0 ? (
          <View style={styles.loadingPage}>
            <ActivityIndicator color="#076B51" />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.messageList}
            renderItem={({ item }) => <Bubble message={item} />}
            ListHeaderComponent={<View style={styles.dayLabel}><Text style={styles.dayLabelText}>Today</Text></View>}
            ListEmptyComponent={<Text style={styles.emptyChat}>No messages yet for this conversation.</Text>}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          />
        )}

        <View style={styles.inputBar}>
          <TouchableOpacity onPress={showAttachmentUnavailable} activeOpacity={0.7} style={styles.inputAction}>
            <Ionicons name="add" size={22} color="#282828" />
          </TouchableOpacity>
          <View style={styles.inputWrap}>
            <Ionicons name="create-outline" size={18} color="#858585" />
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="Type admin reply"
              placeholderTextColor="#858585"
              style={styles.textInput}
              multiline
            />
          </View>
          <TouchableOpacity
            onPress={onSend}
            activeOpacity={0.85}
            style={[styles.sendButton, (!input.trim() || isSending) && styles.sendButtonDisabled]}
            disabled={!input.trim() || isSending}
          >
            <Ionicons name="send" size={16} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Bubble({ message }: { message: ChatMessage }) {
  const isMine = message.senderRole === "admin";

  return (
    <View style={[styles.bubbleRow, isMine ? styles.bubbleRowRight : styles.bubbleRowLeft]}>
      {!isMine && <View style={styles.bubbleAvatar}><View style={styles.bubbleAvatarInner} /></View>}
      <View style={styles.bubbleContent}>
        <View style={[styles.bubble, isMine ? styles.bubbleRight : styles.bubbleLeft]}>
          <Text style={styles.bubbleText}>{message.text}</Text>
        </View>
        <Text style={[styles.bubbleTime, isMine && { textAlign: "right" }]}>{message.createdAt}</Text>
      </View>
      {isMine && <View style={styles.bubbleAvatar}><View style={styles.bubbleAvatarInner} /></View>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  loadingPage: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyPage: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
  emptyTitle: { fontSize: 18, fontFamily: "Manrope-Bold", color: "#282828" },
  emptyText: { fontSize: 14, fontFamily: "Outfit-Regular", color: "#858585", textAlign: "center", marginTop: 8 },
  backToListButton: { marginTop: 18, height: 46, borderRadius: 14, paddingHorizontal: 18, backgroundColor: "#076B51", alignItems: "center", justifyContent: "center" },
  backToListText: { fontSize: 14, fontFamily: "Manrope-SemiBold", color: "#FFFFFF" },
  emptyChat: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#858585", textAlign: "center", paddingTop: 40 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#F0F0F0" },
  backButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#F4F4F4", alignItems: "center", justifyContent: "center", marginRight: 12 },
  headerAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(7,107,81,0.1)", alignItems: "center", justifyContent: "center", marginRight: 10 },
  headerAvatarText: { fontSize: 16, fontFamily: "Manrope-Bold", color: "#076B51" },
  headerInfo: { flex: 1 },
  headerName: { fontSize: 16, fontFamily: "Manrope-Bold", color: "#282828" },
  headerSub: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#858585", marginTop: 2 },
  noticeBanner: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, backgroundColor: "#E8F4ED", marginHorizontal: 16, marginTop: 10, borderRadius: 10 },
  noticeText: { fontSize: 12, fontFamily: "Outfit-Medium", color: "#076B51", textAlign: "center", flexShrink: 1 },
  messageList: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  dayLabel: { alignItems: "center", marginBottom: 16 },
  dayLabelText: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#858585" },
  bubbleRow: { flexDirection: "row", alignItems: "flex-end", marginBottom: 14, gap: 8 },
  bubbleRowLeft: { justifyContent: "flex-start" },
  bubbleRowRight: { justifyContent: "flex-end" },
  bubbleAvatar: { width: 32, height: 32, borderRadius: 16, borderWidth: 1.5, borderColor: "#E0E0E0", alignItems: "center", justifyContent: "center" },
  bubbleAvatarInner: { width: 26, height: 26, borderRadius: 13, backgroundColor: "#E8E8E8" },
  bubbleContent: { maxWidth: "72%" },
  bubble: { borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleLeft: { backgroundColor: "#F4F4F4", borderBottomLeftRadius: 4 },
  bubbleRight: { backgroundColor: "#E8F4ED", borderBottomRightRadius: 4 },
  bubbleText: { fontSize: 14, fontFamily: "Outfit-Regular", color: "#282828", lineHeight: 20 },
  bubbleTime: { fontSize: 10, fontFamily: "Outfit-Regular", color: "#B0B0B0", marginTop: 4, marginHorizontal: 4 },
  inputBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 10, gap: 8, borderTopWidth: 1, borderTopColor: "#F0F0F0" },
  inputAction: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  inputWrap: { flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: "#F4F4F4", borderRadius: 22, paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  textInput: { flex: 1, fontSize: 14, fontFamily: "Outfit-Regular", color: "#282828", maxHeight: 80 },
  sendButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#076B51", alignItems: "center", justifyContent: "center" },
  sendButtonDisabled: { opacity: 0.5 },
});
