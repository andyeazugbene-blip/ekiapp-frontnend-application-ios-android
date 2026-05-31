import { create } from "zustand";
import { Order, OrderStatus } from "../types/order";

interface VendorOrderStore {
  selectedOrder: Order | null;
  setSelectedOrder: (order: Order | null) => void;
  localOrders: Order[];
  setLocalOrders: (orders: Order[]) => void;
  updateLocalStatus: (orderId: string, status: OrderStatus) => void;
}

export const useVendorOrderStore = create<VendorOrderStore>((set) => ({
  selectedOrder: null,
  setSelectedOrder: (order) => set({ selectedOrder: order }),
  localOrders: [],
  setLocalOrders: (orders) => set({ localOrders: orders }),
  updateLocalStatus: (orderId, status) =>
    set((state) => ({
      localOrders: state.localOrders.map((order) =>
        order.id === orderId ? { ...order, status, updatedAt: new Date().toISOString() } : order
      ),
      selectedOrder:
        state.selectedOrder?.id === orderId
          ? { ...state.selectedOrder, status, updatedAt: new Date().toISOString() }
          : state.selectedOrder,
    })),
}));
