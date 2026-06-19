import { apiClient } from "../api";

export type RewardType = "DISCOUNT_COUPON" | "WALLET_BONUS" | "FREE_SHIPPING";
const HOT_DEAL_MARKER = "[HOT_DEAL]";

export interface Reward {
  id: string;
  name: string;
  description: string | null;
  type: RewardType;
  value: number;
  currency: string;
  minOrderAmount: number | null;
  isActive: boolean;
  maxClaims: number | null;
  claimedCount: number;
  expiresAt: string | null;
  createdAt: string;
  isHotDeal: boolean;
}

function normalizeReward(raw: any): Reward {
  const rawDescription = raw.description ?? null;
  const isHotDeal = typeof rawDescription === "string" && rawDescription.startsWith(HOT_DEAL_MARKER);
  return {
    id: raw.id,
    name: raw.name ?? "",
    description: isHotDeal ? rawDescription.replace(HOT_DEAL_MARKER, "").trim() || null : rawDescription,
    type: raw.type ?? "WALLET_BONUS",
    value: typeof raw.value === "number" ? raw.value / 100 : raw.value ?? 0,
    currency: (raw.currency ?? "GBP").toUpperCase(),
    minOrderAmount: raw.minOrderAmount != null ? raw.minOrderAmount / 100 : null,
    isActive: raw.isActive ?? false,
    maxClaims: raw.maxClaims ?? null,
    claimedCount: raw.claimedCount ?? 0,
    expiresAt: raw.expiresAt ?? null,
    createdAt: raw.createdAt ?? "",
    isHotDeal,
  };
}

function denormalizeReward(input: Partial<Reward>): Record<string, unknown> {
  const data: Record<string, unknown> = { ...input };
  if (input.value != null) data.value = Math.round(Number(input.value) * 100);
  if (input.minOrderAmount != null) data.minOrderAmount = Math.round(Number(input.minOrderAmount) * 100);
  if (input.description === "") data.description = null;
  if (input.isHotDeal) data.description = `${HOT_DEAL_MARKER} ${input.description ?? ""}`.trim();
  delete data.isHotDeal;
  return data;
}

export const giftsAPI = {
  async getGifts(): Promise<Reward[]> {
    const res = await apiClient.get<any>("/admin/rewards");
    return (res.rewards ?? []).map(normalizeReward);
  },

  async createGift(input: {
    name: string; description?: string; type: RewardType; value: number; isHotDeal?: boolean;
    currency?: string; minOrderAmount?: number; maxClaims?: number; expiresAt?: string;
  }): Promise<Reward> {
    const res = await apiClient.post<any>("/admin/rewards", denormalizeReward(input));
    return normalizeReward(res.reward ?? res);
  },

  async updateGift(id: string, input: Partial<Reward>): Promise<Reward> {
    const res = await apiClient.patch<any>(`/admin/rewards/${id}`, denormalizeReward(input));
    return normalizeReward(res.reward ?? res);
  },

  async deleteGift(id: string): Promise<void> {
    await apiClient.delete(`/admin/rewards/${id}`);
  },
};
