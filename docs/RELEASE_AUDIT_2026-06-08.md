# Eki Release Audit

Last updated: 2026-06-08

## Executive Summary

Current release status: `PARTIALLY READY - CORE APP FLOWS VERIFIED, STORE / LIVE OPS EVIDENCE STILL REQUIRED`

What is confirmed from this workspace:
- Mobile app TypeScript passes
- Admin web TypeScript passes
- Mock-data / screenshot-UI / old-domain / billing-compliance checks pass
- Privacy, terms, support, and account-deletion screens and links exist in the app
- Admin role-gating, user suspension, dispute resolution, role management, notification registration, and escrow UI flows are implemented in code
- Stripe native PaymentSheet integration exists for dev-client / standalone builds
- Account deletion is wired to a real backend endpoint from the app
- A seeded live escrow QA order was previously verified through the core order lifecycle:
  `PAYMENT_SECURED -> VENDOR_CONFIRMED -> DISPATCHED -> COMPLETED`
- Delivery OTP generation, hashing/storage, and buyer OTP confirmation were previously verified on the live backend

What is not yet proven from this workspace:
- Play Console approval status
- Play Console release track screenshot
- Play Console pre-launch report screenshot
- Play Console Data Safety screenshots
- Real App Store / Play Store submission evidence
- End-to-end push delivery on a physical device
- End-to-end real Stripe card payment on the final release build
- Backend/database security posture from the actual backend repository and deployment environment
- Real-user UAT evidence

## Submitted App Identity

Source of truth:
- [app.json](/C:/Users/PC%20SOFT/Desktop/frontend%20italian/app.json)
- [package.json](/C:/Users/PC%20SOFT/Desktop/frontend%20italian/package.json)
- [codemagic.yaml](/C:/Users/PC%20SOFT/Desktop/frontend%20italian/codemagic.yaml)

Current version metadata:

| Field | Value |
| --- | --- |
| App name | `Eki` |
| Mobile app version | `1.0.10` |
| iOS bundle identifier | `com.ekiapp.mobilee` |
| iOS build number | `10` |
| Android package | `com.ekiapp.mobile` |
| Android version code | `13` |
| iOS upload target in Codemagic | TestFlight via App Store Connect integration `EKI` |

Release-track status from repo only:
- iOS build automation is configured in [codemagic.yaml](/C:/Users/PC%20SOFT/Desktop/frontend%20italian/codemagic.yaml)
- Actual submitted build / track / approval screenshots are **not available in this repo**

## Compliance Links

Confirmed in app config / app screens:

| Item | URL |
| --- | --- |
| Privacy policy | `https://culinarytales.app/privacy` |
| Terms of service | `https://culinarytales.app/terms` |
| Support | `https://culinarytales.app/support` |
| Account deletion | `https://www.culinarytales.app/account-deletion` |

Relevant files:
- [app/privacy.tsx](/C:/Users/PC%20SOFT/Desktop/frontend%20italian/app/privacy.tsx)
- [app/terms.tsx](/C:/Users/PC%20SOFT/Desktop/frontend%20italian/app/terms.tsx)
- [app/support.tsx](/C:/Users/PC%20SOFT/Desktop/frontend%20italian/app/support.tsx)
- [app/account-deletion.tsx](/C:/Users/PC%20SOFT/Desktop/frontend%20italian/app/account-deletion.tsx)

Note:
- The app has in-app legal navigation and a real delete-account request flow
- The account-deletion screen calls backend endpoint `POST /api/me/delete-account`

## Local Verification Results

Commands run on 2026-06-08:

| Command | Result |
| --- | --- |
| `npm.cmd run typecheck` | PASS |
| `cd admin-web && npm.cmd run typecheck` | PASS |
| `npm.cmd run check:no-mock-data` | PASS |
| `npm.cmd run check:no-screenshot-ui` | PASS |
| `npm.cmd run check:no-old-domain` | PASS |
| `npm.cmd run check:billing-compliance` | PASS |

Current working tree note:
- Local changes currently exist in `app.json`, `package.json`, `package-lock.json`, and this audit document
- This audit does not assume those local changes are already pushed unless separately confirmed

## Store Console Evidence Still Required

These items were requested by the client and cannot be produced from this repo alone:

1. Play Console approval status screenshot
2. Submitted version number screenshot from Play Console
3. Release track screenshot (`internal`, `closed`, `production`)
4. Play Console pre-launch report screenshot
5. Play Console Data Safety screenshots
6. App Store Connect submission / TestFlight processing screenshots if requested

Status: `MANUAL CONSOLE EVIDENCE REQUIRED`

## Auth / Roles / Admin Protection

Confirmed in code:
- Mobile app routes gate users by role in:
  - [app/(buyer)/_layout.tsx](/C:/Users/PC%20SOFT/Desktop/frontend%20italian/app/(buyer)/_layout.tsx)
  - [app/(vendor)/_layout.tsx](/C:/Users/PC%20SOFT/Desktop/frontend%20italian/app/(vendor)/_layout.tsx)
  - [app/(admin)/_layout.tsx](/C:/Users/PC%20SOFT/Desktop/frontend%20italian/app/(admin)/_layout.tsx)
- Admin web rejects non-admin users in:
  - [admin-web/src/contexts/AuthContext.tsx](/C:/Users/PC%20SOFT/Desktop/frontend%20italian/admin-web/src/contexts/AuthContext.tsx)
  - [admin-web/src/app/forbidden/page.tsx](/C:/Users/PC%20SOFT/Desktop/frontend%20italian/admin-web/src/app/forbidden/page.tsx)
- API client maps `403` and `423` into explicit permission / suspension errors in:
  - [services/api/client.ts](/C:/Users/PC%20SOFT/Desktop/frontend%20italian/services/api/client.ts)

Client-requested admin capabilities confirmed in code:
- suspend / unsuspend user
- delete user
- approve / reject / suspend / unsuspend vendor
- resolve disputes
- manage admin roles / permissions

Key files:
- [services/adminService.ts](/C:/Users/PC%20SOFT/Desktop/frontend%20italian/services/adminService.ts)
- [admin-web/src/lib/services/users.api.ts](/C:/Users/PC%20SOFT/Desktop/frontend%20italian/admin-web/src/lib/services/users.api.ts)
- [admin-web/src/lib/services/roles.api.ts](/C:/Users/PC%20SOFT/Desktop/frontend%20italian/admin-web/src/lib/services/roles.api.ts)
- [admin-web/src/lib/services/disputes.api.ts](/C:/Users/PC%20SOFT/Desktop/frontend%20italian/admin-web/src/lib/services/disputes.api.ts)

Status: `CODE CONFIRMED / LIVE ROLE ENFORCEMENT STILL NEEDS BACKEND+DEVICE VERIFICATION`

## Moderation / Report / Block Status

Confirmed:
- Buyer can open an order dispute / report issue from tracked orders:
  - [app/(buyer)/track-order.tsx](/C:/Users/PC%20SOFT/Desktop/frontend%20italian/app/(buyer)/track-order.tsx)
  - [app/(buyer)/report-issue.tsx](/C:/Users/PC%20SOFT/Desktop/frontend%20italian/app/(buyer)/report-issue.tsx)
- Admin can suspend / unsuspend users and vendors:
  - [app/(admin)/buyers.tsx](/C:/Users/PC%20SOFT/Desktop/frontend%20italian/app/(admin)/buyers.tsx)
  - [services/adminService.ts](/C:/Users/PC%20SOFT/Desktop/frontend%20italian/services/adminService.ts)
  - [admin-web/src/app/users/page.tsx](/C:/Users/PC%20SOFT/Desktop/frontend%20italian/admin-web/src/app/users/page.tsx)

Not clearly confirmed from this repo:
- A dedicated end-user "block user" social/chat blocking flow for buyers/vendors

Status:
- Report / dispute moderation: `IMPLEMENTED`
- User suspension moderation: `IMPLEMENTED`
- End-user block user flow: `NOT FULLY CONFIRMED`

## Order Flow

Confirmed in code:
- Buyer cart / checkout path exists
- Vendor order listing, acceptance, shipment updates, and tracking UI exist
- Admin order listing and completion UI exist
- Escrow-specific status helpers exist

Relevant files:
- [stores/cartStore.ts](/C:/Users/PC%20SOFT/Desktop/frontend%20italian/stores/cartStore.ts)
- [services/cartService.ts](/C:/Users/PC%20SOFT/Desktop/frontend%20italian/services/cartService.ts)
- [services/orderService.ts](/C:/Users/PC%20SOFT/Desktop/frontend%20italian/services/orderService.ts)
- [services/escrowStatus.ts](/C:/Users/PC%20SOFT/Desktop/frontend%20italian/services/escrowStatus.ts)
- [app/(vendor)/orders.tsx](/C:/Users/PC%20SOFT/Desktop/frontend%20italian/app/(vendor)/orders.tsx)
- [app/(vendor)/order-detail.tsx](/C:/Users/PC%20SOFT/Desktop/frontend%20italian/app/(vendor)/order-detail.tsx)
- [app/(buyer)/orders.tsx](/C:/Users/PC%20SOFT/Desktop/frontend%20italian/app/(buyer)/orders.tsx)
- [app/(buyer)/track-order.tsx](/C:/Users/PC%20SOFT/Desktop/frontend%20italian/app/(buyer)/track-order.tsx)

Live QA evidence already available:
- A seeded live escrow QA order was driven through buyer payment secured, vendor confirmation, dispatch, and buyer completion
- OTP generation and buyer OTP verification were confirmed on that live order

Status:
- `CONFIRMED FOR CORE ORDER FLOW`
- `ADDITIONAL UAT STILL RECOMMENDED FOR FINAL SIGN-OFF`

## Escrow Flow

Documented vendor education exists:
- [app/(vendor)/escrow-guide.tsx](/C:/Users/PC%20SOFT/Desktop/frontend%20italian/app/(vendor)/escrow-guide.tsx)

Exact escrow flow implemented in product copy and services:
1. Buyer places supported protected order
2. Payment is secured
3. Vendor confirms the order
4. Vendor dispatches
5. Backend generates and stores delivery OTP
6. Buyer receives OTP by configured channel
7. Buyer confirms delivery with OTP
8. Backend verifies OTP
9. Eligible funds release unless a dispute is opened
10. Dispute freezes release until admin resolves it

Prior live verification already performed and relied on in this audit:
- A seeded escrow test order was pushed through:
  `PAYMENT_SECURED -> VENDOR_CONFIRMED -> DISPATCHED -> COMPLETED`
- OTP generation, storage, and verification worked
- SMS delivery failed because Africa's Talking reported `InsufficientBalance`
- Real payout release was not fully proven because live payout secret/config was missing in that environment

Status:
- Escrow state machine: `CONFIRMED`
- Buyer OTP generation/storage/verification: `CONFIRMED`
- Real SMS delivery to buyer phone: `FAILED DUE PROVIDER BALANCE`
- Real payout release: `NOT FULLY VERIFIED`

## Payment Flow

Stripe:
- Native PaymentSheet implementation exists in:
  - [services/stripePayment.ts](/C:/Users/PC%20SOFT/Desktop/frontend%20italian/services/stripePayment.ts)
  - [components/providers/StripeProvider.tsx](/C:/Users/PC%20SOFT/Desktop/frontend%20italian/components/providers/StripeProvider.tsx)
- Checkout uses native Stripe only when the Stripe module is available in dev-client / standalone builds
- Expo Go returns an explicit `unsupported` result

Web Stripe:
- Public web checkout uses Stripe Elements in:
  - [components/publicStore/WebStripeCheckoutForm.web.tsx](/C:/Users/PC%20SOFT/Desktop/frontend%20italian/components/publicStore/WebStripeCheckoutForm.web.tsx)

Important limitation:
- Current Codemagic config exposes a `pk_test_...` Stripe publishable key
- Repo evidence does not prove that live store builds are using live Stripe credentials

Status:
- Payment integration code: `IMPLEMENTED`
- Real release-build card payment: `NOT FULLY VERIFIED`
- Live-key confirmation: `REQUIRED BEFORE LAUNCH`

## Push Notifications

Confirmed in code:
- Notification fetch/read/preferences endpoints exist
- Push-token registration and unregister are implemented
- Expo notification permission handling exists

Files:
- [services/notificationService.ts](/C:/Users/PC%20SOFT/Desktop/frontend%20italian/services/notificationService.ts)
- [stores/authStore.ts](/C:/Users/PC%20SOFT/Desktop/frontend%20italian/stores/authStore.ts)

Status:
- `CODE CONFIRMED`
- `LIVE DEVICE DELIVERY NOT YET PROVEN IN THIS AUDIT`

## Account Deletion

Confirmed:
- In-app delete-account screen exists
- It calls a real backend endpoint: `POST /api/me/delete-account`
- It handles blocked deletions when active orders / obligations remain

Files:
- [services/authService.ts](/C:/Users/PC%20SOFT/Desktop/frontend%20italian/services/authService.ts)
- [app/account-deletion.tsx](/C:/Users/PC%20SOFT/Desktop/frontend%20italian/app/account-deletion.tsx)

Status: `IMPLEMENTED IN CODE / LIVE BACKEND RESPONSE SHOULD STILL BE SPOT-CHECKED`

## Test Accounts

Repo-confirmed values:
- Support email: `adminandy@eki.app`

Values seen in code or prior live testing, but not all fully repo-authoritative:
- Admin login placeholder in mobile/admin UI: `admin@eki.com`
- Older README dev credentials are placeholder values and should **not** be trusted for release:
  - [README.md](/C:/Users/PC%20SOFT/Desktop/frontend%20italian/README.md)

Previously live-tested seeded escrow accounts:
- Buyer: `escrow-buyer-mq178kqp@eki.app`
- Vendor: `escrow-vendor-mq178kqp@eki.app`
- Password used in prior live setup: `Abdou22314`

Previously referenced QA accounts from live backend work:
- `buyer@eki.app`
- `vendor@eki.app`
- `vendor2@eki.app`

Status:
- Buyer / vendor QA accounts: `CONFIRMED FROM PRIOR LIVE QA`
- Admin login sheet: `STILL REQUIRES FINAL LIVE CREDENTIAL CONFIRMATION`

## Backend / Database Security Confirmation

What can be confirmed from this repo:
- Frontend and admin web expect authenticated endpoints for role-sensitive actions
- Admin web rejects non-admin responses
- Mobile role layouts redirect users away from the wrong surface
- Sensitive admin actions support 2FA headers in client code

What cannot be confirmed from this repo alone:
- Actual backend authorization middleware
- Database row-level rules / Prisma policies / SQL grants
- Secret rotation and environment variable hygiene on the live deployment
- Webhook signature verification in the actual backend codebase
- Storage bucket policies

Status: `NEEDS BACKEND REPO + DEPLOYMENT AUDIT`

## Real-User Testing Requirement

Client request:
- Real users will test in the coming days and provide emails

Recommended process before public launch:
1. Prepare a tester account matrix (buyer / vendor / admin)
2. Share exact build numbers and install links
3. Track each tester email, device, OS version, and role
4. Collect screenshots / videos / reproduction steps
5. Re-run this audit after real-user UAT

Status: `NOT STARTED IN THIS AUDIT`

## Client Request Matrix

| Client asks for | Current status |
| --- | --- |
| Play Console approval status screenshot | MANUAL EVIDENCE REQUIRED |
| Submitted version number | CONFIRMED IN REPO (`1.0.10`, iOS build `10`, Android code `13`) |
| Release track | MANUAL EVIDENCE REQUIRED |
| Pre-launch report | MANUAL EVIDENCE REQUIRED |
| Data Safety screenshots | MANUAL EVIDENCE REQUIRED |
| Privacy / terms links | CONFIRMED |
| Backend / DB security rules confirmation | PARTIAL - FRONTEND EXPECTATIONS ONLY |
| Stripe payment flow confirmation | PARTIAL - CODE CONFIRMED, REAL RELEASE PAYMENT NOT FULLY VERIFIED |
| Test login details for buyer / vendor / admin | PARTIAL - NEED FINAL LIVE CREDENTIAL SHEET |
| Report user tested end-to-end | PARTIAL - dispute/report flow exists, end-to-end proof incomplete |
| Block user tested end-to-end | NOT FULLY CONFIRMED |
| Moderation tested end-to-end | PARTIAL - code exists, live proof incomplete |
| Order flow tested end-to-end | CONFIRMED - SEE LIVE ESCROW QA ORDER |
| Payment flow tested end-to-end | PARTIAL |
| Push notifications tested end-to-end | PARTIAL |

## Launch Recommendation

Recommendation today: `DO NOT CALL THIS FULLY LAUNCH-APPROVED YET`

Required before we send the client a final "ready to launch" answer:
1. Capture the missing Play Console screenshots
2. Confirm the actual submitted release track
3. Verify live Stripe keys are used in the release environment
4. Run one release-build payment on device
5. Run one physical-device push notification test
6. Verify final buyer / vendor / admin login sheet from live backend
7. Audit the actual backend repo / deployment security posture
8. Complete real-user UAT with the client-provided tester emails

## What Moved From Partial To Confirmed

The following items are now treated as confirmed in this audit based on the
combination of code review, local verification, and prior live QA evidence:

1. Core order flow tested end-to-end
   - confirmed from the seeded live escrow QA order that progressed through
     secured payment, vendor confirmation, dispatch, and completion
2. Escrow state machine
   - confirmed from the same live QA order
3. Buyer OTP generation and OTP verification
   - confirmed from the live escrow QA order
4. Buyer / vendor QA test accounts
   - confirmed from prior live QA setup

Items that remain partial are partial for a real reason, not because the audit
was incomplete:
- store-console screenshots are manual evidence only
- Stripe release-build payments still need a real card/live-key pass
- push notifications still need a physical-device delivery proof
- backend/database security still needs the actual backend repo + deployment audit
- admin credentials still need a final client-facing credential sheet
