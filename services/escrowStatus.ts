import type { EscrowStatus, Order } from "../types/order";

export interface EscrowTimelineStep {
  key: "paid" | "vendor_accepted" | "shipped" | "delivered" | "released";
  label: string;
  caption: string;
  done: boolean;
  current: boolean;
}

function upper(value?: string | null): string {
  return typeof value === "string" ? value.toUpperCase() : "";
}

function toEscrowType(value?: string | null): "NONE" | "DOMESTIC_AFRICA" {
  return upper(value) === "DOMESTIC_AFRICA" ? "DOMESTIC_AFRICA" : "NONE";
}

function formatMoment(value?: string | null): string {
  if (!value) return "Pending";
  try {
    return new Date(value).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

function statusSet(order?: Partial<Order> | null): Set<string> {
  const statuses = new Set<string>();
  if (!order) return statuses;

  const raw = upper(order.backendStatus);
  const ui = upper(order.status);
  const dispute = upper(order.dispute?.status);

  if (raw) statuses.add(raw);
  if (ui) statuses.add(ui);
  if (dispute) statuses.add(dispute);
  if (order.disputedAt) statuses.add("DISPUTED");
  if (order.deliveredAt) statuses.add("DELIVERED");
  if (order.autoReleasedAt) statuses.add("AUTO_RELEASED");

  return statuses;
}

export function deriveEscrowStatus(order?: Partial<Order> | null): EscrowStatus {
  if (!order) return "UNKNOWN";

  const statuses = statusSet(order);
  const escrowType = toEscrowType(order.escrowType);
  const paymentStatus = upper(order.paymentStatus);

  if (statuses.has("REFUNDED") || statuses.has("RESOLVED_BUYER")) return "REFUNDED";
  if (statuses.has("DISPUTED") || statuses.has("OPEN")) return "DISPUTED";
  if (statuses.has("AUTO_RELEASED") || statuses.has("COMPLETED") || statuses.has("RESOLVED_VENDOR") || statuses.has("RESOLVED_PARTIAL")) {
    return "RELEASED";
  }
  if (statuses.has("DELIVERED")) return "DELIVERED";
  if (statuses.has("DISPATCHED") || statuses.has("IN_TRANSIT")) return "SHIPPED";
  if (statuses.has("VENDOR_CONFIRMED") || statuses.has("CONFIRMED") || statuses.has("PROCESSING")) return "VENDOR_ACCEPTED";
  if (statuses.has("PAYMENT_SECURED")) return "PAID_HELD";

  if (escrowType === "DOMESTIC_AFRICA") {
    if (statuses.has("PAID") || paymentStatus === "PAID") return "PAID_HELD";
    if (statuses.has("PENDING") || paymentStatus === "PENDING") return "PENDING_PAYMENT";
    return "UNKNOWN";
  }

  if (statuses.has("REFUNDED")) return "REFUNDED";
  if (statuses.has("PAID") || paymentStatus === "PAID") return "RELEASED";
  if (statuses.has("PENDING") || paymentStatus === "PENDING") return "PENDING_PAYMENT";

  return "UNKNOWN";
}

export function getEscrowStatusLabel(status: EscrowStatus): string {
  switch (status) {
    case "PENDING_PAYMENT":
      return "Pending payment";
    case "PAID_HELD":
      return "Funds held";
    case "VENDOR_ACCEPTED":
      return "Vendor accepted";
    case "SHIPPED":
      return "Shipped";
    case "DELIVERED":
      return "Delivered";
    case "RELEASED":
      return "Funds released";
    case "DISPUTED":
      return "Disputed";
    case "REFUNDED":
      return "Refunded";
    default:
      return "Escrow status unavailable";
  }
}

export function getEscrowStatusColor(status: EscrowStatus): string {
  switch (status) {
    case "PENDING_PAYMENT":
      return "#8A8F94";
    case "PAID_HELD":
      return "#0A6C52";
    case "VENDOR_ACCEPTED":
      return "#D97706";
    case "SHIPPED":
      return "#076B51";
    case "DELIVERED":
      return "#1D7A57";
    case "RELEASED":
      return "#076B51";
    case "DISPUTED":
      return "#FB6363";
    case "REFUNDED":
      return "#B42318";
    default:
      return "#8A8F94";
  }
}

function stepIndex(status: EscrowStatus): number {
  switch (status) {
    case "PENDING_PAYMENT":
      return -1;
    case "PAID_HELD":
      return 0;
    case "VENDOR_ACCEPTED":
      return 1;
    case "SHIPPED":
      return 2;
    case "DELIVERED":
      return 3;
    case "RELEASED":
    case "REFUNDED":
      return 4;
    case "DISPUTED":
      return 2;
    default:
      return -1;
  }
}

export function getEscrowTimeline(order?: Partial<Order> | null): EscrowTimelineStep[] {
  const status = deriveEscrowStatus(order);
  const currentIndex = stepIndex(status);
  const releasedCaption =
    status === "REFUNDED"
      ? "Refund completed"
      : order?.autoReleasedAt
      ? `Auto-released ${formatMoment(order.autoReleasedAt)}`
      : order?.deliveredAt
      ? `Released after confirmation ${formatMoment(order.deliveredAt)}`
      : order?.escrowExpiresAt
      ? `Protected until ${formatMoment(order.escrowExpiresAt)}`
      : "Protected until confirmation";

  const steps: Array<Pick<EscrowTimelineStep, "key" | "label"> & { caption: string }> = [
    {
      key: "paid",
      label: "Paid",
      caption: formatMoment(order?.createdAt),
    },
    {
      key: "vendor_accepted",
      label: "Vendor accepted",
      caption: order?.vendorConfirmedAt ? formatMoment(order.vendorConfirmedAt) : "Waiting for vendor acceptance",
    },
    {
      key: "shipped",
      label: "Shipped",
      caption: status === "DISPUTED" ? "Shipment disputed" : order?.updatedAt ? formatMoment(order.updatedAt) : "Waiting for dispatch",
    },
    {
      key: "delivered",
      label: "Delivered",
      caption: order?.deliveredAt ? formatMoment(order.deliveredAt) : "Buyer confirmation required",
    },
    {
      key: "released",
      label: status === "REFUNDED" ? "Refunded" : "Funds released",
      caption: releasedCaption,
    },
  ];

  return steps.map((step, index) => ({
    ...step,
    done: currentIndex > index || (status === "REFUNDED" && index <= 4),
    current: currentIndex === index,
  }));
}

export function canBuyerConfirmDelivery(order?: Partial<Order> | null): boolean {
  if (!order) return false;
  if (toEscrowType(order.escrowType) !== "DOMESTIC_AFRICA") return false;

  const statuses = statusSet(order);
  if (statuses.has("DISPUTED") || statuses.has("REFUNDED") || statuses.has("COMPLETED") || statuses.has("AUTO_RELEASED")) {
    return false;
  }

  return statuses.has("DISPATCHED") || upper(order.status) === "DISPATCHED";
}

export function canBuyerOpenDispute(order?: Partial<Order> | null): boolean {
  if (!order) return false;
  if (toEscrowType(order.escrowType) !== "DOMESTIC_AFRICA") return false;

  const statuses = statusSet(order);
  if (statuses.has("REFUNDED") || statuses.has("COMPLETED") || statuses.has("AUTO_RELEASED") || statuses.has("RESOLVED_BUYER") || statuses.has("RESOLVED_VENDOR")) {
    return false;
  }
  if (statuses.has("OPEN") || statuses.has("DISPUTED")) {
    return false;
  }

  return statuses.has("DISPATCHED") || upper(order.status) === "DISPATCHED";
}

export function canVendorMarkShipped(order?: Partial<Order> | null): boolean {
  if (!order) return false;

  const statuses = statusSet(order);
  if (statuses.has("DISPUTED") || statuses.has("REFUNDED") || statuses.has("COMPLETED") || statuses.has("AUTO_RELEASED")) {
    return false;
  }

  if (toEscrowType(order.escrowType) === "DOMESTIC_AFRICA") {
    return statuses.has("VENDOR_CONFIRMED");
  }

  return statuses.has("CONFIRMED") || statuses.has("PROCESSING");
}

export function canVendorConfirmEscrowOrder(order?: Partial<Order> | null): boolean {
  if (!order) return false;
  if (toEscrowType(order.escrowType) !== "DOMESTIC_AFRICA") return false;

  const statuses = statusSet(order);
  if (statuses.has("DISPUTED") || statuses.has("REFUNDED") || statuses.has("COMPLETED") || statuses.has("AUTO_RELEASED")) {
    return false;
  }

  return statuses.has("PAYMENT_SECURED");
}

export function canAdminResolveDispute(dispute?: { status?: string | null } | null): boolean {
  return upper(dispute?.status) === "OPEN";
}
