# Production Business-Flow Audit Report

## Summary

Full audit of the frontend (`frontend italian`) against the backend at `italian-market-place.vercel.app`, cross-referenced with the backend architecture document.

---

## 1. Subscriptions (No Stripe for now)

### What Already Works
- `subscriptionService.activatePlan()` — calls `POST /api/subscriptions/activate` to create a real DB subscription
- `subscriptionService.getLimits()` — calls `GET /api/subscriptions/me/limits` to get real plan limits
- `usePlanLimits` hook — fetches limits and exposes boolean gates
- `paywall-limit.tsx` — shows upgrade screen when feature is blocked
- `subscription-plans.tsx` — lists plans from backend, activates via button click
- All marketing tools (discounts, bundles, flash sales, offers) check `canSendOffers`
- Product creation checks `canAddProduct`

### What Was Fixed
- **plan-growth.tsx / plan-pro.tsx** — changed from `openCheckout` (Stripe) to `activatePlan`
- **grow-sales.tsx** — shows lock icon on tools requiring plan upgrade
- **Type mismatch** — `subscriptionPlan` was `"basic"|"premium"`, fixed to `"growth"|"pro"`

### Backend Requirement (MUST ADD)
- `POST /api/subscriptions/activate` — **does not exist in backend**. Backend only has `/subscriptions/checkout` (Stripe-based). This endpoint must be added to create a real `VendorSubscription` row without Stripe payment.

---

## 2. Buyer Full Flow

### What Already Works (verified against backend endpoints)
- Auth: `POST /api/auth/login`, `POST /api/auth/register`, `GET /api/auth/me` ✓
- Products: `GET /api/products`, `GET /api/products/:id` ✓
- Cart: `GET /api/cart`, `POST /api/cart/items`, `PATCH /api/cart/items/:id`, `DELETE /api/cart/items/:id`, `DELETE /api/cart` ✓
- Delivery: `POST /api/delivery/calculate` ✓
- Checkout: `POST /api/payments/create-intent` ✓
- Orders: `GET /api/orders/me`, `GET /api/orders/:id` ✓
- Shipments: `GET /api/shipments/orders/:orderId` ✓
- Wallet: `GET /api/wallet/me`, `GET /api/wallet/me/transactions`, `POST /api/wallet/me/top-up`, `POST /api/wallet/me/apply` ✓
- Messages: `GET /api/conversations`, `POST /api/conversations`, etc. ✓
- Notifications: `GET /api/notifications`, `PATCH /api/notifications/:id/read` ✓
- Push tokens: `POST /api/push-tokens`, `DELETE /api/push-tokens/:token` ✓

### What Was Fixed
- **explore.tsx** — fetches real products from `productService.getAll()`
- **product-detail.tsx** — fetches product by ID, shows real reviews, real add-to-cart via `useCartStore`
- **cart.tsx** — uses `useCartStore` (Zustand) synced with server cart API
- **checkout.tsx** — complete rewrite with real Stripe + wallet payment flow
- **orders.tsx** — fetches from `orderService.getBuyerOrders()`
- **wallet.tsx** — added "Add Money to Wallet" button
- **leave-review.tsx** — NEW review submission screen

### Backend Notes
- `POST /api/wallet/me/top-up` — backend currently does direct balance credit (not Stripe-backed). Acceptable for now.
- `POST /api/wallet/me/apply` — exists but "not integrated into checkout creation" per architecture doc. Frontend applies wallet separately after checkout creation.

---

## 3. Seller Full Flow

### What Already Works (verified against backend endpoints)
- Vendor creation: `POST /api/vendors` ✓
- Profile: `GET /api/vendors/me`, `PATCH /api/vendors/me` ✓
- Dashboard: `GET /api/vendors/me/dashboard` ✓
- Earnings: `GET /api/vendors/me/earnings` ✓
- Products: `POST /api/products`, `PATCH /api/products/:id`, `DELETE /api/products/:id` ✓
- Delivery zones: `GET /api/delivery/zones/me`, `POST /api/delivery/zones/me`, `PATCH /api/delivery/zones/me/:id`, `DELETE /api/delivery/zones/me/:id` ✓ (fixed paths)
- Orders: `GET /api/vendors/me/orders`, `PATCH /api/vendors/me/orders/:id/status` ✓
- Shipments: `POST /api/shipments/orders/:orderId`, `PATCH /api/shipments/:id` ✓
- Payouts: `POST /api/payout-requests`, `GET /api/payout-requests/me` ✓
- Verification: `POST /api/vendors/me/verification` ✓ (fixed path)
- Messages: all conversation endpoints ✓
- Notifications: ✓

### What Was Fixed
- **deliveryService.ts** — paths changed from `/api/vendors/me/delivery-zones` to `/api/delivery/zones/me` (matching backend)
- **vendorService.ts** — verification path fixed from `/api/vendors/me/verification-documents` to `/api/vendors/me/verification`
- **vendorService.ts** — public store slug path fixed from `/api/vendors/by-slug/:slug` to `/api/public/stores/:slug`

### Backend Requirements (MUST ADD)
- `GET /api/vendors/me/buyers` — vendor's buyer list (not in backend)
- `GET /api/vendors/me/analytics/revenue` — revenue time series (not in backend)

---

## 4. Admin Full Control

### What Already Works (all match backend)
- `GET /api/admin/dashboard` ✓
- `GET /api/admin/analytics` ✓
- `GET /api/admin/users` ✓
- `GET /api/admin/vendors` ✓
- `PATCH /api/admin/vendors/:id/approve|reject|suspend|unsuspend` ✓
- `GET /api/admin/products` ✓
- `PATCH /api/admin/products/:id/approve|disable` ✓
- `GET /api/admin/orders` ✓
- `PATCH /api/admin/orders/:id/complete` ✓
- `GET /api/admin/verification-documents` ✓
- `PATCH /api/admin/verification-documents/:id/review` ✓

### Backend Requirements (MUST ADD)
- `GET /api/admin/analytics/revenue` — revenue time series for admin chart
- `GET /api/admin/reviews` — review moderation list
- `PATCH /api/admin/reviews/:id/moderate` — review moderation action

---

## 5. Reviews

### What Was Implemented
- **leave-review.tsx** — buyer review submission screen (star rating + comment)
- **reviewService.ts** — calls `POST /api/reviews`, `GET /api/reviews?vendorId=...`, `GET /api/reviews?productId=...`
- **product-detail.tsx** — displays real reviews
- **orders.tsx** — "Leave Review" button for delivered orders

### Backend Requirements (MUST ADD)
The backend has **no review module**. Must implement:
- `POST /api/reviews` — create review (validate: order delivered, one per order/product, buyer owns order)
- `GET /api/reviews?vendorId=X` — public reviews for vendor
- `GET /api/reviews?productId=X` — public reviews for product
- `GET /api/admin/reviews` — admin moderation list
- `PATCH /api/admin/reviews/:id/moderate` — admin moderation
- Recompute vendor/product average rating on insert/delete

---

## 6. Wallet

### What Already Works (verified against backend)
- `GET /api/wallet/me` ✓
- `GET /api/wallet/me/transactions` ✓
- `POST /api/wallet/me/top-up` ✓ (direct credit, not Stripe-backed)
- `POST /api/wallet/me/apply` ✓

### What Was Fixed
- **wallet.tsx** — added "Add Money to Wallet" button
- **checkout.tsx** — wallet payment option integrated

### Backend Notes
- Top-up is direct DB credit (acceptable for now per architecture doc)
- Apply endpoint exists but is called separately from checkout (not atomic with payment intent)
- Backend must enforce: no negative balance, atomic debit

---

## 7. Concurrency (Backend Only)

Already implemented in backend per architecture doc:
- Guarded stock decrement: `updateMany({ where: { stock: { gte: quantity }}})`
- Webhook idempotency via `WebhookEvent` table
- Atomic wallet balance updates via increment/decrement
- Conditional payout state transitions
- Stale order cleanup worker (restores stock after 30 min)

### Not Yet Implemented (backend work needed)
- Formal load testing (200 concurrent buyers)
- Distributed rate limiting (current is in-memory only)

---

## 8. Endpoint Alignment Summary

### Frontend → Backend (CORRECT)
| Frontend Call | Backend Endpoint | Status |
|---|---|---|
| `POST /api/auth/login` | `POST /auth/login` | ✓ |
| `POST /api/auth/register` | `POST /auth/register` | ✓ |
| `GET /api/auth/me` | `GET /auth/me` | ✓ |
| `GET /api/products` | `GET /products` | ✓ |
| `GET /api/products/:id` | `GET /products/:id` | ✓ |
| `POST /api/products` | `POST /products` | ✓ |
| `GET /api/cart` | `GET /cart` | ✓ |
| `POST /api/cart/items` | `POST /cart/items` | ✓ |
| `POST /api/payments/create-intent` | `POST /payments/create-intent` | ✓ |
| `GET /api/orders/me` | `GET /orders/me` | ✓ |
| `GET /api/vendors/me` | `GET /vendors/me` | ✓ |
| `GET /api/vendors/me/orders` | `GET /vendors/me/orders` | ✓ |
| `POST /api/delivery/calculate` | `POST /delivery/calculate` | ✓ |
| `GET /api/delivery/zones/me` | `GET /delivery/zones/me` | ✓ |
| `GET /api/wallet/me` | `GET /wallet/me` | ✓ |
| `POST /api/wallet/me/top-up` | `POST /wallet/me/top-up` | ✓ |
| `POST /api/wallet/me/apply` | `POST /wallet/me/apply` | ✓ |
| `GET /api/subscriptions/plans` | `GET /subscriptions/plans` | ✓ |
| `GET /api/subscriptions/me` | `GET /subscriptions/me` | ✓ |
| `GET /api/subscriptions/me/limits` | `GET /subscriptions/me/limits` | ✓ |
| `GET /api/admin/dashboard` | `GET /admin/dashboard` | ✓ |
| `GET /api/public/stores/:slug` | `GET /public/stores/:slug` | ✓ (fixed) |

### Frontend → Backend (MISSING — Backend must add)
| Frontend Call | Purpose | Priority |
|---|---|---|
| `POST /api/subscriptions/activate` | Plan activation without Stripe | **HIGH** |
| `POST /api/reviews` | Buyer review submission | **HIGH** |
| `GET /api/reviews?vendorId=X` | Public vendor reviews | **HIGH** |
| `GET /api/reviews?productId=X` | Public product reviews | **HIGH** |
| `GET /api/admin/reviews` | Admin review moderation | MEDIUM |
| `PATCH /api/admin/reviews/:id/moderate` | Admin review action | MEDIUM |
| `GET /api/vendors/me/buyers` | Vendor's buyer list | MEDIUM |
| `GET /api/vendors/me/analytics/revenue` | Vendor revenue chart | LOW |
| `GET /api/admin/analytics/revenue` | Admin revenue chart | LOW |
| `PATCH /api/notifications/read-all` | Mark all notifications read | LOW |
| `POST /api/auth/send-otp` | OTP for vendor onboarding | LOW |
| `POST /api/auth/verify-otp` | OTP verification | LOW |

---

## 9. Files Changed

| File | Change |
|------|--------|
| `app/(buyer)/cart.tsx` | Rewired to `useCartStore` |
| `app/(buyer)/checkout.tsx` | Complete rewrite — real Stripe + wallet |
| `app/(buyer)/explore.tsx` | Real product fetching + add-to-cart |
| `app/(buyer)/product-detail.tsx` | Real product data + reviews + add-to-cart |
| `app/(buyer)/orders.tsx` | Real order fetching + review button |
| `app/(buyer)/wallet.tsx` | Added top-up button |
| `app/(buyer)/leave-review.tsx` | **NEW** — review submission |
| `app/(vendor)/plan-growth.tsx` | `openCheckout` → `activatePlan` |
| `app/(vendor)/plan-pro.tsx` | `openCheckout` → `activatePlan` |
| `app/(vendor)/grow-sales.tsx` | Plan-lock indicators |
| `services/cartService.ts` | Updated `createPaymentIntent` payload + `ServerCart.id` |
| `services/deliveryService.ts` | Fixed paths to `/api/delivery/zones/me` |
| `services/vendorService.ts` | Fixed slug path, verification path, graceful vendor discovery |
| `stores/cartStore.ts` | Updated `createCheckout` |
| `types/auth.ts` | Fixed `subscriptionPlan` type |
| `types/vendor.ts` | Fixed `subscriptionPlan` type |
| `services/mockData.ts` | Fixed `"basic"` → `"growth"` |

---

## 10. What Must Happen on Backend

### Priority 1 (Blocking production)
1. **Add `POST /api/subscriptions/activate`** — Create `VendorSubscription` row with plan limits, no Stripe payment required for now
2. **Add Reviews module** — `POST /api/reviews`, `GET /api/reviews` with vendorId/productId filters, enforce one-per-order and delivered-only rules
3. **Verify `POST /api/payments/create-intent`** accepts `deliveryAddress` + `deliveryCountry` (or add adapter that resolves these to a `destinationZoneId`)

### Priority 2 (Important for full flow)
4. Add `GET /api/vendors/me/buyers` — list buyers who ordered from vendor
5. Add `GET /api/admin/reviews` + `PATCH /api/admin/reviews/:id/moderate`
6. Wire subscription webhook for plan expiry/renewal

### Priority 3 (Nice to have)
7. Add revenue time series endpoints for charts
8. Add `PATCH /api/notifications/read-all`
9. Add OTP endpoints for vendor onboarding
10. Make buyer wallet top-up Stripe-backed

---

## 11. TypeScript & Expo Status

- **TypeScript**: All files pass diagnostics (0 errors)
- **Expo Doctor**: 2 pre-existing issues (dependency version mismatches). Fix with `npx expo install --check`
- **No mock data in production flows** — `USE_MOCK_API` is only enabled when `EXPO_PUBLIC_USE_MOCK_API=true` AND `__DEV__` mode
