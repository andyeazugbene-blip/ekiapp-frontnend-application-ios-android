import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { authService } from "../services/authService";
import { ApiRequestError, setOnUnauthorized } from "../services/api";
import { tokenStorage } from "../services/api/tokenStorage";
import { setMonitoringUser } from "../services/monitoring";
import { pushTokenService } from "../services/notificationService";
import { AdminProfile, AuthCapabilities, BuyerProfile, LastDestination, LoginCredentials, RegisterPayload, UserRole, VendorProfile } from "../types/auth";
import { useCartStore } from "./cartStore";
import { useFavoritesStore } from "./favoritesStore";
import { useOrderStore } from "./orderStore";
import { useVendorOrderStore } from "./vendorOrderStore";
import { useVendorStore } from "./vendorStore";

type AnyProfile = BuyerProfile | VendorProfile | AdminProfile;
type AuthCache = {
  user: AnyProfile | null;
  hasSeenOnboarding: boolean;
  pushToken: string | null;
  lastDestination: LastDestination | null;
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
  // Community Buy Workstream 9 (universal account) — a preference, never an
  // authority: which of Buy/Sell/Supply/Community Buy this user last chose
  // to enter as. Replaces the old lastRole field now that access to each
  // destination is capability-based (hasVendor, canSupply, ...), not
  // role-based — this value only ever decides which screen to land on.
  lastDestination: LastDestination | null;
  error: string | null;
  isAccountLocked: boolean;
  checkAuth: () => Promise<void>;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<string>;
  updateProfile: (data: Record<string, unknown>) => Promise<AnyProfile>;
  setUser: (user: AnyProfile) => void;
  finalizeOAuthSession: (user: AnyProfile, token: string) => void;
  setLastDestination: (destination: LastDestination) => void;
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
  useFavoritesStore.getState().reset();
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
      lastDestination: parsed.lastDestination ?? null,
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
      lastDestination: state.lastDestination,
    });
  };

  setOnUnauthorized(() => {
    const state = get();
    // During initialization checkAuth() handles expired-token cleanup itself.
    // Firing here would clear auth state mid-init and race with a concurrent login.
    if (state.isInitializing) return;
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
    lastDestination: null,
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
          lastDestination: cached.lastDestination || null,
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
            lastDestination: (result.user.lastDestination as LastDestination | undefined) ?? get().lastDestination,
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

        set({
          user,
          token,
          lastDestination: (user.lastDestination as LastDestination | undefined) ?? get().lastDestination,
          isAuthenticated: true,
          isLoading: false,
          hasSeenOnboarding: true,
        });
        setMonitoringUser({ id: user.id, role: user.role });
        persistState();
        pushTokenService
          .registerPushToken(token)
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

        // Community Buy Workstream 9 (universal account): registration no
        // longer rejects on a role mismatch. Under the capability model
        // every account can buy/organise regardless of which entry point
        // created it, so there is nothing left for a mismatch to protect
        // against — the old check only risked force-logging out a
        // successfully-created account (a role trap), never anything real.
        set({
          user,
          token,
          lastDestination: (user.lastDestination as LastDestination | undefined) ?? get().lastDestination,
          isAuthenticated: true,
          isLoading: false,
          hasSeenOnboarding: true,
        });
        setMonitoringUser({ id: user.id, role: user.role });
        persistState();
        pushTokenService
          .registerPushToken(token)
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

    // Used after a Google/Apple LOGIN outcome, or after successfully
    // completing /oauth/link or /oauth/complete-signup — the token is
    // already stored by authService at that point (mirroring login()'s
    // success tail exactly, minus the credential exchange it doesn't need).
    finalizeOAuthSession: (user, token) => {
      set({
        user,
        token,
        lastDestination: (user.lastDestination as LastDestination | undefined) ?? get().lastDestination,
        isAuthenticated: true,
        isLoading: false,
        error: null,
        hasSeenOnboarding: true,
      });
      setMonitoringUser({ id: user.id, role: user.role });
      persistState();
      pushTokenService
        .registerPushToken(token)
        .then((pushToken) => {
          if (pushToken) {
            set({ pushToken });
            persistState();
          }
        })
        .catch(() => {});
    },
    setLastDestination: (destination) => {
      set({ lastDestination: destination });
      persistState();
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
// Community Buy Workstream 9 — capability-based selectors, the intended
// replacement for role-based access checks going forward. selectIsVendor/
// selectIsBuyer above remain for existing display-only (cosmetic) usages;
// new access decisions should prefer these plus selectHasVendor.
export const selectCapabilities = (state: AuthStore): AuthCapabilities | null => state.user?.capabilities ?? null;
export const selectLastDestination = (state: AuthStore): LastDestination | null => state.lastDestination;
