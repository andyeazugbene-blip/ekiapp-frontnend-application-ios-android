import React from "react";
import { Image, Linking, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { AssetUploadState, PhotoSource } from "../../hooks/useAssetUpload";

interface Props {
  state: AssetUploadState;
  onPick: (source: PhotoSource) => void;
  onRetry: () => void;
  onRemove: () => void;
  maxLabel: string;
  disabled?: boolean;
}

/** Camera / library picker with preview, upload progress, failure + retry and permission-denied guidance. */
export function PhotoAttach({ state, onPick, onRetry, onRemove, maxLabel, disabled }: Props) {
  const uploading = state.status === "uploading";
  return (
    <View style={styles.wrap}>
      {state.previewUri ? (
        <View style={styles.previewRow}>
          <Image source={{ uri: state.previewUri }} style={styles.preview} accessibilityLabel="Selected photo preview" />
          <View style={{ flex: 1, gap: 6 }}>
            {uploading ? (
              <>
                <Text style={styles.status}>Uploading {Math.round(state.progress * 100)}%</Text>
                <View style={styles.track}>
                  <View style={[styles.fill, { width: `${Math.max(4, Math.round(state.progress * 100))}%` }]} />
                </View>
              </>
            ) : state.status === "done" ? (
              <Text style={[styles.status, { color: "#076B51" }]}>Photo ready to submit</Text>
            ) : state.status === "failed" ? (
              <>
                <Text style={[styles.status, { color: "#FB6363" }]}>{state.error ?? "Upload failed."}</Text>
                <TouchableOpacity onPress={onRetry} activeOpacity={0.85} style={styles.retry} accessibilityRole="button" accessibilityLabel="Retry upload">
                  <Ionicons name="refresh" size={14} color="#076B51" />
                  <Text style={styles.retryText}>Retry upload</Text>
                </TouchableOpacity>
              </>
            ) : null}
            {!uploading ? (
              <TouchableOpacity onPress={onRemove} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel="Remove photo">
                <Text style={styles.remove}>Remove photo</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      ) : (
        <View style={styles.buttons}>
          <TouchableOpacity disabled={disabled} onPress={() => onPick("camera")} activeOpacity={0.85} style={[styles.pickBtn, disabled && styles.disabled]} accessibilityRole="button" accessibilityLabel="Take a photo">
            <Ionicons name="camera-outline" size={18} color="#076B51" />
            <Text style={styles.pickText}>Take photo</Text>
          </TouchableOpacity>
          <TouchableOpacity disabled={disabled} onPress={() => onPick("library")} activeOpacity={0.85} style={[styles.pickBtn, disabled && styles.disabled]} accessibilityRole="button" accessibilityLabel="Choose a photo from your library">
            <Ionicons name="images-outline" size={18} color="#076B51" />
            <Text style={styles.pickText}>Choose photo</Text>
          </TouchableOpacity>
        </View>
      )}

      {state.permissionDenied ? (
        <View style={styles.denied}>
          <Text style={styles.deniedText}>
            {state.permissionDenied === "camera" ? "Camera" : "Photo library"} access is turned off.{" "}
            {state.canAskAgain ? "Allow access when asked, or choose the other option." : "Turn it on in your device settings to continue."}
          </Text>
          {!state.canAskAgain ? (
            <TouchableOpacity onPress={() => Linking.openSettings().catch(() => undefined)} activeOpacity={0.85} accessibilityRole="button">
              <Text style={styles.retryText}>Open settings</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
      <Text style={styles.hint}>JPEG, PNG or WebP. {maxLabel}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  buttons: { flexDirection: "row", gap: 10 },
  pickBtn: { flex: 1, height: 48, borderRadius: 14, borderWidth: 1.5, borderColor: "#076B51", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  pickText: { fontSize: 14, fontFamily: "Manrope-SemiBold", color: "#076B51" },
  disabled: { opacity: 0.5 },
  previewRow: { flexDirection: "row", gap: 12, alignItems: "center" },
  preview: { width: 84, height: 84, borderRadius: 14, backgroundColor: "#F0E6D4" },
  status: { fontSize: 13, fontFamily: "Outfit-Medium", color: "#282828" },
  track: { height: 6, borderRadius: 3, backgroundColor: "#E5E7EB", overflow: "hidden" },
  fill: { height: 6, backgroundColor: "#076B51" },
  retry: { flexDirection: "row", alignItems: "center", gap: 6 },
  retryText: { fontSize: 13, fontFamily: "Manrope-SemiBold", color: "#076B51" },
  remove: { fontSize: 12, fontFamily: "Outfit-Medium", color: "#687076" },
  denied: { backgroundColor: "#FEF3C7", borderRadius: 12, padding: 12, gap: 6 },
  deniedText: { fontSize: 12, lineHeight: 18, fontFamily: "Outfit-Regular", color: "#92400E" },
  hint: { fontSize: 11, fontFamily: "Outfit-Regular", color: "#8A8F94" },
});
