export type SupportedCurrency = "GBP" | "USD" | "EUR" | "NGN" | "GHS" | "KES" | "CAD";

export const SUPPORTED_CURRENCIES: SupportedCurrency[] = [
  "GBP",
  "USD",
  "EUR",
  "NGN",
  "GHS",
  "KES",
  "CAD",
];

export const CURRENCY_SYMBOLS: Record<SupportedCurrency, string> = {
  GBP: "\u00A3",
  USD: "$",
  EUR: "\u20AC",
  NGN: "\u20A6",
  GHS: "GH\u20B5",
  KES: "KSh",
  CAD: "C$",
};

export const CURRENCY_LABELS: Record<SupportedCurrency, string> = {
  GBP: "British Pound",
  USD: "US Dollar",
  EUR: "Euro",
  NGN: "Nigerian Naira",
  GHS: "Ghanaian Cedi",
  KES: "Kenyan Shilling",
  CAD: "Canadian Dollar",
};

/**
 * Approximate display conversion table.
 * Values represent how many units of the target currency equal 1 GBP.
 * Checkout and settlement still use the product/order native currency.
 */
const GBP_BASE_RATES: Record<SupportedCurrency, number> = {
  GBP: 1,
  USD: 1.28,
  EUR: 1.17,
  NGN: 1950,
  GHS: 16.45,
  KES: 166,
  CAD: 1.74,
};

export function normalizeCurrencyCode(value?: string | null): SupportedCurrency {
  const upper = (value ?? "").toUpperCase();
  if (SUPPORTED_CURRENCIES.includes(upper as SupportedCurrency)) {
    return upper as SupportedCurrency;
  }
  return "GBP";
}

export function getCurrencySymbol(currency?: string | null): string {
  return CURRENCY_SYMBOLS[normalizeCurrencyCode(currency)];
}

export function convertMoney(amount: number, from?: string | null, to?: string | null): number {
  const source = normalizeCurrencyCode(from);
  const target = normalizeCurrencyCode(to);
  const numeric = Number(amount);

  if (!Number.isFinite(numeric)) return 0;
  if (source === target) return numeric;

  const amountInGbp = numeric / GBP_BASE_RATES[source];
  return amountInGbp * GBP_BASE_RATES[target];
}

export function formatMoney(amount: number, currency?: string | null, digits = 2): string {
  const code = normalizeCurrencyCode(currency);
  const symbol = CURRENCY_SYMBOLS[code];
  const numeric = Number.isFinite(Number(amount)) ? Number(amount) : 0;
  return `${symbol}${numeric.toLocaleString("en-GB", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

export function formatDisplayMoney(
  amount: number,
  sourceCurrency?: string | null,
  displayCurrency?: string | null,
  digits = 2,
): string {
  const target = normalizeCurrencyCode(displayCurrency);
  const converted = convertMoney(amount, sourceCurrency, target);
  return formatMoney(converted, target, digits);
}
