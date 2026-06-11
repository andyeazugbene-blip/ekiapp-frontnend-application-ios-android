/**
 * Promo service for buyer promo code validation.
 */
import { apiClient } from "./api";

export interface PromoValidationResult {
  valid: boolean;
  discountAmount: number;
  code: string;
  type: "PERCENTAGE" | "FIXED_AMOUNT";
  value: number;
  vendorId: string;
  storeSlug: string;
}

export const promoService = {
  async validatePromo(code: string, orderAmount: number, vendorId?: string, storeSlug?: string): Promise<PromoValidationResult> {
    const res = await apiClient.post<PromoValidationResult | { promo: PromoValidationResult }>("/api/promo-codes/validate", {
      code,
      orderAmount,
      vendorId,
      storeSlug,
    });
    return "promo" in res ? res.promo : res;
  },
};
