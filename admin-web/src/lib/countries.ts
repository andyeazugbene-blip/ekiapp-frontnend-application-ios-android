/**
 * The single authoritative country-name resolver for admin-web. Scoped to
 * exactly Eki's 10 approved launch markets (same set the backend enforces —
 * see ekiapp-backend-main/src/shared/currency.ts). Admin screens must never
 * render a raw MarketConfig.countryCode ("GB", "US") directly — always
 * resolve it through this file first.
 */

export interface CountryEntry {
  code: string;
  name: string;
}

export const COUNTRIES: CountryEntry[] = [
  { code: "GB", name: "United Kingdom" },
  { code: "US", name: "United States" },
  { code: "CA", name: "Canada" },
  { code: "FR", name: "France" },
  { code: "ES", name: "Spain" },
  { code: "PT", name: "Portugal" },
  { code: "CH", name: "Switzerland" },
  { code: "BE", name: "Belgium" },
  { code: "IT", name: "Italy" },
  { code: "HR", name: "Croatia" },
];

export const COUNTRY_NAMES: string[] = COUNTRIES.map((c) => c.name);

const ALIAS_TO_NAME: Record<string, string> = { uk: "United Kingdom", usa: "United States" };

/**
 * Accepts a full name ("United Kingdom"), a common alias ("UK"), or an ISO
 * code ("GB", "gb") — always returns the canonical full name, never a raw
 * code. Falls back to the original value for anything unrecognized (a
 * legacy/grandfathered non-launch-market value) rather than hiding real data.
 */
export function countryDisplayName(value: string | null | undefined): string {
  if (!value) return "";
  const trimmed = value.trim();
  const lower = trimmed.toLowerCase();
  const byCode = COUNTRIES.find((c) => c.code.toLowerCase() === lower);
  if (byCode) return byCode.name;
  const byName = COUNTRIES.find((c) => c.name.toLowerCase() === lower);
  if (byName) return byName.name;
  if (ALIAS_TO_NAME[lower]) return ALIAS_TO_NAME[lower];
  return trimmed;
}

/** ISO code for a launch-market country name/alias, or null if not one of the 10. */
export function countryCodeForName(value: string | null | undefined): string | null {
  if (!value) return null;
  const lower = value.trim().toLowerCase();
  const byName = COUNTRIES.find((c) => c.name.toLowerCase() === lower);
  if (byName) return byName.code;
  if (lower === "uk") return "GB";
  if (lower === "usa") return "US";
  const byCode = COUNTRIES.find((c) => c.code.toLowerCase() === lower);
  return byCode?.code ?? null;
}
