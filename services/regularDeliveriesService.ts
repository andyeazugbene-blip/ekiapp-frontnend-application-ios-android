/**
 * Regular Deliveries service — buyer recurring subscriptions + vendor
 * subscription offers/renewals. Money fields from the backend are integer
 * cents (see services/api/normalizers.ts convention); normalized to major
 * units here so screens never divide by 100 themselves.
 */
import { apiClient } from "./api";

export type SubscriptionFrequency = "WEEKLY" | "BIWEEKLY" | "MONTHLY";

export type BuyerSubscriptionStatus = "ACTIVE" | "PAUSED" | "PAYMENT_ATTENTION" | "CANCELLED";

export type RenewalStatus =
  | "SCHEDULED"
  | "AWAITING_STOCK"
  | "AWAITING_PRICE_APPROVAL"
  | "READY_FOR_PAYMENT"
  | "PAYMENT_PROCESSING"
  | "PAYMENT_FAILED"
  | "ORDER_CREATED"
  | "SKIPPED"
  | "CANCELLED";

export const FREQUENCY_LABELS: Record<SubscriptionFrequency, string> = {
  WEEKLY: "Weekly",
  BIWEEKLY: "Every 2 weeks",
  MONTHLY: "Monthly",
};

export const RENEWAL_STATUS_LABELS: Record<RenewalStatus, string> = {
  SCHEDULED: "Scheduled",
  AWAITING_STOCK: "Awaiting stock confirmation",
  AWAITING_PRICE_APPROVAL: "Awaiting your price approval",
  READY_FOR_PAYMENT: "Ready for payment",
  PAYMENT_PROCESSING: "Payment processing",
  PAYMENT_FAILED: "Payment failed",
  ORDER_CREATED: "Order created",
  SKIPPED: "Skipped",
  CANCELLED: "Cancelled",
};

export interface OfferProduct {
  productId: string;
  product: { id: string; title: string; priceInCents: number; currency: string; imageUrl?: string | null };
}

export interface SubscriptionOffer {
  id: string;
  vendorId: string;
  vendor?: { id: string; storeName: string };
  title: string;
  description?: string | null;
  isActive: boolean;
  frequencies: SubscriptionFrequency[];
  substitutionPolicy?: string | null;
  renewalCutoffHours: number;
  products: OfferProduct[];
  createdAt: string;
}

export interface SubscriptionItem {
  id: string;
  productId: string;
  quantity: number;
  product: { id: string; title: string; priceInCents: number; currency: string; imageUrl?: string | null };
}

export interface Renewal {
  id: string;
  subscriptionId: string;
  cycleDate: string;
  status: RenewalStatus;
  currency: string;
  subtotalAmount?: number | null;
  failureReason?: string | null;
  items: {
    id: string;
    productId: string;
    quantity: number;
    previousUnitPrice: number;
    currentUnitPrice: number;
    currency: string;
    stockAvailable: boolean;
    product?: { title: string };
  }[];
  subscription?: { buyer?: { name: string } };
  orderId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BuyerSubscription {
  id: string;
  buyerId: string;
  buyer?: { name: string; email?: string };
  offerId: string;
  offer?: SubscriptionOffer & { vendor?: { storeName: string } };
  status: BuyerSubscriptionStatus;
  frequency: SubscriptionFrequency;
  deliveryAddressId: string;
  paymentMethodId: string;
  nextRenewalAt?: string | null;
  pausedUntil?: string | null;
  items: SubscriptionItem[];
  renewals?: Renewal[];
  createdAt: string;
}

export interface BuyerPaymentMethod {
  id: string;
  brand?: string | null;
  last4?: string | null;
  isDefault: boolean;
  createdAt: string;
}

interface Items<T> {
  items?: T[];
}

export const regularDeliveriesService = {
  // ─── Public / buyer: offers ───────────────────────────────────────────
  async getOffer(offerId: string): Promise<SubscriptionOffer> {
    const res = await apiClient.get<{ offer: SubscriptionOffer }>(`/api/subscription-offers/${offerId}`, { skipAuth: true });
    return res.offer;
  },

  // ─── Buyer: saved payment methods ─────────────────────────────────────
  async createSetupIntent(): Promise<{ clientSecret: string; customerId: string }> {
    return apiClient.post("/api/buyer/payment-methods/setup-intent", {});
  },

  async confirmSetupIntent(setupIntentId: string): Promise<{ id: string }> {
    return apiClient.post("/api/buyer/payment-methods", { setupIntentId });
  },

  async listPaymentMethods(): Promise<BuyerPaymentMethod[]> {
    const res = await apiClient.get<Items<BuyerPaymentMethod>>("/api/buyer/payment-methods");
    return res.items ?? [];
  },

  async removePaymentMethod(id: string): Promise<void> {
    await apiClient.delete(`/api/buyer/payment-methods/${id}`);
  },

  // ─── Buyer: subscriptions ──────────────────────────────────────────────
  async createSubscription(input: {
    offerId: string;
    frequency: SubscriptionFrequency;
    deliveryAddressId: string;
    paymentMethodId: string;
    items: { productId: string; quantity: number }[];
  }): Promise<BuyerSubscription> {
    const res = await apiClient.post<{ subscription: BuyerSubscription }>("/api/buyer/subscriptions", input);
    return res.subscription;
  },

  async listMySubscriptions(): Promise<BuyerSubscription[]> {
    const res = await apiClient.get<Items<BuyerSubscription>>("/api/buyer/subscriptions");
    return res.items ?? [];
  },

  async getSubscription(id: string): Promise<BuyerSubscription> {
    const res = await apiClient.get<{ subscription: BuyerSubscription }>(`/api/buyer/subscriptions/${id}`);
    return res.subscription;
  },

  async updateSubscriptionItems(id: string, items: { productId: string; quantity: number }[]): Promise<BuyerSubscription> {
    const res = await apiClient.patch<{ subscription: BuyerSubscription }>(`/api/buyer/subscriptions/${id}`, { items });
    return res.subscription;
  },

  async pauseSubscription(id: string, resumeAt?: string): Promise<BuyerSubscription> {
    const res = await apiClient.post<{ subscription: BuyerSubscription }>(`/api/buyer/subscriptions/${id}/pause`, { resumeAt });
    return res.subscription;
  },

  async resumeSubscription(id: string): Promise<BuyerSubscription> {
    const res = await apiClient.post<{ subscription: BuyerSubscription }>(`/api/buyer/subscriptions/${id}/resume`, {});
    return res.subscription;
  },

  async cancelSubscription(id: string): Promise<BuyerSubscription> {
    const res = await apiClient.post<{ subscription: BuyerSubscription }>(`/api/buyer/subscriptions/${id}/cancel`, {});
    return res.subscription;
  },

  async skipNextRenewal(id: string): Promise<BuyerSubscription> {
    const res = await apiClient.post<{ subscription: BuyerSubscription }>(`/api/buyer/subscriptions/${id}/skip-next`, {});
    return res.subscription;
  },

  // ─── Buyer: renewal actions ─────────────────────────────────────────────
  async decideRenewalPriceChange(renewalId: string, decision: "accepted" | "declined"): Promise<Renewal> {
    const res = await apiClient.post<{ renewal: Renewal }>(`/api/renewals/${renewalId}/price-change`, { decision });
    return res.renewal;
  },

  async retryRenewalPayment(renewalId: string): Promise<Renewal> {
    const res = await apiClient.post<{ renewal: Renewal }>(`/api/renewals/${renewalId}/retry-payment`, {});
    return res.renewal;
  },

  // ─── Vendor: subscription offers ────────────────────────────────────────
  async createOffer(input: {
    title: string;
    description?: string;
    productIds: string[];
    frequencies: SubscriptionFrequency[];
    substitutionPolicy?: string;
    renewalCutoffHours?: number;
  }): Promise<SubscriptionOffer> {
    const res = await apiClient.post<{ offer: SubscriptionOffer }>("/api/vendor/subscription-offers", input);
    return res.offer;
  },

  async listMyOffers(): Promise<SubscriptionOffer[]> {
    const res = await apiClient.get<Items<SubscriptionOffer>>("/api/vendor/subscription-offers");
    return res.items ?? [];
  },

  async updateOffer(id: string, input: Partial<{
    title: string;
    description?: string;
    productIds: string[];
    frequencies: SubscriptionFrequency[];
    substitutionPolicy?: string;
    renewalCutoffHours?: number;
  }>): Promise<SubscriptionOffer> {
    const res = await apiClient.patch<{ offer: SubscriptionOffer }>(`/api/subscription-offers/${id}`, input);
    return res.offer;
  },

  async publishOffer(id: string): Promise<SubscriptionOffer> {
    const res = await apiClient.post<{ offer: SubscriptionOffer }>(`/api/subscription-offers/${id}/publish`, {});
    return res.offer;
  },

  async unpublishOffer(id: string): Promise<SubscriptionOffer> {
    const res = await apiClient.post<{ offer: SubscriptionOffer }>(`/api/subscription-offers/${id}/unpublish`, {});
    return res.offer;
  },

  // ─── Vendor: subscribers & renewals ─────────────────────────────────────
  async listMySubscribers(): Promise<BuyerSubscription[]> {
    const res = await apiClient.get<Items<BuyerSubscription>>("/api/vendor/subscribers");
    return res.items ?? [];
  },

  async listMyRenewals(): Promise<Renewal[]> {
    const res = await apiClient.get<Items<Renewal>>("/api/vendor/renewals");
    return res.items ?? [];
  },

  async confirmRenewalStock(renewalId: string): Promise<Renewal> {
    const res = await apiClient.post<{ renewal: Renewal }>(`/api/renewals/${renewalId}/stock-confirmation`, {});
    return res.renewal;
  },
};
