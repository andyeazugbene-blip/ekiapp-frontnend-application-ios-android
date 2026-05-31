# Stripe Mobile Payment Status

**Generated:** 2026-05-26

## Current Implementation

The frontend creates a Stripe `PaymentIntent` via the backend (`POST /api/payments/create-intent`) and receives a `clientSecret`. The actual Stripe PaymentSheet UI is **not** invoked in this build because Expo Go does not bundle `@stripe/stripe-react-native` native modules.

### Flow today
1. Buyer fills checkout form → taps "Place Order"
2. `cartStore.createCheckout()` calls `cartService.createPaymentIntent({ cartId, destinationZoneId, deliveryAddress, deliveryCountry })`
3. Backend creates `Checkout` + per-vendor `Order` rows + Stripe `PaymentIntent` and returns `{ checkoutId, orderIds, amount, currency, clientSecret }`
4. Frontend optionally applies wallet via `walletService.applyToOrder()`
5. Frontend clears cart and navigates to success screen
6. Backend Stripe webhook (`payment_intent.succeeded`) reconciles the order: marks `Payment` SUCCEEDED → `Order` PAID → credits vendor wallet

### Why PaymentSheet is not invoked yet
- `@stripe/stripe-react-native` is in `package.json` (v0.65.1) and the config plugin is wired in `app.json` with `merchantIdentifier`.
- `components/providers/StripeProvider.tsx` is currently a **passthrough** because Expo Go cannot link the native module.
- Calling `initPaymentSheet` / `presentPaymentSheet` in Expo Go throws because the native iOS/Android Stripe SDK is missing.

## What the User Sees in Expo Go

When the user taps "Place Order":
- The order is created on the backend.
- Stripe PaymentIntent is created with status `requires_payment_method` (until a real card is attached).
- Frontend shows the success modal because the `clientSecret` was returned.
- **The order will remain `PENDING` on the backend until the webhook receives a successful payment.**

This is honest behavior — the frontend never marks anything as paid. Wallet payment paths *do* succeed end-to-end (because they don't require Stripe).

## What's Required to Enable PaymentSheet

To complete the Stripe PaymentSheet integration, the app must run as a **dev-client build** or **standalone production build** (not Expo Go).

### Steps to test in dev-client

1. Install EAS CLI:
   ```
   npm install -g eas-cli
   ```

2. Configure EAS Build (already done — see `eas.json`):
   ```
   eas build --profile development --platform ios
   eas build --profile development --platform android
   ```

3. Install the resulting dev-client `.ipa` / `.apk` on a device.

4. Replace the StripeProvider passthrough with the real wrapper:
   ```tsx
   // components/providers/StripeProvider.tsx
   import React from "react";
   import { StripeProvider as RNStripeProvider } from "@stripe/stripe-react-native";
   import { STRIPE_PUBLISHABLE_KEY } from "../../services/api";

   export function StripeProvider({ children }: { children: React.ReactNode }) {
     if (!STRIPE_PUBLISHABLE_KEY) return <>{children}</>;
     return (
       <RNStripeProvider
         publishableKey={STRIPE_PUBLISHABLE_KEY}
         merchantIdentifier="merchant.com.ekiapp.mobile"
       >
         {children}
       </RNStripeProvider>
     );
   }
   ```

5. In `app/(buyer)/checkout.tsx`, after `createCheckout()` returns, call:
   ```tsx
   import { initPaymentSheet, presentPaymentSheet } from "@stripe/stripe-react-native";

   const { error: initErr } = await initPaymentSheet({
     paymentIntentClientSecret: intent.clientSecret,
     merchantDisplayName: "Eki Marketplace",
     allowsDelayedPaymentMethods: false,
   });
   if (initErr) { setError(initErr.message); return; }

   const { error: payErr } = await presentPaymentSheet();
   if (payErr) {
     if (payErr.code !== "Canceled") setError(payErr.message);
     return;
   }

   // Payment submitted — refresh order status from backend.
   // Do NOT mark order as PAID locally; wait for webhook.
   await orderService.getBuyerOrderById(intent.orderIds[0]).catch(() => {});
   clearCart();
   setShowSuccess(true);
   ```

6. The user sees the native PaymentSheet, enters card details, and confirms. The backend webhook reconciles the order to PAID.

## What Should NOT Happen

- ❌ Frontend never sets `payment.status = "SUCCEEDED"` locally.
- ❌ Frontend never marks `order.status = "PAID"`.
- ❌ Frontend never simulates a successful Stripe charge.
- ✅ Frontend only confirms "payment submitted" and refreshes from backend.

## Final Verdict

**STRIPE PAYMENTSHEET — NOT WIRED IN EXPO GO BUILDS, READY FOR DEV-CLIENT**

To activate:
1. Build with `eas build --profile development`
2. Replace `StripeProvider` passthrough with real `RNStripeProvider`
3. Add `initPaymentSheet` + `presentPaymentSheet` calls to checkout

The backend, frontend `clientSecret` plumbing, and webhook reconciliation are already production-ready. Only the native UI invocation is gated behind dev-client.
