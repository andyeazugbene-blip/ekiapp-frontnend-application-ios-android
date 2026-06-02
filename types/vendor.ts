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
  totalProducts: number;
  totalOrders: number;
  joinedAt: string;
  coverImage?: string;
  avatar?: string;
  verificationStatus: VendorVerificationStatus;
  adminStatus: VendorAdminStatus;
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
    currency?: string;
  };
  insights: {
    bestSellingProduct: string;
    repeatBuyers: number;
  };
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
