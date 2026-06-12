/**
 * Reward service — referral gifts, welcome rewards, and buyer bonuses.
 */
import { apiClient } from "./api";

export type RewardType = "DISCOUNT_COUPON" | "WALLET_BONUS" | "FREE_SHIPPING";

export interface Reward {
  id: string;
  name: string;
  description: string | null;
  type: RewardType;
  value: number;
  currency: string;
  minOrderAmount: number | null;
  isActive: boolean;
  claimedCount: number;
  expiresAt: string | null;
  createdAt: string;
}

export interface UserReward {
  id: string;
  rewardId: string;
  rewardName: string;
  rewardType: RewardType;
  rewardValue: number;
  rewardCurrency: string;
  claimedAt: string;
  usedAt: string | null;
  expiresAt: string | null;
  description: string | null;
}

function normalizeReward(raw: any): Reward {
  return {
    id: raw.id,
    name: raw.name ?? "",
    description: raw.description ?? null,
    type: raw.type ?? "WALLET_BONUS",
    value: typeof raw.value === "number" ? raw.value / 100 : 0,
    currency: (raw.currency ?? "GBP").toUpperCase(),
    minOrderAmount: raw.minOrderAmount != null ? raw.minOrderAmount / 100 : null,
    isActive: raw.isActive ?? false,
    claimedCount: raw.claimedCount ?? 0,
    expiresAt: raw.expiresAt ?? null,
    createdAt: raw.createdAt ?? "",
  };
}

function normalizeUserReward(raw: any): UserReward {
  return {
    id: raw.id,
    rewardId: raw.rewardId,
    rewardName: raw.rewardName ?? "Reward",
    rewardType: raw.rewardType ?? "WALLET_BONUS",
    rewardValue: typeof raw.rewardValue === "number" ? raw.rewardValue / 100 : 0,
    rewardCurrency: (raw.rewardCurrency ?? "GBP").toUpperCase(),
    claimedAt: raw.claimedAt ?? "",
    usedAt: raw.usedAt ?? null,
    expiresAt: raw.expiresAt ?? null,
    description: raw.description ?? null,
  };
}

export const rewardService = {
  async getActiveRewards(): Promise<Reward[]> {
    const res = await apiClient.get<{ rewards?: any[] }>("/api/rewards/active");
    return (res.rewards ?? []).map(normalizeReward);
  },

  async claimReward(referralCode: string): Promise<UserReward> {
    const res = await apiClient.post<{ userReward?: any }>("/api/rewards/claim", { referralCode });
    return normalizeUserReward(res.userReward ?? res);
  },

  async getUserRewards(): Promise<UserReward[]> {
    const res = await apiClient.get<{ rewards?: any[] }>("/api/rewards/me");
    return (res.rewards ?? []).map(normalizeUserReward);
  },
};
