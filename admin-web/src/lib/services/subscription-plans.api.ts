import { apiClient } from "../api";
import { AdminSubscriptionPlan } from "@/types";

function normalizePlan(raw: any): AdminSubscriptionPlan {
  return {
    id: raw.id,
    plan: raw.plan,
    slug: raw.slug,
    name: raw.name,
    description: raw.description ?? null,
    monthlyPriceCents: raw.monthlyPriceCents ?? 0,
    platformFeeBps: raw.platformFeeBps ?? 1000,
    currency: raw.currency ?? "GBP",
    maxProducts: raw.maxProducts ?? 0,
    maxImagesPerProduct: raw.maxImagesPerProduct ?? 0,
    maxOrders: raw.maxOrders ?? null,
    analytics: Boolean(raw.analytics),
    prioritySupport: Boolean(raw.prioritySupport),
    flashSales: Boolean(raw.flashSales),
    bundles: Boolean(raw.bundles),
    discounts: Boolean(raw.discounts),
    marketingTools: Boolean(raw.marketingTools),
    canReceiveOrders: Boolean(raw.canReceiveOrders ?? true),
    isActive: Boolean(raw.isActive ?? true),
    displayOrder: raw.displayOrder ?? 0,
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
