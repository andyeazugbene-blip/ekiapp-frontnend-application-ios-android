/**
 * Stripe PaymentSheet integration.
 *
 * The native Stripe SDK only loads in dev-client/standalone builds.
 * In Expo Go we return a clear unsupported result so the UI can show
 * a helpful message instead of crashing.
 *
 * Flow:
 *   1. Backend POST /api/payments/create-intent returns { clientSecret, ... }
 *   2. presentPaymentSheet(clientSecret) opens native Stripe UI
 *   3. Returns { status: "succeeded" | "cancelled" | "failed" | "unsupported" }
 *
 * The frontend NEVER marks an order as paid itself — payment status is
 * authoritative on the backend (via webhook) and refreshed by polling
 * GET /api/orders/:id.
 */
import Constants from "expo-constants";
import { STRIPE_PUBLISHABLE_KEY } from "./api";

const isExpoGo = Constants.appOwnership === "expo";

export type PaymentResult =
  | { status: "succeeded" }
  | { status: "cancelled"; message?: string }
  | { status: "failed"; message: string }
  | { status: "unsupported"; message: string };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let stripeModule: any = null;
let stripeLoadAttempted = false;

function loadStripe(): any {
  if (stripeLoadAttempted) return stripeModule;
  stripeLoadAttempted = true;
  if (isExpoGo || !STRIPE_PUBLISHABLE_KEY) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    stripeModule = require("@stripe/stripe-react-native");
  } catch {
    stripeModule = null;
  }
  return stripeModule;
}

export function isPaymentSheetAvailable(): boolean {
  return loadStripe() != null;
}

/**
 * Present the native Stripe PaymentSheet for a clientSecret.
 *
 * Returns a discriminated union — never throws.
 */
export async function presentPayment(params: {
  clientSecret: string;
  merchantDisplayName?: string;
  customerId?: string;
  customerEphemeralKeySecret?: string;
}): Promise<PaymentResult> {
  const stripe = loadStripe();
  if (!stripe) {
    return {
      status: "unsupported",
      message:
        "Stripe PaymentSheet is not available in Expo Go. Use a development build (eas build) to test live payments.",
    };
  }

  const { initPaymentSheet, presentPaymentSheet } = stripe;
  if (typeof initPaymentSheet !== "function" || typeof presentPaymentSheet !== "function") {
    return {
      status: "unsupported",
      message: "Stripe SDK loaded but PaymentSheet API is not exposed.",
    };
  }

  // ── 1. Initialize PaymentSheet ───────────────────────────────────────────
  const { error: initError } = await initPaymentSheet({
    merchantDisplayName: params.merchantDisplayName ?? "Eki Marketplace",
    paymentIntentClientSecret: params.clientSecret,
    customerId: params.customerId,
    customerEphemeralKeySecret: params.customerEphemeralKeySecret,
    allowsDelayedPaymentMethods: false,
    returnURL: "ekiapp://stripe-redirect",
  });

  if (initError) {
    return {
      status: "failed",
      message: initError.message ?? "Could not initialize payment.",
    };
  }

  // ── 2. Present PaymentSheet ──────────────────────────────────────────────
  const { error: presentError } = await presentPaymentSheet();

  if (presentError) {
    if (presentError.code === "Canceled") {
      return { status: "cancelled", message: "Payment cancelled." };
    }
    return {
      status: "failed",
      message: presentError.message ?? "Payment failed.",
    };
  }

  return { status: "succeeded" };
}
