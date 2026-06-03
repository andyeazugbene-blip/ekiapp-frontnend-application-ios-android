import { apiClient } from "../api";
import { PromoCode } from "@/types";

function normalizePromoCode(raw: any): PromoCode {
  return {
    id: raw.id,
    vendorId: raw.vendorId,
    storeSlug: raw.storeSlug ?? raw.vendor?.storeSlug,
    code: raw.code ?? "",
    type: raw.type ?? "PERCENTAGE",
    value: typeof raw.value === "number" ? raw.value : 0,
    minOrderAmount: typeof raw.minOrderAmount === "number" ? raw.minOrderAmount / 100 : null,
    maxUses: typeof raw.maxUses === "number" ? raw.maxUses : null,
    usedCount: typeof raw.usedCount === "number" ? raw.usedCount : 0,
    validFrom: raw.validFrom ?? "",
    validUntil: raw.validUntil ?? null,
    isActive: raw.isActive ?? true,
    createdAt: raw.createdAt ?? "",
  };
}

export const promoCodesAPI = {
  async getPromoCodes(): Promise<PromoCode[]> {
    const res = await apiClient.get<any>("/admin/promo-codes");
    return (res.promoCodes ?? res.items ?? []).map(normalizePromoCode);
  },

  async createPromoCode(input: {
    vendorId: string;
    code: string;
    type: "PERCENTAGE" | "FIXED_AMOUNT";
    value: number;
    minOrderAmount?: number;
    maxUses?: number;
    validFrom?: string;
    validUntil?: string;
  }): Promise<PromoCode> {
    const res = await apiClient.post<any>("/admin/promo-codes", {
      code: input.code.trim().toUpperCase(),
      vendorId: input.vendorId,
      type: input.type,
      value: input.value,
      minOrderAmount: input.minOrderAmount ? Math.round(input.minOrderAmount * 100) : undefined,
      maxUses: input.maxUses,
      validFrom: input.validFrom,
      validUntil: input.validUntil,
    });
    return normalizePromoCode(res.promoCode ?? res);
  },

  async updatePromoCode(
    promoId: string,
    input: {
      isActive?: boolean;
      maxUses?: number;
      validUntil?: string | null;
    },
  ): Promise<PromoCode> {
    const res = await apiClient.patch<any>(`/admin/promo-codes/${promoId}`, input);
    return normalizePromoCode(res.promoCode ?? res);
  },
};
