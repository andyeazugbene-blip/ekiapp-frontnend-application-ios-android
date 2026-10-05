/**
 * Pure helpers for dispute / delivery-proof screens (no React Native imports so
 * they stay trivially testable). Contracts mirror
 * ekiapp-backend-main/src/modules/disputes/dispute-v2.service.ts.
 */
import type {
  DeadlineState,
  DisputeParty,
  DisputeStatus,
  DisputeType,
  PartyDispute,
} from "../services/disputeService";

export const DISPUTE_TYPE_LABEL: Record<DisputeType, string> = {
  NOT_RECEIVED: "Order not received",
  DAMAGED: "Damaged item",
  WRONG_ITEM: "Wrong item",
  QUALITY: "Quality issue",
  OTHER: "Other issue",
};

export const DISPUTE_STATUS_LABEL: Record<DisputeStatus, string> = {
  OPEN: "Open - under review",
  RESOLVED_VENDOR: "Resolved in the seller's favour",
  RESOLVED_BUYER: "Resolved in the buyer's favour",
  RESOLVED_PARTIAL: "Resolved with a partial outcome",
};

export function disputeTypeLabel(type?: string | null): string {
  return (type && DISPUTE_TYPE_LABEL[type as DisputeType]) || "Other issue";
}

export function disputeStatusLabel(status?: string | null): string {
  return (status && DISPUTE_STATUS_LABEL[status as DisputeStatus]) || "Under review";
}

/** Backend accepts new evidence/messages while OPEN or while an appeal is being reviewed. */
export function canAddToDispute(d: Pick<PartyDispute, "status" | "appealStatus">): boolean {
  return d.status === "OPEN" || d.appealStatus === "REQUESTED";
}

/** The appeal button is shown only when the backend says the window is open AND this user's side may appeal. */
export function canShowAppeal(d: Pick<PartyDispute, "appeal" | "yourRole">): boolean {
  return Boolean(d.appeal?.canAppeal) && (d.appeal?.allowedParties ?? []).includes(d.yourRole);
}

export function deadlineCopy(deadline: { state: DeadlineState; respondByAt: string | null } | undefined): string | null {
  if (!deadline || !deadline.respondByAt) return null;
  const due = new Date(deadline.respondByAt);
  if (Number.isNaN(due.getTime())) return null;
  switch (deadline.state) {
    case "ON_TIME":
      return `Response due by ${due.toLocaleString()}`;
    case "DUE_SOON":
      return `Response due soon - by ${due.toLocaleString()}`;
    case "OVERDUE":
      return `The response deadline passed on ${due.toLocaleString()}`;
    default:
      return null;
  }
}

export function partyLabel(role: DisputeParty | string, yourRole: DisputeParty, names: { buyer?: string; vendor?: string } = {}): string {
  if (role === yourRole) return "You";
  if (role === "ADMIN") return "Eki support";
  if (role === "BUYER") return names.buyer || "Buyer";
  if (role === "VENDOR") return names.vendor || "Seller";
  return "Participant";
}

export type FailureKind = "offline" | "not_found" | "forbidden" | "auth" | "conflict" | "other";

export interface ClassifiedFailure {
  kind: FailureKind;
  message: string;
  status?: number;
}

/** Maps API / network errors to a screen state. 404 is deliberately friendly: the backend returns 404 for non-parties. */
export function classifyFailure(err: unknown, notFoundMessage = "We could not find this."): ClassifiedFailure {
  const name = (err as { name?: string } | null)?.name;
  const status = (err as { status?: number } | null)?.status;
  const message = err instanceof Error ? err.message : "Something went wrong. Please try again.";
  if (name === "NetworkError") {
    return { kind: "offline", message: "You appear to be offline or the server could not be reached. Check your connection and try again." };
  }
  if (name === "ApiRequestError") {
    if (status === 404) return { kind: "not_found", message: notFoundMessage, status };
    if (status === 403) return { kind: "forbidden", message: "You do not have access to this.", status };
    if (status === 401) return { kind: "auth", message, status };
    if (status === 409) return { kind: "conflict", message, status };
  }
  return { kind: "other", message, status };
}

/** Delivery proof can only be added once the order has been dispatched (backend DELIVERY_PROOF_ORDER_STATUSES). */
export const DELIVERY_PROOF_STATUSES = ["dispatched", "in_transit", "delivered"] as const;
export function canAddDeliveryProof(status?: string | null): boolean {
  return Boolean(status) && (DELIVERY_PROOF_STATUSES as readonly string[]).includes(String(status));
}

export const DISPUTE_EVIDENCE_MAX_BYTES = 10 * 1024 * 1024;
export const DELIVERY_PROOF_MAX_BYTES = 5 * 1024 * 1024;

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
