import { apiClient } from "../api";

export type FulfilmentAlertReason = "PAST_ESTIMATED_READY_DATE" | "STALE_NO_PROGRESS";
export type FulfilmentAlertStatus = "OPEN" | "CONTACTED" | "RESOLVED" | "ESCALATED";

export interface FulfilmentDelayAlert {
  id: string;
  campaignId: string;
  reason: FulfilmentAlertReason;
  evidence: Record<string, unknown>;
  status: FulfilmentAlertStatus;
  note: string | null;
  lastSeenAt: string;
  campaign?: { id: string; title: string; supplier?: { vendor?: { storeName: string } } };
}

/** Supplier-fulfilment delay queue (architecture doc §15.3) — real findings from actual CampaignFulfilment rows. */
export const fulfilmentDelaysAPI = {
  async list(status?: FulfilmentAlertStatus): Promise<FulfilmentDelayAlert[]> {
    const query = status ? `?status=${status}` : "";
    const res = await apiClient.get<{ items: FulfilmentDelayAlert[] }>(`/admin/fulfilment-delays${query}`);
    return res.items ?? [];
  },
  async scan(): Promise<{ found: number; staleCheckConfigured: boolean }> {
    return apiClient.post("/admin/fulfilment-delays/scan", {});
  },
  async addNote(id: string, note: string): Promise<FulfilmentDelayAlert> {
    const res = await apiClient.post<{ alert: FulfilmentDelayAlert }>(`/admin/fulfilment-delays/${id}/note`, { note });
    return res.alert;
  },
  async contactSupplier(id: string, note: string): Promise<FulfilmentDelayAlert> {
    const res = await apiClient.post<{ alert: FulfilmentDelayAlert }>(`/admin/fulfilment-delays/${id}/contact-supplier`, { note });
    return res.alert;
  },
  async resolve(id: string, note: string): Promise<FulfilmentDelayAlert> {
    const res = await apiClient.post<{ alert: FulfilmentDelayAlert }>(`/admin/fulfilment-delays/${id}/resolve`, { note });
    return res.alert;
  },
  async escalate(id: string, note: string): Promise<FulfilmentDelayAlert> {
    const res = await apiClient.post<{ alert: FulfilmentDelayAlert }>(`/admin/fulfilment-delays/${id}/escalate`, { note });
    return res.alert;
  },
};
