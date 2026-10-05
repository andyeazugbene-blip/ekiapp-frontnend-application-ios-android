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

export type PrivateUploadCategory = "dispute_evidence" | "delivery_proof";

export class UploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UploadError";
  }
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

    // Verification docs are stored privately by design: backend returns no publicUrl
    // for this category and resolves access via the storage key instead. The key itself
    // is the correct value to persist (see verification.service.ts's key/publicUrl lookup).
    if (completed.privateReadUrl) return completed.key;

    const url = completed.publicUrl ?? completed.key;
    // Throw early so callers don't silently persist an S3 key as an image URL.
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      throw new Error("Upload completed but no public URL was returned. Please try again.");
    }
    return url;
  },

  /**
   * Uploads a file for a private, asset-id based category (dispute_evidence, delivery_proof)
   * and returns the completed asset id that the backend attaches to a dispute / order.
   * Reports byte progress through XHR. Throws UploadError with a user-safe message.
   */
  async uploadPrivateAsset(opts: {
    fileUri: string;
    fileName: string;
    contentType: string;
    category: PrivateUploadCategory;
    maxBytes: number;
    onProgress?: (fraction: number) => void;
  }): Promise<{ assetId: string }> {
    const { fileUri, fileName, contentType, category, maxBytes, onProgress } = opts;
    let blob: Blob;
    try {
      blob = await (await fetch(fileUri)).blob();
    } catch {
      throw new UploadError("Could not read the selected file. Please choose it again.");
    }
    if (blob.size > maxBytes) {
      throw new UploadError(`This file is too large. The limit is ${Math.round(maxBytes / (1024 * 1024))} MB.`);
    }

    const { assetId, uploadUrl, key } = await apiClient.post<PresignedUrlResponse>("/api/uploads/request-url", {
      filename: fileName,
      contentType,
      category,
    });

    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", uploadUrl);
      xhr.setRequestHeader("Content-Type", contentType);
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && event.total > 0) onProgress?.(event.loaded / event.total);
      };
      xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new UploadError("The upload did not complete. Please try again.")));
      xhr.onerror = () => reject(new UploadError("The upload failed. Check your connection and try again."));
      xhr.ontimeout = () => reject(new UploadError("The upload timed out. Please try again."));
      xhr.timeout = 120000;
      xhr.send(blob);
    });
    onProgress?.(1);

    await apiClient.post<CompletedUploadResponse>("/api/uploads/complete", { assetId, key, sizeBytes: blob.size });
    return { assetId };
  },
};

