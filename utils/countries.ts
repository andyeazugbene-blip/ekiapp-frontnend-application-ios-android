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
  name: string;
  cities: string[];
}

export const COUNTRIES: CountryEntry[] = [
  { name: "United Kingdom", cities: ["London", "Manchester", "Birmingham", "Leeds", "Liverpool", "Glasgow", "Edinburgh", "Bristol"] },
  { name: "United States", cities: ["New York", "Los Angeles", "Chicago", "Houston", "Atlanta", "Dallas", "Miami", "Boston", "Seattle"] },
  { name: "Canada", cities: ["Toronto", "Montreal", "Vancouver", "Calgary", "Ottawa", "Edmonton"] },
  { name: "France", cities: ["Paris", "Marseille", "Lyon", "Toulouse", "Nice", "Bordeaux"] },
  { name: "Spain", cities: ["Madrid", "Barcelona", "Valencia", "Seville"] },
  { name: "Portugal", cities: ["Lisbon", "Porto"] },
  { name: "Switzerland", cities: ["Zurich", "Geneva", "Basel", "Bern", "Lausanne"] },
  { name: "Belgium", cities: ["Brussels", "Antwerp", "Ghent"] },
  { name: "Italy", cities: ["Rome", "Milan", "Naples", "Turin", "Florence", "Bologna"] },
  { name: "Croatia", cities: ["Zagreb", "Split", "Rijeka", "Osijek"] },
];

export const COUNTRY_NAMES: string[] = COUNTRIES.map((c) => c.name);

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
