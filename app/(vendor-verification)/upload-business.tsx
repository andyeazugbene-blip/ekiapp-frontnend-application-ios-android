import React, { useEffect, useState } from "react";
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { uploadService } from "../../services/uploadService";
import { vendorService } from "../../services/vendorService";
import { useOnboardingStore } from "../../stores/onboardingStore";
import { useAuthStore } from "../../stores/authStore";

interface UploadState {
  localUri: string | null;
  remoteUrl: string | null;
  uploading: boolean;
  fileName?: string;
  isImage?: boolean;
}
const initialUpload: UploadState = { localUri: null, remoteUrl: null, uploading: false };

export default function UploadBusinessScreen() {
  const router = useRouter();
  const { businessInfo, setVerificationStatus } = useOnboardingStore();
  const authUser = useAuthStore((s) => s.user);
  const authRequiresBusinessDocument = authUser?.role === "vendor" && authUser.businessType === "registered";
  const [requiresBusinessDocument, setRequiresBusinessDocument] = useState(
    businessInfo.type === "registered" || authRequiresBusinessDocument,
  );

  const [doc, setDoc] = useState<UploadState>(initialUpload);
  const [selfie, setSelfie] = useState<UploadState>(initialUpload);
  const [submitting, setSubmitting] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [alreadyVerified, setAlreadyVerified] = useState(false);
  const [selfieAlreadySubmitted, setSelfieAlreadySubmitted] = useState(false);
  const [businessAlreadySubmitted, setBusinessAlreadySubmitted] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    Promise.all([
      vendorService.getMyProfile(),
      vendorService.getVerificationStatus().catch(() => null),
    ])
      .then(([profile, verification]) => {
        if (!mounted) return;
        const verified = profile.verificationStatus === "verified";
        const nextRequiresBusinessDocument = profile.businessType === "registered" || businessInfo.type === "registered";
        const docs = verification?.documents ?? [];
        const hasSubmitted = (type: string) =>
          docs.some((item: any) => item.type === type && item.status !== "REJECTED");

        setRequiresBusinessDocument(nextRequiresBusinessDocument);
        setSelfieAlreadySubmitted(hasSubmitted("SELFIE"));
        setBusinessAlreadySubmitted(hasSubmitted("BUSINESS_REGISTRATION"));
        setAlreadyVerified(verified);
        if (verified) setVerificationStatus("approved");
      })
      .catch(() => undefined)
      .finally(() => { if (mounted) setCheckingStatus(false); });
    return () => { mounted = false; };
  }, [businessInfo.type, setVerificationStatus]);

  const uploadPickedFile = async (
    setter: React.Dispatch<React.SetStateAction<UploadState>>,
    folder: string,
    fileUri: string,
    fileName: string,
    contentType: string,
    isImage: boolean,
  ) => {
    setter({ localUri: fileUri, remoteUrl: null, uploading: true, fileName, isImage });
    try {
      const remoteUrl = await uploadService.uploadImage(fileUri, fileName, contentType, folder);
      setter({ localUri: fileUri, remoteUrl, uploading: false, fileName, isImage });
    } catch (err) {
      setter(initialUpload);
      setError(err instanceof Error ? err.message : "Could not upload file.");
    }
  };

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
      setError(isSelfie ? "Camera access required." : "Photo library access required.");
      return;
    }
    const launcher = isSelfie
      ? ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.85, cameraType: ImagePicker.CameraType.front })
      : ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [16, 10], quality: 0.85 });
    const result = await launcher;
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    await uploadPickedFile(setter, folder, asset.uri, asset.fileName ?? `${folder}_${Date.now()}.jpg`, asset.mimeType ?? "image/jpeg", true);
  };

  const pickBusinessDocument = async () => {
    setError("");
    const result = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf", "image/jpeg", "image/png"],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    const contentType = asset.mimeType ?? "application/octet-stream";
    if (!["application/pdf", "image/jpeg", "image/png"].includes(contentType)) {
      setError("Upload PDF, JPG, or PNG.");
      return;
    }
    await uploadPickedFile(setDoc, "verification/business", asset.uri, asset.name ?? `business_${Date.now()}`, contentType, contentType.startsWith("image/"));
  };

  const canSubmit =
    (selfieAlreadySubmitted || !!selfie.remoteUrl) &&
    !selfie.uploading &&
    !doc.uploading &&
    (!requiresBusinessDocument || businessAlreadySubmitted || !!doc.remoteUrl);

  const onSubmit = async () => {
    if (!selfieAlreadySubmitted && !selfie.remoteUrl) { setError("Upload your selfie with ID."); return; }
    if (requiresBusinessDocument && !businessAlreadySubmitted && !doc.remoteUrl) { setError("Upload your business document."); return; }
    setSubmitting(true);
    setError("");
    try {
      if (!selfieAlreadySubmitted && selfie.remoteUrl) {
        await vendorService.submitVerificationDocument({ type: "selfie", fileUrl: selfie.remoteUrl });
      }
      if (requiresBusinessDocument && !businessAlreadySubmitted && doc.remoteUrl) {
        await vendorService.submitVerificationDocument({ type: "business", fileUrl: doc.remoteUrl });
      }
      await useAuthStore.getState().checkAuth().catch(() => null);
      setVerificationStatus("pending");
      router.replace("/(vendor-verification)/pending" as any);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit documents.");
    } finally {
      setSubmitting(false);
    }
  };

  if (checkingStatus) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <View style={styles.dashboardPeek}>
          <Text style={styles.peekTitle}>Get your first order</Text>
          <Text style={styles.peekSub}>Complete the steps below to start selling</Text>
        </View>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color="#076B51" />
        </View>
      </SafeAreaView>
    );
  }

  if (alreadyVerified) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <View style={styles.dashboardPeek}>
          <Text style={styles.peekTitle}>Get your first order</Text>
          <Text style={styles.peekSub}>Complete the steps below to start selling</Text>
        </View>
        <View style={styles.cardWrap}>
          <View style={styles.card}>
            <View style={styles.iconSquare}>
              <Ionicons name="checkmark-circle-outline" size={30} color="#076B51" />
            </View>
            <Text style={styles.title}>Already Verified</Text>
            <Text style={styles.body}>Your documents have already been approved.</Text>
            <TouchableOpacity style={styles.primaryButton} onPress={() => router.replace("/(vendor)" as any)} activeOpacity={0.85}>
              <Text style={styles.primaryButtonText}>Return to Dashboard</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.closeButton} onPress={() => router.replace("/(vendor)" as any)} activeOpacity={0.8}>
            <Ionicons name="close" size={20} color="#282828" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.dashboardPeek}>
        <TouchableOpacity
          accessibilityLabel="Go back"
          accessibilityRole="button"
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.8}
        >
          <Ionicons name="chevron-back" size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.peekTitle}>Get your first order</Text>
        <Text style={styles.peekSub}>Complete the steps below to start selling</Text>
      </View>

      <View style={styles.cardWrap}>
        <ScrollView
          style={{ width: "100%" }}
          contentContainerStyle={styles.cardScroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.card}>
            <Text style={styles.title}>
              {requiresBusinessDocument ? "Business Document" : "Selfie Verification"}
            </Text>
            <Text style={styles.subtitle}>
              {requiresBusinessDocument
                ? "Upload your business registration document"
                : "Take a selfie holding your ID to complete verification"}
            </Text>

            {requiresBusinessDocument && !businessAlreadySubmitted && (
              <>
                <Text style={styles.fieldLabel}>Business Registration Document</Text>
                <UploadZone
                  state={doc}
                  label="Upload Document"
                  icon="cloud-upload-outline"
                  onPick={pickBusinessDocument}
                />
              </>
            )}

            {!selfieAlreadySubmitted ? (
              <>
                <Text style={styles.fieldLabel}>
                  Selfie with ID <Text style={styles.fieldLabelHint}>(hold ID clearly visible)</Text>
                </Text>
                <UploadZone
                  state={selfie}
                  label="Take Selfie with ID"
                  icon="camera-outline"
                  onPick={() => pickAndUpload(setSelfie, "verification/selfie", true)}
                />
              </>
            ) : (
              <View style={styles.submittedNotice}>
                <Ionicons name="checkmark-circle-outline" size={18} color="#076B51" />
                <Text style={styles.submittedNoticeText}>Selfie already sent for submission.</Text>
              </View>
            )}

            {requiresBusinessDocument && businessAlreadySubmitted ? (
              <View style={styles.submittedNotice}>
                <Ionicons name="checkmark-circle-outline" size={18} color="#076B51" />
                <Text style={styles.submittedNoticeText}>Business document already sent for submission.</Text>
              </View>
            ) : null}

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.primaryButton, (!canSubmit || submitting) && styles.primaryButtonDisabled]}
              onPress={onSubmit}
              activeOpacity={0.8}
              disabled={!canSubmit || submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryButtonText}>Submit for Review</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>

        <TouchableOpacity style={styles.closeButton} onPress={() => router.replace("/(vendor)" as any)} activeOpacity={0.8}>
          <Ionicons name="close" size={20} color="#282828" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

interface UploadZoneProps {
  state: UploadState;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  onPick: () => void;
}
function UploadZone({ state, label, icon, onPick }: UploadZoneProps) {
  return (
    <TouchableOpacity
      onPress={onPick}
      activeOpacity={0.85}
      disabled={state.uploading}
      style={[styles.uploadZone, state.remoteUrl && styles.uploadZoneUploaded]}
    >
      {state.localUri && state.isImage !== false ? (
        <>
          <Image source={{ uri: state.localUri }} style={StyleSheet.absoluteFill as any} resizeMode="cover" />
          {state.uploading ? (
            <View style={styles.uploadOverlay}><ActivityIndicator color="#FFFFFF" /></View>
          ) : (
            <View style={styles.uploadedBadge}><Ionicons name="checkmark" size={12} color="#FFFFFF" /></View>
          )}
        </>
      ) : state.localUri ? (
        <View style={styles.uploadEmpty}>
          <View style={styles.uploadIconCircle}>
            <Ionicons name="document-attach-outline" size={22} color="#076B51" />
          </View>
          <Text style={styles.uploadLabel} numberOfLines={1}>{state.fileName ?? label}</Text>
          {state.uploading ? <ActivityIndicator size="small" color="#076B51" style={{ marginTop: 6 }} /> : null}
        </View>
      ) : (
        <View style={styles.uploadEmpty}>
          <View style={styles.uploadIconCircle}>
            <Ionicons name={icon} size={22} color="#076B51" />
          </View>
          <Text style={styles.uploadLabel}>{label}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#EBEBEB" },
  dashboardPeek: {
    backgroundColor: "#076B51",
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 28,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  peekTitle: { fontSize: 22, fontFamily: "Manrope-Bold", color: "#FFFFFF" },
  peekSub: { fontSize: 13, fontFamily: "Outfit-Regular", color: "rgba(255,255,255,0.75)", marginTop: 4 },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  cardWrap: { flex: 1, paddingHorizontal: 20, paddingTop: 16, alignItems: "center" },
  cardScroll: { width: "100%", alignItems: "center", paddingBottom: 20 },
  card: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 6,
  },
  iconSquare: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: "#E8F4ED",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    alignSelf: "center",
  },
  title: { fontSize: 20, fontFamily: "Manrope-Bold", color: "#1A1A1A", textAlign: "center", marginBottom: 8 },
  subtitle: { fontSize: 14, fontFamily: "Outfit-Regular", color: "#6F7478", textAlign: "center", lineHeight: 20, marginBottom: 20 },
  body: { fontSize: 14, fontFamily: "Outfit-Regular", color: "#6F7478", textAlign: "center", lineHeight: 22, marginBottom: 28 },
  fieldLabel: { fontSize: 13, fontFamily: "Outfit-Medium", color: "#858585", marginBottom: 8 },
  fieldLabelHint: { fontSize: 11, fontFamily: "Outfit-Regular", color: "#B0B0B0" },
  submittedNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#E8F4ED",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
  },
  submittedNoticeText: { flex: 1, fontSize: 13, fontFamily: "Outfit-Medium", color: "#076B51" },
  uploadZone: {
    height: 110,
    borderRadius: 16,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "#076B51",
    backgroundColor: "#EDF6F2",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
    overflow: "hidden",
  },
  uploadZoneUploaded: { borderStyle: "solid" },
  uploadEmpty: { alignItems: "center" },
  uploadIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(7,107,81,0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  uploadLabel: { fontSize: 13, fontFamily: "Outfit-Medium", color: "#076B51" },
  uploadOverlay: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center" },
  uploadedBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#076B51",
    alignItems: "center",
    justifyContent: "center",
  },
  errorText: { fontSize: 12, fontFamily: "Outfit-Regular", color: "#FB6363", marginBottom: 12, textAlign: "center" },
  primaryButton: { height: 52, borderRadius: 14, backgroundColor: "#076B51", alignItems: "center", justifyContent: "center", marginTop: 4 },
  primaryButtonDisabled: { opacity: 0.5 },
  primaryButtonText: { fontSize: 16, fontFamily: "Manrope-SemiBold", color: "#FFFFFF" },
  closeButton: {
    marginTop: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
});
