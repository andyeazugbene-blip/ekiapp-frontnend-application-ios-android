/**
 * Subscription service for vendor plans, limits, and backend-derived entitlements.
 */
import { apiClient } from "./api";

export interface SubscriptionPlan {
  id: string;
  plan?: string;
  legacyPlan?: string | null;
  name: string;
  slug: string;
  description?: string | null;
  price: number;
  monthlyPriceCents?: number;
  platformFeeBps: number;
  defaultPlatformFeeBps?: number;
  platformFeePercent: string;
  withdrawalFeeBps?: number;
  withdrawalFeePercent?: string;
  currency: string;
  interval: "month";
  features: string[];
  commissionTiers?: CommissionTier[];
  popular?: boolean;
  isActive?: boolean;
  displayOrder?: number;
}

export interface CommissionTier {
  id?: string;
  label?: string | null;
  minSubtotalCents: number;
  maxSubtotalCents?: number | null;
  platformFeeBps: number;
  platformFeePercent?: string;
  isActive?: boolean;
  displayOrder?: number;
}

export interface ActiveSubscription {
  id: string;
  planId: string;
  planName: string;
  slug: string;
  sellerPlanId?: string | null;
  platformFeeBps?: number;
  platformFeePercent?: string;
  withdrawalFeeBps?: number;
  withdrawalFeePercent?: string;
  commissionTiers?: CommissionTier[];
  status: "active" | "cancelled" | "past_due";
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
}

export interface SubscriptionLimits {
  maxProducts: number;
  maxImagesPerProduct?: number;
  platformFeeBps?: number;
  platformFeePercent?: string;
  withdrawalFeeBps?: number;
  withdrawalFeePercent?: string;
  commissionTiers?: CommissionTier[];
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

export interface WebSubscriptionCheckout {
  checkoutUrl: string;
}

export type PaidSubscriptionPlan = string;

const PLAN_NAMES: Record<string, string> = {
  FREE: "Free Plan",
  BASIC: "Basic Plan",
  GROWTH: "Growth Plan",
  PREMIUM: "Premium Plan",
  PRO: "Pro Plan",
};

function planSlug(plan: string): SubscriptionPlan["slug"] {
  if (plan === "FREE") return "starter";
  if (plan === "PRO" || plan === "PREMIUM") return "pro";
  return "growth";
}

function percentFromBps(value: number): string {
  return `${(value / 100).toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1")}%`;
}

function normalizeTier(raw: any): CommissionTier {
  const bps = typeof raw.platformFeeBps === "number" ? raw.platformFeeBps : 0;
  return {
    id: raw.id,
    label: raw.label ?? null,
    minSubtotalCents: raw.minSubtotalCents ?? 0,
    maxSubtotalCents: raw.maxSubtotalCents ?? null,
    platformFeeBps: bps,
    platformFeePercent: typeof raw.platformFeePercent === "string" ? raw.platformFeePercent : percentFromBps(bps),
    isActive: raw.isActive ?? true,
    displayOrder: raw.displayOrder ?? 0,
  };
}

function normalizePlan(raw: any): SubscriptionPlan {
  const plan = (raw.plan ?? raw.id ?? "FREE").toString().toUpperCase();
  const slug = typeof raw.slug === "string" && raw.slug.trim() ? raw.slug.trim().toLowerCase() : planSlug(plan);
  const price = typeof raw.monthlyPriceCents === "number" ? raw.monthlyPriceCents / 100 : raw.price ?? 0;
  const platformFeeBps =
    typeof raw.platformFeeBps === "number"
      ? raw.platformFeeBps
      : typeof raw.defaultPlatformFeeBps === "number"
        ? raw.defaultPlatformFeeBps
        : 1000;
  const withdrawalFeeBps = typeof raw.withdrawalFeeBps === "number" ? raw.withdrawalFeeBps : undefined;
  const commissionTiers = Array.isArray(raw.commissionTiers) ? raw.commissionTiers.map(normalizeTier) : [];
  const features = [
    `${raw.maxProducts === -1 ? "Unlimited" : raw.maxProducts} active products`,
    `${typeof raw.withdrawalFeePercent === "string" ? raw.withdrawalFeePercent : withdrawalFeeBps != null ? percentFromBps(withdrawalFeeBps) : "Configurable"} withdrawal fee`,
    raw.analytics ? "Analytics access" : "Basic dashboard",
    raw.discounts ? "Discount campaigns" : "Standard product listings",
    raw.flashSales ? "Flash sales" : "Core sales tools",
    raw.marketingTools ? "Marketing tools" : "Store basics",
    raw.prioritySupport ? "Priority support" : "Standard support",
  ];

  return {
    id: raw.id ?? plan,
    plan,
    legacyPlan: raw.legacyPlan ?? null,
    name: raw.name ?? PLAN_NAMES[plan] ?? `${plan.charAt(0)}${plan.slice(1).toLowerCase()} Plan`,
    slug,
    description: raw.description ?? null,
    price,
    monthlyPriceCents: raw.monthlyPriceCents,
    platformFeeBps,
    defaultPlatformFeeBps: raw.defaultPlatformFeeBps,
    platformFeePercent:
      typeof raw.platformFeePercent === "string"
        ? raw.platformFeePercent
        : percentFromBps(platformFeeBps),
    withdrawalFeeBps,
    withdrawalFeePercent:
      typeof raw.withdrawalFeePercent === "string"
        ? raw.withdrawalFeePercent
        : withdrawalFeeBps != null
          ? percentFromBps(withdrawalFeeBps)
          : undefined,
    currency: raw.currency ?? "GBP",
    interval: "month",
    features,
    commissionTiers,
    popular: raw.popular ?? slug === "growth",
    isActive: raw.isActive ?? true,
    displayOrder: raw.displayOrder ?? 0,
  };
}

function normalizeSubscription(raw: any): ActiveSubscription {
  const sub = raw.subscription ?? raw;
  const plan = (sub.plan ?? "FREE").toString().toUpperCase();
  return {
    id: sub.id,
    planId: sub.sellerPlanId ?? sub.planId ?? plan,
    planName: sub.planName ?? PLAN_NAMES[plan] ?? "Plan",
    slug: typeof sub.slug === "string" && sub.slug.trim() ? sub.slug.trim().toLowerCase() : planSlug(plan),
    sellerPlanId: sub.sellerPlanId ?? null,
    platformFeeBps: typeof sub.platformFeeBps === "number" ? sub.platformFeeBps : undefined,
    platformFeePercent: typeof sub.platformFeePercent === "string" ? sub.platformFeePercent : undefined,
    withdrawalFeeBps: typeof sub.withdrawalFeeBps === "number" ? sub.withdrawalFeeBps : undefined,
    withdrawalFeePercent: typeof sub.withdrawalFeePercent === "string" ? sub.withdrawalFeePercent : undefined,
    commissionTiers: Array.isArray(sub.commissionTiers) ? sub.commissionTiers.map(normalizeTier) : [],
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
    withdrawalFeeBps: typeof limits.withdrawalFeeBps === "number" ? limits.withdrawalFeeBps : undefined,
    withdrawalFeePercent: typeof limits.withdrawalFeePercent === "string" ? limits.withdrawalFeePercent : undefined,
    commissionTiers: Array.isArray(limits.commissionTiers) ? limits.commissionTiers.map(normalizeTier) : [],
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

  async createWebCheckout(email: string, plan: PaidSubscriptionPlan): Promise<WebSubscriptionCheckout> {
    return apiClient.post<WebSubscriptionCheckout>(
      "/api/subscriptions/web-checkout",
      { email: email.trim().toLowerCase(), plan },
      { skipAuth: true },
    );
  },

  async getCurrentSubscription(): Promise<ActiveSubscription | null> {
    const res = await apiClient.get<any>("/api/subscriptions/me");
    return normalizeSubscription(res.subscription ?? res);
  },

  async getLimits(): Promise<SubscriptionLimits> {
    const res = await apiClient.get<any>("/api/subscriptions/me/limits");
    return normalizeLimits(res);
  },

};
