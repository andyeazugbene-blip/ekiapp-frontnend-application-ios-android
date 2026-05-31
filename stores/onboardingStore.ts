import { create } from "zustand";

export type DeliveryCountry = "UK" | "US" | "Canada" | "Europe";
export type VerificationStatus = "not_started" | "pending" | "approved" | "rejected";

export interface DeliverySettings {
  standardRate: string;
  freeThreshold: string;
  estimatedDays: string;
}

export interface FirstProduct {
  name: string;
  category: string;
  price: string;
  weight: string;
  stock: string;
  description: string;
}

export interface StoreDetails {
  storeName: string;
  description: string;
  category: string;
}

export interface BusinessInfo {
  type: "individual" | "registered" | "";
  category: string;
}

const COUNTRY_ORDER: DeliveryCountry[] = ["UK", "US", "Canada", "Europe"];

const DEFAULT_DELIVERY: DeliverySettings = {
  standardRate: "",
  freeThreshold: "",
  estimatedDays: "5–10 days",
};

interface OnboardingStore {
  otpVerified: boolean;
  storeDetails: StoreDetails;
  businessInfo: BusinessInfo;
  firstProduct: FirstProduct;
  selectedCountries: DeliveryCountry[];
  deliverySettings: Record<DeliveryCountry, DeliverySettings>;
  onboardingCompleted: boolean;
  verificationStatus: VerificationStatus;
  firstProductPublished: boolean;
  hasSharedLink: boolean;

  setOtpVerified: (verified: boolean) => void;
  setVerificationStatus: (status: VerificationStatus) => void;
  setFirstProductPublished: (published: boolean) => void;
  setHasSharedLink: (shared: boolean) => void;
  updateStoreDetails: (details: Partial<StoreDetails>) => void;
  updateBusinessInfo: (info: Partial<BusinessInfo>) => void;
  updateFirstProduct: (product: Partial<FirstProduct>) => void;
  toggleCountry: (country: DeliveryCountry) => void;
  updateDeliverySettings: (country: DeliveryCountry, settings: Partial<DeliverySettings>) => void;
  completeOnboarding: () => void;
  reset: () => void;

  getNextDeliveryRoute: (afterCountry: DeliveryCountry | null) => string;
}

const initialState = {
  otpVerified: false,
  storeDetails: { storeName: "", description: "", category: "" },
  businessInfo: { type: "" as const, category: "" },
  firstProduct: { name: "", category: "", price: "", weight: "", stock: "", description: "" },
  selectedCountries: [] as DeliveryCountry[],
  deliverySettings: {
    UK: { ...DEFAULT_DELIVERY },
    US: { ...DEFAULT_DELIVERY },
    Canada: { ...DEFAULT_DELIVERY },
    Europe: { ...DEFAULT_DELIVERY },
  },
  onboardingCompleted: false,
  verificationStatus: "not_started" as VerificationStatus,
  firstProductPublished: false,
  hasSharedLink: false,
};

export const useOnboardingStore = create<OnboardingStore>((set, get) => ({
  ...initialState,

  setOtpVerified: (verified) => set({ otpVerified: verified }),
  setVerificationStatus: (status) => set({ verificationStatus: status }),
  setFirstProductPublished: (published) => set({ firstProductPublished: published }),
  setHasSharedLink: (shared) => set({ hasSharedLink: shared }),

  updateStoreDetails: (details) =>
    set((s) => ({ storeDetails: { ...s.storeDetails, ...details } })),

  updateBusinessInfo: (info) =>
    set((s) => ({ businessInfo: { ...s.businessInfo, ...info } })),

  updateFirstProduct: (product) =>
    set((s) => ({ firstProduct: { ...s.firstProduct, ...product } })),

  toggleCountry: (country) =>
    set((s) => ({
      selectedCountries: s.selectedCountries.includes(country)
        ? s.selectedCountries.filter((c) => c !== country)
        : [...s.selectedCountries, country],
    })),

  updateDeliverySettings: (country, settings) =>
    set((s) => ({
      deliverySettings: {
        ...s.deliverySettings,
        [country]: { ...s.deliverySettings[country], ...settings },
      },
    })),

  completeOnboarding: () => set({ onboardingCompleted: true }),

  reset: () => set(initialState),

  getNextDeliveryRoute: (afterCountry) => {
    const { selectedCountries } = get();
    const ordered = COUNTRY_ORDER.filter((c) => selectedCountries.includes(c));
    if (!afterCountry) {
      return ordered.length > 0
        ? `/(vendor-onboarding)/delivery-${ordered[0].toLowerCase()}`
        : "/(vendor-onboarding)/delivery-summary";
    }
    const idx = ordered.indexOf(afterCountry);
    const next = ordered[idx + 1];
    return next
      ? `/(vendor-onboarding)/delivery-${next.toLowerCase()}`
      : "/(vendor-onboarding)/delivery-summary";
  },
}));
