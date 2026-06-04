import { apiClient } from "../api";

export type BroadcastAudience = "all" | "vendors" | "buyers" | "active_vendors" | "new_vendors" | "individual_vendor" | "individual_buyer";
export type BroadcastChannel = "in_app" | "push" | "in_app_push";

export interface BroadcastPayload {
  title: string;
  body: string;
  audience: BroadcastAudience;
  channels: BroadcastChannel[];
  vendorId?: string;
  buyerId?: string;
}

export const communicationsAPI = {
  async sendBroadcast(payload: BroadcastPayload): Promise<{ recipients?: number; success?: boolean }> {
    const channel = payload.channels.includes("in_app") && payload.channels.includes("push")
      ? "in_app_push"
      : payload.channels.includes("push")
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
