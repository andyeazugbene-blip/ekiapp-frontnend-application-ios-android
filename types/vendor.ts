import { VendorVerificationStatus } from "./auth";

export type VendorAdminStatus = "pending" | "active" | "suspended";

export interface VendorSummary {
  id: string;
  userId?: string;
  storeName: string;
  storeSlug?: string;
  shareUrl?: string;
  ownerName: string;
  country: string;
  city: string;
  rating: number;
  totalReviews?: number;
  totalProducts: number;
  totalOrders: number;
  joinedAt: string;
  coverImage?: string;
  avatar?: string;
  verificationStatus: VendorVerificationStatus;
  adminStatus: VendorAdminStatus;
  currency?: string;
  subscriptionPlan: "free" | "growth" | "pro";
  description?: string;
  businessType?: "individual" | "registered";
  sellerRegion?: "africa" | "abroad";
  deliveryCountries?: string[];
}

export interface DashboardAlert {
  id: string;
  type: "order_action" | "low_stock" | "message" | "payout";
  label: string;
  count: number;
}

export interface VendorDashboardData {
  greeting: string;
  storeName: string;
  alerts: DashboardAlert[];
  earnings: {
    salesToday: number;
    salesTodayNgn: number;
    salesThisWeek: number;
    salesThisWeekNgn: number;
    salesThisMonth: number;
    salesThisMonthNgn: number;
    pendingPayout: number;
    pendingPayoutNgn: number;
    availableBalance?: number;
    availableBalanceNgn?: number;
    currency?: string;
  };
  insights: {
    bestSellingProduct: string;
    repeatBuyers: number;
  };
}

export type VendorAnalyticsRange = "today" | "7d" | "month" | "30d" | "all";

export interface VendorAnalyticsSummary {
  currency: string;
  totalRevenue: number;
  estimatedProfit: number;
  estimatedProfitAvailable: boolean;
  availableForPayout: number;
  pendingBalance: number;
}

export interface VendorAnalyticsFunnel {
  storeVisits: number;
  checkoutStarted: number;
  ordersCompleted: number;
  conversionRate: number;
  repeatOrders: number;
  storeSaves: number;
}

export interface VendorAnalyticsCustomerInsights {
  newBuyers: number;
  repeatBuyers: number;
  inactiveBuyers30d: number;
}

export interface VendorAnalyticsTopProduct {
  productId: string;
  name: string;
  orders: number;
  unitsSold: number;
  revenue: number;
  estimatedProfit?: number;
  hasCost: boolean;
}

export type VendorAnalyticsInsightAction =
  | "send_offer"
  | "restock_product"
  | "view_buyers"
  | "send_reminder"
  | "share_store"
  | "share_product";

export interface VendorAnalyticsInsight {
  id: string;
  title: string;
  body: string;
  action: VendorAnalyticsInsightAction;
  actionLabel: string;
  productId?: string;
  severity?: "info" | "warning" | "success";
}

export interface VendorAnalyticsData {
  range: VendorAnalyticsRange;
  summary: VendorAnalyticsSummary;
  salesFunnel: VendorAnalyticsFunnel;
  customerInsights: VendorAnalyticsCustomerInsights;
  topProducts: VendorAnalyticsTopProduct[];
  insights: VendorAnalyticsInsight[];
}

export interface AdminDashboardData {
  totalVendors: number;
  pendingApprovals: number;
  activeVendors: number;
  suspendedVendors: number;
  totalOrders: number;
  totalRevenue: number;
  newVendorsThisWeek: number;
}
