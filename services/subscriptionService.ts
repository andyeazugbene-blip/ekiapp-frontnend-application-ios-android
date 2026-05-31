/**
 * Subscription service for vendor plans, limits, and backend-derived entitlements.
 */
import { apiClient } from "./api";

export interface SubscriptionPlan {
  id: string;
  name: string;
  slug: "free" | "growth" | "pro";
  price: number;
  currency: string;
  interval: "month";
  features: string[];
  popular?: boolean;
}

export interface ActiveSubscription {
  id: string;
  planId: string;
  planName: string;
  slug: "free" | "growth" | "pro";
  status: "active" | "cancelled" | "past_due";
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
}

export interface SubscriptionLimits {
  maxProducts: number;
  currentProducts: number;
  maxOrders: number | null;
  currentOrders: number;
  ordersRemaining: number | null;
  canReceiveOrders: boolean;
  canSendOffers: boolean;
  canAccessAnalytics: boolean;
}

const PLAN_NAMES: Record<string, string> = {
  FREE: "Free Plan",
  BASIC: "Basic Plan",
  GROWTH: "Growth Plan",
  PREMIUM: "Premium Plan",
  PRO: "Pro Plan",
};

export const SUBSCRIPTIONS_NOT_AVAILABLE_CODE = "SUBSCRIPTIONS_NOT_AVAILABLE";

export class PaidPlanActivationNotAvailableError extends Error {
  status = 409;
  code = SUBSCRIPTIONS_NOT_AVAILABLE_CODE;

  constructor() {
    super("This feature is not available on your current plan.");
    this.name = "PaidPlanActivationNotAvailableError";
  }
}

function planSlug(plan: string): SubscriptionPlan["slug"] {
  if (plan === "FREE") return "free";
  if (plan === "PRO" || plan === "PREMIUM") return "pro";
  return "growth";
}

function backendPlan(planId: string): string {
  return planId.replace(/^plan_/, "").toUpperCase();
}

function normalizePlan(raw: any): SubscriptionPlan {
  const plan = (raw.plan ?? raw.id ?? "FREE").toString().toUpperCase();
  const price = typeof raw.monthlyPriceCents === "number" ? raw.monthlyPriceCents / 100 : raw.price ?? 0;
  const features = [
    `${raw.maxProducts === -1 ? "Unlimited" : raw.maxProducts} active products`,
    raw.analytics ? "Analytics access" : "Basic dashboard",
    raw.discounts ? "Discount campaigns" : "Standard product listings",
    raw.flashSales ? "Flash sales" : "Core sales tools",
    raw.prioritySupport ? "Priority support" : "Standard support",
  ];

  return {
    id: plan,
    name: PLAN_NAMES[plan] ?? `${plan.charAt(0)}${plan.slice(1).toLowerCase()} Plan`,
    slug: planSlug(plan),
    price,
    currency: "GBP",
    interval: "month",
    features,
    popular: plan === "GROWTH",
  };
}

function normalizeSubscription(raw: any): ActiveSubscription {
  const sub = raw.subscription ?? raw;
  const plan = (sub.plan ?? "FREE").toString().toUpperCase();
  return {
    id: sub.id,
    planId: plan,
    planName: PLAN_NAMES[plan] ?? "Plan",
    slug: planSlug(plan),
    status: (sub.status ?? "ACTIVE").toString().toLowerCase(),
    currentPeriodEnd: sub.currentPeriodEnd ?? "",
    cancelAtPeriodEnd: Boolean(sub.cancelAtPeriodEnd ?? sub.cancelledAt),
  } as ActiveSubscription;
}

function normalizeLimits(raw: any): SubscriptionLimits {
  const limits = raw.limits ?? raw;
  const maxProducts = limits.maxProducts === -1 ? Number.MAX_SAFE_INTEGER : limits.maxProducts ?? 0;
  const maxOrders =
    limits.maxOrders === -1
      ? null
      : typeof limits.maxOrders === "number"
        ? limits.maxOrders
        : typeof raw.maxOrders === "number"
          ? raw.maxOrders
          : null;
  return {
    maxProducts,
    currentProducts: limits.currentProducts ?? raw.currentProducts ?? 0,
    maxOrders,
    currentOrders: limits.currentOrders ?? raw.currentOrders ?? 0,
    ordersRemaining: limits.ordersRemaining ?? raw.ordersRemaining ?? null,
    canReceiveOrders: Boolean(limits.canReceiveOrders ?? raw.canReceiveOrders ?? false),
    canSendOffers: Boolean(
      limits.canSendOffers ?? raw.canSendOffers ?? (limits.discounts || limits.bundles || limits.flashSales)
    ),
    canAccessAnalytics: Boolean(limits.canAccessAnalytics ?? raw.canAccessAnalytics ?? limits.analytics),
  };
}

export const subscriptionService = {
  async getPlans(): Promise<SubscriptionPlan[]> {
    const res = await apiClient.get<{ plans: any[] }>("/api/subscriptions/plans", { skipAuth: true });
    return (res.plans ?? []).map(normalizePlan);
  },

  async getCurrentSubscription(): Promise<ActiveSubscription | null> {
    const res = await apiClient.get<any>("/api/subscriptions/me");
    return normalizeSubscription(res.subscription ?? res);
  },

  async getLimits(): Promise<SubscriptionLimits> {
    const res = await apiClient.get<any>("/api/subscriptions/me/limits");
    return normalizeLimits(res);
  },

  async activatePlan(planId: string): Promise<ActiveSubscription> {
    const plan = backendPlan(planId);
    if (plan !== "FREE") {
      throw new PaidPlanActivationNotAvailableError();
    }

    const res = await apiClient.post<any>("/api/subscriptions/activate", { plan });
    return normalizeSubscription(res.subscription ?? res);
  },

  async cancel(): Promise<{ cancelAtPeriodEnd: boolean }> {
    const res = await apiClient.post<any>("/api/subscriptions/cancel", {});
    return { cancelAtPeriodEnd: Boolean(res.subscription?.cancelledAt ?? res.cancelAtPeriodEnd) };
  },
};
