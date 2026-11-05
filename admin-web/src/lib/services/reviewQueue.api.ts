import { apiClient } from "../api";

export type ReviewRequestType = "SUPPLIER_ELIGIBILITY" | "SUPPLIER_OFFER" | "COMMUNITY_BUY_CAMPAIGN" | "EXTENSION";
export type ReviewRequestStatus = "DRAFT" | "SUBMITTED" | "UNDER_REVIEW" | "INFO_REQUIRED" | "APPROVED" | "REJECTED" | "WITHDRAWN" | "SUSPENDED";

export interface ReviewRequestRow {
  id: string;
  type: ReviewRequestType;
  subjectType: string;
  subjectId: string;
  market: string;
  status: ReviewRequestStatus;
  submittedById: string;
  submittedAt: string;
  slaDueAt: string;
  decisionReason: string | null;
  infoMessage: string | null;
  autoApproved: boolean;
  subjectLabel: string;
  overdue: boolean;
}

export interface ReviewRequestDetail {
  request: ReviewRequestRow;
  subject: Record<string, unknown> | null;
  submitter: {
    name: string | null;
    email: string;
    emailVerifiedAt: string | null;
    phoneVerifiedAt: string | null;
    capabilityGrants: { capability: string; market: string; status: string }[];
  } | null;
  previousDecisions: { id: string; status: ReviewRequestStatus; decisionReason: string | null; decidedAt: string | null; autoApproved: boolean }[];
  auditTrail: { action: string; actorId: string; reason: string | null; createdAt: string }[];
  rejectionReasons: string[];
}

export interface DemandRow {
  foodstuff: string;
  requests: number;
}

export const reviewQueueAPI = {
  async list(filters: { type?: string; market?: string; status?: string; overdue?: boolean } = {}): Promise<ReviewRequestRow[]> {
    const query = new URLSearchParams();
    if (filters.type) query.set("type", filters.type);
    if (filters.market) query.set("market", filters.market);
    if (filters.status) query.set("status", filters.status);
    if (filters.overdue) query.set("overdue", "true");
    const qs = query.toString();
    const res = await apiClient.get<{ items: ReviewRequestRow[] }>(`/admin/approvals-queue${qs ? `?${qs}` : ""}`);
    return res.items;
  },
  async get(id: string): Promise<ReviewRequestDetail> {
    return apiClient.get<ReviewRequestDetail>(`/admin/approvals-queue/${id}`);
  },
  async approve(id: string): Promise<void> {
    await apiClient.post(`/admin/approvals-queue/${id}/approve`, {});
  },
  async requestInformation(id: string, message: string): Promise<void> {
    await apiClient.post(`/admin/approvals-queue/${id}/request-information`, { message });
  },
  async reject(id: string, reasonCode: string, detail?: string): Promise<void> {
    await apiClient.post(`/admin/approvals-queue/${id}/reject`, { reasonCode, detail });
  },
  async demand(): Promise<DemandRow[]> {
    const res = await apiClient.get<{ items: DemandRow[] }>("/admin/approvals-queue/demand");
    return res.items;
  },
};
