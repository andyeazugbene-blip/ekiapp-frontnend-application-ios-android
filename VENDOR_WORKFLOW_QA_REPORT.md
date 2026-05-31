# Vendor Workflow QA Report

Date: 2026-05-29

## Verdict

Vendor workflow is NOT fully verified because no phone/emulator/dev-client could run.

Static/source checks pass after fixes, but R2 upload, image picker, product creation, dashboard, and order actions still need a real mobile pass.

## Vendor Flow Matrix

| Area | API/action | Expected | Actual | Status |
|---|---|---|---|---:|
| Vendor registration route | `/api/auth/register` | Creates vendor user and routes onboarding | Source inspected | RUNTIME BLOCKED |
| OTP | `/api/auth/send-otp`, `/api/auth/verify-otp` | Verify or graceful error | Source inspected | RUNTIME BLOCKED |
| Setup store | `POST /api/vendors` | Creates vendor profile, stores token | Source inspected | RUNTIME BLOCKED |
| Business info | auth profile update | Saves seller type | Source inspected | RUNTIME BLOCKED |
| Add product onboarding | image picker, `/api/uploads/request-url`, R2 PUT, `/api/products` | Upload image and create product | Source inspected | RUNTIME BLOCKED |
| Delivery onboarding | `/api/delivery/zones/me` | Creates delivery zones | Source inspected | RUNTIME BLOCKED |
| Store ready | navigation | Routes dashboard | Source inspected | RUNTIME BLOCKED |
| Dashboard | `/api/vendors/me`, dashboard, products, orders, conversations, buyers, zones, subscriptions | Real metrics only | Source inspected | STATIC PASS |
| Product list | `/api/products?vendorId` | List or empty | Source inspected | RUNTIME BLOCKED |
| Product add/edit/detail | uploads, R2, products API | Real CRUD | Source inspected | RUNTIME BLOCKED |
| Vendor orders | `/api/vendors/me/orders` | List and status actions | Source inspected | RUNTIME BLOCKED |
| Accept order | order status API | Accept or clear error | Source inspected | RUNTIME BLOCKED |
| Mark shipped | shipment API | Shipment created/updated | Source inspected | RUNTIME BLOCKED |
| Buyers | `/api/vendors/me/buyers` | Buyers or empty, no PII leak | Source inspected | RUNTIME BLOCKED |
| Earnings | `/api/vendors/me/earnings` | Real revenue or zero/empty | Source inspected | RUNTIME BLOCKED |
| Payout methods | `/api/vendors/me/payout-methods` | Add/default/delete methods | Source inspected | RUNTIME BLOCKED |
| Withdraw payout | `/api/payout-requests` | Real request or error | Source inspected | RUNTIME BLOCKED |
| Subscriptions/paywall | `/api/subscriptions/*` | Read-only status/locked messages | `GET /api/subscriptions/plans` returned 200 | STATIC PASS |
| Messages/chat | `/api/conversations` | Text chat; unsupported attachments explained | No-op attachment buttons fixed | FIXED |

## Button Results

| Screen | Button | API/action | Expected | Actual | Status |
|---|---|---|---|---|---:|
| Vendor dashboard | Menu | Open drawer | Drawer opens | Source inspected | RUNTIME BLOCKED |
| Vendor dashboard | Notifications | Route notifications | Opens notifications | Source inspected | RUNTIME BLOCKED |
| Vendor dashboard | Alert rows | Route orders/products/messages | Correct route | Source inspected | RUNTIME BLOCKED |
| Vendor dashboard | Grow sales cards | Route marketing tools | Correct route | Source inspected | RUNTIME BLOCKED |
| Vendor dashboard | Continue setup | Route activation | Correct route | Source inspected | RUNTIME BLOCKED |
| Vendor product add/edit | Upload Image | Image picker/R2 | Real upload | Source inspected | RUNTIME BLOCKED |
| Vendor product add/edit | Save | `/api/products` | Product saved | Source inspected | RUNTIME BLOCKED |
| Vendor product detail | Activate/deactivate | product patch/delete | Real state change | Source inspected | RUNTIME BLOCKED |
| Vendor orders | Order rows | Route detail | Opens detail | Source inspected | RUNTIME BLOCKED |
| Vendor order detail | Accept/status | order status API | Real status update | Source inspected | RUNTIME BLOCKED |
| Vendor earnings | Withdraw | Route withdraw | Opens withdraw | Source inspected | RUNTIME BLOCKED |
| Vendor payout | Submit | `/api/payout-requests` | Real payout request | Source inspected | RUNTIME BLOCKED |
| Vendor subscriptions | Refresh | `/api/subscriptions/me` | Refresh status | Source inspected | RUNTIME BLOCKED |
| Vendor chat | Add/mic/camera | unavailable alert | No silent no-op | Fixed | FIXED |
| Vendor chat | Send | message API | Disabled empty, sends text | Source inspected | RUNTIME BLOCKED |

## Remaining Vendor Blockers

- No real-device image picker/R2 upload verification.
- No vendor test account created in this run.
- No Stripe/dev-client native payment verification.
- No vendor dashboard metrics were visually verified on device.
