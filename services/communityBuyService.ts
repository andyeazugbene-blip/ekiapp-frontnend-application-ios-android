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
  | "CANCELLED"
  // Phase 4 (cancellation under review) — a campaign that has already
  // captured at least one payment enters this state when its organiser
  // requests cancellation, instead of going straight to CANCELLED.
  | "CANCELLATION_UNDER_REVIEW";

export type FundingOutcome = "PENDING" | "GOAL_REACHED" | "MINIMUM_REACHED" | "BELOW_MINIMUM";

export type StatusTone = "success" | "warning" | "error" | "info" | "neutral";

/** Central status-presentation mapping — every participant screen must read from here, never `.replace("_", " ")` on the raw enum. */
export const CAMPAIGN_STATUS_LABELS: Record<CampaignStatus, string> = {
  DRAFT: "Draft",
  UNDER_REVIEW: "Under review",
  CHANGES_REQUIRED: "Changes requested",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  LIVE: "Live",
  PAUSED: "Paused",
  RESCUE_WINDOW: "Completion period",
  SUCCEEDED: "Succeeded",
  FAILED: "Did not reach minimum",
  REFUNDING: "Refunding",
  FULFILLING: "Proceeding",
  COMPLETED: "Completed",
  FINANCIALLY_CLOSED: "Closed",
  CANCELLED: "Ended",
  CANCELLATION_UNDER_REVIEW: "Cancellation under review",
};

export const CAMPAIGN_STATUS_TONE: Record<CampaignStatus, StatusTone> = {
  DRAFT: "neutral",
  UNDER_REVIEW: "neutral",
  CHANGES_REQUIRED: "warning",
  APPROVED: "info",
  REJECTED: "error",
  LIVE: "success",
  PAUSED: "warning",
  RESCUE_WINDOW: "warning",
  SUCCEEDED: "success",
  FAILED: "warning",
  REFUNDING: "warning",
  FULFILLING: "success",
  COMPLETED: "success",
  FINANCIALLY_CLOSED: "neutral",
  CANCELLED: "error",
  CANCELLATION_UNDER_REVIEW: "warning",
};

// PLEDGE_THEN_CHARGE model (client mandate 2026-09): a pledge saves a
// payment method and reserves a share, but captures nothing. Charging only
// happens once the campaign succeeds — see PLEDGED / CHARGE_FAILED below.
// PAYMENT_PROCESSING is reused for "the off-session charge is in flight".
export type ContributionStatus =
  | "INITIATED"
  | "PLEDGED"
  | "PAYMENT_PROCESSING"
  | "PAID"
  | "PAYMENT_FAILED"
  | "CHARGE_FAILED"
  | "REFUND_PENDING"
  | "REFUND_PROCESSING"
  | "REFUNDED"
  | "REFUND_FAILED"
  | "CANCELLED";

// Client mandate (2026-09): accurate states only — never show "Payment
// successful" when only a payment method has been saved (PLEDGED).
export const CONTRIBUTION_STATUS_LABELS: Record<ContributionStatus, string> = {
  INITIATED: "Starting your pledge",
  PLEDGED: "Payment method saved — awaiting outcome",
  PAYMENT_PROCESSING: "Payment pending",
  PAID: "Payment confirmed",
  PAYMENT_FAILED: "Payment failed",
  CHARGE_FAILED: "Payment failed",
  REFUND_PENDING: "Refund started",
  REFUND_PROCESSING: "Refund in progress",
  REFUNDED: "Refund completed",
  REFUND_FAILED: "Refund needs attention",
  CANCELLED: "Pledge cancelled",
};

export const CONTRIBUTION_STATUS_TONE: Record<ContributionStatus, StatusTone> = {
  INITIATED: "neutral",
  PLEDGED: "info",
  PAYMENT_PROCESSING: "info",
  PAID: "success",
  PAYMENT_FAILED: "error",
  CHARGE_FAILED: "error",
  REFUND_PENDING: "warning",
  REFUND_PROCESSING: "warning",
  REFUNDED: "success",
  REFUND_FAILED: "error",
  CANCELLED: "neutral",
};

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

export type CancellationRequestStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface CancellationRequest {
  id: string;
  campaignId: string;
  reason: string;
  hadFinancialActivity: boolean;
  status: CancellationRequestStatus;
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
  // Eki's real, admin-configured processing fee (basis points, e.g. 500 =
  // 5%) — taken from the supplier's payout at release time, never an extra
  // charge to the organiser or participant. organiserFeeBps is a separate,
  // currently-unapplied field (confirmed: no code path deducts it anywhere)
  // — do not present it as an active charge.
  communityBuyFeeBps?: number | null;
  organiserFeeBps?: number | null;
  // M4 — global kill-switch (COMMUNITY_BUY_INDIVIDUAL_DELIVERY_ENABLED on
  // the backend), not per-market. Defaults false server-side; treat a
  // missing value the same as false.
  individualDeliveryEnabled?: boolean;
}

export type CampaignDeliveryPreference = "COLLECTION" | "DELIVERY";

/** Every field a wizard step can save — all optional except where createCampaign requires title+country. Mirrors the backend's CreateCampaignInput exactly (community-campaigns.service.ts). */
export interface CampaignDraftInput {
  title?: string;
  country?: string;
  fulfilmentOwner?: "SELF" | "SUPPLIER";
  supplierId?: string;
  // Workstream 3 — the no-Vendor-required supplier choice, preferred over
  // supplierId for new assignments (see VerifiedSupplier/listVerifiedSuppliers).
  supplierAccountId?: string;
  description?: string;
  currency?: string;
  minimumShares?: number;
  goalShares?: number;
  maximumShares?: number;
  // Phase 2 (organiser controls) — optional per-buyer slot limits.
  perBuyerMinShares?: number;
  perBuyerMaxShares?: number;
  pricePerShareMinor?: number;
  deadline?: string;
  rescueDurationMinutes?: number;
  images?: string[];
  unit?: string;
  quantityPerOrder?: number;
  qualityNotes?: string;
  deliveryPreference?: CampaignDeliveryPreference;
  // Phase 2 (organiser controls) — optional scheduled opening.
  scheduledOpenAt?: string;
  // Phase 3 (address + privacy foundation) — organiser receiving configuration.
  collectionAddressLine1?: string;
  collectionAddressLine2?: string;
  collectionCity?: string;
  collectionPostcode?: string;
  deliveryCoverageAreas?: string[];
}

export interface Campaign {
  id: string;
  organiserId: string;
  // Client-corrected flow: supplier is an optional fulfilment choice — null
  // means the organiser is self-fulfilling.
  fulfilmentOwner: "SELF" | "SUPPLIER";
  supplierId: string | null;
  supplier?: { vendor?: { storeName: string } } | null;
  // Workstream 3 — set when a no-Vendor SupplierAccount is assigned
  // (alongside supplierId when that account is itself linked to a legacy
  // profile). Prefer supplierAccount?.user?.name over supplier?.vendor?.
  // storeName when both could apply, since supplierAccountId is the
  // authoritative assignment going forward.
  supplierAccountId?: string | null;
  supplierAccount?: { user?: { name: string } } | null;
  organiser?: { user?: { name: string } };
  title: string;
  description?: string | null;
  // Community Buy Workstream 2: a draft may not have chosen these yet —
  // null is a real "not decided", never a fabricated placeholder. submit()
  // is the authoritative gate requiring all of these before review.
  country: string | null;
  currency: string | null;
  targetAmount: number;
  minimumShares: number | null;
  goalShares: number | null;
  maximumShares: number | null;
  // Phase 2 (organiser controls) — optional per-buyer slot limits, distinct
  // from maximumShares (the campaign-wide cap). Null means no per-buyer
  // limit.
  perBuyerMinShares?: number | null;
  perBuyerMaxShares?: number | null;
  pricePerShareMinor: number | null;
  // Diaspora escrow reconciliation — the organiser-agreed wholesale price
  // paid to an Eki-registered supplier, distinct from pricePerShareMinor
  // (what participants pay). Null means no wholesale split applies
  // (self-supply, external supplier, or a supplier campaign with no
  // wholesale figure yet).
  wholesaleAmountMinor?: number | null;
  confirmedShares: number;
  fundingOutcome: FundingOutcome;
  supplierCommitted: boolean;
  supplierDeclinedAt?: string | null;
  supplierDeclineReason?: string | null;
  rescueEndsAt?: string | null;
  extensionCount: number;
  paidTotal?: number;
  progressPct?: number;
  participantCount?: number;
  contributions?: { amount: number; quantity: number }[];
  deadline: string | null;
  status: CampaignStatus;
  reviewNotes?: string | null;
  createdAt: string;
  // Product step (spec §7 step 1) — additive.
  images: string[];
  unit: string | null;
  quantityPerOrder: number | null;
  qualityNotes: string | null;
  // Delivery step (spec §7 step 5) — organiser intent only, no address data.
  deliveryPreference: CampaignDeliveryPreference;
  // Phase 2 (organiser controls) — optional scheduled opening. Null means
  // publish() opens the campaign immediately.
  scheduledOpenAt?: string | null;
  // Phase 3 (address + privacy foundation) — organiser receiving
  // configuration. collectionAddress* is public (shown to every buyer);
  // deliveryCoverageAreas is only meaningful when deliveryPreference is
  // DELIVERY.
  collectionAddressLine1?: string | null;
  collectionAddressLine2?: string | null;
  collectionCity?: string | null;
  collectionPostcode?: string | null;
  deliveryCoverageAreas?: string[];
  // Phase 2 (organiser identity display preference) — server-computed
  // display name (first name only, or full name, per the organiser's own
  // preference). Buyer-facing surfaces should always prefer this over
  // organiser?.user?.name, which is only ever present on organiser-owned
  // reads (never a buyer-facing one).
  organiserDisplayName?: string;
  // Diaspora escrow reconciliation (final V1 settlement doc, required buyer
  // disclosure) — PER-SHARE preview of Eki's buyer service fee at the
  // market's CURRENT rate; a client multiplies by chosen quantity for the
  // real total. Null when there's no price yet or no market configured.
  perShareFeeEstimate?: { productSubtotal: number; feeAmount: number; maxTotal: number; feeBps: number } | null;
}

export interface Contribution {
  id: string;
  campaignId: string;
  participantId: string;
  // Product subtotal only — the buyer service fee is a separate field (see
  // buyerServiceFeeAmount) so this stays exactly what capacity/pricing math
  // already assumes it means.
  amount: number;
  currency: string;
  quantity: number;
  isOrganiserTopUp: boolean;
  status: ContributionStatus;
  stripePaymentIntentId?: string | null;
  // Diaspora escrow reconciliation — Eki's 5% buyer service fee, charged
  // alongside `amount` in the same capture. Total actually charged is
  // amount + buyerServiceFeeAmount.
  buyerServiceFeeAmount?: number;
  // Phase 3 (address + privacy foundation) — present only for a DELIVERY
  // campaign's contribution; this is the buyer's own data, visible on
  // their own contribution read regardless of campaign delivery mode.
  deliveryRecipientName?: string | null;
  deliveryAddressLine1?: string | null;
  deliveryAddressLine2?: string | null;
  deliveryCity?: string | null;
  deliveryPostcode?: string | null;
  refund?: { status: string; amount: number } | null;
  createdAt: string;
}

export interface DeliveryAddressInput {
  recipientName: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  postcode: string;
}

export interface MyCommunityBuy {
  campaign: {
    id: string;
    title: string;
    status: CampaignStatus;
    fundingOutcome: FundingOutcome;
    currency: string;
    deadline: string;
    minimumShares: number;
    goalShares: number;
    maximumShares: number;
    confirmedShares: number;
    rescueEndsAt?: string | null;
    supplier?: { vendor?: { storeName: string } };
  };
  totalQuantity: number;
  totalPaid: number;
  totalPledged: number;
  latestContribution: Contribution;
  refundStatus: "REFUND_PENDING" | "REFUND_PROCESSING" | "REFUNDED" | "REFUND_FAILED" | null;
}

export interface CampaignUpdate {
  id: string;
  title: string;
  body?: string | null;
  createdAt: string;
  source?: "broadcast" | "system";
  authorRole?: "ORGANISER" | "SUPPLIER" | "SYSTEM";
}

export interface CampaignParticipant {
  userId: string;
  // M4 (spec §14.3, AT-44): omitted entirely by the backend for a
  // SELF-fulfilled campaign — the organiser IS the fulfiller and gets only
  // fulfilment-necessary data, same principle a third-party supplier's
  // masked manifest gets. Present for a genuinely third-party-supplied
  // campaign.
  name?: string;
  email?: string;
  joinedAt: string;
  totalQuantity: number;
  totalPaid: number;
  isOrganiser: boolean;
  // Phase 3 (address + privacy foundation) — present only for a DELIVERY
  // campaign, and only for the campaign's owning organiser. Never present
  // on any supplier-facing read (the manifest has no address field at all).
  deliveryAddress?: {
    recipientName: string | null;
    addressLine1: string | null;
    addressLine2: string | null;
    city: string | null;
    postcode: string | null;
  };
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

export const FULFILMENT_METHOD_LABELS: Record<FulfilmentMethod, string> = {
  DELIVERY: "Delivery",
  COLLECTION: "Collection",
};

export const FULFILMENT_STATUS_LABELS: Record<FulfilmentStatus, string> = {
  AWAITING_INVENTORY_CONFIRMATION: "Awaiting supplier confirmation",
  INVENTORY_CONFIRMED: "Stock confirmed",
  PACKING: "Being packed",
  READY_FOR_DISPATCH_OR_COLLECTION: "Ready",
  DISPATCHED: "Dispatched",
  COLLECTED: "Collected",
  COMPLETED: "Completed",
};

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
  // Diaspora escrow reconciliation — the organiser-agreed wholesale amount
  // (null = no wholesale split, legacy/self-supply/external-supplier
  // behavior); feeAmount/netAmount are only populated once released.
  wholesaleAmount?: number | null;
  feeAmount?: number | null;
  netAmount?: number | null;
}

// Diaspora escrow reconciliation — the organiser's own settlement record,
// mirrors SupplierPayment's shape exactly (same SupplierPaymentStatus enum
// on the backend).
export interface OrganiserPayout {
  campaignId: string;
  amount: number;
  currency: string;
  status: SupplierPaymentStatus;
  commissionAmount?: number | null;
  netAmount?: number | null;
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
  isRestricted?: boolean;
  restrictedReason?: string | null;
  // Phase 2 (organiser identity display preference) — defaults true
  // (first-name-only) server-side.
  firstNameOnlyDisplay?: boolean;
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

// Workstream 3 — the no-Vendor-required supplier capability (Supplier
// Centre). Mirrors backend SupplierAccountState exactly (schema.prisma).
export type SupplierAccountState =
  | "NOT_STARTED"
  | "DRAFT"
  | "VERIFICATION_REQUIRED"
  | "UNDER_REVIEW"
  | "INFORMATION_REQUIRED"
  | "APPROVED"
  | "PAUSED"
  | "RESTRICTED"
  | "SUSPENDED"
  | "CLOSED";

export const SUPPLIER_ACCOUNT_STATE_LABELS: Record<SupplierAccountState, string> = {
  NOT_STARTED: "Not started",
  DRAFT: "Draft application",
  VERIFICATION_REQUIRED: "Verification required",
  UNDER_REVIEW: "Under review",
  INFORMATION_REQUIRED: "More information needed",
  APPROVED: "Approved",
  PAUSED: "Paused",
  RESTRICTED: "Restricted",
  SUSPENDED: "Suspended",
  CLOSED: "Closed",
};

export interface SupplierAccount {
  id?: string;
  supplierState: SupplierAccountState;
  requirementsDue: string[];
  categories?: string[];
  coverageRegions?: string[];
  collectionAreas?: string[];
  providerConnectedAccountId?: string | null;
  chargesEnabled?: boolean;
  payoutsEnabled?: boolean;
  detailsSubmitted?: boolean;
  reasonCode?: string | null;
  legacySupplierProfileId?: string | null;
  approvedAt?: string | null;
  pausedAt?: string | null;
  // M5
  collectionCapacityPerDay?: number | null;
  stripeRequirementsDue?: string[];
  suspendedAt?: string | null;
  closedAt?: string | null;
}

// M5 — the append-only fulfilment evidence timeline (spec §10.2 step 5).
export type FulfilmentEventType =
  | "INVENTORY_CONFIRMED"
  | "PLAN_SET"
  | "PACKING_STARTED"
  | "READY"
  | "DISPATCHED"
  | "COLLECTED"
  | "COMPLETED"
  | "EXCEPTION"
  | "PARTICIPANT_RECEIPT_CONFIRMED"
  | "PARTICIPANT_PROBLEM_REPORTED";

export interface FulfilmentEvent {
  id: string;
  campaignId: string;
  contributionId: string | null;
  actorUserId: string;
  actorRole: "SUPPLIER" | "ORGANISER" | "PARTICIPANT" | "ADMIN";
  eventType: FulfilmentEventType;
  note: string | null;
  createdAt: string;
}

/** The organiser-facing picker's real shape (Workstream 3 — SupplierAccount-driven, replacing the legacy SupplierProfile+vendor shape). */
export interface VerifiedSupplier {
  id: string;
  displayName: string | null;
  categories: string[];
  coverageRegions: string[];
  legacySupplierProfileId: string | null;
}

export type SupplierInvitationStatus = "PENDING" | "ACCEPTED" | "DECLINED" | "EXPIRED" | "REVOKED";

export interface SupplierInvitation {
  id: string;
  campaignId: string;
  email: string;
  token: string;
  status: SupplierInvitationStatus;
  declineReason?: string | null;
  expiresAt: string;
  respondedAt?: string | null;
  createdAt: string;
  campaign?: { id: string; title: string };
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
  async listLiveCampaigns(country?: string, q?: string): Promise<Campaign[]> {
    const params = new URLSearchParams();
    if (country) params.set("country", country);
    if (q?.trim()) params.set("q", q.trim());
    const qs = params.toString() ? `?${params.toString()}` : "";
    const res = await apiClient.get<Items<Campaign>>(`/api/community-buy/campaigns${qs}`, { skipAuth: true });
    return res.items ?? [];
  },

  async getCampaign(id: string): Promise<Campaign> {
    const res = await apiClient.get<{ campaign: Campaign }>(`/api/community-buy/campaigns/${id}`, { skipAuth: true });
    return res.campaign;
  },

  /** Read-only — there is no participant-facing fulfilment CHOICE, only the organiser/supplier-set plan. Null until a plan exists (normal before a campaign succeeds). */
  async getCampaignFulfilment(id: string): Promise<CampaignFulfilment | null> {
    const res = await apiClient.get<{ fulfilment: CampaignFulfilment | null }>(`/api/community-buy/campaigns/${id}/fulfilment`, { skipAuth: true });
    return res.fulfilment ?? null;
  },

  // ─── Participant ─────────────────────────────────────────────────────────
  async joinCampaign(campaignId: string): Promise<void> {
    await apiClient.post(`/api/community-buy/campaigns/${campaignId}/join`, {});
  },

  /**
   * Pledges a quantity against an already-saved payment method — no money
   * moves here (client mandate 2026-09). Get a paymentMethodId first via
   * regularDeliveriesService.createSetupIntent/confirmSetupIntent (the same
   * generic /api/buyer/payment-methods flow, reused as-is).
   */
  async pledgeContribution(campaignId: string, quantity: number, paymentMethodId: string, deliveryAddress?: DeliveryAddressInput): Promise<{ contributionId: string; quantity: number; amount: number; currency: string; status: ContributionStatus }> {
    return apiClient.post(`/api/community-buy/campaigns/${campaignId}/contributions`, { quantity, paymentMethodId, deliveryAddress });
  },

  async getContribution(id: string): Promise<Contribution> {
    const res = await apiClient.get<{ contribution: Contribution }>(`/api/community-buy/contributions/${id}`);
    return res.contribution;
  },

  /** Retries a charge that failed but hasn't exhausted its attempts — e.g. after updating a card. */
  async retryContributionCharge(id: string): Promise<Contribution> {
    const res = await apiClient.post<{ contribution: Contribution }>(`/api/community-buy/contributions/${id}/retry-charge`, {});
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

  /** Organiser or supplier posts a real broadcast update — communication content only. */
  async postCampaignUpdate(campaignId: string, title: string, message: string): Promise<CampaignUpdate> {
    const res = await apiClient.post<{ update: CampaignUpdate }>(`/api/community-buy/campaigns/${campaignId}/updates`, { title, message });
    return res.update;
  },

  // ─── Organiser ────────────────────────────────────────────────────────────
  async getMyOrganiserProfile(): Promise<OrganiserProfile | null> {
    const res = await apiClient.get<{ profile: OrganiserProfile | null }>("/api/organiser/profile");
    return res.profile;
  },

  /** Phase 2 (organiser controls) — account-level identity display preference, applies to every campaign this organiser runs. */
  async updateMyOrganiserProfile(input: { firstNameOnlyDisplay?: boolean }): Promise<OrganiserProfile> {
    const res = await apiClient.patch<{ profile: OrganiserProfile }>("/api/organiser/profile", input);
    return res.profile;
  },

  async applyAsOrganiser(country: string): Promise<OrganiserProfile> {
    const res = await apiClient.post<{ profile: OrganiserProfile }>("/api/organiser/applications", { country });
    return res.profile;
  },

  /** Workstream 3 — SupplierAccount-driven; every verified legacy supplier appears here too via its synced account, so this is the single organiser-facing picker source now. */
  async listVerifiedSuppliers(country: string): Promise<VerifiedSupplier[]> {
    const res = await apiClient.get<Items<VerifiedSupplier>>(
      `/api/organiser/suppliers?country=${encodeURIComponent(country)}`,
    );
    return res.items ?? [];
  },

  async listMyOrganiserCampaigns(): Promise<Campaign[]> {
    const res = await apiClient.get<Items<Campaign>>("/api/organiser/campaigns");
    return res.items ?? [];
  },

  // Community Buy Workstream 2: only title + country are required to start
  // a draft — every other field is optional here and filled in
  // incrementally via updateCampaign() as the wizard's steps are
  // completed. submitCampaign() is the authoritative gate that requires
  // the rest.
  async createCampaign(input: CampaignDraftInput & { title: string; country: string }): Promise<Campaign> {
    const res = await apiClient.post<{ campaign: Campaign }>("/api/organiser/campaigns", input);
    return res.campaign;
  },

  async updateCampaign(id: string, input: Partial<CampaignDraftInput>): Promise<Campaign> {
    const res = await apiClient.patch<{ campaign: Campaign }>(`/api/organiser/campaigns/${id}`, input);
    return res.campaign;
  },

  /**
   * Throws ApiRequestError with `.code === "SUBMIT_REQUIREMENTS_NOT_MET"`
   * and `.details === { missing: string[] }` when the draft isn't ready —
   * the wizard's Review step reads that list directly rather than showing
   * a generic error. The draft itself is never altered by a failed submit.
   */
  async submitCampaign(id: string): Promise<Campaign> {
    const res = await apiClient.post<{ campaign: Campaign }>(`/api/organiser/campaigns/${id}/submit`, {});
    return res.campaign;
  },

  async publishCampaign(id: string): Promise<Campaign> {
    const res = await apiClient.post<{ campaign: Campaign }>(`/api/organiser/campaigns/${id}/publish`, {});
    return res.campaign;
  },

  /** Phase 2 (organiser controls) — reuses admin pause()/resume()'s exact status transitions, scoped to the organiser's own campaign. */
  async pauseCampaignAsOrganiser(id: string): Promise<Campaign> {
    const res = await apiClient.post<{ campaign: Campaign }>(`/api/organiser/campaigns/${id}/pause`, {});
    return res.campaign;
  },

  async resumeCampaignAsOrganiser(id: string): Promise<Campaign> {
    const res = await apiClient.post<{ campaign: Campaign }>(`/api/organiser/campaigns/${id}/resume`, {});
    return res.campaign;
  },

  /** Phase 2 (organiser controls) — general change request, filed through the existing support-case model/admin-review flow. */
  async requestCampaignChange(id: string, description: string): Promise<{ id: string; status: string }> {
    const res = await apiClient.post<{ supportCase: { id: string; status: string } }>(`/api/organiser/campaigns/${id}/change-request`, { description });
    return res.supportCase;
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

  async createOrganiserTopUp(campaignId: string, quantity: number, paymentMethodId: string): Promise<{ contributionId: string; quantity: number; amount: number; currency: string; status: ContributionStatus }> {
    return apiClient.post(`/api/organiser/campaigns/${campaignId}/rescue/top-up`, { quantity, paymentMethodId });
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

  /**
   * Phase 4 (cancellation under review) — resolves immediately (campaign
   * moves straight to CANCELLED) when nothing has been captured yet, or
   * moves the campaign to CANCELLATION_UNDER_REVIEW and creates a pending
   * request when it has. requiresReview tells the caller which happened.
   */
  async requestCampaignCancellation(campaignId: string, reason: string): Promise<{ campaign: Campaign; request: CancellationRequest | null; requiresReview: boolean }> {
    return apiClient.post(`/api/organiser/campaigns/${campaignId}/cancellation-request`, { reason });
  },

  // ─── Supplier ─────────────────────────────────────────────────────────────
  // Workstream 3 fix: the backend has always returned { profile, account }
  // (account added Workstream 1) — this used to silently discard `account`,
  // meaning the client never knew a SupplierAccount existed at all.
  async getMySupplierProfile(): Promise<{ profile: SupplierProfile | null; account: SupplierAccount }> {
    return apiClient.get<{ profile: SupplierProfile | null; account: SupplierAccount }>("/api/supplier/profile");
  },

  async applyAsSupplier(input: { country: string; categories?: string[]; coverageRegions?: string[]; collectionCapacityPerDay?: number }): Promise<SupplierAccount> {
    const res = await apiClient.post<{ account: SupplierAccount }>("/api/supplier/applications", input);
    return res.account;
  },

  // M5 (spec §6.4 "paused: voluntarily unavailable for new work") — the only self-service SupplierAccount transition.
  async pauseSupplierAccount(): Promise<SupplierAccount> {
    const res = await apiClient.post<{ account: SupplierAccount }>("/api/supplier/pause", {});
    return res.account;
  },

  async resumeSupplierAccount(): Promise<SupplierAccount> {
    const res = await apiClient.post<{ account: SupplierAccount }>("/api/supplier/resume", {});
    return res.account;
  },

  // ─── Supplier Stripe Connect onboarding — Workstream 3 (mandate item 2) ──
  async onboardSupplierStripeConnect(): Promise<{ onboardingUrl: string }> {
    return apiClient.post("/api/supplier/stripe-connect/onboard", {});
  },

  async getSupplierStripeConnectStatus(): Promise<{ providerConnectedAccountId: string | null; chargesEnabled: boolean; payoutsEnabled: boolean; detailsSubmitted: boolean }> {
    return apiClient.get("/api/supplier/stripe-connect/status");
  },

  async refreshSupplierStripeConnect(): Promise<{ onboardingUrl: string }> {
    return apiClient.post("/api/supplier/stripe-connect/refresh", {});
  },

  // ─── Organiser Stripe Connect onboarding (Diaspora escrow reconciliation) ──
  // Mirrors the supplier methods above exactly — same shape, same backend
  // pattern (Express account + hosted onboarding link), different owner.
  async onboardOrganiserStripeConnect(): Promise<{ onboardingUrl: string }> {
    return apiClient.post("/api/organiser/stripe-connect/onboard", {});
  },

  async getOrganiserStripeConnectStatus(): Promise<{ providerConnectedAccountId: string | null; chargesEnabled: boolean; payoutsEnabled: boolean; detailsSubmitted: boolean }> {
    return apiClient.get("/api/organiser/stripe-connect/status");
  },

  async refreshOrganiserStripeConnect(): Promise<{ onboardingUrl: string }> {
    return apiClient.post("/api/organiser/stripe-connect/refresh", {});
  },

  async getMyOrganiserPayout(campaignId: string): Promise<OrganiserPayout> {
    const res = await apiClient.get<{ payout: OrganiserPayout }>(`/api/organiser/campaigns/${campaignId}/payout`);
    return res.payout;
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

  /** Real decline capability (client spec, Screen CB67) — does not change campaign status; the organiser must reassign a new supplier via reassignSupplier() below. */
  async declineSupplierCommitment(campaignId: string, reason?: string): Promise<Campaign> {
    const res = await apiClient.post<{ campaign: Campaign }>(`/api/supplier/campaigns/${campaignId}/decline`, { reason });
    return res.campaign;
  },

  /** Organiser-side companion to decline — only valid pre-commitment, while a campaign is still in draft. Accepts either the new SupplierAccount id (preferred) or a legacy supplierId. */
  async reassignSupplier(campaignId: string, choice: { supplierAccountId: string } | { supplierId: string }): Promise<Campaign> {
    const res = await apiClient.post<{ campaign: Campaign }>(`/api/organiser/campaigns/${campaignId}/supplier`, choice);
    return res.campaign;
  },

  // ─── Supplier invitations — Workstream 3 (mandate item 7) ──────────────
  async createSupplierInvitation(campaignId: string, email: string): Promise<SupplierInvitation> {
    const res = await apiClient.post<{ invitation: SupplierInvitation }>(`/api/organiser/campaigns/${campaignId}/supplier-invitations`, { email });
    return res.invitation;
  },

  async listSupplierInvitations(campaignId: string): Promise<SupplierInvitation[]> {
    const res = await apiClient.get<Items<SupplierInvitation>>(`/api/organiser/campaigns/${campaignId}/supplier-invitations`);
    return res.items ?? [];
  },

  async revokeSupplierInvitation(invitationId: string): Promise<SupplierInvitation> {
    const res = await apiClient.post<{ invitation: SupplierInvitation }>(`/api/organiser/supplier-invitations/${invitationId}/revoke`, {});
    return res.invitation;
  },

  /** Public — the invitee may have no Eki account yet, so this and accept/decline below never require auth. */
  async getSupplierInvitation(token: string): Promise<SupplierInvitation> {
    const res = await apiClient.get<{ invitation: SupplierInvitation }>(`/api/community-buy/supplier-invitations/${token}`, { skipAuth: true });
    return res.invitation;
  },

  async acceptSupplierInvitation(token: string, newAccount?: { name: string; password: string }): Promise<{ userId: string; supplierAccountId: string; supplierState: SupplierAccountState; assigned: boolean }> {
    return apiClient.post(`/api/community-buy/supplier-invitations/${token}/accept`, newAccount ?? {}, { skipAuth: true });
  },

  async declineSupplierInvitation(token: string, reason?: string): Promise<SupplierInvitation> {
    const res = await apiClient.post<{ invitation: SupplierInvitation }>(`/api/community-buy/supplier-invitations/${token}/decline`, { reason }, { skipAuth: true });
    return res.invitation;
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

  /** M5 — an informational overlay; never changes fulfilment.status itself. */
  async reportFulfilmentException(campaignId: string, note: string): Promise<{ recorded: true }> {
    return apiClient.post(`/api/supplier/campaigns/${campaignId}/fulfilment/exception`, { note });
  },

  /** M5 — the append-only evidence timeline; organiser/supplier (own campaign) or admin. */
  async getFulfilmentEvents(campaignId: string): Promise<FulfilmentEvent[]> {
    const res = await apiClient.get<{ events: FulfilmentEvent[] }>(`/api/community-buy/campaigns/${campaignId}/fulfilment/events`);
    return res.events ?? [];
  },

  /** M5 — participant-authorized only; requires an owned PAID contribution. */
  async confirmFulfilmentReceipt(campaignId: string): Promise<{ confirmed: true }> {
    return apiClient.post(`/api/community-buy/campaigns/${campaignId}/fulfilment/confirm-receipt`, {});
  },

  /** M5 — reuses the existing CommunityBuySupportCase (FULFILMENT_ISSUE) workflow, not a new ticket system. */
  async reportFulfilmentProblem(campaignId: string, description: string, evidenceUrls?: string[]): Promise<SupportCase> {
    const res = await apiClient.post<{ supportCase: SupportCase }>(`/api/community-buy/campaigns/${campaignId}/fulfilment/report-problem`, { description, evidenceUrls });
    return res.supportCase;
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
