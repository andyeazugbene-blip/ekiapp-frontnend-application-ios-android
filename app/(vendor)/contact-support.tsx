import React, { useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { goBackOrReplace } from "../../utils/navigation";
import { useMessageStore } from "../../stores/messageStore";

/**
 * Client decision (2026-09-22): "Contact us" inside the app instead of
 * email, so a real admin reply reaches the buyer in-app too — see
 * messageStore.startSupportConversation() / messageService
 * .startSupportConversation() (backend: POST /api/conversations/support).
 * Sending here opens the SAME conversation thread every time (server-side
 * dedup, not a new ticket per message) — reuses the existing Messages ->
 * message-chat screens entirely for reading/continuing it afterward.
 */
export default function ContactSupportScreen() {
  const router = useRouter();
  const startSupportConversation = useMessageStore((s) => s.startSupportConversation);
  const setSelectedConversation = useMessageStore((s) => s.setSelectedConversation);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const canSend = message.trim().length > 0 && !sending;

  const handleSend = async () => {
    const text = message.trim();
    if (!text) return;
    setSending(true);
    try {
      const conversation = await startSupportConversation(text);
      setMessage("");
      await setSelectedConversation(conversation);
      router.replace("/(vendor)/message-chat" as any);
    } catch (err) {
      Alert.alert("Could not send", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => goBackOrReplace(router, "/(vendor)/messages" as any)} activeOpacity={0.85} accessibilityLabel="Go back" accessibilityRole="button" style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color="#282828" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Contact support</Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Message Eki support</Text>
          <Text style={styles.sectionBody}>
            Send a message and a real admin will reply here in the app — you do not need to email us. You'll get a notification the moment they reply, and the conversation stays saved under Messages.
          </Text>
          <View style={styles.textAreaWrap}>
            <TextInput
              value={message}
              onChangeText={setMessage}
              multiline
              textAlignVertical="top"
              placeholder="How can we help with your store, orders or payouts?"
              placeholderTextColor="#8A8F94"
              style={styles.textArea}
              accessibilityLabel="Your message to support"
            />
          </View>
        </View>

        <TouchableOpacity
          onPress={handleSend}
          activeOpacity={0.85}
          style={[styles.sendBtn, !canSend && styles.sendBtnDisabled]}
          disabled={!canSend}
          accessibilityRole="button"
          accessibilityLabel="Send message to support"
        >
          {sending ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <>
              <Ionicons name="chatbubble-ellipses-outline" size={16} color="#FFFFFF" />
              <Text style={styles.sendBtnText}>Send message</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push("/support" as any)} activeOpacity={0.85} style={styles.faqBtn}>
          <Text style={styles.faqBtnText}>Read Help &amp; Support FAQ instead</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FAF9F5" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 16, gap: 12 },
  backButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#F4F4F4", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 22, fontFamily: "Manrope-Bold", color: "#282828" },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40, gap: 16 },
  card: { backgroundColor: "#FFFFFF", borderRadius: 24, padding: 18 },
  sectionTitle: { fontSize: 18, fontFamily: "Manrope-Bold", color: "#282828", marginBottom: 10 },
  sectionBody: { fontSize: 14, lineHeight: 21, fontFamily: "Outfit-Regular", color: "#687076" },
  textAreaWrap: { backgroundColor: "#F6F7F7", borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10, marginTop: 14 },
  textArea: { minHeight: 140, fontSize: 14, lineHeight: 20, fontFamily: "Outfit-Regular", color: "#282828" },
  sendBtn: {
    height: 54,
    borderRadius: 16,
    backgroundColor: "#076B51",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  sendBtnDisabled: { opacity: 0.55 },
  sendBtnText: { fontSize: 15, fontFamily: "Manrope-Bold", color: "#FFFFFF" },
  faqBtn: {
    height: 54,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "#076B51",
    alignItems: "center",
    justifyContent: "center",
  },
  faqBtnText: { fontSize: 15, fontFamily: "Manrope-Bold", color: "#076B51" },
});
