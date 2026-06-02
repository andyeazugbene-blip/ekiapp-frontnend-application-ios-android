import { create } from "zustand";

type PublicStoreCart = Record<string, number>;

interface PublicStoreCartState {
  cartsBySlug: Record<string, PublicStoreCart>;
  addItem: (storeSlug: string, productId: string, quantity?: number) => void;
  decrementItem: (storeSlug: string, productId: string, quantity?: number) => void;
  setItemQuantity: (storeSlug: string, productId: string, quantity: number) => void;
  replaceCart: (storeSlug: string, nextCart: PublicStoreCart) => void;
  clearCart: (storeSlug: string) => void;
}

function sanitizeCart(nextCart: PublicStoreCart): PublicStoreCart {
  return Object.entries(nextCart).reduce<PublicStoreCart>((acc, [productId, quantity]) => {
    if (Number.isFinite(quantity) && quantity > 0) {
      acc[productId] = Math.max(1, Math.floor(quantity));
    }
    return acc;
  }, {});
}

export const usePublicStoreCartStore = create<PublicStoreCartState>((set) => ({
  cartsBySlug: {},

  addItem: (storeSlug, productId, quantity = 1) =>
    set((state) => {
      const currentCart = state.cartsBySlug[storeSlug] ?? {};
      const nextQuantity = (currentCart[productId] ?? 0) + Math.max(1, Math.floor(quantity));

      return {
        cartsBySlug: {
          ...state.cartsBySlug,
          [storeSlug]: {
            ...currentCart,
            [productId]: nextQuantity,
          },
        },
      };
    }),

  decrementItem: (storeSlug, productId, quantity = 1) =>
    set((state) => {
      const currentCart = state.cartsBySlug[storeSlug] ?? {};
      const nextQuantity = (currentCart[productId] ?? 0) - Math.max(1, Math.floor(quantity));
      const nextCart = { ...currentCart };

      if (nextQuantity > 0) {
        nextCart[productId] = nextQuantity;
      } else {
        delete nextCart[productId];
      }

      return {
        cartsBySlug: {
          ...state.cartsBySlug,
          [storeSlug]: nextCart,
        },
      };
    }),

  setItemQuantity: (storeSlug, productId, quantity) =>
    set((state) => {
      const currentCart = state.cartsBySlug[storeSlug] ?? {};
      const nextCart = { ...currentCart };

      if (quantity > 0) {
        nextCart[productId] = Math.max(1, Math.floor(quantity));
      } else {
        delete nextCart[productId];
      }

      return {
        cartsBySlug: {
          ...state.cartsBySlug,
          [storeSlug]: nextCart,
        },
      };
    }),

  replaceCart: (storeSlug, nextCart) =>
    set((state) => ({
      cartsBySlug: {
        ...state.cartsBySlug,
        [storeSlug]: sanitizeCart(nextCart),
      },
    })),

  clearCart: (storeSlug) =>
    set((state) => ({
      cartsBySlug: {
        ...state.cartsBySlug,
        [storeSlug]: {},
      },
    })),
}));
