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
  | "REORDER_REMINDER"
  | "CHECKOUT_PAYMENT_FOLLOW_UP"
  | "PAYMENT_RECOVERY"
  | "RENEWAL_REMINDER"
  | "PRICE_APPROVAL_REMINDER"
  | "CAMPAIGN_MILESTONE"
  | "CAMPAIGN_DEADLINE"
  | "CAMPAIGN_REFUND_UPDATE";

export interface VendorAutomation {
  type: AutomationType;
  managedByEki?: boolean;
  enabled?: boolean;
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
  recipient?: { name: string | null; email: string } | null;
  status: "QUEUED" | "ELIGIBILITY_CHECK" | "SCHEDULED" | "SENT" | "SUPPRESSED" | "FAILED" | "CANCELLED";
  dedupeKey: string;
  data?: Record<string, unknown>;
  sentAt?: string | null;
  failureReason?: string | null;
  suppressedReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AutomationAdminSummary {
  byType: { type: AutomationType; count: number }[];
  byStatus: { status: string; count: number }[];
  recentFailures: AutomationRun[];
}

// Final Client Decision 4: The 8 vendor-controlled automations
// (vendor can enable/disable these from the Automation Centre).
export const VENDOR_AUTOMATION_TYPES: AutomationType[] = [
  "FIRST_SALE",
  "CART_RECOVERY",
  "BUYER_WIN_BACK",
  "REORDER_REMINDER",
  "CHECKOUT_PAYMENT_FOLLOW_UP",
  "BUYER_REFERRAL",
  "REVIEW_REQUEST",
  "LOW_STOCK_ALERT",
];

// Final Client Decision 4 — categories for the Automation Centre display.
// 4 categories: Sales & Conversion, Customer Engagement, Store & Operations, Managed by Eki.
export type AutomationCategory = "SALES_CONVERSION" | "CUSTOMER_ENGAGEMENT" | "STORE_OPERATIONS" | "MANAGED_BY_EKI";

export const AUTOMATION_CATEGORY_LABELS: Record<AutomationCategory, string> = {
  SALES_CONVERSION: "Sales & conversion",
  CUSTOMER_ENGAGEMENT: "Customer engagement",
  STORE_OPERATIONS: "Store & operations",
  MANAGED_BY_EKI: "Managed by Eki",
};

// Client spec's exact category assignment (Final Client Decision 4).
export const AUTOMATION_CATEGORY: Record<AutomationType, AutomationCategory | undefined> = {
  FIRST_SALE: "SALES_CONVERSION",
  CART_RECOVERY: "SALES_CONVERSION",
  CHECKOUT_PAYMENT_FOLLOW_UP: "SALES_CONVERSION",
  BUYER_WIN_BACK: "CUSTOMER_ENGAGEMENT",
  BUYER_REFERRAL: "CUSTOMER_ENGAGEMENT",
  REVIEW_REQUEST: "CUSTOMER_ENGAGEMENT",
  REORDER_REMINDER: "CUSTOMER_ENGAGEMENT",
  LOW_STOCK_ALERT: "STORE_OPERATIONS",
  PAYMENT_RECOVERY: "MANAGED_BY_EKI",
  RENEWAL_REMINDER: "MANAGED_BY_EKI",
  PRICE_APPROVAL_REMINDER: "MANAGED_BY_EKI",
  CAMPAIGN_MILESTONE: undefined,
  CAMPAIGN_DEADLINE: undefined,
  CAMPAIGN_REFUND_UPDATE: undefined,
};

/**
 * The three Eki-managed types are shown in the Automation Centre with a
 * "Managed by Eki" badge. No toggle is exposed — the backend rejects any
 * vendor attempt to toggle these types.
 */
export const MANAGED_BY_EKI_TYPES: AutomationType[] = ["PAYMENT_RECOVERY", "RENEWAL_REMINDER", "PRICE_APPROVAL_REMINDER"];

// Human-facing explainer for each automation, used anywhere the raw backend
// message template (with {{name}}/{{store_name}} placeholders) would leak.
// Covers all 11 automation modules (8 vendor-controlled + 3 Eki-managed).
export const AUTOMATION_EXPLAINER: Partial<Record<AutomationType, string>> = {
  FIRST_SALE: "Eki guides new stores through completing their store, sharing their store link, creating an introductory offer, and following up with interested buyers — to help your store get its first completed order.",
  CART_RECOVERY: "Eki reminds eligible buyers when they leave foodstuff without completing payment.",
  BUYER_WIN_BACK: "Eki reconnects with buyers who have not ordered recently.",
  REORDER_REMINDER: "Eki reminds buyers who received a delivery to consider reordering when their product is still available — sent once per delivered order, only when the product is in stock.",
  CHECKOUT_PAYMENT_FOLLOW_UP: "Eki follows up with buyers when a checkout payment was not completed. A payment status check runs immediately before sending — if the payment has since gone through, no message is sent.",
  REVIEW_REQUEST: "Eki asks buyers to review a completed order.",
  LOW_STOCK_ALERT: "Eki lets you know when your foodstuff is running low so buyers aren't disappointed.",
  BUYER_REFERRAL: "Eki rewards buyers who introduce new customers to your store. A referral qualifies only after the new buyer's first order is paid and completed.",
  PAYMENT_RECOVERY: "Eki follows up when a Regular Delivery renewal payment fails, so subscribers don't lose their delivery.",
  RENEWAL_REMINDER: "Eki reminds Regular Delivery subscribers before their next renewal is charged.",
  PRICE_APPROVAL_REMINDER: "Eki reminds buyers when a price change on their Regular Delivery needs their approval.",
};

/**
 * AUTO-05 fix: only a one-sentence purpose blurb (AUTOMATION_EXPLAINER)
 * existed before — the real mechanism/thresholds each detector actually
 * uses (automation.detectors.ts, backend) were never surfaced, so a vendor
 * had no way to predict when or why a run would fire. Every value here is
 * the real one the backend enforces today, not an approximation — for the
 * 2 vendor-configurable types, pass the vendor's current config so the
 * text reflects what they've actually set, not just the system default.
 */
export function getAutomationEligibilityDetail(type: AutomationType, config?: Record<string, number> | null): string | undefined {
  switch (type) {
    case "FIRST_SALE":
      return "Runs weekly for a verified store with at least one active product and zero completed sales so far.";
    case "CART_RECOVERY": {
      const hours = config?.reminderHours ?? 2;
      return `Runs once an item has sat in a buyer's cart for at least ${hours} hour${hours === 1 ? "" : "s"} without checkout.`;
    }
    case "BUYER_WIN_BACK": {
      const days = config?.inactivityDays ?? 45;
      return `Runs for a buyer who has ordered from you before but not again in the last ${days} days.`;
    }
    case "REVIEW_REQUEST":
      return "Runs for an order delivered between 1 and 14 days ago that the buyer hasn't reviewed yet.";
    case "LOW_STOCK_ALERT":
      return "Runs when an active product's stock falls to 5 units or fewer.";
    case "BUYER_REFERRAL":
      return "Runs once the referred buyer's account is at least 3 days old and their first order has been paid and completed.";
    case "REORDER_REMINDER":
      return "Runs 1–14 days after a delivery for each product the buyer hasn't already reordered, while that product is still active and in stock.";
    case "CHECKOUT_PAYMENT_FOLLOW_UP":
      return "Runs for a checkout that has been pending for 2–48 hours. A live payment status check runs immediately before sending — no message is sent if the checkout has since succeeded.";
    case "PAYMENT_RECOVERY":
      return "Runs when a Regular Delivery renewal payment fails and the renewal is still unpaid.";
    case "RENEWAL_REMINDER":
      return "Runs 1–3 days before a Regular Delivery subscriber's next renewal charge.";
    case "PRICE_APPROVAL_REMINDER":
      return "Runs when a renewal's price increase exceeds the buyer's approval limit and needs their decision.";
    default:
      return undefined;
  }
}

export const AUTOMATION_LABELS: Record<AutomationType, string> = {
  FIRST_SALE: "First sale nudge",
  CART_RECOVERY: "Cart recovery",
  BUYER_WIN_BACK: "Buyer win-back",
  REVIEW_REQUEST: "Review request",
  LOW_STOCK_ALERT: "Low stock alert",
  BUYER_REFERRAL: "Buyer referral",
  REORDER_REMINDER: "Reorder reminder",
  CHECKOUT_PAYMENT_FOLLOW_UP: "Checkout payment follow-up",
  PAYMENT_RECOVERY: "Payment recovery",
  RENEWAL_REMINDER: "Renewal reminder",
  PRICE_APPROVAL_REMINDER: "Price approval reminder",
  CAMPAIGN_MILESTONE: "Campaign milestone",
  CAMPAIGN_DEADLINE: "Campaign deadline",
  CAMPAIGN_REFUND_UPDATE: "Campaign refund update",
};

/**
 * Central status-presentation mapping for AutomationRun — every screen
 * showing a run's status must read from here, never derive its own label
 * via a ternary chain (that's how SUPPRESSED silently fell through as
 * "Checking eligibility" for every vendor before this existed).
 */
export const AUTOMATION_RUN_STATUS_LABELS: Record<AutomationRun["status"], string> = {
  QUEUED: "Checking eligibility",
  ELIGIBILITY_CHECK: "Checking eligibility",
  SCHEDULED: "Scheduled",
  SENT: "Sent",
  SUPPRESSED: "Not sent",
  FAILED: "Failed",
  CANCELLED: "Cancelled",
};

export const AUTOMATION_RUN_STATUS_TONE: Record<AutomationRun["status"], "success" | "warning" | "error" | "info" | "neutral"> = {
  QUEUED: "neutral",
  ELIGIBILITY_CHECK: "neutral",
  SCHEDULED: "neutral",
  SENT: "success",
  SUPPRESSED: "warning",
  FAILED: "error",
  CANCELLED: "neutral",
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
