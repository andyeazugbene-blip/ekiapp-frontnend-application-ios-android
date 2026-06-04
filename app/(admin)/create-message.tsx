import React, { useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { adminService, type AdminBroadcastAudience, type AdminBroadcastChannel } from "../../services/adminService";

const AUDIENCES = [
  { id: "all", label: "All Users" },
  { id: "vendors", label: "All Vendors" },
  { id: "buyers", label: "All Buyers" },
  { id: "active_vendors", label: "Active Vendors" },
  { id: "new_vendors", label: "New Vendors (< 7 days)" },
] satisfies { id: AdminBroadcastAudience; label: string }[];

const CHANNELS = [
  { id: "in_app_push", label: "In-app + push", icon: "notifications-outline" },
  { id: "push", label: "Push only", icon: "phone-portrait-outline" },
  { id: "in_app", label: "In-app only", icon: "mail-outline" },
] satisfies { id: AdminBroadcastChannel; label: string; icon: React.ComponentProps<typeof Ionicons>["name"] }[];

export default function CreateMessageScreen() {
  const router = useRouter();
  const [audience, setAudience] = useState<AdminBroadcastAudience>("all");
  const [channel, setChannel] = useState<AdminBroadcastChannel>("in_app_push");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!subject.trim() || !body.trim()) return;
    setSending(true);
    try {
      const result = await adminService.sendBroadcast({
        audience,
        channel,
        subject: subject.trim(),
        body: body.trim(),
      });
      Alert.alert(
        "Broadcast sent",
        result.message ?? `Message queued for ${result.sent ?? result.notified ?? result.queued ?? 0} recipients.`,
        [{ text: "OK", onPress: () => router.back() }],
      );
    } catch (err) {
      Alert.alert("Broadcast failed", err instanceof Error ? err.message : "Could not send this broadcast.");
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.85} style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Broadcast Composer</Text>
        <Text style={styles.headerSubtitle}>Send admin announcements, push alerts, and in-app notices</Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Audience</Text>
          <View style={styles.audienceList}>
            {AUDIENCES.map((entry) => (
              <TouchableOpacity
                key={entry.id}
                onPress={() => setAudience(entry.id)}
                activeOpacity={0.85}
                style={[styles.audienceItem, audience === entry.id && styles.audienceItemActive]}
              >
                <Text style={[styles.audienceText, audience === entry.id && styles.audienceTextActive]}>{entry.label}</Text>
                {audience === entry.id && <Ionicons name="checkmark" size={16} color="#076B51" />}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Delivery channel</Text>
          <View style={styles.channelGrid}>
            {CHANNELS.map((entry) => {
              const selected = channel === entry.id;
              return (
                <TouchableOpacity
                  key={entry.id}
                  onPress={() => setChannel(entry.id)}
                  activeOpacity={0.85}
                  style={[styles.channelItem, selected && styles.channelItemActive]}
                >
                  <Ionicons name={entry.icon} size={18} color={selected ? "#076B51" : "#858585"} />
                  <Text style={[styles.channelText, selected && styles.channelTextActive]}>{entry.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Message</Text>
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Subject</Text>
            <View style={styles.inputWrap}>
              <TextInput
                style={styles.input}
                placeholder="Message subject"
                placeholderTextColor="#858585"
                value={subject}
                onChangeText={setSubject}
              />
            </View>
          </View>
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Body</Text>
            <View style={[styles.inputWrap, styles.textAreaWrap]}>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Write your message..."
                placeholderTextColor="#858585"
                value={body}
                onChangeText={setBody}
                multiline
              />
            </View>
          </View>
        </View>

        <TouchableOpacity
          onPress={handleSend}
          activeOpacity={0.85}
          disabled={sending || !subject.trim() || !body.trim()}
          style={[styles.primaryButton, (sending || !subject.trim() || !body.trim()) && styles.primaryButtonDisabled]}
        >
          <Ionicons name={sending ? "hourglass-outline" : "send"} size={18} color="#FFFFFF" />
          <Text style={styles.primaryButtonText}>{sending ? "Sending..." : "Send Broadcast"}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F4F4F4" },
  header: { backgroundColor: "#076B51", paddingHorizontal: 20, paddingTop: 16, paddingBottom: 30, borderBottomLeftRadius: 35, borderBottomRightRadius: 35, gap: 4 },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center", marginBottom: 8 },
  headerTitle: { fontSize: 28, fontFamily: "Manrope-Bold", color: "#FFFFFF" },
  headerSubtitle: { fontSize: 14, fontFamily: "Outfit-Light", color: "rgba(255,255,255,0.8)" },
  scrollContent: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 40 },
  card: { backgroundColor: "#FFFFFF", borderRadius: 30, padding: 20, marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontFamily: "Manrope-Bold", color: "#282828", marginBottom: 14 },
  audienceList: { gap: 8 },
  audienceItem: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 14, borderRadius: 12, borderWidth: 1, borderColor: "#EEEEEE" },
  audienceItemActive: { borderColor: "#076B51", backgroundColor: "rgba(7,107,81,0.05)" },
  audienceText: { fontSize: 14, fontFamily: "Outfit-Medium", color: "#282828" },
  audienceTextActive: { fontFamily: "Manrope-Bold", color: "#076B51" },
  channelGrid: { gap: 10 },
  channelItem: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: "#EEEEEE", backgroundColor: "#FFFFFF" },
  channelItemActive: { borderColor: "#076B51", backgroundColor: "rgba(7,107,81,0.05)" },
  channelText: { fontSize: 14, fontFamily: "Outfit-Medium", color: "#282828" },
  channelTextActive: { fontFamily: "Manrope-Bold", color: "#076B51" },
  fieldGroup: { marginBottom: 16 },
  fieldLabel: { fontSize: 14, fontFamily: "Outfit-Medium", color: "#858585", marginBottom: 6 },
  inputWrap: { backgroundColor: "#F4F4F4", borderRadius: 10 },
  input: { height: 55, paddingHorizontal: 15, fontSize: 14, fontFamily: "Outfit-Regular", color: "#282828" },
  textAreaWrap: { height: 140 },
  textArea: { height: 130, textAlignVertical: "top", paddingTop: 14 },
  primaryButton: { height: 56, borderRadius: 14, backgroundColor: "#076B51", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  primaryButtonDisabled: { opacity: 0.5 },
  primaryButtonText: { fontSize: 16, fontFamily: "Manrope-SemiBold", color: "#FFFFFF" },
});
