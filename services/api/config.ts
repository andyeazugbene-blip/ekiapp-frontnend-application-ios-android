/**
 * API Configuration
 * Reads from environment variables set via .env / app.config
 */

// Support both names: EXPO_PUBLIC_API_URL (preferred) and EXPO_PUBLIC_API_BASE_URL (legacy)
const envUrl = process.env.EXPO_PUBLIC_API_URL ?? process.env.EXPO_PUBLIC_API_BASE_URL;
const envStripeKey = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const envAppReviewMode = process.env.EXPO_PUBLIC_APP_REVIEW_MODE;

// In production, API URL and Stripe key are required
if (!__DEV__ && !envUrl) {
  console.error("[API] EXPO_PUBLIC_API_URL is not set. Backend calls will fail.");
}
if (!__DEV__ && !envStripeKey) {
  console.error("[API] EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY is not set. Payments will fail.");
}

export const API_BASE_URL = envUrl || "https://ekiapp-backend.vercel.app";

export const STRIPE_PUBLISHABLE_KEY = envStripeKey || "";

export const APP_REVIEW_MODE = envAppReviewMode !== "false";
