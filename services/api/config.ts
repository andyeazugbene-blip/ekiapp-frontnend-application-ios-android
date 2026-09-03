/**
 * API Configuration
 * Reads from environment variables set via .env / app.config
 */

// Support both names: EXPO_PUBLIC_API_URL (preferred) and EXPO_PUBLIC_API_BASE_URL (legacy)
const envUrl = process.env.EXPO_PUBLIC_API_URL ?? process.env.EXPO_PUBLIC_API_BASE_URL;
const envStripeKey = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY;

// In production, API URL and Stripe key are required
if (!__DEV__ && !envUrl) {
  console.error("[API] EXPO_PUBLIC_API_URL is not set. Backend calls will fail.");
}
if (!__DEV__ && !envStripeKey) {
  console.error("[API] EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY is not set. Payments will fail.");
}

export const API_BASE_URL = envUrl || "https://ekiapp-backend.vercel.app";

export const STRIPE_PUBLISHABLE_KEY = envStripeKey || "";

// Google Sign-In — absent entirely just means the button renders disabled/
// hidden rather than the app crashing; see components/auth/SocialAuthButtons.tsx.
export const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? "";
export const GOOGLE_ANDROID_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? "";
export const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? "";
