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

export interface MyCommunityBuy {
  campaign: {
    id: string;
    title: string;
    status: CampaignStatus;
    fundingOutcome: FundingOutcome;
    currency: string;
    deadline: string;
    supplier?: { vendor?: { storeName: string } };
  };
  totalQuantity: number;
  totalPaid: number;
  latestContribution: Contribution;
  refundStatus: "REFUND_PENDING" | "REFUND_PROCESSING" | "REFUNDED" | "REFUND_FAILED" | null;
}

export interface CampaignUpdate {
  id: string;
  title: string;
  body?: string | null;
  createdAt: string;
  readAt?: string | null;
}

export interface CampaignParticipant {
  userId: string;
  name: string;
  email: string;
  joinedAt: string;
  totalQuantity: number;
  totalPaid: number;
  isOrganiser: boolean;
}

export interface RefundProgress {
  total: number;
  completed: number;
  pending: number;
  failed: number;
}

export type FulfilmentStatus =
  | "AWAITING_INVENTORY_CONFIRMATION"
  | "INVENTORY_CONFIRMED"
  | "PACKING"
  | "READY_FOR_DISPATCH_OR_COLLECTION"
  | "DISPATCHED"
  | "COLLECTED"
  | "COMPLETED";

export type FulfilmentMethod = "DELIVERY" | "COLLECTION";

export interface CampaignFulfilment {
  campaignId: string;
  status: FulfilmentStatus;
  method?: FulfilmentMethod | null;
  notes?: string | null;
  estimatedReadyAt?: string | null;
  inventoryConfirmedAt?: string | null;
  packingStartedAt?: string | null;
  readyAt?: string | null;
  dispatchedAt?: string | null;
  collectedAt?: string | null;
}

export type SupplierPaymentStatus = "NOT_RELEASED" | "PROCESSING" | "PAID" | "ON_HOLD" | "FAILED";

export interface SupplierPayment {
  campaignId: string;
  amount: number;
  currency: string;
  status: SupplierPaymentStatus;
  holdReason?: string | null;
}

export type SupportCaseType = "PAYMENT_ISSUE" | "REFUND_ISSUE" | "FULFILMENT_ISSUE" | "ORGANISER_CONDUCT" | "SUPPLIER_CONDUCT" | "OTHER";
export type SupportCaseStatus = "OPEN" | "IN_PROGRESS" | "ESCALATED" | "RESOLVED" | "CLOSED";

export interface SupportCase {
  id: string;
  campaignId: string;
  campaign?: { id: string; title: string };
  caseType: SupportCaseType;
  description: string;
  evidenceUrls: string[];
  status: SupportCaseStatus;
  customerVisibleResponse?: string | null;
  escalated: boolean;
  createdAt: string;
  updatedAt: string;
}

export const SUPPORT_CASE_TYPE_LABELS: Record<SupportCaseType, string> = {
  PAYMENT_ISSUE: "Payment issue",
  REFUND_ISSUE: "Refund issue",
  FULFILMENT_ISSUE: "Fulfilment issue",
  ORGANISER_CONDUCT: "Organiser conduct",
  SUPPLIER_CONDUCT: "Supplier conduct",
  OTHER: "Other",
};

export const SUPPORT_CASE_STATUS_LABELS: Record<SupportCaseStatus, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  ESCALATED: "Escalated",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

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

  async listMyContributions(): Promise<MyCommunityBuy[]> {
    const res = await apiClient.get<Items<MyCommunityBuy>>("/api/community-buy/my-contributions");
    return res.items ?? [];
  },

  async getCampaignUpdates(campaignId: string): Promise<CampaignUpdate[]> {
    const res = await apiClient.get<Items<CampaignUpdate>>(`/api/community-buy/campaigns/${campaignId}/updates`);
    return res.items ?? [];
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

  async listCampaignParticipants(campaignId: string): Promise<CampaignParticipant[]> {
    const res = await apiClient.get<Items<CampaignParticipant>>(`/api/organiser/campaigns/${campaignId}/participants`);
    return res.items ?? [];
  },

  async getRefundProgress(campaignId: string): Promise<RefundProgress> {
    return apiClient.get<RefundProgress>(`/api/organiser/campaigns/${campaignId}/refund-progress`);
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

  // ─── Supplier fulfilment — doc Phase 8 ─────────────────────────────────
  async getSupplierFulfilment(campaignId: string): Promise<CampaignFulfilment> {
    const res = await apiClient.get<{ fulfilment: CampaignFulfilment }>(`/api/supplier/campaigns/${campaignId}/fulfilment`);
    return res.fulfilment;
  },

  async confirmFulfilmentInventory(campaignId: string): Promise<CampaignFulfilment> {
    const res = await apiClient.post<{ fulfilment: CampaignFulfilment }>(`/api/supplier/campaigns/${campaignId}/fulfilment/confirm-inventory`, {});
    return res.fulfilment;
  },

  async setFulfilmentPlan(campaignId: string, input: { method: FulfilmentMethod; estimatedReadyAt?: string; notes?: string }): Promise<CampaignFulfilment> {
    const res = await apiClient.post<{ fulfilment: CampaignFulfilment }>(`/api/supplier/campaigns/${campaignId}/fulfilment/plan`, input);
    return res.fulfilment;
  },

  async startFulfilmentPacking(campaignId: string): Promise<CampaignFulfilment> {
    const res = await apiClient.post<{ fulfilment: CampaignFulfilment }>(`/api/supplier/campaigns/${campaignId}/fulfilment/start-packing`, {});
    return res.fulfilment;
  },

  async markFulfilmentReady(campaignId: string): Promise<CampaignFulfilment> {
    const res = await apiClient.post<{ fulfilment: CampaignFulfilment }>(`/api/supplier/campaigns/${campaignId}/fulfilment/ready`, {});
    return res.fulfilment;
  },

  async markFulfilmentDispatched(campaignId: string): Promise<CampaignFulfilment> {
    const res = await apiClient.post<{ fulfilment: CampaignFulfilment }>(`/api/supplier/campaigns/${campaignId}/fulfilment/dispatch`, {});
    return res.fulfilment;
  },

  async markFulfilmentCollected(campaignId: string): Promise<CampaignFulfilment> {
    const res = await apiClient.post<{ fulfilment: CampaignFulfilment }>(`/api/supplier/campaigns/${campaignId}/fulfilment/collect`, {});
    return res.fulfilment;
  },

  async getMySupplierPayment(campaignId: string): Promise<SupplierPayment> {
    const res = await apiClient.get<{ payment: SupplierPayment }>(`/api/supplier/campaigns/${campaignId}/payment`);
    return res.payment;
  },

  // ─── Organiser fulfilment coordination ─────────────────────────────────
  async getOrganiserFulfilment(campaignId: string): Promise<CampaignFulfilment> {
    const res = await apiClient.get<{ fulfilment: CampaignFulfilment }>(`/api/organiser/campaigns/${campaignId}/fulfilment`);
    return res.fulfilment;
  },

  async organiserConfirmFulfilmentCompletion(campaignId: string): Promise<CampaignFulfilment> {
    const res = await apiClient.post<{ fulfilment: CampaignFulfilment }>(`/api/organiser/campaigns/${campaignId}/fulfilment/confirm-completion`, {});
    return res.fulfilment;
  },

  // ─── Support cases — doc Phase 9 ───────────────────────────────────────
  async createSupportCase(campaignId: string, input: { caseType: SupportCaseType; description: string; evidenceUrls?: string[] }): Promise<SupportCase> {
    const res = await apiClient.post<{ supportCase: SupportCase }>(`/api/community-buy/campaigns/${campaignId}/support-cases`, input);
    return res.supportCase;
  },

  async listMySupportCases(): Promise<SupportCase[]> {
    const res = await apiClient.get<Items<SupportCase>>("/api/community-buy/support-cases");
    return res.items ?? [];
  },

  async getMySupportCase(id: string): Promise<SupportCase> {
    const res = await apiClient.get<{ supportCase: SupportCase }>(`/api/community-buy/support-cases/${id}`);
    return res.supportCase;
  },
};
