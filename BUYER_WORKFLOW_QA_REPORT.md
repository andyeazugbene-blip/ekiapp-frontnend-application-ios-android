# Buyer Workflow QA Report

Date: 2026-05-29

## Verdict

Buyer workflow is NOT fully verified because real-device tapping was blocked.

Static/source and API smoke found issues and fixes were applied. Buyer release sign-off still requires a phone/emulator pass.

## Runtime Status

- Real Android/iOS device: not available.
- Emulator: attempted, failed to boot due low disk space.
- Screenshots: none captured.
- Backend mode: production URL configured, mock mode disabled.

## Buyer Flow Findings

| Area | Expected | Actual | Status | Notes |
|---|---|---|---:|---|
| Dashboard products | Real products from backend | `GET /api/products?limit=1` returned 200 | STATIC PASS | Device UI not tapped. |
| Dashboard vendors | Real vendors if public endpoint exists | `GET /api/vendors?sort=newest&limit=4` returned 401 | FIXED | Buyer product loading no longer fails when vendor list is protected. |
| Explore/catalog | Search and filters degrade gracefully | Source now isolates product/vendor API failures | FIXED | |
| Product detail | Product loads even if reviews fail | Reviews now fail to empty state instead of killing product | FIXED | |
| Product delivery copy | Must not show fake delivery estimate | Fake UK/3-5 day display replaced with cart-calculation state | FIXED | |
| Cart | Backend cart operations | Source uses `/api/cart` endpoints | STATIC PASS | Not tapped. |
| Checkout | No fake payment success | Unsupported Stripe path now shows error before order intent; cart not cleared | FIXED | |
| Wallet | Real wallet or empty | Source uses `/api/wallet/me`; copy button fixed | FIXED | |
| Messages | Text send works, attachments clear unavailable | Attachment/camera buttons now show unavailable alert | FIXED | |
| Issue reporting | No fake submit success | Submit now explains missing backend endpoint | FIXED | |
| Logout/login/reload | Token clear/restore | Auth store inspected | STATIC PASS | Not device-tested. |

## Button Results

| Screen | Button | Action | Actual | Status |
|---|---|---|---|---:|
| Buyer dashboard | Profile avatar | Navigate profile | Source routes to profile | STATIC PASS |
| Buyer dashboard | Search submit | Navigate explore with query | Source routes with params | STATIC PASS |
| Buyer dashboard | Get Reward, wallet promo | Navigate wallet | Fixed | FIXED |
| Buyer dashboard | Referral Get Reward | Navigate referral program | Source routes | STATIC PASS |
| Buyer dashboard | Category chips | Navigate explore category | Source routes | STATIC PASS |
| Buyer dashboard | Vendor card | Navigate public store | Source routes | STATIC PASS |
| Buyer dashboard | View Details | Navigate public store | Fixed | FIXED |
| Buyer dashboard | Product card | Navigate product detail | Source routes | STATIC PASS |
| Buyer dashboard | Heart | Clear coming-soon alert | Fixed | FIXED |
| Buyer dashboard | Add to cart | Backend cart add | Source calls cart store | STATIC PASS |
| Explore | Back | Navigate back | Source routes | STATIC PASS |
| Explore | View All | Clear filters/reload | Fixed | FIXED |
| Explore | Product card | Navigate detail | Source routes | STATIC PASS |
| Explore | Heart | Clear coming-soon alert | Fixed | FIXED |
| Explore | Add to cart | Backend cart add | Source calls cart store | STATIC PASS |
| Explore | Vendor row/chip | Navigate vendor detail | Source routes | STATIC PASS |
| Explore | Support new vendors | Navigate first vendor when available | Fixed | FIXED |
| Product detail | Back | Navigate back | Source routes | STATIC PASS |
| Product detail | Heart | Clear coming-soon alert | Fixed | FIXED |
| Product detail | Chat | Clear unavailable alert | Fixed | FIXED |
| Product detail | Add to Cart | Backend cart add | Source calls cart store | STATIC PASS |
| Cart | Browse Foodstuff | Navigate explore | Source routes | STATIC PASS |
| Cart | Quantity minus/plus | Backend cart patch/remove | Source calls cart store | STATIC PASS |
| Cart | Proceed to Checkout | Navigate checkout only with items | Source disabled when empty | STATIC PASS |
| Checkout | Payment method selectors | Set payment method; disabled if invalid | Source handles disabled states | STATIC PASS |
| Checkout | Pay Securely | Create real checkout only when valid | Unsupported Stripe fixed | FIXED |
| Checkout modal | View Orders | Navigate orders | Source routes | STATIC PASS |
| Checkout modal | Continue Shopping | Navigate home | Source routes | STATIC PASS |
| Wallet | Add Money to Wallet | Show amount form | Source works | STATIC PASS |
| Wallet | Top Up | Backend wallet top-up | Source calls backend | STATIC PASS |
| Wallet | Copy referral | Clipboard copy or clean error | Fixed | FIXED |
| Wallet | Share Referral Link | Navigate invite | Source routes | STATIC PASS |
| Messages | Conversation row | Select/open chat | Source route/store | STATIC PASS |
| Chat | Add/camera | Clear unavailable alert | Fixed | FIXED |
| Chat | Send | Backend message send; disabled empty | Source handles | STATIC PASS |
| Profile | Menu links | Navigate/link or alert | Source handles | STATIC PASS |
| Profile | Log Out | Logout auth store and route auth | Source handles | STATIC PASS |
| Report Issue | Issue choices | Select issue | Source handles | STATIC PASS |
| Report Issue | Submit Issue | Clear missing-endpoint alert | Fixed | FIXED |
| Report Issue | Message Vendor | Clear guidance alert | Fixed | FIXED |

## Remaining Buyer Blockers

- No real device/emulator tap pass.
- Public vendor list endpoint returns 401, so buyer vendor discovery depends on graceful empty states unless backend adds a public list endpoint.
- Public vendor detail by id returned 401 in live smoke. Store-by-slug may be the correct public path, but vendor-detail screen still needs device/backend verification.
