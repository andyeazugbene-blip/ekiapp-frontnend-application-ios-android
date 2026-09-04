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

/**
 * Vendor-facing renewal status labels. Spec §6.6: "Vendor sees 'Awaiting
 * buyer approval.'" — the buyer's own copy above ("Awaiting your price
 * approval") is correct on the buyer's screen but wrong when reused
 * verbatim on the vendor's, since there the vendor isn't the one waiting
 * on themselves.
 */
export const VENDOR_RENEWAL_STATUS_LABELS: Record<RenewalStatus, string> = {
  ...RENEWAL_STATUS_LABELS,
  AWAITING_PRICE_APPROVAL: "Awaiting buyer approval",
};

export interface OfferProduct {
  productId: string;
  product: { id: string; title: string; priceInCents: number; currency: string; imageUrl?: string | null };
  pausedAt?: string | null;
  pauseReason?: string | null;
}

export type OfferFulfilmentMethod = "DELIVERY" | "COLLECTION";
export type OfferSubstitutionMode = "NO_SUBSTITUTION" | "ASK_BUYER" | "ALLOW_SIMILAR";

export const FULFILMENT_METHOD_LABELS: Record<OfferFulfilmentMethod, string> = {
  DELIVERY: "Delivery",
  COLLECTION: "Collection",
};

export const SUBSTITUTION_MODE_LABELS: Record<OfferSubstitutionMode, string> = {
  NO_SUBSTITUTION: "Do not substitute",
  ASK_BUYER: "Ask buyer before substituting",
  ALLOW_SIMILAR: "Allow similar substitutions within buyer's limit",
};

export interface SubscriptionOffer {
  id: string;
  vendorId: string;
  vendor?: { id: string; storeName: string };
  title: string;
  description?: string | null;
  isActive: boolean;
  renewalsPaused?: boolean;
  renewalsPausedAt?: string | null;
  frequencies: SubscriptionFrequency[];
  substitutionPolicy?: string | null;
  substitutionMode: OfferSubstitutionMode;
  renewalCutoffHours: number;
  fulfilmentMethod: OfferFulfilmentMethod;
  preparationHours?: number | null;
  discountPercent?: number | null;
  maxPriceIncreaseApprovalBps?: number | null;
  products: OfferProduct[];
  createdAt: string;
}

export interface ReorderSuggestion {
  product: { id: string; title: string; priceInCents: number; currency: string; images: string[] };
  offer: { id: string; title: string; frequencies: SubscriptionFrequency[]; vendorStoreName: string };
  orderCount: number;
}

export interface RegularDeliveryInsights {
  activeSubscribers: number;
  pausedSubscribers: number;
  cancelledLast30Days: number;
  paidRenewalsLast30Days: number;
  revenueLast30Days: { currency: string; amount: number }[];
  upcomingRenewalsNext7Days: number;
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

export interface PublicOfferSummary {
  id: string;
  title: string;
  description?: string | null;
  frequencies: SubscriptionFrequency[];
  fulfilmentMethod: OfferFulfilmentMethod;
  discountPercent?: number | null;
  vendor: { id: string; storeName: string; avatar?: string | null; country?: string | null; city?: string | null };
  products: { productId: string; product: { id: string; title: string; priceInCents: number; currency: string; images: string[]; stock: number } }[];
}

export const regularDeliveriesService = {
  // ─── Public / buyer: offers ───────────────────────────────────────────
  async getOffer(offerId: string): Promise<SubscriptionOffer> {
    const res = await apiClient.get<{ offer: SubscriptionOffer }>(`/api/subscription-offers/${offerId}`, { skipAuth: true });
    return res.offer;
  },

  /** Real discovery — no previous purchase, deep link, or existing subscription required. */
  async listPublicOffers(filters?: { country?: string; vendorId?: string }): Promise<PublicOfferSummary[]> {
    const query = new URLSearchParams();
    if (filters?.country) query.set("country", filters.country);
    if (filters?.vendorId) query.set("vendorId", filters.vendorId);
    const suffix = query.toString() ? `?${query.toString()}` : "";
    const res = await apiClient.get<{ items?: PublicOfferSummary[] }>(`/api/subscription-offers/public${suffix}`, { skipAuth: true });
    return res.items ?? [];
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

  async getReorderSuggestions(): Promise<ReorderSuggestion[]> {
    const res = await apiClient.get<Items<ReorderSuggestion>>("/api/buyer/subscriptions/reorder-suggestions");
    return res.items ?? [];
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
    substitutionMode?: OfferSubstitutionMode;
    renewalCutoffHours?: number;
    fulfilmentMethod?: OfferFulfilmentMethod;
    preparationHours?: number | null;
    discountPercent?: number | null;
    maxPriceIncreaseApprovalBps?: number | null;
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
    substitutionMode?: OfferSubstitutionMode;
    renewalCutoffHours?: number;
    fulfilmentMethod?: OfferFulfilmentMethod;
    preparationHours?: number | null;
    discountPercent?: number | null;
    maxPriceIncreaseApprovalBps?: number | null;
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

  async pauseOfferRenewals(id: string): Promise<SubscriptionOffer> {
    const res = await apiClient.post<{ offer: SubscriptionOffer }>(`/api/subscription-offers/${id}/pause-renewals`, {});
    return res.offer;
  },

  async resumeOfferRenewals(id: string): Promise<SubscriptionOffer> {
    const res = await apiClient.post<{ offer: SubscriptionOffer }>(`/api/subscription-offers/${id}/resume-renewals`, {});
    return res.offer;
  },

  async pauseOfferProduct(offerId: string, productId: string, reason?: string): Promise<OfferProduct> {
    const res = await apiClient.post<{ product: OfferProduct }>(`/api/subscription-offers/${offerId}/products/${productId}/pause`, { reason });
    return res.product;
  },

  async resumeOfferProduct(offerId: string, productId: string): Promise<OfferProduct> {
    const res = await apiClient.post<{ product: OfferProduct }>(`/api/subscription-offers/${offerId}/products/${productId}/resume`, {});
    return res.product;
  },

  // ─── Vendor: subscribers & renewals ─────────────────────────────────────
  async listMySubscribers(): Promise<BuyerSubscription[]> {
    const res = await apiClient.get<Items<BuyerSubscription>>("/api/vendor/subscribers");
    return res.items ?? [];
  },

  async getSubscriberDetail(id: string): Promise<BuyerSubscription> {
    const res = await apiClient.get<{ subscription: BuyerSubscription }>(`/api/vendor/subscribers/${id}`);
    return res.subscription;
  },

  async listMyRenewals(): Promise<Renewal[]> {
    const res = await apiClient.get<Items<Renewal>>("/api/vendor/renewals");
    return res.items ?? [];
  },

  async confirmRenewalStock(renewalId: string): Promise<Renewal> {
    const res = await apiClient.post<{ renewal: Renewal }>(`/api/renewals/${renewalId}/stock-confirmation`, {});
    return res.renewal;
  },

  async getInsights(): Promise<RegularDeliveryInsights> {
    return apiClient.get<RegularDeliveryInsights>("/api/vendor/insights");
  },
};
