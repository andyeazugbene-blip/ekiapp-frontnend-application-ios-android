# Mobile Crash / Error Monitoring Report

Date: 2026-05-29

## Verdict

No Metro/device crash monitoring could be completed because the app did not run on a phone/emulator.

Static build checks and bundle exports passed after fixes.

## Runtime Log Sources

| Source | Result |
|---|---:|
| Metro console during real app session | BLOCKED |
| Android `adb logcat` | BLOCKED, no booted device |
| iOS simulator logs | BLOCKED, Windows machine |
| Red screen inspection | BLOCKED |
| App reload with stored token | BLOCKED |

## Errors Found During QA

| Error | Source | Status | Fix/Disposition |
|---|---|---:|---|
| `expo-doctor` package mismatch | Expo doctor | FIXED | Updated `expo`, `expo-font`, `expo-router`. |
| Android bundle missing `babel-preset-expo` | Expo export | FIXED | Added `babel-preset-expo@~54.0.10` as a dev dependency. |
| Android emulator no AVD | Environment | PARTIAL | Created temporary AVD. |
| Emulator boot fatal: not enough space for userdata | Android emulator | BLOCKER | Needs at least 7.3 GB free or different emulator image/device. |
| Public vendor list returns 401 | Live API smoke | FIXED IN UI | Buyer product loading no longer depends on vendor list success. Backend public vendor list still missing/protected. |
| Public vendor detail by id returns 401 | Live API smoke | BLOCKER/UX | Vendor detail route may require store slug/public endpoint. Documented for backend/navigation follow-up. |
| Stripe unsupported path showed success/cleared cart | Source review | FIXED | Now errors before creating card checkout in Expo Go/no PaymentSheet. |
| Wallet apply failures swallowed | Source review | FIXED | Wallet debit must succeed before clearing cart. |
| No-op buttons | Static scan | FIXED | All app-screen no-op touchables fixed. |

## Not Observed Due Blocker

- Red screen
- Unhandled promise rejection
- Maximum update depth
- Cannot read property undefined
- NaN prices
- Missing image crash
- Navigation route not found
- Repeated 401/404 loop on device

These must be monitored on a booted phone/emulator before release sign-off.
