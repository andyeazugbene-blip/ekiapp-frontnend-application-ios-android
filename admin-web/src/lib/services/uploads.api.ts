import { apiClient } from "../api";
import { UploadAsset } from "@/types";

export const uploadsAPI = {
  async list(params?: { category?: string; status?: string }): Promise<UploadAsset[]> {
    const query = new URLSearchParams();
    if (params?.category) query.set("category", params.category);
    if (params?.status) query.set("status", params.status);
    const suffix = query.toString() ? `?${query.toString()}` : "";
    const response = await apiClient.get<{ assets: UploadAsset[] }>(`/admin/uploads${suffix}`, { bypassCache: true });
    return response.assets ?? [];
  },

  async getReadUrl(id: string): Promise<string> {
    const response = await apiClient.get<{ readUrl: string }>(`/admin/uploads/${id}/read-url`, { bypassCache: true });
    return response.readUrl;
  },
};
