import { apiClient } from "./api";

export interface FirstSaleCheck {
  key: string;
  label: string;
  done: boolean;
  blocking: boolean;
  route: string;
}

export interface FirstSaleCampaignView {
  enabled: boolean;
  status: "NOT_STARTED" | "NOT_NEEDED" | "ACTIVE" | "COMPLETED" | "STOPPED";
  readiness: FirstSaleCheck[];
  canLaunch: boolean;
  launchProducts: { id: string; title: string; image: string | null; priceInCents: number; currency: string }[];
  assets: { storeUrl: string; shareMessage: string };
  audience: { eligibleBuyers: number; messaged: number };
  funnel: { visits: number; baskets: number; checkouts: number; payments: number };
  nextStep: { stage: string; advice: string } | null;
}

export interface VendorReferralOverview {
  referralCode: string | null;
  promptReady: boolean;
  qualifiedTowardsNext: number;
  needed: number;
  monthsPerCredit: number;
  creditsReadyForReview: number;
  monthsReleased: number;
  referrals: { storeName: string | null; stage: string; joinedAt: string }[];
}

export const growthService = {
  async getFirstSaleCampaign(): Promise<FirstSaleCampaignView> {
    return apiClient.get("/api/growth/first-sale-campaign");
  },
  async launchFirstSaleCampaign(): Promise<FirstSaleCampaignView> {
    return apiClient.post("/api/growth/first-sale-campaign/launch", {});
  },
  async getReferrals(): Promise<VendorReferralOverview> {
    return apiClient.get("/api/growth/referrals");
  },
};
