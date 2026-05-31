/**
 * Buyer wallet service.
 */
import { apiClient } from "./api";

export interface Wallet {
  id?: string;
  balance: number;
  currency: string;
}

export interface WalletTransaction {
  id: string;
  type: "credit" | "debit";
  label: string;
  description: string;
  amount: number;
  currency: string;
  createdAt: string;
}

export interface WalletTopUpIntent {
  clientSecret: string;
  paymentIntentId: string;
  amount: number;
  currency: string;
}

function centsToUnit(value: unknown): number {
  return typeof value === "number" ? value / 100 : 0;
}

function normalizeWallet(raw: any): Wallet {
  return {
    id: raw.id,
    balance: centsToUnit(raw.balance ?? raw.availableBalance),
    currency: (raw.currency ?? "GBP").toUpperCase(),
  };
}

function normalizeTx(raw: any): WalletTransaction {
  const backendType = (raw.type ?? "").toString().toUpperCase();
  const type = ["ORDER_DEBIT", "WITHDRAWAL", "DEBIT"].includes(backendType) ? "debit" : "credit";
  return {
    id: raw.id,
    type,
    label: raw.description ?? raw.type ?? "Transaction",
    description: raw.description ?? "",
    amount: centsToUnit(raw.amount),
    currency: (raw.currency ?? "GBP").toUpperCase(),
    createdAt: raw.createdAt ?? "",
  };
}

export const walletService = {
  async getWallet(): Promise<Wallet> {
    const res = await apiClient.get<{ wallet: any }>("/api/wallet/me");
    return normalizeWallet(res.wallet ?? res);
  },

  async getTransactions(): Promise<WalletTransaction[]> {
    const res = await apiClient.get<{ items?: any[]; transactions?: any[] }>("/api/wallet/me/transactions");
    return (res.items ?? res.transactions ?? []).map(normalizeTx);
  },

  async topUp(amount: number): Promise<WalletTopUpIntent> {
    const res = await apiClient.post<any>("/api/wallet/me/top-up", {
      amount: Math.round(amount * 100),
    });
    return {
      clientSecret: res.clientSecret,
      paymentIntentId: res.paymentIntentId,
      amount: centsToUnit(res.amount),
      currency: (res.currency ?? "GBP").toUpperCase(),
    };
  },

  async applyToOrder(orderId: string, amount: number): Promise<{ applied: number; remaining: number }> {
    const res = await apiClient.post<any>("/api/wallet/me/apply", {
      orderId,
      amount: Math.round(amount * 100),
    });
    return {
      applied: centsToUnit(res.transaction?.amount ?? res.applied),
      remaining: centsToUnit(res.wallet?.balance ?? res.remaining),
    };
  },
};
