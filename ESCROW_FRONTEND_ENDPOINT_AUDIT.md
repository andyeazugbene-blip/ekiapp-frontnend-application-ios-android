# Escrow Frontend Endpoint Audit

Date: 2026-05-30
Backend base URL: `https://italian-market-place.vercel.app/api`

## Summary

- Buyer escrow order list uses `GET /api/orders/me`, not `GET /api/orders`.
- The backend escrow seed report stores the human `orderNumber`; action endpoints require the internal `order.id`.
- Vendor escrow confirmation only succeeds for orders in backend status `PAYMENT_SECURED`.
- Admin dispute resolution is connected, but the backend route currently succeeds without a 2FA header.

## Endpoint Matrix

| Endpoint | Purpose | Used by | Frontend service exists? | UI screen exists? | Status | Notes |
|---|---|---|---|---|---|---|
| `GET /api/orders/me` | List buyer orders | Buyer | `orderService.getBuyerOrders()` | `app/(buyer)/orders.tsx` | CONNECTED | Real buyer order list route. |
| `GET /api/orders/:id` | Buyer order detail | Buyer | `orderService.getBuyerOrderById()` | `app/(buyer)/track-order.tsx` | CONNECTED | Used for buyer tracking/detail. |
| `POST /api/orders/:id/confirm-delivery` | Buyer confirms delivery with 6-digit OTP | Buyer | `orderService.confirmBuyerDelivery()` | `app/(buyer)/track-order.tsx` | CONNECTED | Real OTP modal wired. No local completion is faked. |
| `POST /api/orders/:id/dispute` | Buyer opens dispute on dispatched escrow order | Buyer | `orderService.openBuyerDispute()` | `app/(buyer)/report-issue.tsx` | CONNECTED | Works only on `DISPATCHED` escrow orders. |
| `GET /api/vendors/me/orders` | Vendor order list | Vendor | `orderService.getVendorOrders()` | `app/(vendor)/orders.tsx` | CONNECTED | Includes escrow and non-escrow orders. |
| `GET /api/vendors/me/orders/:id` | Vendor order detail | Vendor | `orderService.getVendorOrderById()` | `app/(vendor)/order-detail.tsx`, `accept-order.tsx`, `mark-shipped.tsx` | CONNECTED | Uses internal `order.id`, not seed `orderNumber`. |
| `POST /api/vendors/me/orders/:id/confirm-escrow` | Vendor confirms escrow order | Vendor | `orderService.confirmVendorEscrowOrder()` | `app/(vendor)/accept-order.tsx`, `app/(vendor)/order-detail.tsx` | CONNECTED | Backend only allows `PAYMENT_SECURED -> VENDOR_CONFIRMED`. Current `ESCROW_PAID_HELD` seed is plain `PAID`, so UI now blocks the false action. |
| `POST /api/vendors/me/orders/:id/dispatch` | Vendor dispatches escrow order and gets delivery code | Vendor | `orderService.dispatchVendorEscrowOrder()` | `app/(vendor)/mark-shipped.tsx` | CONNECTED | Real delivery code returned and shown once. |
| `GET /api/vendors/me/earnings` | Vendor held vs available balances | Vendor | `payoutService.getEarnings()` | `app/(vendor)/earnings.tsx`, `app/(vendor)/order-detail.tsx` | CONNECTED | Uses backend pending/available balances only. |
| `POST /api/payout-requests` | Vendor requests payout | Vendor | `payoutService.requestPayout()` | `app/(vendor)/earnings.tsx` routes to payout flow | CONNECTED | Not escrow-specific, but used once balance is available. |
| `GET /api/admin/escrow/health` | Escrow health summary | Admin | `adminService.getEscrowHealth()` | `app/(admin)/disputes.tsx` | CONNECTED | Real outstanding order counts and amounts. |
| `GET /api/admin/disputes` | Disputes list | Admin | `adminService.getDisputes()` | `app/(admin)/disputes.tsx` | CONNECTED | Response uses `items`, not `disputes`. |
| `GET /api/admin/disputes/:id` | Dispute detail | Admin | `adminService.getDispute()` | `app/(admin)/dispute-detail.tsx` | CONNECTED | Order evidence fields are limited; no message thread payload yet. |
| `PATCH /api/admin/disputes/:id/resolve` | Resolve dispute for buyer/vendor/partial | Admin | `adminService.resolveDispute()` | `app/(admin)/dispute-detail.tsx` | CONNECTED | Real resolution is wired. Backend currently does not enforce `x-2fa-code` on this route. |
| `GET /api/admin/orders` | Admin order list | Admin | `adminService.getOrders()` | `app/(admin)/orders.tsx` | CONNECTED | Used for list and list-derived stats. |
| `GET /api/admin/orders/:id` | Dedicated admin order detail | Admin | No | `app/(admin)/order-detail.tsx` exists | GRACEFUL_FALLBACK | No dedicated endpoint found. Mobile detail falls back to list/order payloads. |
| `POST /api/admin/orders/:id/refund` | Direct admin refund | Admin | No dedicated mobile service | `app/(admin)/order-detail.tsx` has guidance only | NEEDS_UI | Route exists in backend but mobile uses dispute flow fallback instead of a direct refund form. |
| `GET /api/shipments/orders/:id` | Shipment detail | Vendor | `orderService.getShipmentByOrder()` | `app/(vendor)/order-detail.tsx` | CONNECTED | Used to show tracking state when available. |
| `POST /api/shipments/orders/:id` | Create shipment record | Vendor | `orderService.createShipment()` | `app/(vendor)/mark-shipped.tsx` | CONNECTED | For escrow dispatch, shipment save is best-effort after dispatch succeeds. |
| Vendor dispute evidence/messages endpoint | Vendor-specific dispute detail | Vendor | No | No dedicated screen | GRACEFUL_FALLBACK | Mobile vendor UI shows dispute freeze notice and routes review to admin/support workflow. |

## Exact Seed Data Still Needed

To fully verify the successful vendor accept step on real backend state, seed one escrow order with:

- `escrowType = DOMESTIC_AFRICA`
- `status = PAYMENT_SECURED`
- vendor owner = `seed_qa_escrow_vendor@example.com`
- buyer owner = `seed_qa_escrow_buyer@example.com`

Optional but recommended for secure admin QA:

- one admin user with 2FA enabled, so the mobile dispute resolution path can be tested with a real `x-2fa-code` challenge.
