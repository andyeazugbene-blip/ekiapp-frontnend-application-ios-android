import { apiClient } from "../api";

export interface AutomationSummary {
  byType: { type: string; count: number }[];
  byStatus: { status: string; count: number }[];
  recentFailures: { id: string; type: string; vendorId?: string | null; recipientUserId: string; status: string; failureReason?: string | null; createdAt: string }[];
  recentSuppressed: { id: string; type: string; vendorId?: string | null; recipientUserId: string; status: string; suppressedReason?: string | null; createdAt: string }[];
}

export type RuleState = "DRAFT" | "TEST" | "ACTIVE" | "PAUSED" | "FAILED" | "ARCHIVED";

export interface AutomationRule {
  id: string;
  key: string;
  name: string;
  purpose: string;
  owner: string;
  version: number;
  relatedFeature: string | null;
  automationType: string | null;
  triggerDescription: string;
  exclusions: string[] | null;
  audience: string | null;
  timing: { frequencyCapDays?: number | null; quietHoursStartUtc?: number; quietHoursEndUtc?: number; stopConditions?: string[] } | null;
  channels: string[] | null;
  state: RuleState;
  stateReason: string | null;
  lastRunAt: string | null;
  lastSkippedAt: string | null;
  lastSkipReason: string | null;
  lastSuccessAt: string | null;
  updatedAt: string;
  preview: { title: string; body: string } | null;
  counts30d: Record<string, number>;
}

export interface RulesResponse {
  note: string;
  automationsPaused: boolean;
  pause: { commsPaused: boolean; automationsPaused: boolean };
  items: AutomationRule[];
}

export interface RunChannel {
  channel: string;
  communicationLogId: string;
  status: string;
  providerRef: string | null;
  statusDetail: string | null;
  deliveredAt: string | null;
}

export interface AutomationRunRow {
  id: string;
  type: string;
  ruleKey: string | null;
  status: string;
  deliveryState: string;
  recipient: { id: string; name: string | null; email: string | null } | null;
  vendor: { id: string; storeName: string } | null;
  isTest: boolean;
  attempt: number;
  retryOfId: string | null;
  triggerData: Record<string, unknown> | null;
  createdAt: string;
  sentAt: string | null;
  suppressedReason: string | null;
  failureReason: string | null;
  channels: RunChannel[];
}

export interface RunsQuery {
  type?: string; status?: string; recipient?: string; vendorId?: string; reason?: string; from?: string; to?: string; ruleKey?: string;
  includeTests?: boolean; cursor?: string; limit?: number;
}

export interface FailuresResponse {
  failedCount30d: number;
  failedRuns: { id: string; type: string; ruleKey: string | null; recipient: { id: string; name: string | null; email: string | null } | null; failureReason: string | null; attempt: number; createdAt: string; retryOfId: string | null }[];
  suppressedByReason: { reason: string; count: number }[];
  lastSuccessByRule: { ruleKey: string | null; lastSuccessAt: string | null }[];
  providerErrors: { channel: string; detail: string; count: number }[];
  note: string;
}

export interface PerformanceResponse {
  windowDays: number;
  byStatus: { status: string; count: number }[];
  byType: { type: string; status: string; count: number }[];
  note: string;
}

export interface EventRow {
  id: string; name: string; occurredAt: string; timezone: string; actorType: string | null; actorId: string | null;
  entityType: string | null; entityId: string | null; source: string | null; amountMinor: number | null; currency: string | null; payload: Record<string, unknown> | null;
}

function qs(params: Record<string, string | number | boolean | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "" && v !== false) q.set(k, String(v));
  const s = q.toString();
  return s ? `?${s}` : "";
}

export const automationAPI = {
  getSummary: () => apiClient.get<AutomationSummary>("/admin/automation/summary"),
  rules: () => apiClient.get<RulesResponse>("/admin/automation/rules"),
  updateRule: (id: string, patch: Record<string, unknown>, reason: string) => apiClient.patch<{ rule: AutomationRule }>(`/admin/automation/rules/${id}`, { ...patch, reason }),
  ruleAction: (id: string, action: "pause" | "resume" | "archive" | "duplicate", reason: string) => apiClient.post<{ rule: AutomationRule }>(`/admin/automation/rules/${id}/${action}`, { reason }),
  testRule: (id: string, body: { recipientUserId?: string; sendToMe?: boolean }, reason: string) =>
    apiClient.post<{ runId: string; status: string; eligible: boolean; ineligibleReason: string | null; sentToAdmin: boolean; preview: { title: string; body: string; channels: string[] } }>(`/admin/automation/rules/${id}/test`, { ...body, reason }),
  emergencyStop: (reason: string) => apiClient.post<{ pausedRules: number }>("/admin/automation/emergency-stop", { reason }),
  releaseEmergencyStop: (reason: string) => apiClient.post<{ restoredRules: number }>("/admin/automation/emergency-stop/release", { reason }),
  runs: (q: RunsQuery) => apiClient.get<{ items: AutomationRunRow[]; nextCursor: string | null }>(`/admin/automation/runs${qs(q as Record<string, string | number | boolean | undefined>)}`),
  retryRun: (id: string, reason: string) => apiClient.post<{ id: string; status: string }>(`/admin/automation/runs/${id}/retry`, { reason }),
  failures: () => apiClient.get<FailuresResponse>("/admin/automation/failures"),
  performance: () => apiClient.get<PerformanceResponse>("/admin/automation/performance"),
  events: (q: { name?: string; entityType?: string; entityId?: string; from?: string; to?: string; cursor?: string; limit?: number }) =>
    apiClient.get<{ items: EventRow[]; nextCursor: string | null }>(`/admin/events${qs(q)}`),
};
