import { apiClient } from "../api";

/**
 * Orders / payments / refunds admin API (handbook §5.2, §11, §14.8).
 * Amounts stay in MINOR units and in each record's ORIGINAL currency; the UI
 * formats them with formatMinor(). Nothing here converts or invents values.
 */

export interface WebhookReceipt {
  id: string; stripeEventId: string; eventType: string; status: string; createdAt: string; processedAt: string | null;
}

export interface PaymentSummary {
  id: string;
  status: "PENDING" | "SUCCEEDED" | "FAILED";
  provider: string;
  amount: number;
  currency: string;
  stripePaymentIntentId: string | null;
  providerStatus: string | null;
  paymentMethodType: string | null;
  failureCode: string | null;
  failureMessage: string | null;
  processedAt: string | null;
  /** Null unless money was actually collected (SUCCEEDED). */
  platformFeeAmount: number | null;
  vendorEarningsAmount: number | null;
  moneyCollected: boolean;
  commissionBps?: number | null;
  sellerPlanSlug?: string | null;
}

export interface PaymentRow extends PaymentSummary {
  orderId: string;
  createdAt: string;
  vendorName: string | null;
  order: {
    id: string; orderNumber: string; status: string; totalAmount: number; currency: string;
    buyer: { name: string; email: string } | null;
  } | null;
}

export interface RefundRow {
  id: string; orderId: string; amountMinor: number; currency: string;
  status: "REQUESTED" | "PROCESSING" | "COMPLETED" | "FAILED";
  provider: string; providerRefundId: string | null; reason: string; failureReason: string | null; createdAt: string;
}

export interface PaymentDetail extends PaymentRow {
  webhookEvents: WebhookReceipt[];
  refunds: RefundRow[];
  stripeLivemode: boolean;
}

export interface OrderRow {
  id: string; orderNumber: string; status: string; totalAmount: number; currency: string; createdAt: string;
  vendorId: string | null; vendorName: string | null; buyerId: string;
  buyer: { id: string; name: string; email: string } | null;
  payment: PaymentSummary | null;
  items: Array<{ id: string; productTitle: string | null; quantity: number }>;
}

export interface OrderDetail extends OrderRow {
  subtotalAmount: number | null;
  deliveryFeeAmount: number | null;
  platformFeeAmount: number | null;
  vendorEarnings: number | null;
  deliveryAddress: string | null;
  deliveryZone: { name: string; country: string } | null;
  vendorInfo: { storeName: string; contactEmail: string | null } | null;
  items: Array<{ id: string; productTitle: string | null; quantity: number; unitAmount: number; totalAmount: number }>;
  refunds: RefundRow[];
  dispute: { id: string; status: string; reason: string; createdAt: string } | null;
  payoutRequests: Array<{ id: string; status: string; amount: number; currency: string; createdAt: string }>;
  webhookEvents: WebhookReceipt[];
  stripeLivemode: boolean;
  deliveryProof?: Array<{
    id: string; kind: "DELIVERY_PHOTO" | "PICKUP_CONFIRMATION" | "SIGNATURE" | "NOTE"; note: string | null;
    submitterRole: string; createdAt: string; url: string | null; contentType: string | null;
  }>;
}

export interface PageResult<T> { items: T[]; nextCursor: string | null; total: number }

function qs(params: Record<string, string | number | boolean | null | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "" || v === false) continue;
    p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}

export const moneyAPI = {
  async listPayments(f: { q?: string; status?: string; provider?: string; vendorId?: string; from?: string; to?: string; includeTest?: boolean; cursor?: string | null; limit?: number }): Promise<PageResult<PaymentRow>> {
    return apiClient.get(`/admin/payments${qs({ ...f, limit: f.limit ?? 20 })}`, { bypassCache: true });
  },
  async getPayment(id: string): Promise<PaymentDetail> {
    const res = await apiClient.get<any>(`/admin/payments/${id}`, { bypassCache: true });
    return res.payment ?? res;
  },
  async listOrders(f: { q?: string; status?: string; vendorId?: string; buyerId?: string; includeTest?: boolean; cursor?: string | null; limit?: number }): Promise<PageResult<OrderRow>> {
    return apiClient.get(`/admin/orders${qs({ ...f, limit: f.limit ?? 20 })}`, { bypassCache: true });
  },
  async getOrder(id: string): Promise<OrderDetail> {
    const res = await apiClient.get<any>(`/admin/orders/${id}`, { bypassCache: true });
    return res.order ?? res;
  },
  /** amountMinor undefined = refund whatever is still refundable. */
  async refundOrder(orderId: string, body: { amountMinor?: number; reason: string; idempotencyKey: string }, twoFactorCode?: string) {
    return apiClient.post<{ pendingApproval?: unknown; message?: string; refundId?: string; amount?: number; currency?: string; status?: string; provider?: string }>(
      `/admin/orders/${orderId}/refund`,
      { amount: body.amountMinor, reason: body.reason, idempotencyKey: body.idempotencyKey },
      { twoFactorCode },
    );
  },
  async forceProcess(orderId: string, reason: string, twoFactorCode?: string) {
    return apiClient.post(`/admin/orders/${orderId}/force-process`, { reason }, { twoFactorCode });
  },
};

export const ORDER_STATUSES = [
  "PENDING", "PAID", "CONFIRMED", "PROCESSING", "DISPATCHED", "IN_TRANSIT", "DELIVERED", "COMPLETED",
  "CANCELLED", "REFUNDED", "FAILED", "PAYMENT_SECURED", "VENDOR_CONFIRMED", "DISPUTED", "AUTO_RELEASED",
] as const;

export function orderStatusLabel(status: string): string {
  const s = status.toUpperCase();
  const map: Record<string, string> = {
    PENDING: "Awaiting payment", PAID: "Paid", CONFIRMED: "Accepted by vendor", PROCESSING: "Being prepared",
    DISPATCHED: "Dispatched", IN_TRANSIT: "In transit", DELIVERED: "Delivered", COMPLETED: "Completed",
    CANCELLED: "Cancelled", REFUNDED: "Refunded", FAILED: "Payment failed", PAYMENT_SECURED: "Payment secured",
    VENDOR_CONFIRMED: "Vendor confirmed", DISPUTED: "Disputed", AUTO_RELEASED: "Auto-released",
  };
  return map[s] ?? s.replace(/_/g, " ").toLowerCase();
}

export function orderStatusTone(status: string): "green" | "amber" | "red" | "blue" | "gray" {
  const s = status.toUpperCase();
  if (["COMPLETED", "DELIVERED", "AUTO_RELEASED"].includes(s)) return "green";
  if (["FAILED", "CANCELLED", "DISPUTED"].includes(s)) return "red";
  if (["PENDING"].includes(s)) return "amber";
  if (["REFUNDED"].includes(s)) return "gray";
  return "blue";
}

export function paymentStatusTone(status: string): "green" | "amber" | "red" {
  return status === "SUCCEEDED" ? "green" : status === "FAILED" ? "red" : "amber";
}

/** Safe, human copy for Stripe failure codes (never shows raw provider payloads). */
export function failureCopy(code: string | null, message: string | null): { title: string; hint: string } {
  const c = (code ?? "").toLowerCase();
  const table: Record<string, { title: string; hint: string }> = {
    insufficient_funds: { title: "Insufficient funds", hint: "The buyer can retry with another card or smaller basket." },
    card_declined: { title: "Card declined by the issuer", hint: "Ask the buyer to try another payment method." },
    generic_decline: { title: "Card declined by the issuer", hint: "Ask the buyer to try another payment method." },
    expired_card: { title: "Card expired", hint: "The buyer needs to use a different card." },
    incorrect_cvc: { title: "Security code (CVC) incorrect", hint: "The buyer can re-enter their card details." },
    authentication_required: { title: "Bank authentication was not completed", hint: "The buyer can retry and complete the 3-D Secure check." },
    canceled: { title: "Payment was canceled", hint: "No action needed unless the buyer wants to try again." },
  };
  if (table[c]) return table[c];
  return { title: message ? "Payment failed" : "Payment failed (reason not recorded)", hint: message ?? "Open the payment in Stripe for the full reason." };
}

// ─── Disputes (Handbook 11 L455) ────────────────────────────────────────────

export type DisputeStatus = "OPEN" | "RESOLVED_VENDOR" | "RESOLVED_BUYER" | "RESOLVED_PARTIAL";

export interface DisputeRow {
  id: string; orderId: string; status: DisputeStatus; reason: string; createdAt: string;
  resolution: string | null; fraudulent: boolean; refundAmount: number | null; resolvedAt: string | null;
  buyerName: string | null; buyerEmail: string | null; vendorName: string | null;
  order: { orderNumber: string; totalAmount: number; currency: string } | null;
}

export interface DisputeCaseEvidence {
  id: string; submitterRole: "BUYER" | "VENDOR" | "ADMIN"; kind: "PHOTO" | "DOCUMENT" | "TEXT";
  text: string | null; note: string | null; createdAt: string; url: string | null; contentType: string | null;
}
export interface DisputeCaseMessage { id: string; authorRole: "BUYER" | "VENDOR" | "ADMIN"; body: string; internal: boolean; createdAt: string }
export interface DisputeCaseFields {
  type?: string; claim?: string | null; respondByAt?: string | null; decisionReason?: string | null;
  appealStatus?: "NONE" | "REQUESTED" | "UPHELD" | "OVERTURNED"; appealReason?: string | null; appealDecisionReason?: string | null;
  evidenceRequestedAt?: string | null; evidenceRequestedFrom?: string | null;
  deadline?: { state: "NONE" | "ON_TIME" | "DUE_SOON" | "OVERDUE" | "CLOSED"; respondByAt: string | null; msRemaining: number | null };
  appeal?: { canAppeal: boolean; appealWindowEndsAt: string | null; allowedParties: string[] };
  evidence?: DisputeCaseEvidence[]; messages?: DisputeCaseMessage[];
  timeline?: Array<{ at: string; type: string; actorRole?: string; text: string; internal?: boolean }>;
}

export interface DisputeDetail extends Omit<DisputeRow, "order">, DisputeCaseFields {
  buyerId: string; vendorId: string;
  buyer: { id: string; name: string; email: string } | null;
  vendor: { id: string; storeName: string } | null;
  order: {
    id: string; orderNumber: string; totalAmount: number; currency: string; deliveryAddress: string | null; createdAt: string;
    items: Array<{ productTitle: string | null; quantity: number; totalAmount: number }>;
  } | null;
}

export const disputeStatusLabel: Record<DisputeStatus, string> = {
  OPEN: "Open - needs a decision",
  RESOLVED_BUYER: "Resolved - buyer refunded",
  RESOLVED_VENDOR: "Resolved - released to vendor",
  RESOLVED_PARTIAL: "Resolved - partial refund",
};

export const disputesAPI2 = {
  async list(f: { q?: string; status?: string; vendorId?: string; cursor?: string | null; limit?: number }): Promise<PageResult<DisputeRow>> {
    return apiClient.get(`/admin/disputes${qs({ ...f, limit: f.limit ?? 20 })}`, { bypassCache: true });
  },
  async get(id: string): Promise<DisputeDetail> {
    const res = await apiClient.get<any>(`/admin/disputes/${id}`, { bypassCache: true });
    return res.dispute ?? res;
  },
  async postMessage(id: string, body: string, internal: boolean) {
    return apiClient.post(`/admin/disputes/${id}/messages`, { body, internal });
  },
  async requestEvidence(id: string, from: "BUYER" | "VENDOR", reason: string) {
    return apiClient.post(`/admin/disputes/${id}/request-evidence`, { from, reason });
  },
  async decideAppeal(id: string, decision: "UPHELD" | "OVERTURNED", reason: string, twoFactorCode?: string) {
    return apiClient.post(`/admin/disputes/${id}/appeal-decision`, { decision, reason }, { twoFactorCode });
  },
  async resolve(id: string, body: { resolution: "buyer" | "vendor" | "partial"; note: string; refundAmountMinor?: number; fraudulent?: boolean }, twoFactorCode?: string) {
    return apiClient.patch(`/admin/disputes/${id}/resolve`, {
      resolution: body.resolution, note: body.note, refundAmount: body.refundAmountMinor, fraudulent: body.fraudulent ?? false,
    }, { twoFactorCode });
  },
};
