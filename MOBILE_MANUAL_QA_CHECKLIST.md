# Mobile Manual QA Checklist

Use this checklist on a physical Android phone, Android emulator, iOS simulator, or Expo dev-client build.

Backend: `https://italian-market-place.vercel.app/api`
Mock mode must be false.

## Environment

- [ ] Install/run app on device.
- [ ] Confirm no red screen.
- [ ] Confirm no Metro fatal errors.
- [ ] Confirm API calls are not localhost.
- [ ] Confirm app survives reload.
- [ ] Capture screenshots for onboarding, buyer home, product detail, cart, checkout, vendor dashboard, vendor add product, wallet, orders, admin if accessible.

## Auth / Onboarding

- [ ] Fresh install opens onboarding.
- [ ] Onboarding buttons work.
- [ ] Role select buyer works.
- [ ] Role select vendor works.
- [ ] Buyer register with real test email works.
- [ ] Buyer invalid login shows clean error.
- [ ] Buyer valid login routes buyer dashboard.
- [ ] Logout clears token and protected route access.
- [ ] Reopen app restores buyer token.
- [ ] Vendor register starts onboarding.
- [ ] OTP skip/error is graceful if backend OTP is unavailable.
- [ ] Setup store creates vendor profile.
- [ ] Reopen app restores vendor token and vendor route.

## Buyer

- [ ] Buyer dashboard loads real products.
- [ ] Vendor list failure/empty state does not blank products.
- [ ] Search opens explore with query.
- [ ] Category chips filter or degrade clearly.
- [ ] Product detail opens for real product id.
- [ ] Missing product shows not found.
- [ ] Reviews load or empty state.
- [ ] Add to cart works.
- [ ] Cart quantity plus/minus works.
- [ ] Cart remove works.
- [ ] Empty cart state works.
- [ ] Checkout address validation works.
- [ ] Wallet-only payment works only with sufficient balance.
- [ ] Stripe path in Expo Go shows dev-client message and does not fake success.
- [ ] Stripe path in dev-client opens PaymentSheet.
- [ ] Orders list/detail/track open.
- [ ] Review eligibility errors are clear.
- [ ] Wallet balance and transactions load or empty.
- [ ] Wallet top-up does not fake success.
- [ ] Messages list/chat do not crash.
- [ ] Logout works.

## Vendor

- [ ] Vendor onboarding OTP/setup-store/business-info/add-product/delivery/store-ready flow works.
- [ ] Image picker opens.
- [ ] Upload URL requested.
- [ ] R2 PUT succeeds.
- [ ] Public image loads.
- [ ] Product create API succeeds.
- [ ] Product appears in vendor product list.
- [ ] Product appears in buyer catalog.
- [ ] Vendor dashboard metrics are live, not fake.
- [ ] Vendor empty dashboard states render.
- [ ] Product detail/edit/status/delete actions work or error clearly.
- [ ] Vendor orders list/detail open.
- [ ] Accept/mark shipped work if backend supports.
- [ ] Buyers list loads or empty.
- [ ] Earnings/payout methods/withdraw load or unavailable state is clear.
- [ ] Subscription plan status loads.
- [ ] Locked features show neutral locked state.
- [ ] Vendor logout works.

## Admin

- [ ] Non-admin cannot access admin routes.
- [ ] Admin login routes admin dashboard.
- [ ] Vendors/orders/buyers/products/analytics load.
- [ ] Admin actions work or show clear unavailable state.
- [ ] No password hashes/secrets rendered.
- [ ] Logout works.

## Crash/Error Monitoring

- [ ] Watch Metro logs.
- [ ] Watch device logs.
- [ ] No red screen.
- [ ] No unhandled promise rejection.
- [ ] No maximum update depth error.
- [ ] No undefined property crashes.
- [ ] No NaN totals/prices.
- [ ] No repeated 401/404 loops.
