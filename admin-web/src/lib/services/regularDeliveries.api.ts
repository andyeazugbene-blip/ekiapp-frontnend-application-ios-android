import { apiClient } from "../api";

export interface SubscriptionException {
  id: string;
  status: "AWAITING_PRICE_APPROVAL" | "PAYMENT_FAILED" | "AWAITING_STOCK";
  cycleDate: string;
  failureReason?: string | null;
  currency: string;
  subtotalAmount?: number | null;
  updatedAt: string;
  subscriptionId: string;
  subscription: {
    id: string;
    buyer?: { name: string; email: string };
  };
  items: { quantity: number; product: { title: string } }[];
  escalated?: boolean;
  escalatedAt?: string | null;
  escalatedReason?: string | null;
}

export const subscriptionExceptionsAPI = {
  /** Lists all renewals currently needing admin attention. */
  async getExceptions(): Promise<SubscriptionException[]> {
    const res = await apiClient.get<{ items?: SubscriptionException[] }>("/admin/subscriptions/exceptions");
    return res.items ?? [];
  },

  /** RD-08 (retry-payment slice only) — re-attempts the same idempotent charge. */
  async retryPayment(renewalId: string): Promise<SubscriptionException> {
    const res = await apiClient.post<{ renewal: SubscriptionException }>(`/admin/subscriptions/${renewalId}/retry-payment`, {});
    return res.renewal;
  },

  /**
   * Admin forced cancellation — Decision 2.
   * Exceptional only: support, fraud, compliance, safety.
   * Cancels ONLY future unpaid renewals. Never touches paid/dispatched orders.
   */
  async forceCancel(subscriptionId: string, reason: string, internalNote: string): Promise<void> {
    await apiClient.post(`/admin/subscriptions/${subscriptionId}/force-cancel`, { reason, internalNote });
  },

  /**
   * Admin contact buyer via a subscription context — Decision 2.
   * Uses Eki's notification infrastructure. Message, admin, timestamp are all recorded.
   */
  async contactBuyerFromSubscription(subscriptionId: string, message: string): Promise<{ notificationId: string }> {
    return apiClient.post<{ notificationId: string }>(`/admin/subscriptions/${subscriptionId}/contact-buyer`, { message });
  },

  /**
   * Admin contact buyer via a renewal context — Decision 2.
   */
  async contactBuyerFromRenewal(renewalId: string, message: string): Promise<{ notificationId: string }> {
    return apiClient.post<{ notificationId: string }>(`/admin/renewals/${renewalId}/contact-buyer`, { message });
  },

  /**
   * Resend the AWAITING_PRICE_APPROVAL notification — Decision 2.
   * Does not accept on buyer's behalf.
   */
  async resendPriceChangeNotification(renewalId: string): Promise<void> {
    await apiClient.post(`/admin/renewals/${renewalId}/resend-price-change`, {});
  },

  /**
   * Cancel an invalid vendor price-change request — Decision 2.
   * Voids the request and resets the renewal to SCHEDULED at the original price.
   */
  async cancelInvalidPriceChange(renewalId: string, reason: string): Promise<void> {
    await apiClient.post(`/admin/renewals/${renewalId}/cancel-price-change`, { reason });
  },

  /**
   * Admin skip a renewal — Decision 2.
   * Requires a reason.
   */
  async skipRenewal(renewalId: string, reason: string): Promise<void> {
    await apiClient.post(`/admin/renewals/${renewalId}/admin-skip`, { reason });
  },

  /**
   * Admin frequency correction — Decision 3.
   * Support action only. Requires reason. Buyer must have authorized this.
   */
  async changeFrequency(subscriptionId: string, frequency: string, reason: string): Promise<void> {
    await apiClient.post(`/admin/subscriptions/${subscriptionId}/change-frequency`, { frequency, reason });
  },

  /**
   * Escalate a stuck exception for higher-tier support attention — approved
   * client requirement. Internal admin action, not buyer-facing (use the
   * separate contact-buyer actions for that). Idempotent on the backend:
   * escalating an already-escalated renewal is a safe no-op.
   */
  async escalate(renewalId: string, reason: string): Promise<SubscriptionException> {
    const res = await apiClient.post<{ renewal: SubscriptionException }>(`/admin/renewals/${renewalId}/escalate`, { reason });
    return res.renewal;
  },
};
