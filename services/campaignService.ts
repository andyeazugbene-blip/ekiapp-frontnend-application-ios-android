import { apiClient } from "./api";

export type CampaignType = "HOT_DEAL" | "GIFT_CARD";

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
  };
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
