import { apiClient } from "../api";

// Field names match the real DeliveryZone Prisma model exactly (name,
// country, flag, baseFeeAmount, feePerKgAmount, currency, isActive) —
// there is no region/city/estimatedDays column on this model, and currency
// is always server-derived from country (never client-settable), matching
// admin-delivery-zones.controller.ts. A prior version of this file used
// baseFee/feePerKm/region/city/estimatedDays, which the backend has never
// accepted or returned — every create/update from this page 400'd, and the
// list view silently showed 0.00 fees for every real zone.
export interface DeliveryZone {
  id: string;
  name: string;
  country: string;
  flag: string | null;
  baseFeeAmount: number;
  feePerKgAmount: number;
  currency: string;
  isActive: boolean;
  createdAt: string;
}

function centsToUnit(value: unknown): number {
  return typeof value === "number" ? value / 100 : 0;
}

function normalizeDeliveryZone(raw: any): DeliveryZone {
  return {
    id: raw.id,
    name: raw.name ?? "",
    country: raw.country ?? "",
    flag: raw.flag ?? null,
    baseFeeAmount: centsToUnit(raw.baseFeeAmount),
    feePerKgAmount: centsToUnit(raw.feePerKgAmount),
    currency: (raw.currency ?? "GBP").toUpperCase(),
    isActive: raw.isActive ?? true,
    createdAt: raw.createdAt ?? "",
  };
}

export const deliveryZonesAPI = {
  async getZones(): Promise<DeliveryZone[]> {
    const res = await apiClient.get<any>("/admin/delivery-zones");
    return (res.items ?? res.zones ?? []).map(normalizeDeliveryZone);
  },

  async createZone(input: {
    name: string;
    country: string;
    flag?: string;
    baseFeeAmount: number;
    feePerKgAmount?: number;
  }): Promise<DeliveryZone> {
    const res = await apiClient.post<any>("/admin/delivery-zones", {
      name: input.name,
      country: input.country,
      flag: input.flag,
      baseFeeAmount: Math.round(input.baseFeeAmount * 100),
      feePerKgAmount: input.feePerKgAmount ? Math.round(input.feePerKgAmount * 100) : 0,
    });
    return normalizeDeliveryZone(res.zone ?? res);
  },

  async updateZone(zoneId: string, input: Partial<{
    name: string;
    country: string;
    flag: string;
    baseFeeAmount: number;
    feePerKgAmount: number;
    isActive: boolean;
  }>): Promise<DeliveryZone> {
    const payload: Record<string, unknown> = { ...input };
    if (input.baseFeeAmount !== undefined) payload.baseFeeAmount = Math.round(input.baseFeeAmount * 100);
    if (input.feePerKgAmount !== undefined) payload.feePerKgAmount = Math.round(input.feePerKgAmount * 100);
    const res = await apiClient.patch<any>(`/admin/delivery-zones/${zoneId}`, payload);
    return normalizeDeliveryZone(res.zone ?? res);
  },

  async deleteZone(zoneId: string): Promise<void> {
    await apiClient.delete(`/admin/delivery-zones/${zoneId}`);
  },

  async fixCurrencies(): Promise<{ checked: number; corrected: number; corrections: { id: string; country: string; from: string; to: string }[] }> {
    return apiClient.post("/admin/delivery-zones/fix-currencies", {});
  },
};
