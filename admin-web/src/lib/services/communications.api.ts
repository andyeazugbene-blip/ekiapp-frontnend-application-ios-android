import { apiClient } from "../api";

export type BroadcastAudience = "all" | "vendors" | "buyers" | "active_vendors" | "new_vendors" | "individual_vendor" | "individual_buyer";
export type BroadcastChannel = "in_app" | "push" | "sms";

export interface BroadcastPayload {
  title: string;
  body: string;
  audience: BroadcastAudience;
  channels: BroadcastChannel[];
  vendorId?: string;
  buyerId?: string;
}

export const communicationsAPI = {
  async sendBroadcast(payload: BroadcastPayload): Promise<{ recipients?: number; sent?: number; smsQueued?: number; smsSkipped?: number; success?: boolean }> {
    const hasInApp = payload.channels.includes("in_app");
    const hasPush = payload.channels.includes("push");
    const hasSms = payload.channels.includes("sms");
    const channel = hasInApp && hasPush && hasSms
      ? "in_app_push_sms"
      : hasInApp && hasPush
        ? "in_app_push"
        : hasInApp && hasSms
          ? "in_app_sms"
          : hasSms
            ? "sms"
            : hasPush
              ? "push"
              : "in_app";

    return apiClient.post("/admin/broadcasts", {
      subject: payload.title,
      body: payload.body,
      audience: payload.audience,
      channel,
      vendorId: payload.vendorId,
      userId: payload.buyerId,
    });
  },
};
