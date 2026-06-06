import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

import { normalizeCurrencyCode, type SupportedCurrency } from "../utils/currency";

const CURRENCY_PREF_KEY = "eki_currency_pref";

type CurrencyCache = {
  selectedCurrency: SupportedCurrency;
  hasExplicitPreference: boolean;
};

interface CurrencyState {
  selectedCurrency: SupportedCurrency;
  hasExplicitPreference: boolean;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setSelectedCurrency: (currency: string) => Promise<void>;
  ensureCurrency: (currency?: string | null) => Promise<void>;
}

async function readCurrencyCache(): Promise<CurrencyCache | null> {
  try {
    const raw = await AsyncStorage.getItem(CURRENCY_PREF_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CurrencyCache>;
    return {
      selectedCurrency: normalizeCurrencyCode(parsed.selectedCurrency),
      hasExplicitPreference: parsed.hasExplicitPreference === true,
    };
  } catch {
    return null;
  }
}

async function writeCurrencyCache(cache: CurrencyCache) {
  try {
    await AsyncStorage.setItem(CURRENCY_PREF_KEY, JSON.stringify(cache));
  } catch {}
}

export const useCurrencyStore = create<CurrencyState>((set, get) => ({
  selectedCurrency: "GBP",
  hasExplicitPreference: false,
  hydrated: false,

  hydrate: async () => {
    if (get().hydrated) return;
    const cached = await readCurrencyCache();
    if (cached) {
      set({
        selectedCurrency: cached.selectedCurrency,
        hasExplicitPreference: cached.hasExplicitPreference,
        hydrated: true,
      });
      return;
    }
    set({ hydrated: true });
  },

  setSelectedCurrency: async (currency) => {
    const selectedCurrency = normalizeCurrencyCode(currency);
    set({
      selectedCurrency,
      hasExplicitPreference: true,
      hydrated: true,
    });
    await writeCurrencyCache({
      selectedCurrency,
      hasExplicitPreference: true,
    });
  },

  ensureCurrency: async (currency) => {
    const state = get();
    if (!state.hydrated) {
      await state.hydrate();
    }

    const fresh = get();
    if (fresh.hasExplicitPreference || !currency) return;

    const selectedCurrency = normalizeCurrencyCode(currency);
    set({
      selectedCurrency,
      hydrated: true,
    });
    await writeCurrencyCache({
      selectedCurrency,
      hasExplicitPreference: false,
    });
  },
}));
