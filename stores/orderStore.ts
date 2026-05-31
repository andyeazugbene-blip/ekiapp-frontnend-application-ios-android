import { create } from "zustand";
import { Order, OrderStatus, VendorEarnings } from "../types/order";
import { orderService } from "../services/orderService";

interface OrderStore {
  orders: Order[];
  selectedOrder: Order | null;
  earnings: VendorEarnings | null;
  isLoading: boolean;
  error: string | null;

  fetchBuyerOrders: (buyerId: string) => Promise<void>;
  fetchVendorOrders: (vendorId: string) => Promise<void>;
  fetchAllOrders: () => Promise<void>;
  fetchOrderById: (id: string) => Promise<void>;
  updateOrderStatus: (orderId: string, status: OrderStatus) => Promise<void>;
  fetchEarnings: (vendorId: string) => Promise<void>;
  clearError: () => void;
}

export const useOrderStore = create<OrderStore>((set) => ({
  orders: [],
  selectedOrder: null,
  earnings: null,
  isLoading: false,
  error: null,

  fetchBuyerOrders: async (buyerId) => {
    set({ isLoading: true, error: null });
    try {
      const orders = await orderService.getBuyerOrders(buyerId);
      set({ orders, isLoading: false });
    } catch (err: unknown) {
      set({ error: err instanceof Error ? err.message : "Failed to fetch orders", isLoading: false });
    }
  },

  fetchVendorOrders: async (vendorId) => {
    set({ isLoading: true, error: null });
    try {
      const orders = await orderService.getVendorOrders(vendorId);
      set({ orders, isLoading: false });
    } catch (err: unknown) {
      set({ error: err instanceof Error ? err.message : "Failed to fetch orders", isLoading: false });
    }
  },

  fetchAllOrders: async () => {
    set({ isLoading: true, error: null });
    try {
      const orders = await orderService.getAllOrders();
      set({ orders, isLoading: false });
    } catch (err: unknown) {
      set({ error: err instanceof Error ? err.message : "Failed to fetch orders", isLoading: false });
    }
  },

  fetchOrderById: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const order = await orderService.getOrderById(id);
      set({ selectedOrder: order, isLoading: false });
    } catch (err: unknown) {
      set({ error: err instanceof Error ? err.message : "Order not found", isLoading: false });
    }
  },

  updateOrderStatus: async (orderId, status) => {
    try {
      await orderService.updateOrderStatus(orderId, status);
      set((state) => ({
        orders: state.orders.map((o) =>
          o.id === orderId ? { ...o, status, updatedAt: new Date().toISOString() } : o
        ),
        selectedOrder:
          state.selectedOrder?.id === orderId
            ? { ...state.selectedOrder, status }
            : state.selectedOrder,
      }));
    } catch (err: unknown) {
      set({ error: err instanceof Error ? err.message : "Update failed" });
    }
  },

  fetchEarnings: async (vendorId) => {
    set({ isLoading: true, error: null });
    try {
      const earnings = await orderService.getVendorEarnings(vendorId);
      set({ earnings, isLoading: false });
    } catch (err: unknown) {
      set({ error: err instanceof Error ? err.message : "Failed to fetch earnings", isLoading: false });
    }
  },

  clearError: () => set({ error: null }),
}));
