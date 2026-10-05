import { apiClient } from "../api";

export interface SubscriptionException {
  id: string;
  status: "AWAITING_PRICE_APPROVAL" | "PAYMENT_FAILED" | "AWAITING_STOCK";
  cycleDate: string;
  failureReason?: string | null;
  nextRetryAt?: string | null;
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
  async retryPayment(renewalId: string, reason: string): Promise<SubscriptionException> {
    const res = await apiClient.post<{ renewal: SubscriptionException }>(`/admin/subscriptions/${renewalId}/retry-payment`, { reason });
    return res.renewal;
  },

  /**
   * Admin forced cancellation — Decision 2.
   * Exceptional only: support, fraud, compliance, safety.
   * Cancels ONLY future unpaid renewals. Never touches paid/dispatched orders.
   */
  async forceCancel(subscriptionId: string, reason: string, internalNote?: string): Promise<void> {
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

// ─── Foodstuffs Subscription admin module ──────────────────────────────────

export type SubscriptionQueue =
  | "all" | "active" | "paused" | "skip-requested" | "renewal-due" | "payment-failed" | "stock-exception" | "cancelled";

export type SubscriptionCounts = Record<SubscriptionQueue, number>;

export interface SubscriptionRow {
  id: string;
  status: "DRAFT" | "ACTIVE" | "PAUSED" | "PAYMENT_ATTENTION" | "CANCELLED" | "EXPIRED";
  frequency: "WEEKLY" | "BIWEEKLY" | "EVERY_4_WEEKS" | "MONTHLY";
  nextRenewalAt: string | null;
  pausedUntil: string | null;
  pausedReason: string | null;
  cancelReason: string | null;
  createdAt: string;
  buyer: { id: string; name: string; email: string };
  vendor: { id: string; storeName: string };
  offerTitle: string;
  basket: { title: string; quantity: number }[];
  currency: string | null;
  latestRenewal: { id: string; status: string; cycleDate: string; failureReason: string | null; nextRetryAt: string | null } | null;
  paymentState: "none" | "paid" | "failed" | "processing" | "ready" | "cancelled" | "pending";
}

export interface SubscriptionListResponse {
  items: SubscriptionRow[];
  nextCursor: string | null;
  counts: SubscriptionCounts;
}

export interface SubscriptionTimelineEvent {
  at: string;
  kind: "action" | "renewal" | "payment_attempt" | "order" | "refund" | "audit";
  title: string;
  detail?: string | null;
  actor?: string | null;
  ref?: { type: "renewal" | "order"; id: string };
}

export interface SubscriptionDetail {
  subscription: {
    id: string; status: SubscriptionRow["status"]; frequency: SubscriptionRow["frequency"]; nextRenewalAt: string | null;
    pausedUntil: string | null; pausedReason: string | null; pausedAt: string | null; cancelledAt: string | null; cancelReason: string | null;
    priceChangeApprovalLimitBps: number; createdAt: string;
  };
  buyer: { id: string; name: string; email: string; phone: string | null };
  vendor: { id: string; storeName: string; country: string | null; city: string | null };
  offer: { id: string; title: string; frequencies: string[]; fulfilmentMethod: string; substitutionMode: string; discountPercent: number | null; renewalsPaused: boolean };
  recipient: { line1: string; city: string; country: string };
  paymentMethod: { id: string; brand: string | null; last4: string | null } | null;
  basket: { id: string; productId: string; title: string; quantity: number; unitAmount: number; lineAmount: number; currency: string; stockAvailable: boolean; stock: number; productActive: boolean }[];
  money: { currency: string | null; basketSubtotal: number; latestSubtotal: number | null; latestDeliveryFee: number | null; paymentState: SubscriptionRow["paymentState"]; latestFailureReason: string | null; nextRetryAt: string | null };
  renewals: {
    id: string; cycleDate: string; status: string; currency: string; subtotalAmount: number | null; deliveryFeeAmount: number | null;
    failureReason: string | null; nextRetryAt: string | null; escalated: boolean;
    attempts: { attemptNumber: number; status: string; failureCode: string | null; failureMessage: string | null; createdAt: string }[];
    order: { id: string; orderNumber: string; status: string; totalAmount: number; currency: string } | null;
    items: { title: string; quantity: number; unitAmount: number; stockAvailable: boolean }[];
  }[];
  linkedOrders: { id: string; orderNumber: string; status: string; totalAmount: number; currency: string; createdAt: string }[];
  timeline: SubscriptionTimelineEvent[];
  canAct: { pause: boolean; resume: boolean; skipNext: boolean; setNextDate: boolean; changeFrequency: boolean; cancel: boolean; retryPayment: boolean };
}

export interface SubscriptionReports {
  periodDays: number;
  activeSubscriptions: number;
  recurringRevenue: { currency: string; amountMinor: number }[];
  churn: { cancelledInPeriod: number; ratePct: number | null; rateBasis: string };
  paymentRecovery: { cyclesWithFailedPayment: number; recovered: number; ratePct: number | null };
  fulfilment: { cyclesDue: number; ordersCreated: number; failedOrCancelled: number; skipped: number; successRatePct: number | null };
  cancellationReasons: { reason: string; count: number }[];
}

export interface SubscriptionListParams {
  status?: string; vendorId?: string; q?: string; renewalFrom?: string; renewalTo?: string; cursor?: string | null; limit?: number;
}

export const subscriptionsAdminAPI = {
  async list(p: SubscriptionListParams = {}): Promise<SubscriptionListResponse> {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(p)) if (v != null && v !== "") qs.set(k, String(v));
    return apiClient.get<SubscriptionListResponse>(`/admin/subscriptions${qs.toString() ? `?${qs}` : ""}`, { bypassCache: true });
  },
  async get(id: string): Promise<SubscriptionDetail> {
    return apiClient.get<SubscriptionDetail>(`/admin/subscriptions/${id}`, { bypassCache: true });
  },
  async reports(days = 30): Promise<SubscriptionReports> {
    return apiClient.get<SubscriptionReports>(`/admin/subscriptions/reports?days=${days}`, { bypassCache: true });
  },
  async pause(id: string, reason: string, resumeAt?: string): Promise<void> {
    await apiClient.post(`/admin/subscriptions/${id}/pause`, { reason, resumeAt: resumeAt || undefined });
  },
  async resume(id: string, reason: string): Promise<void> {
    await apiClient.post(`/admin/subscriptions/${id}/resume`, { reason });
  },
  async skipNext(id: string, reason: string): Promise<void> {
    await apiClient.post(`/admin/subscriptions/${id}/skip-next`, { reason });
  },
  async setNextDate(id: string, date: string, reason: string): Promise<void> {
    await apiClient.post(`/admin/subscriptions/${id}/set-next-date`, { date, reason });
  },
  async changeFrequency(id: string, frequency: string, reason: string): Promise<void> {
    await apiClient.post(`/admin/subscriptions/${id}/change-frequency`, { frequency, reason });
  },
  async cancel(id: string, reason: string): Promise<void> {
    await apiClient.post(`/admin/subscriptions/${id}/force-cancel`, { reason });
  },
  /** id = subscription id (detail page) or renewal id (exceptions queue). */
  async retryPayment(id: string, reason: string): Promise<void> {
    await apiClient.post(`/admin/subscriptions/${id}/retry-payment`, { reason });
  },
  async contactBuyer(id: string, message: string): Promise<void> {
    await apiClient.post(`/admin/subscriptions/${id}/contact-buyer`, { message });
  },
};
