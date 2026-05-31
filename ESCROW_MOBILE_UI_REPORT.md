# Escrow Mobile UI Report

Date: 2026-05-30
Backend base URL: `https://italian-market-place.vercel.app/api`
Frontend build type verified: Expo export bundles for iOS and Android

## Screens Changed

- `app/(buyer)/orders.tsx`
- `app/(buyer)/track-order.tsx`
- `app/(buyer)/report-issue.tsx`
- `app/(buyer)/order-confirmation.tsx`
- `app/(vendor)/orders.tsx`
- `app/(vendor)/accept-order.tsx`
- `app/(vendor)/mark-shipped.tsx`
- `app/(vendor)/order-completed.tsx`
- `app/(vendor)/order-detail.tsx`
- `app/(vendor)/earnings.tsx`
- `app/(admin)/disputes.tsx`
- `app/(admin)/dispute-detail.tsx`
- `app/(admin)/orders.tsx`
- `app/(admin)/order-detail.tsx`
- `services/escrowStatus.ts`
- `services/orderService.ts`
- `services/adminService.ts`
- `services/api/normalizers.ts`
- `types/order.ts`

## Escrow Statuses Supported

- `PENDING_PAYMENT`
- `PAID_HELD`
- `VENDOR_ACCEPTED`
- `SHIPPED`
- `DELIVERED`
- `RELEASED`
- `DISPUTED`
- `REFUNDED`

## Actions Connected

| Actor | Action | Backend route | Result |
|---|---|---|---|
| Buyer | View escrow orders | `GET /api/orders/me` | Connected and live-tested. |
| Buyer | View escrow order detail | `GET /api/orders/:id` | Connected and live-tested. |
| Buyer | Confirm delivery with OTP | `POST /api/orders/:id/confirm-delivery` | Connected and live-tested successfully. |
| Buyer | Open dispute | `POST /api/orders/:id/dispute` | Connected. Live-tested against an already disputed order and backend correctly rejected the repeat attempt. |
| Vendor | View order list | `GET /api/vendors/me/orders` | Connected and live-tested. |
| Vendor | View held vs available funds | `GET /api/vendors/me/earnings` | Connected and live-tested. |
| Vendor | Confirm escrow order | `POST /api/vendors/me/orders/:id/confirm-escrow` | Connected. Current seed `ESCROW_PAID_HELD` is backend `PAID`, not `PAYMENT_SECURED`, so the API rejects it. UI now blocks the false action and explains why. |
| Vendor | Mark shipped / generate delivery code | `POST /api/vendors/me/orders/:id/dispatch` | Connected and live-tested successfully. |
| Admin | View escrow health | `GET /api/admin/escrow/health` | Connected and live-tested. |
| Admin | View disputes list | `GET /api/admin/disputes` | Connected and live-tested. |
| Admin | View dispute detail | `GET /api/admin/disputes/:id` | Connected and live-tested. |
| Admin | Resolve dispute | `PATCH /api/admin/disputes/:id/resolve` | Connected and live-tested successfully. |
| Admin | Direct refund from order detail | `POST /api/admin/orders/:id/refund` | Backend route exists, but mobile UI still uses a safe dispute-flow fallback instead of a direct refund form. |

## Live Seed Scenarios Tested

Seed report source:

- `C:\Users\PC SOFT\Desktop\ITALY CLIENT\ESCROW_SEED_REPORT.md`
- `C:\Users\PC SOFT\Desktop\ITALY CLIENT\QA_SEED_CREDENTIALS.md`

Accounts used:

- Buyer: `seed_qa_escrow_buyer@example.com`
- Vendor: `seed_qa_escrow_vendor@example.com`
- Admin: `seed_qa_admin@example.com`

Important seed note:

- the escrow seed report stores `orderNumber` values like `cmps8etor000rufpk6w7pero9`
- action endpoints require the internal `order.id`
- the mobile app now works with real `order.id`; the report mapping was resolved during verification

### Scenario Results

| Scenario | Backend state seen live | Result |
|---|---|---|
| `ESCROW_PAID_HELD` | `PAID` + `escrowType=DOMESTIC_AFRICA` | Detail loaded. Vendor confirm endpoint rejected this seed because backend requires `PAYMENT_SECURED`. UI now shows held state but disables false confirmation. |
| `ESCROW_VENDOR_ACCEPTED` | `VENDOR_CONFIRMED` | Vendor dispatch succeeded and returned delivery code `347874`. |
| `ESCROW_VENDOR_ACCEPTED -> buyer confirm` | became `COMPLETED` | Buyer OTP confirmation succeeded. Post-action read showed `deliveredAt` populated and admin escrow outstanding count dropped. |
| `ESCROW_SHIPPED` | `DISPATCHED` | Detail loaded correctly for buyer. |
| `ESCROW_DISPUTED` | `DISPUTED` | Detail loaded. Repeat dispute attempt correctly failed with backend validation. |
| `ESCROW_REFUNDED` | `REFUNDED` | Listed and mapped successfully. |
| Admin open dispute | `OPEN` dispute on escrow order | Resolution succeeded through real backend route with `resolution=vendor`. |

## Live Backend Verification Notes

- Buyer order list returned `9` orders for the escrow buyer.
- Vendor order list returned `12` orders for the escrow vendor.
- Vendor earnings returned:
  - `pendingPayout = 72000`
  - `availableBalance = 9000`
  - `currency = NGN`
- Admin escrow health initially showed:
  - `outstandingOrders = 3`
  - breakdown: `VENDOR_CONFIRMED`, `DISPATCHED`, `DISPUTED`
- After vendor dispatch + buyer confirm + admin resolve:
  - outstanding orders dropped to `1`
  - remaining breakdown: `DISPATCHED`

## UX Behavior Implemented

### Buyer

- Escrow status badge on order cards and tracking detail
- payment provider label
- protection explainer card
- real escrow timeline
- OTP-based `Confirm Delivery` modal
- real `Open Dispute / Report Issue` form
- safe hidden/disabled states when order is not eligible

### Vendor

- escrow status badge on list and detail
- real pending vs available balance surfaces
- held-funds explainer
- dispatch flow that returns a real delivery code
- dispute warning state
- payout CTA based on real available balance
- accept action now guarded by actual backend rule: `PAYMENT_SECURED` only

### Admin

- escrow health summary
- disputes list
- dispute detail with order amount, vendor earnings, payment provider context
- real resolution actions for buyer/vendor/partial outcomes
- safe fallback in order detail when direct refund UI is not wired

## Missing Backend Endpoints / Remaining Gaps

1. A true seeded `PAYMENT_SECURED` escrow order is still missing from the QA dataset.
   - Current `ESCROW_PAID_HELD` seed is backend `PAID`, so successful vendor confirmation could not be verified on live data.

2. Direct mobile refund UI is still not wired to `POST /api/admin/orders/:id/refund`.
   - The admin order detail screen shows a safe fallback and routes operators toward the dispute workflow.

3. Vendor-specific dispute detail/evidence/messages payload is still missing for mobile.
   - Vendor mobile UI shows a dispute freeze notice instead of pretending those details exist.

4. Backend security gap:
   - `PATCH /api/admin/disputes/:id/resolve` succeeded without a 2FA header.
   - Mobile UI supports a 2FA field, but the backend route is not currently enforcing it.

5. No physical device or emulator tap-through was executed in this pass.
   - This report verifies code, bundles, and real production API behavior, but not a fresh on-device gesture pass.

## Checks Run

- `npm run typecheck` - PASS
- `npm run check:no-mock-data` - PASS
- `npm run check:no-screenshot-ui` - PASS
- `npx expo export --platform ios --output-dir dist-ios` - PASS
- `npx expo export --platform android --output-dir dist-android` - PASS

## Final Verdict

`NOT READY`

### Blockers

- Successful vendor acceptance on a real `PAYMENT_SECURED` escrow order could not be verified because the current seed data does not provide that backend state.
- Admin dispute resolution currently works without backend 2FA enforcement.
- Direct mobile admin refund UI still needs a real connected form if that workflow must be performed outside dispute resolution.
