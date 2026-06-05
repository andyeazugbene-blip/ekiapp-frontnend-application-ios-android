export type UserRole = "buyer" | "vendor" | "admin";

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  avatar?: string;
  referralCode?: string;
  createdAt: string;
}

export interface BuyerProfile extends User {
  role: "buyer";
  country: string;
  deliveryAddress?: string;
  walletBalance: number;
}

export interface VendorProfile extends User {
  role: "vendor";
  storeName: string;
  storeSlug?: string;
  shareUrl?: string;
  storeDescription?: string;
  businessType?: "individual" | "registered";
  sellerRegion?: "africa" | "abroad";
  country: string;
  city: string;
  verificationStatus: VendorVerificationStatus;
  subscriptionPlan: "free" | "growth" | "pro";
  rating: number;
  totalReviews: number;
  joinedAt: string;
  coverImage?: string;
}

export interface AdminProfile extends User {
  role: "admin";
  permissions: string[];
}

export type VendorVerificationStatus =
  | "pending_docs"
  | "under_review"
  | "verified"
  | "rejected";

export interface AuthState {
  user: BuyerProfile | VendorProfile | AdminProfile | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
  expectedRole?: UserRole;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  phone?: string;
  role: UserRole;
  storeName?: string;
  country?: string;
  referralCode?: string;
}
