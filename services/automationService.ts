/**
 * Automation Engine service (vendor + admin).
 */
import { apiClient } from "./api";

export type AutomationType =
  | "FIRST_SALE"
  | "CART_RECOVERY"
  | "BUYER_WIN_BACK"
  | "REVIEW_REQUEST"
  | "LOW_STOCK_ALERT"
  | "BUYER_REFERRAL"
  | "PAYMENT_RECOVERY"
  | "RENEWAL_REMINDER"
  | "PRICE_APPROVAL_REMINDER"
  | "CAMPAIGN_MILESTONE"
  | "CAMPAIGN_DEADLINE"
  | "CAMPAIGN_REFUND_UPDATE";

export interface VendorAutomation {
  type: AutomationType;
  enabled: boolean;
  description: string;
}

export interface AutomationRun {
  id: string;
  type: AutomationType;
  vendorId?: string | null;
  recipientUserId: string;
  status: "ELIGIBILITY_CHECK" | "SENT" | "FAILED";
  dedupeKey: string;
  data?: Record<string, unknown>;
  sentAt?: string | null;
  failureReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AutomationAdminSummary {
  byType: { type: AutomationType; count: number }[];
  byStatus: { status: string; count: number }[];
  recentFailures: AutomationRun[];
}

// Automations the vendor can see/toggle from the Automation Center — the
// three campaign-flavored types (CAMPAIGN_*) are buyer-facing and never
// vendor-toggleable, so they're intentionally excluded here.
export const VENDOR_AUTOMATION_TYPES: AutomationType[] = [
  "FIRST_SALE",
  "CART_RECOVERY",
  "BUYER_WIN_BACK",
  "REVIEW_REQUEST",
  "LOW_STOCK_ALERT",
  "BUYER_REFERRAL",
  "PAYMENT_RECOVERY",
  "RENEWAL_REMINDER",
  "PRICE_APPROVAL_REMINDER",
];

export const AUTOMATION_LABELS: Record<AutomationType, string> = {
  FIRST_SALE: "First sale nudge",
  CART_RECOVERY: "Cart recovery",
  BUYER_WIN_BACK: "Buyer win-back",
  REVIEW_REQUEST: "Review request",
  LOW_STOCK_ALERT: "Low stock alert",
  BUYER_REFERRAL: "Buyer referral",
  PAYMENT_RECOVERY: "Payment recovery",
  RENEWAL_REMINDER: "Renewal reminder",
  PRICE_APPROVAL_REMINDER: "Price approval reminder",
  CAMPAIGN_MILESTONE: "Campaign milestone",
  CAMPAIGN_DEADLINE: "Campaign deadline",
  CAMPAIGN_REFUND_UPDATE: "Campaign refund update",
};

interface AutomationListResponse {
  items?: VendorAutomation[];
}

interface AutomationActivityResponse {
  items?: AutomationRun[];
}

export const automationService = {
  async listVendorAutomations(): Promise<VendorAutomation[]> {
    const res = await apiClient.get<AutomationListResponse>("/api/vendor/automations");
    return res.items ?? [];
  },

  async setVendorAutomation(type: AutomationType, enabled: boolean): Promise<void> {
    await apiClient.patch(`/api/vendor/automations/${type}`, { enabled });
  },

  async listVendorActivity(limit = 50): Promise<AutomationRun[]> {
    const res = await apiClient.get<AutomationActivityResponse>(`/api/vendor/automations/activity?limit=${limit}`);
    return res.items ?? [];
  },

  async adminSummary(): Promise<AutomationAdminSummary> {
    return apiClient.get<AutomationAdminSummary>("/api/admin/automation/summary");
  },
};
