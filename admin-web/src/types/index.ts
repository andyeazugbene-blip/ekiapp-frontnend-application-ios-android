/**
 * Type definitions for admin panel
 */

export type UserRole = "BUYER" | "VENDOR" | "ADMIN";
export type UserStatus = "active" | "suspended" | "pending";
export type VendorStatus = "active" | "pending" | "suspended";
export type OrderStatus = "pending" | "confirmed" | "shipped" | "delivered" | "completed" | "cancelled" | "refunded";
export type ProductStatus = "active" | "disabled" | "out_of_stock";
export type VerificationStatus = "pending" | "approved" | "rejected";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  suspendedReason?: string | null;
}

export interface Vendor {
  id: string;
  storeName: string;
  storeSlug?: string;
  ownerName: string;
  country: string;
  city: string;
  rating: number;
  totalProducts: number;
  totalOrders: number;
  joinedAt: string;
  coverImage?: string;
  avatar?: string;
  verificationStatus: "pending_docs" | "verified" | "rejected";
  adminStatus: VendorStatus;
  subscriptionPlan: string;
  description?: string;
  isSuspended?: boolean;
}

export interface Product {
  id: string;
  title: string;
  price: number;
  currency: string;
  stock: number;
  isActive: boolean;
  vendorId: string;
  vendorName?: string;
  images?: string[];
  createdAt: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  buyerId: string;
  buyerName?: string;
  vendorId: string;
  vendorName?: string;
  totalAmount: number;
  currency: string;
  status: OrderStatus;
  paymentStatus?: string;
  createdAt: string;
  items?: OrderItem[];
  payment?: any;
  deliveryZone?: any;
  checkout?: any;
  vendorInfo?: any;
  subtotalAmount?: number;
  deliveryFeeAmount?: number;
  platformFeeAmount?: number;
  vendorEarnings?: number;
  deliveredAt?: string;
}

export interface OrderItem {
  id: string;
  productTitle: string;
  quantity: number;
  price: number;
  totalAmount: number;
}

export interface VerificationDocument {
  id: string;
  vendorId: string;
  vendorName: string;
  type: "id" | "business" | "selfie";
  status: VerificationStatus;
  fileUrl: string;
  submittedAt: string;
  reviewedAt?: string;
  reviewNote?: string;
}

export interface DashboardStats {
  totalVendors: number;
  pendingApprovals: number;
  activeVendors: number;
  suspendedVendors: number;
  totalOrders: number;
  totalRevenue: number;
  newVendorsThisWeek: number;
  totalUsers?: number;
  totalBuyers?: number;
}

export interface Analytics {
  revenue: {
    today: number;
    thisWeek: number;
    thisMonth: number;
    total: number;
    change: number;
    currency: string;
  };
  orders: {
    total: number;
    pending: number;
    paid: number;
    completed: number;
    failed: number;
    change: number;
  };
  vendors: {
    active: number;
    new: number;
  };
  buyers: {
    active: number;
    new: number;
  };
  avgOrderValue: number;
  disputeRate: number;
  growth: {
    newOrdersThisWeek: number;
    newVendorsThisWeek: number;
    newUsersThisWeek: number;
  };
  topVendors: {
    id: string;
    name: string;
    revenue: number;
    orders: number;
  }[];
}

export interface RevenueSeries {
  day: string;
  amount: number;
}

export interface Dispute {
  id: string;
  orderId: string;
  buyerId?: string;
  vendorId?: string;
  reason: string;
  status: string;
  resolution?: string;
  fraudulent?: boolean;
  refundAmount?: number;
  createdAt: string;
  resolvedAt?: string;
  order?: Order;
}

export interface Payout {
  id: string;
  vendorId: string;
  vendorName: string;
  amount: number;
  currency: string;
  status: "pending" | "approved" | "rejected" | "completed";
  requestedAt: string;
  processedAt?: string;
}

export interface PromoCode {
  id: string;
  vendorId?: string;
  storeSlug?: string;
  code: string;
  type: "PERCENTAGE" | "FIXED_AMOUNT";
  value: number;
  minOrderAmount?: number | null;
  maxUses?: number | null;
  usedCount: number;
  validFrom: string;
  validUntil?: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface AdminPayoutRequest {
  id: string;
  vendorId: string;
  payoutMethodId: string;
  amount: number;
  currency: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "PAID";
  notes?: string | null;
  rejectionReason?: string | null;
  approvedById?: string | null;
  approvedAt?: string | null;
  paidById?: string | null;
  paidAt?: string | null;
  createdAt: string;
  payoutMethod?: {
    type: string;
    label: string | null;
    details: {
      bankName: string | null;
      provider: string | null;
      email: string | null;
      accountHolder: string | null;
      country: string | null;
    };
  };
}

export interface AdminSubscriptionPlan {
  id: string;
  plan: string;
  slug: string;
  name: string;
  description?: string | null;
  monthlyPriceCents: number;
  platformFeeBps: number;
  currency: string;
  maxProducts: number;
  maxImagesPerProduct: number;
  maxOrders?: number | null;
  analytics: boolean;
  prioritySupport: boolean;
  flashSales: boolean;
  bundles: boolean;
  discounts: boolean;
  marketingTools: boolean;
  canReceiveOrders: boolean;
  isActive: boolean;
  isDefault: boolean;
  displayOrder: number;
}

export interface EscrowProviderConfig {
  id: string;
  country: string;
  countryCode: string;
  currency: string;
  provider: string;
  enabled: boolean;
  payoutSupported: boolean;
  otpChannel: "SMS" | "EMAIL" | "SMS_EMAIL";
  protectionWindowHours: number;
  notes?: string | null;
}

export interface AdminEscrowHealth {
  smsConfigured: boolean;
  providers: EscrowProviderConfig[];
  outstandingAmount?: number;
  expectedBalance?: number;
  healthy?: boolean;
}

export interface UploadAsset {
  id: string;
  ownerId: string;
  category: string;
  key: string;
  publicUrl?: string | null;
  contentType: string;
  sizeBytes?: number | null;
  status: "REQUESTED" | "COMPLETED" | "FAILED";
  completedAt?: string | null;
  createdAt: string;
}

export interface AuditLogEntry {
  id: string;
  actorId: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: unknown;
  createdAt: string;
  actor?: {
    id: string;
    name: string;
    email: string;
    role: string;
  } | null;
}
