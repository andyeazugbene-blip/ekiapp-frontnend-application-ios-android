import { apiClient } from "../api";

export type BroadcastAudience =
  | "all" | "vendors" | "buyers"
  | "active_vendors" | "new_vendors"
  | "individual_vendor" | "individual_buyer"
  | "last_30_days_buyers" | "repeat_buyers" | "inactive_buyers"
  | "first_time_buyers" | "top_customers"
  | "bought_specific_product";
export type BroadcastChannel = "in_app" | "push" | "sms" | "email";

export interface BroadcastPayload {
  title: string;
  body: string;
  audience: BroadcastAudience;
  channels: BroadcastChannel[];
  vendorId?: string;
  buyerId?: string;
  productId?: string;
}

export interface AudienceCountParams {
  audience: BroadcastAudience;
  vendorId?: string;
  buyerId?: string;
  productId?: string;
}

function toBroadcastRequestBody(payload: BroadcastPayload) {
  return {
    subject: payload.title,
    body: payload.body,
    audience: payload.audience,
    channels: payload.channels,
    vendorId: payload.vendorId,
    userId: payload.buyerId,
    productId: payload.productId,
  };
}

export const communicationsAPI = {
  async sendBroadcast(payload: BroadcastPayload): Promise<{ recipients?: number; sent?: number; smsQueued?: number; smsSkipped?: number; emailQueued?: number; emailSkipped?: number; success?: boolean }> {
    return apiClient.post("/admin/broadcasts", toBroadcastRequestBody(payload));
  },

  async getAudienceCount(params: AudienceCountParams): Promise<{ audienceCount: number }> {
    const query = new URLSearchParams();
    query.set("audience", params.audience);
    if (params.vendorId) query.set("vendorId", params.vendorId);
    if (params.buyerId) query.set("userId", params.buyerId);
    if (params.productId) query.set("productId", params.productId);
    return apiClient.get(`/admin/broadcasts/audience-count?${query.toString()}`);
  },

  async testSend(payload: BroadcastPayload): Promise<{ sentTo: string; channels: BroadcastChannel[] }> {
    return apiClient.post("/admin/broadcasts/test-send", toBroadcastRequestBody(payload));
  },
};
