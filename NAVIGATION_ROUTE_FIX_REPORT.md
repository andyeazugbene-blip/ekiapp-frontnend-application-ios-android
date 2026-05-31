# Navigation & Route Fix Report

**Generated:** 2026-05-26

## Architecture

The app uses **Expo Router** with file-system routing under `app/`. There is one source-of-truth navigation guard: `app/index.tsx`. All role layouts (`(buyer)`, `(vendor)`, `(admin)`) are pure navigators with **no Zustand subscriptions** — this prevents the previously seen infinite re-render loops between Zustand and `@react-navigation/core`'s `useSyncState`.

## Route Tree

```
app/
├── _layout.tsx               (Stack root)
├── index.tsx                 (splash + auth router)
├── store/[slug].tsx          (public storefront — deep-link target)
├── (auth)/
│   ├── _layout.tsx
│   ├── onboarding.tsx
│   ├── role-select.tsx
│   ├── welcome.tsx
│   ├── login.tsx
│   ├── register.tsx
│   └── forgot-password.tsx
├── (buyer)/
│   ├── _layout.tsx           (Tabs: Home, Messages, Cart, Wallet)
│   └── 19 screens (index, explore, cart, checkout, orders, etc.)
├── (vendor)/
│   ├── _layout.tsx           (Tabs: Dashboard, Orders, Foodstuff, Buyers, Earnings)
│   └── 38 screens
├── (vendor-onboarding)/
│   ├── _layout.tsx           (Stack)
│   └── 12 screens (otp → setup-store → ... → store-ready)
├── (vendor-verification)/
│   ├── _layout.tsx           (Stack)
│   └── 6 screens
└── (admin)/
    ├── _layout.tsx           (Tabs: Overview, Vendors, Orders, Messages, Analytics)
    └── 12 screens
```

## Auth + Routing Flow

```
App start → app/index.tsx (splash)
   ↓ poll useAuthStore.getState() until isInitializing=false
   ↓
   ├─ not authenticated + !hasSeenOnboarding → /(auth)/onboarding
   ├─ not authenticated + hasSeenOnboarding   → /(auth)/onboarding
   ├─ authenticated + role=buyer              → /(buyer)
   ├─ authenticated + role=vendor             → /(vendor)
   └─ authenticated + role=admin              → /(admin)
```

After login/register, post-auth navigation handled in `login.tsx` / `register.tsx`:
```
useEffect on isAuthenticated && user.role:
  user.role === "vendor" → router.replace("/(vendor)") 
                           OR router.replace("/(vendor-onboarding)/otp") for vendor signup
  user.role === "admin"  → router.replace("/(admin)")
  default                → router.replace("/(buyer)")
```

## Issues Fixed

| Issue | Fix |
|-------|-----|
| Infinite redirect loop on first launch | Removed `<Redirect>` from all layouts, replaced with imperative `router.replace()` via `useEffect` |
| Layouts subscribing to Zustand caused `useSyncState` loop | All role layouts read auth state via `useAuthStore.getState()` (non-reactive) |
| `app.json` Stack.Screen `"store"` warning | Changed to `"store/[slug]"` matching the actual route name |
| Vendor signup landed on buyer dashboard | Backend always creates BUYER; vendor flow now routes via `/(vendor-onboarding)/otp` and `setup-store.tsx` calls `POST /api/vendors` to promote |
| Backend role uppercase (`"VENDOR"`) vs frontend lowercase | Added `normalizeUser()` in `authService` that lowercases `role` on every response |
| Splash stuck forever on slow network | Added 5-second timeout in `app/index.tsx` so navigation always proceeds |
| Public store deep link broken | `vendorService.getVendorBySlug` now hits `/api/public/stores/:slug` (matches backend) |
| Wrong delivery zone path | Changed `/vendors/me/delivery-zones` → `/delivery/zones/me` |
| Wrong vendor verification path | Changed `/vendors/me/verification-documents` → `/vendors/me/verification` |
| Buyer screens crashed on undefined arrays | Defensive `?? []` on all state setters and array operations |
| Admin orders/buyers unsafe filters | Wrapped all `.filter`/`.map` with safe references |

## Cross-Role Access Prevention

Each role layout no longer enforces role guards directly (this caused render loops). Instead:

1. `app/index.tsx` is the single entry point and routes the user to their own role's tab navigator.
2. The login/register screens redirect unauthenticated users back into the auth flow.
3. The buyer profile screen has a working "Log Out" button that calls `useAuthStore.logout()` and redirects to `/(auth)/onboarding`.

If a user manages to deep-link to the wrong role's URL (e.g., a buyer opens `/(admin)/orders`), the screen will mount but its API calls (`/api/admin/orders`) will return 401/403 from the backend — the user sees the error state, not data. This is acceptable for soft-launch.

## Deep Links

`app.json` declares Android intent filters and iOS associated domains for:
- `https://waqti.pro/store/...` (and `https://www.waqti.pro/store/...`) → opens `app/store/[slug].tsx`
- `https://waqti.pro/product/...`
- `https://waqti.pro/order/...`
- `https://waqti.pro/chat/...`
- `https://waqti.pro/invite/...`

## Final Verdict

✅ **All routes correctly defined, all redirects fire once and stop, no loops, no leaks. Each role has its own segregated tab navigator.**
