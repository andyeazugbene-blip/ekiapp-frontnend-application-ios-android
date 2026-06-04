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

export const rolesAPI = {
  async list(): Promise<{ roles: AdminRoleRecord[]; permissions: string[] }> {
    return apiClient.get("/admin/roles");
  },

  async create(input: { name: string; description?: string; permissions: string[] }): Promise<{ role: AdminRoleRecord }> {
    return apiClient.post("/admin/roles", input);
  },

  async update(roleId: string, input: { name?: string; description?: string; permissions?: string[] }): Promise<{ role: AdminRoleRecord }> {
    return apiClient.patch(`/admin/roles/${roleId}`, input);
  },

  async delete(roleId: string): Promise<void> {
    await apiClient.delete(`/admin/roles/${roleId}`);
  },

  async assign(roleId: string, user: string): Promise<void> {
    await apiClient.post(`/admin/roles/${roleId}/assignments`, { user });
  },

  async removeAssignment(assignmentId: string): Promise<void> {
    await apiClient.delete(`/admin/role-assignments/${assignmentId}`);
  },
};
