import React, { useState } from "react";
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { uploadService } from "../../services/uploadService";
import { vendorService } from "../../services/vendorService";
import { useOnboardingStore } from "../../stores/onboardingStore";
import { useAuthStore } from "../../stores/authStore";


const ACCEPTED_DOCS = [
  "Certificate of Incorporation",
  "Business Licence / Permit",
  "VAT Registration Certificate",
  "Sole Trader / Self-Employment Certificate",
];

interface UploadState {
  localUri: string | null;
  remoteUrl: string | null;
  uploading: boolean;
}
const initialUpload: UploadState = { localUri: null, remoteUrl: null, uploading: false };

export default function UploadBusinessScreen() {
  const router = useRouter();
  const { businessInfo, setVerificationStatus } = useOnboardingStore();
  const isRegistered = businessInfo.type === "registered";

  const [doc, setDoc] = useState<UploadState>(initialUpload);
  const [selfie, setSelfie] = useState<UploadState>(initialUpload);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const pickAndUpload = async (
    setter: React.Dispatch<React.SetStateAction<UploadState>>,
    folder: string,
    isSelfie = false
  ) => {
    setError("");
    const perm = isSelfie
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError(isSelfie ? "Camera access is required for the selfie." : "Photo library access is required.");
      return;
    }
    const launcher = isSelfie
      ? ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.85, cameraType: ImagePicker.CameraType.front })
      : ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [16, 10],
          quality: 0.85,
        });
    const result = await launcher;
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setter({ localUri: asset.uri, remoteUrl: null, uploading: true });
    try {
      const fileName = asset.fileName ?? `${folder}_${Date.now()}.jpg`;
      const contentType = asset.mimeType ?? "image/jpeg";
      const publicUrl = await uploadService.uploadImage(asset.uri, fileName, contentType, folder);
      setter({ localUri: asset.uri, remoteUrl: publicUrl, uploading: false });
    } catch (err) {
      setter({ localUri: null, remoteUrl: null, uploading: false });
      setError(err instanceof Error ? err.message : "Could not upload the image. Please try again.");
    }
  };

  const canSubmit =
    !!selfie.remoteUrl &&
    !selfie.uploading &&
    !doc.uploading &&
    (!isRegistered || !!doc.remoteUrl);

  const onSubmit = async () => {
    if (!selfie.remoteUrl) {
      setError("Please upload your selfie with ID.");
      return;
    }
    if (isRegistered && !doc.remoteUrl) {
      setError("Please upload your business document.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await vendorService.submitVerificationDocument({ type: "selfie", fileUrl: selfie.remoteUrl });
      if (isRegistered && doc.remoteUrl) {
        await vendorService.submitVerificationDocument({ type: "business", fileUrl: doc.remoteUrl });
      }
      await useAuthStore.getState().checkAuth().catch(() => null);
      setVerificationStatus("pending");
      router.replace("/(vendor-verification)/pending" as any);

    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit your documents.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <SafeAreaView edges={["top"]} style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{isRegistered ? "Business Document" : "Selfie Verification"}</Text>
          <Text style={styles.headerSubtitle}>
            {isRegistered ? "Upload your business registration document" : "Take a selfie holding your ID to complete verification"}
          </Text>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {isRegistered && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Accepted documents</Text>
            {ACCEPTED_DOCS.map((d, i) => (
              <View
                key={i}
                style={[styles.docRow, i < ACCEPTED_DOCS.length - 1 && styles.docRowBorder]}
              >
                <Ionicons name="document-outline" size={14} color="#076B51" />
                <Text style={styles.docText}>{d}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.card}>
          {isRegistered && (
            <>
              <Text style={styles.fieldLabel}>Business Registration Document</Text>
              <UploadArea
                state={doc}
                height={176}
                onPick={() => pickAndUpload(setDoc, "verification/business")}
                placeholderTitle="Tap to upload document"
                placeholderSubtitle="PDF, JPG, PNG up to 10MB"
                uploadedTitle="Document Uploaded"
                emptyIcon="cloud-upload-outline"
              />
            </>
          )}

          <Text style={styles.fieldLabel}>
            Selfie with ID <Text style={styles.fieldLabelHint}>(hold your ID clearly visible)</Text>
          </Text>
          <UploadArea
            state={selfie}
            height={isRegistered ? 144 : 208}
            onPick={() => pickAndUpload(setSelfie, "verification/selfie", true)}
            placeholderTitle="Take selfie with ID"
            placeholderSubtitle="Face the camera, hold your ID next to your face"
            uploadedTitle="Selfie Uploaded"
            emptyIcon="camera-outline"
          />

          <View style={styles.tipsCard}>
            <View style={styles.tipsHeader}>
              <Ionicons name="bulb-outline" size={14} color="#D97706" />
              <Text style={styles.tipsTitle}>Tips for a clear photo</Text>
            </View>
            <Text style={styles.tipsBody}>
              • Good lighting, no shadows on your face or ID{"\n"}
              • Both your face and ID text must be fully visible{"\n"}
              • Avoid blurry or tilted images
            </Text>
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.primaryButton, (!canSubmit || submitting) && styles.primaryButtonDisabled]}
            onPress={onSubmit}
            activeOpacity={0.8}
            disabled={!canSubmit || submitting}
          >
            <Text style={styles.primaryButtonText}>{submitting ? "Submitting..." : "Submit for Review"}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.securityBanner}>
          <Ionicons name="lock-closed-outline" size={16} color="#076B51" />
          <Text style={styles.securityText}>Documents encrypted with 256-bit AES. Reviewed by verified staff only.</Text>
        </View>
      </ScrollView>
    </View>
  );
}

interface UploadAreaProps {
  state: UploadState;
  height: number;
  onPick: () => void;
  placeholderTitle?: string;
  placeholderSubtitle?: string;
  uploadedTitle: string;
  emptyIcon: React.ComponentProps<typeof Ionicons>["name"];
}
function UploadArea({ state, height, onPick, placeholderTitle, placeholderSubtitle, uploadedTitle, emptyIcon }: UploadAreaProps) {
  return (
    <TouchableOpacity
      onPress={onPick}
      activeOpacity={0.85}
      disabled={state.uploading}
      style={[
        styles.uploadArea,
        { height },
        state.remoteUrl ? styles.uploadAreaUploaded : styles.uploadAreaEmpty,
      ]}
    >
      {state.localUri ? (
        <>
          <Image source={{ uri: state.localUri }} style={styles.uploadedImage} resizeMode="cover" />
          {state.uploading ? (
            <View style={styles.uploadOverlay}>
              <ActivityIndicator color="#FFFFFF" />
              <Text style={styles.uploadOverlayText}>Uploading...</Text>
            </View>
          ) : (
            <View style={styles.uploadedBadge}>
              <Ionicons name="checkmark" size={12} color="#FFFFFF" />
              <Text style={styles.uploadedBadgeText}>{uploadedTitle}</Text>
            </View>
          )}
        </>
      ) : (
        <View style={styles.uploadEmpty}>
          <View style={styles.uploadIconCircleEmpty}>
            <Ionicons name={emptyIcon} size={28} color="#858585" />
          </View>
          {placeholderTitle ? <Text style={styles.uploadEmptyTitle}>{placeholderTitle}</Text> : null}
          {placeholderSubtitle ? (
            <Text style={[styles.uploadEmptySubtitle, { textAlign: "center", paddingHorizontal: 16 }]}>
              {placeholderSubtitle}
            </Text>
          ) : null}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F4F4F4" },
  safeArea: { backgroundColor: "#076B51" },
  header: {
    backgroundColor: "#076B51",
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 32,
    borderBottomLeftRadius: 35,
    borderBottomRightRadius: 35,
  },
  backButton: {
    width: 40,
    height: 40,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  headerTitle: { fontSize: 30, fontFamily: "Manrope-Bold", color: "#FFFFFF" },
  headerSubtitle: { fontSize: 16, fontFamily: "Outfit-Light", color: "#FFFFFF", marginTop: 4 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 28, paddingBottom: 40 },
  card: { backgroundColor: "#FFFFFF", borderRadius: 30, padding: 20, marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontFamily: "Manrope-Bold", color: "#282828", marginBottom: 12 },
  docRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10 },
  docRowBorder: { borderBottomWidth: 1, borderBottomColor: "#F0F0F0" },
  docText: { fontSize: 13, fontFamily: "Outfit-Regular", color: "#282828", marginLeft: 10 },
  fieldLabel: { fontSize: 14, fontFamily: "Outfit-Medium", color: "#858585", marginBottom: 10 },
  fieldLabelHint: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#B0B0B0" },
  uploadArea: {
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderStyle: "dashed",
    marginBottom: 20,
    overflow: "hidden",
  },
  uploadAreaUploaded: { borderColor: "#076B51", backgroundColor: "#E8F4ED" },
  uploadAreaEmpty: { borderColor: "#D0D0D0", backgroundColor: "#F9F9F9" },
  uploadedImage: { ...StyleSheet.absoluteFillObject, width: "100%", height: "100%" },
  uploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  uploadOverlayText: { fontSize: 12, color: "#FFFFFF", fontFamily: "Outfit-Medium" },
  uploadedBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(7,107,81,0.85)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  uploadedBadgeText: { fontSize: 11, color: "#FFFFFF", fontFamily: "Outfit-Medium" },
  uploadEmpty: { alignItems: "center" },
  uploadIconCircleEmpty: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#E8E8E8",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  uploadEmptyTitle: { fontSize: 14, fontFamily: "Outfit-Medium", color: "#858585" },
  uploadEmptySubtitle: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#B0B0B0", marginTop: 4 },
  tipsCard: { backgroundColor: "#FFF8E8", borderWidth: 1, borderColor: "#FFE8B0", borderRadius: 12, padding: 12, marginBottom: 20 },
  tipsHeader: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  tipsTitle: { fontSize: 12, fontFamily: "Outfit-Medium", color: "#D97706", marginLeft: 6 },
  tipsBody: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#B8860B", lineHeight: 18 },
  errorText: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#FB6363", marginBottom: 12 },
  primaryButton: { height: 56, borderRadius: 14, backgroundColor: "#076B51", alignItems: "center", justifyContent: "center" },
  primaryButtonDisabled: { opacity: 0.5 },
  primaryButtonText: { fontSize: 16, fontFamily: "Manrope-SemiBold", color: "#FFFFFF" },
  securityBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E8F4ED",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  securityText: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#2E6957", marginLeft: 10, flex: 1, lineHeight: 18 },
});
