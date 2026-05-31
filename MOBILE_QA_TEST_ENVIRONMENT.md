# Mobile QA Test Environment

Date: 2026-05-29
App: Eki Marketplace / Waqti
Workspace: `C:\Users\PC SOFT\Desktop\frontend italian`
Backend under test: `https://italian-market-place.vercel.app/api`

## Device / Emulator

Result: BLOCKED for real-device execution.

- Physical Android phone: none attached. `adb devices` returned no devices.
- Android emulator: Android SDK is installed, but no usable AVD existed initially.
- Temporary AVD attempted: `Codex_QA_API36`
- System image present: `system-images;android-36.1;google_apis_playstore;x86_64`
- Emulator boot result: FAIL, environment blocker.
- Exact blocker: emulator reports only about 2168 MB free at `C:\Users\PC SOFT\.android\avd\Codex_QA_API36.avd`, but needs 7372.80 MB to create userdata.
- iOS simulator: unavailable on this Windows machine. `xcrun` not found.

No real phone/emulator screenshots were captured because the app could not be launched on a device.

## Build Type

- Expo project: yes, Expo SDK 54.
- Real app launch: not completed.
- Expo Go/dev-client runtime: not verified on device.
- Native Stripe PaymentSheet: requires development build or standalone build; not runnable in Expo Go.

## Environment

`.env` values used:

- `EXPO_PUBLIC_API_BASE_URL=https://italian-market-place.vercel.app`
- `EXPO_PUBLIC_USE_MOCK_API=false`
- `EXPO_PUBLIC_APP_REVIEW_MODE=true`
- `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` present
- `EXPO_PUBLIC_SENTRY_ENABLE_DEV=false`

API client appends `/api/...` paths to the configured base URL, so runtime API calls target `https://italian-market-place.vercel.app/api/...`.

## Verification Commands

| Check | Result | Notes |
|---|---:|---|
| `npm.cmd run typecheck` | PASS | TypeScript completed with no errors after fixes. |
| `npm.cmd run check:no-mock-data` | PASS | 103 app files scanned. |
| `npm.cmd run check:no-screenshot-ui` | PASS | 103 app files scanned. |
| `npx.cmd expo-doctor` | PASS | Initially failed dependency patch versions; fixed and reran 18/18 passing. |
| Android bundle export | PASS | `expo export --platform android` completed. |
| iOS bundle export | PASS | `expo export --platform ios` completed. |
| Real Android boot | FAIL | Blocked by insufficient disk for emulator userdata. |
| Real UI tapping | BLOCKED | No connected device and emulator could not boot. |

## Dependency Fix Applied

`expo-doctor` initially reported these version mismatches:

- `expo`: found `54.0.34`, expected `~54.0.35`
- `expo-font`: found `14.0.11`, expected `~14.0.12`
- `expo-router`: found `6.0.23`, expected `~6.0.24`

Fixed by running:

```powershell
npm.cmd install expo@~54.0.35 expo-font@~14.0.12 expo-router@~6.0.24
npm.cmd install --save-dev babel-preset-expo@~54.0.10 --legacy-peer-deps
```

Final bundle export also exposed a missing `babel-preset-expo` dependency after the Expo patch update. It is now pinned to the SDK 54-compatible `~54.0.10`, and `expo-doctor` passes.

## Live Backend Smoke

| Endpoint | Result | Notes |
|---|---:|---|
| `GET /api/products?limit=1` | PASS 200 | Returned real product data. |
| `GET /api/subscriptions/plans` | PASS 200 | Returned plan data. |
| `GET /api/vendors?sort=newest&limit=4` | FAIL 401 | Backend requires Authorization; buyer public vendor list must degrade gracefully. |
| `GET /api/public/stores?limit=1` | FAIL 404 | No public store list endpoint found. |

## Environment Verdict

STATIC/BUNDLE QA PASS.

REAL-DEVICE QA BLOCKED by local machine constraints. The app is NOT READY for release sign-off until it opens on a physical phone or a bootable emulator/dev-client and the screen-by-screen tap pass is completed.
