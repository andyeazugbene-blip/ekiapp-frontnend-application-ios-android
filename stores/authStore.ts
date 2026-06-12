import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { authService } from "../services/authService";
import { ApiRequestError, setOnUnauthorized } from "../services/api";
import { tokenStorage } from "../services/api/tokenStorage";
import { setMonitoringUser } from "../services/monitoring";
import { pushTokenService } from "../services/notificationService";
import { AdminProfile, BuyerProfile, LoginCredentials, RegisterPayload, UserRole, VendorProfile } from "../types/auth";
import { useCartStore } from "./cartStore";
import { useOrderStore } from "./orderStore";
import { useVendorOrderStore } from "./vendorOrderStore";
import { useVendorStore } from "./vendorStore";

type AnyProfile = BuyerProfile | VendorProfile | AdminProfile;
type AuthCache = {
  user: AnyProfile | null;
  hasSeenOnboarding: boolean;
  pushToken: string | null;
};

const AUTH_CACHE_KEY = "eki_auth_cache";

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
  deleteAccount: () => Promise<string>;
  updateProfile: (data: Record<string, unknown>) => Promise<AnyProfile>;
  setUser: (user: AnyProfile) => void;
  switchRole: () => Promise<void>;
  clearError: () => void;
  setLoading: (loading: boolean) => void;
  setHasSeenOnboarding: () => void;
  beginFreshAuthFlow: () => Promise<void>;
}

const clearLocalSession = () => {
  useCartStore.getState().reset();
  useOrderStore.setState({ orders: [], selectedOrder: null, earnings: null, isLoading: false, error: null });
  useVendorOrderStore.setState({ selectedOrder: null, localOrders: [] });
  useVendorStore.setState({ vendors: [], selectedVendor: null, dashboardData: null, adminDashboard: null, isLoading: false, error: null });
  setMonitoringUser(null);
};

async function readAuthCache(): Promise<AuthCache | null> {
  try {
    const raw = await AsyncStorage.getItem(AUTH_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AuthCache>;
    return {
      user: (parsed.user as AnyProfile | null) ?? null,
      hasSeenOnboarding: parsed.hasSeenOnboarding === true,
      pushToken: parsed.pushToken ?? null,
    };
  } catch {
    return null;
  }
}

async function writeAuthCache(cache: AuthCache) {
  try {
    await AsyncStorage.setItem(AUTH_CACHE_KEY, JSON.stringify(cache));
  } catch {}
}

async function clearAuthCache() {
  try {
    await AsyncStorage.removeItem(AUTH_CACHE_KEY);
  } catch {}
}

export const useAuthStore = create<AuthStore>((set, get) => {
  const persistState = () => {
    const state = get();
    void writeAuthCache({
      user: state.user,
      hasSeenOnboarding: state.hasSeenOnboarding,
      pushToken: state.pushToken,
    });
  };

  setOnUnauthorized(() => {
    const state = get();
    clearLocalSession();
    void clearAuthCache();
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
      const cached = await readAuthCache();
      const storedToken = await tokenStorage.getToken();

      if (cached?.hasSeenOnboarding && !get().hasSeenOnboarding) {
        set({ hasSeenOnboarding: true });
      }

      if (cached?.user && storedToken && !get().isAuthenticated) {
        set({
          user: cached.user,
          token: storedToken,
          pushToken: cached.pushToken,
          isAuthenticated: true,
          hasSeenOnboarding: cached.hasSeenOnboarding || get().hasSeenOnboarding,
        });
        setMonitoringUser({ id: cached.user.id, role: cached.user.role });
      }

      try {
        const result = await authService.getMe();
        if (result) {
          set({
            user: result.user,
            token: result.token,
            pushToken: get().pushToken ?? cached?.pushToken ?? null,
            isAuthenticated: true,
            isInitializing: false,
            hasSeenOnboarding: true,
          });
          setMonitoringUser({ id: result.user.id, role: result.user.role });
          persistState();
          return;
        }

        clearLocalSession();
        await clearAuthCache();
        set({
          user: null,
          token: null,
          pushToken: null,
          isAuthenticated: false,
          isInitializing: false,
          hasSeenOnboarding: cached?.hasSeenOnboarding ?? get().hasSeenOnboarding,
        });
      } catch {
        const state = get();
        set({
          isInitializing: false,
          hasSeenOnboarding: cached?.hasSeenOnboarding ?? state.hasSeenOnboarding,
        });
      }
    },

    login: async (credentials) => {
      set({ isLoading: true, error: null, isAccountLocked: false });
      try {
        const { user, token } = await authService.login(credentials);
        const expected = credentials.expectedRole;

        if (expected && user.role !== expected && user.role !== "admin" && !user.hasVendor) {
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
        persistState();
        pushTokenService
          .registerPushToken()
          .then((pushToken) => {
            if (pushToken) {
              set({ pushToken });
              persistState();
            }
          })
          .catch(() => {});
      } catch (err: unknown) {
        if (err instanceof ApiRequestError && err.status === 423) {
          set({
            error: "Your account has been suspended. Contact support.",
            isLoading: false,
            isAccountLocked: true,
          });
          return;
        }

        set({
          error: err instanceof Error ? err.message : "Login failed",
          isLoading: false,
        });
      }
    },

    register: async (payload) => {
      set({ isLoading: true, error: null });
      try {
        const { user, token } = await authService.register(payload);

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
        persistState();
        pushTokenService
          .registerPushToken()
          .then((pushToken) => {
            if (pushToken) {
              set({ pushToken });
              persistState();
            }
          })
          .catch(() => {});
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
        const pushToken = get().pushToken;
        if (pushToken) {
          pushTokenService.unregisterPushToken(pushToken).catch(() => {});
        }
        await authService.logout();
      } finally {
        clearLocalSession();
        await clearAuthCache();
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

    deleteAccount: async () => {
      set({ isLoading: true, error: null });
      try {
        const message = (await authService.deleteAccount()).message;
        await authService.logout();
        clearLocalSession();
        await clearAuthCache();
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
        return message;
      } catch (err: unknown) {
        set({
          isLoading: false,
          error: err instanceof Error ? err.message : "Account deletion failed",
        });
        throw err;
      }
    },

    updateProfile: async (data) => {
      const response = await authService.updateProfile(data);
      const current = get().user;
      const merged = { ...(current ?? {}), ...(response.user ?? data) } as AnyProfile;
      set({ user: merged });
      persistState();
      return merged;
    },

    beginFreshAuthFlow: async () => {
      await tokenStorage.clearTokens();
      clearLocalSession();
      await clearAuthCache();
      set({
        user: null,
        token: null,
        pushToken: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
        isAccountLocked: false,
      });
    },

    setUser: (user) => {
      set({ user });
      persistState();
    },
    switchRole: async () => {
      try {
        const { user, token } = await authService.switchRole();
        set({ user, token });
        setMonitoringUser({ id: user.id, role: user.role });
        persistState();
      } catch (err) {
        set({ error: err instanceof Error ? err.message : "Failed to switch role" });
      }
    },
    clearError: () => set({ error: null, isAccountLocked: false }),
    setLoading: (loading) => set({ isLoading: loading }),
    setHasSeenOnboarding: () => {
      set({ hasSeenOnboarding: true });
      persistState();
    },
  };
});

export const selectUser = (state: AuthStore) => state.user;
export const selectRole = (state: AuthStore): UserRole | null => state.user?.role ?? null;
export const selectHasVendor = (state: AuthStore): boolean => state.user?.hasVendor === true;
export const selectIsVendor = (state: AuthStore) => state.user?.role === "vendor";
export const selectIsBuyer = (state: AuthStore) => state.user?.role === "buyer";
export const selectIsAdmin = (state: AuthStore) => state.user?.role === "admin";
