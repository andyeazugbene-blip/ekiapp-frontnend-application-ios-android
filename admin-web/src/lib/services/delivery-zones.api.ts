import { apiClient } from "../api";

export interface DeliveryZone {
  id: string;
  name: string;
  country: string;
  region: string | null;
  city: string | null;
  baseFee: number;
  feePerKm: number;
  currency: string;
  isActive: boolean;
  estimatedDays: number;
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
    region: raw.region ?? null,
    city: raw.city ?? null,
    baseFee: centsToUnit(raw.baseFee),
    feePerKm: centsToUnit(raw.feePerKm ?? 0),
    currency: (raw.currency ?? "GBP").toUpperCase(),
    isActive: raw.isActive ?? true,
    estimatedDays: raw.estimatedDays ?? 0,
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
    region?: string;
    city?: string;
    baseFee: number;
    feePerKm?: number;
    currency: string;
    estimatedDays: number;
  }): Promise<DeliveryZone> {
    const res = await apiClient.post<any>("/admin/delivery-zones", {
      ...input,
      baseFee: Math.round(input.baseFee * 100),
      feePerKm: input.feePerKm ? Math.round(input.feePerKm * 100) : undefined,
    });
    return normalizeDeliveryZone(res.zone ?? res);
  },

  async updateZone(zoneId: string, input: Partial<{
    name: string;
    country: string;
    region: string;
    city: string;
    baseFee: number;
    feePerKm: number;
    currency: string;
    isActive: boolean;
    estimatedDays: number;
  }>): Promise<DeliveryZone> {
    const payload: Record<string, unknown> = { ...input };
    if (input.baseFee !== undefined) payload.baseFee = Math.round(input.baseFee * 100);
    if (input.feePerKm !== undefined) payload.feePerKm = Math.round(input.feePerKm * 100);
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
