import { apiClient } from "../api";

export type RewardType = "DISCOUNT_COUPON" | "WALLET_BONUS" | "FREE_SHIPPING";
const HOT_DEAL_MARKER = "[HOT_DEAL]";

export interface Reward {
  id: string;
  name: string;
  description: string | null;
  type: RewardType;
  /** Major units (backend stores minor). */
  value: number;
  currency: string;
  minOrderAmount: number | null;
  isActive: boolean;
  maxClaims: number | null;
  claimedCount: number;
  expiresAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  isHotDeal: boolean;
}

export type RewardLifecycle = "active" | "paused" | "archived" | "expired";

export function rewardLifecycle(r: Reward): RewardLifecycle {
  if (r.archivedAt) return "archived";
  if (r.expiresAt && new Date(r.expiresAt).getTime() < Date.now()) return "expired";
  return r.isActive ? "active" : "paused";
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
    currency: (raw.currency ?? "EUR").toUpperCase(),
    minOrderAmount: raw.minOrderAmount != null ? raw.minOrderAmount / 100 : null,
    isActive: raw.isActive ?? false,
    maxClaims: raw.maxClaims ?? null,
    claimedCount: raw.claimedCount ?? 0,
    expiresAt: raw.expiresAt ?? null,
    archivedAt: raw.archivedAt ?? null,
    createdAt: raw.createdAt ?? "",
    isHotDeal,
  };
}

export interface RewardInput {
  name: string;
  description?: string;
  type: RewardType;
  value: number;
  isHotDeal?: boolean;
  currency?: string;
  minOrderAmount?: number;
  maxClaims?: number;
  expiresAt?: string;
}

function toWire(input: Partial<RewardInput>): Record<string, unknown> {
  const data: Record<string, unknown> = { ...input };
  if (input.value != null) data.value = Math.round(Number(input.value) * 100);
  if (input.minOrderAmount != null) data.minOrderAmount = Math.round(Number(input.minOrderAmount) * 100);
  if (input.isHotDeal) data.description = `${HOT_DEAL_MARKER} ${input.description ?? ""}`.trim();
  delete data.isHotDeal;
  return data;
}

// No delete: rewards / hot deals are paused or archived, history is kept.
export const giftsAPI = {
  async getGifts(includeArchived = true): Promise<Reward[]> {
    const res = await apiClient.get<any>(`/admin/rewards?includeArchived=${includeArchived}`, { bypassCache: true });
    return (res.rewards ?? []).map(normalizeReward);
  },

  async createGift(input: RewardInput): Promise<Reward> {
    const res = await apiClient.post<any>("/admin/rewards", toWire(input));
    return normalizeReward(res.reward ?? res);
  },

  async updateGift(id: string, input: Partial<RewardInput>, reason: string): Promise<Reward> {
    const res = await apiClient.patch<any>(`/admin/rewards/${id}`, { ...toWire(input), reason });
    return normalizeReward(res.reward ?? res);
  },

  async setState(id: string, action: "pause" | "resume" | "archive", reason: string): Promise<Reward> {
    const res = await apiClient.post<any>(`/admin/rewards/${id}/${action}`, { reason });
    return normalizeReward(res.reward ?? res);
  },
};
