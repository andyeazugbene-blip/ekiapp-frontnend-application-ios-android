import { apiClient } from "../api";
import { AdminCommissionTier, AdminSubscriptionPlan } from "@/types";

function normalizeTiers(raw: any): AdminCommissionTier[] {
  const tiers = Array.isArray(raw) ? raw : [];
  if (tiers.length === 0) {
    return [{ minSubtotalCents: 0, platformFeeBps: 1000, isActive: true, displayOrder: 0 }];
  }
  return tiers.map((tier: any, index: number) => ({
    id: tier.id,
    label: tier.label ?? null,
    minSubtotalCents: tier.minSubtotalCents ?? 0,
    maxSubtotalCents: tier.maxSubtotalCents ?? null,
    platformFeeBps: tier.platformFeeBps ?? 1000,
    isActive: tier.isActive ?? true,
    displayOrder: tier.displayOrder ?? index,
  }));
}

function normalizePlan(raw: any): AdminSubscriptionPlan {
  return {
    id: raw.id,
    plan: raw.plan,
    slug: raw.slug,
    name: raw.name,
    description: raw.description ?? null,
    monthlyPriceCents: raw.monthlyPriceCents ?? 0,
    platformFeeBps: raw.platformFeeBps ?? 1000,
    withdrawalFeeBps: raw.withdrawalFeeBps ?? 0,
    currency: raw.currency ?? "GBP",
    maxProducts: raw.maxProducts ?? 0,
    maxImagesPerProduct: raw.maxImagesPerProduct ?? 0,
    maxOrders: raw.maxOrders ?? null,
    maxCoupons: raw.maxCoupons ?? null,
    maxBundles: raw.maxBundles ?? null,
    analytics: Boolean(raw.analytics),
    prioritySupport: Boolean(raw.prioritySupport),
    flashSales: Boolean(raw.flashSales),
    bundles: Boolean(raw.bundles),
    discounts: Boolean(raw.discounts),
    marketingTools: Boolean(raw.marketingTools),
    customerDatabase: Boolean(raw.customerDatabase),
    repeatBuyerMarketing: Boolean(raw.repeatBuyerMarketing),
    professionalStorefront: Boolean(raw.professionalStorefront),
    orderManagement: Boolean(raw.orderManagement ?? true),
    storeLinkSharing: Boolean(raw.storeLinkSharing),
    canReceiveOrders: Boolean(raw.canReceiveOrders ?? true),
    isActive: Boolean(raw.isActive ?? true),
    isDefault: Boolean(raw.isDefault ?? false),
    displayOrder: raw.displayOrder ?? 0,
    commissionTiers: normalizeTiers(raw.commissionTiers),
  };
}

export const subscriptionPlansAPI = {
  async getPlans(): Promise<AdminSubscriptionPlan[]> {
    const response = await apiClient.get<any>("/admin/subscription-plans");
    return (response.plans ?? response.items ?? []).map(normalizePlan);
  },

  async savePlan(plan: Omit<AdminSubscriptionPlan, "id"> & { id?: string }): Promise<AdminSubscriptionPlan> {
    const response = await apiClient.post<any>("/admin/subscription-plans", plan);
    return normalizePlan(response.plan ?? response);
  },

  async deletePlan(planId: string): Promise<void> {
    await apiClient.delete(`/admin/subscription-plans/${planId}`);
  },
};
