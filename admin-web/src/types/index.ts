/**
 * Type definitions for admin panel
 */

export type UserRole = "BUYER" | "VENDOR" | "ADMIN";
export type UserStatus = "active" | "suspended" | "pending";
export type VendorStatus = "active" | "pending" | "suspended";
export type OrderStatus = "pending" | "confirmed" | "shipped" | "delivered" | "completed" | "cancelled" | "refunded";
export type ProductStatus = "active" | "disabled" | "out_of_stock";
export type VerificationStatus = "pending" | "approved" | "rejected";

export interface UserOrderSummary {
  id: string;
  orderNumber: string;
  status: string;
  totalAmount: number;
  currency: string;
  createdAt: string;
}

export interface UserVendorSnapshot {
  id: string;
  storeName: string;
  verificationStatus: string;
  isSuspended: boolean;
  country: string;
}

export interface UserOrganiserSnapshot {
  id: string;
  isVerified: boolean;
  isRestricted: boolean;
  country: string;
}

export interface UserSupplierSnapshot {
  id: string;
  supplierState: string;
  chargesEnabled: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  country?: string | null;
  role: UserRole;
  status: UserStatus;
  trustScore?: number;
  emailVerifiedAt?: string | null;
  createdAt: string;
  updatedAt?: string;
  suspendedReason?: string | null;
  // Investigation context (getUser() enrichment) — undefined on the list
  // endpoint's rows, always present (possibly empty/null) on getUser().
  vendor?: UserVendorSnapshot | null;
  organiserProfile?: UserOrganiserSnapshot | null;
  supplierAccount?: UserSupplierSnapshot | null;
  recentOrders?: UserOrderSummary[];
  orderCount?: number;
  supportConversationId?: string | null;
}

export interface Vendor {
  id: string;
  storeName: string;
  storeSlug?: string;
  ownerName: string;
  email?: string;
  phone?: string;
  country: string;
  city: string;
  rating: number;
  totalProducts: number;
  totalOrders: number;
  totalRevenue?: number;
  joinedAt: string;
  coverImage?: string;
  avatar?: string;
  verificationStatus: "pending_docs" | "verified" | "rejected";
  adminStatus: VendorStatus;
  subscriptionPlan: string;
  subscriptionStatus?: string;
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
  frontReadUrl?: string;
  backReadUrl?: string;
  frontUrl?: string;
  backUrl?: string | null;
  submittedAt: string;
  reviewedAt?: string;
  reviewedById?: string | null;
  reviewNote?: string;
  rejectionReason?: string | null;
  deleteAfterAt?: string | null;
  deletedAt?: string | null;
}

export interface VerificationDocSummary {
  governmentId: number;
  businessRegistration: number;
  selfie: number;
  total: number;
}

export type VerificationMethod = "STRIPE_IDENTITY" | "MANUAL_DOCUMENTS" | "BOTH";

export interface VerificationQueueItem {
  vendorId: string;
  storeName: string;
  vendorName: string;
  email: string;
  phone?: string | null;
  verificationStatus: "PENDING" | "VERIFIED" | "REJECTED";
  verificationMethod: VerificationMethod;
  latestSubmissionDate: string;
  uploadedDocSummary: VerificationDocSummary;
  docsAlreadyDeleted: boolean;
  provider?: ProviderReadiness;
  manualReviewAllowed?: boolean;
}

export type ProviderStage = "NOT_STARTED" | "PENDING" | "REQUIREMENTS_DUE" | "RESTRICTED" | "VERIFIED";
export type ProviderIdentityState =
  | "NOT_STARTED" | "PROCESSING" | "PENDING" | "NEEDS_INPUT" | "VERIFIED"
  | "FAILED" | "CANCELED" | "REDACTED" | "LEGACY_MANUAL";

/** Provider-owned state (Stripe). Identity, charges and payouts are separate facts. */
export interface ProviderReadiness {
  managedBy: "STRIPE" | "LEGACY_MANUAL" | "NONE";
  stage: ProviderStage;
  pendingOn: "PROVIDER" | "VENDOR" | null;
  summary: string;
  identity: {
    state: ProviderIdentityState;
    providerStatus: string | null;
    sessionId: string | null;
    verifiedAt: string | null;
    failureReason: string | null;
    updatedAt: string | null;
  };
  connect: {
    accountId: string | null;
    status: string | null;
    chargesEnabled: boolean;
    payoutsEnabled: boolean;
    requirementsCurrentlyDue: string[];
    requirementsPastDue: string[];
    requirementsEventuallyDue: string[];
    requirementsCategories: string[];
    disabledReason: string | null;
    requirementsDeadline: string | null;
    onboardedAt: string | null;
    fetchedAt: string | null;
  };
}

export interface VendorStripeStatus extends ProviderReadiness {
  vendorId: string;
  storeName: string;
  reminderLastSentAt: string | null;
  legacyDocumentCount: number;
  links: { account: string | null; identitySession: string | null };
  refreshWarning?: string;
}

export interface VerificationReviewDetails {
  vendor: {
    vendorId: string;
    storeName: string;
    storeSlug?: string | null;
    vendorName: string;
    email: string;
    phone?: string | null;
    country?: string | null;
    city?: string | null;
    verificationStatus: "PENDING" | "VERIFIED" | "REJECTED";
    joinedAt: string;
  };
  verificationStatus: "PENDING" | "VERIFIED" | "REJECTED";
  verificationMethod: VerificationMethod;
  stripeVerificationSessionId?: string | null;
  verifiedAt?: string | null;
  uploadedDocSummary: VerificationDocSummary;
  docsAlreadyDeleted: boolean;
  latestSubmissionDate?: string | null;
  reviewedAt?: string | null;
  reviewedBy?: string | null;
  rejectionReason?: string | null;
  proofs: VerificationDocument[];
  provider?: ProviderReadiness;
  manualReviewAllowed?: boolean;
}

export interface DashboardStats {
  totalVendors: number;
  pendingApprovals: number;
  activeVendors: number;
  suspendedVendors: number;
  totalOrders: number;
  totalRevenue: number;
  newVendorsThisWeek: number;
  pendingPayoutsCount: number;
  expiringSubscriptionsCount: number;
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
  status: "PENDING" | "APPROVED" | "REJECTED" | "PROCESSING" | "ON_HOLD" | "PAID";
  notes?: string | null;
  rejectionReason?: string | null;
  approvedById?: string | null;
  approvedAt?: string | null;
  paidById?: string | null;
  paidAt?: string | null;
  stripeTransferId?: string | null;
  holdReason?: string | null;
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

export interface AdminCommissionTier {
  id?: string;
  label?: string | null;
  minSubtotalCents: number;
  maxSubtotalCents?: number | null;
  platformFeeBps: number;
  isActive: boolean;
  displayOrder: number;
}

export interface AdminSubscriptionPlan {
  id: string;
  plan: string;
  slug: string;
  name: string;
  description?: string | null;
  monthlyPriceCents: number;
  platformFeeBps: number;
  withdrawalFeeBps: number;
  currency: string;
  maxProducts: number;
  maxImagesPerProduct: number;
  maxOrders?: number | null;
  maxCoupons?: number | null;
  maxBundles?: number | null;
  analytics: boolean;
  prioritySupport: boolean;
  flashSales: boolean;
  bundles: boolean;
  discounts: boolean;
  marketingTools: boolean;
  customerDatabase: boolean;
  repeatBuyerMarketing: boolean;
  professionalStorefront: boolean;
  orderManagement: boolean;
  storeLinkSharing: boolean;
  canReceiveOrders: boolean;
  isActive: boolean;
  isDefault: boolean;
  displayOrder: number;
  commissionTiers: AdminCommissionTier[];
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
  beforeState?: unknown;
  afterState?: unknown;
  reason?: string | null;
  createdAt: string;
  actor?: {
    id: string;
    name: string;
    email: string;
    role: string;
  } | null;
}

export interface AnalyticsOverview {
  gmv: number;
  ekiRevenue: number;
  totalOrders: number;
  avgOrderValue: number;
  totalBuyers: number;
  totalVendors: number;
  activeBuyers30d: number;
  activeVendors30d: number;
  newBuyers: number;
  newVendors: number;
  buyerRetentionRate: number;
  vendorRetentionRate: number;
  subscriptionRevenue: number;
  escrowBalance: number;
  pendingPayouts: number;
  openDisputes: number;
  pendingVerifications: number;
  currency: string;
}

export interface GrowthPoint {
  date: string;
  value: number;
}

export interface GrowthSeries {
  gmv: GrowthPoint[];
  revenue: GrowthPoint[];
  orders: GrowthPoint[];
  buyers: GrowthPoint[];
  vendors: GrowthPoint[];
  range: string;
}

export interface BuyerAnalytics {
  newBuyers: number;
  returningBuyers: number;
  repeatPurchaseRate: number;
  avgOrdersPerBuyer: number;
  topBuyers: {
    buyerId: string;
    name: string;
    totalOrders: number;
    totalSpend: number;
    lastOrderDate: string | null;
  }[];
  buyerLocations: { country: string; count: number }[];
  currency: string;
}

export interface VendorAnalyticsData {
  topVendorsByRevenue: {
    vendorId: string;
    storeName: string;
    totalRevenue: number;
    totalOrders: number;
  }[];
  topVendorsByOrders: {
    vendorId: string;
    storeName: string;
    totalOrders: number;
    totalRevenue: number;
  }[];
  vendorsWithNoOrders: number;
  vendorLocations: { country: string; city: string | null; count: number }[];
  vendorRetentionRate: number;
  totalVendors: number;
  currency: string;
}

export interface OrderAnalytics {
  ordersByDay: { date: string; count: number; gmv: number }[];
  ordersByWeek: { week: string; count: number; gmv: number }[];
  ordersByMonth: { month: string; count: number; gmv: number }[];
  avgOrderValue: number;
  topProducts: {
    productId: string;
    title: string;
    totalQuantity: number;
    totalRevenue: number;
  }[];
  topCategories: {
    category: string;
    totalQuantity: number;
    totalRevenue: number;
  }[];
  currency: string;
}

export interface PaymentAnalytics {
  successfulPayments: { count: number; amount: number };
  failedPayments: { count: number; amount: number };
  refunds: { count: number; amount: number };
  escrow: {
    pendingCredits: { count: number; amount: number };
    releases: { count: number; amount: number };
    payoutDebits: { count: number; amount: number };
    adjustments: { count: number; amount: number };
  };
  payouts: {
    totalPaid: { count: number; amount: number };
    totalPending: { count: number; amount: number };
    recentPayouts: {
      id: string;
      vendorId: string;
      storeName: string;
      amount: number;
      netAmount: number;
      status: string;
      paidAt: string | null;
      createdAt: string;
    }[];
  };
  currency: string;
}

export interface GeographicAnalytics {
  ordersByCountry: { country: string; count: number; gmv: number }[];
  ordersByCity: { city: string; country: string; count: number; gmv: number }[];
  buyerLocations: { country: string; city: string | null; count: number }[];
  vendorLocations: { country: string; city: string | null; count: number }[];
  currency: string;
}
