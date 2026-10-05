import { apiClient } from "../api";

export interface AdminRoleAssignment {
  id: string;
  userId: string;
  roleId: string;
  user?: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
}

export interface AdminRoleRecord {
  id: string;
  name: string;
  description?: string | null;
  permissions: string[];
  isSystem: boolean;
  assignments: AdminRoleAssignment[];
}

// Every role mutation needs a reason (server-validated, >= 5 chars) and is 2FA-gated;
// the api client prompts for the code automatically.
export const rolesAPI = {
  async list(): Promise<{ roles: AdminRoleRecord[]; permissions: string[] }> {
    return apiClient.get("/admin/roles", { bypassCache: true });
  },

  async create(input: { name: string; description?: string; permissions: string[]; reason: string }): Promise<{ role: AdminRoleRecord }> {
    return apiClient.post("/admin/roles", input);
  },

  async update(roleId: string, input: { name?: string; description?: string; permissions?: string[]; reason: string }): Promise<{ role: AdminRoleRecord }> {
    return apiClient.patch(`/admin/roles/${roleId}`, input);
  },

  async delete(roleId: string, reason: string): Promise<void> {
    await apiClient.delete(`/admin/roles/${roleId}?reason=${encodeURIComponent(reason)}`);
  },

  async assign(roleId: string, user: string, reason: string): Promise<void> {
    await apiClient.post(`/admin/roles/${roleId}/assignments`, { user, reason });
  },

  async removeAssignment(assignmentId: string, reason: string): Promise<void> {
    await apiClient.delete(`/admin/role-assignments/${assignmentId}?reason=${encodeURIComponent(reason)}`);
  },
};
