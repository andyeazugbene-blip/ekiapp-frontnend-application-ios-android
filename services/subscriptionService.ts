/**
 * Subscription service for vendor plans, limits, and backend-derived entitlements.
 */
import { apiClient } from "./api";

export interface SubscriptionPlan {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  price: number;
  platformFeeBps: number;
  platformFeePercent: string;
  currency: string;
  interval: "month";
  features: string[];
  popular?: boolean;
  isActive?: boolean;
  displayOrder?: number;
}

export interface ActiveSubscription {
  id: string;
  planId: string;
  planName: string;
  slug: string;
  platformFeeBps?: number;
  platformFeePercent?: string;
  status: "active" | "cancelled" | "past_due";
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
}

export interface SubscriptionLimits {
  maxProducts: number;
  maxImagesPerProduct?: number;
  platformFeeBps?: number;
  platformFeePercent?: string;
  currentProducts: number;
  maxOrders: number | null;
  currentOrders: number;
  ordersRemaining: number | null;
  canReceiveOrders: boolean;
  canSendOffers: boolean;
  canAccessAnalytics: boolean;
  discounts?: boolean;
  bundles?: boolean;
  flashSales?: boolean;
  marketingTools?: boolean;
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
  const slug = typeof raw.slug === "string" && raw.slug.trim() ? raw.slug.trim().toLowerCase() : planSlug(plan);
  const price = typeof raw.monthlyPriceCents === "number" ? raw.monthlyPriceCents / 100 : raw.price ?? 0;
  const features = [
    `${raw.maxProducts === -1 ? "Unlimited" : raw.maxProducts} active products`,
    raw.analytics ? "Analytics access" : "Basic dashboard",
    raw.discounts ? "Discount campaigns" : "Standard product listings",
    raw.flashSales ? "Flash sales" : "Core sales tools",
    raw.marketingTools ? "Marketing tools" : "Store basics",
    raw.prioritySupport ? "Priority support" : "Standard support",
  ];

  return {
    id: raw.id ?? plan,
    name: PLAN_NAMES[plan] ?? `${plan.charAt(0)}${plan.slice(1).toLowerCase()} Plan`,
    slug,
    description: raw.description ?? null,
    price,
    platformFeeBps: typeof raw.platformFeeBps === "number" ? raw.platformFeeBps : 1000,
    platformFeePercent:
      typeof raw.platformFeePercent === "string"
        ? raw.platformFeePercent
        : `${((typeof raw.platformFeeBps === "number" ? raw.platformFeeBps : 1000) / 100).toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1")}%`,
    currency: raw.currency ?? "GBP",
    interval: "month",
    features,
    popular: raw.popular ?? plan === "GROWTH",
    isActive: raw.isActive ?? true,
    displayOrder: raw.displayOrder ?? 0,
  };
}

function normalizeSubscription(raw: any): ActiveSubscription {
  const sub = raw.subscription ?? raw;
  const plan = (sub.plan ?? "FREE").toString().toUpperCase();
  return {
    id: sub.id,
    planId: plan,
    planName: sub.planName ?? PLAN_NAMES[plan] ?? "Plan",
    slug: typeof sub.slug === "string" && sub.slug.trim() ? sub.slug.trim().toLowerCase() : planSlug(plan),
    platformFeeBps: typeof sub.platformFeeBps === "number" ? sub.platformFeeBps : undefined,
    platformFeePercent: typeof sub.platformFeePercent === "string" ? sub.platformFeePercent : undefined,
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
    maxImagesPerProduct: limits.maxImagesPerProduct ?? raw.maxImagesPerProduct ?? 0,
    platformFeeBps: typeof limits.platformFeeBps === "number" ? limits.platformFeeBps : undefined,
    platformFeePercent: typeof limits.platformFeePercent === "string" ? limits.platformFeePercent : undefined,
    currentProducts: limits.currentProducts ?? raw.currentProducts ?? 0,
    maxOrders,
    currentOrders: limits.currentOrders ?? raw.currentOrders ?? 0,
    ordersRemaining: limits.ordersRemaining ?? raw.ordersRemaining ?? null,
    canReceiveOrders: Boolean(limits.canReceiveOrders ?? raw.canReceiveOrders ?? true),
    canSendOffers: Boolean(
      limits.canSendOffers ??
        raw.canSendOffers ??
        (limits.marketingTools || limits.discounts || limits.bundles || limits.flashSales)
    ),
    canAccessAnalytics: Boolean(limits.canAccessAnalytics ?? raw.canAccessAnalytics ?? limits.analytics),
    discounts: Boolean(limits.discounts ?? raw.discounts ?? false),
    bundles: Boolean(limits.bundles ?? raw.bundles ?? false),
    flashSales: Boolean(limits.flashSales ?? raw.flashSales ?? false),
    marketingTools: Boolean(limits.marketingTools ?? raw.marketingTools ?? false),
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
