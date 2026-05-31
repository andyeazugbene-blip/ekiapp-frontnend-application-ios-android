# Button-by-Button QA Report

Date: 2026-05-29

## Verdict

Static button audit PASS after fixes.

Real tap audit BLOCKED because no phone/emulator could run.

## Method

I scanned `app/**` and `components/**` for `TouchableOpacity` instances without `onPress` or `disabled`. All app-screen no-op touch targets found were fixed. The only remaining static hit is `components/ui/Card.tsx` `PressableCard`, a reusable component that receives `onPress` through props and has no current app usage.

## No-Op Buttons Fixed

| File | Button | Previous result | Fix | Status |
|---|---|---|---|---:|
| `app/(buyer)/index.tsx` | Hot Deals Get Reward | No handler | Navigates wallet | FIXED |
| `app/(buyer)/index.tsx` | Vendor View Details | Nested no handler | Navigates store | FIXED |
| `app/(buyer)/index.tsx` | Product heart | No handler | Clear coming-soon alert | FIXED |
| `app/(buyer)/explore.tsx` | Popular View All | No handler | Clears filters/reloads | FIXED |
| `app/(buyer)/explore.tsx` | New vendors View All | No handler | Clears filters/reloads | FIXED |
| `app/(buyer)/explore.tsx` | Product heart | No handler | Clear coming-soon alert | FIXED |
| `app/(buyer)/explore.tsx` | Support new vendors | No handler | Routes first vendor if available | FIXED |
| `app/(buyer)/product-detail.tsx` | Heart | Fake local liked state | Clear coming-soon alert | FIXED |
| `app/(buyer)/product-detail.tsx` | Chat | Routed to chat without selected conversation | Clear unavailable alert | FIXED |
| `app/(buyer)/vendor-detail.tsx` | Product heart | No handler | Clear coming-soon alert | FIXED |
| `app/(buyer)/message-chat.tsx` | Add/camera | No handler | Clear unavailable alert | FIXED |
| `app/(vendor)/message-chat.tsx` | Add/mic/camera | No handler | Clear unavailable alert | FIXED |
| `app/(buyer)/wallet.tsx` | Copy referral | No handler | Copies to clipboard or explains missing code | FIXED |
| `app/(buyer)/report-issue.tsx` | Submit issue | Fake close success | Clear missing-backend alert | FIXED |
| `app/(buyer)/report-issue.tsx` | Message Vendor | No handler | Clear guidance alert | FIXED |
| `app/(buyer)/report-issue.tsx` | Report an issue link | No handler | Reopens modal | FIXED |
| `app/(admin)/order-detail.tsx` | Message Vendor | No handler | Clear unavailable alert | FIXED |
| `app/(admin)/order-detail.tsx` | Message Buyer | No handler | Clear unavailable alert | FIXED |
| `app/(admin)/order-detail.tsx` | Flag Order | No handler | Clear unavailable alert | FIXED |
| `app/(admin)/vendor-detail.tsx` | Message | No handler | Clear unavailable alert | FIXED |
| `app/(admin)/vendors.tsx` | Review verification | No handler | Routes vendor detail | FIXED |
| `app/(admin)/vendors.tsx` | View activation | No handler | Routes vendor detail | FIXED |

## Button Categories Still Requiring Real Tap Pass

| Category | Runtime status |
|---|---:|
| Auth submit buttons with valid credentials | BLOCKED |
| Auth submit buttons with invalid credentials | BLOCKED |
| Buyer browse/product/cart/checkout buttons | BLOCKED |
| Wallet top-up button | BLOCKED |
| Vendor onboarding/product upload buttons | BLOCKED |
| R2 image picker/upload controls | BLOCKED |
| Vendor order status controls | BLOCKED |
| Admin protected action buttons | SKIPPED/BLOCKED |
| Logout/login/reload session buttons | BLOCKED |

## Final Button Verdict

No known silent no-op app buttons remain in source. Release still needs a physical tap pass.
