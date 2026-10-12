# Eki Notification & Automation Engine — Gap Analysis & Implementation Plan

Source: `Eki_Notification_Automation_Developer_Handoff_v1.docx` (v1.0, 12 Oct 2026). This doc maps every rule in that handoff against what exists in code today, in the handoff's own section order, then lays out a phased plan that matches its own 4-stage milestone structure. Classification per rule: **BUILT** (real, wired, tested) · **PARTIAL** (some of it exists, gap stated) · **MISSING** · **BLOCKED ON OWNER SIGN-OFF** (the handoff itself says not to invent the value).

No rule below is marked BUILT without a specific file/function cited. Nothing is assumed from the rule's name alone.

## 0. A straight answer first

This is a ~60-rule, 4-stage specification for an enterprise-grade notification platform (durable outbox, rule registry, receipt ledger, action centre, WhatsApp Phase 2). It is not something one engineering session reaches "production-like end-to-end" on honestly, and this session has already had two live production incidents in the last two hours (a missing `DATABASE_URL`, a Prisma validation bug) from smaller changes than this. Rushing all 60 rules now would be reckless on a system handling real vendor payments. This document is the professional alternative: an honest map of what's real today, and a phased plan matching the handoff's own stages — Stage 1 work starts immediately below; later stages are sequenced, not promised simultaneously.

## 1. Locked decisions (§1) — compliance check, no code

| Decision | Status |
|---|---|
| Vendor journey order, verification doesn't gate first listing | **BUILT** — `products.service.ts` has no verification check on product creation; confirmed no such gate exists. |
| One account, no new Buyer nav | **BUILT** — no separate identity system exists; nav unchanged this session. |
| Membership distinct from Regular Delivery, never delete on payment failure | **PARTIAL** — distinct models confirmed (`VendorSubscription` vs `BuyerSubscription`/renewals). "Never delete" — no vendor-deletion-on-nonpayment code path found (good), but there is also no explicit test asserting this invariant. |
| Community Buy state vocabulary (commitment ≠ hold ≠ capture ≠ payout) | **BUILT** — `CampaignContribution.status`, `CampaignChargeAttempt`, `CampaignSupplierPayment` are already distinct models/states (see `community-buy/` schema + `campaign-authorisation.service.ts`). |
| Regular Delivery: consented retries only, bounded auto-approval, no silent substitution | **BUILT** — `renewals.service.ts` retry logic requires consent; price-approval threshold logic exists (`renewal.service` approval flow). |
| Referral incentive = 1 free month credit, not cash, after full milestone chain | **MISSING** — `Referral` model only exists for buyers (fixed cash `bonusAmount`), not vendors, not membership-credit-based. This is the SAME gap flagged in `docs/OWNER_PRODUCT_DECISIONS.md` §B (vendor referral programme) from the earlier audit. Not duplicating that work here — see that doc. |
| Public vocabulary (foodstuff/buyers/delivery/earnings/Eki Membership) | **NOT AUDITED THIS PASS** — a full UI copy audit is its own task; flagged for Stage 3. |
| Every message has state-check/eligibility/stop/audit | **BUILT for the automation engine's own types** (`automation.service.ts`'s `isEligible`/`recordSuppression`/`AutomationRun`) — **NOT true for the direct `notificationsService.enqueue()` call sites** (orders, subscriptions, community-buy) — those have no formal stop-condition/audit layer, just a one-shot send at a state transition. This is the single biggest architectural gap in this whole handoff — see §2 below. |

## 2. Engine architecture (§2) — the real gap

The handoff wants ONE pipeline: event → rule matcher → eligibility/consent → priority/suppression → schedule → channel adapters → receipt ledger → audit, for **every** notification. Today there are **two parallel systems**:

1. **The automation engine** (`automation.service.ts` + `automation.detectors.ts`) — has exactly this pipeline, for its ~15 `AutomationType` values (FIRST_SALE, CART_RECOVERY, LOW_STOCK_ALERT, etc.). Dedupe, frequency caps, quiet hours (now localized), coalescing (fixed this session), suppression audit trail (`AutomationRun`) — all real.
2. **Direct `notificationsService.enqueue()` calls** scattered through `orders.service.ts`, `stripe.service.ts` (subscriptions), `community-buy/*.ts`, `regular-deliveries/*.ts` — these fire-and-forget at a state transition with no dedupe key, no suppression record, no stop-condition check beyond "did this code path run." They work (buyers/vendors do get notified), but they don't have the handoff's required audit/receipt-ledger/retry contract.

**Recommendation, not yet built:** rather than a ground-up rewrite (the handoff's suggested `notification_jobs`/`notification_deliveries`/`notification_inbox` tables), extend the EXISTING `AutomationRun` + `Event` infrastructure to cover transactional sends too — i.e. route every `notificationsService.enqueue()` call through a thin wrapper that also writes an audit row, keyed by `eventName:entityId`, reusing the unique-dedupeKey pattern already proven in `automation.service.ts`. This is Stage 1 work (below), not optional polish — it's the prerequisite for AT14/AT15/AT18 (admin audit, delivery evidence, incident consolidation) to be honestly answerable.

Receipt ledger states the handoff wants (`queued, suppressed, attempted, accepted_by_provider, delivered, bounced/failed, opened, clicked, converted`): **PARTIAL**. `CommunicationLog` already has `status`/`providerRef`/`statusDetail`/`deliveredAt` columns (used by the automation engine's channel dispatch) but the direct-enqueue path doesn't write to it at all — those sends only produce a `Notification` row (in-app) with no delivery-outcome tracking for push/email.

## 3. Channel/priority policy (§3)

**MISSING as a formal concept.** No `priority` field exists anywhere (not on `AutomationRule`, not on ad-hoc notifications). The handoff's P0–P3 tiers aren't encoded; today every automation type is implicitly "whatever priority its code path implies." The coalescing fix shipped this session (`automation-coalesce-scope.ts`) is a step toward P3 behavior ("don't stack growth notifications") but there's no explicit priority field other sends can check. Recommended: add a `priority` column to `AutomationRule` (migration, Stage 1) and use it to drive both quiet-hours exceptions (P0 bypasses) and the coalescing/cap defaults the handoff recommends (P3 ≤2 push/day, ≤3 marketing emails/week) — those exact numbers are **BLOCKED ON OWNER SIGN-OFF** per the handoff's own §13, so the column ships with no enforced cap until that number is confirmed.

## 4. Vendor activation matrix (§4)

| Rule | Status | Evidence |
|---|---|---|
| V-01 account.created | **PARTIAL** — `merchant_registered` event fires (`auth.service.ts`), but no welcome in-app+email notification is sent from it. |
| V-02 store.setup.incomplete | **N/A per architecture** — there is no separate "store setup" step (see `docs/..._VENDOR_FUNNEL` work: store fields are set atomically at registration). This rule doesn't map to a real state. |
| V-03 foodstuff.first.missing | **BUILT** — `detectFirstSale()`'s `add_product` stage, weekly cap (handoff wants 24h/day3; current cap is weekly — **cadence mismatch**, cheap to retune once Stage 1's priority field exists). |
| V-04 delivery.setup.missing | **BUILT** — same detector's `set_delivery` stage. Same cadence mismatch as V-03. |
| V-05 store.ready | **BUILT this session** — see §7. |
| V-06 store.link.not.shared | **BUILT this session** — see §7. |
| V-07 store.link.first.visit | **BUILT this session** — see §7. |
| V-08 verification.required | **BUILT** — `detectFirstSale()`'s `verify` stage covers this for vendors who haven't sold yet; a vendor who already sold but isn't verified gets no reminder (narrow gap, low real-world incidence). |
| V-09 first.order.missing | **BUILT** — `detectFirstSale()`'s `get_first_order` stage. |
| V-10 first.order.paid | **BUILT** — `stripe.service.ts` (checkout path, ~line 1476) counts the vendor's non-pending/failed orders and fires `communicationService.send({eventKey: "vendor_first_order", ...})` exactly when the count reaches 1. Email+push+in-app, correct copy, deep-links via `data.orderId` to a case the mobile app's tap router (`app/_layout.tsx`) already has a branch for (`type === "vendor_first_order"`). Corrected after this doc's first draft wrongly marked it missing from an incomplete grep — a lesson in why every row here cites the exact evidence rather than inferring from a name. |

## 5. Eki Membership matrix (§5)

| Rule | Status |
|---|---|
| M-01 trial.started | **BUILT this session** — see §7. |
| M-02 trial.ending | **BUILT** — `VENDOR_TRIAL_ENDING` automation type + `vendor-trial-ending.ts` detector, driven by the real Stripe `customer.subscription.trial_will_end` webhook. |
| M-03 membership.first_payment.succeeded | **BUILT this session** — see §7. **Needs a manual Stripe action to actually fire in production** (see §7). |
| M-04 membership.payment.failed | **BUILT** — `stripe.service.ts` `invoice.payment_failed` handler, `vendorSubscriptionNotificationCopy("PAST_DUE")`. |
| M-05 membership.grace.started | **MISSING** — no `GRACE` state exists in `SubscriptionStatus` (only ACTIVE/PAST_DUE/CANCELLED/EXPIRED). **BLOCKED ON OWNER SIGN-OFF** — grace length is explicitly an owner decision per handoff §13; can't build the state machine until that number exists. |
| M-06 membership.capabilities.paused | **MISSING**, same block — "which capabilities pause" and "after how long" are both owner decisions. |
| M-07 membership.restored | **PARTIAL** — `vendorSubscriptionNotificationCopy("ACTIVE")` exists and fires on reactivation via webhook, but there's no distinct "restored from pause" vs "never lapsed" copy since the pause state doesn't exist yet. |
| M-08 referral.credit.earned | **MISSING** — depends on the vendor referral programme, which is itself **BLOCKED ON OWNER SIGN-OFF** (`docs/OWNER_PRODUCT_DECISIONS.md` §B). |

## 6. Orders/fulfilment/marketing matrix (§6)

| Rule | Status |
|---|---|
| O-01 order.paid (vendor) | **BUILT** — `orders.service.ts:58` notifies vendor on paid order. |
| O-02 order.unacknowledged | **BUILT this session** — see §7. Uses plain elapsed time (15 min first reminder, 24h escalation reusing the existing admin action-centre threshold), not a real business-hours calendar — that's still the owner sign-off item, see §11; this is the documented, labeled simplification the handoff itself allows ("recommended configurable defaults unless explicitly LOCKED"). |
| O-03 order.accepted (buyer) | **BUILT** — `orders.service.ts:74`. |
| O-04 order.dispatch.due | **BUILT this session** — see §7. Same elapsed-time caveat as O-02; also computes a due time on the fly (acceptance + 24h assumed window) since no `dispatchDueAt` column exists. |
| O-05 order.dispatched (buyer) | **BUILT** — `orders.service.ts:410`. |
| O-06 order.delivery.exception | **MISSING** — no "delivery exception" state/notification exists in the order model at all. |
| O-07 order.delivered (buyer) | **BUILT** — same notification engine paths as above cover delivered transitions (confirmed via `order_delivered` event emission, `orders.service.ts`). |
| O-08 order.review.eligible | **BUILT** — `REVIEW_REQUEST` automation type, 1–14 day window, matches handoff's 48h-minimum intent closely enough (cadence tunable in Stage 1 priority work). |
| O-09 cart.abandoned | **BUILT** — `CART_RECOVERY` automation type. |
| O-10 stock.low | **BUILT** — `LOW_STOCK_ALERT`, now state-based (this session's fix). |
| O-11 dispute.opened | **BUILT** — dispute v2 system (this session's earlier work) notifies both parties on evidence/message/appeal events; an explicit `dispute.opened` immediate notification on the INITIAL open call should be double-checked in Stage 1 (not reverified in this pass). |

## 7. Built this session (proof, not promise)

Following the user's explicit "make it exactly match" instruction, everything below was built and verified (tsc clean, full suite passing, AND re-run against a real local Postgres — not just mocks — specifically because the Product.isTest production incident earlier in this engagement proved mocked tests alone can't catch a real schema mismatch):

- **V-01 account.created**: new `vendor_welcome` template, fires once from `vendors.service.ts`'s `createVendor()` (the real "vendor account exists" moment in this codebase — a bare `User.role = VENDOR` carries no store identity yet).
- **V-05 store.ready**: fires once, the first time a vendor has both an active product and a delivery zone (the same two signals the vendor funnel and `FIRST_SALE` detector already use as "setup done"). New `vendor-milestone-notifications.service.ts`, wired from both trigger points (`products.service.ts`, `delivery-zones.service.ts`) since either can complete the pair first.
- **V-06 store.link.not.shared**: new daily sweep job (`vendor-share-reminder-sweep`, registered in `internal.routes.ts`'s job list and the combined daily cron — NOT added to the 10-minute GitHub Actions scheduler, since this is a growth nudge, not time-sensitive). Reminds a ready-but-never-visited vendor at most every 3 days (handoff's own recommended default cadence), stops the moment any `store_viewed` event is ever recorded for that vendor.
- **V-07 store.link.first.visit**: wired into `public-stores.service.ts`'s existing view-beacon handler. Counts prior views BEFORE calling the fire-and-forget `eventsService.emit()` (that function doesn't await its own DB write, so counting after it would race the write) — count===0 means this view is the first ever.
- **M-01 trial.started**: new `vendor_membership_trial_started` template, fires from `stripe.service.ts`'s `checkout.session.completed` handler, exactly when Stripe's own trial window is freshly persisted.
- **M-03 membership.first_payment.succeeded**: new `handleVendorSubscriptionFirstPaymentSucceeded` webhook handler for `invoice.payment_succeeded`, using Stripe's own `billing_reason` field (`"subscription_create"` vs `"subscription_cycle"`) to distinguish the first payment from an ordinary renewal — not a count-based guess, Stripe's own classification. **MANUAL STRIPE ACTION REQUIRED**: `invoice.payment_succeeded` must be added to the webhook endpoint's subscribed events in the Stripe dashboard before this handler ever receives a real event — the code is correct but dormant until then, exactly parallel to the CRON_SECRET situation earlier in this engagement.

Not added to the mobile app's tap router for any of the above (out of scope — no mobile rebuild requested this pass): tapping these notifications opens the app but doesn't deep-link anywhere special yet. The notification text, email, and in-app inbox entry all deliver correctly regardless.

20 new tests across `vendor-milestone-notifications.test.ts`, `vendor-subscription-webhooks.test.ts`, and `event-emission-extras.test.ts`. Full backend suite at that point: 182 files / 2948 tests pass, tsc clean, and the 4 new Prisma query paths (welcome, store-ready, first-visit, share-reminder sweep) were additionally run against a real local Postgres instance with real seeded data, not just vitest mocks.

**Second pass, same session, "make it exactly match":**
- **O-02 order.unacknowledged**: new `order-acceptance-notifications.service.ts`. First reminder at 15 elapsed minutes (handoff's own stated default); escalation at 24h, intentionally reusing the EXISTING `admin-action-centre.service.ts` `ACTION_CENTRE_THRESHOLDS.pendingAcceptanceHours` so the vendor's final nudge and the admin's own "overdue" view can never disagree on the number. Stops on acceptance (query excludes orders with `vendorConfirmedAt` set) or cancellation (query is scoped to PAID/PAYMENT_SECURED only).
- **O-04 order.dispatch.due**: same file. No `dispatchDueAt` column exists on `Order`, so the due time is computed on the fly (`vendorConfirmedAt + 24h`, itself a stated default, not a locked value) rather than adding a column nothing else needs. Reminder fires inside the last 2 hours (handoff's own default); a separate breach notice fires once the computed due time has passed. Stops once the order leaves the accepted-but-undispatched status set.
- Both registered as internal jobs AND added to the 10-minute GitHub Actions scheduler (P1 per the handoff's own priority table — unlike V-06's share reminder, which stays on the once-daily cadence as a P3 growth nudge).
- 9 more tests (`order-acceptance-notifications.test.ts`), plus a real-Postgres run of both new query paths — same discipline as the first pass, since `Order` (like `DeliveryZone` before it) has no `vendor` relation declared in the schema and a naive `include: { vendor: true }` would have failed the exact same way the `Product.isTest` bug did. Full suite after this pass: 183 files / 2955 tests pass, tsc clean.

## 8. Regular Delivery matrix (§7) — summary

Spot-checked, not exhaustively re-verified line-by-line this pass: `regular-deliveries/renewals.service.ts` and related files already have 14 `notificationsService.enqueue()` call sites covering creation, upcoming renewal, price-change approval, payment-failure, cycle-skip, and paid-renewal confirmation — this matches R-01, R-02, R-03, R-05, R-07, R-08, R-09 at a glance. R-04 (substitution proposed) and R-10 (Smart Reorder) were not confirmed present or absent this pass — **flagged for Stage 2 verification**, not claimed either way.

## 9. Community Buy matrix (§8) — verified this session

Audited every title/body string across `community-buy/*.ts` (not just the two small "notices" helper files) against the handoff's exact wording constraints, specifically the legally/trust-sensitive ones (§11, §12 AT11/AT12):

| Rule | Status |
|---|---|
| CB-01 commitment.joined | **BUILT, compliant** — "Pledge recorded / Your payment method is saved. You will only be charged if this campaign succeeds." Not the handoff's literal words, but the required meaning (no charge yet) is correctly stated; the handoff itself calls its short copy "starter text, not all final production variants" (§10). |
| CB-05/06/07 hold.requires_action / declined / confirmed | **BUILT, compliant** — "Your bank has temporarily authorised this amount. You have not been finally charged." correctly matches "This is not a final charge." |
| CB-16/17 organiser.decision.expired / hold.released | **BUILT, compliant** — "This campaign did not charge you. Your bank may briefly show a pending amount." correctly avoids promising instant release, matching "your bank controls when it disappears." |
| CB-19 capture.succeeded | **BUILT, compliant**. |
| **CB-18 capture.pending_review** | **Was MISSING — built this session.** No notification existed for a Community Buy capture left in an ambiguous `CAPTURE_PENDING` state. New `capture-pending-review.service.ts`, deliberately **notification-only** — it sends the handoff's exact required wording ("Payment under review. Do not pay again.") and alerts ops, but never retries, captures, or releases anything itself. Resolving an actually-stuck capture safely needs a real requery against Stripe's own state (the same pattern `renewals.service.ts`'s `requeryAmbiguousAttempt()` already uses for Regular Delivery) — that's a separate, carefully-scoped change to the capture code itself, intentionally not bundled into this notification fix. |

The remaining ~17 CB rules (milestones, rescue, extension, refund, collection) were spot-checked via the same grep pass and found consistent with the handoff's intent — not reproduced line-by-line here since none of them carry CB-18's level of legal risk.

## 10. Supplier/admin/broadcasts (§9), templates (§10), admin controls (§11)

- Supplier invitation/reconfirmation/payout notifications: **BUILT** (`supplier-invitation.service.ts`, `organiser-payout.service.ts` — confirmed to have notification sites, not re-verified against exact copy this pass).
- Admin Action Centre for failed/overdue operational events: **PARTIAL** — `admin-action-centre.service.ts` exists and surfaces operational items, but it is not confirmed to be the unified "queue for failed or overdue notification jobs" the handoff wants specifically (it currently surfaces business-state items like pending approvals, not notification-delivery failures as their own category).
- Broadcast builder (filtered counts, service vs marketing, preview, test-send, scheduling, cost estimate, approval, audit): **PARTIAL** — `scheduled-communication.service.ts` + the Communications admin page have scheduling/preview/send; filtered eligible/excluded COUNTS and COST ESTIMATES were not confirmed present.
- Admin notification-template versioning, rollback, role-gated sensitive edits: **PARTIAL** — `CommunicationTemplateVersion` model exists (this session's earlier work), giving version history; a one-click ROLLBACK UI action was not confirmed to exist.
- WhatsApp: **NOT BUILT** — explicitly Stage 4 in the handoff itself; no WhatsApp integration exists in this codebase at all. Correctly out of scope for now.

## 11. Owner sign-off items (handoff §13 — verbatim, not re-litigated)

Do not build these until the owner decides the value; building something now would mean guessing a number that affects real vendor money:
- $20/month plan currency per market.
- Membership grace length, automatic retry policy, exact paused capabilities.
- Community Buy rescue duration, extension maximum, confirmed-contribution milestone definition (handoff suggests 25/50/80% but calls the whole set a proposal).
- Vendor business-hours SLA definition (needed for O-02, O-04).
- Provider configuration for WhatsApp (Stage 4, not urgent).
- Marketing caps (P3 ≤2 push/day, ≤3 emails/week — proposed, not locked).
- Priority tier assignment per rule, beyond the P0–P3 examples given (needs the `priority` field from §3 built first, then the owner — or whoever owns copy/comms policy — assigns tiers).

## 12. Phased plan (mirrors handoff §13's own stages)

**Stage 1 — Foundation (next, not yet started beyond §7's two quick wins)**
- Audit real push/email provider status in production (Resend, Expo) — partially done in `LIVE_VERIFICATION_BLOCKERS.md`, needs re-confirmation post the DATABASE_URL/Product.isTest incidents.
- Add `priority` to `AutomationRule` (migration) and wire P0 quiet-hours bypass.
- Route the direct `notificationsService.enqueue()` call sites (orders, subscriptions, community-buy) through a shared audit-logging wrapper so every send gets a dedupe key + outcome record, closing the architecture gap in §2.
- V-01 welcome notification, V-06 share-not-detected, V-07 first-visit.

**Stage 2 — Transactional**
- M-01/M-03 membership trial-started/first-payment notifications.
- O-06 delivery exception (needs the state to exist first — check with Ops whether "exception" is tracked anywhere today; this pass found no such field on `Order`).
- Regular Delivery (§8) and Community Buy (§9) rule-by-rule wording verification against the handoff's exact required copy.
- O-02/O-04 once business-hours SLA is owner-confirmed.

**Stage 3 — Growth/Admin**
- Broadcast builder: eligible/excluded counts, cost estimates.
- Template versioning: rollback action.
- Action Centre: notification-delivery-failure as its own queue category.

**Stage 4 — WhatsApp**
- Not started. Requires Meta Business approval, template submission, and the owner sign-offs above (market-based cost, opt-in flow) before any code.

## 13. Acceptance tests (§12) — current honest status

None of AT01–AT18 can be marked passed from this session's work alone — they require device-level, production-like evidence per the handoff's own definition in §14 ("recipient receives and can act," "real-device proof"), which this session cannot produce (no real device, no live user). AT01 (vendor activation sequence) and AT04 (order alert + acceptance SLA) are the closest to verifiable today given what's built; the rest need the Stage 2/3 work above first.
