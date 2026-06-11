import { apiClient } from "../api";

export interface AdminWalletTransaction {
  id: string;
  vendorId: string;
  vendorName: string;
  type: string;
  amount: number;
  currency: string;
  balance: number;
  description: string | null;
  reference: string | null;
  createdAt: string;
}

function centsToUnit(value: unknown): number {
  return typeof value === "number" ? value / 100 : 0;
}

function normalizeWalletTransaction(raw: any): AdminWalletTransaction {
  return {
    id: raw.id,
    vendorId: raw.vendorId ?? "",
    vendorName: raw.vendor?.storeName ?? "",
    type: (raw.type ?? "UNKNOWN").toString(),
    amount: centsToUnit(raw.amount),
    currency: (raw.currency ?? "GBP").toUpperCase(),
    balance: centsToUnit(raw.balance ?? 0),
    description: raw.description ?? null,
    reference: raw.reference ?? null,
    createdAt: raw.createdAt ?? "",
  };
}

export const walletTransactionsAPI = {
  async getWalletTransactions(params?: { type?: string; vendorId?: string; limit?: number }): Promise<AdminWalletTransaction[]> {
    const query = new URLSearchParams();
    if (params?.type) query.set("type", params.type);
    if (params?.vendorId) query.set("vendorId", params.vendorId);
    query.set("limit", String(params?.limit ?? 100));
    const res = await apiClient.get<any>(`/admin/wallet-transactions?${query.toString()}`);
    return (res.items ?? res.transactions ?? []).map(normalizeWalletTransaction);
  },
};
