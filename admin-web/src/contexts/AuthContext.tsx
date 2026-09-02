"use client";

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { authAPI } from "@/lib/services/auth.api";
import { User } from "@/types";
import { apiClient, APIError } from "@/lib/api";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAdmin: boolean;
  // Set only when a token exists but checkAuth() couldn't confirm it because
  // of a network/server problem — not because the session is actually
  // invalid. Distinguishing this from "logged out" is what retryAuth/
  // ProtectedRoute use to show a retry panel instead of bouncing to /login,
  // which previously happened on any transient failure (e.g. a dev-server
  // reload racing the request) and silently discarded a perfectly good token.
  authError: string | null;
  retryAuth: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const checkAuth = useCallback(async () => {
    if (!apiClient.hasToken()) {
      setUser(null);
      setAuthError(null);
      setLoading(false);
      return;
    }

    try {
      const currentUser = await authAPI.getCurrentUser();
      if (currentUser.role !== "ADMIN") {
        apiClient.clearToken();
        setUser(null);
      } else {
        setUser(currentUser);
      }
      setAuthError(null);
    } catch (err) {
      // A real 401/403 means the token is genuinely invalid/expired — clear
      // it. Anything else (network failure, 5xx, timeout) is transient: the
      // token may still be perfectly good, so keep it and let the caller
      // retry instead of forcing a re-login.
      if (err instanceof APIError && (err.status === 401 || err.status === 403)) {
        apiClient.clearToken();
        setUser(null);
        setAuthError(null);
      } else {
        setAuthError(err instanceof APIError ? err.message : "Could not verify your session. Check your connection.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = async (email: string, password: string) => {
    setLoading(true);
    const response = await authAPI.login(email, password);
    if (response.user?.role !== "ADMIN") {
      apiClient.clearToken();
      setUser(null);
      setLoading(false);
      throw new APIError(403, "Access denied. Admin role required.");
    }
    setUser(response.user);
    setLoading(false);
  };

  const logout = () => {
    authAPI.logout();
    setUser(null);
  };

  const isAdmin = user?.role === "ADMIN";

  const retryAuth = () => {
    setLoading(true);
    checkAuth();
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isAdmin, authError, retryAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
