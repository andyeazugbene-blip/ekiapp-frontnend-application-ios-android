import { apiClient, requestTwoFactorCode } from "../api";
import { AuditLogEntry } from "@/types";

function normalizeAuditLog(raw: any): AuditLogEntry {
  return {
    id: raw.id,
    actorId: raw.actorId,
    action: raw.action,
    entityType: raw.entityType,
    entityId: raw.entityId ?? null,
    metadata: raw.metadata ?? null,
    beforeState: raw.beforeState ?? null,
    afterState: raw.afterState ?? null,
    reason: raw.reason ?? null,
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

export interface AuditLogFilters {
  actor?: string; // name or email contains
  actorId?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  from?: string; // yyyy-mm-dd
  to?: string;
  q?: string; // reason contains
}

function toQuery(filters: AuditLogFilters, extra: Record<string, string> = {}): string {
  const query = new URLSearchParams(extra);
  (Object.keys(filters) as (keyof AuditLogFilters)[]).forEach((k) => {
    const v = filters[k];
    if (v && v.trim()) query.set(k, v.trim());
  });
  return query.toString();
}

export const auditLogsAPI = {
  /** Legacy helper kept for pages that deep-link to one entity's history. */
  async getLogs(params?: { action?: string; entityType?: string; entityId?: string; actorId?: string }): Promise<AuditLogEntry[]> {
    const res = await this.page(params ?? {}, undefined, 100);
    return res.items;
  },

  async page(filters: AuditLogFilters, cursor?: string, limit = 25): Promise<{ items: AuditLogEntry[]; nextCursor: string | null }> {
    const extra: Record<string, string> = { limit: String(limit) };
    if (cursor) extra.cursor = cursor;
    const response = await apiClient.get<any>(`/admin/audit-logs?${toQuery(filters, extra)}`, { bypassCache: true });
    return { items: (response.items ?? []).map(normalizeAuditLog), nextCursor: response.nextCursor ?? null };
  },

  async facets(): Promise<{ entityTypes: string[] }> {
    return apiClient.get("/admin/audit-logs/facets");
  },

  /**
   * CSV export (up to 5000 rows, 2FA-gated, itself audited). Uses fetch directly because
   * apiClient only parses JSON. Pass the code collected from the user.
   */
  async exportCsv(filters: AuditLogFilters, twoFactorCode?: string): Promise<Blob> {
    const base = process.env.NEXT_PUBLIC_API_URL || "https://ekiapp-backend.vercel.app/api";
    const headers: Record<string, string> = { Authorization: `Bearer ${window.localStorage.getItem("admin_token") ?? ""}` };
    if (twoFactorCode) headers["x-2fa-code"] = twoFactorCode;
    const res = await fetch(`${base}/admin/audit-logs/export?${toQuery(filters)}`, { headers });
    if (!res.ok) {
      let message = `Export failed (${res.status})`;
      let code: string | undefined;
      try {
        const body = await res.json();
        message = body.message || message;
        code = body.code;
      } catch {
        /* non-JSON error */
      }
      if (code === "2FA_REQUIRED" && !twoFactorCode) {
        const entered = await requestTwoFactorCode(message);
        if (entered) return this.exportCsv(filters, entered);
        throw new Error("Verification cancelled");
      }
      throw new Error(message);
    }
    return res.blob();
  },
};
