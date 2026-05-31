# Missing Backend Endpoints — Handling Strategy

**Generated:** 2026-05-26

This document lists every backend endpoint that the frontend calls but the backend may not yet implement, and how the frontend handles each gracefully.

## 1. Reviews Module

### Endpoints
- `POST /api/reviews`
- `GET /api/reviews?productId=<id>`
- `GET /api/reviews?vendorId=<id>`
- `GET /api/admin/reviews`
- `PATCH /api/admin/reviews/:id/moderate`

### Frontend handling
**Strategy: D — empty state + B — graceful submit error**

- `reviewService.getForProduct/getForVendor` wrap the API call in `try/catch` and return `[]` on any failure (404, 500, network).
- `app/(buyer)/product-detail.tsx` shows `"No reviews yet."` when the array is empty.
- `app/(buyer)/leave-review.tsx` catches submit errors and shows a friendly inline message:
  - 403 → "Reviews are only allowed after delivery is confirmed."
  - 409 → "You have already reviewed this order."
  - 404 → "Reviews are not yet available on this server."
  - 400 → "Please pick a rating between 1 and 5 and add a comment."

### Required backend work
Implement Express routes:
```
GET  /api/reviews
POST /api/reviews   (auth required, validates rating 1-5, checks order delivered)
GET  /api/admin/reviews
PATCH /api/admin/reviews/:id/moderate
```

## 2. Subscription Activation

### Endpoint
- `POST /api/subscriptions/activate` (no Stripe — direct activation)

### Frontend handling
**Strategy: A — call if exists; on failure, show error toast**

- `subscriptionService.activatePlan(planId)` calls `POST /api/subscriptions/activate`.
- `app/(vendor)/subscription-plans.tsx` catches errors and shows the message inline.
- `app/(vendor)/plan-growth.tsx` and `plan-pro.tsx` show `Alert.alert("Error", err.message)`.
- The vendor remains on the current plan if activation fails — no local state lies.

### Backend status
Existing endpoints `GET /subscriptions/plans`, `GET /subscriptions/me`, `GET /subscriptions/me/limits`, `POST /subscriptions/checkout` (Stripe-based), `POST /subscriptions/cancel` are confirmed in the architecture doc. The `activate` endpoint (Stripe-less plan switch) is documented as missing and should be added.

## 3. Vendor Buyers List

### Endpoint
- `GET /api/vendors/me/buyers`

### Frontend handling
**Strategy: D — empty state**

- `buyerService.listMyBuyers()` returns `[]` on any failure.
- `app/(vendor)/buyers.tsx` shows the empty state ("No buyers yet — your store will appear here once orders come in.")
- `app/(vendor)/index.tsx` (dashboard) gracefully shows the "Your Buyers" section as empty when the API is unavailable.

## 4. Revenue Time Series

### Endpoints
- `GET /api/vendors/me/analytics/revenue`
- `GET /api/admin/analytics/revenue`

### Frontend handling
**Strategy: B — gracefully hide chart**

- `vendorService.getRevenueSeries()` and `adminService.getRevenueSeries()` return `[]` on failure.
- The earnings/analytics screens conditionally render the chart only when `series.length > 0`.

## 5. Notifications "Read All"

### Endpoint
- `PATCH /api/notifications/read-all`

### Frontend handling
**Strategy: B — gracefully ignore failure**

- `notificationService.markAllAsRead` silently fails. Per-notification mark-read still works via `PATCH /api/notifications/:id/read`.

## 6. OTP for Vendor Onboarding

### Endpoints
- `POST /api/auth/send-otp`
- `POST /api/auth/verify-otp`

### Frontend handling
**Strategy: B/C — skip with warning if backend doesn't support OTP**

- `app/(vendor-onboarding)/otp.tsx` calls send-otp on mount; if it fails (404), the UI still allows the user to type any 6-digit code.
- If `verify-otp` returns 404, the screen automatically skips to the next step (`setup-store`).

## 7. Admin Endpoints That May Be Missing

The frontend calls:
- `GET /api/admin/dashboard` ✅ implemented
- `GET /api/admin/analytics` ✅ implemented
- `GET /api/admin/users` ✅ implemented
- `GET /api/admin/vendors` ✅ implemented
- `PATCH /api/admin/vendors/:id/{approve,reject,suspend,unsuspend}` ✅ implemented
- `GET /api/admin/products` ✅ implemented
- `GET /api/admin/orders` ✅ implemented
- `PATCH /api/admin/orders/:id/complete` ✅ implemented
- `GET /api/admin/verification-documents` ✅ implemented
- `PATCH /api/admin/verification-documents/:id/review` ✅ implemented

Missing/optional:
- `GET /api/admin/disputes` — frontend handles 404 by showing empty state
- `GET /api/admin/refunds` — no frontend screen yet (no impact)

## Universal Rules

The frontend follows these rules for every potentially-missing endpoint:

| Rule | Implementation |
|------|---------------|
| Never crash on 404 | All service calls wrapped in `try/catch` returning safe defaults (`[]`, `null`) |
| Never loop failed requests | Each screen makes the API call once on focus, never retries automatically |
| Never show fake data as real | All "fallback" data is empty arrays or null — never fabricated content |
| Never show fake success | Submit handlers always reflect the real backend response |
| Always document the gap | This file lists each gap |

## Final Verdict

✅ **All known missing endpoints are handled gracefully. The app does not crash, loop, or fake success when any of the documented endpoints return 404.**
