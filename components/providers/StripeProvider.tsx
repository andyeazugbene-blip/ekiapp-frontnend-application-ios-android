/**
 * Stripe Provider — Conditional native Stripe integration.
 *
 * In Expo Go (no native modules linked), this is a passthrough.
 * In dev-client / EAS builds (where @stripe/stripe-react-native native code
 * is linked), this wraps the app with the real StripeProvider so PaymentSheet
 * can run.
 *
 * The publishable key is read from EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY.
 */
import React from "react";
import Constants from "expo-constants";
import { STRIPE_PUBLISHABLE_KEY } from "../../services/api";

const isExpoGo = Constants.appOwnership === "expo";

// Lazy-resolved native StripeProvider. We keep the require() inside a function
// so Metro doesn't try to resolve native modules at bundle time in Expo Go.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let NativeStripeProvider: React.ComponentType<any> | null | undefined = undefined;

function loadNativeStripeProvider(): React.ComponentType<any> | null {
  if (NativeStripeProvider !== undefined) return NativeStripeProvider ?? null;
  if (isExpoGo || !STRIPE_PUBLISHABLE_KEY) {
    NativeStripeProvider = null;
    return null;
  }
  try {
    // Only required when native module is available (dev-client / standalone).
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const stripe = require("@stripe/stripe-react-native");
    NativeStripeProvider = stripe.StripeProvider ?? null;
  } catch {
    NativeStripeProvider = null;
  }
  return NativeStripeProvider ?? null;
}

export function StripeProvider({ children }: { children: React.ReactNode }) {
  const Provider = loadNativeStripeProvider();
  if (!Provider || !STRIPE_PUBLISHABLE_KEY) {
    return <>{children}</>;
  }
  return (
    <Provider
      publishableKey={STRIPE_PUBLISHABLE_KEY}
      merchantIdentifier="merchant.com.ekiapp.mobile"
    >
      {children}
    </Provider>
  );
}
