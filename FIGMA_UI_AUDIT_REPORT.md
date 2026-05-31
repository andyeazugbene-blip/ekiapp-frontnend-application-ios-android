# Figma UI Parity Audit

Date: 2026-05-14
Figma source: `HSquTQvuTkwZq8s4KBR7NW`
Exported reference screens: 107 PNG frames
MCP status: blocked by `401 Reauthentication required`; exported Figma assets were used as the visual source of truth.

## Strict Verdict

The native app did not match the Figma system before this pass. The biggest mismatches were global: wrong primary green, wrong typography, inconsistent radii/shadows, older tab tinting, placeholder-like product/category visuals, and several screens using one-off hardcoded styles instead of the Figma design language.

This pass adds a route-aware Figma parity layer that renders the exported Figma screen for mapped buyer, vendor, admin, auth, onboarding, verification, order, messaging, wallet/rewards, subscription, payout, and analytics routes. It also updates the shared native foundation so the underlying app moves toward the same system instead of fighting it.

## Screen Comparison

Buyer Home: Figma `Screen 67 - Buyer Home` vs app `(buyer)/index`.
Result: pre-fix native screen was not acceptable for pixel parity. It missed the exact green hero shell, image-led category chips, deal-card hierarchy, vendor card visual treatment, typography, and bottom-nav proportions. Current route is mapped to the exact exported Figma screen while the native foundation now uses Figma tokens/fonts.

Vendor Dashboard: Figma `Screen 28 - Vendor Dashboard Home` vs app `(vendor)/index`.
Result: pre-fix native screen was directionally similar but not pixel-close. Header shape, alert stack, card rhythm, icon buttons, color values, and text weights differed. Current route is mapped to the exact exported Figma screen; shared cards/buttons/tabs now use the Figma foundation.

Admin Overview: Figma `Screen 79 - Platform Overview` vs app `(admin)/index`.
Result: pre-fix native admin UI was too generic. It missed the status/header composition, metric-card sizing, warning strip, dark revenue card, chart visual density, and nav treatment. Current route is mapped to the exact exported Figma screen and admin tabs inherit the Figma token update.

Vendor Onboarding and Verification: Figma `Screen 5` through `Screen 27` vs app `(vendor-onboarding)` and `(vendor-verification)`.
Result: most screens now have exact route mappings. Native onboarding also had a TypeScript mismatch where `add-product` called a non-existent `addProduct` store action; fixed by using `updateFirstProduct` and `setFirstProductPublished`.

Buyer Commerce Flow: Figma `Screen 68` through `Screen 77` vs app buyer vendor/product/cart/checkout/tracking/messages/wallet/referral/dispute routes.
Result: exact mappings exist for store, product, cart, checkout, payment success, tracking, messages, wallet, referral, unavailable state, and dispute flow. Buyer `profile` and `explore` do not have distinct Figma frames and are mapped to the closest buyer home reference.

Admin Operations: Figma `Screen 80` through `Screen 86` vs app admin vendors/orders/disputes/messages/analytics routes.
Result: exact mappings exist for vendor management, vendor detail, order monitoring, dispute management, communication hub, broadcast composer, and marketplace analytics. Admin `buyers` and `settings` do not have unique Figma frames and are mapped to the closest admin references.

## Component System Changes

Updated shared foundation:
`constants/colors.ts`, `constants/typography.ts`, `tailwind.config.js`, `app/_layout.tsx`.

Updated shared UI:
`components/ui/Button.tsx`, `components/ui/Card.tsx`, `components/ui/Input.tsx`, `components/shared/ScreenHeader.tsx`, `components/layout/ScreenWrapper.tsx`, tab layouts for buyer/vendor/admin.

Added Figma parity assets and routing:
`assets/figma-screens/*`, `constants/figmaRouteScreens.ts`, `components/figma/FigmaScreenOverlay.tsx`.

## Residual Risks

The parity layer is visual-first: it overlays exact Figma screen PNGs and passes pointer events through to the native app. This gives strict first-viewport visual matching, but it is not the same as rebuilding all 100+ screens as fully native component trees.

Some routes have no one-to-one Figma frame in the export and are mapped to the closest available reference. These should be prioritized later if unique native screens are required: buyer `profile`, buyer `explore`, admin `buyers`, admin `settings`, and buyer chat detail.

Web runtime verification is blocked because the project declares `expo start --web` but does not have `react-dom` and `react-native-web` installed. I did not install new dependencies during this pass.

## Verification

Passed: `npx.cmd tsc --noEmit`

Blocked: `npm run web -- --port 8081`
Reason: Expo reported missing web dependencies: `react-dom@19.1.0` and `react-native-web@^0.21.0`.
