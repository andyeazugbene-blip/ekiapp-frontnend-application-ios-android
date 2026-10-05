"use client";

import { Badge } from "@/components/AdminUI";
import type { SubscriptionRow } from "@/lib/services/regularDeliveries.api";

export const FREQUENCY_LABEL: Record<string, string> = {
  WEEKLY: "Weekly",
  BIWEEKLY: "Every 2 weeks",
  EVERY_4_WEEKS: "Every 4 weeks",
  MONTHLY: "Monthly",
};

export function statusBadge(s: Pick<SubscriptionRow, "status" | "pausedReason">) {
  switch (s.status) {
    case "ACTIVE": return <Badge tone="green">Active</Badge>;
    case "PAUSED": return <Badge tone={s.pausedReason === "payment_failed" ? "red" : "amber"}>{s.pausedReason === "payment_failed" ? "Paused: payment failed" : "Paused"}</Badge>;
    case "PAYMENT_ATTENTION": return <Badge tone="red">Payment needs attention</Badge>;
    case "CANCELLED": return <Badge tone="gray">Cancelled</Badge>;
    default: return <Badge tone="gray">{s.status.toLowerCase()}</Badge>;
  }
}

export function paymentBadge(state: SubscriptionRow["paymentState"]) {
  switch (state) {
    case "paid": return <Badge tone="green">Paid</Badge>;
    case "failed": return <Badge tone="red">Failed</Badge>;
    case "processing": return <Badge tone="blue">Processing</Badge>;
    case "ready": return <Badge tone="blue">Ready to charge</Badge>;
    case "cancelled": return <Badge tone="gray">Cycle cancelled</Badge>;
    case "pending": return <Badge tone="amber">Awaiting vendor or buyer</Badge>;
    default: return <span className="text-xs font-semibold text-slate-400">No cycle yet</span>;
  }
}
