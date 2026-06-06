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
