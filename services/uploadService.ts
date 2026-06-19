/**
 * Upload service for backend-issued presigned URLs.
 */
import { apiClient } from "./api";
import { mapUploadCategory } from "./api/normalizers";

interface PresignedUrlResponse {
  assetId: string;
  uploadUrl: string;
  publicUrl?: string;
  key: string;
}

interface CompletedUploadResponse {
  assetId: string;
  key: string;
  publicUrl?: string;
  privateReadUrl?: string;
}

export const uploadService = {
  async requestUploadUrl(fileName: string, contentType: string, folder = "products"): Promise<PresignedUrlResponse> {
    return apiClient.post<PresignedUrlResponse>("/api/uploads/request-url", {
      filename: fileName,
      contentType,
      category: mapUploadCategory(folder),
    });
  },

  async uploadFile(uploadUrl: string, fileUri: string, contentType: string): Promise<{ ok: boolean; sizeBytes: number }> {
    const response = await fetch(fileUri);
    const blob = await response.blob();

    const uploadResponse = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": contentType },
      body: blob,
    });

    return { ok: uploadResponse.ok, sizeBytes: blob.size };
  },

  async uploadImage(fileUri: string, fileName: string, contentType = "image/jpeg", folder = "products"): Promise<string> {
    const { assetId, uploadUrl, key } = await this.requestUploadUrl(fileName, contentType, folder);
    const upload = await this.uploadFile(uploadUrl, fileUri, contentType);
    if (!upload.ok) throw new Error("Failed to upload image. Please try again.");

    const completed = await apiClient.post<CompletedUploadResponse>("/api/uploads/complete", {
      assetId,
      key,
      sizeBytes: upload.sizeBytes,
    });

    const url = completed.publicUrl ?? completed.key;
    // Throw early so callers don't silently persist an S3 key as an image URL.
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      throw new Error("Upload completed but no public URL was returned. Please try again.");
    }
    return url;
  },
};
