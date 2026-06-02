import { apiClient } from "../api";
import { AuditLogEntry } from "@/types";

function normalizeAuditLog(raw: any): AuditLogEntry {
  return {
    id: raw.id,
    actorId: raw.actorId,
    action: raw.action,
    entityType: raw.entityType,
    entityId: raw.entityId ?? null,
    metadata: raw.metadata ?? null,
    createdAt: raw.createdAt,
    actor: raw.actor
      ? {
          id: raw.actor.id,
          name: raw.actor.name,
          email: raw.actor.email,
          role: raw.actor.role,
        }
      : null,
  };
}

export const auditLogsAPI = {
  async getLogs(params?: { action?: string; entityType?: string; actorId?: string }): Promise<AuditLogEntry[]> {
    const query = new URLSearchParams({ limit: "100" });
    if (params?.action) query.set("action", params.action);
    if (params?.entityType) query.set("entityType", params.entityType);
    if (params?.actorId) query.set("actorId", params.actorId);
    const response = await apiClient.get<any>(`/admin/audit-logs?${query.toString()}`);
    return (response.items ?? []).map(normalizeAuditLog);
  },
};
