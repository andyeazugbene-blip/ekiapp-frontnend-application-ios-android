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
  // Client-corrected flow: supplier is an optional fulfilment choice — a
  // null supplier/supplierId means the organiser is self-fulfilling, not a
  // data gap.
  fulfilmentOwner: "SELF" | "SUPPLIER";
  supplierId?: string | null;
  supplierCommitted: boolean;
  supplierDeclinedAt?: string | null;
  supplierDeclineReason?: string | null;
  rescueEndsAt?: string | null;
  extensionCount: number;
  paidTotal?: number | null;
  deadline: string;
  status: CampaignStatus;
  reviewNotes?: string | null;
  createdAt: string;
  organiser?: { user?: { name: string; email: string } };
  supplier?: { vendor?: { storeName: string } } | null;
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

export interface CurrencySupplierPaymentTotals {
  currency: string;
  count: number;
  totalAmount: number;
  totalReleased: number;
  totalPending: number;
  totalHeld: number;
  totalFailed: number;
  totalProcessing: number;
}

export interface SupplierPaymentAggregate {
  totalsByCurrency: CurrencySupplierPaymentTotals[];
  byCampaign: { campaignId: string; campaignTitle: string; currency: string; amount: number; status: SupplierPaymentStatus; releasedAt: string | null }[];
  bySupplier: { supplierId: string; supplierName: string; currency: string; count: number; totalAmount: number; totalReleased: number }[];
  payments: AdminSupplierPayment[];
}

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

// Workstream 3 — the no-Vendor-required supplier capability (Set B, distinct
// from the legacy Vendor-keyed PendingSupplier above). Mirrors backend
// SupplierAccountState exactly (schema.prisma).
export type SupplierAccountState =
  | "NOT_STARTED" | "DRAFT" | "VERIFICATION_REQUIRED" | "UNDER_REVIEW"
  | "INFORMATION_REQUIRED" | "APPROVED" | "PAUSED" | "RESTRICTED" | "SUSPENDED" | "CLOSED";

export interface AdminSupplierAccount {
  id: string;
  userId: string;
  supplierState: SupplierAccountState;
  categories: string[];
  coverageRegions: string[];
  collectionAreas: string[];
  providerConnectedAccountId: string | null;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  requirementsDue: string[];
  legacySupplierProfileId: string | null;
  reasonCode: string | null;
  // M4 (spec §14.4) — the only recognised value is "fulfilment_access_preserved"; anything else (including null/unset) means restriction revokes participant-delivery-data access.
  controlScope: string | null;
  approvedAt: string | null;
  pausedAt: string | null;
  // M5
  collectionCapacityPerDay: number | null;
  stripeRequirementsDue: string[];
  suspendedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  user?: { name: string; email: string };
}

// M4 — data-access audit trail (spec §15.8, AT-43).
export interface AdminDataAccessLogEntry {
  id: string;
  campaignId: string;
  contributionId: string | null;
  accessorAccountId: string | null;
  accessorUserId: string;
  accessorRole: "SUPPLIER" | "ORGANISER" | "ADMIN";
  dataCategory: "DELIVERY_STATUS" | "CONTACT_CHANNEL" | "EMERGENCY_NUMBER" | "MANIFEST";
  action: "VIEWED" | "LABEL_GENERATED" | "MESSAGE_SENT" | "PROXY_CALL_STARTED" | "COURIER_SHARED" | "ACCESS_REVOKED" | "ADMIN_OVERRIDE";
  purposeCode: string;
  accessedAt: string;
  accessExpiresAt: string | null;
  revokedAt: string | null;
  revocationReason: string | null;
}

export type MarketPaymentMode = "DISABLED" | "TEST" | "LIVE";
export type CommunityBuyPaymentMode = "PAY_NOW_REFUND_ON_FAILURE" | "AUTHORISE_THEN_CAPTURE" | "PLEDGE_THEN_CHARGE";
export type SupplierReleasePolicy = "ON_DELIVERY_CONFIRMED" | "ON_FULFILMENT_MARKED";

export interface MarketConfig {
  id: string;
  countryCode: string;
  currency: string;
  communityBuyEnabled: boolean;
  communityBuyPaymentsEnabled: boolean;
  organiserApplicationsEnabled: boolean;
  supplierApplicationsEnabled: boolean;
  regularDeliveriesEnabled: boolean;
  paymentMode: MarketPaymentMode;
  paymentProvider: string | null;
  identityProvider: string | null;
  acceptedIdentityDocuments: string[];
  campaignMinDurationHours: number | null;
  campaignMaxDurationHours: number | null;
  campaignMinValueAmount: number | null;
  campaignMaxValueAmount: number | null;
  refundTermsVersion: string | null;
  organiserFeeBps: number | null;
  supplierReleasePolicy: SupplierReleasePolicy;
  deliveryMethods: string[];
  legalTermsVersion: string | null;
  // PLEDGE_THEN_CHARGE model (client mandate 2026-09) — the payment mode
  // must be exactly this before any pledge can be created for a market.
  communityBuyPaymentMode: CommunityBuyPaymentMode | null;
  // Eki's processing fee, basis points (500 = 5%). Null blocks supplier
  // settlement release — never defaulted/invented client-side.
  communityBuyFeeBps: number | null;
  createdAt: string;
  updatedAt: string;
}

export type MarketConfigUpdate = Partial<{
  communityBuyEnabled: boolean;
  communityBuyPaymentsEnabled: boolean;
  organiserApplicationsEnabled: boolean;
  supplierApplicationsEnabled: boolean;
  regularDeliveriesEnabled: boolean;
  paymentMode: MarketPaymentMode;
  paymentProvider: string | null;
  identityProvider: string | null;
  acceptedIdentityDocuments: string[];
  campaignMinDurationHours: number | null;
  campaignMaxDurationHours: number | null;
  campaignMinValueAmount: number | null;
  campaignMaxValueAmount: number | null;
  refundTermsVersion: string | null;
  organiserFeeBps: number | null;
  supplierReleasePolicy: SupplierReleasePolicy;
  deliveryMethods: string[];
  legalTermsVersion: string | null;
  communityBuyPaymentMode: CommunityBuyPaymentMode | null;
  communityBuyFeeBps: number | null;
}>;

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

export type ContributionStatus =
  | "INITIATED" | "PAYMENT_PROCESSING" | "PAID" | "PAYMENT_FAILED"
  | "PLEDGED" | "CHARGE_FAILED" | "REFUND_PENDING" | "REFUND_PROCESSING" | "REFUNDED" | "REFUND_FAILED" | "CANCELLED";

export interface AdminContribution {
  id: string;
  participant: { userId: string; name: string; email: string };
  quantity: number;
  amount: number;
  currency: string;
  status: ContributionStatus;
  isOrganiserTopUp: boolean;
  stripePaymentIntentId: string | null;
  refund: { status: string; amount: number; failureReason: string | null } | null;
  createdAt: string;
  updatedAt: string;
}

/** Response when a supplier-payment release requires a second admin's sign-off (four-eyes) instead of executing immediately. */
export interface PendingApprovalResponse {
  pendingApproval: { id: string; status: string };
  message: string;
}

export type ReleaseSupplierPaymentResult = { payment: AdminSupplierPayment } | PendingApprovalResponse;

export function isPendingApproval(result: ReleaseSupplierPaymentResult): result is PendingApprovalResponse {
  return "pendingApproval" in result;
}

export interface ReadOptions {
  bypassCache?: boolean;
}

// ─── M6 — CommunityBuyPayout (M2 AUTHORISE_THEN_CAPTURE Direct Charge) ────
export type CommunityBuyPayoutStatus = "HELD" | "READY" | "PENDING" | "IN_TRANSIT" | "PAID" | "FAILED" | "REVERSED" | "CANCELLED" | "MANUAL_REVIEW";

export interface AdminCommunityBuyPayout {
  id: string;
  campaignId: string;
  supplierId: string;
  supplierConnectedAccountId: string;
  currency: string;
  capturedGrossAmount: number;
  providerFeeAmount: number;
  supplierPayableAmount: number;
  organiserFeeAmount: number;
  ekiFeeAmount: number;
  refundDeductionAmount: number;
  disputeDeductionAmount: number;
  reserveAmount: number;
  netPayoutAmount: number;
  status: CommunityBuyPayoutStatus;
  holdReasonCodes: string[];
  releaseEligibleAt: string | null;
  providerPayoutId: string | null;
  requestedAt: string | null;
  submittedAt: string | null;
  paidAt: string | null;
  failedAt: string | null;
  failureCode: string | null;
  failureMessage: string | null;
  retryCount: number;
  createdAt: string;
  updatedAt: string;
  campaign?: { id: string; title: string; confirmedShares: number };
}

export interface PayoutEligibility {
  eligible: boolean;
  blockers: string[];
}

export type ReleaseCommunityBuyPayoutResult = { payout: AdminCommunityBuyPayout } | PendingApprovalResponse;

export function isPendingCommunityBuyPayoutApproval(result: ReleaseCommunityBuyPayoutResult): result is PendingApprovalResponse {
  return "pendingApproval" in result;
}

// ─── M7 — CommunityBuyOrganiserFee (spec §13.3/§15.6) ─────────────────────
export type CommunityBuyOrganiserFeeStatus = "ACCRUED" | "HELD" | "BLOCKED_NO_SETTLEMENT_ROUTE" | "SETTLED" | "CANCELLED" | "REVERSED";
export type OrganiserFeeSettlementMethod = "NONE" | "EXTERNAL_SUPPLIER_ARRANGEMENT" | "NON_CASH_REWARD" | "STRIPE_CONNECT_TRANSFER";

export interface AdminCommunityBuyOrganiserFee {
  id: string;
  campaignId: string;
  organiserId: string;
  supplierId: string | null;
  currency: string;
  feePerCapturedOrder: number;
  capturedQuantity: number;
  grossFeeAmount: number;
  refundDeductionAmount: number;
  disputeDeductionAmount: number;
  netFeeAmount: number;
  status: CommunityBuyOrganiserFeeStatus;
  settlementMethod: OrganiserFeeSettlementMethod;
  providerReference: string | null;
  heldReasonCodes: string[];
  settledAt: string | null;
  createdAt: string;
  updatedAt: string;
  campaign?: { id: string; title: string; organiserId: string };
}

// ─── M7 — organiser acquisition attribution review (spec §14.5, AT-45/46) ─
export type AttributionStatus = "ACTIVE" | "UNDER_REVIEW" | "INVALIDATED";
export type AttributionSource = "DIRECT_JOIN" | "REORDER_RETAINED" | "SELF";

export interface AdminAttributionParticipant {
  id: string;
  campaignId: string;
  userId: string;
  joinedAt: string;
  acquisitionOrganiserId: string | null;
  acquisitionCampaignId: string | null;
  acquiredAt: string | null;
  organiserAttributionExpiresAt: string | null;
  attributionSource: AttributionSource | null;
  attributionStatus: AttributionStatus;
  attributionOverrideReason: string | null;
  campaign?: { id: string; title: string };
  user?: { id: string; name: string; email: string };
}

export const communityBuyAdminAPI = {
  async getCampaignsForReview(opts?: ReadOptions): Promise<AdminCampaign[]> {
    const res = await apiClient.get<{ items?: AdminCampaign[] }>("/admin/community-campaigns/review", opts);
    return res.items ?? [];
  },
  async getRecentlyClosedCampaigns(opts?: ReadOptions): Promise<AdminCampaign[]> {
    const res = await apiClient.get<{ items?: AdminCampaign[] }>("/admin/community-campaigns/closed", opts);
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
  /** Phase 9 — only reachable pre-charge (DRAFT..RESCUE_WINDOW); the backend 409s for anything past that. */
  async cancelCampaign(id: string, reason: string): Promise<AdminCampaign> {
    const res = await apiClient.post<{ campaign: AdminCampaign }>(`/admin/community-campaigns/${id}/cancel`, { reason });
    return res.campaign;
  },
  /** Phase 9 (REQ-CB-A-004) — every contribution/pledge for a campaign, with participant identity, regardless of status. */
  async getCampaignContributions(campaignId: string, opts?: ReadOptions): Promise<AdminContribution[]> {
    const res = await apiClient.get<{ items?: AdminContribution[] }>(`/admin/community-campaigns/${campaignId}/contributions`, opts);
    return res.items ?? [];
  },

  async getPendingOrganisers(opts?: ReadOptions): Promise<PendingOrganiser[]> {
    const res = await apiClient.get<{ items?: PendingOrganiser[] }>("/admin/community-buy/organisers/pending", opts);
    return res.items ?? [];
  },
  async verifyOrganiser(id: string): Promise<PendingOrganiser> {
    const res = await apiClient.post<{ profile: PendingOrganiser }>(`/admin/community-buy/organisers/${id}/verify`, {});
    return res.profile;
  },
  async getPendingSuppliers(opts?: ReadOptions): Promise<PendingSupplier[]> {
    const res = await apiClient.get<{ items?: PendingSupplier[] }>("/admin/community-buy/suppliers/pending", opts);
    return res.items ?? [];
  },
  async verifySupplier(id: string): Promise<PendingSupplier> {
    const res = await apiClient.post<{ profile: PendingSupplier }>(`/admin/community-buy/suppliers/${id}/verify`, {});
    return res.profile;
  },

  async getMarketConfigs(opts?: ReadOptions): Promise<MarketConfig[]> {
    const res = await apiClient.get<{ items?: MarketConfig[] }>("/admin/community-buy/markets", opts);
    return res.items ?? [];
  },
  async updateMarketConfig(countryCode: string, data: MarketConfigUpdate): Promise<MarketConfig> {
    const res = await apiClient.patch<{ config: MarketConfig }>(`/admin/community-buy/markets/${countryCode}`, data);
    return res.config;
  },

  async getRefunds(opts?: ReadOptions): Promise<AdminCampaignRefund[]> {
    const res = await apiClient.get<{ items?: AdminCampaignRefund[] }>("/admin/community-buy/refunds", opts);
    return res.items ?? [];
  },
  async requeryRefund(id: string): Promise<AdminCampaignRefund> {
    const res = await apiClient.post<{ refund: AdminCampaignRefund }>(`/admin/community-buy/refunds/${id}/requery`, {});
    return res.refund;
  },
  async escalateRefund(id: string, note?: string): Promise<{ id: string; escalated: boolean }> {
    const res = await apiClient.post<{ supportCase: { id: string; escalated: boolean } }>(`/admin/community-buy/refunds/${id}/escalate`, { note });
    return res.supportCase;
  },

  // ─── Rescue-window extension requests — doc §8/§Screen 127 ─────────────
  async getExtensionRequests(opts?: ReadOptions): Promise<AdminExtensionRequest[]> {
    const res = await apiClient.get<{ items?: AdminExtensionRequest[] }>("/admin/community-buy/extension-requests", opts);
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
  async getSupplierPayments(opts?: ReadOptions): Promise<AdminSupplierPayment[]> {
    const res = await apiClient.get<{ items?: AdminSupplierPayment[] }>("/admin/community-buy/supplier-payments", opts);
    return res.items ?? [];
  },
  /**
   * Returns the released payment directly, OR — when a four-eyes
   * AdminApprovalRule is configured for this action — a 202 response
   * describing the pending approval instead. Callers must check
   * isPendingApproval() before assuming the payment was actually released.
   */
  async releaseSupplierPayment(campaignId: string, twoFactorCode?: string): Promise<ReleaseSupplierPaymentResult> {
    return apiClient.post<ReleaseSupplierPaymentResult>(`/admin/community-campaigns/${campaignId}/supplier-payment/release`, {}, { twoFactorCode });
  },
  async holdSupplierPayment(campaignId: string, reason: string, twoFactorCode?: string): Promise<AdminSupplierPayment> {
    const res = await apiClient.post<{ payment: AdminSupplierPayment }>(`/admin/community-campaigns/${campaignId}/supplier-payment/hold`, { reason }, { twoFactorCode });
    return res.payment;
  },

  /** Real cross-campaign/cross-supplier aggregate — every number comes from actual CampaignSupplierPayment rows, never mixed across currencies. */
  async getSupplierPaymentAggregate(filters?: { from?: string; to?: string; status?: SupplierPaymentStatus; supplierId?: string; campaignId?: string }, opts?: ReadOptions): Promise<SupplierPaymentAggregate> {
    const query = new URLSearchParams();
    if (filters?.from) query.set("from", filters.from);
    if (filters?.to) query.set("to", filters.to);
    if (filters?.status) query.set("status", filters.status);
    if (filters?.supplierId) query.set("supplierId", filters.supplierId);
    if (filters?.campaignId) query.set("campaignId", filters.campaignId);
    const suffix = query.toString() ? `?${query.toString()}` : "";
    return apiClient.get<SupplierPaymentAggregate>(`/admin/community-buy/supplier-payments/aggregate${suffix}`, opts);
  },

  // ─── Risk controls — restrict/unrestrict without revoking verification ──
  async getVerifiedOrganisers(opts?: ReadOptions): Promise<PendingOrganiser[]> {
    const res = await apiClient.get<{ items?: PendingOrganiser[] }>("/admin/community-buy/organisers", opts);
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
  async getVerifiedSuppliers(opts?: ReadOptions): Promise<PendingSupplier[]> {
    const res = await apiClient.get<{ items?: PendingSupplier[] }>("/admin/community-buy/suppliers", opts);
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
  async getLedgerSummary(opts?: ReadOptions): Promise<LedgerSummaryRow[]> {
    const res = await apiClient.get<{ items?: LedgerSummaryRow[] }>("/admin/community-buy/ledger", opts);
    return res.items ?? [];
  },
  async getCampaignLedger(campaignId: string, opts?: ReadOptions): Promise<CampaignLedger> {
    return apiClient.get<CampaignLedger>(`/admin/community-campaigns/${campaignId}/ledger`, opts);
  },

  // ─── Support cases — doc Phase 9 ───────────────────────────────────────
  async getSupportCases(status?: SupportCaseStatus, opts?: ReadOptions): Promise<AdminSupportCase[]> {
    const qs = status ? `?status=${encodeURIComponent(status)}` : "";
    const res = await apiClient.get<{ items?: AdminSupportCase[] }>(`/admin/community-buy/support-cases${qs}`, opts);
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

  // ─── SupplierAccount review (Workstream 3, Set B) — the no-Vendor-
  // required supplier capability. Approve/restrict/unrestrict have existed
  // backend-side since Workstream 1 with zero admin-web UI; list is new. ──
  async getSupplierAccounts(state?: SupplierAccountState, opts?: ReadOptions): Promise<AdminSupplierAccount[]> {
    const qs = state ? `?state=${encodeURIComponent(state)}` : "";
    const res = await apiClient.get<{ items?: AdminSupplierAccount[] }>(`/admin/community-buy/supplier-accounts${qs}`, opts);
    return res.items ?? [];
  },
  async approveSupplierAccount(id: string): Promise<AdminSupplierAccount> {
    const res = await apiClient.post<{ account: AdminSupplierAccount }>(`/admin/community-buy/supplier-accounts/${id}/approve`, {});
    return res.account;
  },
  async restrictSupplierAccount(id: string, reason: string, controlScope?: "fulfilment_access_preserved"): Promise<AdminSupplierAccount> {
    const res = await apiClient.post<{ account: AdminSupplierAccount }>(`/admin/community-buy/supplier-accounts/${id}/restrict`, { reason, controlScope: controlScope ?? null });
    return res.account;
  },
  async unrestrictSupplierAccount(id: string): Promise<AdminSupplierAccount> {
    const res = await apiClient.post<{ account: AdminSupplierAccount }>(`/admin/community-buy/supplier-accounts/${id}/unrestrict`, {});
    return res.account;
  },
  // M5 (spec §10.1/§10.2 step 6 "request information").
  async requestSupplierInformation(id: string, reason: string): Promise<AdminSupplierAccount> {
    const res = await apiClient.post<{ account: AdminSupplierAccount }>(`/admin/community-buy/supplier-accounts/${id}/request-information`, { reason });
    return res.account;
  },
  // M5 — always revokes data access; 2FA-gated on the backend.
  async suspendSupplierAccount(id: string, reason: string): Promise<AdminSupplierAccount> {
    const res = await apiClient.post<{ account: AdminSupplierAccount }>(`/admin/community-buy/supplier-accounts/${id}/suspend`, { reason });
    return res.account;
  },
  // M5 — permanent, terminal; 2FA-gated on the backend.
  async closeSupplierAccount(id: string, reason: string): Promise<AdminSupplierAccount> {
    const res = await apiClient.post<{ account: AdminSupplierAccount }>(`/admin/community-buy/supplier-accounts/${id}/close`, { reason });
    return res.account;
  },
  // M5 — the equally-guarded (2FA) reversal for suspend(); never unrestrict().
  async unsuspendSupplierAccount(id: string): Promise<AdminSupplierAccount> {
    const res = await apiClient.post<{ account: AdminSupplierAccount }>(`/admin/community-buy/supplier-accounts/${id}/unsuspend`, {});
    return res.account;
  },
  // M4 — manual, admin-initiated revoke for investigation cases (spec §19).
  async revokeSupplierDataAccess(id: string, reason: string): Promise<{ revokedCount: number }> {
    return apiClient.post<{ revokedCount: number }>(`/admin/community-buy/supplier-accounts/${id}/revoke-data-access`, { reason });
  },
  // M4 — data-access audit search (spec §19, AT-43).
  async getDataAccessLog(filters?: { campaignId?: string; supplierAccountId?: string; accessorUserId?: string; dataCategory?: string; action?: string }, opts?: ReadOptions): Promise<AdminDataAccessLogEntry[]> {
    const params = new URLSearchParams();
    if (filters?.campaignId) params.set("campaignId", filters.campaignId);
    if (filters?.supplierAccountId) params.set("supplierAccountId", filters.supplierAccountId);
    if (filters?.accessorUserId) params.set("accessorUserId", filters.accessorUserId);
    if (filters?.dataCategory) params.set("dataCategory", filters.dataCategory);
    if (filters?.action) params.set("action", filters.action);
    const qs = params.toString();
    const res = await apiClient.get<{ items?: AdminDataAccessLogEntry[] }>(`/admin/community-buy/data-access-log${qs ? `?${qs}` : ""}`, opts);
    return res.items ?? [];
  },
  // M4 (spec §14.3, AT-42) — always four-eyes gated; this only ever creates the pending approval, never the disclosure itself. A second, different admin decides it from the Approvals queue.
  async requestEmergencyDisclosure(campaignId: string, contributionId: string, reason: string): Promise<{ pendingApproval: unknown; message: string }> {
    return apiClient.post<{ pendingApproval: unknown; message: string }>(`/admin/community-campaigns/${campaignId}/contributions/${contributionId}/emergency-disclosure`, { reason });
  },

  // ─── M6 — CommunityBuyPayout (M2 AUTHORISE_THEN_CAPTURE Direct Charge
  // governance). Parallel to the supplier-payments section above (which is
  // the OLD PLEDGE_THEN_CHARGE transfer mechanism) — never the same record. ──
  async getCommunityBuyPayouts(opts?: ReadOptions): Promise<AdminCommunityBuyPayout[]> {
    const res = await apiClient.get<{ items?: AdminCommunityBuyPayout[] }>("/admin/community-buy/payouts", opts);
    return res.items ?? [];
  },
  async getCommunityBuyPayout(campaignId: string, opts?: ReadOptions): Promise<AdminCommunityBuyPayout> {
    const res = await apiClient.get<{ payout: AdminCommunityBuyPayout }>(`/admin/community-campaigns/${campaignId}/payout`, opts);
    return res.payout;
  },
  async getCommunityBuyPayoutEligibility(campaignId: string, opts?: ReadOptions): Promise<PayoutEligibility> {
    return apiClient.get<PayoutEligibility>(`/admin/community-campaigns/${campaignId}/payout/eligibility`, opts);
  },
  async markCommunityBuyPayoutReady(campaignId: string, twoFactorCode?: string): Promise<AdminCommunityBuyPayout> {
    const res = await apiClient.post<{ payout: AdminCommunityBuyPayout }>(`/admin/community-campaigns/${campaignId}/payout/mark-ready`, {}, { twoFactorCode });
    return res.payout;
  },
  async holdCommunityBuyPayout(campaignId: string, reasonCode: string, twoFactorCode?: string): Promise<AdminCommunityBuyPayout> {
    const res = await apiClient.post<{ payout: AdminCommunityBuyPayout }>(`/admin/community-campaigns/${campaignId}/payout/hold`, { reasonCode }, { twoFactorCode });
    return res.payout;
  },
  /** Four-eyes gated when a rule is configured — check isPendingApproval() before assuming release actually happened, same contract as releaseSupplierPayment() above. */
  async releaseCommunityBuyPayout(campaignId: string, twoFactorCode?: string): Promise<ReleaseCommunityBuyPayoutResult> {
    return apiClient.post<ReleaseCommunityBuyPayoutResult>(`/admin/community-campaigns/${campaignId}/payout/release`, {}, { twoFactorCode });
  },

  // ─── M7 — CommunityBuyOrganiserFee ───────────────────────────────────────
  async getCommunityBuyOrganiserFees(opts?: ReadOptions): Promise<AdminCommunityBuyOrganiserFee[]> {
    const res = await apiClient.get<{ items?: AdminCommunityBuyOrganiserFee[] }>("/admin/community-buy/organiser-fees", opts);
    return res.items ?? [];
  },
  async getCommunityBuyOrganiserFee(campaignId: string, opts?: ReadOptions): Promise<AdminCommunityBuyOrganiserFee> {
    const res = await apiClient.get<{ fee: AdminCommunityBuyOrganiserFee }>(`/admin/community-campaigns/${campaignId}/organiser-fee`, opts);
    return res.fee;
  },
  async holdCommunityBuyOrganiserFee(campaignId: string, reasonCode: string, twoFactorCode?: string): Promise<AdminCommunityBuyOrganiserFee> {
    const res = await apiClient.post<{ fee: AdminCommunityBuyOrganiserFee }>(`/admin/community-campaigns/${campaignId}/organiser-fee/hold`, { reasonCode }, { twoFactorCode });
    return res.fee;
  },
  async releaseCommunityBuyOrganiserFee(campaignId: string, twoFactorCode?: string): Promise<AdminCommunityBuyOrganiserFee> {
    const res = await apiClient.post<{ fee: AdminCommunityBuyOrganiserFee }>(`/admin/community-campaigns/${campaignId}/organiser-fee/release`, {}, { twoFactorCode });
    return res.fee;
  },
  /** Only EXTERNAL_SUPPLIER_ARRANGEMENT/NON_CASH_REWARD are reachable today — STRIPE_CONNECT_TRANSFER refuses 503 server-side until a settlement route is confirmed (spec §26). */
  async settleCommunityBuyOrganiserFee(campaignId: string, settlementMethod: Exclude<OrganiserFeeSettlementMethod, "NONE">, providerReference: string | undefined, twoFactorCode?: string): Promise<AdminCommunityBuyOrganiserFee> {
    const res = await apiClient.post<{ fee: AdminCommunityBuyOrganiserFee }>(`/admin/community-campaigns/${campaignId}/organiser-fee/settle`, { settlementMethod, providerReference }, { twoFactorCode });
    return res.fee;
  },

  // ─── M7 — attribution review ─────────────────────────────────────────────
  async getAttributionReviews(status: AttributionStatus = "UNDER_REVIEW", opts?: ReadOptions): Promise<AdminAttributionParticipant[]> {
    const res = await apiClient.get<{ items?: AdminAttributionParticipant[] }>(`/admin/community-buy/attribution-reviews?status=${status}`, opts);
    return res.items ?? [];
  },
  async flagAttributionForReview(participantId: string, reason: string): Promise<AdminAttributionParticipant> {
    const res = await apiClient.post<{ participant: AdminAttributionParticipant }>(`/admin/community-buy/participants/${participantId}/attribution/flag`, { reason });
    return res.participant;
  },
  async resolveAttributionReview(participantId: string, outcome: "CONFIRMED_VALID" | "INVALIDATED", reason: string): Promise<AdminAttributionParticipant> {
    const res = await apiClient.post<{ participant: AdminAttributionParticipant }>(`/admin/community-buy/participants/${participantId}/attribution/resolve`, { outcome, reason });
    return res.participant;
  },
};
