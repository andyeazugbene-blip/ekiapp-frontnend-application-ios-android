import React, { useEffect, useState } from "react";
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
  const [alreadyVerified, setAlreadyVerified] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    vendorService
      .getMyProfile()
      .then((profile) => {
        if (!mounted) return;
        if (profile.verificationStatus === "verified") {
          setAlreadyVerified(true);
          setError("Your identity is already verified.");
        }
      })
      .catch(() => undefined);
    return () => { mounted = false; };
  }, []);

  const pickAndUpload = async (
    setter: React.Dispatch<React.SetStateAction<UploadState>>,
    folder = "verification"
  ) => {
    setError("");
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { setError("Photo library access required."); return; }
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
      setter(initialUpload);
      setError(err instanceof Error ? err.message : "Could not upload image.");
    }
  };

  const canContinue =
    selectedType !== null && !!front.remoteUrl && !front.uploading && !back.uploading && !alreadyVerified;

  const onContinue = async () => {
    if (alreadyVerified) { setError("Already verified."); return; }
    if (!selectedType) { setError("Select your ID type."); return; }
    if (!front.remoteUrl) { setError("Upload front of your ID."); return; }
    setSubmitting(true);
    setError("");
    try {
      await vendorService.submitVerificationDocument({
        type: "id",
        fileUrl: front.remoteUrl,
        backUrl: back.remoteUrl ?? undefined,
        idSubtype: selectedType,
      });
      router.push("/(vendor-verification)/face-scan" as any);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit document.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      {/* green dashboard peek */}
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
            <Text style={styles.title}>Upload Front Of ID</Text>
            <Text style={styles.subtitle}>Use a clear photo of your government-issued ID</Text>

            {/* ID type selector */}
            <View style={styles.idTypeRow}>
              {ID_TYPES.map((type) => {
                const selected = selectedType === type.id;
                return (
                  <TouchableOpacity
                    key={type.id}
                    onPress={() => { setSelectedType(type.id as IdSubtype); setError(""); }}
                    activeOpacity={0.8}
                    style={[styles.idTypeItem, selected && styles.idTypeItemSelected]}
                  >
                    <Ionicons name={type.icon} size={20} color={selected ? "#076B51" : "#858585"} />
                    <Text style={[styles.idTypeLabel, selected && styles.idTypeLabelSelected]} numberOfLines={2}>
                      {type.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Front upload */}
            <UploadZone
              state={front}
              label="Upload Front of ID"
              onPick={() => pickAndUpload(setFront, "verification/id-front")}
            />

            {/* Back upload */}
            {selectedType !== "passport" && (
              <UploadZone
                state={back}
                label="Upload Back of ID"
                onPick={() => pickAndUpload(setBack, "verification/id-back")}
              />
            )}

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.primaryButton, (!canContinue || submitting) && styles.primaryButtonDisabled]}
              onPress={onContinue}
              activeOpacity={0.8}
              disabled={!canContinue || submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryButtonText}>Continue</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>

        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => router.replace("/(vendor)" as any)}
          activeOpacity={0.8}
        >
          <Ionicons name="close" size={20} color="#282828" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

interface UploadZoneProps {
  state: UploadState;
  label: string;
  onPick: () => void;
}
function UploadZone({ state, label, onPick }: UploadZoneProps) {
  return (
    <TouchableOpacity
      onPress={onPick}
      activeOpacity={0.85}
      disabled={state.uploading}
      style={[styles.uploadZone, state.remoteUrl && styles.uploadZoneUploaded]}
    >
      {state.localUri ? (
        <>
          <Image source={{ uri: state.localUri }} style={StyleSheet.absoluteFillObject as any} resizeMode="cover" />
          {state.uploading ? (
            <View style={styles.uploadOverlay}>
              <ActivityIndicator color="#FFFFFF" />
            </View>
          ) : (
            <View style={styles.uploadedBadge}>
              <Ionicons name="checkmark" size={12} color="#FFFFFF" />
            </View>
          )}
        </>
      ) : (
        <View style={styles.uploadEmpty}>
          <View style={styles.uploadIconCircle}>
            <Ionicons name="arrow-up-outline" size={22} color="#076B51" />
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
  cardWrap: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    alignItems: "center",
  },
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
  title: { fontSize: 20, fontFamily: "Manrope-Bold", color: "#1A1A1A", textAlign: "center", marginBottom: 8 },
  subtitle: { fontSize: 14, fontFamily: "Outfit-Regular", color: "#6F7478", textAlign: "center", lineHeight: 20, marginBottom: 20 },
  idTypeRow: { flexDirection: "row", gap: 8, marginBottom: 18 },
  idTypeItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#E0E0E0",
    backgroundColor: "#F9F9F9",
  },
  idTypeItemSelected: { borderColor: "#076B51", backgroundColor: "#E8F4ED" },
  idTypeLabel: { fontSize: 10, fontFamily: "Outfit-Medium", color: "#858585", marginTop: 5, textAlign: "center" },
  idTypeLabelSelected: { color: "#076B51" },
  uploadZone: {
    height: 110,
    borderRadius: 16,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "#076B51",
    backgroundColor: "#EDF6F2",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    overflow: "hidden",
  },
  uploadZoneUploaded: { borderStyle: "solid", borderColor: "#076B51" },
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
  uploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
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
  primaryButton: {
    height: 52,
    borderRadius: 14,
    backgroundColor: "#076B51",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
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
