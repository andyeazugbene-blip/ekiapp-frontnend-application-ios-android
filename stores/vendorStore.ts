import { create } from "zustand";
import { VendorSummary, VendorDashboardData, AdminDashboardData } from "../types/vendor";
import { vendorService } from "../services/vendorService";

interface VendorStore {
  vendors: VendorSummary[];
  selectedVendor: VendorSummary | null;
  dashboardData: VendorDashboardData | null;
  adminDashboard: AdminDashboardData | null;
  isLoading: boolean;
  error: string | null;

  fetchVendors: (filter?: { status?: string; search?: string }) => Promise<void>;
  fetchVendorById: (id: string) => Promise<void>;
  fetchDashboard: (vendorId: string) => Promise<void>;
  fetchAdminDashboard: () => Promise<void>;
  approveVendor: (vendorId: string) => Promise<void>;
  rejectVendor: (vendorId: string, reason?: string) => Promise<void>;
  clearError: () => void;
}

export const useVendorStore = create<VendorStore>((set, get) => ({
  vendors: [],
  selectedVendor: null,
  dashboardData: null,
  adminDashboard: null,
  isLoading: false,
  error: null,

  fetchVendors: async (filter) => {
    set({ isLoading: true, error: null });
    try {
      const vendors = await vendorService.getAllVendors(filter as any);
      set({ vendors, isLoading: false });
    } catch (err: unknown) {
      set({ error: err instanceof Error ? err.message : "Failed to fetch vendors", isLoading: false });
    }
  },

  fetchVendorById: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const vendor = await vendorService.getVendorById(id);
      set({ selectedVendor: vendor, isLoading: false });
    } catch (err: unknown) {
      set({ error: err instanceof Error ? err.message : "Vendor not found", isLoading: false });
    }
  },

  fetchDashboard: async (vendorId) => {
    set({ isLoading: true, error: null });
    try {
      const dashboardData = await vendorService.getVendorDashboard(vendorId);
      set({ dashboardData, isLoading: false });
    } catch (err: unknown) {
      set({ error: err instanceof Error ? err.message : "Failed to load dashboard", isLoading: false });
    }
  },

  fetchAdminDashboard: async () => {
    set({ isLoading: true, error: null });
    try {
      const adminDashboard = await vendorService.getAdminDashboard();
      set({ adminDashboard, isLoading: false });
    } catch (err: unknown) {
      set({ error: err instanceof Error ? err.message : "Failed to load dashboard", isLoading: false });
    }
  },

  approveVendor: async (vendorId) => {
    try {
      await vendorService.approveVendor(vendorId);
      set({
        vendors: get().vendors.map((v) =>
          v.id === vendorId ? { ...v, adminStatus: "active" } : v
        ),
      });
    } catch (err: unknown) {
      set({ error: err instanceof Error ? err.message : "Action failed" });
    }
  },

  rejectVendor: async (vendorId, reason) => {
    try {
      await vendorService.rejectVendor(vendorId, reason);
      set({
        vendors: get().vendors.map((v) =>
          v.id === vendorId ? { ...v, adminStatus: "suspended" } : v
        ),
      });
    } catch (err: unknown) {
      set({ error: err instanceof Error ? err.message : "Action failed" });
    }
  },

  clearError: () => set({ error: null }),
}));
