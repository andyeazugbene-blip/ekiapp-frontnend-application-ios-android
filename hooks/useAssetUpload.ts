import { useCallback, useRef, useState } from "react";
import * as ImagePicker from "expo-image-picker";
import { uploadService, type PrivateUploadCategory } from "../services/uploadService";

export type PhotoSource = "camera" | "library";
export type AssetUploadStatus = "idle" | "uploading" | "failed" | "done";

export interface AssetUploadState {
  status: AssetUploadStatus;
  /** 0..1 */
  progress: number;
  previewUri: string | null;
  assetId: string | null;
  error: string | null;
  /** Set when the OS permission was refused; the UI offers an "Open settings" shortcut. */
  permissionDenied: PhotoSource | null;
  canAskAgain: boolean;
}

const INITIAL: AssetUploadState = {
  status: "idle",
  progress: 0,
  previewUri: null,
  assetId: null,
  error: null,
  permissionDenied: null,
  canAskAgain: true,
};

/**
 * Pick (camera or library) and upload one photo to a private upload category.
 * Keeps the picked file so a failed upload can be retried without picking again.
 */
export function useAssetUpload(category: PrivateUploadCategory, maxBytes: number) {
  const [state, setState] = useState<AssetUploadState>(INITIAL);
  const pending = useRef<{ uri: string; name: string; type: string } | null>(null);

  const run = useCallback(async () => {
    const file = pending.current;
    if (!file) return;
    setState((s) => ({ ...s, status: "uploading", progress: 0, error: null, assetId: null, permissionDenied: null }));
    try {
      const { assetId } = await uploadService.uploadPrivateAsset({
        fileUri: file.uri,
        fileName: file.name,
        contentType: file.type,
        category,
        maxBytes,
        onProgress: (progress) => setState((s) => (s.status === "uploading" ? { ...s, progress } : s)),
      });
      setState((s) => ({ ...s, status: "done", progress: 1, assetId, error: null }));
    } catch (err) {
      setState((s) => ({
        ...s,
        status: "failed",
        error: err instanceof Error ? err.message : "Upload failed. Please try again.",
      }));
    }
  }, [category, maxBytes]);

  const pick = useCallback(
    async (source: PhotoSource) => {
      const permission =
        source === "camera"
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setState((s) => ({ ...s, permissionDenied: source, canAskAgain: permission.canAskAgain, error: null }));
        return;
      }

      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.82,
      };
      const result =
        source === "camera" ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
      if (result.canceled || !result.assets[0]?.uri) return;

      const asset = result.assets[0];
      pending.current = {
        uri: asset.uri,
        name: asset.fileName ?? `photo-${Date.now()}.jpg`,
        type: asset.mimeType ?? "image/jpeg",
      };
      setState({ ...INITIAL, previewUri: asset.uri });
      await run();
    },
    [run],
  );

  const reset = useCallback(() => {
    pending.current = null;
    setState(INITIAL);
  }, []);

  return { state, pick, retry: run, reset };
}
