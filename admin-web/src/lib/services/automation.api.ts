import { apiClient } from "../api";

export interface AutomationSummary {
  byType: { type: string; count: number }[];
  byStatus: { status: string; count: number }[];
  recentFailures: {
    id: string;
    type: string;
    vendorId?: string | null;
    recipientUserId: string;
    status: string;
    failureReason?: string | null;
    createdAt: string;
  }[];
}

export const automationAPI = {
  async getSummary(): Promise<AutomationSummary> {
    return apiClient.get<AutomationSummary>("/admin/automation/summary");
  },
};
