# App Store / Google Play Billing Compliance Note

## Review-safe subscription position

The mobile app must not sell paid digital subscription access unless Apple In-App Purchase or Google Play Billing is implemented. This build therefore treats subscriptions as backend-derived entitlements only:

- The app displays current plan status and usage limits after login.
- The app refreshes status with `GET /api/subscriptions/me` and `GET /api/subscriptions/me/limits`.
- Locked premium features use neutral copy: "This feature is not available on your current plan."
- The app does not open subscription checkout, Stripe Checkout, or external purchase pages.
- Website-paid subscriptions can unlock in-app features only after the backend returns the paid entitlement.

This follows the conservative reading of Apple App Review Guideline 3.1.1 and Google Play Payments policy: in-app purchases of digital features/subscriptions should use the platform billing system unless a specific approved external billing/linking program or entitlement applies.

Official policy references:

- Apple App Review Guidelines: https://developer.apple.com/app-store/review/guidelines/
- Google Play Payments policy: https://support.google.com/googleplay/android-developer/answer/9858738
- Google Play billing policy overview: https://support.google.com/googleplay/android-developer/answer/10281818

## Mobile implementation guardrails

`EXPO_PUBLIC_APP_REVIEW_MODE=true` is configured for EAS development, preview, and production profiles. The current mobile implementation is stricter than the flag: paid subscription CTAs and external checkout openers have been removed from the app code path rather than conditionally hidden.

The compliance gate is:

```bash
npm run check:billing-compliance
```

It scans `app/` plus `services/subscriptionService.ts` for forbidden steering copy, external subscription checkout routes, checkout URL fields, and direct paid subscription CTAs.

The backend contract gate is:

```bash
SUBSCRIPTION_TEST_TOKEN=<vendor-test-token> \
SUBSCRIPTION_TEST_ALLOW_MUTATION=true \
npm run check:subscription-backend-contract
```

Run this only against a disposable staging/test vendor account because it calls `POST /api/subscriptions/activate` for the free-plan check. Without `SUBSCRIPTION_TEST_ALLOW_MUTATION=true`, the script verifies only read-only entitlement endpoints and exits with skipped mutation checks.

## Backend contract required for release

The backend remains the source of truth:

- Stripe webhook activates paid subscriptions in backend storage after confirmed payment.
- `POST /api/subscriptions/activate` may activate only the free plan.
- Paid activation from the app must return controlled HTTP 409 with `SUBSCRIPTIONS_NOT_AVAILABLE`.
- `GET /api/subscriptions/me` returns current plan and active/inactive status from backend storage.
- `GET /api/subscriptions/me/limits` returns server-enforced plan limits.
- Server endpoints that create products, orders, offers, bundles, discounts, flash sales, or analytics access enforce limits server-side.

This repository does not contain backend source or backend tests, so those items must be verified in the backend repository or against a controlled staging backend before App Store / Google Play submission.
