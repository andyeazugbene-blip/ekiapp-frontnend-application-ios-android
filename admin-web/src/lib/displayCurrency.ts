"use client";

import { useEffect, useMemo, useState } from "react";

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

const CURRENCY_SYMBOLS: Record<SupportedCurrency, string> = {
  GBP: "\u00A3",
  USD: "$",
  EUR: "\u20AC",
  NGN: "\u20A6",
  GHS: "GH\u20B5",
  KES: "KSh",
  CAD: "C$",
};

const GBP_BASE_RATES: Record<SupportedCurrency, number> = {
  GBP: 1,
  USD: 1.28,
  EUR: 1.17,
  NGN: 1950,
  GHS: 16.45,
  KES: 166,
  CAD: 1.74,
};

const STORAGE_KEY = "eki_admin_display_currency";

export function normalizeCurrencyCode(value?: string | null): SupportedCurrency {
  const upper = (value ?? "").toUpperCase();
  return SUPPORTED_CURRENCIES.includes(upper as SupportedCurrency) ? (upper as SupportedCurrency) : "GBP";
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

export function formatDisplayMoney(
  amount: number,
  sourceCurrency?: string | null,
  displayCurrency?: string | null,
  digits = 2,
): string {
  const target = normalizeCurrencyCode(displayCurrency);
  const converted = convertMoney(amount, sourceCurrency, target);
  return `${CURRENCY_SYMBOLS[target]}${converted.toLocaleString("en-GB", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

export function useAdminDisplayCurrency(defaultCurrency?: string | null) {
  const fallback = normalizeCurrencyCode(defaultCurrency);
  const [selectedCurrency, setSelectedCurrencyState] = useState<SupportedCurrency>(fallback);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      setSelectedCurrencyState(normalizeCurrencyCode(stored));
      return;
    }
    setSelectedCurrencyState(fallback);
  }, [fallback]);

  const setSelectedCurrency = (currency: SupportedCurrency) => {
    const next = normalizeCurrencyCode(currency);
    setSelectedCurrencyState(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, next);
    }
  };

  return useMemo(
    () => ({
      selectedCurrency,
      setSelectedCurrency,
      currencyOptions: SUPPORTED_CURRENCIES,
    }),
    [selectedCurrency],
  );
}

// ─── Approximate conversions (handbook 14.6: converted amounts are labelled) ──
// Rates above are static constants, never live FX. Anything converted with
// them must be shown as "Approx." next to the ORIGINAL currency amount, and an
// unsupported currency is never silently converted (it would fall back to GBP).

export const APPROX_LABEL = "Approx.";

export function isSupportedCurrency(value?: string | null): value is SupportedCurrency {
  return SUPPORTED_CURRENCIES.includes((value ?? "").toUpperCase() as SupportedCurrency);
}

/** True when showing `displayCurrency` for an amount in `sourceCurrency` is a conversion. */
export function isConverted(sourceCurrency?: string | null, displayCurrency?: string | null): boolean {
  return (
    isSupportedCurrency(sourceCurrency) &&
    isSupportedCurrency(displayCurrency) &&
    sourceCurrency.toUpperCase() !== displayCurrency.toUpperCase()
  );
}

/**
 * "Approx. $12.80" for a converted amount (major units), or null when no
 * conversion applies (same currency, or a currency we have no rate for).
 * Always render it NEXT TO the original-currency amount, never instead of it.
 */
export function formatApproxMoney(
  amountMajor: number,
  sourceCurrency?: string | null,
  displayCurrency?: string | null,
): string | null {
  if (!isConverted(sourceCurrency, displayCurrency)) return null;
  return `${APPROX_LABEL} ${formatDisplayMoney(amountMajor, sourceCurrency, displayCurrency)}`;
}

/** formatDisplayMoney that appends " (approx.)" whenever a conversion happened. */
export function formatDisplayMoneyApprox(
  amountMajor: number,
  sourceCurrency?: string | null,
  displayCurrency?: string | null,
  digits = 2,
): string {
  const base = formatDisplayMoney(amountMajor, sourceCurrency, displayCurrency, digits);
  return isConverted(sourceCurrency, displayCurrency) ? `${base} (approx.)` : base;
}
