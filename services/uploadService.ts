/**
 * Upload service for backend-issued presigned URLs.
 */
import { apiClient } from "./api";
import { mapUploadCategory } from "./api/normalizers";

interface PresignedUrlResponse {
  uploadUrl: string;
  publicUrl: string;
  key: string;
}

export const uploadService = {
  async requestUploadUrl(fileName: string, contentType: string, folder = "products"): Promise<PresignedUrlResponse> {
    return apiClient.post<PresignedUrlResponse>("/api/uploads/request-url", {
      filename: fileName,
      contentType,
      category: mapUploadCategory(folder),
    });
  },

  async uploadFile(uploadUrl: string, fileUri: string, contentType: string): Promise<boolean> {
    const response = await fetch(fileUri);
    const blob = await response.blob();

    const uploadResponse = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": contentType },
      body: blob,
    });

    return uploadResponse.ok;
  },

  async uploadImage(fileUri: string, fileName: string, contentType = "image/jpeg", folder = "products"): Promise<string> {
    const { uploadUrl, publicUrl } = await this.requestUploadUrl(fileName, contentType, folder);
    const success = await this.uploadFile(uploadUrl, fileUri, contentType);
    if (!success) throw new Error("Failed to upload image. Please try again.");
    return publicUrl;
  },
};
