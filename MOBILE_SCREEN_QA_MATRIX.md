# Mobile Screen QA Matrix

Date: 2026-05-29

Status legend:

- STATIC PASS: route exists, source inspected, build/typecheck passed.
- FIXED: confirmed source issue was fixed in this QA pass.
- RUNTIME BLOCKED: not tapped on device because no phone/emulator was available.
- SKIPPED: cannot verify without credentials, role, or backend support.

Global actual result for every route: app source and bundles pass, but real-device behavior is RUNTIME BLOCKED until a phone/emulator/dev-client can run.

## Public / Auth / Onboarding

| Route | Role | Purpose | Required auth | Main buttons | API endpoints | Expected | Actual | Status | Notes |
|---|---|---|---|---|---|---|---|---:|---|
| `/` | public | Launch/session router | none/stored token | Get Started | auth store `/api/auth/me` | Restore role session or go onboarding | Static pass | RUNTIME BLOCKED | Real reload not device-tested. |
| `/(auth)/onboarding` | onboarding | First-run onboarding | none | Get Started | none | Real RN onboarding, no screenshot | Static pass | RUNTIME BLOCKED | Screenshot check passed. |
| `/(auth)/role-select` | onboarding | Buyer/vendor role select | none | buyer, vendor, Continue | none | Select role then welcome | Static pass | RUNTIME BLOCKED | |
| `/(auth)/welcome` | auth | Welcome by role | none | Create Account, Login, switch role | none | Route to auth forms | Static pass | RUNTIME BLOCKED | Static sales illustration only. |
| `/(auth)/register` | auth | Register account | none | Create Account, Log In | `/api/auth/register` | Register real backend user | Static pass | RUNTIME BLOCKED | No test account created. |
| `/(auth)/login` | auth | Login | none | Continue, forgot password, sign up | `/api/auth/login` | Login and route by role | Static pass | RUNTIME BLOCKED | Dev-only autofill remains gated by `__DEV__`. |
| `/(auth)/forgot-password` | auth | Password reset request | none | Send Reset Link, Back to Sign In | `/api/auth/forgot-password` | Clean success/error | Static pass | RUNTIME BLOCKED | |

## Buyer Screens

| Route | Role | Purpose | Required auth | Main buttons | API endpoints | Expected | Actual | Status | Notes |
|---|---|---|---|---|---|---|---|---:|---|
| `/(buyer)` | buyer | Buyer dashboard | buyer | profile, search, rewards, categories, product cards, add cart | `/api/products`, `/api/vendors` | Products remain visible even if vendors fail | Fixed source | FIXED/RUNTIME BLOCKED | Vendor list endpoint 401; product load now independent. |
| `/(buyer)/explore` | buyer | Catalog/search | buyer | back, search, View All, product, Add to cart, vendor chips | `/api/products`, `/api/vendors` | Real product list, graceful vendor empty | Fixed source | FIXED/RUNTIME BLOCKED | Vendor list 401 handled independently. |
| `/(buyer)/product-detail` | buyer | Product detail | buyer | back, favorite, chat, Add to Cart | `/api/products/:id`, `/api/reviews` | Product loads even if reviews empty; no fake delivery | Fixed source | FIXED/RUNTIME BLOCKED | Chat/favorite now clear unavailable states. |
| `/(buyer)/vendor-detail` | buyer | Vendor public profile | buyer | back, favorite, Add to cart, Browse | `/api/vendors/:id`, `/api/products?vendorId`, `/api/reviews`, `/api/delivery/zones` | Store data or not-found, real zones | Fixed source | FIXED/RUNTIME BLOCKED | `/api/vendors/:id` returned 401 publicly. |
| `/(buyer)/cart` | buyer | Cart | buyer | Browse Foodstuff, qty +/-, Checkout | `/api/cart`, `/api/delivery/calculate` | Cart sync, totals valid | Static pass | RUNTIME BLOCKED | |
| `/(buyer)/checkout` | buyer | Checkout/payments | buyer | payment method, Pay Securely, View Orders | `/api/payments/create-intent`, `/api/wallet/me`, `/api/wallet/me/apply`, `/api/orders/:id` | No fake payment success | Fixed source | FIXED/RUNTIME BLOCKED | Unsupported PaymentSheet no longer clears cart/success. |
| `/(buyer)/orders` | buyer | Order list | buyer | order rows | `/api/orders/me` | Real orders or empty state | Static pass | RUNTIME BLOCKED | |
| `/(buyer)/order-confirmation` | buyer | Confirmation | buyer | View Orders, Continue Shopping | orders | Order confirmation | Static pass | RUNTIME BLOCKED | |
| `/(buyer)/track-order` | buyer | Tracking | buyer | back, report issue | `/api/shipments/orders/:id` | Real status or empty | Static pass | RUNTIME BLOCKED | |
| `/(buyer)/leave-review` | buyer | Review form | buyer | rating, submit | `/api/reviews` | Eligible review only | Static pass | RUNTIME BLOCKED | |
| `/(buyer)/wallet` | buyer | Wallet | buyer | add money, copy referral, share referral, browse | `/api/wallet/me`, `/api/wallet/me/transactions`, `/api/wallet/me/top-up` | Real balance/tx or empty | Fixed source | FIXED/RUNTIME BLOCKED | Copy button now works. |
| `/(buyer)/messages` | buyer | Conversation list | buyer | conversation rows | `/api/conversations` | Real conversations or empty | Static pass | RUNTIME BLOCKED | |
| `/(buyer)/message-chat` | buyer | Chat | buyer | attachment, send, camera | `/api/conversations/:id/messages` | Text send; attachment unavailable clear | Fixed source | FIXED/RUNTIME BLOCKED | Attachment/camera no-op fixed. |
| `/(buyer)/profile` | buyer | Profile/settings | buyer | menu links, logout | auth/logout | Logout clears token | Static pass | RUNTIME BLOCKED | |
| `/(buyer)/invite-friend` | buyer | Referral invite | buyer | copy/share | referral utils | Share or disabled no code | Static pass | RUNTIME BLOCKED | |
| `/(buyer)/referral-program` | buyer | Referral info | buyer | invite/share | referral utils | Referral info | Static pass | RUNTIME BLOCKED | |
| `/(buyer)/reward-history` | buyer | Reward history | buyer | back | wallet tx | Rewards or empty | Static pass | RUNTIME BLOCKED | |
| `/(buyer)/report-issue` | buyer | Issue modal | buyer | issue choices, Submit, Message Vendor | none yet | No fake success | Fixed source | FIXED/RUNTIME BLOCKED | Submit now states backend endpoint missing. |
| `/(buyer)/delivery-unavailable` | buyer | Unsupported delivery | buyer | Browse Other Vendors, Go Home | none | Clear error state | Static pass | RUNTIME BLOCKED | |

## Vendor Screens

| Route | Role | Purpose | Required auth | Main buttons | API endpoints | Expected | Actual | Status | Notes |
|---|---|---|---|---|---|---|---|---:|---|
| `/(vendor)` | vendor | Vendor dashboard | vendor | menu, notifications, alerts, grow sales, setup, lists | many vendor/order/product endpoints | Live metrics, no hardcoded numbers | Static pass | RUNTIME BLOCKED | Source documents live backend usage. |
| `/(vendor)/activation` | vendor | Activation checklist | vendor | upload docs, setup actions | uploads, vendors, auth/me | Complete real activation steps | Static pass | RUNTIME BLOCKED | |
| `/(vendor)/foodstuff` | vendor | Product list | vendor | tabs, add, product rows | `/api/products?vendorId` | Products or empty | Static pass | RUNTIME BLOCKED | |
| `/(vendor)/foodstuff-add` | vendor | Create product | vendor | upload image, save | `/api/uploads/request-url`, R2 PUT, `/api/products` | Real R2 upload and create | Static pass | RUNTIME BLOCKED | Not run on device. |
| `/(vendor)/foodstuff-edit` | vendor | Edit product | vendor | upload, save, delete | upload, `/api/products/:id` | Edit/delete real product | Static pass | RUNTIME BLOCKED | |
| `/(vendor)/foodstuff-detail` | vendor | Product detail/manage | vendor | edit, activate/deactivate, stock, delete | `/api/products/:id` | Real state changes | Static pass | RUNTIME BLOCKED | |
| `/(vendor)/orders` | vendor | Vendor orders | vendor | tabs, order rows | `/api/vendors/me/orders` | Orders or empty | Static pass | RUNTIME BLOCKED | |
| `/(vendor)/order-detail` | vendor | Vendor order detail | vendor | accept/status/message/ship | `/api/vendors/me/orders/:id`, status, shipments | Real transitions or clear errors | Static pass | RUNTIME BLOCKED | |
| `/(vendor)/accept-order` | vendor | Accept order | vendor | accept/back | order status | Accept or error | Static pass | RUNTIME BLOCKED | |
| `/(vendor)/mark-shipped` | vendor | Mark shipped | vendor | submit/back | shipments | Shipment update | Static pass | RUNTIME BLOCKED | |
| `/(vendor)/order-completed` | vendor | Complete confirmation | vendor | back/dashboard | none | Confirmation | Static pass | RUNTIME BLOCKED | |
| `/(vendor)/delivery` | vendor | Delivery overview | vendor | add/reactivate/pause | `/api/delivery/zones/me` | Zones or empty | Static pass | RUNTIME BLOCKED | |
| `/(vendor)/delivery-zone` | vendor | Delivery zone form | vendor | save/back | `/api/delivery/zones/me` | Save real zone | Static pass | RUNTIME BLOCKED | |
| `/(vendor)/delivery-tracking` | vendor | Delivery tracking | vendor | tabs/order rows | shipments/orders | Real/empty | Static pass | RUNTIME BLOCKED | |
| `/(vendor)/buyers` | vendor | Buyer list | vendor | buyer rows | `/api/vendors/me/buyers` | Buyers or empty, no PII leak | Static pass | RUNTIME BLOCKED | |
| `/(vendor)/buyers-profile` | vendor | Buyer profile | vendor | back/actions | `/api/vendors/me/buyers/:id` | Buyer summary | Static pass | RUNTIME BLOCKED | |
| `/(vendor)/earnings` | vendor | Earnings | vendor | payout mode, withdraw, share | `/api/vendors/me/earnings`, payout | Real earnings/empty | Static pass | RUNTIME BLOCKED | |
| `/(vendor)/withdraw-payout` | vendor | Withdraw | vendor | amount, add method, submit | `/api/payout-requests`, payout methods | Real request or error | Static pass | RUNTIME BLOCKED | |
| `/(vendor)/payment-details` | vendor | Payout methods | vendor | add/save/default/delete | `/api/vendors/me/payout-methods` | Real methods/empty | Static pass | RUNTIME BLOCKED | |
| `/(vendor)/payout-mode` | vendor | Payout cadence | vendor | select, save | `/api/vendors/me/payout-mode` | Save or error | Static pass | RUNTIME BLOCKED | |
| `/(vendor)/payout-requested` | vendor | Payout confirmation | vendor | done | none | Confirmation | Static pass | RUNTIME BLOCKED | |
| `/(vendor)/messages` | vendor | Messages | vendor | conversation rows | `/api/conversations` | Conversations/empty | Static pass | RUNTIME BLOCKED | |
| `/(vendor)/message-chat` | vendor | Chat | vendor | attachment, mic, send, camera | messages | Text send; attachment unavailable | Fixed source | FIXED/RUNTIME BLOCKED | No-op buttons fixed. |
| `/(vendor)/notifications` | vendor | Notifications | vendor | mark/read | `/api/notifications` | Notifications/empty | Static pass | RUNTIME BLOCKED | |
| `/(vendor)/grow-sales` | vendor | Marketing hub | vendor | discount, bundle, flash, offer | marketing endpoints | Route to tools | Static pass | RUNTIME BLOCKED | |
| `/(vendor)/create-discount` | vendor | Discount creation | vendor | publish | `/api/discounts` | Real create or plan lock | Static pass | RUNTIME BLOCKED | |
| `/(vendor)/create-bundle` | vendor | Bundle creation | vendor | publish | `/api/bundles` | Real create or plan lock | Static pass | RUNTIME BLOCKED | |
| `/(vendor)/create-flash-sale` | vendor | Flash sale | vendor | publish | `/api/flash-sales` | Real create or plan lock | Static pass | RUNTIME BLOCKED | |
| `/(vendor)/send-offer` | vendor | Private offer | vendor | audience, send | `/api/offers`, buyers | Real offer or plan lock | Static pass | RUNTIME BLOCKED | |
| `/(vendor)/promo-link` | vendor | Promo link | vendor | copy/share/done | share utils | Copy/share | Static pass | RUNTIME BLOCKED | |
| `/(vendor)/share-store-link` | vendor | Store sharing | vendor | copy/share/done | share utils | Copy/share | Static pass | RUNTIME BLOCKED | |
| `/(vendor)/publish-check` | vendor | Publish checklist | vendor | Publish, Fix Missing Info | none | Disabled until ready | Static pass | RUNTIME BLOCKED | |
| `/(vendor)/subscription-plans` | vendor | Plan status | vendor | refresh | `/api/subscriptions/*` | Live plan status | Static pass | RUNTIME BLOCKED | |
| `/(vendor)/plan-free` | vendor | Free plan read-only | vendor | inherited | subscriptions | Plan status | Static pass | RUNTIME BLOCKED | |
| `/(vendor)/plan-growth` | vendor | Growth plan read-only | vendor | inherited | subscriptions | Plan status | Static pass | RUNTIME BLOCKED | |
| `/(vendor)/plan-pro` | vendor | Pro plan read-only | vendor | inherited | subscriptions | Plan status | Static pass | RUNTIME BLOCKED | |
| `/(vendor)/plan-active` | vendor | Active plan | vendor | Back to plan status | subscriptions | Status only | Static pass | RUNTIME BLOCKED | |
| `/(vendor)/paywall-limit` | vendor | Locked feature | vendor | refresh/back | subscriptions | Clear lock message | Static pass | RUNTIME BLOCKED | |
| `/(vendor)/upgrade-prompt` | vendor | Upgrade prompt | vendor | refresh/back | subscriptions | Clear lock message | Static pass | RUNTIME BLOCKED | |

## Vendor Onboarding / Verification

| Route | Role | Purpose | Required auth | Main buttons | API endpoints | Expected | Actual | Status | Notes |
|---|---|---|---|---|---|---|---|---:|---|
| `/(vendor-onboarding)/otp` | vendor onboarding | OTP verify/resend | vendor auth | verify, resend | `/api/auth/send-otp`, `/api/auth/verify-otp` | Verify or gracefully continue/error | Static pass | RUNTIME BLOCKED | |
| `/(vendor-onboarding)/setup-store` | vendor onboarding | Store profile | vendor auth | save/continue | `/api/vendors` | Create vendor profile/token | Static pass | RUNTIME BLOCKED | |
| `/(vendor-onboarding)/business-info` | vendor onboarding | Seller type | vendor auth | choose/continue | `/api/auth/me` patch | Save profile | Static pass | RUNTIME BLOCKED | |
| `/(vendor-onboarding)/add-product` | vendor onboarding | First product | vendor auth | upload, stock, save | upload/R2, `/api/products` | Upload and create | Static pass | RUNTIME BLOCKED | |
| `/(vendor-onboarding)/delivery-intro` | vendor onboarding | Delivery intro | vendor auth | continue | none | Continue | Static pass | RUNTIME BLOCKED | |
| `/(vendor-onboarding)/delivery-countries` | vendor onboarding | Choose countries | vendor auth | country choices, continue | none | Continue to country form | Static pass | RUNTIME BLOCKED | |
| `/(vendor-onboarding)/delivery-uk` | vendor onboarding | UK delivery form | vendor auth | save/back | `/api/delivery/zones/me` | Save zone | Static pass | RUNTIME BLOCKED | |
| `/(vendor-onboarding)/delivery-us` | vendor onboarding | US delivery form | vendor auth | save/back | `/api/delivery/zones/me` | Save zone | Static pass | RUNTIME BLOCKED | |
| `/(vendor-onboarding)/delivery-canada` | vendor onboarding | Canada delivery form | vendor auth | save/back | `/api/delivery/zones/me` | Save zone | Static pass | RUNTIME BLOCKED | |
| `/(vendor-onboarding)/delivery-europe` | vendor onboarding | Europe delivery form | vendor auth | save/back | `/api/delivery/zones/me` | Save zone | Static pass | RUNTIME BLOCKED | |
| `/(vendor-onboarding)/delivery-summary` | vendor onboarding | Delivery summary | vendor auth | edit/add/finish | `/api/delivery/zones/me` | Zones or empty state | Static pass | RUNTIME BLOCKED | |
| `/(vendor-onboarding)/store-ready` | vendor onboarding | Ready screen | vendor auth | dashboard, view store | none | Go dashboard | Static pass | RUNTIME BLOCKED | |
| `/(vendor-verification)` | vendor verification | Verification intro | vendor auth | start/later | none | Start upload | Static pass | RUNTIME BLOCKED | |
| `/(vendor-verification)/upload-id` | vendor verification | ID upload | vendor auth | pick/upload/continue | upload/R2, `/api/vendors/me/verification` | Upload real ID | Static pass | RUNTIME BLOCKED | |
| `/(vendor-verification)/upload-business` | vendor verification | Business/selfie upload | vendor auth | pick/upload/submit | upload/R2, verification | Upload real docs | Static pass | RUNTIME BLOCKED | |
| `/(vendor-verification)/pending` | vendor verification | Pending | vendor auth | dashboard | none | Pending state | Static pass | RUNTIME BLOCKED | |
| `/(vendor-verification)/approved` | vendor verification | Approved | vendor auth | dashboard | none | Approved state | Static pass | RUNTIME BLOCKED | |
| `/(vendor-verification)/rejected` | vendor verification | Rejected | vendor auth | try again, support | none | Rejected state | Static pass | RUNTIME BLOCKED | |

## Admin / Public Store

| Route | Role | Purpose | Required auth | Main buttons | API endpoints | Expected | Actual | Status | Notes |
|---|---|---|---|---|---|---|---|---:|---|
| `/(admin)` | admin | Admin dashboard | admin | back/stats | `/api/admin/dashboard`, analytics | Real metrics | Fixed source | FIXED/RUNTIME BLOCKED | Removed hardcoded avg review time. |
| `/(admin)/analytics` | admin | Analytics | admin | charts/ranges | `/api/admin/analytics` | Real analytics | Static pass | SKIPPED | No admin creds. |
| `/(admin)/buyers` | admin | Buyers | admin | search/list | admin users/orders | Real buyers | Static pass | SKIPPED | No admin creds. |
| `/(admin)/vendors` | admin | Vendors | admin | tabs, approve/reject/suspend/detail | `/api/admin/vendors` | Admin vendor actions | Fixed source | FIXED/SKIPPED | No-op detail buttons fixed. |
| `/(admin)/vendor-detail` | admin | Vendor detail | admin | approve/reject/suspend/message | `/api/admin/vendors` | Actions or clear unavailable | Fixed source | FIXED/SKIPPED | Message shows unavailable. |
| `/(admin)/orders` | admin | Orders | admin | tabs/order rows | `/api/admin/orders` | Real orders | Static pass | SKIPPED | |
| `/(admin)/order-detail` | admin | Order detail | admin | message/flag actions | admin orders | Clear unavailable for missing actions | Fixed source | FIXED/SKIPPED | No-op buttons fixed. |
| `/(admin)/messages` | admin | Messages | admin | send broadcast/chat | `/api/conversations` | Messages/empty | Static pass | SKIPPED | |
| `/(admin)/create-message` | admin | Broadcast composer | admin | send/back | none visible | No fake backend broadcast | Static pass | SKIPPED | Needs backend endpoint review. |
| `/(admin)/disputes` | admin | Disputes | admin | dispute rows | `/api/admin/disputes` | Disputes/empty | Static pass | SKIPPED | |
| `/(admin)/dispute-detail` | admin | Dispute detail | admin | resolve buyer/vendor | admin disputes | Resolve or error | Static pass | SKIPPED | |
| `/(admin)/settings` | admin | Settings/logout | admin | sign out, permission actions | auth/logout | Logout clears token | Static pass | SKIPPED | |
| `/store/[slug]` | public | Public store deep link | none | share, open app, product, sign in | `/api/public/stores/:slug`, `/api/products?vendorId` | Store by slug or not found | Static pass | RUNTIME BLOCKED | Public list endpoint absent, slug endpoint exists in source. |
