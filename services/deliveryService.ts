/**
 * Delivery service for vendor delivery zones and buyer checkout zone lookup.
 */
import { apiClient } from "./api";

export type DeliveryCountryCode = "UK" | "US" | "CA" | "EU";

export interface DeliveryZone {
  id: string;
  country: string;
  countryCode: DeliveryCountryCode;
  currency: string;
  costPerKg: number;
  minimumFee: number;
  maxWeightKg: number;
  estimatedDays: string;
  notes?: string;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface DeliveryZoneInput {
  country: string;
  countryCode: DeliveryCountryCode;
  currency?: string;
  costPerKg: number;
  minimumFee: number;
  maxWeightKg: number;
  estimatedDays: string;
  notes?: string;
  active?: boolean;
}

interface DeliveryZoneListResponse {
  zones?: any[];
  items?: any[];
}

interface DeliveryZoneResponse {
  zone: any;
}

export const COUNTRY_LABEL: Record<DeliveryCountryCode, string> = {
  UK: "United Kingdom",
  US: "United States",
  CA: "Canada",
  EU: "Europe",
};

export const EUROPEAN_REGION_LABEL = "Europe (EU countries)";

export const EUROPEAN_COUNTRY_NAMES = [
  "austria",
  "belgium",
  "bulgaria",
  "croatia",
  "cyprus",
  "czech republic",
  "czechia",
  "denmark",
  "estonia",
  "finland",
  "france",
  "germany",
  "greece",
  "hungary",
  "ireland",
  "italy",
  "latvia",
  "lithuania",
  "luxembourg",
  "malta",
  "netherlands",
  "poland",
  "portugal",
  "romania",
  "slovakia",
  "slovenia",
  "spain",
  "sweden",
].sort();

export const COUNTRY_CURRENCY: Record<DeliveryCountryCode, string> = {
  UK: "GBP",
  US: "USD",
  CA: "CAD",
  EU: "EUR",
};

export function isEuropeanCountry(rawCountry: string | undefined): boolean {
  const country = (rawCountry ?? "").trim().toLowerCase();
  if (!country) return false;
  if (country === "eu" || country.includes("europe")) return true;
  return EUROPEAN_COUNTRY_NAMES.includes(country);
}

function countryCodeFor(rawCountry: string | undefined): DeliveryCountryCode {
  const country = (rawCountry ?? "").toLowerCase();
  if (isEuropeanCountry(country)) return "EU";
  const match = Object.entries(COUNTRY_LABEL).find(([, label]) => label.toLowerCase() === country);
  return (match?.[0] ?? "UK") as DeliveryCountryCode;
}

export function matchesDeliveryZoneCountry(
  zone: { countryCode?: string; country?: string },
  country: string,
): boolean {
  const normalizedCountry = country.trim().toLowerCase();
  const zoneCode = (zone.countryCode ?? "").trim().toLowerCase();
  const zoneCountry = (zone.country ?? "").trim().toLowerCase();

  if (!normalizedCountry) return false;

  if (isEuropeanCountry(normalizedCountry)) {
    return zoneCode === "eu" || zoneCountry === "eu" || zoneCountry.includes("europe");
  }

  const shortCode =
    normalizedCountry === "uk" || normalizedCountry.includes("united kingdom")
      ? "uk"
      : normalizedCountry === "us" || normalizedCountry === "usa" || normalizedCountry.includes("united states")
        ? "us"
        : normalizedCountry.includes("canada")
          ? "ca"
          : normalizedCountry;

  return (
    zoneCode === normalizedCountry ||
    zoneCode === shortCode ||
    zoneCountry === normalizedCountry ||
    zoneCountry.includes(normalizedCountry) ||
    zoneCountry.includes(shortCode)
  );
}

function normalizeZone(raw: any): DeliveryZone {
  const countryCode = countryCodeFor(raw.country);
  return {
    id: raw.id,
    country: raw.country ?? COUNTRY_LABEL[countryCode],
    countryCode,
    currency: (raw.currency ?? COUNTRY_CURRENCY[countryCode]).toUpperCase(),
    costPerKg: typeof raw.feePerKgAmount === "number" ? raw.feePerKgAmount / 100 : raw.costPerKg ?? 0,
    minimumFee: typeof raw.baseFeeAmount === "number" ? raw.baseFeeAmount / 100 : raw.minimumFee ?? 0,
    maxWeightKg: raw.maxWeightKg ?? 30,
    estimatedDays: raw.estimatedDays ?? "5-10 days",
    notes: raw.notes,
    active: raw.isActive ?? raw.active ?? true,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

function toBackendZoneInput(input: DeliveryZoneInput): Record<string, unknown> {
  return {
    name: input.country,
    country: input.country,
    baseFeeAmount: Math.round((input.minimumFee ?? 0) * 100),
    feePerKgAmount: Math.round((input.costPerKg ?? 0) * 100),
    currency: (input.currency ?? COUNTRY_CURRENCY[input.countryCode]).toLowerCase(),
    isActive: input.active ?? true,
  };
}

function toBackendZonePatch(patch: Partial<DeliveryZoneInput>): Record<string, unknown> {
  const backendPatch: Record<string, unknown> = {};
  if (patch.country !== undefined) {
    backendPatch.country = patch.country;
    backendPatch.name = patch.country;
  }
  if (patch.minimumFee !== undefined) backendPatch.baseFeeAmount = Math.round(patch.minimumFee * 100);
  if (patch.costPerKg !== undefined) backendPatch.feePerKgAmount = Math.round(patch.costPerKg * 100);
  if (patch.currency !== undefined) backendPatch.currency = patch.currency.toLowerCase();
  if (patch.active !== undefined) backendPatch.isActive = patch.active;
  return backendPatch;
}

export const deliveryService = {
  async listZones(): Promise<DeliveryZone[]> {
    const res = await apiClient.get<DeliveryZoneListResponse>("/api/delivery/zones/me");
    return (res.zones ?? res.items ?? []).map(normalizeZone);
  },

  async listAllZones(): Promise<DeliveryZone[]> {
    const res = await apiClient.get<DeliveryZoneListResponse>("/api/delivery/zones");
    return (res.zones ?? res.items ?? []).map(normalizeZone);
  },

  async createZone(input: DeliveryZoneInput): Promise<DeliveryZone> {
    const res = await apiClient.post<DeliveryZoneResponse>("/api/delivery/zones/me", toBackendZoneInput(input));
    return normalizeZone(res.zone);
  },

  async updateZone(zoneId: string, patch: Partial<DeliveryZoneInput>): Promise<DeliveryZone> {
    const res = await apiClient.patch<DeliveryZoneResponse>(
      `/api/delivery/zones/me/${zoneId}`,
      toBackendZonePatch(patch),
    );
    return normalizeZone(res.zone);
  },

  async setZoneActive(zoneId: string, active: boolean): Promise<DeliveryZone> {
    return this.updateZone(zoneId, { active });
  },

  async deleteZone(zoneId: string): Promise<{ success: true; id: string }> {
    return apiClient.delete<{ success: true; id: string }>(`/api/delivery/zones/me/${zoneId}`);
  },
};
