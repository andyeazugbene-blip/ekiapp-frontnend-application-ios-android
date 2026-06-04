import { apiClient } from "../api";
import { AdminEscrowHealth, EscrowProviderConfig } from "@/types";

export const escrowAPI = {
  getHealth(): Promise<AdminEscrowHealth> {
    return apiClient.get<AdminEscrowHealth>("/admin/escrow/health", { bypassCache: true });
  },

  async updateProvider(id: string, input: Partial<Pick<EscrowProviderConfig, "enabled" | "payoutSupported" | "otpChannel" | "protectionWindowHours" | "notes">>): Promise<EscrowProviderConfig> {
    const response = await apiClient.patch<{ provider: EscrowProviderConfig }>(`/admin/escrow/providers/${id}`, input);
    return response.provider;
  },
};
