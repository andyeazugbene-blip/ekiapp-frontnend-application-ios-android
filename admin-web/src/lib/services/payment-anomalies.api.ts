import { apiClient } from "../api";

export type PaymentAnomalyKind = "DUPLICATE_PROVIDER_REF" | "MULTIPLE_SUCCESSFUL_ATTEMPTS" | "MISSING_LEDGER_ENTRY";
export type PaymentAnomalyStatus = "OPEN" | "REVIEWED" | "ESCALATED";

export interface PaymentAnomaly {
  id: string;
  kind: PaymentAnomalyKind;
  businessRefType: string;
  businessRefId: string;
  evidence: Record<string, unknown>;
  status: PaymentAnomalyStatus;
  note: string | null;
  lastSeenAt: string;
  createdAt: string;
}

/**
 * Duplicate-payment / financial-inconsistency queue (architecture doc
 * §15.3). Every row is a real finding from actual payment/ledger rows —
 * scan() re-derives them live, it never fabricates an alert.
 */
export const paymentAnomaliesAPI = {
  async list(status?: PaymentAnomalyStatus): Promise<PaymentAnomaly[]> {
    const query = status ? `?status=${status}` : "";
    const res = await apiClient.get<{ items: PaymentAnomaly[] }>(`/admin/payment-anomalies${query}`);
    return res.items ?? [];
  },

  async scan(): Promise<{ found: number }> {
    return apiClient.post<{ found: number }>("/admin/payment-anomalies/scan", {});
  },

  async review(id: string, note: string): Promise<PaymentAnomaly> {
    const res = await apiClient.post<{ anomaly: PaymentAnomaly }>(`/admin/payment-anomalies/${id}/review`, { note });
    return res.anomaly;
  },

  async escalate(id: string, note: string): Promise<PaymentAnomaly> {
    const res = await apiClient.post<{ anomaly: PaymentAnomaly }>(`/admin/payment-anomalies/${id}/escalate`, { note });
    return res.anomaly;
  },
};
