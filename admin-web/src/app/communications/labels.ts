import type { BroadcastAudience, BroadcastChannel, BroadcastStatus, ExclusionReason } from "@/lib/services/communications.api";

export const CHANNEL_LABEL: Record<BroadcastChannel, string> = { in_app: "In-app", push: "Push", email: "Email" };

export const STATUS_LABEL: Record<BroadcastStatus, string> = {
  DRAFT: "Draft",
  SCHEDULED: "Scheduled",
  SENDING: "Sending",
  SENT: "Sent",
  PARTIALLY_DELIVERED: "Partially delivered",
  FAILED: "Failed",
  CANCELLED: "Cancelled",
};

export const STATUS_TONE: Record<BroadcastStatus, "green" | "amber" | "red" | "blue" | "gray"> = {
  DRAFT: "gray", SCHEDULED: "blue", SENDING: "amber", SENT: "green", PARTIALLY_DELIVERED: "amber", FAILED: "red", CANCELLED: "gray",
};

export const REASON_LABEL: Record<ExclusionReason, string> = {
  sender: "You (the sender)",
  suspended: "Suspended account",
  anonymised: "Anonymised account",
  no_marketing_consent: "No marketing consent",
  frequency_capped: "Already received a marketing message in the last 24h",
  automation_conflict: "Received an automated message in the last 24h",
  no_push_token: "No registered device (push token)",
  quiet_hours: "Quiet hours (22:00-07:00 UTC)",
  no_email: "No usable email address",
};

export const AUDIENCE_LABEL: Record<string, string> = {
  all: "All buyers and vendors",
  vendors: "All vendors",
  buyers: "All buyers",
  active_vendors: "Active vendors",
  new_vendors: "New vendors (last 7 days)",
  individual_vendor: "Individual vendor",
  individual_buyer: "Individual buyer",
  individual_user: "Individual person",
  last_30_days_buyers: "Buyers who ordered in the last 30 days",
  repeat_buyers: "Repeat buyers",
  inactive_buyers: "Inactive buyers (no order in 30 days)",
  first_time_buyers: "First-time buyers",
  top_customers: "Top customers (by spend)",
  bought_specific_product: "Bought a specific product",
};

export const ROLE_GROUPS: Array<{ id: BroadcastAudience; title: string; hint: string }> = [
  { id: "all", title: "Everyone", hint: "All buyers and vendors" },
  { id: "buyers", title: "All buyers", hint: "Every buyer account" },
  { id: "vendors", title: "All vendors", hint: "Every vendor account" },
  { id: "active_vendors", title: "Active vendors", hint: "Vendors whose store is not suspended" },
];

export const SEGMENTS: Array<{ id: BroadcastAudience; title: string; hint: string }> = [
  { id: "new_vendors", title: "New vendors", hint: "Joined in the last 7 days" },
  { id: "last_30_days_buyers", title: "Recent buyers", hint: "Ordered in the last 30 days" },
  { id: "repeat_buyers", title: "Repeat buyers", hint: "Two or more orders" },
  { id: "first_time_buyers", title: "First-time buyers", hint: "Exactly one order" },
  { id: "inactive_buyers", title: "Inactive buyers", hint: "No order in the last 30 days" },
  { id: "top_customers", title: "Top customers", hint: "Highest spenders (top 20%, max 25)" },
];

export function sumExcluded(excluded: Partial<Record<ExclusionReason, number>>): number {
  return Object.values(excluded).reduce((a, b) => a + (b ?? 0), 0);
}

export function newKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
