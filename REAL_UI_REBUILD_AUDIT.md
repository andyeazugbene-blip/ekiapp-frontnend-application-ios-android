# Real UI Rebuild — Audit (Phase 1)

**Date:** 2026-05-27
**Scope:** Find every production screen that is rendered as a screenshot
PNG mockup (full-screen `ImageBackground` / `<Image resizeMode="stretch">`)
or that contains fake "9:41" status-bar / fake dashboard data.

## Method

```
grep app/**/*.tsx  for  figma-screens | figma_ | require\(.*\.(png|jpg|webp)
grep app/**/*.tsx  for  ImageBackground | resizeMode="cover" | resizeMode="stretch"
grep components/**/*.tsx for FakeStatusBar
```

## Findings

### 1. Splash / index — full-screen screenshot

| Field | Value |
|---|---|
| File | `app/index.tsx` |
| Route | `/` (entry) |
| Asset | `assets/figma-screens/figma_003_screen_1_splash.png` |
| Why not real UI | Renders the Figma export as `ImageBackground` with a single transparent `TouchableOpacity` hitbox over the "Get Started" button. All copy and layout are part of the PNG. |
| Replacement plan | Real Expo splash with brand gradient, "Eki" logo, headline + Get Started button. Auth-aware (still routes to home if signed in). |

### 2. Vendor home — entire dashboard is a screenshot

| Field | Value |
|---|---|
| File | `app/(vendor)/index.tsx` |
| Route | `/(vendor)` |
| Asset | `assets/figma-screens/figma_034_screen_28_vendor_dashboard_home.png` (804×5650 px) |
| Why not real UI | Renders the Figma dashboard PNG inside a `ScrollView` and drops 23 `Pressable` "Hotspot" rectangles on top to simulate clicks. Every dashboard number, alert pill, chart, "Best Seller" card, etc. is hard-coded inside the image. There is no real backend data. |
| Replacement plan | Build real dashboard from `vendorService.getMyProfile()`, `vendorService.getVendorDashboard()` (greeting + alerts + earnings + insights), and `vendorService.getRevenueSeries("week")`. Show empty states when data is missing. Reuse the existing `VendorDrawer`. |

### 3. Drawer preview — fake "9:41" + screenshot-style mock phone

| Field | Value |
|---|---|
| File | `components/vendor/Drawer.tsx` |
| Route | overlay over `/(vendor)` |
| Asset | none (built with View) — but uses `FakeStatusBar` from `components/onboarding/FigmaNativeUI.tsx` and renders a fake "9:41" mini-phone preview |
| Why not real UI | The `<DashboardPreview />` block is decorative chrome that mimics a screenshot of the dashboard (fake date "Thursday, 13 Feb", fake "Welcome / Harvest Hub", fake sales bars). |
| Replacement plan | Replace decorative preview with a clean, brand-only side panel. Drop `FakeStatusBar` from this drawer (we use the real device status bar). |

### 4. Other auth screens — already real

The following screens were already real React Native components:

* `app/(auth)/onboarding.tsx` — rebuilt in previous task
* `app/(auth)/role-select.tsx` — rebuilt in previous task
* `app/(auth)/welcome.tsx` — rebuilt in previous task
* `app/(auth)/login.tsx` — already real, `<Input>` + `<Button>` + `SafeAreaView`
* `app/(auth)/forgot-password.tsx` — already real, real API call to `authService.forgotPassword`
* `app/(auth)/register.tsx` — rebuilt in previous task, real `<TextInput>`s
* `app/(vendor-onboarding)/otp.tsx` — real `<TextInput>` for OTP, real `authService.sendOtp` / `verifyOtp`
* `app/(vendor-onboarding)/setup-store.tsx` — real form
* `app/(vendor-onboarding)/business-info.tsx` — real radios
* `app/(vendor-onboarding)/add-product.tsx` — real form + image picker

### 5. Buyer dashboard — already real

`app/(buyer)/index.tsx`, `app/(buyer)/explore.tsx` etc. all read from
`productService.getAll()` / `vendorService.getNewVendors()` and have
defensive `?? []` guards. No screenshot mocks. (Verified already in
TASK 5 of the previous task.)

### 6. Image upload — legitimate uses of `resizeMode="cover"`

These are NOT screenshot mockups; they show the user's own picked photo:

* `app/(vendor-onboarding)/add-product.tsx`
* `app/(vendor)/foodstuff-add.tsx`, `foodstuff-edit.tsx`
* `app/(vendor-verification)/upload-id.tsx`, `upload-business.tsx`
* `app/(buyer)/cart.tsx`, `product-detail.tsx`

No action needed.

## Summary

* 2 production screens still render Figma screenshot PNGs as their entire UI
  (`app/index.tsx`, `app/(vendor)/index.tsx`).
* 1 component renders a decorative "fake 9:41" preview
  (`components/vendor/Drawer.tsx`).
* All other auth, onboarding, buyer, vendor-onboarding, and admin screens
  are already real components with real backend integration.

The fix is small and focused — only 3 files need changes.
