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
  config: Record<string, number> | null;
}

// Types the vendor can tune beyond a plain on/off toggle, and the shape of
// their config. Kept in sync with automation.service.ts's CONFIGURABLE_TYPES.
export const CONFIGURABLE_AUTOMATION_TYPES: AutomationType[] = ["CART_RECOVERY", "BUYER_WIN_BACK"];

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

// Human-facing explainer for each vendor-toggleable automation, used
// anywhere a.description (the raw backend message template, containing
// literal {{name}}/{{store_name}}/etc. placeholders meant for interpolation
// at send time, not display) would otherwise leak unresolved to a vendor.
// Only covers VENDOR_AUTOMATION_TYPES — CAMPAIGN_* types never reach vendor
// screens.
export const AUTOMATION_EXPLAINER: Partial<Record<AutomationType, string>> = {
  FIRST_SALE: "Eki guides new stores through completing their store, sharing their store link, creating an introductory offer, and following up with interested buyers — to help your store get its first completed order.",
  CART_RECOVERY: "Eki reminds eligible buyers when they leave foodstuff without completing payment.",
  BUYER_WIN_BACK: "Eki reconnects with buyers who have not ordered recently.",
  REVIEW_REQUEST: "Eki asks buyers to review a completed order.",
  LOW_STOCK_ALERT: "Eki lets you know when your foodstuff is running low so buyers aren't disappointed.",
  BUYER_REFERRAL: "Eki rewards buyers who introduce new customers to your store. A referral qualifies only after the new buyer's first order is paid and completed.",
  PAYMENT_RECOVERY: "Eki follows up when a payment for an order or renewal fails, so you don't lose the sale.",
  RENEWAL_REMINDER: "Eki reminds Regular Delivery subscribers before their next renewal is charged.",
  PRICE_APPROVAL_REMINDER: "Eki reminds buyers when a price change on their Regular Delivery needs their approval.",
};

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

  async setVendorAutomation(type: AutomationType, enabled: boolean, config?: Record<string, number>): Promise<void> {
    await apiClient.patch(`/api/vendor/automations/${type}`, config ? { enabled, config } : { enabled });
  },

  async listVendorActivity(limit = 50): Promise<AutomationRun[]> {
    const res = await apiClient.get<AutomationActivityResponse>(`/api/vendor/automations/activity?limit=${limit}`);
    return res.items ?? [];
  },

  async adminSummary(): Promise<AutomationAdminSummary> {
    return apiClient.get<AutomationAdminSummary>("/api/admin/automation/summary");
  },
};
