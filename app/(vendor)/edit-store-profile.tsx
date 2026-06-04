import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { vendorService } from "../../services/vendorService";
import { uploadService } from "../../services/uploadService";
import { useAuthStore } from "../../stores/authStore";
import type { VendorProfile } from "../../types/auth";

export default function EditStoreProfileScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user) as VendorProfile | null;
  const checkAuth = useAuthStore((state) => state.checkAuth);

  const [storeName, setStoreName] = useState(user?.storeName ?? "");
  const [description, setDescription] = useState(user?.storeDescription ?? "");
  const [city, setCity] = useState(user?.city ?? "");
  const [country, setCountry] = useState(user?.country ?? "");
  const [avatar, setAvatar] = useState(user?.avatar ?? "");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setStoreName(user?.storeName ?? "");
    setDescription(user?.storeDescription ?? "");
    setCity(user?.city ?? "");
    setCountry(user?.country ?? "");
    setAvatar(user?.avatar ?? "");
  }, [user]);

  const handlePickAvatar = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", "Allow photo access to update your store avatar.");
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
    setError("");
    try {
      const asset = result.assets[0];
      const contentType = asset.mimeType ?? "image/jpeg";
      const fileName = `store-avatar-${Date.now()}.${contentType.includes("png") ? "png" : "jpg"}`;
      setAvatar(await uploadService.uploadImage(asset.uri, fileName, contentType, "avatar"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upload your store avatar.");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSave = async () => {
    if (!storeName.trim()) {
      setError("Store name is required.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      await vendorService.updateMyProfile({
        storeName: storeName.trim(),
        description: description.trim(),
        city: city.trim(),
        country: country.trim(),
        avatar: avatar || null,
      } as any);
      await checkAuth().catch(() => undefined);
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update your store profile.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.85} style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color="#282828" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Edit Store Profile</Text>
          <Text style={styles.headerSubtitle}>Update how your store appears to buyers before they open your public link.</Text>
        </View>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <View style={styles.avatarSection}>
              <TouchableOpacity onPress={handlePickAvatar} activeOpacity={0.85} style={styles.avatarButton}>
                {avatar ? (
                  <Image source={{ uri: avatar }} style={styles.avatarImage} />
                ) : (
                  <Ionicons name="storefront-outline" size={28} color="#076B51" />
                )}
                <View style={styles.avatarBadge}>
                  {uploadingAvatar ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Ionicons name="camera-outline" size={14} color="#FFFFFF" />}
                </View>
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <Text style={styles.avatarTitle}>Store avatar</Text>
                <Text style={styles.avatarCopy}>Shown on your store, products, and buyer messages.</Text>
              </View>
            </View>
            <Field label="Store name" value={storeName} onChangeText={setStoreName} placeholder="Queen African Foods" />
            <Field
              label="Store description"
              value={description}
              onChangeText={setDescription}
              placeholder="Tell buyers what makes your store special."
              multiline
            />
            <Field label="City" value={city} onChangeText={setCity} placeholder="Birmingham" />
            <Field label="Country" value={country} onChangeText={setCountry} placeholder="United Kingdom" />

            <View style={styles.notice}>
              <Ionicons name="information-circle-outline" size={16} color="#076B51" />
              <Text style={styles.noticeText}>
                Buyers see this profile on your public store page, product page, and shareable checkout flow.
              </Text>
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}
          </View>

          <TouchableOpacity onPress={handleSave} activeOpacity={0.85} disabled={saving} style={[styles.primaryButton, saving && styles.buttonDisabled]}>
            {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>Save Changes</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

interface FieldProps {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
}

function Field({ label, value, onChangeText, placeholder, multiline }: FieldProps) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#8A8F94"
        multiline={multiline}
        textAlignVertical={multiline ? "top" : "center"}
        style={[styles.input, multiline && styles.inputMultiline]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F4F4F4" },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 14 },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 24, fontFamily: "Manrope-Bold", color: "#282828" },
  headerSubtitle: { fontSize: 13, lineHeight: 18, fontFamily: "Outfit-Regular", color: "#687076", marginTop: 4 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 40 },
  card: { backgroundColor: "#FFFFFF", borderRadius: 24, padding: 18, marginBottom: 16 },
  avatarSection: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 18 },
  avatarButton: { width: 72, height: 72, borderRadius: 36, backgroundColor: "#EAF5F0", alignItems: "center", justifyContent: "center" },
  avatarImage: { width: "100%", height: "100%", borderRadius: 36 },
  avatarBadge: { position: "absolute", right: 0, bottom: 0, width: 25, height: 25, borderRadius: 13, backgroundColor: "#076B51", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#FFFFFF" },
  avatarTitle: { fontSize: 15, fontFamily: "Manrope-Bold", color: "#282828" },
  avatarCopy: { fontSize: 12, lineHeight: 17, fontFamily: "Outfit-Regular", color: "#687076", marginTop: 3 },
  fieldGroup: { marginBottom: 14 },
  fieldLabel: { fontSize: 13, fontFamily: "Outfit-Medium", color: "#687076", marginBottom: 6 },
  input: { minHeight: 52, borderRadius: 14, backgroundColor: "#F6F7F7", paddingHorizontal: 14, fontSize: 14, fontFamily: "Outfit-Regular", color: "#282828" },
  inputMultiline: { minHeight: 120, paddingTop: 12, paddingBottom: 12 },
  notice: { flexDirection: "row", alignItems: "flex-start", gap: 10, backgroundColor: "#EAF5F0", borderRadius: 16, padding: 14, marginTop: 4 },
  noticeText: { flex: 1, fontSize: 12, lineHeight: 18, fontFamily: "Outfit-Regular", color: "#24564A" },
  errorText: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#FB6363", marginTop: 12 },
  primaryButton: { height: 56, borderRadius: 14, backgroundColor: "#076B51", alignItems: "center", justifyContent: "center" },
  primaryButtonText: { fontSize: 16, fontFamily: "Manrope-SemiBold", color: "#FFFFFF" },
  buttonDisabled: { opacity: 0.65 },
});
