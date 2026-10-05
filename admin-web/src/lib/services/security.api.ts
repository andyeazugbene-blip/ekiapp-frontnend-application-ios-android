import { apiClient } from "../api";

export interface TwoFactorSetup {
  secret: string;
  otpauthUrl: string;
}

export const twoFactorAPI = {
  setup(): Promise<TwoFactorSetup> {
    return apiClient.post("/admin/2fa/setup", {});
  },
  verify(code: string): Promise<{ message: string; backupCodes: string[]; warning: string }> {
    return apiClient.post("/admin/2fa/verify", { code });
  },
  disable(code: string): Promise<{ message: string }> {
    return apiClient.post("/admin/2fa/disable", { code });
  },
  regenerateBackupCodes(code: string): Promise<{ backupCodes: string[]; warning: string }> {
    return apiClient.post("/admin/2fa/backup-codes/regenerate", { code });
  },
};

export const sessionsAPI = {
  /** Bumps tokenVersion and returns a fresh token for this browser. */
  async revokeOthers(reason: string): Promise<void> {
    const res = await apiClient.post<{ token: string }>("/admin/me/sessions/revoke-others", { reason });
    if (res.token && typeof window !== "undefined") {
      window.localStorage.setItem("admin_token", res.token);
    }
  },
};

export interface AdminAccount {
  id: string;
  name: string;
  email: string;
  status: "ACTIVE" | "INVITED" | "DEACTIVATED";
  deactivatedReason: string | null;
  deactivatedAt: string | null;
  createdAt: string;
  lastActivityAt: string | null;
  twoFactorEnabled: boolean;
  roles: { assignmentId: string; id: string; name: string }[];
}

export const adminTeamAPI = {
  async list(): Promise<AdminAccount[]> {
    const res = await apiClient.get<{ admins: AdminAccount[] }>("/admin/admins", { bypassCache: true });
    return res.admins;
  },
  invite(input: { email: string; name: string; roleId: string; reason: string }) {
    return apiClient.post<{ admin: { id: string; email: string; name: string; roleName: string }; expiresAt: string; setPasswordUrl?: string }>("/admin/admins/invite", input);
  },
  deactivate(id: string, reason: string) {
    return apiClient.post(`/admin/admins/${id}/deactivate`, { reason });
  },
  reactivate(id: string, reason: string) {
    return apiClient.post(`/admin/admins/${id}/reactivate`, { reason });
  },
  changeRole(id: string, roleId: string, reason: string) {
    return apiClient.put(`/admin/admins/${id}/role`, { roleId, reason });
  },
};

export interface PlatformFlag {
  key: string;
  enabled: boolean;
  description: string | null;
  updatedAt: string;
  updatedBy: { id: string; name: string | null; email: string | null } | null;
}

export interface SettingHistoryEntry {
  id: string;
  action: string;
  createdAt: string;
  reason: string | null;
  beforeState: unknown;
  afterState: unknown;
  actor: { id: string; name: string | null; email: string | null };
}

export interface IntegrationStatus {
  key: string;
  label: string;
  configured: boolean;
  detail: string;
  checks: { label: string; ok: boolean }[];
}

export interface SystemInfo {
  version: string;
  environment: string;
  commit: string | null;
  nodeVersion: string;
  admin2faEnforced: boolean;
  startedAt: string;
}

export const platformSettingsAPI = {
  async listFlags(): Promise<PlatformFlag[]> {
    const res = await apiClient.get<{ flags: PlatformFlag[] }>("/admin/settings/flags", { bypassCache: true });
    return res.flags;
  },
  saveFlag(key: string, input: { enabled: boolean; description?: string; reason: string }) {
    return apiClient.put(`/admin/settings/flags/${encodeURIComponent(key)}`, input);
  },
  async history(key: string): Promise<SettingHistoryEntry[]> {
    const res = await apiClient.get<{ history: SettingHistoryEntry[] }>(`/admin/settings/history/${encodeURIComponent(key)}`, { bypassCache: true });
    return res.history;
  },
  integrations(): Promise<{ integrations: IntegrationStatus[]; system: SystemInfo }> {
    return apiClient.get("/admin/integrations/status", { bypassCache: true });
  },
};
