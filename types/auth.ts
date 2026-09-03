export type UserRole = "buyer" | "vendor" | "admin";

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  hasVendor?: boolean;
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
  currency?: string;
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
  city?: string;
  postcode?: string;
  deliveryAddress?: string;
  referralCode?: string;
}

// Google/Apple Sign-In — mirrors the backend's three-state resolution
// (backend/src/modules/auth/oauth/oauth.service.ts). The ticket is an
// opaque, short-lived (15m) signed token the client never inspects —
// it's forwarded as-is to /oauth/link or /oauth/complete-signup.
export type OAuthOutcome =
  | { status: "LOGIN"; user: any; token: string }
  | { status: "LINK_REQUIRED"; ticket: string; email: string }
  | { status: "SIGNUP_REQUIRED"; ticket: string; prefill: { name: string | null; email: string | null }; missingFields: string[] };
