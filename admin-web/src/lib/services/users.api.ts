import { apiClient } from "../api";
import { User, UserRole } from "@/types";

function normalizeUser(raw: any): User {
  return {
    id: raw.id,
    name: raw.name ?? "",
    email: raw.email ?? "",
    role: (raw.role ?? "BUYER").toString().toUpperCase() as UserRole,
    status: raw.isSuspended ? "suspended" : "active",
    createdAt: raw.createdAt ?? "",
    suspendedReason: raw.suspendedReason ?? null,
  };
}

export const usersAPI = {
  async getUsers(params?: { role?: string; status?: string; limit?: number }): Promise<User[]> {
    const query = new URLSearchParams();
    if (params?.role) query.set("role", params.role.toUpperCase());
    query.set("limit", String(params?.limit ?? 100));
    const res = await apiClient.get<any>(`/admin/users?${query.toString()}`);
    return (res.items ?? res.users ?? []).map(normalizeUser);
  },

  async getUser(userId: string): Promise<User> {
    try {
      const res = await apiClient.get<any>(`/admin/users/${userId}`);
      return normalizeUser(res.user ?? res);
    } catch {
      const users = await this.getUsers();
      const matchedUser = users.find((user) => user.id === userId);
      if (!matchedUser) throw new Error("User not found");
      return matchedUser;
    }
  },

  async preloadUser(userId: string): Promise<void> {
    await apiClient.prefetch(`/admin/users/${userId}`);
  },

  async suspendUser(userId: string, reason?: string, twoFactorCode?: string): Promise<void> {
    await apiClient.patch(`/admin/users/${userId}/suspend`, { reason }, { twoFactorCode });
  },

  async unsuspendUser(userId: string, twoFactorCode?: string): Promise<void> {
    await apiClient.patch(`/admin/users/${userId}/unsuspend`, {}, { twoFactorCode });
  },
};
