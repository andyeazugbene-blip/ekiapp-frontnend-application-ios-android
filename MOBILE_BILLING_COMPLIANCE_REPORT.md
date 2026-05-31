# Mobile Billing Compliance Report

**Date:** 2026-05-29  
**Scope inspected:** Expo mobile workspace at `C:\Users\PC SOFT\Desktop\frontend italian`

## Verdict

**NOT READY with blockers**

Mobile App Review safe mode is implemented, but the requested backend source/tests are not present in this workspace. Full release readiness cannot be proven until the backend safeguards and tests are verified in the backend repository or staging environment.

## Mobile changes completed

- Removed direct subscription checkout/open-link behavior from `services/subscriptionService.ts`.
- Paid plan activation from mobile now fails locally with controlled `409`-style `SUBSCRIPTIONS_NOT_AVAILABLE`.
- Kept free plan activation as the only mobile `POST /api/subscriptions/activate` path.
- Replaced subscription plan selection with read-only plan status and usage limits.
- Added "Refresh plan status" actions that call backend subscription status/limits endpoints.
- Updated vendor dashboard plan display to use `GET /api/subscriptions/me` and `/me/limits`.
- Replaced premium locked states with neutral copy: "This feature is not available on your current plan."
- Updated vendor dashboard plan card copy from paid upgrade CTA to plan status only.
- Tightened premium feature gates to fail closed until backend limits load.
- Set `EXPO_PUBLIC_APP_REVIEW_MODE=true` in `.env`, `.env.example`, and all EAS build profiles.
- Added `npm run check:billing-compliance`.
- Added `npm run check:subscription-backend-contract` for staging/backend verification with a vendor test token.
- Added `APP_STORE_BILLING_COMPLIANCE_NOTE.md`.

## Mobile files changed

- `services/subscriptionService.ts`
- `services/api/config.ts`
- `app/(vendor)/subscription-plans.tsx`
- `app/(vendor)/plan-free.tsx`
- `app/(vendor)/plan-growth.tsx`
- `app/(vendor)/plan-pro.tsx`
- `app/(vendor)/plan-active.tsx`
- `app/(vendor)/paywall-limit.tsx`
- `app/(vendor)/upgrade-prompt.tsx`
- `app/(vendor)/grow-sales.tsx`
- `app/(vendor)/foodstuff-add.tsx`
- `app/(vendor)/create-discount.tsx`
- `app/(vendor)/create-bundle.tsx`
- `app/(vendor)/create-flash-sale.tsx`
- `app/(vendor)/send-offer.tsx`
- `app/(vendor)/index.tsx`
- `components/vendor/ReadOnlyPlanStatus.tsx`
- `hooks/usePlanLimits.ts`
- `scripts/check-billing-compliance.js`
- `scripts/check-subscription-backend-contract.js`
- `package.json`
- `.env`
- `.env.example`
- `eas.json`
- `APP_STORE_BILLING_COMPLIANCE_NOTE.md`

## Backend verification status

Blocked in this workspace:

- Backend source code is not present.
- Backend tests are not present.
- No local test harness exists for Stripe webhook or subscription DB behavior.
- No authenticated staging credentials were provided for live endpoint verification.

Required backend evidence before final approval:

- Paid `POST /api/subscriptions/activate` returns `409 SUBSCRIPTIONS_NOT_AVAILABLE`.
- Free `POST /api/subscriptions/activate` succeeds.
- `GET /api/subscriptions/me` returns DB/backend subscription state.
- `GET /api/subscriptions/me/limits` returns DB/backend limits.
- Stripe webhook updates backend subscription status after confirmed payment.
- Plan limits are enforced server-side.
- No client-only plan override can unlock features.

Added backend smoke checker:

```bash
SUBSCRIPTION_TEST_TOKEN=<vendor-test-token> SUBSCRIPTION_TEST_ALLOW_MUTATION=true npm.cmd run check:subscription-backend-contract
```

This was not run because no authenticated backend test token was available in the workspace.

## Verification run

```bash
npm.cmd run typecheck
npm.cmd run check:billing-compliance
node scripts/check-subscription-backend-contract.js
npx.cmd expo export --platform ios --clear
npx.cmd expo export --platform android --clear
```

Results:

- TypeScript check passed.
- Billing compliance scan passed across 104 mobile source files.
- Backend contract checker syntax passed with `node --check`; live contract verification was not run because `SUBSCRIPTION_TEST_TOKEN` was not available.
- iOS Expo export passed.
- Android Expo export passed.

Note: Expo exports required executing the local Hermes compiler (`hermesc.exe`) and used a workspace-local temp directory because the default Windows temp cache was not writable in the sandbox.

## Final blocker

The mobile app is App Review-safe from the inspected source, but the full requested billing compliance state is **NOT READY** until backend safeguards and backend tests are verified.
