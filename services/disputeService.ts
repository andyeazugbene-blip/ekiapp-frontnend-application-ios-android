/**
 * Dispute (buyer/vendor party view) and delivery-proof API client.
 * Shapes mirror ekiapp-backend-main:
 *   src/modules/disputes/{disputes.routes,disputes.controller,dispute-v2.service}.ts
 *   src/modules/orders/delivery-proof.{controller,service}.ts
 * Internal admin notes are never returned to parties by the backend and are not requested here.
 */
import { apiClient } from "./api";

export type DisputeType = "NOT_RECEIVED" | "DAMAGED" | "WRONG_ITEM" | "QUALITY" | "OTHER";
export type DisputeStatus = "OPEN" | "RESOLVED_VENDOR" | "RESOLVED_BUYER" | "RESOLVED_PARTIAL";
export type DisputeAppealStatus = "NONE" | "REQUESTED" | "UPHELD" | "OVERTURNED";
export type DisputeParty = "BUYER" | "VENDOR" | "ADMIN";
export type DisputeEvidenceKind = "PHOTO" | "DOCUMENT" | "TEXT";
export type DeadlineState = "NONE" | "ON_TIME" | "DUE_SOON" | "OVERDUE" | "CLOSED";

export interface DisputeEvidenceItem {
  id: string;
  disputeId: string;
  submittedById: string;
  submitterRole: DisputeParty;
  kind: DisputeEvidenceKind;
  uploadAssetId: string | null;
  text: string | null;
  note: string | null;
  createdAt: string;
  /** Short-lived (about 5 minutes) signed read URL; null for text evidence. */
  url: string | null;
  contentType: string | null;
}

export interface DisputeMessageItem {
  id: string;
  disputeId: string;
  authorId: string;
  authorRole: DisputeParty;
  body: string;
  internal: boolean;
  createdAt: string;
}

export interface DisputeTimelineEntry {
  at: string;
  type: string;
  actorRole?: string;
  text: string;
}

export interface PartyDispute {
  id: string;
  orderId: string;
  reason: string;
  status: DisputeStatus;
  type: DisputeType;
  claim: string | null;
  respondByAt: string | null;
  resolution: string | null;
  decisionReason: string | null;
  resolvedAt: string | null;
  /** Minor units (pence/kobo). */
  refundAmount: number | null;
  appealStatus: DisputeAppealStatus;
  appealReason: string | null;
  appealRequestedAt: string | null;
  appealDecidedAt: string | null;
  appealDecisionReason: string | null;
  evidenceRequestedAt: string | null;
  evidenceRequestedFrom: string | null;
  createdAt: string;
  yourRole: "BUYER" | "VENDOR";
  deadline: { state: DeadlineState; respondByAt: string | null; msRemaining: number | null };
  appeal: { canAppeal: boolean; appealWindowEndsAt: string | null; allowedParties: DisputeParty[] };
  evidence: DisputeEvidenceItem[];
  messages: DisputeMessageItem[];
  timeline: DisputeTimelineEntry[];
}

export type AddEvidenceInput =
  | { kind: "TEXT"; text: string; note?: string }
  | { kind: "PHOTO" | "DOCUMENT"; uploadAssetId: string; note?: string };

export type DeliveryProofKind = "DELIVERY_PHOTO" | "PICKUP_CONFIRMATION" | "SIGNATURE" | "NOTE";

export interface DeliveryProofItem {
  id: string;
  orderId: string;
  kind: DeliveryProofKind;
  uploadAssetId: string | null;
  note: string | null;
  submittedById: string;
  submitterRole: "VENDOR" | "COURIER" | "ADMIN";
  createdAt: string;
  url: string | null;
  contentType: string | null;
}

export type AddDeliveryProofInput =
  | { kind: "NOTE"; note: string }
  | { kind: "DELIVERY_PHOTO" | "SIGNATURE" | "PICKUP_CONFIRMATION"; uploadAssetId?: string; note?: string };

const enc = encodeURIComponent;

export const disputeService = {
  async getById(disputeId: string): Promise<PartyDispute> {
    const res = await apiClient.get<{ dispute: PartyDispute }>(`/api/disputes/${enc(disputeId)}`);
    return res.dispute;
  },

  /** 404 when no dispute exists for the order (or the caller is not a party). */
  async getByOrder(orderId: string): Promise<PartyDispute> {
    const res = await apiClient.get<{ dispute: PartyDispute }>(`/api/disputes/order/${enc(orderId)}`);
    return res.dispute;
  },

  async addEvidence(disputeId: string, input: AddEvidenceInput): Promise<DisputeEvidenceItem> {
    const res = await apiClient.post<{ evidence: DisputeEvidenceItem }>(`/api/disputes/${enc(disputeId)}/evidence`, input);
    return res.evidence;
  },

  async addMessage(disputeId: string, body: string): Promise<DisputeMessageItem> {
    const res = await apiClient.post<{ message: DisputeMessageItem }>(`/api/disputes/${enc(disputeId)}/messages`, { body });
    return res.message;
  },

  async requestAppeal(disputeId: string, reason: string): Promise<{ appealStatus: "REQUESTED" }> {
    return apiClient.post<{ appealStatus: "REQUESTED" }>(`/api/disputes/${enc(disputeId)}/appeal`, { reason });
  },

  // Delivery proof -----------------------------------------------------------

  async addDeliveryProofAsVendor(orderId: string, input: AddDeliveryProofInput): Promise<DeliveryProofItem> {
    const res = await apiClient.post<{ evidence: DeliveryProofItem }>(`/api/vendors/me/orders/${enc(orderId)}/delivery-proof`, input);
    return res.evidence;
  },

  async listDeliveryProofAsVendor(orderId: string): Promise<DeliveryProofItem[]> {
    const res = await apiClient.get<{ items: DeliveryProofItem[] }>(`/api/vendors/me/orders/${enc(orderId)}/delivery-proof`);
    return res.items ?? [];
  },

  async listDeliveryProofAsBuyer(orderId: string): Promise<DeliveryProofItem[]> {
    const res = await apiClient.get<{ items: DeliveryProofItem[] }>(`/api/orders/${enc(orderId)}/delivery-proof`);
    return res.items ?? [];
  },
};
