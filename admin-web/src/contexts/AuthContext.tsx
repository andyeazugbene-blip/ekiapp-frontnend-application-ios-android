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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    if (!apiClient.hasToken()) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const currentUser = await authAPI.getCurrentUser();
      if (currentUser.role !== "ADMIN") {
        apiClient.clearToken();
        setUser(null);
        return;
      }
      setUser(currentUser);
    } catch {
      apiClient.clearToken();
      setUser(null);
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

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isAdmin }}>
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
