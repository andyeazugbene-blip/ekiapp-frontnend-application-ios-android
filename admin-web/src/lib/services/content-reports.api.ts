import { apiClient } from "../api";

export type ReportTargetType = "review" | "message" | "product" | "store";
export type ReportReason = "inappropriate" | "spam" | "harassment" | "fraud" | "other";
export type ReportStatus = "PENDING" | "REVIEWED" | "DISMISSED";

export interface ContentReport {
  id: string;
  reporterId: string;
  reporter: { id: string; name: string; email: string } | null;
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  details: string | null;
  status: ReportStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

/** UGC moderation queue (Apple App Review Guideline 1.2) — real reports on messages/reviews/products/stores. */
export const contentReportsAPI = {
  async list(status?: ReportStatus): Promise<ContentReport[]> {
    const query = status ? `?status=${status}` : "";
    const res = await apiClient.get<{ reports: ContentReport[] }>(`/admin/reports${query}`);
    return res.reports ?? [];
  },
  async review(id: string, status: "REVIEWED" | "DISMISSED"): Promise<ContentReport> {
    const res = await apiClient.patch<{ report: ContentReport }>(`/admin/reports/${id}`, { status });
    return res.report;
  },
};
