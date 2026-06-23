import React, { useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { uploadService } from "../../services/uploadService";
import { vendorService } from "../../services/vendorService";

export default function FaceScanScreen() {
  const router = useRouter();
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const [permDeniedPermanently, setPermDeniedPermanently] = useState(false);

  const takeSelfie = async () => {
    setError("");
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      if (!perm.canAskAgain) {
        setPermDeniedPermanently(true);
        setError("Camera access was denied. Please enable it in your device Settings to continue.");
      } else {
        setError("Camera access is required for face verification.");
      }
      return;
    }
    setPermDeniedPermanently(false);
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.85,
      cameraType: ImagePicker.CameraType.front,
    });
    if (result.canceled || !result.assets?.[0]) return;
    setPhotoUri(result.assets[0].uri);
  };

  const onContinue = async () => {
    if (!photoUri) {
      setError("Take a selfie first.");
      return;
    }
    setUploading(true);
    setError("");
    try {
      const fileName = `face_${Date.now()}.jpg`;
      const remoteUrl = await uploadService.uploadImage(
        photoUri,
        fileName,
        "image/jpeg",
        "verification/selfie",
      );
      await vendorService.submitVerificationDocument({
        type: "selfie",
        fileUrl: remoteUrl,
      });
      const profile = await vendorService.getMyProfile().catch(() => null);
      if (profile?.businessType === "registered") {
        router.push("/(vendor-verification)/upload-business" as any);
      } else {
        router.replace("/(vendor-verification)/pending" as any);
      }
    } catch (err) {
      if (err instanceof Error && /pending document|already exists|already submitted/i.test(err.message)) {
        router.replace("/(vendor-verification)/pending" as any);
        return;
      }
      setError(err instanceof Error ? err.message : "Could not upload selfie.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.backWrap}>
        <TouchableOpacity
          accessibilityLabel="Go back"
          accessibilityRole="button"
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.8}
        >
          <Ionicons name="chevron-back" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </SafeAreaView>

      {/* Frame area — shows captured selfie or capture prompt */}
      <TouchableOpacity
        style={styles.frameWrap}
        activeOpacity={0.85}
        onPress={takeSelfie}
        disabled={uploading}
      >
        {photoUri ? (
          <Image source={{ uri: photoUri }} style={styles.preview} />
        ) : (
          <>
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
            <View style={styles.capturePrompt}>
              <Ionicons name="camera-outline" size={40} color="rgba(255,255,255,0.7)" />
              <Text style={styles.captureText}>Tap to take selfie</Text>
            </View>
          </>
        )}
      </TouchableOpacity>

      {/* Bottom content */}
      <View style={styles.bottomContent}>
        <Text style={styles.title}>Confirm Your Identity</Text>
        <Text style={styles.subtitle}>
          Take a clear selfie so we can match it to your ID.
        </Text>

        {photoUri && !uploading && (
          <TouchableOpacity onPress={takeSelfie} activeOpacity={0.7} style={styles.retakeRow}>
            <Ionicons name="refresh-outline" size={16} color="rgba(255,255,255,0.8)" />
            <Text style={styles.retakeText}>Retake</Text>
          </TouchableOpacity>
        )}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {permDeniedPermanently ? (
          <TouchableOpacity
            style={styles.continueButton}
            onPress={() => Linking.openSettings()}
            activeOpacity={0.85}
          >
            <Text style={styles.continueButtonText}>Open Settings</Text>
          </TouchableOpacity>
        ) : (
        <TouchableOpacity
          style={[styles.continueButton, (!photoUri || uploading) && styles.continueButtonDisabled]}
          onPress={onContinue}
          activeOpacity={0.85}
          disabled={!photoUri || uploading}
        >
          {uploading ? (
            <ActivityIndicator color="#1A1A1A" />
          ) : (
            <Text style={styles.continueButtonText}>Continue</Text>
          )}
        </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const FRAME_SIZE = 260;
const CORNER_SIZE = 28;
const CORNER_THICKNESS = 4;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1C1C1C",
    alignItems: "center",
    justifyContent: "center",
  },
  backWrap: {
    position: "absolute",
    top: 0,
    left: 0,
    zIndex: 5,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  frameWrap: {
    width: FRAME_SIZE,
    height: FRAME_SIZE,
    marginBottom: 40,
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    overflow: "hidden",
  },
  preview: {
    width: "100%",
    height: "100%",
    borderRadius: 16,
  },
  capturePrompt: {
    alignItems: "center",
    gap: 10,
  },
  captureText: {
    fontSize: 14,
    fontFamily: "Outfit-Regular",
    color: "rgba(255,255,255,0.7)",
  },
  corner: {
    position: "absolute",
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderColor: "#FFFFFF",
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
    borderTopLeftRadius: 6,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
    borderTopRightRadius: 6,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
    borderBottomLeftRadius: 6,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
    borderBottomRightRadius: 6,
  },
  retakeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 16,
  },
  retakeText: {
    fontSize: 13,
    fontFamily: "Outfit-Medium",
    color: "rgba(255,255,255,0.8)",
  },
  errorText: {
    fontSize: 12,
    fontFamily: "Outfit-Regular",
    color: "#FB6363",
    textAlign: "center",
    marginBottom: 12,
  },
  bottomContent: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.45)",
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 40,
    alignItems: "center",
  },
  title: {
    fontSize: 24,
    fontFamily: "Manrope-Bold",
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "Outfit-Regular",
    color: "rgba(255,255,255,0.75)",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 28,
  },
  continueButton: {
    width: "100%",
    height: 56,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  continueButtonDisabled: {
    opacity: 0.5,
  },
  continueButtonText: {
    fontSize: 16,
    fontFamily: "Manrope-SemiBold",
    color: "#1A1A1A",
  },
});
