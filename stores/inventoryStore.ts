import { create } from "zustand";
import { Product } from "../types/product";

interface InventoryStore {
  selectedProduct: Product | null;
  setSelectedProduct: (product: Product | null) => void;
}

export const useInventoryStore = create<InventoryStore>((set) => ({
  selectedProduct: null,
  setSelectedProduct: (product) => set({ selectedProduct: product }),
}));
