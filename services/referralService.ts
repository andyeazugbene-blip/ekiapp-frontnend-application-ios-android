import { apiClient } from "./api";

export interface ReferralInfo {
  referralCode: string;
  totalReferred: number;
  totalEarned: number;
  currency: string;
}

interface ReferralInfoResponse {
  referralCode?: string;
  totalReferred?: number;
  totalEarned?: number;
  currency?: string;
}

function centsToUnit(value: unknown): number {
  return typeof value === "number" ? value / 100 : 0;
}

function normalizeReferralInfo(raw: ReferralInfoResponse): ReferralInfo {
  return {
    referralCode: raw.referralCode ?? "",
    totalReferred: raw.totalReferred ?? 0,
    totalEarned: centsToUnit(raw.totalEarned),
    currency: (raw.currency ?? "GBP").toUpperCase(),
  };
}

export const referralService = {
  async getMyReferralInfo(): Promise<ReferralInfo> {
    const response = await apiClient.get<ReferralInfoResponse>("/api/referrals/me");
    return normalizeReferralInfo(response);
  },
};
