import React, { useState } from "react";
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { uploadService } from "../../services/uploadService";
import { vendorService } from "../../services/vendorService";

const ID_TYPES = [
  { id: "passport", label: "Passport", icon: "book-outline" as const },
  { id: "drivers", label: "Driver's Licence", icon: "car-outline" as const },
  { id: "national", label: "National ID", icon: "card-outline" as const },
];

type IdSubtype = "passport" | "drivers" | "national";

interface UploadState {
  localUri: string | null;
  remoteUrl: string | null;
  uploading: boolean;
}

const initialUpload: UploadState = { localUri: null, remoteUrl: null, uploading: false };

export default function UploadIdScreen() {
  const router = useRouter();
  const [selectedType, setSelectedType] = useState<IdSubtype | null>(null);
  const [front, setFront] = useState<UploadState>(initialUpload);
  const [back, setBack] = useState<UploadState>(initialUpload);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const pickAndUpload = async (
    setter: React.Dispatch<React.SetStateAction<UploadState>>,
    folder = "verification"
  ) => {
    setError("");
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError("Photo library access is required to upload your ID.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 10],
      quality: 0.85,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setter({ localUri: asset.uri, remoteUrl: null, uploading: true });
    try {
      const fileName = asset.fileName ?? `id_${Date.now()}.jpg`;
      const contentType = asset.mimeType ?? "image/jpeg";
      const publicUrl = await uploadService.uploadImage(asset.uri, fileName, contentType, folder);
      setter({ localUri: asset.uri, remoteUrl: publicUrl, uploading: false });
    } catch (err) {
      setter({ localUri: null, remoteUrl: null, uploading: false });
      setError(err instanceof Error ? err.message : "Could not upload the image. Please try again.");
    }
  };

  const canContinue =
    selectedType !== null &&
    !!front.remoteUrl &&
    !front.uploading &&
    !back.uploading;

  const onContinue = async () => {
    if (!selectedType) {
      setError("Please select your ID type.");
      return;
    }
    if (!front.remoteUrl) {
      setError("Please upload the front of your ID.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await vendorService.submitVerificationDocument({
        type: "id",
        fileUrl: front.remoteUrl,
        backUrl: back.remoteUrl ?? undefined,
        idSubtype: selectedType,
      });
      router.push("/(vendor-verification)/upload-business" as any);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit your document.");
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
          <Text style={styles.headerTitle}>Upload your ID</Text>
          <Text style={styles.headerSubtitle}>Government-issued photo ID required</Text>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          <Text style={styles.fieldLabel}>Select ID type</Text>
          <View style={styles.idTypeRow}>
            {ID_TYPES.map((type) => {
              const selected = selectedType === type.id;
              return (
                <TouchableOpacity
                  key={type.id}
                  onPress={() => { setSelectedType(type.id as IdSubtype); setError(""); }}
                  activeOpacity={0.8}
                  style={[
                    styles.idTypeItem,
                    selected ? styles.idTypeItemSelected : styles.idTypeItemDefault,
                  ]}
                >
                  <Ionicons name={type.icon} size={22} color={selected ? "#076B51" : "#858585"} />
                  <Text
                    style={[styles.idTypeLabel, selected && styles.idTypeLabelSelected]}
                    numberOfLines={2}
                  >
                    {type.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Front upload */}
          <Text style={styles.fieldLabel}>Front of ID</Text>
          <UploadArea
            state={front}
            height={160}
            onPick={() => pickAndUpload(setFront, "verification/id-front")}
            placeholderTitle="Tap to upload front"
            placeholderSubtitle="JPG, PNG up to 10MB"
            uploadedTitle="ID Front Uploaded"
          />

          {/* Back upload (skipped for passport) */}
          {selectedType !== "passport" && (
            <>
              <Text style={styles.fieldLabel}>
                Back of ID <Text style={styles.fieldLabelOptional}>(if applicable)</Text>
              </Text>
              <UploadArea
                state={back}
                height={128}
                onPick={() => pickAndUpload(setBack, "verification/id-back")}
                placeholderSubtitle="Tap to upload back"
                uploadedTitle="Back Uploaded"
              />
            </>
          )}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.primaryButton, (!canContinue || submitting) && styles.primaryButtonDisabled]}
            onPress={onContinue}
            activeOpacity={0.8}
            disabled={!canContinue || submitting}
          >
            <Text style={styles.primaryButtonText}>{submitting ? "Submitting..." : "Continue"}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.securityBanner}>
          <Ionicons name="lock-closed-outline" size={16} color="#076B51" />
          <Text style={styles.securityText}>
            Your documents are encrypted and stored securely. We never share them with third parties.
          </Text>
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
  uploadedTitle?: string;
}
function UploadArea({ state, height, onPick, placeholderTitle, placeholderSubtitle, uploadedTitle }: UploadAreaProps) {
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
              <Text style={styles.uploadedBadgeText}>{uploadedTitle ?? "Uploaded"}</Text>
            </View>
          )}
        </>
      ) : (
        <View style={styles.uploadEmpty}>
          <View style={styles.uploadIconCircleEmpty}>
            <Ionicons name="camera-outline" size={28} color="#858585" />
          </View>
          {placeholderTitle ? <Text style={styles.uploadEmptyTitle}>{placeholderTitle}</Text> : null}
          {placeholderSubtitle ? <Text style={styles.uploadEmptySubtitle}>{placeholderSubtitle}</Text> : null}
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
  fieldLabel: { fontSize: 14, fontFamily: "Outfit-Medium", color: "#858585", marginBottom: 10 },
  fieldLabelOptional: { fontFamily: "Outfit-Regular", color: "#B0B0B0" },
  idTypeRow: { flexDirection: "row", gap: 8, marginBottom: 20 },
  idTypeItem: { flex: 1, alignItems: "center", paddingVertical: 12, paddingHorizontal: 4, borderRadius: 16, borderWidth: 2 },
  idTypeItemSelected: { borderColor: "#076B51", backgroundColor: "#E8F4ED" },
  idTypeItemDefault: { borderColor: "#E0E0E0", backgroundColor: "#FFFFFF" },
  idTypeLabel: { fontSize: 10, fontFamily: "Outfit-Medium", color: "#858585", marginTop: 6, textAlign: "center" },
  idTypeLabelSelected: { color: "#076B51" },
  uploadArea: {
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderStyle: "dashed",
    marginBottom: 16,
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
