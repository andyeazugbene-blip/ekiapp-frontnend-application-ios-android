import { apiClient } from "../api";

export type BroadcastAudience =
  | "all" | "vendors" | "buyers"
  | "active_vendors" | "new_vendors"
  | "individual_vendor" | "individual_buyer" | "individual_user"
  | "last_30_days_buyers" | "repeat_buyers" | "inactive_buyers"
  | "first_time_buyers" | "top_customers"
  | "bought_specific_product";
/** SMS is intentionally not a channel in the admin panel. */
export type BroadcastChannel = "in_app" | "push" | "email";
export type BroadcastCategory = "marketing" | "operational";
export type BroadcastStatus = "DRAFT" | "SCHEDULED" | "SENDING" | "SENT" | "PARTIALLY_DELIVERED" | "FAILED" | "CANCELLED";

export type ExclusionReason =
  | "sender" | "suspended" | "anonymised" | "no_marketing_consent"
  | "frequency_capped" | "automation_conflict" | "no_push_token" | "quiet_hours" | "no_email";

export interface ChannelEligibility { eligible: number; excluded: Partial<Record<ExclusionReason, number>> }

export interface AudiencePreview {
  audienceCount: number;
  total: number;
  capped: boolean;
  category: BroadcastCategory;
  quietHours: boolean;
  channels: Record<BroadcastChannel, ChannelEligibility>;
  reachable: number;
}

export interface ChannelStatus {
  in_app: { configured: boolean; provider: string; note: string };
  push: { configured: boolean; provider: string; tokenUsers: number; totalUsers: number; coveragePct: number; expoAccessToken: boolean; note: string };
  email: { configured: boolean; provider: string; note: string };
  sms: { available: boolean; note: string };
  pause: { commsPaused: boolean; automationsPaused: boolean; updatedAt: string | null; updatedById: string | null };
  deepLinks: Array<{ path: string; label: string; audience: "buyer" | "vendor" }>;
  frequencyCapHours: number;
  quietHoursUtc: { start: number; end: number };
  audienceCap: number;
}

export interface RecipientHit {
  id: string;
  name: string;
  email: string;
  role: "BUYER" | "VENDOR";
  isSuspended: boolean;
  marketingConsentAt: string | null;
  vendor: { id: string; storeName: string } | null;
}

export interface BroadcastDraft {
  title: string;
  body: string;
  audience: BroadcastAudience;
  channels: BroadcastChannel[];
  category: BroadcastCategory;
  deepLink?: string;
  templateKey?: string;
  vendorId?: string;
  userId?: string;
  productId?: string;
}

export interface TestSendResult {
  sentTo: string;
  channels: BroadcastChannel[];
  results: Partial<Record<BroadcastChannel, { ok: boolean; status: string; detail?: string }>>;
  passed: boolean;
  testToken?: string;
}

export interface ChannelCounts { eligible: number; queued: number; sent: number; delivered: number; failed: number; read?: number }

export interface BroadcastRecord {
  id: string;
  createdById: string;
  status: BroadcastStatus;
  category: BroadcastCategory;
  title: string;
  body: string;
  deepLink: string | null;
  audience: string;
  channels: string[];
  reason: string;
  scheduledFor: string | null;
  startedAt: string | null;
  completedAt: string | null;
  audienceTotal: number;
  eligibility: { channels?: Record<BroadcastChannel, ChannelEligibility>; capped?: boolean; quietHours?: boolean } | null;
  channelResults: Record<string, string> | null;
  error: string | null;
  createdAt: string;
  counts?: Record<string, ChannelCounts>;
  createdBy?: { id: string; name: string; email: string } | null;
}

export interface BroadcastSendResult {
  duplicate?: boolean;
  scheduled?: boolean;
  scheduledId?: string;
  broadcastId?: string;
  scheduledFor?: string;
  broadcast?: BroadcastRecord;
  counts?: Record<string, ChannelCounts>;
}

export interface ScheduledItem {
  id: string; audience: string; channel: string; channels: string[]; subject: string; body: string; status: string;
  scheduledFor: string; sentAt: string | null; error: string | null; broadcastId: string | null; category: string;
}

export interface TemplateRow {
  key: string; title: string; body: string; channels: Array<"email" | "push" | "in_app">; enabled: boolean; recipientType: "BUYER" | "VENDOR";
}

export interface TemplateVersion {
  id: string; templateKey: string; version: number; title: string; body: string; channels: string[]; enabled: boolean;
  reason: string | null; createdAt: string; changedBy: { id: string; name: string; email: string } | null;
}

export interface MessagePreview {
  push: { title: string; body: string };
  in_app: { title: string; body: string; deepLink: string | null };
  email: { subject: string; html: string; unsubscribe: boolean };
}

function toBody(d: BroadcastDraft) {
  return {
    subject: d.title,
    body: d.body,
    audience: d.audience,
    channels: d.channels,
    category: d.category,
    deepLink: d.deepLink || undefined,
    templateKey: d.templateKey || undefined,
    vendorId: d.vendorId,
    userId: d.userId,
    productId: d.productId,
  };
}

function qs(params: Record<string, string | number | undefined | null>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") q.set(k, String(v));
  const s = q.toString();
  return s ? `?${s}` : "";
}

export const communicationsAPI = {
  channelStatus: () => apiClient.get<ChannelStatus>("/admin/communications/channel-status", { bypassCache: true }),

  searchRecipients: (params: { q?: string; id?: string }) =>
    apiClient.get<{ users: RecipientHit[] }>(`/admin/communications/recipients${qs(params)}`, { bypassCache: true }),

  audiencePreview: (d: BroadcastDraft) =>
    apiClient.get<AudiencePreview>(
      `/admin/broadcasts/audience-count${qs({ audience: d.audience, category: d.category, channels: d.channels.join(","), vendorId: d.vendorId, userId: d.userId, productId: d.productId })}`,
      { bypassCache: true },
    ),

  previewMessage: (d: BroadcastDraft, sample?: { name?: string; store_name?: string }) =>
    apiClient.post<MessagePreview>("/admin/broadcasts/preview", { ...toBody(d), sample }),

  testSend: (d: BroadcastDraft) => apiClient.post<TestSendResult>("/admin/broadcasts/test-send", toBody(d)),

  send: (d: BroadcastDraft, extra: { reason: string; testToken: string; idempotencyKey: string; scheduledFor?: string }) =>
    apiClient.post<BroadcastSendResult>("/admin/broadcasts", { ...toBody(d), ...extra }),

  listBroadcasts: (params: { status?: string; cursor?: string; limit?: number }) =>
    apiClient.get<{ items: BroadcastRecord[]; nextCursor: string | null }>(`/admin/broadcasts${qs(params)}`, { bypassCache: true }),

  getBroadcast: (id: string) =>
    apiClient.get<{ broadcast: BroadcastRecord; counts: Record<string, ChannelCounts> }>(`/admin/broadcasts/${id}`, { bypassCache: true }),

  checkReceipts: (id: string) =>
    apiClient.post<{ broadcast: BroadcastRecord; counts: Record<string, ChannelCounts> }>(`/admin/broadcasts/${id}/check-receipts`, {}),

  recipientLogs: (broadcastId: string, status?: string) =>
    apiClient.get<{ items: Array<{ id: string; recipientId: string; channel: string; status: string; statusDetail?: string | null; createdAt: string }>; total: number }>(
      `/admin/communications${qs({ broadcastId, status, limit: 50 })}`, { bypassCache: true },
    ),

  pause: {
    get: () => apiClient.get<ChannelStatus["pause"]>("/admin/communications/pause", { bypassCache: true }),
    set: (input: { commsPaused?: boolean; automationsPaused?: boolean; reason: string }) =>
      apiClient.post<ChannelStatus["pause"]>("/admin/communications/pause", input),
  },

  scheduled: {
    list: (status?: string) =>
      apiClient.get<{ items: ScheduledItem[]; total: number }>(`/admin/communications/scheduled${qs({ status, limit: 50 })}`, { bypassCache: true }),
    cancel: (id: string, reason: string) => apiClient.patch<ScheduledItem>(`/admin/communications/scheduled/${id}/cancel`, { reason }),
    update: (id: string, data: { subject?: string; body?: string; scheduledFor?: string; reason: string }) =>
      apiClient.patch<ScheduledItem>(`/admin/communications/scheduled/${id}`, data),
    runDue: () => apiClient.post<Record<string, unknown>>("/admin/communications/run-scheduled", {}),
  },

  templates: {
    list: () => apiClient.get<{ templates: TemplateRow[] }>("/admin/communications/templates", { bypassCache: true }),
    seed: () => apiClient.post<{ seeded: number }>("/admin/communications/templates/seed", {}),
    update: (key: string, data: { title?: string; body?: string; channels?: string[]; enabled?: boolean; reason: string }) =>
      apiClient.patch<TemplateRow>(`/admin/communications/templates/${encodeURIComponent(key)}`, data),
    versions: (key: string) =>
      apiClient.get<{ versions: TemplateVersion[] }>(`/admin/communications/templates/${encodeURIComponent(key)}/versions`, { bypassCache: true }),
  },
};
