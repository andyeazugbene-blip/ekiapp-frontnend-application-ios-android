import { apiClient } from "../api";

export type ReviewTab = "flagged" | "failed" | "suspicious" | "reported" | "history";
export type ModerationStatus = "NOT_REVIEWED" | "PENDING_REVIEW" | "APPROVED" | "REJECTED" | "REMOVED";
export type ModerationAction = "approve" | "reject" | "remove" | "flag" | "contact_owner";

export interface ReviewAsset {
  id: string;
  category: string;
  contentType: string;
  sizeBytes: number | null;
  transferStatus: "REQUESTED" | "COMPLETED" | "FAILED";
  moderationStatus: ModerationStatus;
  createdAt: string;
  completedAt: string | null;
  previewUrl: string | null;
  owner: { id: string; name: string | null; email: string | null; role: string | null; storeName: string | null; vendorId: string | null };
  related: { type: string; id: string | null; label: string } | null;
  allowedActions: ModerationAction[];
  lastDecision: { action: string | null; decision: ModerationStatus; reason: string; at: string; reviewer: string | null } | null;
}

export interface ContentDecisionRow {
  id: string; decision: ModerationStatus; action: string | null; reason: string; reportId: string | null; createdAt: string; reviewer: string | null;
}

export interface ReviewReport {
  id: string;
  reporterId: string;
  reporter: { id: string; name: string; email: string } | null;
  reviewer: { id: string; name: string; email: string } | null;
  targetType: "review" | "message" | "product" | "store";
  targetId: string;
  targetLabel: string | null;
  reason: string;
  details: string | null;
  status: "PENDING" | "REVIEWED" | "DISMISSED";
  reviewedAt: string | null;
  decisionReason: string | null;
  createdAt: string;
}

export interface ReviewCounts { flagged: number; failed: number; suspicious: number; reported: number; history: number; reports: number; identity: number }

function qs(params: Record<string, string | number | undefined | null>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") q.set(k, String(v));
  const s = q.toString();
  return s ? `?${s}` : "";
}

export const contentReviewAPI = {
  counts: () => apiClient.get<ReviewCounts>("/admin/content-review/counts", { bypassCache: true }),
  queue: (p: { tab: ReviewTab; q?: string; category?: string; cursor?: string; limit?: number }) =>
    apiClient.get<{ items: ReviewAsset[]; nextCursor: string | null }>(`/admin/content-review/queue${qs(p)}`, { bypassCache: true }),
  identity: (p: { q?: string; cursor?: string; limit?: number }) =>
    apiClient.get<{ items: ReviewAsset[]; nextCursor: string | null }>(`/admin/content-review/identity-documents${qs(p)}`, { bypassCache: true }),
  asset: (id: string) =>
    apiClient.get<{ asset: ReviewAsset; decisions: ContentDecisionRow[]; reports: ReviewReport[] }>(`/admin/content-review/assets/${id}`, { bypassCache: true }),
  readUrl: (id: string) => apiClient.get<{ readUrl: string; expiresInSeconds: number }>(`/admin/content-review/assets/${id}/read-url`, { bypassCache: true }),
  decide: (id: string, action: ModerationAction, reason: string, reportId?: string) =>
    apiClient.post<{ asset: ReviewAsset; detached: string[] }>(`/admin/content-review/assets/${id}/${action === "contact_owner" ? "contact-owner" : action}`, { reason, reportId }),
  reports: (p: { status?: string; targetType?: string; cursor?: string; limit?: number }) =>
    apiClient.get<{ reports: ReviewReport[]; nextCursor: string | null }>(`/admin/reports${qs(p)}`, { bypassCache: true }),
  reviewReport: (id: string, status: "REVIEWED" | "DISMISSED", reason: string) =>
    apiClient.patch<{ report: ReviewReport }>(`/admin/reports/${id}`, { status, reason }),
};
