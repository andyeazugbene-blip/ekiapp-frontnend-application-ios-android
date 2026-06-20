import { apiClient } from "./api";

export type CampaignType = "HOT_DEAL" | "GIFT_CARD";
export type CampaignDiscountType = "PERCENTAGE" | "FIXED_AMOUNT";

export interface Campaign {
  id: string;
  name: string;
  type: CampaignType;
  active: boolean;
  priority: number;
  colorTheme: string | null;
  title: string;
  subtitle: string | null;
  image: string | null;
  startDate: string | null;
  endDate: string | null;
  minimumCartAmountCents: number | null;
  minimumOrders: number | null;
  minimumSpendCents: number | null;
  newCustomerOnly: boolean;
  discountType: CampaignDiscountType | null;
  discountValue: number | null;
}

function normalize(raw: any): Campaign {
  return {
    id: raw.id ?? "",
    name: raw.name ?? "",
    type: raw.type === "GIFT_CARD" ? "GIFT_CARD" : "HOT_DEAL",
    active: raw.active ?? true,
    priority: typeof raw.priority === "number" ? raw.priority : 0,
    colorTheme: raw.colorTheme ?? null,
    title: raw.title ?? "",
    subtitle: raw.subtitle ?? null,
    image: raw.image ?? null,
    startDate: raw.startDate ?? null,
    endDate: raw.endDate ?? null,
    minimumCartAmountCents: raw.minimumCartAmountCents ?? null,
    minimumOrders: raw.minimumOrders ?? null,
    minimumSpendCents: raw.minimumSpendCents ?? null,
    newCustomerOnly: raw.newCustomerOnly ?? false,
    discountType: raw.discountType === "PERCENTAGE" || raw.discountType === "FIXED_AMOUNT" ? raw.discountType : null,
    discountValue: typeof raw.discountValue === "number" ? raw.discountValue : null,
  };
}

// Buyer already qualifies (server only returns eligible campaigns) — describe why, for messaging.
export function campaignConditionLabel(campaign: Campaign): string | null {
  if (campaign.newCustomerOnly) return "New customer offer";
  if (campaign.minimumCartAmountCents != null) return `Unlocked: cart over $${(campaign.minimumCartAmountCents / 100).toFixed(0)}`;
  if (campaign.minimumSpendCents != null) return `Unlocked: lifetime spend over $${(campaign.minimumSpendCents / 100).toFixed(0)}`;
  if (campaign.minimumOrders != null) return `Unlocked: ${campaign.minimumOrders}+ past orders`;
  return null;
}

export function campaignDiscountLabel(campaign: Campaign): string | null {
  if (!campaign.discountType || campaign.discountValue == null) return null;
  return campaign.discountType === "PERCENTAGE"
    ? `${campaign.discountValue}% off`
    : `$${(campaign.discountValue / 100).toFixed(2)} off`;
}

// priority 1 -> yellow, priority 2 -> red, priority 3+ -> themed variation
export function campaignColors(campaign: Campaign): string[] {
  if (campaign.priority <= 1) return ["#F4C01B", "#E59A00"];
  if (campaign.priority === 2) return ["#E14B4B", "#B3211F"];
  if (campaign.colorTheme === "red") return ["#E14B4B", "#B3211F"];
  if (campaign.colorTheme === "yellow") return ["#F4C01B", "#E59A00"];
  return ["#096B4A", "#0B8A5F"];
}

export const campaignService = {
  async getMyCampaigns(): Promise<Campaign[]> {
    const res = await apiClient.get<{ campaigns?: any[] }>("/api/campaigns/me");
    return (res.campaigns ?? []).map(normalize);
  },

  getHotDeals(campaigns: Campaign[]): Campaign[] {
    return campaigns.filter((c) => c.type === "HOT_DEAL");
  },

  getGiftCardCampaigns(campaigns: Campaign[]): Campaign[] {
    return campaigns.filter((c) => c.type === "GIFT_CARD");
  },
};
