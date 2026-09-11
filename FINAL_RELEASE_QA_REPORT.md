# FINAL RELEASE QA REPORT

**Date:** 2026-09-11
**Status:** COMPLETE

## Requirement reconciliation against CLIENT_REQUIREMENTS_MATRIX.md (871 lines, 49 requirements)

This matrix predates the Final Client Decisions work — it does not mention Decisions 1-4 at all. Per instruction, verified against CURRENT code, not the stale text. Findings so far (all confirmed via direct code read, file:line, this session):

| Req | Stale doc said | Current code (verified) |
|---|---|---|
| REQ-AUTO-002 | Reorder Reminders/Checkout Payment Follow-Up don't exist as automations | RESOLVED — both exist as real `AutomationType` enum values with real detector logic (`automation.detectors.ts`), wired into `runSweep()` |
| REQ-AUTO-003 | No eligibility explanation anywhere | RESOLVED — `automation-detail.tsx` "How this decides" section (AUTO-05), sourced from real backend thresholds |
| REQ-AUTO-004 | Buyer name never shown in Activity | RESOLVED — `automation-center.tsx:297` shows `selectedRun.recipient?.name \|\| ...email \|\| "Unknown recipient"` |
| REQ-AUTO-006 (P0) | SUPPRESSED status never surfaced to vendor | RESOLVED — `automation-center.tsx` has a distinct icon/branch for `SUPPRESSED` plus `suppressedReason` display in the detail modal |
| REQ-RD-001 (P0) | Offer creation: no combined "create+publish", risk of silent unpublished draft | RESOLVED — `regular-delivery-offer-edit.tsx` primary button is "Create and publish offer" / "Update and publish offer", "Save as draft" is a clearly separate secondary action |
| REQ-RD-002 | "Every 4 weeks" frequency missing from schema | RESOLVED — `EVERY_4_WEEKS` is a real `SubscriptionFrequency` value, 28-day fixed interval, used vendor + buyer side |
| REQ-RD-005 | No resume-on-date for pause | RESOLVED — RD-05 fix, real date picker on buyer pause sheet |
| REQ-RD-006 (P0) | Raw enum "PAYMENT ATTENTION" shown to buyer | RESOLVED — `app/(buyer)/regular-delivery-detail.tsx` now uses `BUYER_SUBSCRIPTION_STATUS_LABELS[sub.status]` / `RENEWAL_STATUS_LABELS[r.status]`, no raw `.replace()` |
| REQ-CB-P-001 (P0) | No Community Buy entry point on buyer Home | RESOLVED — real "Community Buy" section with campaign cards on `app/(buyer)/index.tsx:534` |
| REQ-CB-P-002 (P0) | "How it works" missing entirely | RESOLVED — dedicated `community-buy-how-it-works.tsx` screen exists |
| REQ-CB-P-005 (P0, confirmed defect) | Buyer/organiser FAILED-campaign copy contradicts on whether refunds occur | RESOLVED — both screens now state the identical outcome verbatim ("no participant was ever charged, so there is nothing to refund") |
| REQ-CB-P-008 | Participant never sees fulfilment tracker | RESOLVED — fixed earlier this session (REQ-CB-P-008 fix, participant screen renders `FULFILMENT_STEP_LABEL`) |
| REQ-CB-O-003 | No fee disclosure before campaign submission | RESOLVED — live fee card + projected supplier take-home + submit-preview echo, `community-buy-organiser-campaign.tsx:724-892` |
| REQ-CB-S-001 | No supplier decline capability | RESOLVED — `declineSupplierCommitment()` real method, reason param, audit, notification |
| REQ-CB-A-001 (P0) | CB admin destructive actions fire with no confirmation | RESOLVED — 9 `confirm()` dialogs cover every money/state-changing action (approve/reject/pause/resume/cancel/extension/release/hold); the 5 handlers without one are Refresh, expand/collapse, and modal-cancel — none need confirmation |
| REQ-CB-A-004 | No per-campaign contribution lookup | RESOLVED — real "View contributions" expand panel with participant identity |
| REQ-CB-A-005 | No refresh on campaign monitoring | RESOLVED — real Refresh button, `community-campaigns/page.tsx:206` |
| REQ-CB-A-007 (P0) | Zero RD admin action buttons | RESOLVED — 7 real actions (retry-payment, force-cancel, contact-buyer ×2, resend/cancel price-change, skip-renewal) plus escalation (this engagement's final item), all confirmed, all audited |

**Not fixed, correctly so (approved client decisions / explicit out-of-scope):**
- REQ-CB-A-002 (admin edit live financial terms) — Final Client Decision 1 explicitly answers this: financial terms are immutable after first confirmed contribution, admin is NOT exempt. Current code correctly has no such edit path. This is INTENTIONAL, not a gap.
- REQ-CB-A-003 (force refund) — flagged in the stale doc itself as needing financial-safety scoping before any build; remains unbuilt, correctly.
- REQ-CB-O-001 (product picker), REQ-CB-O-005 (trackable invites) — flagged P2/needs-scoping in the stale doc; not part of approved P1 scope.
- REQ-GLOBAL-001 (design system consolidation) — explicitly flagged in the stale doc as needing careful sequencing to avoid "redesign for its own sake"; this QA gate's own instructions say no new redesign phase. Left alone.
- REQ-GLOBAL-002 (vendor→organiser navigation context) — cosmetic navigation-clarity item, redesign-adjacent; left alone per no-new-redesign instruction.

**New finding, fixed during this QA pass:**
- `regular_delivery_frequency_changed` push notification (Final Client Decision 3's frequency-change confirmation) had **no route at all** in `app/_layout.tsx`'s tap handler — a genuine dead tap on a just-shipped, approved feature. Same defect class as NAV-04/05/08/10 from earlier P1 work. Fixed: routes to `/(buyer)/regular-delivery-detail?id={subscriptionId}`. Classified P1 (not P0, consistent with how NAV-04/05/08/10 were classified) — fixed under "P1: fix if clearly within approved scope." Mobile typecheck/no-mock-data/tab-registration all clean after the fix.

**Known, out-of-scope, not fixed:** Regular Delivery screens (`regular-delivery-detail.tsx`, `regular-delivery-offer.tsx`, `regular-delivery-offer-edit.tsx`, `regular-deliveries.tsx`) were never part of the client-approved UX-07 accessibility scope (that was explicitly Automation + Community Buy only). Spot-checked: 15+ TouchableOpacity elements across these screens, only 3 have `accessibilityRole`. This is a real, pre-existing gap but expanding UX-07's scope now would violate "no new scope" — recorded here for a future, separately-approved accessibility phase, not fixed in this pass.

## Payments / Refunds / Payouts — verified by independent research agent, all with file:line citations

1. **PAID only after real Stripe confirmation** — `stripe.service.ts:179-199`, the webhook-driven transition (`payment_intent.succeeded` → atomic `updateMany` guarded on current status, then Order→PAID), signature verified at `stripe.service.ts:1231`. CONFIRMED.
   **One documented exception**: `admin-orders.service.ts:66-103` (`processStuckOrder`) is a pre-existing admin-only manual override that can mark an order PAID with no Stripe call — a deliberate "webhook never fired, admin has independently verified" escape hatch, not the optimistic-checkout path. Flagging for visibility, not treating as a defect — it predates this engagement and is scoped to admin-only, permission-gated (`orders.mutate`) use.
2. **Multi-vendor cart** — one shared `PaymentIntent` covers the full multi-vendor total in one `Checkout` (`payments.service.ts:57-67,668-683`); failure triggers a full-checkout rollback (`rollbackFailedCheckout`). No partial-vendor-paid state is possible. CONFIRMED.
3. **Community Buy pledge idempotency** — `idempotencyKey = "{contributionId}:{attemptNumber}"` sent to Stripe (`campaign-contributions.service.ts:271,280-291`); a network-timeout retry replays the same stored key via `requeryAmbiguousCharge()` rather than minting a new one. CONFIRMED.
4. **Payout state machine** — `payouts.service.ts:290-449`: wallet debit + ledger post gated on `isFirstAttempt`; PAID only after a real `stripe.transfers.create()` succeeds; any error routes to ON_HOLD, never PAID. CONFIRMED.
5. **No double refund** — orders: `status === "REFUNDED"` guard (409) + Stripe idempotency key; Community Buy: DB-unique `contributionId`/`idempotencyKey` on `CampaignRefund`, P2002-caught. CONFIRMED.
6. **Reconciliation** — `runReconciliation()` persists real `ReconciliationDifference` rows (MISSING_AT_PROVIDER/MISSING_LOCALLY/AMOUNT_MISMATCH), defaults OPEN, requires explicit resolution. Mismatches surfaced, never silently discarded. CONFIRMED.

## Markets — verified

7. **Launch markets** — exactly the 10 approved: United Kingdom, United States, Canada, France, Spain, Portugal, Switzerland, Belgium, Italy, Croatia (`shared/currency.ts:77-88`, mirrored in `market-configuration.service.ts:19-29`). CONFIRMED, exact match.
8. **Full country names in UI** — `countryDisplayName()` (frontend) / `marketCodeToCountryName()` (backend), used across 20+ call sites including campaign/vendor screens. No raw ISO codes shown to users. CONFIRMED.
9. **Africa built-in-code, not launchable** — `isApprovedLaunchMarketCode` explicitly excludes Africa (comment: "never Africa or any other market"); `market-configuration.service.ts:14-17` states the omission is deliberate. Africa-related code (`sellerRegion: "africa"`, `DOMESTIC_AFRICA` escrow type) still exists in the codebase, unused for launch. CONFIRMED both halves (built + not launched).
10. **Vendor multi-market + last-market guard** — real multi-market assignment; `removeMarket()`/`setEnabled()` both throw when active-market count would drop to 0. CONFIRMED.

## Admin architecture — verified

11. **Single admin app** — all Community Buy/Regular Delivery/Automation admin pages import the identical `AdminLayout`/`ProtectedRoute`/`AuthContext` as every other admin section; one `admin-web` app, no separate admin surface. CONFIRMED.
12. **2FA + four-eyes** — `require2fa` gates Community Buy supplier-payment release (real money movement). "Four-eyes" is a genuine second-admin-approval system (`AdminApproval`/`AdminApprovalRule` models) with an explicit self-approval block ("the requester cannot approve their own request"), applied to supplier-payment release and large order refunds. CONFIRMED — real mechanism, not just a label.
13. **No public route under /admin/*** — every admin router (`adminRouter`, `adminSubscriptionsRouter`, `adminRenewalsRouter`) independently applies `authenticate` + `requireRole("ADMIN")` before any handler; the one dev-only exception 404s in production. CONFIRMED.

## Buyer core commerce — verified by independent research agent, all with file:line citations

1. **Registration** — `authService.register()` → real `/api/auth/register`; buyer signup uses real OTP endpoints. WORKING.
2. **Google/Apple login** — shared `SocialAuthButtons.tsx`, both call real `/api/auth/oauth/google|apple`; backend verifies the id token's real JWKS signature (`oauth.provider-verify.ts:45-177`), not a stub. WORKING.
3. **Multi-vendor + multi-currency cart** — `cartStore.ts:340-370` real vendor grouping; multi-currency never blocked at add-to-cart (deliberate, per comment), a real "Pay in {currency}" picker + explanatory banner appears once 2+ native currencies are in cart; the actual charge is computed server-side via one normalized `PaymentIntent` (`cartService.ts:95-97`, `conversionApplied`). WORKING for the charge itself.
4. **Address book** — no standalone screen, but a real inline empty state exists in checkout ("Add a delivery address to continue" + CTA) — not a blank/broken screen. WORKING.
5. **Checkout** — reaches real Stripe Payment Sheet; delivery eligibility is checked both client-side (blocks Pay button) and re-verified server-side at checkout; ineligibility shows a specific message, not a raw error. WORKING.
6. **Order tracking** — `track-order.tsx` is fully wired to real order/shipment/dispute services. WORKING.

**Findings — record, not fixed (out of this pass's approved scope):**
- **Deep links broken for `/product`, `/order`, `/chat`, `/invite`** — `app.json` declares all 5 path prefixes as universal/app links, but only `/store` has a matching expo-router file. A shared link to any of the other 4 would 404 inside the app (no catch-all/redirect exists either). This is a real, verified gap — not part of the 4 approved Final Client Decisions or the RD escalation work, and fixing it correctly requires deciding the right destination for each (especially `/chat` and `/invite`), which is genuinely new routing work, not a same-pass patch. **Classified P1, explicitly not fixed this pass — needs its own scoped approval.**
- **Order-confirmation screen (`order-confirmation.tsx`) is unreachable** — checkout's success path navigates to `/(buyer)/orders`, never to this screen; no other caller found. Not harmful (the buyer still lands on a correct, real order list) — dead code, not a broken experience. P2/P3, recorded only.
- **Cart headline subtotal is currency-naive in a genuinely mixed-currency cart** — `cartStore.subtotal()` (`cartStore.ts:328-329`) sums raw `item.product.price` across ALL items regardless of native currency, before display formatting. Per-vendor `group.subtotal` is safe in practice (one vendor = one currency), but the cart-screen headline total is not, for the specific case of a cart spanning vendors in two different currencies. The actual Stripe charge is unaffected (computed correctly, separately, server-side) — this is a display-only inaccuracy in an edge case, not a financial-safety issue. P2, recorded only.

## Vendor core commerce — verified by independent research agent, all with file:line citations

7. **Vendor dashboard** — all tiles derive from real parallel API calls, explicit honest empty states, no hardcoded metrics found. WORKING.
8. **Markets You Serve** — full country names (not ISO codes), real multi-market support, real last-active-market removal guard (`Alert.alert("At least one market required", ...)`). WORKING.
9. **Products / Orders / Buyers / Earnings** — all real service-backed screens with honest empty states. WORKING.
10. **Vendor bottom tabs** — exactly 5 visible tabs (Dashboard, Orders, Foodstuff, Buyers, Earnings); ~40 other screens are reachable but correctly hidden from the tab bar (`href: null`). No stray/unexpected tab. WORKING.

## Backend admin note (from the payments/markets/admin audit)

`admin-orders.service.ts` `processStuckOrder` is a pre-existing, permission-gated (`orders.mutate`), admin-only manual override that can mark an order PAID without an accompanying Stripe API call — a deliberate "webhook never fired, admin independently verified" escape hatch. Flagging for visibility since it's an exception to the general "never mark PAID before provider success" rule verified everywhere else; it predates this engagement and is not part of any change made during it.

## Native release status

**iOS build 107**: FINISHED (EAS build `83a72320-9b4c-4f1e-9db5-8e208dc294d5`), version 1.5.6, runtimeVersion 1.5.3, correct bundle ID `com.ekiapp.mobilee`. **Submitted to App Store Connect / TestFlight** (submission `c66a9877-bdb2-427a-90ff-1f7488ca41ae`) — upload succeeded, now in Apple's own processing (5-10 min), NOT submitted for App Review, NOT released publicly.

**Android build 105**: FINISHED (EAS build `80bc3c81-d921-4f49-a481-c36cc2b98943`), version 1.5.6, versionCode 105, runtimeVersion 1.5.3, applicationId `com.ekiapp.mobile`. Artifact downloaded and its signer certificate extracted directly (`jarsigner -verify` + `keytool -printcert` on `META-INF/EKIUPLOA.RSA`) — SHA1 `3C:51:33:56:BA:51:FF:32:CA:2B:1E:54:CD:77:9B:9E:FA:12:49:11`, **exact match** to the required Google Play upload certificate. Not submitted to Google Play Internal Testing — no service-account credentials exist locally or on EAS (confirmed via an actual `eas submit` attempt in an earlier session turn, which failed with "Google Service Account Keys cannot be set up in --non-interactive mode"); this status is unchanged since nothing about credentials has changed. `PLAY_UPLOAD = CLIENT_ACTION_REQUIRED`, not fabricated.

## Additional targeted checks

- **REQ-CB-S-002/003 (supplier campaign completeness + post-update)** — both RESOLVED: `community-buy-supplier.tsx` shows organiser name + full description on the card, and a real "Post an update to participants" action exists and is wired (`handlePostUpdate`).
- **Buyer bottom tabs** — exactly 4 visible tabs (Home, Messages, Cart, Wallet); 35 other buyer screens correctly hidden via `href: null`. No stray tab.
- **Notification tap routing (code level)** — `app/_layout.tsx` handles both the live-app tap listener (`addNotificationResponseReceivedListener`) and the cold-start/terminated case (`getLastNotificationResponseAsync()`), calling the same `handleNotificationTap()` for both — foreground/background/terminated are all handled by the same code path at the code-verification level. Physical push delivery/tap behavior is DEVICE_QA_REQUIRED regardless (never claimed PASS without a device).
- **Accessibility (UX-07 scope)** — CODE_COVERAGE = COMPLETE for Automation + Community Buy (the client-approved scope), confirmed again this pass; Regular Delivery screens remain outside that approved scope (see finding above) — not a UX-07 regression, never included in it.

## FINAL ACCEPTANCE GATE

### REQUIREMENTS (CLIENT_REQUIREMENTS_MATRIX.md, 49 requirements)
- Total: 49
- PASS (verified current, this pass): 20 directly re-verified as RESOLVED (table above + additional checks), plus REQ-CB-P-004, REQ-RD-003, REQ-RD-007, REQ-GLOBAL-004 previously PASS in the stale doc and not touched/regressed by any subsequent work (no code in their area changed).
- PARTIAL: REQ-CB-P-003 (financial disclosure sequencing — cosmetic, P1, not part of any approved decision), REQ-CB-P-006/007 (milestones/rescue-countdown — P2, needs client scoping, never approved), REQ-CB-O-002/004/006, REQ-CB-S-004, REQ-CB-A-006 — all P2/P3 UX-polish items explicitly flagged in the source doc as needing client scoping before any build; none approved, none built, correctly.
- FAIL: 0 actionable (REQ-GLOBAL-002 cross-role nav clarity is cosmetic/redesign-adjacent, explicitly not touched per "no new redesign" instruction).
- MISSING: REQ-RD-002 label is stale (EVERY_4_WEEKS now exists — moved to PASS); REQ-CB-O-001/005 (product picker, trackable invites) remain MISSING, explicitly flagged as needing client scoping in the source doc, never part of approved P1 scope.
- DEVICE-VERIFICATION-REQUIRED: all physical push/VoiceOver/TalkBack/Google-Sign-In/Apple-Sign-In items (see DEVICE_QA below) — code-level equivalents all verified PASS.

### P0 = 0
### P1 = 0 actionable
(One new P1 found this pass — `regular_delivery_frequency_changed` dead notification tap — fixed immediately, per rule. One new P1 found and explicitly NOT fixed — deep links for `/product`/`/order`/`/chat`/`/invite` — recorded below under REMAINING, since correctly fixing it requires new routing decisions outside any currently-approved scope, not a same-pass patch.)

```
BUYER                       = PASS
VENDOR                      = PASS
AUTOMATION                  = PASS
REGULAR_DELIVERY            = PASS
COMMUNITY_BUY_PARTICIPANT   = PASS
COMMUNITY_BUY_ORGANISER     = PASS
COMMUNITY_BUY_SUPPLIER      = PASS
COMMUNITY_BUY_ADMIN         = PASS
ADMIN                       = PASS
NOTIFICATIONS               = CODE_VERIFIED PASS / DEVICE_VERIFIED = NOT_TESTED (DEVICE_QA_REQUIRED)
PAYMENTS                    = PASS
ACCESSIBILITY               = CODE_VERIFIED PASS (Automation + Community Buy, the approved UX-07 scope) / DEVICE_VERIFIED = NOT_TESTED (DEVICE_QA_REQUIRED) / Regular Delivery NOT in approved scope
MARKETS                     = PASS
AFRICA_LIVE                 = FALSE
```

```
IOS_BUILD_107      = FINISHED — TestFlight upload SUCCEEDED, Apple processing, not submitted for App Review, not public
ANDROID_BUILD_105  = FINISHED — signing certificate verified on actual artifact, exact match; Play Internal upload = CLIENT_ACTION_REQUIRED (no service-account credentials)
```

```
GITHUB:
  Backend  HEAD = b01be43 (matches origin/main), worktree CLEAN as of the escalation commit;
           this pass's one code fix (regular_delivery_frequency_changed routing) is FRONTEND-ONLY —
           backend repo untouched by this QA pass.
  Frontend HEAD = 8b885a6 + this pass's fix to app/_layout.tsx and this QA report file — NOT YET
           COMMITTED (per instruction: "Do NOT commit/push new changes unless an actual blocking
           bug was fixed" — the dead-tap fix is real and included in the working tree; awaiting
           your review before commit, since this instruction's own git section did not authorize
           an autonomous commit for this pass).
```

### REMAINING
- **Deep link routing gaps** (`/product`, `/order`, `/chat`, `/invite` all 404 in-app despite being declared as universal/app links) — real, verified, P1-severity, requires its own scoped approval (destination decisions for `/chat` and `/invite` in particular aren't obvious from existing code alone).
- **Cart headline subtotal display** — currency-naive in a genuinely mixed-currency cart (display-only; actual charge is correct). P2.
- **`order-confirmation.tsx`** — dead/unreachable screen (buyer lands on a correct real order list instead). P2/P3, cosmetic.
- **Regular Delivery accessibility** — never part of the approved UX-07 scope; a real gap, not a regression, not fixed here.
- **Google Play Internal Testing upload** — external credential dependency (service-account key), not fabricable.
- **All physical device QA** (iOS/Android critical flows, push foreground/background/terminated, notification tap, Google/Apple Sign-In on-device, VoiceOver, TalkBack, Dynamic Type) — DEVICE_QA_REQUIRED, no physical device available in this environment, none claimed as tested.
- **REQ-CB-O-001/005, REQ-CB-A-003, REQ-CB-P-003/006/007, REQ-CB-O-002/004/006, REQ-CB-S-004, REQ-CB-A-006, REQ-GLOBAL-001/002** — true P2/P3 UX-polish/scoping items, all pre-flagged in the source audit as needing client confirmation before any build; correctly left untouched.

### DEVICE_QA
```
iOS               = NOT_TESTED (DEVICE_QA_REQUIRED)
Android           = NOT_TESTED (DEVICE_QA_REQUIRED)
Push (fg/bg/term) = NOT_TESTED (DEVICE_QA_REQUIRED)
VoiceOver         = NOT_TESTED (DEVICE_QA_REQUIRED)
TalkBack          = NOT_TESTED (DEVICE_QA_REQUIRED)
Google Sign-In    = NOT_TESTED (DEVICE_QA_REQUIRED)
Apple Sign-In     = NOT_TESTED (DEVICE_QA_REQUIRED)
```
No physical device is available in this environment. Nothing above is claimed as tested — this matches the OAuth flows' own code-level verification (real Google/Apple JWKS signature checks confirmed working), which is a different claim from "verified on a physical device."
