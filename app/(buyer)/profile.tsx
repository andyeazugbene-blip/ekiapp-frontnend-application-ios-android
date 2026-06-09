import React, { useState } from "react";
import { ActivityIndicator, Alert, Image, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as ImagePicker from "expo-image-picker";
import { useAuthStore } from "../../stores/authStore";
import { uploadService } from "../../services/uploadService";
import { goBackOrReplace } from "../../utils/navigation";

interface MenuItem {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  action: "navigate" | "copy" | "external" | "alert";
  target?: string;
}

const SUPPORT_EMAIL = "adminandy@eki.app";
const HELP_URL = "https://culinarytales.app/support";

export default function ProfileScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const [copied, setCopied] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const handleLogout = async () => {
    await logout();
    router.replace("/(auth)/role-select" as any);
  };

  const handleCopyEmail = async () => {
    if (!user?.email) return;
    try {
      await Clipboard.setStringAsync(user.email);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  const handlePickAvatar = async () => {
    if (uploadingAvatar) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", "Allow photo access to update your avatar.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;

    setUploadingAvatar(true);
    try {
      const asset = result.assets[0];
      const contentType = asset.mimeType ?? "image/jpeg";
      const fileName = `buyer-avatar-${Date.now()}.${contentType.includes("png") ? "png" : "jpg"}`;
      const avatar = await uploadService.uploadImage(asset.uri, fileName, contentType, "avatar");
      await updateProfile({ avatar });
    } catch (err) {
      Alert.alert("Avatar not updated", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const items: MenuItem[] = [
    { icon: "receipt-outline", label: "My Orders", action: "navigate", target: "/(buyer)/orders" },
    { icon: "wallet-outline", label: "Wallet & Rewards", action: "navigate", target: "/(buyer)/wallet" },
    { icon: "chatbubble-ellipses-outline", label: "Messages", action: "navigate", target: "/(buyer)/messages" },
    { icon: "people-outline", label: "Refer a Friend", action: "navigate", target: "/(buyer)/referral-program" },
    { icon: "warning-outline", label: "Report an issue", action: "navigate", target: "/(buyer)/report-issue" },
    { icon: "mail-outline", label: "Email support", action: "external", target: `mailto:${SUPPORT_EMAIL}` },
    { icon: "help-circle-outline", label: "How Eki Works", action: "navigate", target: "/how-eki-works" },
    { icon: "shield-checkmark-outline", label: "Privacy Policy", action: "navigate", target: "/privacy" },
    { icon: "document-text-outline", label: "Terms of Service", action: "navigate", target: "/terms" },
    { icon: "chatbox-ellipses-outline", label: "Help & Support", action: "navigate", target: "/support" },
    { icon: "trash-outline", label: "Delete Account", action: "navigate", target: "/account-deletion" },
  ];

  const handleItemPress = async (item: MenuItem) => {
    if (item.action === "navigate" && item.target) {
      router.push(item.target as any);
      return;
    }
    if (item.action === "external" && item.target) {
      const can = await Linking.canOpenURL(item.target).catch(() => false);
      if (can) Linking.openURL(item.target).catch(() => {});
      else Alert.alert("Cannot open link", item.target);
      return;
    }
  };

  const initials = user?.name
    ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "?";

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => goBackOrReplace(router, "/(buyer)" as any)} activeOpacity={0.85} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color="#076B51" />
        </TouchableOpacity>
        <View style={styles.profileRow}>
          <TouchableOpacity onPress={handlePickAvatar} activeOpacity={0.85} style={styles.avatar}>
            {user?.avatar ? (
              <Image source={{ uri: user.avatar }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarText}>{initials}</Text>
            )}
            <View style={styles.avatarEdit}>
              {uploadingAvatar ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons name="camera-outline" size={13} color="#FFFFFF" />
              )}
            </View>
          </TouchableOpacity>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{user?.name ?? "User"}</Text>
            {user?.email ? (
              <TouchableOpacity onPress={handleCopyEmail} activeOpacity={0.7} style={styles.emailRow}>
                <Text style={styles.profileEmail} numberOfLines={1}>{user.email}</Text>
                <Ionicons name={copied ? "checkmark-outline" : "copy-outline"} size={14} color="rgba(255,255,255,0.7)" />
              </TouchableOpacity>
            ) : null}
            {copied ? <Text style={styles.copiedText}>Copied to clipboard</Text> : null}
          </View>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          {items.map((item, index) => (
            <TouchableOpacity
              key={item.label}
              onPress={() => handleItemPress(item)}
              activeOpacity={0.85}
              style={[styles.menuItem, index < items.length - 1 && styles.menuBorder]}
            >
              <View style={styles.menuIcon}>
                <Ionicons name={item.icon} size={20} color="#076B51" />
              </View>
              <Text style={styles.menuLabel}>{item.label}</Text>
              <Ionicons name="chevron-forward" size={18} color="#858585" />
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity onPress={handleLogout} activeOpacity={0.85} style={styles.logoutButton}>
          <Ionicons name="log-out-outline" size={20} color="#FB6363" />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>

        <Text style={styles.versionText}>Eki Marketplace · v1.0.1</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F4F4F4" },
  header: {
    backgroundColor: "#076B51",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 30,
    borderBottomLeftRadius: 35,
    borderBottomRightRadius: 35,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  profileRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: { width: "100%", height: "100%" },
  avatarEdit: {
    position: "absolute",
    right: -1,
    bottom: -1,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#1A2E24",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#076B51",
  },
  avatarText: { fontSize: 22, fontWeight: "700", color: "#FFFFFF" },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 20, fontFamily: "Manrope-Bold", color: "#FFFFFF" },
  emailRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  profileEmail: {
    fontSize: 14,
    fontFamily: "Outfit-Regular",
    color: "rgba(255,255,255,0.8)",
    maxWidth: 240,
  },
  copiedText: {
    fontSize: 11,
    fontFamily: "Outfit-Medium",
    color: "rgba(255,255,255,0.95)",
    marginTop: 2,
  },
  scrollContent: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 40 },
  card: { backgroundColor: "#FFFFFF", borderRadius: 24, padding: 8, marginBottom: 16 },
  menuItem: { flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 12 },
  menuBorder: { borderBottomWidth: 1, borderBottomColor: "#F4F4F4" },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(7,107,81,0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  menuLabel: { flex: 1, fontSize: 16, fontFamily: "Outfit-Medium", color: "#282828" },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 56,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    gap: 8,
    marginBottom: 16,
  },
  logoutText: { fontSize: 16, fontFamily: "Manrope-SemiBold", color: "#FB6363" },
  versionText: {
    fontSize: 12,
    fontFamily: "Outfit-Regular",
    color: "#A0A0A0",
    textAlign: "center",
    marginTop: 8,
  },
});
