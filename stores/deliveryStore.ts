import { create } from "zustand";

export interface DeliveryMethod {
  id: string;
  label: string;
  price: number;
  minDays: number;
  maxDays: number;
  isActive: boolean;
}

export interface DeliveryZone {
  id: string;
  country: string;
  flag: string;
  currency: string;
  isActive: boolean;
  methods: DeliveryMethod[];
}

interface DeliveryStore {
  zones: DeliveryZone[];
  selectedZone: DeliveryZone | null;
  setSelectedZone: (zone: DeliveryZone | null) => void;
  toggleZoneActive: (zoneId: string) => void;
  toggleMethodActive: (zoneId: string, methodId: string) => void;
  updateZoneMethods: (zoneId: string, methods: DeliveryMethod[]) => void;
}

const INITIAL_ZONES: DeliveryZone[] = [
  {
    id: "uk",
    country: "United Kingdom",
    flag: "🇬🇧",
    currency: "GBP",
    isActive: true,
    methods: [
      { id: "uk-std", label: "Standard", price: 4.99, minDays: 3, maxDays: 5, isActive: true },
      { id: "uk-exp", label: "Express", price: 9.99, minDays: 1, maxDays: 2, isActive: true },
      { id: "uk-eco", label: "Economy", price: 1.99, minDays: 7, maxDays: 10, isActive: false },
    ],
  },
  {
    id: "us",
    country: "United States",
    flag: "🇺🇸",
    currency: "USD",
    isActive: true,
    methods: [
      { id: "us-std", label: "Standard", price: 12.99, minDays: 7, maxDays: 14, isActive: true },
      { id: "us-exp", label: "Express", price: 24.99, minDays: 3, maxDays: 5, isActive: true },
    ],
  },
  {
    id: "ca",
    country: "Canada",
    flag: "🇨🇦",
    currency: "CAD",
    isActive: true,
    methods: [
      { id: "ca-std", label: "Standard", price: 14.99, minDays: 10, maxDays: 14, isActive: true },
      { id: "ca-exp", label: "Express", price: 29.99, minDays: 5, maxDays: 7, isActive: false },
    ],
  },
  {
    id: "eu",
    country: "Europe",
    flag: "🇪🇺",
    currency: "EUR",
    isActive: false,
    methods: [
      { id: "eu-std", label: "Standard", price: 8.99, minDays: 5, maxDays: 10, isActive: false },
    ],
  },
  {
    id: "ng",
    country: "Nigeria",
    flag: "🇳🇬",
    currency: "NGN",
    isActive: false,
    methods: [],
  },
  {
    id: "au",
    country: "Australia",
    flag: "🇦🇺",
    currency: "AUD",
    isActive: false,
    methods: [],
  },
  {
    id: "gh",
    country: "Ghana",
    flag: "🇬🇭",
    currency: "GHS",
    isActive: false,
    methods: [],
  },
];

export const useDeliveryStore = create<DeliveryStore>((set) => ({
  zones: INITIAL_ZONES,
  selectedZone: null,

  setSelectedZone: (zone) => set({ selectedZone: zone }),

  toggleZoneActive: (zoneId) =>
    set((s) => ({
      zones: s.zones.map((z) =>
        z.id === zoneId ? { ...z, isActive: !z.isActive } : z
      ),
    })),

  toggleMethodActive: (zoneId, methodId) =>
    set((s) => ({
      zones: s.zones.map((z) =>
        z.id === zoneId
          ? {
              ...z,
              methods: z.methods.map((m) =>
                m.id === methodId ? { ...m, isActive: !m.isActive } : m
              ),
            }
          : z
      ),
    })),

  updateZoneMethods: (zoneId, methods) =>
    set((s) => ({
      zones: s.zones.map((z) =>
        z.id === zoneId ? { ...z, methods } : z
      ),
    })),
}));
