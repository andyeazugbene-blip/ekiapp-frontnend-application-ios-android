import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Image, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { ChatMessage, useMessageStore } from "../../stores/messageStore";
import { uploadService } from "../../services/uploadService";
import { goBackOrReplace } from "../../utils/navigation";
import { RemoteImage } from "../../components/ui/RemoteImage";

function formatMessageTime(value: string): string {
  try {
    return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return value;
  }
}

export default function BuyerMessageChatScreen() {
  const router = useRouter();
  const { selectedConversation, messages, isLoading, isSending, sendMessage, stopPolling } = useMessageStore();
  const [input, setInput] = useState("");
  const [sendingImage, setSendingImage] = useState(false);
  const listRef = useRef<FlatList>(null);

  const conversation = selectedConversation;

  useEffect(() => {
    return () => { stopPolling(); };
  }, [stopPolling]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 120);
    }
  }, [messages.length]);

  if (!conversation) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.emptyPage}>
          <Text style={styles.emptyText}>No conversation selected.</Text>
          <TouchableOpacity onPress={() => goBackOrReplace(router, "/(buyer)/messages" as any)} activeOpacity={0.85} style={styles.emptyAction}>
            <Text style={styles.emptyActionText}>Back to messages</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const onSend = async () => {
    const text = input.trim();
    if (!text || isSending) return;
    try {
      await sendMessage(conversation.id, text);
      setInput("");
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (err) {
      Alert.alert("Message not sent", err instanceof Error ? err.message : "Please try again.");
    }
  };

  const pickAndSendImage = async () => {
    if (sendingImage || isSending) return;

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Photo access needed", "Photo library access is required to send an image.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.82,
    });

    if (result.canceled || !result.assets[0]?.uri) return;

    const asset = result.assets[0];
    const localUri = asset.uri;
    const fileName = asset.fileName ?? `chat-${Date.now()}.jpg`;
    const contentType = asset.mimeType ?? "image/jpeg";

    setSendingImage(true);
    try {
      const remoteImageUrl = await uploadService.uploadImage(localUri, fileName, contentType, "product");

      await sendMessage(conversation.id, {
        text: input.trim(),
        imageUrl: remoteImageUrl,
      });
      setInput("");
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 120);
    } catch (err) {
      Alert.alert("Image not sent", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setSendingImage(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => goBackOrReplace(router, "/(buyer)/messages" as any)} activeOpacity={0.85} style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color="#282828" />
        </TouchableOpacity>
        <RemoteImage
          uri={conversation.participantAvatar}
          style={styles.headerAvatar}
          borderRadius={22}
          fallbackIcon={conversation.participantRole === "vendor" ? "storefront-outline" : "person-outline"}
          fallbackBg="#F4F4F4"
        />
        <View style={styles.headerInfo}>
          <Text style={styles.headerName}>{conversation.participantName}</Text>
          <Text style={styles.headerSub}>{conversation.orderNumber ? `Order ${conversation.orderNumber}` : "Vendor"}</Text>
        </View>
      </View>

      <View style={styles.noticeBanner}>
        <Ionicons name="lock-closed-outline" size={14} color="#076B51" />
        <Text style={styles.noticeText}>Keep all communication on Eki for secure transactions</Text>
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
            renderItem={({ item }) => <Bubble message={item} avatarUri={conversation.participantAvatar} />}
            ListHeaderComponent={<View style={styles.dayLabel}><Text style={styles.dayLabelText}>Today</Text></View>}
            ListEmptyComponent={<Text style={styles.emptyChat}>Say hi to start the conversation.</Text>}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          />
        )}

        <View style={styles.inputBar}>
          <TouchableOpacity onPress={pickAndSendImage} activeOpacity={0.7} style={styles.inputAction}>
            {sendingImage ? <ActivityIndicator color="#076B51" size="small" /> : <Ionicons name="camera-outline" size={21} color="#282828" />}
          </TouchableOpacity>
          <View style={styles.inputWrap}>
            <TextInput value={input} onChangeText={setInput} placeholder="Type a message" placeholderTextColor="#858585" style={styles.textInput} multiline />
          </View>
          <TouchableOpacity
            onPress={onSend}
            activeOpacity={0.85}
            style={[styles.sendButton, (!input.trim() || isSending) && { opacity: 0.5 }]}
            disabled={!input.trim() || isSending}
          >
            <Ionicons name="send" size={16} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Bubble({ message, avatarUri }: { message: ChatMessage; avatarUri?: string }) {
  const isMine = message.senderRole === "buyer";
  return (
    <View style={[styles.bubbleRow, isMine ? styles.bubbleRowRight : styles.bubbleRowLeft]}>
      {!isMine && (
        <RemoteImage
          uri={avatarUri}
          style={styles.bubbleAvatar}
          borderRadius={16}
          fallbackIcon="storefront-outline"
          fallbackBg="#F4F4F4"
        />
      )}
      <View style={styles.bubbleContent}>
        <View style={[styles.bubble, isMine ? styles.bubbleRight : styles.bubbleLeft]}>
          {message.imageUrl ? <Image source={{ uri: message.imageUrl }} style={styles.messageImage} resizeMode="cover" /> : null}
          {message.text ? <Text style={[styles.bubbleText, message.imageUrl && styles.bubbleTextWithImage]}>{message.text}</Text> : null}
        </View>
        <Text style={[styles.bubbleTime, isMine && { textAlign: "right" }]}>{formatMessageTime(message.createdAt)}</Text>
      </View>
      {isMine && <View style={styles.bubbleAvatar}><View style={styles.bubbleAvatarInner} /></View>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  emptyPage: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingPage: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyText: { fontSize: 14, fontFamily: "Outfit-Regular", color: "#858585" },
  emptyAction: { marginTop: 14, minWidth: 150, height: 42, borderRadius: 12, backgroundColor: "#076B51", alignItems: "center", justifyContent: "center" },
  emptyActionText: { fontSize: 13, fontFamily: "Manrope-SemiBold", color: "#FFFFFF" },
  emptyChat: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#858585", textAlign: "center", paddingTop: 40 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#F0F0F0" },
  backButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#F4F4F4", alignItems: "center", justifyContent: "center", marginRight: 12 },
  headerAvatar: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: "#E0E0E0", alignItems: "center", justifyContent: "center", marginRight: 10 },
  headerAvatarInner: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#E8E8E8" },
  headerInfo: { flex: 1 },
  headerName: { fontSize: 16, fontFamily: "Manrope-Bold", color: "#282828" },
  headerSub: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#858585", marginTop: 2 },
  noticeBanner: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, backgroundColor: "#E8F4ED", marginHorizontal: 16, marginTop: 10, borderRadius: 10 },
  noticeText: { fontSize: 12, fontFamily: "Outfit-Medium", color: "#076B51" },
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
  bubbleRight: { backgroundColor: "#F4F4F4", borderBottomRightRadius: 4 },
  bubbleText: { fontSize: 14, fontFamily: "Outfit-Regular", color: "#282828", lineHeight: 20 },
  bubbleTextWithImage: { marginTop: 10 },
  messageImage: { width: 190, height: 190, borderRadius: 12, backgroundColor: "#E9EEEB" },
  bubbleTime: { fontSize: 10, fontFamily: "Outfit-Regular", color: "#B0B0B0", marginTop: 4, marginHorizontal: 4 },
  inputBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 10, gap: 8, borderTopWidth: 1, borderTopColor: "#F0F0F0" },
  inputAction: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  inputWrap: { flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: "#F4F4F4", borderRadius: 22, paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  textInput: { flex: 1, fontSize: 14, fontFamily: "Outfit-Regular", color: "#282828", maxHeight: 80 },
  sendButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#076B51", alignItems: "center", justifyContent: "center" },
});
