import { apiClient } from "../api";

export interface StripeDispute {
  id: string;
  stripeDisputeId: string;
  paymentIntentId: string | null;
  checkoutId: string | null;
  buyerId: string | null;
  amount: number;
  currency: string;
  reason: string;
  status: string;
  note: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

/**
 * Real Stripe chargebacks (architecture doc §15.3 "Chargebacks") — distinct
 * from the buyer/vendor Dispute model under /admin/disputes. The chargeback
 * itself is still won/lost in the Stripe Dashboard directly; this only
 * tracks that one exists and lets an admin mark it reviewed.
 */
export const stripeDisputesAPI = {
  async list(status?: string): Promise<StripeDispute[]> {
    const query = status ? `?status=${encodeURIComponent(status)}` : "";
    const res = await apiClient.get<{ items: StripeDispute[] }>(`/admin/stripe-disputes${query}`);
    return res.items ?? [];
  },

  async markReviewed(id: string, note: string): Promise<StripeDispute> {
    const res = await apiClient.patch<{ dispute: StripeDispute }>(`/admin/stripe-disputes/${id}/review`, { note });
    return res.dispute;
  },
};
