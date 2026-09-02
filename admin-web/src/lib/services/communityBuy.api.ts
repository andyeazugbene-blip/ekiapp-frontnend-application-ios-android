import { apiClient } from "../api";

export type CampaignStatus =
  | "DRAFT" | "UNDER_REVIEW" | "CHANGES_REQUIRED" | "APPROVED" | "REJECTED"
  | "LIVE" | "PAUSED" | "RESCUE_WINDOW" | "SUCCEEDED" | "FAILED" | "REFUNDING"
  | "FULFILLING" | "COMPLETED" | "FINANCIALLY_CLOSED" | "CANCELLED";

export type FundingOutcome = "PENDING" | "GOAL_REACHED" | "MINIMUM_REACHED" | "BELOW_MINIMUM";

export interface AdminCampaign {
  id: string;
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
  paidTotal?: number | null;
  deadline: string;
  status: CampaignStatus;
  reviewNotes?: string | null;
  createdAt: string;
  organiser?: { user?: { name: string; email: string } };
  supplier?: { vendor?: { storeName: string } };
}

export type ExtensionRequestStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface AdminExtensionRequest {
  id: string;
  campaignId: string;
  requestedDeadline: string;
  reason: string;
  supplierReconfirmed: boolean;
  priceUnchangedConfirmed: boolean;
  participantTermsUnchanged: boolean;
  status: ExtensionRequestStatus;
  createdAt: string;
  campaign?: { id: string; title: string; confirmedShares: number; minimumShares: number };
}

export type SupplierPaymentStatus = "NOT_RELEASED" | "PROCESSING" | "PAID" | "ON_HOLD" | "FAILED";

export interface AdminSupplierPayment {
  id: string;
  campaignId: string;
  amount: number;
  currency: string;
  status: SupplierPaymentStatus;
  holdReason?: string | null;
  createdAt: string;
  campaign?: { id: string; title: string; confirmedShares: number };
}

export interface PendingOrganiser {
  id: string;
  userId: string;
  country: string;
  isVerified: boolean;
  isRestricted?: boolean;
  restrictedReason?: string | null;
  createdAt: string;
  user?: { name: string; email: string };
}

export interface PendingSupplier {
  id: string;
  vendorId: string;
  country: string;
  isVerified: boolean;
  isRestricted?: boolean;
  restrictedReason?: string | null;
  createdAt: string;
  vendor?: { storeName: string; verificationStatus: string };
}

export interface MarketConfig {
  id: string;
  countryCode: string;
  currency: string;
  communityBuyEnabled: boolean;
  communityBuyPaymentsEnabled: boolean;
  organiserApplicationsEnabled: boolean;
  supplierApplicationsEnabled: boolean;
  regularDeliveriesEnabled: boolean;
}

export interface LedgerSummaryRow {
  campaignId: string;
  title: string;
  currency: string;
  status: CampaignStatus | null;
  fundingOutcome: FundingOutcome | null;
  contributionCount: number;
  totalContributed: number;
  totalRefunded: number;
  totalPaidToSupplier: number;
  netPosition: number;
}

export interface LedgerEntry {
  id: string;
  type: "CONTRIBUTION" | "REFUND" | "SUPPLIER_PAYMENT";
  direction: "CREDIT" | "DEBIT";
  amount: number;
  occurredAt: string;
  description: string;
}

export interface CampaignLedger {
  campaign: { id: string; title: string; currency: string; status: CampaignStatus; fundingOutcome: FundingOutcome };
  entries: LedgerEntry[];
  totals: { totalContributed: number; totalRefunded: number; totalPaidToSupplier: number; netPosition: number };
}

export type SupportCaseType = "PAYMENT_ISSUE" | "REFUND_ISSUE" | "FULFILMENT_ISSUE" | "ORGANISER_CONDUCT" | "SUPPLIER_CONDUCT" | "OTHER";
export type SupportCaseStatus = "OPEN" | "IN_PROGRESS" | "ESCALATED" | "RESOLVED" | "CLOSED";

export interface AdminSupportCase {
  id: string;
  campaignId: string;
  campaign?: { id: string; title: string };
  participant?: { name: string; email: string };
  caseType: SupportCaseType;
  description: string;
  evidenceUrls: string[];
  status: SupportCaseStatus;
  internalNotes?: string | null;
  customerVisibleResponse?: string | null;
  escalated: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdminCampaignRefund {
  id: string;
  amount: number;
  currency: string;
  status: "REFUND_PENDING" | "REFUND_PROCESSING" | "REFUNDED" | "REFUND_FAILED";
  failureReason?: string | null;
  createdAt: string;
  contribution: {
    campaign: { id: string; title: string; country: string };
    participant: { user: { name: string; email: string } };
  };
}

export const communityBuyAdminAPI = {
  async getCampaignsForReview(): Promise<AdminCampaign[]> {
    const res = await apiClient.get<{ items?: AdminCampaign[] }>("/admin/community-campaigns/review");
    return res.items ?? [];
  },
  async getRecentlyClosedCampaigns(): Promise<AdminCampaign[]> {
    const res = await apiClient.get<{ items?: AdminCampaign[] }>("/admin/community-campaigns/closed");
    return res.items ?? [];
  },
  async approveCampaign(id: string): Promise<AdminCampaign> {
    const res = await apiClient.post<{ campaign: AdminCampaign }>(`/admin/community-campaigns/${id}/approve`, {});
    return res.campaign;
  },
  async requestCampaignChanges(id: string, notes: string): Promise<AdminCampaign> {
    const res = await apiClient.post<{ campaign: AdminCampaign }>(`/admin/community-campaigns/${id}/request-changes`, { notes });
    return res.campaign;
  },
  async rejectCampaign(id: string, notes?: string): Promise<AdminCampaign> {
    const res = await apiClient.post<{ campaign: AdminCampaign }>(`/admin/community-campaigns/${id}/reject`, { notes });
    return res.campaign;
  },
  async pauseCampaign(id: string): Promise<AdminCampaign> {
    const res = await apiClient.post<{ campaign: AdminCampaign }>(`/admin/community-campaigns/${id}/pause`, {});
    return res.campaign;
  },
  async resumeCampaign(id: string): Promise<AdminCampaign> {
    const res = await apiClient.post<{ campaign: AdminCampaign }>(`/admin/community-campaigns/${id}/resume`, {});
    return res.campaign;
  },

  async getPendingOrganisers(): Promise<PendingOrganiser[]> {
    const res = await apiClient.get<{ items?: PendingOrganiser[] }>("/admin/community-buy/organisers/pending");
    return res.items ?? [];
  },
  async verifyOrganiser(id: string): Promise<PendingOrganiser> {
    const res = await apiClient.post<{ profile: PendingOrganiser }>(`/admin/community-buy/organisers/${id}/verify`, {});
    return res.profile;
  },
  async getPendingSuppliers(): Promise<PendingSupplier[]> {
    const res = await apiClient.get<{ items?: PendingSupplier[] }>("/admin/community-buy/suppliers/pending");
    return res.items ?? [];
  },
  async verifySupplier(id: string): Promise<PendingSupplier> {
    const res = await apiClient.post<{ profile: PendingSupplier }>(`/admin/community-buy/suppliers/${id}/verify`, {});
    return res.profile;
  },

  async getMarketConfigs(): Promise<MarketConfig[]> {
    const res = await apiClient.get<{ items?: MarketConfig[] }>("/admin/community-buy/markets");
    return res.items ?? [];
  },
  async updateMarketConfig(countryCode: string, data: Partial<{
    communityBuyEnabled: boolean;
    communityBuyPaymentsEnabled: boolean;
    organiserApplicationsEnabled: boolean;
    supplierApplicationsEnabled: boolean;
    regularDeliveriesEnabled: boolean;
  }>): Promise<MarketConfig> {
    const res = await apiClient.patch<{ config: MarketConfig }>(`/admin/community-buy/markets/${countryCode}`, data);
    return res.config;
  },

  async getRefunds(): Promise<AdminCampaignRefund[]> {
    const res = await apiClient.get<{ items?: AdminCampaignRefund[] }>("/admin/community-buy/refunds");
    return res.items ?? [];
  },

  // ─── Rescue-window extension requests — doc §8/§Screen 127 ─────────────
  async getExtensionRequests(): Promise<AdminExtensionRequest[]> {
    const res = await apiClient.get<{ items?: AdminExtensionRequest[] }>("/admin/community-buy/extension-requests");
    return res.items ?? [];
  },
  async approveExtension(id: string): Promise<AdminExtensionRequest> {
    const res = await apiClient.post<{ extensionRequest: AdminExtensionRequest }>(`/admin/community-buy/extension-requests/${id}/approve`, {});
    return res.extensionRequest;
  },
  async rejectExtension(id: string, notes?: string): Promise<AdminExtensionRequest> {
    const res = await apiClient.post<{ extensionRequest: AdminExtensionRequest }>(`/admin/community-buy/extension-requests/${id}/reject`, { notes });
    return res.extensionRequest;
  },

  // ─── Supplier payments — doc §Screen 131 ────────────────────────────────
  async getSupplierPayments(): Promise<AdminSupplierPayment[]> {
    const res = await apiClient.get<{ items?: AdminSupplierPayment[] }>("/admin/community-buy/supplier-payments");
    return res.items ?? [];
  },
  async releaseSupplierPayment(campaignId: string): Promise<AdminSupplierPayment> {
    const res = await apiClient.post<{ payment: AdminSupplierPayment }>(`/admin/community-campaigns/${campaignId}/supplier-payment/release`, {});
    return res.payment;
  },
  async holdSupplierPayment(campaignId: string, reason: string): Promise<AdminSupplierPayment> {
    const res = await apiClient.post<{ payment: AdminSupplierPayment }>(`/admin/community-campaigns/${campaignId}/supplier-payment/hold`, { reason });
    return res.payment;
  },

  // ─── Risk controls — restrict/unrestrict without revoking verification ──
  async getVerifiedOrganisers(): Promise<PendingOrganiser[]> {
    const res = await apiClient.get<{ items?: PendingOrganiser[] }>("/admin/community-buy/organisers");
    return res.items ?? [];
  },
  async restrictOrganiser(id: string, reason: string): Promise<PendingOrganiser> {
    const res = await apiClient.post<{ profile: PendingOrganiser }>(`/admin/community-buy/organisers/${id}/restrict`, { reason });
    return res.profile;
  },
  async unrestrictOrganiser(id: string): Promise<PendingOrganiser> {
    const res = await apiClient.post<{ profile: PendingOrganiser }>(`/admin/community-buy/organisers/${id}/unrestrict`, {});
    return res.profile;
  },
  async getVerifiedSuppliers(): Promise<PendingSupplier[]> {
    const res = await apiClient.get<{ items?: PendingSupplier[] }>("/admin/community-buy/suppliers");
    return res.items ?? [];
  },
  async restrictSupplier(id: string, reason: string): Promise<PendingSupplier> {
    const res = await apiClient.post<{ profile: PendingSupplier }>(`/admin/community-buy/suppliers/${id}/restrict`, { reason });
    return res.profile;
  },
  async unrestrictSupplier(id: string): Promise<PendingSupplier> {
    const res = await apiClient.post<{ profile: PendingSupplier }>(`/admin/community-buy/suppliers/${id}/unrestrict`, {});
    return res.profile;
  },

  // ─── Financial ledger (read-only) — doc §12 ────────────────────────────
  async getLedgerSummary(): Promise<LedgerSummaryRow[]> {
    const res = await apiClient.get<{ items?: LedgerSummaryRow[] }>("/admin/community-buy/ledger");
    return res.items ?? [];
  },
  async getCampaignLedger(campaignId: string): Promise<CampaignLedger> {
    return apiClient.get<CampaignLedger>(`/admin/community-campaigns/${campaignId}/ledger`);
  },

  // ─── Support cases — doc Phase 9 ───────────────────────────────────────
  async getSupportCases(status?: SupportCaseStatus): Promise<AdminSupportCase[]> {
    const qs = status ? `?status=${encodeURIComponent(status)}` : "";
    const res = await apiClient.get<{ items?: AdminSupportCase[] }>(`/admin/community-buy/support-cases${qs}`);
    return res.items ?? [];
  },
  async getSupportCase(id: string): Promise<AdminSupportCase> {
    const res = await apiClient.get<{ supportCase: AdminSupportCase }>(`/admin/community-buy/support-cases/${id}`);
    return res.supportCase;
  },
  async updateSupportCase(id: string, data: Partial<{
    status: SupportCaseStatus;
    internalNotes: string;
    customerVisibleResponse: string;
    escalated: boolean;
  }>): Promise<AdminSupportCase> {
    const res = await apiClient.patch<{ supportCase: AdminSupportCase }>(`/admin/community-buy/support-cases/${id}`, data);
    return res.supportCase;
  },
};
