# Final Manual QA Plan

**Purpose:** Practical device/browser QA checklist to close the DEVICE-ONLY gaps left open by the Final Gap Audit (code review alone cannot confirm these), plus targeted regression checks for the highest-risk areas this engagement touched. Cross-referenced to `FINAL_CLIENT_GAP_AUDIT.md` finding IDs where applicable.

**How to use:** Each item lists Role, Prerequisite, Action, Expected Result, and Pass/Fail criteria. Run on at least one real iOS device and one real Android device for anything involving push notifications, VoiceOver/TalkBack, Dynamic Type, or keyboard behavior — a simulator is not sufficient for push delivery or accessibility-service testing.

---

## 1. Buyer QA

**B-1 — Community Buy discovery respects market gate**
Role: Buyer. Prerequisite: account with delivery country set to a market where `communityBuyEnabled=false` (e.g. Croatia if still off) and one where it's `true` (UK). Action: open Home in both accounts. Expected: Community Buy section visible only in the enabled-market account; no broken/blank section in the disabled one. Pass: section absence is clean, no error flash.

**B-2 — Pledge and financial disclosure copy (PLEDGE_THEN_CHARGE)**
Role: Buyer. Prerequisite: a live Community Buy campaign in your market. Action: open a campaign → choose quantity → review → payment. Expected: disclosure text on Quantity screen states card is not charged now and will only be charged if the campaign reaches minimum. Pass: no step implies immediate charge; wording is consistent across Quantity/Review/Payment screens.

**B-3 — Campaign fulfilment status after success**
Role: Buyer (participant). Prerequisite: a campaign you pledged into that has reached FULFILLING/SUCCEEDED. Action: open the campaign detail screen. Expected (per REQ-CB-P-008, currently PARTIAL): today this will show only a generic "updates will be shared" sentence — confirm this is the current (known) behavior, not a crash, and re-test once the fix ships to confirm the real fulfilment step now renders.

**B-4 — Rescue window countdown**
Role: Buyer (participant). Prerequisite: a campaign currently in RESCUE_WINDOW. Action: check both "My Community Buys" list and the campaign detail screen. Expected: countdown date shows on the list (should pass); confirm whether it also now shows on the detail screen (was missing — REQ-CB-P-007).

**B-5 — Regular Delivery subscribe: substitution/fulfilment visibility**
Role: Buyer. Prerequisite: an active Regular Delivery offer. Action: open the offer detail screen before subscribing. Expected (per RD-04, currently PARTIAL): substitution policy and fulfilment method are not shown pre-subscribe today — confirm this matches, then re-check after the fix ships.

**B-6 — Regular Delivery pause with resume date**
Role: Buyer. Prerequisite: active subscription. Action: tap Pause. Expected (per RD-05): today there is no way to pick a resume date — confirm the Pause flow's actual current options match this.

**B-7 — Core flows unaffected: Home, Cart, Wallet, Orders, Login**
Role: Buyer. Action: full pass through Home → Product → Add to cart → Checkout → Wallet balance check → Order history → Log out → Log back in. Expected: no regressions from this engagement's changes. Pass: all core flows work exactly as before Community Buy/Automation/Regular Delivery work began.

---

## 2. Vendor QA

**V-1 — Automation Centre: does anything actually send? (AUTO-16)**
Role: Vendor. Prerequisite: a vendor account with Cart Recovery enabled and a genuinely abandoned cart older than the configured threshold. Action: wait for the next scheduled cron run (or trigger the sweep manually if you have ops access) and check the buyer's Notification list / push tray, and the vendor's Automation Activity screen. Expected (per AUTO-16, currently FAIL): no automation will fire today due to the quiet-hours/cron-time collision. **This is the top-priority QA item in the whole plan** — confirm the fix (cron time change) actually results in a real send before considering Automation "launched."

**V-2 — Automation Activity: Payment Recovery / Price Approval Reminder visibility (AUTO-06)**
Role: Vendor. Prerequisite: a subscription with a failed renewal payment (triggers `PAYMENT_RECOVERY`). Action: check the vendor's Automation Activity screen, filtered to that type. Expected (currently FAIL): the run will not appear at all, even though it fired — confirm this matches, re-test after the `vendorId` fix.

**V-3 — Regular Delivery entry point market gating (MKT-03)**
Role: Vendor. Prerequisite: accounts in a market with `regularDeliveriesEnabled=true` and one with it `false`. Action: check the vendor Dashboard's "Regular Deliveries" row in both. Expected (currently PARTIAL/FAIL): the row shows unconditionally in both today — confirm, then re-check after the gating fix ships (should hide in the disabled market, matching the adjacent Community Buy row's behavior).

**V-4 — Regular Delivery vendor-facing raw status text (RD-09)**
Role: Vendor. Prerequisite: a subscriber whose subscription is in `PAYMENT_ATTENTION`. Action: open Regular Deliveries → Subscribers tab, and the subscriber detail screen. Expected (currently FAIL): status shows as raw "PAYMENT ATTENTION" rather than a friendly label — confirm, re-test after fix.

**V-5 — Payout notification tap-through (NAV-04, P0)**
Role: Vendor. Prerequisite: a pending/approved/paid payout request; push notifications enabled on a real device. Action: trigger a payout status change (request, admin approves, admin pays) and tap the resulting push notification on the device. Expected (currently FAIL): tapping does nothing today. **Re-test after the fix — this must open the vendor's payout history/detail screen.**

**V-6 — Order-lifecycle and verification push tap-through (NAV-06, P0)**
Role: Vendor and Buyer. Prerequisite: real device, push enabled. Action: (a) get a vendor account verified/rejected by admin and tap the resulting push; (b) as a buyer, place, confirm, ship, and mark an order delivered, tapping each resulting push. Expected (currently FAIL): none of these currently navigate anywhere on tap. **This is the single highest-traffic dead-tap found — verify the fix covers all 6 event types before sign-off.**

**V-7 — Escrow/delivery-confirmed notification wording and tap-through (NAV-05, PAY-03)**
Role: Vendor. Action: trigger a dispute on an order and read the resulting push notification body; also trigger the auto-release sweep (or wait for a real one) and tap the resulting push. Expected: dispute push body currently says "escrow" — confirm this reads acceptably or flag for copy fix; auto-release push tap currently does nothing — confirm, re-test after fix.

**V-8 — Vendor payout: verify a real transfer actually occurs (PAY-05, P0)**
Role: Admin (acting on a vendor's payout) + Vendor. Prerequisite: a test vendor with a connected Stripe account in a sandbox/test mode. Action: admin marks a payout request as paid; separately, verify in the Stripe dashboard (test mode) that a real transfer was created. **Do this at least twice in a row for the same request to test for accidental duplicate transfers** given the missing idempotency key. Expected: exactly one transfer per payout, with a real transfer ID recorded. Pass/Fail: any duplicate transfer, or a payout marked "PAID" with no corresponding Stripe transfer, is a FAIL — do not consider this launch-ready until fixed and re-verified.

**V-9 — Automation Centre accessibility (UX-07)**
Role: Vendor. Prerequisite: VoiceOver (iOS) or TalkBack (Android) enabled. Action: navigate the Automation Center, Automation Detail, and Automation Activity screens using only the screen reader. Expected (currently FAIL — 0% accessibility label coverage on these screens): elements will likely be unlabeled or read generically ("button", "text"). Pass: every interactive element announces a clear, specific label.

**V-10 — Core flows unaffected: Dashboard, Orders, Foodstuff, Earnings**
Role: Vendor. Action: full pass through Dashboard → Orders → mark an order shipped → Foodstuff catalog → add/edit a product → Earnings/payout history. Expected: no regressions.

---

## 3. Organiser QA

**O-1 — Notification deep link after supplier declines (NAV-08, P1)**
Role: Organiser. Prerequisite: real device, push enabled; a supplier who will decline a campaign commitment. Action: have the supplier decline with a reason; tap the resulting push notification as the organiser. Expected (currently FAIL): lands on the generic participant view today, not the organiser screen with the decline reason and reassignment picker. **This is the single most time-sensitive misrouted notification found — verify the fix explicitly.**

**O-2 — Notification deep links for cancel/rescue/extension/outcome events (NAV-08)**
Role: Organiser. Action: as an admin, cancel one of your campaigns; separately, let one enter RESCUE_WINDOW; separately, get an extension request approved. Tap each resulting push. Expected (currently FAIL for all): each currently lands on the wrong (participant) screen — verify the fix routes all of them to the organiser management screen.

**O-3 — Live campaign dashboard progress visibility (CBO-13)**
Role: Organiser. Prerequisite: a campaign currently LIVE and healthy (not in rescue). Action: open your own campaign's management screen. Expected (currently PARTIAL): no progress bar/headline number shown for a healthy LIVE campaign today (only appears once in rescue) — confirm, re-test after fix.

**O-4 — Financial terms lock enforcement**
Role: Organiser. Prerequisite: a campaign with at least one confirmed contribution. Action: attempt to edit minimum/goal/maximum/price/deadline. Expected: rejected with a clear "terms locked" message. Pass: cannot be bypassed via any UI path.

**O-5 — Extension request one-max enforcement**
Role: Organiser. Prerequisite: a campaign that has already used its one allowed extension. Action: attempt to request another. Expected: button disabled/relabeled "Extension already used." Pass: no way to submit a second request.

---

## 4. Supplier QA

**S-1 — Decline with reason → organiser sees it → reassignment → new invitation (full round trip)**
Role: Supplier, then Organiser, then new Supplier. Action: decline a campaign invitation with a typed reason; as organiser, confirm the reason displays and reassign to a new supplier; as the new supplier, confirm a fresh invitation notification arrives. Expected: all three steps work (backend confirmed PASS) — this QA pass is to confirm the **notification tap** at each step also lands correctly (cross-ref O-1/O-2 and NAV-09).

**S-2 — Notification tap-through for supplier_order_created (NAV-09)**
Role: Supplier (vendor account). Prerequisite: a campaign you supply reaches FULFILLING. Action: tap the resulting push notification. Expected (currently FAIL): lands on a buyer-only route today — confirm, re-test after fix.

**S-3 — Post a campaign update, confirm participant sees it correctly attributed**
Role: Supplier, then Participant. Action: post an update from the supplier fulfilment screen; check a participant's view of the campaign. Expected: update appears with a "Supplier" pill (backend confirmed PASS) — confirm visually.

**S-4 — Payment status visibility through all 5 states**
Role: Supplier. Action: track a single campaign's payment through NOT_RELEASED → PROCESSING → PAID (or → ON_HOLD/FAILED if applicable). Expected: correct label + placeholder copy at every stage, including before any payment record exists.

---

## 5. Admin QA

**A-1 — Supplier payment release/hold with 2FA enabled (CBA-08, P0)**
Role: Admin. Prerequisite: an admin account with 2FA **enabled**. Action: attempt to release or hold a Community Buy supplier payment. Expected today (FAIL): a 403 error with no way to enter a 2FA code — the action is completely blocked. **Do not consider this admin surface launch-ready until a 2FA-code modal is added and this passes.**

**A-2 — Four-eyes approval flow for a large supplier payment**
Role: Two admin accounts (Super Admin + Supplier Settlement). Prerequisite: an `AdminApprovalRule` configured for `community_buy.supplier_payment_release` with a threshold. Action: admin 1 attempts a release above threshold; confirm a 202 "pending approval" response with correct messaging (not "released"); admin 2 (different account) approves it via `/approvals`; confirm the transfer then actually executes. Pass: admin 1 cannot approve their own request (self-approval blocked); the payment only actually releases after admin 2's decision.

**A-3 — Refund escalation idempotency (CBA-06)**
Role: Admin. Action: escalate a refund; reload the page; escalate the same refund again. Expected today (FAIL): a second support case is created. Pass criteria after fix: the second attempt should either be blocked or clearly reuse the existing case.

**A-4 — Campaign pause/resume notifies the organiser (CBA-09)**
Role: Admin, then Organiser (on a second device/account). Action: admin pauses a live campaign; check whether the organiser receives any notification. Expected today (FAIL): no notification is sent. Pass criteria after fix: organiser receives a clear "your campaign was paused by an admin" notification.

**A-5 — "Request changes" confirmation (CBA-12)**
Role: Admin. Action: click "Request changes" in the campaign review queue. Expected today (FAIL): fires immediately with no confirmation, unlike Approve/Reject in the same row. Pass criteria after fix: a confirm dialog appears first.

**A-6 — Audit log entityId filter and before/after state**
Role: Admin. Action: perform any campaign action, then click "View audit history" from that campaign's card. Expected: audit log opens pre-filtered to that campaign's ID, and expanding a "pause"/"cancel" entry shows the real before/after status. Pass: backend confirmed correct — verify the UI experience is smooth.

**A-7 — Admin Regular Delivery remediation (RD-08) — confirm it's still absent**
Role: Admin. Action: open the Subscription Exceptions page and attempt to act on a stuck renewal. Expected today: zero action buttons exist. This is a known, reported gap — confirm nothing has silently regressed further (e.g., a broken button appearing without backend support).

**A-8 — Public market-config endpoint exposure (SEC-01)**
Role: Anyone (no login). Action: `curl https://<api-host>/api/community-buy/markets` with no Authorization header. Expected today: full `MarketConfiguration` rows returned, including fee basis points and payment mode. Pass criteria after fix: only the documented feature-gating fields are present.

**A-9 — Admin dispute resolution confirmation (UX-06)**
Role: Admin. Action: resolve a dispute in the vendor's favor. Expected today: no confirmation dialog before funds are released, despite requiring a note + 2FA. Confirm current behavior; consider whether a confirm step should be added given the direct financial consequence.

---

## 6. Push / Background / Killed-App QA

**PK-1 — Foreground push**
Role: any. Action: with the app open and in the foreground, trigger any real notification (e.g. a new message). Expected: an in-app banner/sound appears immediately.

**PK-2 — Backgrounded push**
Role: any. Action: background the app (not killed), trigger a notification, tap the system tray notification. Expected: app foregrounds and navigates per the routing rules being tested elsewhere in this plan.

**PK-3 — Killed-app push and cold-start tap routing**
Role: any. Action: fully force-quit the app (swipe away from app switcher, not just background), trigger a real notification, wait for it to arrive in the system tray, then tap it to cold-launch the app. Expected: app launches directly into the correct screen for that notification type (uses `getLastNotificationResponseAsync()` per the architecture — confirmed present in code, never tested on-device in this audit). Pass: the app does not just open to Home; it navigates to the specific relevant screen exactly as it would from a warm tap.

**PK-4 — OS-level notification settings interaction**
Role: any. Action: with OS notification permission fully denied, open the in-app notification-permission screen (vendor Automation Center banner, or equivalent). Expected: a "denied, can't ask again" state that deep-links to OS Settings, not a silent failure or repeated in-app prompt.

**PK-5 — Android notification channels / iOS categories**
Role: any, both platforms. Action: check OS notification settings for the app — confirm distinct channels/categories exist (default/orders/payouts/messages per the code) and that muting one doesn't silently mute all.

**PK-6 — Token invalidation on uninstall/reinstall**
Role: any. Action: uninstall the app (or revoke notification permission at the OS level), leaving the old push token in the backend; trigger a notification; confirm no crash/error on the backend and that the stale token is eventually cleaned up (may take up to ~24h per NOTIF-05's disclosed cron-cadence caveat — do not expect immediate cleanup).

---

## 7. Payments / Refunds QA

**PR-1 — Community Buy pledge → success → real charge**
Role: Buyer, then Admin/system. Prerequisite: a test campaign near its minimum, Stripe test mode. Action: pledge enough to push it over minimum before deadline; let the campaign close. Expected: a real PaymentIntent is created and charged only now, not at pledge time — confirm in Stripe test dashboard.

**PR-2 — Community Buy pledge → failure → no charge, no refund row**
Role: Buyer. Action: let a campaign fail below minimum with your pledge still PLEDGED. Expected: your saved payment method shows zero charge attempts in Stripe; no `CampaignRefund` row is created (since nothing was charged) — confirm the in-app copy matches ("nothing to refund because nothing was taken").

**PR-3 — Community Buy supplier payout — full release path**
Role: Admin. Prerequisite: a succeeded campaign, supplier with a connected Stripe test account, market fee configured. Action: release the supplier payment. Expected: real Stripe Connect transfer created, correct fee deducted, ledger entries posted. Retry the release click after success — confirm it's a safe no-op (already PAID).

**PR-4 — Refund recheck idempotency**
Role: Admin. Action: click "Recheck" on the same pending/failed refund multiple times in a row. Expected: never creates more than one real Stripe refund (same idempotency key reused) — confirm via Stripe test dashboard, not just the app's own display.

**PR-5 — Regular Delivery payment retry (dunning)**
Role: Buyer/Admin. Prerequisite: a renewal with a failed payment attempt. Action: retry the payment (as buyer) multiple times in quick succession, including simulating a network timeout if possible. Expected: never double-charges; caps at 3 total attempts before cancellation.

**PR-6 — No "escrow" language reaches a real user (PAY-03)**
Role: Buyer, Vendor. Action: trigger a dispute (read the vendor notification body) and trigger the 4 documented checkout error conditions in `paystack.service.ts` if that provider is reachable in your test environment. Expected today: the literal word "escrow" appears in these surfaces — confirm and track for the copy fix.

---

## 8. Accessibility QA

**ACC-1 — VoiceOver/TalkBack full walkthrough of Community Buy (participant)**
Role: any, screen reader on. Action: complete a full pledge flow (discover → detail → quantity → review → payment) using only the screen reader. Expected (per UX-07, currently FAIL — these screens have zero accessibility attributes): elements likely announce generically or not at all. Document every unlabeled/confusing element found.

**ACC-2 — VoiceOver/TalkBack walkthrough of Automation Centre**
Role: Vendor, screen reader on. Action: navigate Automation Center → Detail → Activity. Expected (currently FAIL, 0% coverage): same as above.

**ACC-3 — Dynamic Type at largest accessibility size**
Role: any. Action: set the OS text size to its largest accessibility setting (not just largest "standard" size); navigate through Community Buy, Automation, and Regular Delivery screens plus 5 core screens. Expected: check for clipped/truncated text, especially in fixed-height rows, badges, and stat cards (1,230 fixed-pixel font sizes with no caps found in code review). Document every clipping instance.

**ACC-4 — Touch target verification**
Role: any. Action: attempt to tap small icon-only buttons (header back arrows, cart quantity steppers, message send/menu buttons) with imprecise/off-center taps. Expected: per UX-09 (sub-44pt targets, no hitSlop), some may require precise taps to register. Document any that feel unreliable.

**ACC-5 — Keyboard overlap on multi-field forms**
Role: any, small-screen device (e.g. iPhone SE or equivalent Android). Action: open the organiser campaign creation form, Regular Delivery offer creation form, and the vendor bundle/discount creation forms; tap into the lowest field on each. Expected: per UX-10 (no KeyboardAvoidingView), the keyboard may cover the active field with no auto-scroll. Document which fields are affected.

---

## 9. Market Gating QA

**MG-1 — Vendor registration rejects non-launch countries**
Role: prospective vendor. Action: attempt to register a vendor account with country set to Nigeria (or any non-launch country) via the app UI. Expected: registration is rejected client-side (country not in the picker) and, if bypassed via direct API testing, rejected server-side with a clear error. Pass: no vendor account can be created with a non-launch country.

**MG-2 — Community Buy / Regular Delivery feature flags take effect immediately**
Role: Admin, then Buyer/Vendor. Action: toggle `communityBuyEnabled` off for a market with a real logged-in test user in that market; without the user restarting the app, have them refresh Home. Expected: the feature disappears (may require a fresh load, not necessarily instant). Toggle back on and confirm it reappears.

**MG-3 — No African market ever appears in any picker**
Role: any. Action: check every country/market selector reachable in the app (vendor onboarding, market-add, delivery country, admin market config, admin vendor market assignment). Expected: exactly the 10 launch markets everywhere, never an African country.

**MG-4 — Currency correctness per market**
Role: Vendor. Action: create/check a vendor account in each of the 10 markets. Expected: GBP (UK), USD (US), CAD (Canada), EUR (France/Spain/Portugal/Belgium/Italy), CHF (Switzerland), EUR (Croatia). Pass: no market shows the wrong currency; Croatia specifically must show EUR, never HRK.

**MG-5 — Regular Delivery vendor entry point market gating (MKT-03)**
Covered in V-3 above — cross-referenced here for completeness of the market-gating pass.

---

## 10. Navigation / Deep Link QA

**NAV-QA-1 — Full push-notification-type sweep**
Role: any. Action: systematically trigger one notification of each real type in the system (order status × 4, message, payout × 4, verification × 2, first order, dispute, escrow delivery/auto-release, automation × 12, Community Buy × ~12, subscription/renewal × several) and tap each one. Expected: given this audit found ~15+ dead-tap instances across NAV-04 through NAV-10, expect multiple failures on a first pass — use this as the master checklist to confirm each one is fixed. Maintain a running pass/fail table per type.

**NAV-QA-2 — Bottom tab sanity**
Role: Buyer, Vendor. Action: confirm exactly 4 buyer tabs (Home/Messages/Cart/Wallet) and 5 vendor tabs (Dashboard/Orders/Foodstuff/Buyers/Earnings) — no new tabs from this engagement's work. Pass: matches `check-tab-registration.js`'s already-passing result; this is a sanity re-confirmation on-device.

**NAV-QA-3 — Cross-role transition cue (vendor → organiser)**
Role: Vendor with an organiser profile. Action: tap "Community Buy — Organize a campaign" from the vendor dashboard. Expected: a transition message confirming this is now the organiser role, separate from the vendor store. Pass: confirmed in code — verify visually.

**NAV-QA-4 — Entry point discoverability**
Role: new user (buyer and vendor). Action: without any hints, try to find Community Buy, Automation Centre, and Regular Deliveries from scratch. Pass: all three are reachable within 2 taps from Home/Dashboard/Profile without needing a deep link.

---

## 11. Regression QA — Core App Areas

**REG-QA-1 — Buyer Home screen under stress (REG-05, top priority)**
Role: Buyer. Action: test Home screen load in 4 conditions: (a) market with Community Buy disabled, (b) market enabled with live campaigns, (c) market enabled with zero campaigns, (d) simulate a slow/erroring Community Buy backend (e.g. via network throttling or a backend feature flag if available). Expected: Home loads correctly and at a reasonable speed in all 4 cases; condition (d) must not block or significantly delay the rest of Home's content from rendering.

**REG-QA-2 — Messages**
Role: Buyer, Vendor. Action: send/receive a message on an order thread. Expected: unaffected by this engagement's work.

**REG-QA-3 — Cart / Checkout**
Role: Buyer. Action: full checkout with a real (test-mode) card. Expected: unaffected; no Community Buy/Automation code path interferes.

**REG-QA-4 — Wallet**
Role: Buyer. Action: check wallet balance and transaction history. Expected: unaffected.

**REG-QA-5 — Login/Register**
Role: any. Action: register a new account, log out, log back in, reset password. Expected: unaffected.

**REG-QA-6 — Product / Order (buyer and vendor sides)**
Role: Buyer, Vendor. Action: browse a product, place an order, vendor accepts/ships/marks delivered. Expected: unaffected.

**REG-QA-7 — Account / Settings**
Role: any. Action: edit profile, change notification preferences, delete account (cancel out before actually deleting, unless using a disposable test account). Expected: unaffected; delete-account confirmation dialog still present (confirmed in code).

**REG-QA-8 — Dispute resolution test flake (REG-01)**
Role: QA/Engineering. Action: re-run `dispute-resolution.test.ts` in isolation several times. Expected: determine whether the timeout is genuine flakiness (passes in isolation) or a real intermittent regression (fails again) — do not ship without resolving which it is.

---

## Summary

This plan totals **~55 discrete manual QA items** across 11 sections. Priority order for a time-constrained QA pass: **Section 5 (Admin) items A-1 and A-2, Section 2 (Vendor) items V-1, V-5, V-6, V-8, and Section 6 (Push) item PK-3** cover the 4 P0 findings from the Gap Audit and should be run first. Section 9 (Navigation) NAV-QA-1 is the single most time-consuming but highest-value item — it is the master sweep for the systemic dead-tap bug class found across 7+ locations.
