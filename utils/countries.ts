/**
 * Country / city dataset for vendor onboarding selectors, and (via
 * countryDisplayName()) the display-name resolver for every Community Buy
 * market picker in the app.
 *
 * Scoped to EXACTLY Eki's approved launch markets — the same set the
 * backend enforces (see ekiapp-backend-main/src/shared/currency.ts,
 * MARKET_CODE_COUNTRY_NAMES / LAUNCH_MARKET_COUNTRIES, itself derived from
 * MarketConfiguration's INITIAL_MARKETS seed: GB/US/CA + every country
 * classified as Europe, client decision 2026-09-22 "EKI — FINAL PRODUCTION
 * CLOSURE"). The backend independently rejects any country outside this
 * same set, so this list existing is a UX convenience, not the only gate —
 * but it must never offer more than the backend allows, and (per that same
 * decision) must never fall behind it either.
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
  { code: "DE", name: "Germany", cities: ["Berlin", "Munich", "Hamburg", "Frankfurt", "Cologne"] },
  { code: "NL", name: "Netherlands", cities: ["Amsterdam", "Rotterdam", "The Hague", "Utrecht"] },
  { code: "AT", name: "Austria", cities: ["Vienna", "Graz", "Salzburg"] },
  { code: "IE", name: "Ireland", cities: ["Dublin", "Cork", "Galway"] },
  { code: "LU", name: "Luxembourg", cities: ["Luxembourg City"] },
  { code: "GR", name: "Greece", cities: ["Athens", "Thessaloniki"] },
  { code: "CY", name: "Cyprus", cities: ["Nicosia", "Limassol"] },
  { code: "MT", name: "Malta", cities: ["Valletta"] },
  { code: "SI", name: "Slovenia", cities: ["Ljubljana"] },
  { code: "SK", name: "Slovakia", cities: ["Bratislava"] },
  { code: "EE", name: "Estonia", cities: ["Tallinn"] },
  { code: "LV", name: "Latvia", cities: ["Riga"] },
  { code: "LT", name: "Lithuania", cities: ["Vilnius"] },
  { code: "FI", name: "Finland", cities: ["Helsinki", "Tampere"] },
  { code: "PL", name: "Poland", cities: ["Warsaw", "Krakow", "Wroclaw"] },
  { code: "CZ", name: "Czechia", cities: ["Prague", "Brno"] },
  { code: "HU", name: "Hungary", cities: ["Budapest"] },
  { code: "RO", name: "Romania", cities: ["Bucharest", "Cluj-Napoca"] },
  { code: "BG", name: "Bulgaria", cities: ["Sofia", "Plovdiv"] },
  { code: "DK", name: "Denmark", cities: ["Copenhagen", "Aarhus"] },
  { code: "SE", name: "Sweden", cities: ["Stockholm", "Gothenburg"] },
  { code: "NO", name: "Norway", cities: ["Oslo", "Bergen"] },
  { code: "IS", name: "Iceland", cities: ["Reykjavik"] },
  { code: "LI", name: "Liechtenstein", cities: ["Vaduz"] },
  { code: "MC", name: "Monaco", cities: ["Monaco"] },
  { code: "AD", name: "Andorra", cities: ["Andorra la Vella"] },
  { code: "SM", name: "San Marino", cities: ["San Marino"] },
  { code: "BA", name: "Bosnia and Herzegovina", cities: ["Sarajevo"] },
  { code: "RS", name: "Serbia", cities: ["Belgrade", "Novi Sad"] },
  { code: "ME", name: "Montenegro", cities: ["Podgorica"] },
  { code: "MK", name: "North Macedonia", cities: ["Skopje"] },
  { code: "AL", name: "Albania", cities: ["Tirana"] },
  { code: "MD", name: "Moldova", cities: ["Chisinau"] },
];

export const COUNTRY_NAMES: string[] = COUNTRIES.map((c) => c.name);
export const COUNTRY_CODES: string[] = COUNTRIES.map((c) => c.code);

export function getCitiesForCountry(country: string | null | undefined): string[] {
  if (!country) return [];
  const entry = COUNTRIES.find((c) => c.name.toLowerCase() === country.toLowerCase());
  return entry?.cities ?? [];
}

/** True only for one of the approved launch markets (case-insensitive). */
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

/** ISO code for an approved launch market's country name/alias, or null if not one of them. */
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

/**
 * Flag emoji for an ISO 3166-1 alpha-2 code, computed from the two
 * Regional Indicator Symbol code points (the standard technique — no
 * per-country asset/lookup table to keep in sync). Renders natively on
 * iOS/Android via the system emoji font. Accepts a raw code or a full/
 * alias country name (resolved through countryCodeForName() first) so
 * callers can pass whatever they already have on hand.
 */
export function countryFlagEmoji(value: string | null | undefined): string {
  const code = (value && value.length === 2 ? value : countryCodeForName(value)) ?? "";
  if (code.length !== 2) return "🏳️";
  const upper = code.toUpperCase();
  const points = [...upper].map((char) => 0x1f1e6 + (char.charCodeAt(0) - 65));
  return String.fromCodePoint(...points);
}
