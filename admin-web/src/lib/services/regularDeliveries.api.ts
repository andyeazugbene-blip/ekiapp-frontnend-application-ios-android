import { apiClient } from "../api";

export interface SubscriptionException {
  id: string;
  status: "AWAITING_PRICE_APPROVAL" | "PAYMENT_FAILED" | "AWAITING_STOCK";
  cycleDate: string;
  failureReason?: string | null;
  currency: string;
  subtotalAmount?: number | null;
  updatedAt: string;
  subscription: {
    buyer?: { name: string; email: string };
  };
  items: { quantity: number; product: { title: string } }[];
}

export const subscriptionExceptionsAPI = {
  async getExceptions(): Promise<SubscriptionException[]> {
    const res = await apiClient.get<{ items?: SubscriptionException[] }>("/admin/subscription-exceptions");
    return res.items ?? [];
  },

  /** RD-08 (retry-payment slice only) — re-attempts the same idempotent charge path a buyer's own retry or the cron sweep would use. */
  async retryPayment(id: string): Promise<SubscriptionException> {
    const res = await apiClient.post<{ renewal: SubscriptionException }>(`/admin/subscription-exceptions/${id}/retry-payment`, {});
    return res.renewal;
  },
};
