import { CartItem } from "./product";

export type OrderStatus =
  | "pending"
  | "paid"
  | "confirmed"
  | "processing"
  | "dispatched"
  | "in_transit"
  | "delivered"
  | "completed"
  | "disputed"
  | "cancelled"
  | "refunded";

export type PaymentStatus = "pending" | "paid" | "failed" | "refunded";
export type EscrowType = "none" | "domestic_africa";
export type EscrowStatus =
  | "PENDING_PAYMENT"
  | "PAID_HELD"
  | "VENDOR_ACCEPTED"
  | "SHIPPED"
  | "DELIVERED"
  | "RELEASED"
  | "DISPUTED"
  | "REFUNDED"
  | "UNKNOWN";

export type DeliveryCountry = "USA" | "UK" | "Canada" | "Germany" | "France" | "Netherlands";

export interface DeliveryDetails {
  recipientName: string;
  address: string;
  city: string;
  country: DeliveryCountry;
  postalCode: string;
  phone: string;
  estimatedDays: string;
  deliveryCost: number;
  totalWeight: number;
}

export interface OrderDisputeSummary {
  id: string;
  status: string;
  reason?: string;
  resolution?: string;
  refundAmount?: number;
  resolvedAt?: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  buyerId: string;
  buyerName: string;
  buyerAvatar?: string;
  vendorId: string;
  vendorName: string;
  items: CartItem[];
  subtotal: number;
  deliveryCost: number;
  total: number;
  currency: "GBP" | "USD" | "EUR" | "NGN" | "GHS" | "KES";
  status: OrderStatus;
  backendStatus?: string;
  paymentStatus: PaymentStatus;
  paymentProvider?: string;
  paymentReference?: string;
  escrowType?: EscrowType;
  escrowExpiresAt?: string;
  vendorConfirmedAt?: string;
  disputedAt?: string;
  autoReleasedAt?: string;
  platformFee?: number;
  vendorEarnings?: number;
  deliveryDetails: DeliveryDetails;
  deliveryAddress?: string;
  dispute?: OrderDisputeSummary | null;
  paymentMethod?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  deliveredAt?: string;
}

export interface Payout {
  id: string;
  vendorId: string;
  amount: number;
  currency: string;
  status: "paid" | "pending" | "processing" | "failed";
  orderId?: string;
  orderNumber?: string;
  createdAt: string;
}

export type PayoutMode = "per_order" | "weekly";

export interface VendorEarnings {
  totalEarnings: number;
  pendingPayout: number;
  availableBalance: number;
  availableBalanceNgn?: number;
  salesToday: number;
  salesTodayNgn: number;
  salesThisWeek: number;
  salesThisWeekNgn: number;
  salesThisMonth: number;
  salesThisMonthNgn: number;
  pendingPayoutNgn?: number;
  currency: string;
  localCurrency: string;
  localRate: number;
  payoutMode: PayoutMode;
  recentPayouts: Payout[];
}
