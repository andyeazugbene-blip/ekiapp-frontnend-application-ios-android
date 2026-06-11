"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type SupportedCurrency = "GBP" | "USD" | "EUR" | "NGN" | "GHS" | "KES" | "CAD";

export const SUPPORTED_CURRENCIES: SupportedCurrency[] = [
  "GBP", "USD", "EUR", "NGN", "GHS", "KES", "CAD",
];

const CURRENCY_SYMBOLS: Record<SupportedCurrency, string> = {
  GBP: "£", USD: "$", EUR: "€",
  NGN: "₦", GHS: "GH₵", KES: "KSh", CAD: "C$",
};

const GBP_BASE_RATES: Record<SupportedCurrency, number> = {
  GBP: 1, USD: 1.28, EUR: 1.17, NGN: 1950, GHS: 16.45, KES: 166, CAD: 1.74,
};

const STORAGE_KEY = "eki_admin_display_currency";

function normalizeCurrencyCode(value?: string | null): SupportedCurrency {
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

interface CurrencyContextValue {
  selectedCurrency: SupportedCurrency;
  setSelectedCurrency: (currency: SupportedCurrency) => void;
  currencyOptions: SupportedCurrency[];
  format: (amount: number, sourceCurrency?: string | null) => string;
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [selectedCurrency, setSelectedCurrencyState] = useState<SupportedCurrency>("GBP");

  useEffect(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    if (stored) setSelectedCurrencyState(normalizeCurrencyCode(stored));
  }, []);

  const setSelectedCurrency = (currency: SupportedCurrency) => {
    const next = normalizeCurrencyCode(currency);
    setSelectedCurrencyState(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, next);
    }
  };

  const value = useMemo(() => ({
    selectedCurrency,
    setSelectedCurrency,
    currencyOptions: SUPPORTED_CURRENCIES,
    format: (amount: number, sourceCurrency?: string | null) =>
      formatDisplayMoney(amount, sourceCurrency, selectedCurrency),
  }), [selectedCurrency]);

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency(): CurrencyContextValue {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency must be used within CurrencyProvider");
  return ctx;
}
