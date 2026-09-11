# Final Client Requirements Status — Complete Matrix

**Purpose:** Requirement-by-requirement status for every item audited in the Final Gap Audit (2026-09-09), across Automation, Regular Delivery, Community Buy (Participant/Organiser/Supplier/Admin), Notifications, Payments/Refunds/Ledger, Market Gating, UX/Accessibility, Navigation, and Regression.

**Method note:** Every item below was verified against the CURRENT code in both repos (`ekiapp-backend-main`, `ekiapp-frontnend-application-ios-android-main`), not assumed from `CLIENT_REQUIREMENTS_MATRIX.md` / `CLIENT_TO_SCREEN_TRACEABILITY.md` / `UX_REDESIGN_AUDIT.md` / `UX_REDESIGN_PLAN.md`, which this audit found to be **stale in both directions** (some items they call MISSING are built; a few things assumed complete had new bugs). Where a doc claim disagreed with code, code wins and the discrepancy is noted.

A **PASS** means the implementation genuinely delivers the intended behavior, not merely that code exists.

Legend — **QA:** CV = Code-Verifiable (confirmed by reading code/running tests), DO = Device-Only (requires a real device/manual QA to fully confirm).

---

## A. Automation

### AUTO-01 — Automation type coverage vs. 12 client-named automations
**Status:** PARTIAL | **Role:** Vendor, Buyer | **QA:** CV
**Requirement:** All client-named automation types exist as distinct, manageable types.
**Source:** CLIENT_REQUIREMENTS_MATRIX.md REQ-AUTO-002
**Current state:** 12 real `AutomationType` enum values exist and fire for real (`prisma/schema.prisma:1726-1739`). "Reorder Reminders" and a combined "Review Referral Offer" don't exist; "Checkout Payment Follow-Up" and "Regular Delivery Payment Recovery" are merged into one `PAYMENT_RECOVERY` type.
**Impact:** UX: vendor can't manage the two merged automations independently. Backend: new type = real schema/detector work. Frontend: new label/category entries needed.
**Next action:** BLOCKED-CLIENT-DECISION — confirm whether the 2 missing/merged automations are actually wanted before building.

### AUTO-02 — Vendor-controlled vs. Eki-managed distinction
**Status:** PARTIAL | **Role:** Vendor | **QA:** CV
**Requirement:** Real, enforced distinction between vendor-toggleable and always-on automations.
**Source:** code-only finding
**Current state:** Real and enforced (`services/automationService.ts:96-106`), but the code comment justifying it is factually wrong for `RENEWAL_REMINDER` (its trigger DOES pass `vendorId`, so the toggle IS still enforced server-side even though the UI hides it) — `renewals.service.ts:116-126` vs `automation.service.ts:135-142`.
**Impact:** UX: correct outcome, wrong stated reason. Backend: risk of future regression if someone "fixes" the comment's premise. Frontend: none.
**Next action:** Fix the comment; decide if `RENEWAL_REMINDER`'s vendor-toggle enforcement should be removed to match its "managed" presentation (see AUTO-18).

### AUTO-03 — Automation detail screens
**Status:** PASS | **Role:** Vendor | **QA:** CV
**Requirement:** Real per-type detail screens.
**Source:** CLIENT_TO_SCREEN_TRACEABILITY.md
**Current state:** Single dynamic screen (`app/(vendor)/automation-detail.tsx`) driven by a `type` param, handles invalid types gracefully.
**Next action:** None.

### AUTO-04 — Automation settings granularity
**Status:** PARTIAL | **Role:** Vendor | **QA:** CV
**Requirement:** Vendor can configure real thresholds.
**Source:** CLIENT_REQUIREMENTS_MATRIX.md REQ-AUTO-001
**Current state:** Backend accepts any numeric value ≥1 (`automation.controller.ts:37-49`); frontend restricts to 3 hardcoded chip presets per type (`automation-detail.tsx:41-44`) — pure frontend limitation.
**Impact:** UX: vendor can't pick the system default (2h) for Cart Recovery. Frontend: replace chips with free numeric input.
**Next action:** Replace hardcoded presets with a numeric field.

### AUTO-05 — Eligibility explanation
**Status:** MISSING | **Role:** Vendor | **QA:** CV
**Requirement:** UI explains what makes a buyer eligible.
**Source:** CLIENT_REQUIREMENTS_MATRIX.md REQ-AUTO-003
**Current state:** Only a one-sentence purpose blurb exists (`services/automationService.ts:114-124`); real mechanism/thresholds (e.g. `LOW_STOCK_THRESHOLD = 5` at `automation.detectors.ts:176`) are never surfaced.
**Impact:** UX: vendor can't predict when an automation fires. Frontend: needs a new "How this decides" section per type.
**Next action:** Build eligibility-explanation UI per UX_REDESIGN_PLAN.md §3.

### AUTO-06 — Activity/history: real data, recipient visibility, and a `vendorId` gap
**Status:** PARTIAL (recipient display PASS; visibility for 2 types FAIL) | **Role:** Vendor | **QA:** CV
**Requirement:** Real `AutomationRun` history with buyer identity shown.
**Source:** CLIENT_REQUIREMENTS_MATRIX.md REQ-AUTO-004
**Current state:** Recipient display now works (fixed post-doc). But `PAYMENT_RECOVERY` and `PRICE_APPROVAL_REMINDER` never pass `vendorId` to `scheduleAutomation()` (`automation.detectors.ts:252-260`, `renewals.service.ts:276-283,651-658`), so `listVendorActivity(vendorId)` can never show these runs to any vendor — they're real and sending, but permanently invisible in Activity.
**Impact:** Backend: real fix needed — thread `vendorId` through 3 call sites. UX: vendor can never verify 2 of 9 automations are working.
**Next action:** Pass `vendorId` at the 3 missing call sites. **P1.**

### AUTO-07 — Recipient/buyer targeting logic
**Status:** PASS | **Role:** Buyer, Vendor | **QA:** CV
**Requirement:** Real per-type targeting logic, not invented.
**Source:** code-only finding
**Current state:** All 7 detectors (`automation.detectors.ts:17-263`) use real Prisma queries against real business tables.
**Next action:** None.

### AUTO-08 — Suppressed state/reason surfaced
**Status:** PASS | **Role:** Vendor, Admin | **QA:** CV
**Requirement:** Vendor can see when/why an automation was suppressed.
**Source:** CLIENT_REQUIREMENTS_MATRIX.md REQ-AUTO-006
**Current state:** Fixed since docs were written — distinct "Not sent" pill + real `suppressedReason` text now render on both vendor activity screens and the admin summary page.
**Next action:** None (except AUTO-06's visibility gap still applies to 2 of 9 types).

### AUTO-09 — Pause/resume controls
**Status:** PARTIAL | **Role:** Vendor | **QA:** CV
**Requirement:** Real, backend-backed pause distinct from accidental deactivation.
**Source:** CLIENT_REQUIREMENTS_MATRIX.md REQ-AUTO-003
**Current state:** Real persisted toggle; confirmation dialog now added on the detail screen, but the center-screen inline `Switch` still toggles off with no confirmation — inconsistent.
**Next action:** Align confirmation behavior between the two surfaces.

### AUTO-10 — "No eligible buyers" empty state
**Status:** MISSING | **Role:** Vendor | **QA:** CV
**Requirement:** Honest "0 eligible right now" forward-looking state.
**Source:** CLIENT_REQUIREMENTS_MATRIX.md
**Current state:** Only history-emptiness states exist ("No activity yet"); no live "eligible count" endpoint exists at all.
**Next action:** BLOCKED-CLIENT-DECISION — scope a new "eligible now" endpoint, or confirm current activity-empty-state is acceptable.

### AUTO-11 — Error states
**Status:** PARTIAL | **Role:** Vendor | **QA:** CV
**Requirement:** Automation-specific error messaging on failure.
**Source:** CLIENT_REQUIREMENTS_MATRIX.md
**Current state:** Center/Activity screens use a fully generic `ErrorState` ("We hit a snag"); Detail screen has a slightly better, still generic-body title. Send-failure reasons (`failureReason`) are well-handled and specific.
**Next action:** P2 copy polish only.

### AUTO-12 — Unsaved-changes protection
**Status:** BLOCKED-CLIENT-DECISION (N/A today) | **Role:** Vendor | **QA:** CV
**Requirement:** Warn before losing unsaved settings.
**Source:** CLIENT_REQUIREMENTS_MATRIX.md
**Current state:** All settings are instant-apply (no draft state to lose) — not applicable unless AUTO-04's fix introduces a staged Save.
**Next action:** Revisit only if AUTO-04 changes the interaction model.

### AUTO-13 — Completed automation history: real vs. mocked
**Status:** PASS (with AUTO-06 caveat) | **Role:** Vendor | **QA:** CV
**Requirement:** Real `AutomationRun` data, no fabrication.
**Source:** CLIENT_REQUIREMENTS_MATRIX.md
**Current state:** Every field traces to a real column/join; zero mock data.
**Next action:** None beyond AUTO-06.

### AUTO-14 — "Sales influenced" terminology
**Status:** PASS (no overclaiming) | **Role:** Vendor | **QA:** CV
**Requirement:** No fabricated attribution numbers.
**Source:** CLIENT_REQUIREMENTS_MATRIX.md
**Current state:** "Influenced" appears once, as a definitional tooltip only — no headline metric exists (real or fake) to overclaim with.
**Next action:** Optional enhancement only, needs a real aggregate query if ever built.

### AUTO-15 — Notification permission handling
**Status:** PASS | **Role:** Vendor | **QA:** CV (flow) / DO (actual OS prompt)
**Requirement:** Flow checks/requests push permission.
**Source:** implied, CLIENT_REQUIREMENTS_MATRIX.md
**Current state:** Real Expo permission API, 4 correctly differentiated states, proactive banner on Automation Center.
**Next action:** Confirm on-device during QA.

### AUTO-16 — Actual backend execution (cron/quiet-hours collision) — **CRITICAL, new finding**
**Status:** FAIL | **Role:** Vendor, Buyer (every automation recipient) | **QA:** CV
**Requirement:** A real scheduler must actually fire automations in production.
**Source:** code-only finding — not in any of the 4 client docs
**Current state:** Real Vercel Cron exists (`vercel.json`, `0 3 * * *`) and correctly wires every detector. But `automationService.scheduleAutomation()`'s quiet-hours guard (`QUIET_HOUR_START_UTC=22, QUIET_HOUR_END_UTC=7`) unconditionally suppresses **every** automation attempt reached via this cron, because 3am UTC always falls inside the 22:00–07:00 quiet window. Since this cron is the only scheduled trigger in the system, **the entire Automation Engine has never sent a single message via its scheduled path, and never will until this is fixed.** No error signal is produced — the suppression is a silent early return before any `AutomationRun` row is created.
**Impact:** Every "Active" toggle a vendor sees is currently non-functional in practice.
**Next action:** **Fix immediately** — move the cron outside 22:00–07:00 UTC, or exempt cron-triggered (batch) sends from the quiet-hours guard that's meant for real-time triggers. **P0.**

### AUTO-17 — Config granularity vs. execution cadence mismatch
**Status:** PARTIAL | **Role:** Vendor, Buyer | **QA:** CV
**Requirement:** Configured hour-level thresholds should reflect real precision.
**Source:** code-only finding
**Current state:** "Remind after 1h" UI implies real-time precision; the only evaluation is the once-daily cron, so real latency is up to ~24-28h.
**Next action:** Fix alongside AUTO-16; consider more frequent cron cadence, or honest copy.

### AUTO-18 — Stale disabled `RENEWAL_REMINDER` becomes unrecoverable via UI
**Status:** PARTIAL / edge-case FAIL | **Role:** Vendor | **QA:** CV
**Requirement:** No stuck, invisible disabled state.
**Source:** code-only finding
**Current state:** A vendor who disabled `RENEWAL_REMINDER` before it became "Managed by Eki" (or did so via API) has no UI path left to see or reverse it; backend still honors `enabled:false` forever.
**Next action:** Decide: either make this type always-on server-side, or add an admin recovery path.

### AUTO-19 — PAYMENT_RECOVERY vs. Regular Delivery dunning: correctly separated systems
**Status:** PASS | **Role:** Vendor, Buyer | **QA:** CV
**Requirement:** Clarify whether the retry engine and the notification are wrongly conflated.
**Source:** sub-question C
**Current state:** Genuinely two separate, correctly-designed systems — real Stripe retry/dunning (`renewals.service.ts`, idempotent, 3-attempt cap) vs. a pure notification (`PAYMENT_RECOVERY` automation) layered on top. The real, valid finding is one level up: the automation *type* is shared between two client-named automations (see AUTO-01), not that dunning and notification are confused.
**Next action:** None — no conflation to fix; see AUTO-01 for the actual related gap.

---

## B. Regular Delivery / Subscription

### RD-08 (P0 Check 1) — Admin Regular Delivery remediation
**Status:** FAIL / BLOCKED-CLIENT-DECISION | **Role:** Admin | **QA:** CV
**Requirement:** Admin should be able to act on stuck renewals (retry payment, approve/deny price change, force-cancel, contact buyer).
**Source:** CLIENT_REQUIREMENTS_MATRIX.md REQ-CB-A-007 (inferred from admin-parity precedent, not a literal client ask)
**Current state:** `admin-web/src/app/subscription-exceptions/page.tsx` is still 100% read-only — confirmed, zero buttons/handlers. Backend has exactly one route (`GET /admin/subscription-exceptions`). No admin-scoped service methods exist at all (only buyer-ownership-scoped `retryPayment`/`buyerDecidePriceChange`/`pause`/`resume`/`cancel`).
**Impact:** Admin cannot act on a real stuck payment/price-change/subscription today.
**Next action:** "Retry payment" is safe to build without further scoping (`attemptPayment()` is already idempotent — `renewals.service.ts:339-524`, an admin call is just a third caller of the same idempotent path). "Approve/deny price change on buyer's behalf," "force-cancel," and "contact buyer" need explicit client scoping (acting on a buyer's behalf, notice requirements). **Do not implement without this audit's report first — was explicitly out of scope for this pass.**

### RD-09 (P0 Check 2) — Vendor Regular Delivery raw statuses
**Status:** FAIL | **Role:** Vendor | **QA:** CV
**Requirement:** No raw enum strings shown to vendor.
**Source:** code-only finding (not in any of the 4 docs)
**Current state:** `app/(vendor)/regular-deliveries.tsx:196` and `regular-delivery-subscriber-detail.tsx:72` both render `s.status.replace("_", " ")` for `BuyerSubscriptionStatus` instead of using the existing `BUYER_SUBSCRIPTION_STATUS_LABELS` map (which IS correctly used for `Renewal.status` two lines away in the same files).
**Next action:** Import and use the existing label map at both sites — trivial fix.

### RD-04 (P0 Check 3) — Pre-subscribe fulfilment/substitution information
**Status:** PARTIAL | **Role:** Buyer | **QA:** CV
**Requirement:** Buyer sees fulfilment method + substitution policy before subscribing.
**Source:** CLIENT_REQUIREMENTS_MATRIX.md REQ-RD-004/006; modeled as required, non-nullable Prisma fields
**Current state:** Post-subscribe screen (`regular-delivery-detail.tsx:231-248`) now shows both — fixed since docs. Pre-subscribe screen (`regular-delivery-offer.tsx`) still never renders either, despite the data already being in the loaded `offer` object.
**Next action:** Add a fulfilment/substitution info block to the pre-subscribe screen, reusing the existing label maps — no backend change.

### RD-01 (P0 Check 4) — Vendor offer creation flow: wizard vs. single form
**Status:** PARTIAL | **Role:** Vendor | **QA:** CV
**Requirement:** Clarify whether a multi-step wizard was ever required.
**Source:** CLIENT_REQUIREMENTS_MATRIX.md REQ-RD-001; UX_REDESIGN_PLAN.md:263 explicitly states a wizard was "not requested."
**Current state:** Single scrolling form; combined "Create and publish" primary action now exists (fixed since docs). Product/foodstuff selection is still last, not first as the client's own ordering describes; no review-summary step exists.
**Next action:** Reorder to foodstuff-first; add a review block. A wizard itself is NOT required — current single-form shape is acceptable.

### RD-02 — EVERY_4_WEEKS frequency + date math
**Status:** PASS (4 distinct options, EVERY_4_WEEKS≠MONTHLY) / PARTIAL (MONTHLY isn't true calendar-month math) | **Role:** Buyer, Vendor | **QA:** CV
**Requirement:** 4 real cadences, EVERY_4_WEEKS as a fixed 28-day cycle distinct from Monthly.
**Source:** CLIENT_REQUIREMENTS_MATRIX.md REQ-RD-002 (doc is STALE — claims only 3 values exist)
**Current state:** `SubscriptionFrequency` already has 4 values, wired end-to-end. `FREQUENCY_DAYS = {WEEKLY:7, BIWEEKLY:14, EVERY_4_WEEKS:28, MONTHLY:30}` — EVERY_4_WEEKS is correctly 28 days, distinct from MONTHLY's 30. But MONTHLY is a flat 30-day approximation, not real calendar-month arithmetic (28-31 days) as the client's original framing implied. Zero test coverage for this date math.
**Next action:** Confirm with client whether MONTHLY needs true calendar-month semantics; add a regression test either way.

### RD-03 — Vendor-configurable offer fields (9 required)
**Status:** PASS | **Role:** Vendor | **QA:** CV
**Requirement:** Product, frequency, pricing, discount, max-price-increase, fulfilment, prep time, renewal cutoff, substitution all configurable.
**Source:** CLIENT_REQUIREMENTS_MATRIX.md REQ-RD-003
**Next action:** None.

### RD-05 — Buyer control: pause (with resume-date)/skip/edit/cancel
**Status:** PARTIAL | **Role:** Buyer | **QA:** CV
**Requirement:** Full self-service control including resume-on-date and frequency edit.
**Source:** CLIENT_REQUIREMENTS_MATRIX.md REQ-RD-005
**Current state:** Pause/Skip/Resume/Cancel all present and working; backend `pauseSubscription()` already accepts a `resumeAt` date but the UI's Pause button never collects one. Additionally: no way to change subscription **frequency** post-subscribe at all (only items/quantity) — buyer must cancel and resubscribe.
**Next action:** Add a resume-date picker to Pause. Confirm with client whether frequency-editing is required or cancel-and-resubscribe is acceptable.

### RD-06 — Buyer visibility: renewal/payment/price/stock/fulfilment
**Status:** PASS | **Role:** Buyer | **QA:** CV
**Requirement:** All 7 visibility items on the detail screen.
**Source:** CLIENT_REQUIREMENTS_MATRIX.md REQ-RD-006 (doc is STALE — describes a mostly-fixed state)
**Current state:** All 6 of 7 items now correctly shown with proper labels (upcoming renewal, payment status, price approval, stock-wait card, failed-payment retry, fulfilment details) — the 7th (substitution pre-subscribe) is tracked under RD-04.
**Next action:** None for this screen.

### RD-07 — Vendor pause-scope clarity ("never make user feel locked in")
**Status:** PARTIAL | **Role:** Vendor | **QA:** CV
**Requirement:** Vendor-side pause action should be scope-explicit and confirmed.
**Source:** CLIENT_REQUIREMENTS_MATRIX.md REQ-RD-007
**Current state:** Buyer side is fine. Vendor's offer-level "Pause"/"Resume" fires immediately with no confirmation and a non-scope-explicit label — unchanged from docs.
**Next action:** Relabel + add confirm dialog, mirroring the pattern already used for product-level pause in the same file.

### RD-10 — Product-level pause: reason + expected-return date capture
**Status:** FAIL | **Role:** Vendor | **QA:** CV
**Requirement:** Vendor can pause a product within an offer with reason + expected-return date (backend/display both support this).
**Source:** code-only finding (referenced in UX_REDESIGN_PLAN.md as a known gap)
**Current state:** Backend fully supports both fields and buyer-side display already renders them; vendor-facing trigger UI collects neither, and the frontend service method doesn't even have a parameter for `expectedReturnAt`.
**Next action:** Add reason text field + date picker; extend `pauseOfferProduct()` service method.

### RD-11 — Admin market-flag confirmation (informational, doc-stale)
**Status:** PASS | **Role:** Admin | **QA:** CV
**Note:** Docs claim no confirmation on the admin Regular Deliveries market toggle — now fixed (`confirm()` present). Flagged only to prevent a future pass "fixing" an already-fixed item.

---

## C. Community Buy — Participant

### REQ-CB-P-001 — Home discovery entry point
**Status:** PASS | **Role:** Participant | **QA:** DO (visual states)
**Current state:** Real, market-gated Home section exists (`app/(buyer)/index.tsx:130-158,530-567`), fails closed to hidden on error. Doc was stale (claimed FAIL).
**Next action:** None. See CBP-09 below for a related secondary-entry-point gap.

### CBP-09 — Secondary entry points (Profile menu, full discovery screen) are NOT market-gated
**Status:** PARTIAL | **Role:** Participant | **QA:** CV
**Current state:** Profile → Community Buy row is unconditional; the full discovery screen shows live campaigns from **every** enabled market regardless of the buyer's own market, and pledge-gating is keyed to the campaign's country, not the participant's. Could be intentional (diaspora support) — needs a product decision.
**Next action:** BLOCKED-CLIENT-DECISION — confirm whether cross-market browsing/pledging is intended.

### REQ-CB-P-002 — "How it works" explainer
**Status:** PASS | **Role:** Participant | **QA:** DO
**Current state:** Real screen exists, content accurately reflects minimum-not-goal success rule and no-upfront-charge model. Doc was stale (claimed MISSING).
**Next action:** None.

### REQ-CB-P-003 — Financial disclosure timing
**Status:** PARTIAL | **Role:** Participant | **QA:** CV
**Current state:** Disclosure now shown on the Quantity screen (2 screens before payment) and repeated on Review/Payment — much earlier than the docs described. Still absent from the very first Campaign Detail screen where a buyer forms their initial impression.
**Next action:** Low priority — optionally hoist the same copy onto the detail screen.

### REQ-CB-P-004 — Minimum/Goal/Maximum distinction, never implying "goal not reached = failed"
**Status:** PASS | **Role:** Participant | **QA:** CV
**Current state:** `RangeProgressBar` correctly ticks min/goal, outcome copy correctly branches on real `fundingOutcome`; zero UI text anywhere implies the forbidden rule (repo-wide grep confirmed).
**Next action:** P2 cosmetic only — "Target £X" money figure on discovery cards isn't linked to the shares-based progress bar.

### REQ-CB-P-005 — FAILED-campaign refund copy contradiction
**Status:** PASS | **Role:** Participant, Organiser | **QA:** CV
**Current state:** Fully resolved — participant and organiser copy now identical, and the underlying mechanism (`campaign-contributions.service.ts:18-52`) genuinely guarantees the claim is true (zero PAID contributions possible pre-success under PLEDGE_THEN_CHARGE). This was the docs' own P0 blocker.
**Next action:** None — close this item.

### REQ-CB-P-006 — Progressive milestones (25/50/75%)
**Status:** MISSING | **Role:** Participant | **QA:** CV
**Current state:** No such badges exist; only a min/goal tick + color-switch progress bar, and a single success-only `CAMPAIGN_MILESTONE` push.
**Next action:** BLOCKED-CLIENT-DECISION — needs exact threshold scoping before building. P2.

### REQ-CB-P-007 — Rescue-window countdown visibility
**Status:** PARTIAL | **Role:** Participant | **QA:** CV
**Current state:** Shown correctly on the participant's dashboard list (`my-community-buys.tsx:113-116`), but the campaign **detail** screen — where the rescue explanation actually lives — never references the date.
**Next action:** One-line fix: add the date to the existing rescue banner on the detail screen.

### REQ-CB-P-008 (Check 5) — Participant fulfilment tracker
**Status:** PARTIAL | **Role:** Participant | **QA:** CV
**Requirement:** Participant can see real fulfilment progress after success.
**Source:** CLIENT_REQUIREMENTS_MATRIX.md §3.1
**Current state:** Backend and endpoint are fully real (`campaignFulfilmentService.getForParticipant()`), fetched by the participant screen — but only `fulfilment.method` is ever read; `fulfilment.status` (the actual step) is never rendered. A static "updates will be shared" sentence substitutes for real progress. Pure frontend gap — zero backend work needed; the label map (`FULFILMENT_STATUS_LABELS`) already exists and is unused here.
**Next action:** Render `FULFILMENT_STATUS_LABELS[fulfilment.status]` on the participant screen. **P1 — cheap, high-value fix.**

### REQ-CB-O-001 — Product picker (participant-visible result) (Check 6)
**Status:** MISSING | **Role:** Organiser (authors), Participant (sees result) | **QA:** CV
**Requirement:** Organiser selects a real catalog product so participants see a real photo.
**Source:** CLIENT_REQUIREMENTS_MATRIX.md §3.2
**Current state:** `CommunityCampaign` has no `productId`/product relation at all — title/description free text only, confirmed via schema + zero image references anywhere in discovery/detail screens. Unchanged from docs — genuinely still missing.
**Next action:** BLOCKED-CLIENT-DECISION — needs explicit scoping before adding a schema field (bespoke bulk-buy configs may deliberately not map to an existing SKU). Full writeup also under Organiser section (CBO-05).

### REQ-CB-O-005 — Trackable invites (Check 7)
**Status:** MISSING | **Role:** Organiser | **QA:** CV
**Requirement:** Organiser can invite specific people with a trackable link.
**Source:** CLIENT_REQUIREMENTS_MATRIX.md §3.2, itself flagged as needing client confirmation of scope
**Current state:** Both organiser and participant screens use only the OS-generic `Share.share()` — no invite tokens, no attribution, no per-invite tracking. The client's literal wording ("invite participants") is arguably satisfied at face value by generic share; the *trackable* interpretation was the prior audit's own inference.
**Next action:** BLOCKED-CLIENT-DECISION — get an explicit answer before building anything.

### REQ-CB-BIZRULE-01 — "Campaign does NOT need to reach maximum to succeed"
**Status:** PASS | **Role:** Participant, Organiser | **QA:** CV
**Current state:** Verified with code citations — success is decided purely at `confirmedShares >= minimumShares` (`community-campaigns.service.ts:528-567,618-650`); `maximumShares` is never referenced in either success-decision function, only as a hard capacity cap elsewhere. Zero UI text implies otherwise.
**Next action:** None — use as a positive regression-test anchor going forward.

### Notifications & deep links (participant-facing)
**Status:** PASS | **Role:** Participant | **QA:** DO (push delivery) / CV (routing logic)
**Current state:** Every participant-relevant event fires correctly and is correctly targeted; deep-link routing for the DEFAULT (participant) branch works correctly. See Navigation section (NAV-08/09) for the organiser/supplier-side routing bugs — those don't affect participants.
**Next action:** None for participants specifically.

### CBP-11 — No participant self-service pledge cancellation before charge
**Status:** MISSING | **Role:** Participant | **QA:** CV
**Requirement:** Under PLEDGE_THEN_CHARGE, a participant should reasonably be able to withdraw/change a still-PLEDGED contribution.
**Source:** code-only finding
**Current state:** No participant-callable cancel/change endpoint exists — only system-driven cancellation on campaign failure/admin-cancel/organiser-cancel. No UI action for it either.
**Next action:** Flag to client as a genuinely new capability, not a UI-reuse fix — touches capacity-claim atomicity.

---

## D. Community Buy — Organiser

### CBO-01 — Entry point / vendor→organiser transition cue
**Status:** PASS | **Role:** Organiser | **QA:** DO
**Current state:** Real transition cue exists and is correctly wired (`community-buy-organiser.tsx:38-39,90-97`). UX_REDESIGN_AUDIT.md's claim of "no transition cue" is stale.
**Next action:** Correct the audit doc; no code change needed.

### CBO-02 — Responsibilities/expectations explainer
**Status:** PASS | **Role:** Organiser | **QA:** DO
**Current state:** Real explainer card covering responsibilities, what Eki handles, what can't be changed.
**Next action:** None.

### CBO-03 — Organiser verification states, incl. rejection
**Status:** PARTIAL | **Role:** Organiser | **QA:** CV
**Current state:** Pending/verified states real and correctly shown. No terminal "rejected" state exists at all (schema has no field, no admin reject method) — unverified applications sit in "under review" indefinitely.
**Next action:** Confirm with client whether formal rejection is an intended terminal state.

### CBO-04 — Supplier selection from a real verified list
**Status:** PASS | **Role:** Organiser | **QA:** CV
**Current state:** Genuinely market-scoped, verified-only list (`organiser-supplier.service.ts:53-59`), not mocked.
**Next action:** None.

### CBO-05 — Product selection (organiser authoring side)
**Status:** MISSING | **Role:** Organiser | **QA:** CV
**Requirement:** See REQ-CB-O-001 above (Check 6) — same finding, organiser-authoring angle.
**Next action:** BLOCKED-CLIENT-DECISION — same as REQ-CB-O-001.

### CBO-06 — Min/goal/max validation (client + server)
**Status:** PASS | **Role:** Organiser | **QA:** CV
**Current state:** Genuine dual-layer validation — client rejects before any network call, server independently enforces the same rule as the actual authority.
**Next action:** None.

### CBO-07 — Deadline picker
**Status:** PASS | **Role:** Organiser | **QA:** CV + DO
**Current state:** Real interactive calendar component (`DatePickerField.tsx`), not a hand-typed text field as the doc (now stale) claimed.
**Next action:** Correct the doc.

### CBO-08 — Completion/rescue period rules explainer
**Status:** PASS | **Role:** Organiser | **QA:** CV
**Current state:** Dedicated, accurate "what happens at the deadline" card covering all 4 real outcomes.
**Next action:** None.

### CBO-09 — Fulfilment method visibility to organiser
**Status:** PARTIAL | **Role:** Organiser | **QA:** CV
**Current state:** Organiser sees the fulfilment step label, but never the chosen method (Delivery vs. Collection) by name until DISPATCHED/COLLECTED — data already exists, just not surfaced earlier.
**Next action:** One-line addition — surface `FULFILMENT_METHOD_LABELS[fulfilment.method]`.

### CBO-10 — Financial summary (fee) before submitting
**Status:** PASS | **Role:** Organiser | **QA:** CV
**Current state:** Real, computed fee shown twice (creation form + pre-submit review), contradicting the (stale) doc's MISSING claim.
**Next action:** Correct the doc.

### CBO-11 — Supplier-commitment gate on submit
**Status:** PASS | **Role:** Organiser | **QA:** CV
**Current state:** Genuinely enforced server-side (`community-campaigns.service.ts:285-294`) and mirrored client-side (submit button hidden until committed).
**Next action:** None.

### CBO-12 — Preview → submit → changes-requested → approved flow
**Status:** PASS | **Role:** Organiser | **QA:** CV
**Current state:** All four states verified working end-to-end, including resubmission from CHANGES_REQUIRED with unlocked financial fields.
**Next action:** None.

### CBO-13 — Live dashboard (real-time progress)
**Status:** PARTIAL | **Role:** Organiser | **QA:** CV
**Current state:** Real underlying data exists (participant list, confirmed shares) but no `RangeProgressBar`/headline progress indicator renders for a healthy LIVE campaign — only appears once already in RESCUE_WINDOW crisis. Participant screens show this unconditionally.
**Next action:** Add the same progress visualization to the organiser LIVE branch.

### CBO-14 — Organiser top-up
**Status:** PASS (capability exists) / minor PARTIAL (reporting tag) | **Role:** Organiser | **QA:** CV + DO
**Current state:** Doc (stale) claimed top-up only works in RESCUE_WINDOW; in fact an organiser CAN top up a healthy LIVE campaign via the normal participant pledge flow — just not tagged `isOrganiserTopUp: true` for reporting purposes in that case.
**Next action:** Correct the doc; decide whether LIVE-stage top-ups should also carry the reporting tag.

### CBO-15 — Supplier invitation & reassignment on decline (organiser side)
**Status:** PASS (mechanism) / see NAV-08 for a real notification-routing bug in this exact flow | **Role:** Organiser | **QA:** CV
**Current state:** Full round-trip verified real and tested: decline+reason → organiser sees reason → reassign → fresh invitation to new supplier with correctly-scoped dedupe.
**Next action:** See NAV-08 (Navigation section) — the notification that should bring the organiser to this exact screen misroutes them to the participant view instead.

### CBO-16 — Extension request, one-max rule (client-side too)
**Status:** PASS | **Role:** Organiser | **QA:** CV
**Current state:** Enforced both server- and client-side; button disables and relabels once used.
**Next action:** None.

### CBO-17 — Live editing of non-financial fields
**Status:** PASS | **Role:** Organiser | **QA:** CV
**Current state:** Client and server agree exactly on what's editable when (title/description only while LIVE-like).
**Next action:** None.

### CBO-18 — Campaign failure handling (ending rescue early)
**Status:** PASS | **Role:** Organiser | **QA:** CV
**Current state:** Real destructive confirmation before calling `endRescueAndRefund()`, correct no-charge messaging.
**Next action:** None.

### CBO-19 — Refund visibility to organiser
**Status:** PASS (mechanism) | **Role:** Organiser | **QA:** CV
**Current state:** Real, ownership-checked refund progress counts. Informational note: under PLEDGE_THEN_CHARGE this will almost always render empty for the common failure path by design (nothing was ever charged) — not a bug, worth the client knowing.
**Next action:** None.

### REQ-CB-A-002 — Admin financial-terms editing (Check 8)
**Status:** MISSING (edit) / PASS (organiser-side lock is real) | **Role:** Admin | **QA:** CV
**Requirement:** Can admin edit a campaign's financial terms after creation?
**Source:** CLIENT_REQUIREMENTS_MATRIX.md REQ-CB-A-002, explicitly framed as "needs a decision on scope," P1
**Current state:** Organiser-side lock genuinely enforced (`termsLockedAt`, set atomically on first pledge). No `adminUpdateCampaign` method or route exists anywhere — confirmed by exhaustively enumerating the admin CB API surface. Note: the docs' companion claim "no cancel/end method exists" is now **stale** — `cancel()`/`adminCancelCampaign` was built in Phase 9; only the edit-fields half remains genuinely missing.
**Next action:** BLOCKED-CLIENT-DECISION — take back to client as a literal yes/no on whether admin should be exempt from the same terms lock. Do not build speculatively (real reconciliation risk if mismatched against what participants pledged).

### REQ-CB-A-003 — Force-refund (Check 9)
**Status:** MISSING | **Role:** Admin | **QA:** CV
**Requirement:** Admin-callable "create a new refund for an arbitrary contribution."
**Source:** CLIENT_REQUIREMENTS_MATRIX.md REQ-CB-A-003, explicitly framed as needing scoping, P2 ("genuine financial-safety implications")
**Current state:** Confirmed still doesn't exist. The only `campaignRefund.create()` call site is fully automatic (failed-campaign refund creation) — `requeryRefund`/`escalateRefund` only ever operate on an *existing* refund row. Doc's own code comment (`campaign-contributions.service.ts:44-51`) names this exact anticipated-but-unbuilt capability.
**Next action:** BLOCKED-CLIENT-DECISION — put in front of client/finance stakeholders; if approved, must also write a correct ledger reversal entry and should get the same 2FA rigor as release/hold.

---

## E. Community Buy — Supplier

### CBS-01 — Invitation received (notification + screen)
**Status:** PASS | **Role:** Supplier | **QA:** CV
**Next action:** None.

### CBS-02/03/04/05 — Campaign review, accept, decline+reason, reassignment trigger
**Status:** PASS (all four) — **major doc-staleness correction** | **Role:** Supplier | **QA:** CV (backend tests exist)
**Requirement:** Doc (REQ-CB-S-001/002) called this "the one genuine missing capability in the whole audit."
**Current state:** All fully built and shipped: campaign review shows organiser/description/deadline/shares/price; accept has a real confirmation naming it a supply obligation; decline collects an optional reason and calls a real, guarded backend method with audit logging; reassignment (organiser side) is fully wired.
**Next action:** **Update the source docs** — this is the single most misleading stale entry found in the whole audit (flagged as the biggest gap when it's actually complete).

### CBS-06 — Inventory confirmation
**Status:** PASS | **Role:** Supplier | **QA:** CV
**Next action:** None.

### CBS-07 — Fulfilment plan (method, prep time)
**Status:** PARTIAL | **Role:** Supplier | **QA:** CV
**Current state:** Method + notes real and wired; backend-supported `estimatedReadyAt` (prep-time estimate) has no UI field at all.
**Next action:** Add a date input to the plan form.

### CBS-08 — Live campaign visibility (supplier's own progress)
**Status:** PASS | **Role:** Supplier | **QA:** CV
**Current state:** Real numbers shown as plain text (no visual progress bar, unlike organiser/participant screens) — minor visual-consistency note, not a functional gap.
**Next action:** None required; optional visual polish.

### CBS-09 — Final order details (real confirmedShares)
**Status:** PASS | **Role:** Supplier | **QA:** CV
**Next action:** None.

### CBS-10 — Packing → dispatch/collection updates
**Status:** PASS | **Role:** Supplier | **QA:** CV
**Current state:** Full state machine correctly gated to chosen method; both organiser and participants notified.
**Next action:** None.

### CBS-11 — Payment visibility (all 5 states + placeholder)
**Status:** PASS | **Role:** Supplier | **QA:** CV
**Current state:** Doc (stale) claimed no placeholder before a payment record exists — one now exists with accurate copy.
**Next action:** Correct the doc.

### CBS-12 — Supplier-authored campaign updates
**Status:** PASS | **Role:** Supplier | **QA:** CV (backend test exists)
**Current state:** Doc (stale) claimed no way to post updates despite the schema supporting it — fully built and verified end-to-end (supplier posts → correct role tag → participant sees correctly attributed).
**Next action:** Correct the doc.

### CBS-13 — Notifications (invited, order_created, inventory/dispatch)
**Status:** PASS (firing) — see NAV-09 for a routing bug | **Role:** Supplier | **QA:** CV
**Next action:** See Navigation section.

### CBS-14 — Authorization (ownership guards)
**Status:** PASS | **Role:** Supplier, Organiser | **QA:** CV
**Current state:** Consistently enforced via `requireSupplierOwned`/`requireOwnedByOrganiser`, generic 404 (not "forbidden") to avoid existence leakage.
**Next action:** None.

---

## F. Community Buy — Admin (Phase 9 re-verification)

### CBA-01 — Campaign review (approve/reject/changes-requested)
**Status:** PASS (approve/reject) / PARTIAL (request-changes has no confirm — see CBA-12) | **Role:** Admin | **QA:** CV
**Next action:** See CBA-12. Also: fix Approve's confirm-dialog copy ("goes live" overstates it — organiser must still publish separately).

### CBA-02 — Live monitoring incl. RESCUE_WINDOW
**Status:** PASS | **Role:** Admin | **QA:** CV
**Next action:** None.

### CBA-03 — Deadline evaluation visibility (rescueEndsAt/extensionCount)
**Status:** PASS | **Role:** Admin | **QA:** CV
**Next action:** None.

### CBA-04 — Financial ledger: real data, no "escrow" language
**Status:** PASS | **Role:** Admin | **QA:** CV
**Next action:** None.

### CBA-05 — Contribution records drill-down, real identity
**Status:** PASS | **Role:** Admin | **QA:** CV
**Next action:** None.

### CBA-06 — Refund recheck/escalate: idempotency
**Status:** PARTIAL | **Role:** Admin | **QA:** CV
**Current state:** `requeryRefund()` genuinely idempotent (same Stripe idempotency key reused). `escalateRefund()` is NOT idempotent — no `escalated` field on `CampaignRefund`, no check for an existing open support case, so a page reload + re-click creates a duplicate `CommunityBuySupportCase`. The "Escalated" badge is client-session-only and disappears on reload.
**Next action:** Add a server-side escalated marker or existing-case check before creating a new one.

### CBA-07 — Refund case reason/status/next-action visibility
**Status:** PASS | **Role:** Admin | **QA:** CV
**Next action:** Covered by CBA-06's fix for the persistence gap.

### CBA-08 — Supplier payment release/hold: 2FA + four-eyes UI — **serious new finding**
**Status:** PARTIAL | **Role:** Admin (Supplier Settlement) | **QA:** CV
**Current state:** Backend correctly implements both 2FA-gating and four-eyes with a correct pending-approval UI distinction. **But** neither the release nor hold action on `community-campaigns/page.tsx` has any 2FA-code-entry UI, unlike 6 other admin pages that already implement this pattern (vendors, payout-requests, orders, approvals, disputes, users). For any admin account with 2FA **enabled**, clicking either action 403s with no way to supply a code — **the entire supplier-payment release/hold surface is unusable for that admin.**
**Next action:** Port the existing `payout-requests/page.tsx` 2FA-modal pattern into `community-campaigns/page.tsx`. **Treat as a release blocker if any production admin has 2FA enabled.**

### CBA-09 — Campaign controls full matrix (approve/reject/request-changes/pause/resume/cancel)
**Status:** PARTIAL | **Role:** Admin | **QA:** CV
**Current state:** All correctly permission-gated, state-validated, audited, and idempotent. Gaps: request-changes has no confirm dialog (CBA-12); **pause() and resume() never notify the organiser** — unlike every other admin state transition — so an organiser whose campaign is paused/resumed by admin gets no explanation.
**Next action:** Add `notifyCampaign()` calls to `pause()`/`resume()`.

### CBA-10 — Support cases (notes, response, status, evidence, escalate)
**Status:** PASS | **Role:** Admin | **QA:** CV
**Next action:** None.

### CBA-11 — Audit logs (entityId filter, before/after state)
**Status:** PASS | **Role:** Admin | **QA:** CV
**Next action:** None.

### CBA-12 — Confirmations on every mutation
**Status:** FAIL (one gap) | **Role:** Admin | **QA:** CV
**Current state:** Every mutation across all 7 CB admin pages has a confirm() EXCEPT "Request changes" in the campaign review queue — inconsistent with its siblings (Approve/Reject) in the same row.
**Next action:** Add the missing confirm().

### CBA-13 — 2FA route coverage + cancel-route reasoning
**Status:** PASS | **Role:** Admin | **QA:** CV
**Current state:** Exactly 4 routes 2FA-gated (refund requery/escalate, payment release/hold); cancel's exclusion is independently verified correct (cancel's status guard genuinely never allows a post-charge campaign through).
**Next action:** None on backend — see CBA-08 for the frontend gap.

### CBA-14 — Four-eyes (AdminApprovalRule) wiring
**Status:** PASS | **Role:** Admin | **QA:** CV
**Current state:** Confirmed wired only to the 2 intended action types; no default rule seeded anywhere (inert until Super Admin configures one). Noted informationally: `community_buy.mutate` is undifferentiated across Campaign Reviewer/Refund Ops/Supplier Settlement roles — a self-acknowledged design limitation, not a bug.
**Next action:** None required.

### CBA-15 — Manual refresh on all pages
**Status:** PASS | **Role:** Admin | **QA:** CV
**Next action:** None.

### CBA-16 — Authorization layering (role + permission on every route)
**Status:** PASS | **Role:** Admin | **QA:** CV
**Next action:** None.

### CBA-17 — Extension rejection doesn't notify organiser — **new finding**
**Status:** FAIL | **Role:** Organiser (via admin action) | **QA:** CV
**Current state:** `approveExtension()` notifies organiser+participants; `rejectExtension()` does not notify anyone at all — an organiser waiting on an extension decision during a live rescue countdown gets no signal a decision was even made.
**Next action:** Add `notifyCampaign()` to `rejectExtension()` mirroring the approve path.

---

## G. Notifications (platform-wide)

### NOTIF-01 — In-app notification creation
**Status:** PASS | **QA:** CV
**Next action:** None.

### NOTIF-02 — Real Expo push send (not a stub)
**Status:** PASS | **QA:** CV
**Next action:** None.

### NOTIF-04 — DB-level dedupe on `dedupeKey`
**Status:** PASS (in-app write) — see NOTIF-DUP-01 for a real gap this doesn't cover | **QA:** CV
**Next action:** None beyond NOTIF-DUP-01.

### NOTIF-05 — Invalid/stale push token handling (ticket vs. receipt)
**Status:** PASS, with a disclosed timing caveat | **Role:** All | **QA:** CV
**Current state:** Genuinely well-built — immediate ticket-time cleanup on `DeviceNotRegistered`, plus a real, separate receipt-check job distinguishing "Expo queued it" from "actually attempted delivery." Caveat: this receipt job only runs once daily (Vercel Hobby cron-count limit), so receipt-only-detected bad tokens can take up to ~24h to clean up.
**Next action:** Optional — move to more frequent triggering if plan tier allows; not blocking.

### NOTIF-06 — Killed/background app architecture
**Status:** PASS (architecture) / DEVICE-ONLY (actual delivery) | **QA:** CV + DO
**Current state:** Correct native config (expo-notifications plugin, real `google-services.json`, cold-start tap handling via `getLastNotificationResponseAsync`, channels/categories). Cannot verify actual delivery-while-killed without a real device.
**Next action:** Manual device QA — kill app, send push, confirm tray + tap-to-open, both iOS and Android. Also: `EXPO_ACCESS_TOKEN` is not configured anywhere, so Expo's own dashboard shows no send observability even though sends succeed — recommend setting for launch-time visibility.

### NOTIF-07 — Supplier invitation/acceptance dedupeKey consistency
**Status:** PASS, minor gap | **Role:** Organiser, Supplier | **QA:** CV
**Current state:** `supplier_invited`/`supplier_accepted` correctly deduped; `supplier_declined` is the one sibling missing a `dedupeKey` — low risk since state guards already prevent a second decline, but inconsistent.
**Next action:** Add the missing dedupeKey for consistency.

### NOTIF-08 — Admin-triggered communications: support-case customer response never notifies
**Status:** MISSING | **Role:** Buyer/Organiser/Supplier (support-case filer) | **QA:** CV
**Current state:** `admin_cancelled` and other admin actions correctly notify via the real, single notification system (no parallel/second system exists anywhere). But `supportCaseService.adminUpdate()` — which sets the customer-visible response — never sends any notification (no push, no in-app row, no email). A customer only finds out by manually reopening the app.
**Next action:** Add a `notificationsService.enqueue()` call when `customerVisibleResponse` transitions from unset to set. **Real customer-facing gap, not a device limitation.**

### NOTIF-09 — Consent/preference gating (transactional vs. marketing)
**Status:** PASS | **QA:** CV
**Current state:** Correctly split — 4 of 12 automation types require marketing consent (buyer engagement/win-back type sends), the rest (order/subscription/campaign-lifecycle) correctly bypass consent as genuinely transactional.
**Next action:** None.

### NOTIF-DUP-01 — Duplicate pushes for 4 event types (renewal reminder, price-approval, campaign milestone, campaign refund update)
**Status:** FAIL | **Role:** Buyer, Vendor | **QA:** CV
**Requirement:** One event should never produce two push notifications.
**Source:** code-only finding
**Current state:** These 4 call sites fire BOTH a direct `notificationsService.enqueue()` (rich, deep-linkable) AND `automationService.scheduleAutomation()` (generic, dead-tap per NAV-10) for the identical business event. The in-app row is deduped, but the push send in `communicationService.send()` is never gated on that outcome — it always fires, so the user gets two pushes, one useless. The exact same bug class was already fixed once in `stripe.service.ts` (explicit comment there) but never propagated to these 4 sites.
**Next action:** Stop double-triggering, or make the push channel respect the same dedupe outcome as the in-app channel. **P1.**

### NOTIF-INAPP-01 — In-app notification list has no tap-action for payout/stock/verification/system categories
**Status:** FAIL | **Role:** Vendor (primarily) | **QA:** CV
**Current state:** `normalizeNotificationType()` correctly buckets these categories, but the notification-list screen's tap handler has branches only for order/message/subscription/campaign/automation — tapping a payout/stock/verification notification in the in-app list does nothing. Independent of the push-tap dead-links found separately.
**Next action:** Add the missing branches in `app/(buyer)/notifications.tsx`.

---

## H. Payments / Refunds / Ledger

### PAY-01 — Real Stripe integration (not mocked in production paths)
**Status:** PASS | **QA:** CV
**Next action:** None.

### PAY-02 — PLEDGE_THEN_CHARGE: charges only on success
**Status:** PASS | **QA:** CV
**Next action:** None.

### PAY-03 — No upfront-custody "escrow" language user-facing
**Status:** FAIL (real user-facing hits) / PASS (in-app order-status labels are already clean) | **Role:** Buyer, Vendor, public visitors | **QA:** CV
**Current state:** Real "escrow" hits found in: one vendor-facing dispute notification body ("The escrow is frozen..."), 4 buyer-visible checkout error strings (`paystack.service.ts`), and 3 public marketing-site copy lines. The Terms/legal disclaimer's use of "escrow" (to explicitly disclaim being one) is a defensible, separate case. Admin-web-only "Escrow Balance" labels are low-severity (staff-only). The actual in-app buyer/vendor order-status screens already correctly use "Protected payment"/"Secured" language.
**Next action:** Reword the flagged notification body + 4 error strings + marketing copy. Leave the Terms disclaimer as-is (flag to legal either way).

### PAY-04 — Successful campaign charge: real, independent per-contribution attempts
**Status:** PASS | **QA:** CV
**Next action:** None.

### PAY-05 — Supplier/vendor payout idempotency & failure handling — **CRITICAL, new finding**
**Status:** PASS (Community Buy) / FAIL (general vendor payout system) | **Role:** Vendor | **QA:** CV
**Requirement:** A payout transfer must be idempotent and must not be recorded as successful if it wasn't.
**Source:** code-only finding
**Current state:** Community Buy's `releaseSupplierPayment()` does this correctly (real idempotency key, falls back to a resumable `ON_HOLD` on failure). The **general vendor payout system** (`payouts.service.ts` `adminMarkPaid`) does not: no idempotency key at all on `stripe.transfers.create`; the `PayoutRequest.status = PAID` transition and the vendor's wallet debit both commit **before** the Stripe transfer is even attempted; on a thrown Stripe error, only a log line is written — no compensating status, no `TRANSFER_FAILED` state, no automatic retry. A vendor can be told "payout paid" (and get a push saying so) when the money never actually moved, with no in-app way to detect or dispute it, and a retried admin click risks a genuine duplicate transfer.
**Next action:** **Treat as launch-blocking for real vendor money.** Port the Community Buy pattern (idempotency key + resumable failure state) into the general payout path. **P0.**

### PAY-06 — Eki fee: never guessed, blocks release when unconfigured
**Status:** PASS | **QA:** CV
**Next action:** None.

### PAY-07 — Refund idempotency (Community Buy, Regular Delivery retries, general order refunds)
**Status:** PASS (all 3 Stripe-backed systems); minor gap on the Paystack refund branch (no explicit idempotency param — lower severity since Paystack isn't the launch provider) | **QA:** CV
**Next action:** Confirm/add Paystack refund idempotency if/when that provider goes live.

### PAY-08 — Duplicate-payment ("anomaly") detection
**Status:** PASS | **QA:** CV
**Current state:** Real, DB-driven, 3-check scan, runs on the daily cron, writes real findings to a real table with admin review/escalate actions.
**Next action:** None.

### PAY-09 — Failed-payment/"attention" states are distinct per domain
**Status:** PASS | **QA:** CV
**Next action:** None.

### PAY-10 — Ledger & reconciliation: real double-entry, scheduled
**Status:** PASS, with one disclosed limitation | **QA:** CV
**Current state:** Real balanced double-entry posting, real reversal-not-deletion correction pattern, real Stripe-side reconciliation comparison across every real PaymentIntent source in the app, running on the daily cron. Paystack reconciliation/transfer-verification are honest `501` stubs, not fabricated success — a real, disclosed gap if Paystack orders are in scope for launch.
**Next action:** BLOCKED-CLIENT-DECISION — confirm whether Paystack/Domestic-Africa-Escrow orders are in scope for this launch; if yes, that reconciliation coverage needs to be built first.

---

## I. Market Gating

### MKT-01 — Backend market seed = exactly the 10 approved launch markets, no African country
**Status:** PASS | **QA:** CV (tests pass)
**Next action:** None.

### MKT-02 — Community Buy gating: admin-toggle-driven, no bypass, mobile reads live config
**Status:** PASS | **QA:** CV
**Next action:** None (public-endpoint over-exposure is a separate finding — see SEC-01).

### MKT-03 — Regular Delivery entry-point gating
**Status:** PARTIAL | **Role:** Vendor | **QA:** CV
**Current state:** The backend already computes a correctly-gated `marketing_tools` entry for Regular Deliveries (mirroring Community Buy's), but the vendor Home screen's "Regular Deliveries" row is rendered unconditionally, never checking it — while the adjacent Community Buy row on the same screen IS correctly gated. Additionally, `subscriptionOffersService.create/publish` has no market-gate check at all (a vendor in a disabled market can build/publish a "dead" offer) — though the two consumer-facing paths (discovery, subscribe) remain correctly gated, so no real transaction can occur.
**Next action:** Wire the vendor Home row to the existing `marketing_tools` flag (trivial, mirrors adjacent code); optionally add a backend-side create/publish gate for defense in depth.

### MKT-04 — Vendor country/Nigeria rejection
**Status:** PASS (tested) | **Role:** Vendor, Admin | **QA:** CV
**Current state:** Real, tested rejection (`assertApprovedLaunchCountry`) on every write path including the admin edit path; legacy grandfathered vendors aren't broken.
**Next action:** None. Minor unrelated follow-up: admin vendor-currency field has no whitelist check — low severity.

### MKT-05 — Country display names, graceful on African codes
**Status:** PASS | **QA:** CV
**Next action:** None.

### MKT-06 — Currency mapping for 10 launch markets
**Status:** PASS (authoritative `MarketConfiguration` layer) / PARTIAL (several frontend display-currency pickers) | **Role:** Buyer, Vendor, public visitors | **QA:** CV
**Current state:** The authoritative per-market currency mapping is fully correct (GBP/USD/CAD/EUR×5/CHF/EUR-Croatia, no stale HRK). Several separate, hardcoded frontend "display currency preference" pickers (mobile, admin-web, public storefront) are stale — they omit CHF (a real launch market) while including NGN/GHS/KES (non-launch African currencies) as display-only options. This is cosmetic/display-only, not a registration or feature-enablement bypass.
**Next action:** Add CHF to the 3 affected pickers; remove or fix the dead, inconsistent backend `SUPPORTED_CURRENCIES`/`validateCurrency` (unreachable in production).

### MKT-07 — No accidental African-market enablement possible
**Status:** PASS | **QA:** CV
**Current state:** `marketConfigurationService.update()` is an `update`, not an `upsert` — cannot create a row for an unseeded country; no seed/migration/admin path creates one. The broader "supported in code" layer (currencies, payment-provider routing for legacy vendors) is real and correctly distinct from the narrower "launch-enabled" layer.
**Next action:** None required for safety.

### MKT-08 — Market/country selectors restricted to 10 launch markets
**Status:** PASS, two minor unrelated inconsistencies noted | **QA:** CV
**Next action:** Optional hygiene — one onboarding screen has its own redundant (but not risky) country list; see MKT-06 for the currency-picker note.

---

## J. UX / Accessibility

### UX-01 — Raw enum rendering in core screens (beyond CB/RD/Automation)
**Status:** PARTIAL | **Role:** Buyer, Vendor, Admin | **QA:** CV
**Current state:** Several core screens (Disputes, Orders, Payment status, admin-web vendor/wallet/gift pages) use a regex-based prettify instead of a real label map — functional (title-cased) but unlocalized. One latent bug: `delivery-tracking.tsx:100` uses non-global `.replace()` — would break on any future status with 2+ underscores.
**Next action:** Low priority; fix the non-global-replace latent bug specifically.

### UX-02 — Fake/hardcoded metrics
**Status:** PASS | **QA:** CV
**Next action:** None.

### UX-03 — Empty states (8 screens sampled)
**Status:** PASS | **QA:** CV
**Next action:** None.

### UX-04 — Loading states (sampled)
**Status:** PASS | **QA:** CV
**Next action:** None.

### UX-05 — Disabled button visual states (sampled)
**Status:** PASS | **QA:** CV
**Next action:** None.

### UX-06 — Confirmation on destructive actions (outside CB/RD/Automation)
**Status:** PASS (consumer flows) / PARTIAL (admin dispute resolution has no confirm) | **Role:** Admin | **QA:** CV
**Current state:** Delete account, delete product, confirm delivery all correctly confirmed. Admin "Resolve Dispute" (releases funds) has note-required + 2FA guards but no explicit confirm dialog before executing.
**Next action:** Add a confirm step to admin dispute resolution given the direct financial consequence.

### UX-07 — Accessibility label coverage
**Status:** FAIL | **Role:** Buyer, Vendor (screen-reader users) | **QA:** CV (presence) / DO (actual VoiceOver behavior)
**Current state:** ~35% combined coverage of `accessibilityLabel`/`accessibilityRole` across buyer+vendor screens; `accessibilityHint` used zero times anywhere. Directly contradicts UX_REDESIGN_PLAN.md's own commitment ("every new interactive element") — 8 of 10 buyer CB screens, both supplier CB screens, and all 3 Automation Centre screens have zero accessibility attributes.
**Next action:** Real gap against the plan's own promise, not just a nice-to-have — needs a dedicated pass on exactly the screens this engagement built.

### UX-08 — Dynamic Type / font scaling
**Status:** PARTIAL | **QA:** CV (code) / DO (actual rendering)
**Current state:** No explicit opt-out anywhere (good — text does scale by default), but 1,230 unguarded fixed-pixel font sizes and zero use of `maxFontSizeMultiplier`, so tightly-fixed-height rows/badges are structurally at risk of clipping at large accessibility text sizes.
**Next action:** Device QA at largest Dynamic Type setting; add `maxFontSizeMultiplier` caps to fixed-height UI as needed.

### UX-09 — Touch target sizes
**Status:** FAIL | **Role:** Buyer, Vendor | **QA:** CV (code) / DO (perceptibility)
**Current state:** `hitSlop` used exactly once in the whole buyer+vendor tree; numerous icon-only buttons (e.g. the 38×38 header back button present on nearly every new-feature screen) fall short of the 44×44pt guideline with no compensation. Predates this engagement but is perpetuated in every new screen added.
**Next action:** Add `hitSlop` to small icon buttons, prioritizing the shared header-back-button pattern used across most new screens.

### UX-10 — Keyboard safety (KeyboardAvoidingView)
**Status:** FAIL | **Role:** Buyer, Vendor | **QA:** CV (code) / DO (actual overlap)
**Current state:** Used in only 14 files total. Several multi-field forms (organiser campaign creation — 10 inputs, RD offer creation — 6-7 inputs, and even pre-existing core vendor tools `create-bundle.tsx`/`create-discount.tsx`) have zero KeyboardAvoidingView.
**Next action:** Add KAV to the identified forms, prioritizing the highest-field-count ones.

---

## K. Navigation

### NAV-01 — Bottom tab registration (no unwanted new tabs)
**Status:** PASS | **QA:** CV (script + manual)
**Next action:** None.

### NAV-02 — `check-no-mock-data.js` result
**Status:** PASS (163/163 files clean) | **QA:** CV
**Next action:** None.

### NAV-03 — Genuine, discoverable entry points (CB, Automation, RD)
**Status:** PASS | **QA:** CV
**Next action:** None.

### NAV-04 — Payout lifecycle notifications (requested/approved/rejected/paid) are dead taps
**Status:** FAIL | **Role:** Vendor | **QA:** CV
**Current state:** None of the 4 payout notification payloads set `data.type`, so the frontend's routing switch never matches — tapping does nothing. The one existing "payout_approved" branch in the frontend is unreachable dead code because the backend never sets that field. Also confirms several `pushNotifications.*` helper functions (`vendorVerified`, `lowStockAlert`, `orderDelivered`, `earningsReleased`) are entirely orphaned (never called anywhere).
**Next action:** Add `data.type` to all 4 payout notifications + matching frontend branches. **P1 — financially significant, high-frequency.**

### NAV-05 — Escrow "delivery confirmed"/"auto-release" notifications are dead taps
**Status:** FAIL (auto-release) / PARTIAL (delivery-confirm, masked by a duplicate correct push — see also PAY-03's notification-body language issue on the same call site)
**Role:** Vendor | **QA:** CV
**Next action:** Same fix pattern as NAV-04, applied to `escrow.service.ts`'s two call sites. Also collapse the delivery-confirm double-send into one correctly-routed push.

### NAV-06 — 6 templated Communications pushes are dead taps (verification decisions, first order, order shipped/confirmed/delivered) — **highest-traffic dead-tap found**
**Status:** FAIL | **Role:** Buyer, Vendor | **QA:** CV
**Current state:** `communication.service.ts`'s generic push path sends `data:{type: eventKey}` using raw template keys (`vendor_verification_approved`, `buyer_order_delivered`, etc.) that appear nowhere in the frontend's routing switch. These are real, currently-fired, high-frequency, core-flow notifications — not edge cases.
**Next action:** Add matching frontend branches for all 6 eventKeys, or standardize the backend to reuse the `order_status`/`vendor_verified` types the frontend already understands. **P0 given order-lifecycle/verification are core flows.**

### NAV-07 — Orphaned/dead push helper functions
**Status:** MISSING (not wired, not a live bug) | **QA:** CV
**Next action:** Low priority — delete or wire up `vendorVerified`/`lowStockAlert`/`orderDelivered`/`earningsReleased` in `push-notifications.ts`.

### NAV-08 — Community Buy ORGANISER-targeted events misroute to the participant screen
**Status:** FAIL | **Role:** Organiser | **QA:** CV
**Requirement:** Every organiser-directed Community Buy notification should open the organiser management screen, not the read-only participant view.
**Source:** code-only finding; consolidates CBX-01 (Organiser/Supplier audit) and NOTIF-03a (Notifications audit) into the fullest version
**Current state:** The frontend allow-list only routes `approved|changes_requested|rejected|supplier_accepted|inventory_confirmed` to the organiser screen. Confirmed additional organiser-directed events that fall through to the wrong (participant) screen: `admin_cancelled`, `cancelled`, `rescue_opened`, `extension_approved`, `succeeded`, `failed`, `supplier_declined`, and the organiser-recipient case of `fulfilment_update`. The single most time-sensitive one — "supplier declined, go pick a new one now" — is exactly the one whose notification doesn't take the organiser to where they can act.
**Next action:** Fix the routing table to cover every organiser-directed event actually fired. **P1** (real, verified, affects a time-sensitive action). Longer-term: pass an explicit `audience` flag in the notification payload rather than inferring from event name (see REG-06's related process recommendation).

### NAV-09 — Community Buy SUPPLIER-targeted events (beyond `supplier_invited`) misroute
**Status:** FAIL | **Role:** Supplier (vendor) | **QA:** CV
**Current state:** `supplier_order_created` and `fulfilment_follow_up` (from the fulfilment-delay system) both land a vendor account on a buyer-only route group.
**Next action:** Same fix as NAV-08, applied to the supplier branch.

### NAV-10 — 4 of 12 Automation push types are dead taps for buyers
**Status:** FAIL | **Role:** Buyer | **QA:** CV
**Current state:** `automation_buyer_win_back`, `automation_campaign_milestone`, `automation_campaign_deadline`, `automation_campaign_refund_update` have no frontend branch and no fallback for a buyer recipient (vendor-targeted automation types at least fall back to Automation Centre). The push payload also carries no entity id (campaignId, etc.) for any automation type, which will be needed once branches are added.
**Next action:** Add the 4 missing branches (campaignId is available in the scheduling call's `data`); add a generic "if nothing matches, go to Home/Notifications" safety net rather than a silent no-op. **P1** — Community Buy deadline/refund pushes are time-sensitive and financially relevant.

### NAV-11 — Cross-role transition cue (vendor → organiser)
**Status:** PASS | **QA:** CV
**Next action:** Correct the stale audit doc claim.

---

## L. Admin Operations

Covered under **F (Community Buy Admin)** above — this was the scope of admin operations actually re-audited. No separate findings beyond CBA-01 through CBA-17.

---

## M. Security

### SEC-01 — Public MarketConfiguration endpoints over-expose fields
**Status:** FAIL (medium severity) | **Role:** All (unauthenticated) | **QA:** CV
**Requirement:** Public, unauthenticated market-config endpoints should return only what the mobile app's feature-gating logic needs.
**Source:** independently discovered, re-verified in this audit
**Current state:** `GET /api/community-buy/markets` and `/markets/:country` (`community-buy.controller.ts:18-35`, no auth middleware on `communityBuyRouter`) call `marketConfigurationService.list()/get()`, which do a bare Prisma `findMany`/`findUnique` with **no `select` clause** — returning every column on `MarketConfiguration`, identical to what the authenticated admin endpoint returns. Exposed fields beyond the documented public purpose (feature-gating flags) include: `organiserFeeBps`/`communityBuyFeeBps` (Eki's commission rate — commercially sensitive), `paymentMode` (DISABLED/TEST/LIVE — reveals which markets have real money flowing), `paymentProvider`/`identityProvider`, `supplierReleasePolicy`, `refundTermsVersion`/`legalTermsVersion`, `campaignMin/MaxDurationHours`, `campaignMin/MaxValueAmount`, `deliveryMethods`, `acceptedIdentityDocuments`, `id`/`createdAt`/`updatedAt`. No credentials, secrets, tokens, or PII are exposed — this is an over-fetching/least-privilege issue, not a credential leak.
**Impact:** Competitively/commercially sensitive configuration (fee rates, live-vs-test payment status per market) is readable by anyone, unauthenticated, with a single unauthenticated GET request.
**Next action:** Add a `select`/mapper restricting the public response to exactly: `countryCode, currency, communityBuyEnabled, communityBuyPaymentsEnabled, organiserApplicationsEnabled, supplierApplicationsEnabled, regularDeliveriesEnabled` — matching the endpoint's own documented purpose. **P1 — not exploitable for fraud/account-takeover, but a real, fixable data-disclosure issue that should not ship as-is.**

---

## N. Regression

### REG-01 — Backend test suite
**Status:** PARTIAL | **QA:** CV
**Result:** 1297/1298 tests passed (92/93 files). One failure: `dispute-resolution.test.ts`'s "vendor-favour resolution never calls the refund provider" test **timed out** (not an assertion failure) — unrelated to any CB/Automation/RD/Admin code touched this engagement. More consistent with test flakiness than a functional regression, but should be re-run in isolation to confirm before dismissing.
**Next action:** Re-run the failing test in isolation; investigate if it fails consistently.

### REG-02 — Backend typecheck
**Status:** PASS (clean, exit 0) | **QA:** CV

### REG-03 — admin-web typecheck
**Status:** PASS (clean, exit 0) | **QA:** CV

### REG-04 — Shared component (`PremiumBlocks.tsx`) blast radius
**Status:** PASS | **QA:** CV
**Current state:** Changes were purely additive (2 removed lines total across the whole engagement); the one behavior change (`ErrorState`'s default title) only affects the 23 files that are all CB/Automation/RD screens — zero core screens affected. This is exactly the failure mode the audit looked for, and it did not occur.
**Next action:** None — flagged positively as a well-contained change.

### REG-05 — Buyer Home screen (`app/(buyer)/index.tsx`) — highest-risk regression surface
**Status:** PARTIAL | **Role:** Buyer (100% of sessions) | **QA:** CV (code) / DO (real load-time impact)
**Current state:** The one core, high-traffic screen genuinely modified this engagement (+108 lines) — a new concurrent `loadCommunityBuy()` fetch was added to the mount effect, defensively coded (try/catch, hides the section on any error). Home's load time is now coupled to Community Buy backend health, unbounded by a timeout.
**Next action:** Manual QA the Home screen specifically: (a) market with CB disabled, (b) market with CB enabled + live campaigns, (c) enabled + zero campaigns, (d) simulated slow/erroring CB backend. **Top QA priority for regression risk.**

### REG-06 — Recurring bug class: dead notification taps (process observation)
**Status:** N/A (process finding) | **QA:** CV
**Current state:** Git history shows this exact defect class (`data.type` missing → dead tap) has already been reactively patched at least 5 times across the project's history, and NAV-04 through NAV-10 above show it recurring again in new areas. No structural safeguard (test, lint rule, or shared enum) currently prevents a new notification from shipping without a matching frontend route.
**Next action:** Add a lightweight CI check (a canonical routing-table/enum shared or cross-checked between backend and frontend) so a new `data.type`/eventKey without a matching frontend branch fails a test, rather than shipping silently again.

---

## Summary counts

See `FINAL_CLIENT_GAP_AUDIT.md` for the full executive summary, prioritized issue lists, and exact tallies.
