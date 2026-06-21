import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Product } from "../types/product";

interface FavoritesStore {
  products: Product[];
  loaded: boolean;
  isFavorite: (productId: string) => boolean;
  toggleFavorite: (product: Product, userId?: string) => Promise<void>;
  removeFavorite: (productId: string, userId?: string) => Promise<void>;
  load: (userId?: string) => Promise<void>;
  reset: () => void;
}

function favoritesKey(userId?: string): string | null {
  return userId ? `eki_favorites_${userId}` : null;
}

async function readFavorites(userId?: string): Promise<Product[]> {
  const key = favoritesKey(userId);
  if (!key) return [];
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeFavorites(userId: string | undefined, products: Product[]): Promise<void> {
  const key = favoritesKey(userId);
  if (!key) return;
  try {
    await AsyncStorage.setItem(key, JSON.stringify(products));
  } catch {}
}

export const useFavoritesStore = create<FavoritesStore>((set, get) => ({
  products: [],
  loaded: false,

  isFavorite: (productId) => get().products.some((p) => p.id === productId),

  load: async (userId) => {
    const products = await readFavorites(userId);
    set({ products, loaded: true });
  },

  toggleFavorite: async (product, userId) => {
    const current = get().products;
    const exists = current.some((p) => p.id === product.id);
    const next = exists ? current.filter((p) => p.id !== product.id) : [...current, product];
    set({ products: next });
    await writeFavorites(userId, next);
  },

  removeFavorite: async (productId, userId) => {
    const next = get().products.filter((p) => p.id !== productId);
    set({ products: next });
    await writeFavorites(userId, next);
  },

  reset: () => set({ products: [], loaded: false }),
}));
