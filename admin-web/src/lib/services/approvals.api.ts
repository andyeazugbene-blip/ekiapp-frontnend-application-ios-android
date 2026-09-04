import { apiClient } from "../api";

export interface AdminApproval {
  id: string;
  actionType: string;
  businessRefType: string;
  businessRefId: string;
  amount: number | null;
  currency: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  reason: string;
  requestedById: string;
  requestedBy?: { id: string; name: string; email: string };
  decidedById?: string | null;
  decidedAt?: string | null;
  decisionNote?: string | null;
  createdAt: string;
}

export interface AdminApprovalRule {
  actionType: string;
  thresholdAmount: number | null;
  currency: string | null;
  enabled: boolean;
}

/**
 * Four-eyes approvals (architecture doc §15.2/§7) — the second-admin
 * decision surface for actions a rule has gated (e.g. a large refund, a
 * Community Buy supplier payment release). Deciding APPROVE here is also
 * what actually executes the original action — see the backend's
 * adminDecideApproval controller.
 */
export const approvalsAPI = {
  async listPending(): Promise<AdminApproval[]> {
    const res = await apiClient.get<{ items: AdminApproval[] }>("/admin/approvals");
    return res.items ?? [];
  },

  async decide(approvalId: string, approve: boolean, note: string | undefined, twoFactorCode: string): Promise<AdminApproval> {
    const res = await apiClient.post<{ approval: AdminApproval }>(
      `/admin/approvals/${approvalId}/decide`,
      { approve, note },
      { twoFactorCode },
    );
    return res.approval;
  },

  async listRules(): Promise<AdminApprovalRule[]> {
    const res = await apiClient.get<{ items: AdminApprovalRule[] }>("/admin/approval-rules");
    return res.items ?? [];
  },

  async upsertRule(actionType: string, input: { thresholdAmount: number | null; currency: string | null; enabled: boolean }, twoFactorCode: string): Promise<AdminApprovalRule> {
    const res = await apiClient.put<{ rule: AdminApprovalRule }>(
      `/admin/approval-rules/${encodeURIComponent(actionType)}`,
      input,
      { twoFactorCode },
    );
    return res.rule;
  },
};
