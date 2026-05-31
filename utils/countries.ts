/**
 * Country / city dataset for vendor onboarding selectors.
 *
 * Kept intentionally small — focused on the markets Eki currently serves
 * (Africa origin + UK / US / Canada / Europe destinations).
 *
 * If you need more cities for a country, append them here. The selector
 * gracefully degrades to an empty array (the UI just shows "Other").
 */

export interface CountryEntry {
  name: string;
  cities: string[];
}

export const COUNTRIES: CountryEntry[] = [
  // ── Africa (vendor origin) ────────────────────────────────────────────
  { name: "Nigeria", cities: ["Lagos", "Abuja", "Port Harcourt", "Ibadan", "Kano", "Benin City", "Enugu", "Kaduna"] },
  { name: "Ghana", cities: ["Accra", "Kumasi", "Tamale", "Takoradi", "Cape Coast"] },
  { name: "Kenya", cities: ["Nairobi", "Mombasa", "Kisumu", "Nakuru", "Eldoret"] },
  { name: "South Africa", cities: ["Johannesburg", "Cape Town", "Durban", "Pretoria", "Port Elizabeth"] },
  { name: "Senegal", cities: ["Dakar", "Thiès", "Saint-Louis"] },
  { name: "Côte d'Ivoire", cities: ["Abidjan", "Yamoussoukro", "Bouaké"] },
  { name: "Cameroon", cities: ["Douala", "Yaoundé", "Bafoussam"] },
  { name: "Ethiopia", cities: ["Addis Ababa", "Dire Dawa", "Mek'ele"] },
  { name: "Uganda", cities: ["Kampala", "Entebbe", "Jinja"] },
  { name: "Tanzania", cities: ["Dar es Salaam", "Dodoma", "Arusha", "Mwanza"] },
  { name: "Morocco", cities: ["Casablanca", "Rabat", "Marrakech", "Fes", "Tangier"] },
  { name: "Egypt", cities: ["Cairo", "Alexandria", "Giza"] },

  // ── Buyer destinations ────────────────────────────────────────────────
  { name: "United Kingdom", cities: ["London", "Manchester", "Birmingham", "Leeds", "Liverpool", "Glasgow", "Edinburgh", "Bristol"] },
  { name: "United States", cities: ["New York", "Los Angeles", "Chicago", "Houston", "Atlanta", "Dallas", "Miami", "Boston", "Seattle"] },
  { name: "Canada", cities: ["Toronto", "Montreal", "Vancouver", "Calgary", "Ottawa", "Edmonton"] },
  { name: "Italy", cities: ["Rome", "Milan", "Naples", "Turin", "Florence", "Bologna"] },
  { name: "France", cities: ["Paris", "Marseille", "Lyon", "Toulouse", "Nice", "Bordeaux"] },
  { name: "Germany", cities: ["Berlin", "Hamburg", "Munich", "Cologne", "Frankfurt"] },
  { name: "Spain", cities: ["Madrid", "Barcelona", "Valencia", "Seville"] },
  { name: "Netherlands", cities: ["Amsterdam", "Rotterdam", "The Hague", "Utrecht"] },
  { name: "Belgium", cities: ["Brussels", "Antwerp", "Ghent"] },
  { name: "Ireland", cities: ["Dublin", "Cork", "Galway"] },
  { name: "Portugal", cities: ["Lisbon", "Porto"] },
];

export const COUNTRY_NAMES: string[] = COUNTRIES.map((c) => c.name);

export function getCitiesForCountry(country: string | null | undefined): string[] {
  if (!country) return [];
  const entry = COUNTRIES.find((c) => c.name.toLowerCase() === country.toLowerCase());
  return entry?.cities ?? [];
}
