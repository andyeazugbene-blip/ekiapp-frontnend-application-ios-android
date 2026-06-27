import { apiClient } from "./api";

export type ReportTargetType = "review" | "message" | "product" | "store";
export type ReportReason = "inappropriate" | "spam" | "harassment" | "fraud" | "other";

export interface ContentReport {
  id: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  details?: string;
  status: string;
  createdAt: string;
}

export interface UserBlock {
  id: string;
  blockedId: string;
  createdAt: string;
}

export const reportService = {
  async submitReport(
    targetType: ReportTargetType,
    targetId: string,
    reason: ReportReason,
    details?: string,
  ): Promise<ContentReport> {
    const res = await apiClient.post<{ report: ContentReport }>("/api/reports", {
      targetType,
      targetId,
      reason,
      details,
    });
    return res.report;
  },

  async blockUser(blockedId: string): Promise<UserBlock> {
    const res = await apiClient.post<{ block: UserBlock }>("/api/reports/block", { blockedId });
    return res.block;
  },

  async unblockUser(blockedId: string): Promise<void> {
    await apiClient.delete(`/api/reports/block/${encodeURIComponent(blockedId)}`);
  },

  async getBlockedUsers(): Promise<UserBlock[]> {
    const res = await apiClient.get<{ blocked: UserBlock[] }>("/api/reports/blocked");
    return res.blocked ?? [];
  },
};
