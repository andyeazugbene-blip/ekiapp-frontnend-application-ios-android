/**
 * The single authoritative country-name resolver for admin-web. Covers every
 * market the backend seeds (market-configuration.service.ts INITIAL_MARKETS:
 * GB/US/CA + every European market) so admin screens never render a raw
 * MarketConfig.countryCode ("AT") - always resolve it through this file.
 * Handbook 14.9 display format: "Austria (AT) - EUR" (see marketLabel()).
 */

export interface CountryEntry {
  code: string;
  name: string;
  /** Default currency the backend seeds for this market (display fallback only - the market row is authoritative). */
  currency: string;
}

export const COUNTRIES: CountryEntry[] = [
  { code: "GB", name: "United Kingdom", currency: "GBP" },
  { code: "US", name: "United States", currency: "USD" },
  { code: "CA", name: "Canada", currency: "CAD" },
  { code: "FR", name: "France", currency: "EUR" },
  { code: "ES", name: "Spain", currency: "EUR" },
  { code: "PT", name: "Portugal", currency: "EUR" },
  { code: "CH", name: "Switzerland", currency: "CHF" },
  { code: "BE", name: "Belgium", currency: "EUR" },
  { code: "IT", name: "Italy", currency: "EUR" },
  { code: "HR", name: "Croatia", currency: "EUR" },
  { code: "DE", name: "Germany", currency: "EUR" },
  { code: "NL", name: "Netherlands", currency: "EUR" },
  { code: "AT", name: "Austria", currency: "EUR" },
  { code: "IE", name: "Ireland", currency: "EUR" },
  { code: "LU", name: "Luxembourg", currency: "EUR" },
  { code: "GR", name: "Greece", currency: "EUR" },
  { code: "CY", name: "Cyprus", currency: "EUR" },
  { code: "MT", name: "Malta", currency: "EUR" },
  { code: "SI", name: "Slovenia", currency: "EUR" },
  { code: "SK", name: "Slovakia", currency: "EUR" },
  { code: "EE", name: "Estonia", currency: "EUR" },
  { code: "LV", name: "Latvia", currency: "EUR" },
  { code: "LT", name: "Lithuania", currency: "EUR" },
  { code: "FI", name: "Finland", currency: "EUR" },
  { code: "PL", name: "Poland", currency: "PLN" },
  { code: "CZ", name: "Czechia", currency: "CZK" },
  { code: "HU", name: "Hungary", currency: "HUF" },
  { code: "RO", name: "Romania", currency: "RON" },
  { code: "BG", name: "Bulgaria", currency: "BGN" },
  { code: "DK", name: "Denmark", currency: "DKK" },
  { code: "SE", name: "Sweden", currency: "SEK" },
  { code: "NO", name: "Norway", currency: "NOK" },
  { code: "IS", name: "Iceland", currency: "ISK" },
  { code: "LI", name: "Liechtenstein", currency: "CHF" },
  { code: "MC", name: "Monaco", currency: "EUR" },
  { code: "AD", name: "Andorra", currency: "EUR" },
  { code: "SM", name: "San Marino", currency: "EUR" },
  { code: "BA", name: "Bosnia and Herzegovina", currency: "BAM" },
  { code: "RS", name: "Serbia", currency: "RSD" },
  { code: "ME", name: "Montenegro", currency: "EUR" },
  { code: "MK", name: "North Macedonia", currency: "MKD" },
  { code: "AL", name: "Albania", currency: "ALL" },
  { code: "MD", name: "Moldova", currency: "MDL" },
];

/**
 * Extra countries offered ONLY by the "Add market" picker (e.g. Africa, which is
 * built but deliberately not launched). Names resolve everywhere via
 * countryDisplayName(); they are not part of COUNTRIES so launch pickers stay accurate.
 */
export const ADDABLE_MARKETS: CountryEntry[] = [
  { code: "NG", name: "Nigeria", currency: "NGN" },
  { code: "GH", name: "Ghana", currency: "GHS" },
  { code: "KE", name: "Kenya", currency: "KES" },
  { code: "ZA", name: "South Africa", currency: "ZAR" },
  { code: "EG", name: "Egypt", currency: "EGP" },
  { code: "TZ", name: "Tanzania", currency: "TZS" },
  { code: "UG", name: "Uganda", currency: "UGX" },
  { code: "SN", name: "Senegal", currency: "XOF" },
  { code: "CI", name: "Cote d'Ivoire", currency: "XOF" },
  { code: "AU", name: "Australia", currency: "AUD" },
  { code: "NZ", name: "New Zealand", currency: "NZD" },
];

export const COUNTRY_NAMES: string[] = COUNTRIES.map((c) => c.name);

const ALL = [...COUNTRIES, ...ADDABLE_MARKETS];
const ALIAS_TO_NAME: Record<string, string> = { uk: "United Kingdom", usa: "United States" };

/**
 * Accepts a full name ("United Kingdom"), a common alias ("UK"), or an ISO
 * code ("GB", "gb") - always returns the canonical full name, never a raw
 * code. Falls back to the original value for anything unrecognized rather
 * than hiding real data.
 */
export function countryDisplayName(value: string | null | undefined): string {
  if (!value) return "";
  const trimmed = value.trim();
  const lower = trimmed.toLowerCase();
  const byCode = ALL.find((c) => c.code.toLowerCase() === lower);
  if (byCode) return byCode.name;
  const byName = ALL.find((c) => c.name.toLowerCase() === lower);
  if (byName) return byName.name;
  if (ALIAS_TO_NAME[lower]) return ALIAS_TO_NAME[lower];
  return trimmed;
}

/** ISO code for a known country name/alias/code, or null. */
export function countryCodeForName(value: string | null | undefined): string | null {
  if (!value) return null;
  const lower = value.trim().toLowerCase();
  const byName = ALL.find((c) => c.name.toLowerCase() === lower);
  if (byName) return byName.code;
  if (lower === "uk") return "GB";
  if (lower === "usa") return "US";
  const byCode = ALL.find((c) => c.code.toLowerCase() === lower);
  return byCode?.code ?? null;
}

/**
 * Handbook 14.9 market label: "Austria (AT) - EUR". Falls back to the bare
 * code only when the country is unknown; the currency comes from the market
 * row when supplied, else the seeded default.
 */
export function marketLabel(code: string, currency?: string | null): string {
  const upper = code.trim().toUpperCase();
  const entry = ALL.find((c) => c.code === upper);
  const cur = currency || entry?.currency;
  if (!entry) return cur ? `${upper} - ${cur}` : upper;
  return `${entry.name} (${upper})${cur ? ` - ${cur}` : ""}`;
}

/** Readable list of country names for coverage regions (stored as names or codes). */
export function formatCoverage(values: readonly string[] | null | undefined): string {
  if (!values || values.length === 0) return "Not provided";
  return values.map((v) => countryDisplayName(v)).join(", ");
}
