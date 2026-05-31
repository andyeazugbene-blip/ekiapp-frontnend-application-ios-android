# Mobile App Full Workflow QA Report

Date: 2026-05-29

## Final Verdict

NOT READY.

Reason: the requested real phone/emulator screen-by-screen and button-by-button QA could not be completed on this machine. Static checks and bundle checks pass, and multiple source issues were fixed, but acceptance requires the app to open on a real phone/emulator/dev-client.

## Device / Build

- Device used: none; no physical Android attached.
- Emulator attempted: `Codex_QA_API36`.
- Emulator result: failed to boot, insufficient disk for userdata.
- iOS simulator: unavailable on Windows.
- Build type verified: Expo static native bundle export for Android and iOS.
- Runtime build verified: none.

## Backend / Env

- Backend URL: `https://italian-market-place.vercel.app/api`
- `EXPO_PUBLIC_USE_MOCK_API=false`
- No localhost API URLs found by script.
- Public products endpoint: 200.
- Subscription plans endpoint: 200.
- Public vendor list endpoint: 401.
- Public store list endpoint: 404.

## Screens Tested

- Static inventory: 96 app routes.
- Source checks: 103 app files.
- Real-device screen testing: BLOCKED.
- Admin runtime testing: SKIPPED/BLOCKED due no device and no admin credentials.

See `MOBILE_SCREEN_QA_MATRIX.md` for the route-by-route matrix.

## Buttons Tested

- Static no-op scan found multiple no-handler touch targets.
- All app-screen no-op touch targets found were fixed.
- Real physical taps were not executed.

See `BUTTON_BY_BUTTON_QA_REPORT.md`.

## Bugs Found And Fixed

| Bug | Fix |
|---|---|
| Expo SDK patch versions failed `expo-doctor` | Updated `expo`, `expo-font`, `expo-router`; doctor now passes. |
| Android bundle export could not resolve `babel-preset-expo` | Added `babel-preset-expo@~54.0.10`; Android/iOS exports now pass. |
| Buyer dashboard/explore could blank products when protected vendor endpoint returned 401 | Product and vendor API loads now fail independently. |
| Checkout showed success/cleared cart when Stripe PaymentSheet unavailable | Unsupported native Stripe now shows dev-client error before card checkout. |
| Wallet debit errors were swallowed before clearing cart | Wallet applies must succeed before cart clear. |
| Product detail showed fake delivery country/estimate | Replaced with cart-calculation copy. |
| Buyer vendor detail showed hardcoded delivery countries | Uses delivery zones/vendor country or empty state. |
| Admin dashboard hardcoded avg review time | Uses backend value or empty state. |
| Multiple buyer/admin/chat/wallet touchables had no handler | Added navigation, clipboard, disabled/unavailable alerts, or backend-safe behavior. |
| Report issue submit looked like success without backend endpoint | Now states issue-report endpoint is unavailable. |

## Remaining Blockers

1. Real device/emulator/dev-client run is still required.
2. Local machine needs more free disk space or a connected physical phone.
3. Public vendor list/detail backend contract is missing/protected for buyer browsing.
4. R2 image upload was not executed on device.
5. Stripe native PaymentSheet was not executed in a dev-client build.
6. Auth/register/login/logout/reload flows were not executed with real credentials.
7. Admin flows need credentials and real device verification.

## Final Verification Commands

| Command | Result |
|---|---:|
| `npm.cmd run typecheck` | PASS |
| `npm.cmd run check:no-mock-data` | PASS |
| `npm.cmd run check:no-screenshot-ui` | PASS |
| `npx.cmd expo-doctor` | PASS |
| `expo export --platform android` | PASS |
| `expo export --platform ios` | PASS |

## Release Decision

Do not release as real-device QA passed.

The codebase is in a better QA state after this pass, but the app still needs a real mobile smoke and full workflow run before marking `MOBILE APP REAL-DEVICE QA PASS`.
