/**
 * Country / city dataset for vendor onboarding selectors.
 *
 * Scoped to EXACTLY Eki's 10 currently approved launch markets — the same
 * set the backend enforces (see ekiapp-backend-main/src/shared/currency.ts,
 * MARKET_CODE_COUNTRY_NAMES / LAUNCH_MARKET_COUNTRIES, itself derived from
 * MarketConfiguration's INITIAL_MARKETS seed). This list previously
 * included 12 African countries plus Germany/Netherlands/Ireland (none
 * approved for launch) and was MISSING two approved markets (Switzerland,
 * Croatia) entirely — a vendor could select an unsupported country in the
 * app with no backend backstop at the time. The backend now independently
 * rejects any vendor country outside this same set (vendorsService
 * .createVendor/updateOwnVendor), so this list existing is a UX
 * convenience, not the only gate — but it must never offer more than the
 * backend allows.
 *
 * If Eki launches a new market, add it here AND get the corresponding
 * MarketConfiguration row created on the backend first — the two must stay
 * in sync by hand until the app fetches this list live from the backend.
 */

export interface CountryEntry {
  code: string;
  name: string;
  cities: string[];
}

export const COUNTRIES: CountryEntry[] = [
  { code: "GB", name: "United Kingdom", cities: ["London", "Manchester", "Birmingham", "Leeds", "Liverpool", "Glasgow", "Edinburgh", "Bristol"] },
  { code: "US", name: "United States", cities: ["New York", "Los Angeles", "Chicago", "Houston", "Atlanta", "Dallas", "Miami", "Boston", "Seattle"] },
  { code: "CA", name: "Canada", cities: ["Toronto", "Montreal", "Vancouver", "Calgary", "Ottawa", "Edmonton"] },
  { code: "FR", name: "France", cities: ["Paris", "Marseille", "Lyon", "Toulouse", "Nice", "Bordeaux"] },
  { code: "ES", name: "Spain", cities: ["Madrid", "Barcelona", "Valencia", "Seville"] },
  { code: "PT", name: "Portugal", cities: ["Lisbon", "Porto"] },
  { code: "CH", name: "Switzerland", cities: ["Zurich", "Geneva", "Basel", "Bern", "Lausanne"] },
  { code: "BE", name: "Belgium", cities: ["Brussels", "Antwerp", "Ghent"] },
  { code: "IT", name: "Italy", cities: ["Rome", "Milan", "Naples", "Turin", "Florence", "Bologna"] },
  { code: "HR", name: "Croatia", cities: ["Zagreb", "Split", "Rijeka", "Osijek"] },
];

export const COUNTRY_NAMES: string[] = COUNTRIES.map((c) => c.name);
export const COUNTRY_CODES: string[] = COUNTRIES.map((c) => c.code);

export function getCitiesForCountry(country: string | null | undefined): string[] {
  if (!country) return [];
  const entry = COUNTRIES.find((c) => c.name.toLowerCase() === country.toLowerCase());
  return entry?.cities ?? [];
}

/** True only for one of the 10 approved launch markets (case-insensitive). */
export function isApprovedLaunchCountry(country: string | null | undefined): boolean {
  if (!country) return false;
  return COUNTRY_NAMES.some((name) => name.toLowerCase() === country.trim().toLowerCase());
}

/**
 * The single authoritative country-name resolver for this app. Accepts a
 * full name ("United Kingdom"), a common alias ("UK"), or an ISO code
 * ("GB", "gb") — always returns the canonical full name, never a raw code.
 * This is what MarketConfig.countryCode-driven UI (Community Buy market
 * pickers, campaign cards, organiser/supplier views) must call before
 * rendering a market — never interpolate `m.countryCode` directly into
 * user-facing text.
 */
const ALIAS_TO_NAME: Record<string, string> = { uk: "United Kingdom", usa: "United States" };

export function countryDisplayName(value: string | null | undefined): string {
  if (!value) return "";
  const trimmed = value.trim();
  const lower = trimmed.toLowerCase();
  const byCode = COUNTRIES.find((c) => c.code.toLowerCase() === lower);
  if (byCode) return byCode.name;
  const byName = COUNTRIES.find((c) => c.name.toLowerCase() === lower);
  if (byName) return byName.name;
  if (ALIAS_TO_NAME[lower]) return ALIAS_TO_NAME[lower];
  // Unrecognized (e.g. a legacy/grandfathered non-launch-market value) —
  // return the original rather than fabricating a name, so real data is
  // never hidden, but it's never a bare 2-letter code from this path either
  // unless the raw value itself already was one we don't recognize.
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
