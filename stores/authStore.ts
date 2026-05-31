import { create } from "zustand";
import { BuyerProfile, VendorProfile, AdminProfile, LoginCredentials, RegisterPayload, UserRole } from "../types/auth";
import { authService } from "../services/authService";
import { ApiRequestError, setOnUnauthorized } from "../services/api";
import { pushTokenService } from "../services/notificationService";
import { setMonitoringUser } from "../services/monitoring";
import { useCartStore } from "./cartStore";

type AnyProfile = BuyerProfile | VendorProfile | AdminProfile;

interface AuthStore {
  user: AnyProfile | null;
  token: string | null;
  pushToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitializing: boolean;
  hasSeenOnboarding: boolean;
  error: string | null;
  isAccountLocked: boolean;

  checkAuth: () => Promise<void>;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: Record<string, unknown>) => Promise<AnyProfile>;
  setUser: (user: AnyProfile) => void;
  clearError: () => void;
  setLoading: (loading: boolean) => void;
  setHasSeenOnboarding: () => void;
}

export const useAuthStore = create<AuthStore>((set, get) => {
  // Register 401 handler — force logout on token expiry
  setOnUnauthorized(() => {
    const state = get();
    useCartStore.getState().reset();
    setMonitoringUser(null);
    if (state.isAuthenticated) {
      set({
        user: null,
        token: null,
        pushToken: null,
        isAuthenticated: false,
        isLoading: false,
        error: "Session expired. Please log in again.",
        isAccountLocked: false,
        hasSeenOnboarding: true,
      });
    }
  });

  return {
    user: null,
    token: null,
    pushToken: null,
    isAuthenticated: false,
    isLoading: false,
    isInitializing: true,
    hasSeenOnboarding: false,
    error: null,
    isAccountLocked: false,

    checkAuth: async () => {
      try {
        const result = await authService.getMe();
        if (result) {
          set({
            user: result.user,
            token: result.token,
            isAuthenticated: true,
            isInitializing: false,
          });
          setMonitoringUser({ id: result.user.id, role: result.user.role });
        } else {
          set({ isInitializing: false });
        }
      } catch {
        set({ isInitializing: false });
      }
    },

    login: async (credentials) => {
      set({ isLoading: true, error: null, isAccountLocked: false });
      try {
        const { user, token } = await authService.login(credentials);

        // ── Role gate: block if user.role doesn't match expected role ──
        const expected = credentials.expectedRole;
        if (expected && user.role !== expected) {
          // Clear the token we just stored so the user isn't silently signed in
          await authService.logout();
          const roleLabels: Record<string, string> = {
            buyer: "a buyer",
            vendor: "a vendor / seller",
            admin: "an admin",
          };
          const actualLabel = roleLabels[user.role] ?? user.role;
          const expectedLabel = roleLabels[expected] ?? expected;
          set({
            error: `This account is registered as ${actualLabel}. You selected ${expectedLabel} on the previous screen. Please go back and choose the correct role.`,
            isLoading: false,
          });
          return;
        }

        set({
          user,
          token,
          isAuthenticated: true,
          isLoading: false,
          hasSeenOnboarding: true,
        });
        setMonitoringUser({ id: user.id, role: user.role });
        // Register push token (non-blocking)
        pushTokenService.registerPushToken().then((pt) => { if (pt) set({ pushToken: pt }); }).catch(() => {});
      } catch (err: unknown) {
        if (err instanceof ApiRequestError && err.status === 423) {
          set({
            error: "Your account has been suspended. Contact support.",
            isLoading: false,
            isAccountLocked: true,
          });
        } else {
          set({
            error: err instanceof Error ? err.message : "Login failed",
            isLoading: false,
          });
        }
      }
    },

    register: async (payload) => {
      set({ isLoading: true, error: null });
      try {
        const { user, token } = await authService.register(payload);

        // ── Role gate: block if returned role doesn't match requested role ──
        if (payload.role && user.role !== payload.role) {
          await authService.logout();
          const roleLabels: Record<string, string> = {
            buyer: "a buyer",
            vendor: "a vendor / seller",
            admin: "an admin",
          };
          const actualLabel = roleLabels[user.role] ?? user.role;
          const expectedLabel = roleLabels[payload.role] ?? payload.role;
          set({
            error: `This account was created as ${actualLabel}, but you selected ${expectedLabel}. Please go back and choose the correct role.`,
            isLoading: false,
          });
          return;
        }

        set({
          user,
          token,
          isAuthenticated: true,
          isLoading: false,
          hasSeenOnboarding: true,
        });
        setMonitoringUser({ id: user.id, role: user.role });
        // Register push token (non-blocking)
        pushTokenService.registerPushToken().then((pt) => { if (pt) set({ pushToken: pt }); }).catch(() => {});
      } catch (err: unknown) {
        set({
          error: err instanceof Error ? err.message : "Registration failed",
          isLoading: false,
        });
      }
    },

    logout: async () => {
      set({ isLoading: true });
      try {
        const pt = get().pushToken;
        if (pt) {
          pushTokenService.unregisterPushToken(pt).catch(() => {});
        }
        await authService.logout();
      } finally {
        useCartStore.getState().reset();
        setMonitoringUser(null);
        set({
          user: null,
          token: null,
          pushToken: null,
          isAuthenticated: false,
          isLoading: false,
          error: null,
          isAccountLocked: false,
          hasSeenOnboarding: true,
        });
      }
    },

    updateProfile: async (data) => {
      const response = await authService.updateProfile(data);
      const current = get().user;
      const merged = { ...(current ?? {}), ...(response.user ?? data) } as AnyProfile;
      set({ user: merged });
      return merged;
    },

    setUser: (user) => set({ user }),
    clearError: () => set({ error: null, isAccountLocked: false }),
    setLoading: (loading) => set({ isLoading: loading }),
    setHasSeenOnboarding: () => set({ hasSeenOnboarding: true }),
  };
});

// ─── Selectors ─────────────────────────────────────────────────────────────────

export const selectUser = (state: AuthStore) => state.user;
export const selectRole = (state: AuthStore): UserRole | null => state.user?.role ?? null;
export const selectIsVendor = (state: AuthStore) => state.user?.role === "vendor";
export const selectIsBuyer = (state: AuthStore) => state.user?.role === "buyer";
export const selectIsAdmin = (state: AuthStore) => state.user?.role === "admin";
