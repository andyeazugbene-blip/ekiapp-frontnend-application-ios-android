import { useAuthStore } from "../stores/authStore";
import { BuyerProfile, VendorProfile, AdminProfile } from "../types/auth";

export function useAuth() {
  const { user, token, isAuthenticated, isLoading, error, login, register, logout, clearError } =
    useAuthStore();

  const isBuyer = user?.role === "buyer";
  const isVendor = user?.role === "vendor";
  const isAdmin = user?.role === "admin";

  const asBuyer = isBuyer ? (user as BuyerProfile) : null;
  const asVendor = isVendor ? (user as VendorProfile) : null;
  const asAdmin = isAdmin ? (user as AdminProfile) : null;

  return {
    user,
    token,
    isAuthenticated,
    isLoading,
    error,
    isBuyer,
    isVendor,
    isAdmin,
    asBuyer,
    asVendor,
    asAdmin,
    login,
    register,
    logout,
    clearError,
  };
}
