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

export type AutomationCategory = "GROW_SALES" | "CUSTOMER_EXPERIENCE" | "REGULAR_DELIVERY";

export const AUTOMATION_CATEGORY_LABELS: Record<AutomationCategory, string> = {
  GROW_SALES: "Grow sales",
  CUSTOMER_EXPERIENCE: "Customer experience",
  REGULAR_DELIVERY: "Regular Delivery subscriptions",
};

// Client spec's exact category assignment (Automation Centre requirements
// doc, "2. Automation Modules"). Two named modules from that doc — Reorder
// Reminders and Checkout Payment Follow-Up — have no backend implementation
// yet and are intentionally absent from VENDOR_AUTOMATION_TYPES above; do
// not add them here until they exist server-side.
export const AUTOMATION_CATEGORY: Record<AutomationType, AutomationCategory | undefined> = {
  FIRST_SALE: "GROW_SALES",
  CART_RECOVERY: "GROW_SALES",
  BUYER_WIN_BACK: "GROW_SALES",
  BUYER_REFERRAL: "GROW_SALES",
  REVIEW_REQUEST: "CUSTOMER_EXPERIENCE",
  LOW_STOCK_ALERT: "CUSTOMER_EXPERIENCE",
  PAYMENT_RECOVERY: "REGULAR_DELIVERY",
  RENEWAL_REMINDER: "REGULAR_DELIVERY",
  PRICE_APPROVAL_REMINDER: "REGULAR_DELIVERY",
  CAMPAIGN_MILESTONE: undefined,
  CAMPAIGN_DEADLINE: undefined,
  CAMPAIGN_REFUND_UPDATE: undefined,
};

/**
 * The client spec requires these three to display "chevrons only (no
 * toggles)" — they are mandatory operational messages, never optional
 * marketing. This also matches reality: the backend sends
 * PAYMENT_RECOVERY/RENEWAL_REMINDER/PRICE_APPROVAL_REMINDER for Regular
 * Delivery renewals via a direct notification call that does not check the
 * vendor's automation toggle, so a toggle here would be non-functional —
 * showing one at all previously misrepresented vendor control that doesn't
 * exist.
 */
export const MANAGED_BY_EKI_TYPES: AutomationType[] = ["PAYMENT_RECOVERY", "RENEWAL_REMINDER", "PRICE_APPROVAL_REMINDER"];

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
    case "PAYMENT_RECOVERY":
      return "Runs when a payment fails and the order is still unpaid 24 hours later.";
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
