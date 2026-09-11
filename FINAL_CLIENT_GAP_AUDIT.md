# Final Client Gap Audit

**Date:** 2026-09-09
**Scope:** Complete re-verification of Automation, Regular Delivery, Community Buy (Participant/Organiser/Supplier/Admin), Notifications, Payments/Refunds/Ledger, Market Gating, UX/Accessibility, Navigation, Admin Operations, Security, and Regression — across `ekiapp-backend-main` and `ekiapp-frontnend-application-ios-android-main` (mobile + admin-web).
**Companion documents:** `FINAL_CLIENT_REQUIREMENTS_STATUS.md` (full requirement-by-requirement matrix), `FINAL_MANUAL_QA_PLAN.md` (device/browser QA checklist).

**No code was modified during this audit.** Every finding below was verified by reading current source code and, where applicable, running the actual test suites/typechecks/scripts — not by trusting `CLIENT_REQUIREMENTS_MATRIX.md`, `CLIENT_TO_SCREEN_TRACEABILITY.md`, `UX_REDESIGN_AUDIT.md`, or `UX_REDESIGN_PLAN.md`, all four of which this audit found to be **materially stale**, in both directions.

---

## Executive Summary

The engagement is substantially complete and, in most areas, in better shape than the four source documents describe — a large fraction of what those docs call "MISSING" or "FAIL" (especially the entire Community Buy Supplier section, several Organiser items, and most Community Buy Admin confirmations) turned out to be fully built and working. **Do not hand the client the four source docs as-is** — they would communicate a materially inflated remaining-work picture. Use this document and the companion matrix instead.

That said, this audit also found **4 P0 (critical) issues that were previously unknown**, none of which appear in any prior audit pass:

1. **The entire Automation Engine has never sent a single message in production** — a quiet-hours guard and the daily cron's fixed 3am UTC run time always collide, so every automation is silently suppressed before an `AutomationRun` row is even created. (AUTO-16)
2. **The general vendor payout system can record a payout as "paid" internally, and tell the vendor so, without the money ever actually moving** — no idempotency key on the Stripe transfer, and the internal status + wallet debit commit before the transfer is even attempted, with no compensating failure state. (PAY-05)
3. **6 of the highest-frequency, most core push notifications in the app are dead taps** — vendor verification decisions, a vendor's first order, and buyer order confirmed/shipped/delivered. Tapping any of them does nothing. (NAV-06)
4. **A 2FA-enabled admin cannot release or hold a Community Buy supplier payment at all** — the backend correctly demands a 2FA code the admin-web page has no way to collect, unlike 6 other admin pages that already implement this exact pattern. (CBA-08)

Beyond these four, this audit found a **systemic, recurring bug class**: a notification is created with a `data` payload the frontend's tap-router doesn't recognize, so tapping it does nothing. This is not isolated — it recurs across payouts, escrow order events, Communications-template sends, Automation pushes, and Community Buy organiser/supplier events (NAV-04 through NAV-10). Git history shows this exact class of bug has already been patched reactively at least 5 times before this audit found 7 more instances — there is no structural safeguard (test, shared enum, lint rule) preventing it from recurring again.

**148 requirements/findings were audited.** 84 PASS, 32 PARTIAL, 19 FAIL, 10 MISSING, 3 BLOCKED-CLIENT-DECISION. Of the 64 items needing action: **4 are P0, 26 are P1, 34 are P2.**

---

## P0 — Critical (fix before considering the engagement complete)

### P0-1 — AUTO-16: Automation Engine never actually sends anything in production
The daily Vercel Cron (the only scheduled trigger for every automation type) runs at `0 3 * * *` (3am UTC). `automationService.scheduleAutomation()`'s quiet-hours guard suppresses any send between 22:00–07:00 UTC. 3am falls inside that window every single day, so every automation — all 12 types, vendor-toggleable and "Managed by Eki" alike — is silently dropped before an `AutomationRun` row is ever created. No error, no visible signal anywhere. **Every "Active" toggle a vendor sees today is non-functional in practice.**
**Fix:** Move the cron outside 22:00–07:00 UTC, or exempt cron-triggered batch sends from a guard designed for real-time triggers.
**Files:** `ekiapp-backend-main/vercel.json`, `src/modules/automation/automation.service.ts:11-17,169-176`.

### P0-2 — PAY-05: General vendor payout can be marked "paid" with no real transfer, no recovery path
`payouts.service.ts`'s `adminMarkPaid` commits the `PayoutRequest.status = PAID` transition and debits the vendor's internal wallet balance **before** attempting the Stripe transfer. The transfer call itself has **no idempotency key**. If the transfer throws, the code only logs the error — no compensating status, no `TRANSFER_FAILED` state, no automatic retry. The vendor is told (via a real push) that they were paid; the money may never have moved; there is no in-app way for anyone to detect or fix this short of manual ops reconciliation. A retried admin click risks a genuine duplicate transfer. Community Buy's equivalent (`releaseSupplierPayment`) solves this correctly — this pattern was never ported to the general payout path.
**Fix:** Add a real idempotency key to the Stripe transfer call; do not commit `PAID`+wallet-debit ahead of a confirmed transfer, or add a genuine resumable failure state, mirroring the Community Buy `ON_HOLD` pattern.
**Files:** `src/modules/payouts/payouts.service.ts:221-346`.

### P0-3 — NAV-06: 6 of the highest-traffic push notifications in the app are dead taps
Vendor verification approved/rejected, a vendor's first order, and buyer order confirmed/shipped/delivered all route through `communication.service.ts`'s generic push path, which sets `data.type` to a raw template key (e.g. `vendor_verification_approved`, `buyer_order_delivered`). None of these 6 strings exist anywhere in the frontend's notification tap-router. These are not edge cases — they are core, high-frequency order-lifecycle and vendor-onboarding events.
**Fix:** Add matching frontend branches for all 6 event keys, or standardize the backend to reuse the existing `order_status`/`vendor_verified` types the frontend already understands.
**Files:** `src/modules/communications/communication.service.ts:20-85,264-289`; `app/_layout.tsx:136-244`.

### P0-4 — CBA-08: 2FA-enabled admin cannot release or hold any Community Buy supplier payment
The backend correctly gates `POST .../supplier-payment/release` and `/hold` behind `require2fa`. The admin-web Community Buy campaigns page never collects a 2FA code and doesn't catch `API2FARequiredError` at all — unlike 6 other admin pages (vendors, payout-requests, orders, approvals, disputes, users) that already implement this exact pattern. For any admin with 2FA enabled, both actions 403 with no way to proceed. This makes an entire, financially significant admin capability unusable for that admin.
**Fix:** Port the existing `payout-requests/page.tsx` 2FA-modal pattern into `community-campaigns/page.tsx` for both actions.
**Files:** `admin-web/src/app/community-campaigns/page.tsx`.

---

## P1 — Significant (fix soon; real user-facing functional or trust gap)

| ID | One-line summary |
|---|---|
| AUTO-04 | Automation config UI offers only 3 hardcoded presets; backend already supports free numeric input |
| AUTO-05 | No eligibility explanation anywhere — vendor can't predict when/why an automation fires |
| AUTO-06 | `PAYMENT_RECOVERY`/`PRICE_APPROVAL_REMINDER` runs are permanently invisible to the vendor (missing `vendorId`) |
| RD-05 | Buyer can't pick a resume-on date for Pause; no way to change subscription frequency post-subscribe |
| RD-04 | Substitution/fulfilment info still missing from the pre-subscribe screen (data already loaded, just not rendered) |
| RD-08 | Admin has zero remediation tooling for stuck Regular Delivery renewals — a real-money feature with no recourse (retry-payment is safe to build now; 3 other actions need scoping) |
| RD-09 | Vendor sees raw enum status text ("PAYMENT ATTENTION") instead of the label map that's already used one line away |
| RD-10 | Vendor can't capture a pause reason/expected-return date, though both are fully supported end-to-end elsewhere |
| REQ-CB-P-008 | Participant fulfilment tracker: endpoint and label map already exist and are unused — one-file fix |
| CBO-13 | Organiser has no live progress visualization for a healthy LIVE campaign — only appears once already in crisis |
| CBA-06 | `escalateRefund()` isn't idempotent — a reload + re-click creates a duplicate support case |
| CBA-09 | `pause()`/`resume()` (admin campaign controls) never notify the organiser, unlike every sibling action |
| REQ-CB-A-002 | Admin cannot edit campaign financial terms — needs an explicit client yes/no on overriding the organiser lock |
| NOTIF-08 | Support-case customer-visible responses never notify the customer at all |
| NOTIF-DUP-01 | 4 event types (renewal reminder, price-approval, campaign milestone, campaign refund update) send 2 pushes for 1 event |
| NAV-04 | All 4 payout lifecycle notifications (requested/approved/rejected/paid) are dead taps |
| NAV-05 | Escrow auto-release notification is a dead tap; delivery-confirmed fires a masked duplicate push |
| NAV-08 | Community Buy organiser-directed events (admin_cancelled, cancelled, rescue_opened, extension_approved, succeeded, failed, supplier_declined, fulfilment_update) misroute to the read-only participant screen — includes the single most time-sensitive one (supplier declined) |
| NAV-10 | 4 of 12 Automation push types (buyer win-back, campaign milestone/deadline/refund-update) are dead taps for buyers, with no fallback |
| MKT-03 | Regular Delivery entry point on vendor Home is not market-gated (Community Buy's identical adjacent code is) — vendor can build a "dead" offer catalog with no warning |
| SEC-01 | Public, unauthenticated market-config endpoints return commercially sensitive fields (fee %, live/test payment mode) far beyond what feature-gating needs |
| UX-07 | Accessibility label coverage ~35%, directly contradicting the redesign plan's own "every new interactive element" commitment — 0% on all 3 Automation Centre screens and 8/10 buyer Community Buy screens |
| REG-01 | One backend test timed out (dispute-resolution) — needs isolation/triage before being dismissed as flaky |
| REG-05 | Buyer Home screen (100% of buyer sessions) now has a new concurrent, unbounded fetch dependency on Community Buy backend health — highest regression-risk surface found |

**26 P1 items total** (22 listed above by ID; 4 more are variants/duplicates of the same underlying issue tracked once under their canonical ID — see the requirements matrix for AUTO-04 pairing with AUTO-01/AUTO-02's related config gaps, counted individually there).

---

## P2 — Polish / lower urgency

Grouped by theme; full detail in the requirements matrix.

- **Automation copy/UX polish (7):** AUTO-01 (2 client-named automations missing/merged — needs decision), AUTO-02 (comment inaccuracy), AUTO-09 (inconsistent pause confirmation), AUTO-10 (no "0 eligible" state — needs decision), AUTO-11 (generic error copy), AUTO-17 (config-cadence mismatch), AUTO-18 (stale disabled `RENEWAL_REMINDER` edge case)
- **Regular Delivery polish (4):** RD-01 (product-first ordering + review step), RD-02 (MONTHLY calendar-math nuance — needs decision), RD-07 (vendor pause confirmation/labeling), RD-11 (already fixed, no action)
- **Community Buy Participant polish (7):** CBP-09 (cross-market browsing — needs decision), REQ-CB-P-003 (disclosure not on first screen), REQ-CB-P-004 (Target£ vs. Goal-shares linkage), REQ-CB-P-006 (milestone badges — needs decision), REQ-CB-O-001/CBO-05 (product picker — needs decision), REQ-CB-O-005 (trackable invites — needs decision), REQ-CB-P-007 (rescue date missing from detail screen), CBP-11 (no self-service pledge cancellation — new capability idea)
- **Community Buy Organiser/Supplier polish (3):** CBO-03 (no terminal "rejected" verification state), CBO-09 (fulfilment method not named until late), CBS-07 (no prep-time date field)
- **Community Buy Admin polish (2):** CBA-01 (Approve dialog overstates effect; Request-changes missing confirm — see also CBA-12 FAIL), REQ-CB-A-003 (force-refund — needs client/finance scoping)
- **Notifications polish (2):** NOTIF-INAPP-01 (in-app list dead taps for payout/stock/verification categories), NAV-07/NAV-09 (dead helper code; one narrow supplier misroute)
- **Market/currency polish (2):** MKT-06 (frontend currency pickers omit CHF, include non-launch African currencies — display-only)
- **UX/Accessibility polish (5):** UX-01 (regex-based status prettifying, one latent non-global-replace bug), UX-06 (admin dispute resolution has no confirm dialog), UX-08 (no Dynamic Type opt-out, but no size caps either), UX-09 (sub-44pt touch targets, systemic pre-existing pattern), UX-10 (missing KeyboardAvoidingView on several forms)
- **CBA-17** (extension-rejection doesn't notify organiser) — actually P2 given lower frequency than pause/resume.

**34 P2 items total** (see requirements matrix for the complete, itemized list — every PARTIAL/MISSING/BLOCKED item not listed under P0/P1 above is P2).

---

## Security Findings

### SEC-01 — Public MarketConfiguration endpoints over-expose fields (Medium severity)
`GET /api/community-buy/markets` and `/markets/:country` are genuinely unauthenticated and return every column of `MarketConfiguration` — not just the feature-gating flags the mobile app actually needs. Exposed: `organiserFeeBps`/`communityBuyFeeBps` (Eki's commission rate), `paymentMode` (reveals which markets have real money live vs. test), `paymentProvider`/`identityProvider`, `supplierReleasePolicy`, legal/refund-terms version strings, campaign duration/value limits, and internal row metadata.
**No credentials, secrets, tokens, or PII are exposed** — this is a least-privilege/over-fetching issue, not an account-takeover or fraud vector. But commercially sensitive configuration (fee rates, live-money-market status) is trivially readable by any unauthenticated party with one GET request.
**Recommended fix:** Restrict the public response to exactly `countryCode, currency, communityBuyEnabled, communityBuyPaymentsEnabled, organiserApplicationsEnabled, supplierApplicationsEnabled, regularDeliveriesEnabled` via a `select`/mapper, matching the endpoint's own documented purpose.
**Severity: P1.** Not implemented during this audit per instructions — audit only.

No other security findings rose to the level of a distinct entry — authorization/permission layering across the Community Buy admin surface (CBA-13, CBA-14, CBA-16), vendor market-registration rejection (MKT-04), and the Africa-exclusion safety mechanism (MKT-07) were all independently verified sound with passing tests.

---

## UX Findings (summary — see matrix for full detail)

- **Accessibility labeling (UX-07, P1):** ~35% coverage across buyer+vendor screens; 0% on every Automation Centre screen and most Community Buy screens — directly contradicts the redesign plan's own written commitment.
- **Touch targets (UX-09, P2):** `hitSlop` used once in the entire app; a 38×38pt header-back-button pattern reused across nearly every new screen falls short of the 44×44pt guideline.
- **Keyboard safety (UX-10, P2):** Several multi-field forms (organiser campaign creation — 10 fields, RD offer creation — 6-7 fields, plus two pre-existing core vendor tools) have no `KeyboardAvoidingView` at all.
- **Dynamic Type (UX-08, P2):** No explicit opt-out (good), but 1,230 fixed-pixel font sizes with zero `maxFontSizeMultiplier` caps — real clipping risk at large accessibility text sizes, unverified without a device.
- **Raw enum rendering in core screens (UX-01, P2):** Orders, Disputes, and several admin-web pages use regex-prettified enum text rather than real label maps — functional but unlocalized; one latent bug (non-global `.replace()`) could break on a future multi-underscore status value.
- **Positive findings:** No fake/hardcoded metrics found anywhere (UX-02); empty/loading/disabled states are consistently well-built across every screen sampled (UX-03/04/05); destructive-action confirmations are solid outside one admin gap (UX-06).

All device-dependent claims (VoiceOver reading order, actual Dynamic Type rendering, real tap-area misses, actual keyboard overlap) are explicitly marked DEVICE-ONLY in the matrix and were **not** tested on a physical device during this audit — see the Manual QA Plan.

---

## Backend Findings (summary)

- **Two genuinely new, serious defects** found nowhere in any prior audit: the Automation cron/quiet-hours collision (AUTO-16) and the general vendor payout idempotency/failure-state gap (PAY-05). Both are backend logic bugs, not documentation gaps.
- **The recurring notification-routing bug class** (NAV-04 through NAV-10) is a backend/frontend contract problem — the backend introduces a new `data.type`/eventKey with no corresponding, enforced frontend contract, and this has already happened at least 5 times before this audit found 7 more instances (REG-06).
- **Everything else checked in Payments/Refunds/Ledger is genuinely solid**: real Stripe integration throughout, correct PLEDGE_THEN_CHARGE semantics, real per-contribution independent charge handling, real duplicate-payment anomaly scanning, real double-entry ledger with real Stripe-side reconciliation (Paystack reconciliation is an honest, disclosed `501` stub, not fabricated).
- **Community Buy Admin backend (Phase 9) is largely solid**: correct permission/2FA/four-eyes layering, complete audit trail, idempotent refund-recheck and supplier-payment-release logic. The two real gaps (CBA-06 escalate-not-idempotent, CBA-09 pause/resume not notifying) are both small, contained fixes.
- **Community Buy Supplier backend is fully built** — the source docs' claim that supplier decline/reassignment was "the one genuine missing capability in this whole engagement" is confirmed false; it is complete, tested, and working end-to-end.

---

## Remaining Product/Client Decisions Required

These items cannot be responsibly built without an explicit client answer — flagged, not built, per this audit's scope:

1. **AUTO-01** — Are "Reorder Reminders" and a distinct "Checkout Payment Follow-Up" (vs. the merged Regular-Delivery-payment-recovery type) actually wanted as separate automations?
2. **AUTO-10** — Is a live "0 buyers eligible right now" state wanted, requiring a new query, or is the current activity-history-based empty state acceptable?
3. **RD-02** — Should MONTHLY use true calendar-month arithmetic (28-31 days) instead of a flat 30-day approximation?
4. **RD-05** — Is post-subscribe frequency editing required, or is cancel-and-resubscribe acceptable?
5. **RD-08** — Beyond retry-payment (safe to build now), should admin be able to approve/deny a price change or force-cancel a subscription *on a buyer's behalf*? What notice/consent applies?
6. **REQ-CB-P-006** — What exact percentage thresholds (if any) should progressive milestone badges use?
7. **REQ-CB-O-001 / CBO-05** — Should campaigns require a real catalog product (schema change), or is free-text description the intended design?
8. **REQ-CB-O-005** — Is a trackable invite-link system actually wanted, or does the generic OS share sheet satisfy "invite participants" as originally worded?
9. **REQ-CB-A-002** — Should admin be able to override the same financial-terms lock that applies to organisers?
10. **REQ-CB-A-003** — Should a "force refund" admin action exist at all, given real ledger-reconciliation implications?
11. **CBO-03** — Should organiser/supplier verification have a formal terminal "rejected" state, or does indefinite "under review" suffice?
12. **PAY-10** — Are Paystack/Domestic-Africa-Escrow orders in scope for this launch? If yes, Paystack reconciliation/transfer-verification must be built first (currently an honest stub).
13. **MKT-07 (informational, not a defect)** — Should admin ever be able to enable a brand-new market (African or otherwise) without an engineering deploy? Current behavior requires one, which this audit considers the safer default — flagging only because it's a deliberate design choice worth the client explicitly endorsing.

---

## Final Tallies

| Metric | Count |
|---|---|
| **Total requirements/findings audited** | **148** |
| PASS | 84 |
| PARTIAL | 32 |
| FAIL | 19 |
| MISSING | 10 |
| BLOCKED-CLIENT-DECISION | 3 |
| **P0 (critical)** | **4** |
| **P1 (significant)** | **26** |
| **P2 (polish/lower urgency)** | **34** |

**Files created by this audit:**
- `FINAL_CLIENT_GAP_AUDIT.md` (this file)
- `FINAL_CLIENT_REQUIREMENTS_STATUS.md`
- `FINAL_MANUAL_QA_PLAN.md`

No application code, migrations, or configuration was modified. No commits were made. Nothing was pushed. Regular Delivery Admin remediation and every other flagged gap remain unimplemented, as instructed.
