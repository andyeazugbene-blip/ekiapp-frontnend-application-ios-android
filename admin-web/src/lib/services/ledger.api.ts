/**
 * Real double-entry ledger + provider reconciliation — reads
 * LedgerAccount/LedgerEntry/ReconciliationRun/ReconciliationDifference
 * directly. Distinct from communityBuy.api.ts's "ledger" endpoints, which
 * read a separate Community Buy-specific aggregate, not these tables.
 */
import { apiClient } from "../api";

export type LedgerAccountType =
  | "PROVIDER_CASH"
  | "PLATFORM_FEE_REVENUE"
  | "VENDOR_PAYABLE"
  | "SUPPLIER_PAYABLE"
  | "BUYER_WALLET_LIABILITY"
  | "REFUND_CLEARING"
  | "COMMUNITY_BUY_ESCROW";

export type LedgerOwnerType = "PLATFORM" | "VENDOR" | "BUYER" | "SUPPLIER";

export interface LedgerBalance {
  id: string;
  type: LedgerAccountType;
  currency: string;
  ownerType: LedgerOwnerType;
  ownerId: string | null;
  entryCount: number;
  balance: number;
}

export type ReconciliationRunStatus = "RUNNING" | "COMPLETED" | "FAILED";
export type ReconciliationDifferenceKind = "MISSING_LOCALLY" | "MISSING_AT_PROVIDER" | "AMOUNT_MISMATCH" | "STATUS_MISMATCH";
export type ReconciliationDifferenceStatus = "OPEN" | "RESOLVED";

export interface ReconciliationDifference {
  id: string;
  runId: string;
  businessRefType: string;
  businessRefId: string;
  providerRef: string | null;
  expectedAmount: number | null;
  actualAmount: number | null;
  kind: ReconciliationDifferenceKind;
  status: ReconciliationDifferenceStatus;
  note: string | null;
  createdAt: string;
  resolvedAt: string | null;
  run?: { provider: string; periodStart: string; periodEnd: string };
}

export interface ReconciliationRun {
  id: string;
  provider: string;
  periodStart: string;
  periodEnd: string;
  status: ReconciliationRunStatus;
  totalChecked: number;
  startedAt: string;
  completedAt: string | null;
  differences?: ReconciliationDifference[];
  _count?: { differences: number };
}

export const ledgerAdminAPI = {
  async getBalances(): Promise<LedgerBalance[]> {
    const res = await apiClient.get<{ items?: LedgerBalance[] }>("/admin/ledger/balances");
    return res.items ?? [];
  },

  async listRuns(): Promise<ReconciliationRun[]> {
    const res = await apiClient.get<{ items?: ReconciliationRun[] }>("/admin/ledger/reconciliation-runs");
    return res.items ?? [];
  },

  async getRun(id: string): Promise<ReconciliationRun> {
    const res = await apiClient.get<{ run: ReconciliationRun }>(`/admin/ledger/reconciliation-runs/${id}`);
    return res.run;
  },

  async runReconciliation(provider: "stripe" | "paystack", periodStart: string, periodEnd: string): Promise<ReconciliationRun> {
    const res = await apiClient.post<{ run: ReconciliationRun }>("/admin/ledger/reconciliation-runs", { provider, periodStart, periodEnd });
    return res.run;
  },

  async listOpenDifferences(): Promise<ReconciliationDifference[]> {
    const res = await apiClient.get<{ items?: ReconciliationDifference[] }>("/admin/ledger/differences");
    return res.items ?? [];
  },

  async resolveDifference(id: string, note: string): Promise<ReconciliationDifference> {
    const res = await apiClient.post<{ difference: ReconciliationDifference }>(`/admin/ledger/differences/${id}/resolve`, { note });
    return res.difference;
  },
};
