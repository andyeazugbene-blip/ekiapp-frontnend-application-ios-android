/**
 * Community Buy service — participant discovery/contribution, organiser
 * campaign management, supplier onboarding, and market availability.
 *
 * Country availability is never hardcoded here — every screen must check
 * `getMarketConfig(country)` and gate on the flags it returns, since the
 * backend is the source of truth for which markets have Community Buy on.
 */
import { apiClient } from "./api";

// Flexible-fulfilment model — Eki Diaspora App doc §6. Operational status and
// funding outcome are separate on purpose: a campaign can be FULFILLING with
// fundingOutcome MINIMUM_REACHED (proceeded on 3 of a 6 goal) — never infer
// one from the other.
export type CampaignStatus =
  | "DRAFT"
  | "UNDER_REVIEW"
  | "CHANGES_REQUIRED"
  | "APPROVED"
  | "REJECTED"
  | "LIVE"
  | "PAUSED"
  | "RESCUE_WINDOW"
  | "SUCCEEDED"
  | "FAILED"
  | "REFUNDING"
  | "FULFILLING"
  | "COMPLETED"
  | "FINANCIALLY_CLOSED"
  | "CANCELLED";

export type FundingOutcome = "PENDING" | "GOAL_REACHED" | "MINIMUM_REACHED" | "BELOW_MINIMUM";

export type ContributionStatus =
  | "INITIATED"
  | "PAYMENT_PROCESSING"
  | "PAID"
  | "FAILED"
  | "REFUND_PENDING"
  | "REFUND_PROCESSING"
  | "REFUNDED";

export type ExtensionRequestStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface ExtensionRequest {
  id: string;
  campaignId: string;
  requestedDeadline: string;
  reason: string;
  supplierReconfirmed: boolean;
  priceUnchangedConfirmed: boolean;
  participantTermsUnchanged: boolean;
  status: ExtensionRequestStatus;
  reviewNotes?: string | null;
  createdAt: string;
}

export interface MarketConfig {
  countryCode: string;
  currency?: string;
  communityBuyEnabled: boolean;
  communityBuyPaymentsEnabled?: boolean;
  organiserApplicationsEnabled: boolean;
  supplierApplicationsEnabled: boolean;
  regularDeliveriesEnabled: boolean;
}

export interface Campaign {
  id: string;
  organiserId: string;
  supplierId: string;
  supplier?: { vendor?: { storeName: string } };
  organiser?: { user?: { name: string } };
  title: string;
  description?: string | null;
  country: string;
  currency: string;
  targetAmount: number;
  minimumShares: number;
  goalShares: number;
  maximumShares: number;
  pricePerShareMinor: number;
  confirmedShares: number;
  fundingOutcome: FundingOutcome;
  supplierCommitted: boolean;
  rescueEndsAt?: string | null;
  extensionCount: number;
  paidTotal?: number;
  progressPct?: number;
  participantCount?: number;
  contributions?: { amount: number; quantity: number }[];
  deadline: string;
  status: CampaignStatus;
  reviewNotes?: string | null;
  createdAt: string;
}

export interface Contribution {
  id: string;
  campaignId: string;
  participantId: string;
  amount: number;
  currency: string;
  quantity: number;
  isOrganiserTopUp: boolean;
  status: ContributionStatus;
  stripePaymentIntentId?: string | null;
  refund?: { status: string; amount: number } | null;
  createdAt: string;
}

export interface OrganiserProfile {
  id: string;
  userId: string;
  country: string;
  isVerified: boolean;
  verifiedAt?: string | null;
  createdAt: string;
}

export interface SupplierProfile {
  id: string;
  vendorId: string;
  country: string;
  isVerified: boolean;
  verifiedAt?: string | null;
  createdAt: string;
}

interface Items<T> {
  items?: T[];
}

export const communityBuyService = {
  // ─── Market availability ────────────────────────────────────────────────
  // Never hardcode which countries are available — always read this from
  // the backend, which is the single source of truth for market rollout.
  async listMarketConfigs(): Promise<MarketConfig[]> {
    const res = await apiClient.get<Items<MarketConfig>>("/api/community-buy/markets", { skipAuth: true });
    return res.items ?? [];
  },

  async getMarketConfig(country: string): Promise<MarketConfig> {
    const res = await apiClient.get<{ config: MarketConfig }>(`/api/community-buy/markets/${country}`, { skipAuth: true });
    return res.config;
  },

  // ─── Public discovery ────────────────────────────────────────────────────
  async listLiveCampaigns(country?: string): Promise<Campaign[]> {
    const qs = country ? `?country=${encodeURIComponent(country)}` : "";
    const res = await apiClient.get<Items<Campaign>>(`/api/community-buy/campaigns${qs}`, { skipAuth: true });
    return res.items ?? [];
  },

  async getCampaign(id: string): Promise<Campaign> {
    const res = await apiClient.get<{ campaign: Campaign }>(`/api/community-buy/campaigns/${id}`, { skipAuth: true });
    return res.campaign;
  },

  // ─── Participant ─────────────────────────────────────────────────────────
  async joinCampaign(campaignId: string): Promise<void> {
    await apiClient.post(`/api/community-buy/campaigns/${campaignId}/join`, {});
  },

  async createContribution(campaignId: string, quantity: number): Promise<{ contributionId: string; clientSecret: string; quantity: number; amount: number; currency: string }> {
    return apiClient.post(`/api/community-buy/campaigns/${campaignId}/contributions`, { quantity });
  },

  async getContribution(id: string): Promise<Contribution> {
    const res = await apiClient.get<{ contribution: Contribution }>(`/api/community-buy/contributions/${id}`);
    return res.contribution;
  },

  async confirmContributionPayment(id: string): Promise<Contribution> {
    const res = await apiClient.post<{ contribution: Contribution }>(`/api/community-buy/contributions/${id}/payment`, {});
    return res.contribution;
  },

  // ─── Organiser ────────────────────────────────────────────────────────────
  async getMyOrganiserProfile(): Promise<OrganiserProfile | null> {
    const res = await apiClient.get<{ profile: OrganiserProfile | null }>("/api/organiser/profile");
    return res.profile;
  },

  async applyAsOrganiser(country: string): Promise<OrganiserProfile> {
    const res = await apiClient.post<{ profile: OrganiserProfile }>("/api/organiser/applications", { country });
    return res.profile;
  },

  async listVerifiedSuppliers(country: string): Promise<(SupplierProfile & { vendor?: { storeName: string } })[]> {
    const res = await apiClient.get<Items<SupplierProfile & { vendor?: { storeName: string } }>>(
      `/api/organiser/suppliers?country=${encodeURIComponent(country)}`,
    );
    return res.items ?? [];
  },

  async listMyOrganiserCampaigns(): Promise<Campaign[]> {
    const res = await apiClient.get<Items<Campaign>>("/api/organiser/campaigns");
    return res.items ?? [];
  },

  async createCampaign(input: {
    supplierId: string;
    title: string;
    description?: string;
    country: string;
    currency: string;
    minimumShares: number;
    goalShares: number;
    maximumShares: number;
    pricePerShareMinor: number;
    deadline: string;
    rescueDurationMinutes?: number;
  }): Promise<Campaign> {
    const res = await apiClient.post<{ campaign: Campaign }>("/api/organiser/campaigns", input);
    return res.campaign;
  },

  async updateCampaign(id: string, input: Partial<{
    title: string;
    description?: string;
    minimumShares: number;
    goalShares: number;
    maximumShares: number;
    pricePerShareMinor: number;
    deadline: string;
  }>): Promise<Campaign> {
    const res = await apiClient.patch<{ campaign: Campaign }>(`/api/organiser/campaigns/${id}`, input);
    return res.campaign;
  },

  async submitCampaign(id: string): Promise<Campaign> {
    const res = await apiClient.post<{ campaign: Campaign }>(`/api/organiser/campaigns/${id}/submit`, {});
    return res.campaign;
  },

  async publishCampaign(id: string): Promise<Campaign> {
    const res = await apiClient.post<{ campaign: Campaign }>(`/api/organiser/campaigns/${id}/publish`, {});
    return res.campaign;
  },

  // ─── Rescue-window actions — doc §8. There is no "fulfil anyway below
  // minimum" action; the only ways out of RESCUE_WINDOW are these four. ──

  async createOrganiserTopUp(campaignId: string, quantity: number): Promise<{ contributionId: string; clientSecret: string; quantity: number; amount: number; currency: string }> {
    return apiClient.post(`/api/organiser/campaigns/${campaignId}/rescue/top-up`, { quantity });
  },

  async requestExtension(campaignId: string, input: {
    requestedDeadline: string;
    reason: string;
    supplierReconfirmed: boolean;
    priceUnchangedConfirmed: boolean;
    participantTermsUnchanged: boolean;
  }): Promise<ExtensionRequest> {
    const res = await apiClient.post<{ extensionRequest: ExtensionRequest }>(`/api/organiser/campaigns/${campaignId}/rescue/extension-request`, input);
    return res.extensionRequest;
  },

  async endCampaignRescue(campaignId: string): Promise<Campaign> {
    const res = await apiClient.post<{ campaign: Campaign }>(`/api/organiser/campaigns/${campaignId}/rescue/end`, {});
    return res.campaign;
  },

  // ─── Supplier ─────────────────────────────────────────────────────────────
  async getMySupplierProfile(): Promise<SupplierProfile | null> {
    const res = await apiClient.get<{ profile: SupplierProfile | null }>("/api/supplier/profile");
    return res.profile;
  },

  async applyAsSupplier(country: string): Promise<SupplierProfile> {
    const res = await apiClient.post<{ profile: SupplierProfile }>("/api/supplier/applications", { country });
    return res.profile;
  },

  async listMySupplierCampaigns(): Promise<Campaign[]> {
    const res = await apiClient.get<Items<Campaign>>("/api/supplier/campaigns");
    return res.items ?? [];
  },

  /** Doc screens 115-117 — required before the organiser can submit the campaign for admin review. */
  async confirmSupplierCommitment(campaignId: string): Promise<Campaign> {
    const res = await apiClient.post<{ campaign: Campaign }>(`/api/supplier/campaigns/${campaignId}/supplier-commitment`, {});
    return res.campaign;
  },
};
