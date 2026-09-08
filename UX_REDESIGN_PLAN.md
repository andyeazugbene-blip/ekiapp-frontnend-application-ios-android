# UX_REDESIGN_PLAN.md

This is the forward-looking design plan built on `CLIENT_REQUIREMENTS_MATRIX.md` and `UX_REDESIGN_AUDIT.md`. It does not repeat their evidence — it states what to build, in what order, and how to verify it.

**Governing principle, repeated throughout:** this is an extension of Eki, not a rebuild. Every recommendation below preserves existing working functionality, reuses existing components wherever one already fits, and treats visual consistency as something to converge toward gradually — not a reason to touch a screen that isn't otherwise part of this work.

---

## 0. FULL USER JOURNEYS (current state → target state)

Each journey below follows the same 14-stage skeleton the client specified, noting explicitly where a stage is currently broken, missing, or fine as-is. "Target state" describes the fix; it does not repeat backend/API detail already in the matrix.

### 0.1 BUYER (general marketplace, not Community-Buy-specific)

| Stage | Current state | Target state |
|---|---|---|
| Entry point | Home tab | Unchanged |
| Discovery | Product/vendor browsing, explore tab | Unchanged — already works well |
| Decision | Product detail, add to cart | Unchanged |
| Configuration | Quantity, variant selection | Unchanged |
| Review | Cart screen | Unchanged |
| Confirmation | Checkout, saved address, payment | Unchanged — already redesigned earlier this engagement (non-destructive currency switching, real address flow) |
| Processing | Payment processing state | Unchanged |
| Success | Order confirmation | Unchanged |
| Ongoing management | Order tracking, messages | Unchanged |
| Edit | N/A (orders aren't editable post-placement by design) | Unchanged |
| Pause/skip/cancel | N/A for one-off orders | Unchanged |
| Failure/recovery | Payment failure retry, delivery-unavailable screen | Unchanged |
| Completion | Delivery confirmation, review prompt | Unchanged |

**This journey is not part of the redesign scope** — it's included here only for completeness and to confirm nothing here needs touching.

### 0.2 VENDOR (general dashboard + Business Tools discovery)

| Stage | Current state | Target state |
|---|---|---|
| Entry point | Dashboard hero | Unchanged |
| Discovery | "Business Tools" section: Automation Center, Regular Deliveries, and (conditionally) Community Buy | Add a visible, disabled/informational row for Community Buy even in markets where it's off, so a vendor learns the feature exists rather than the section silently shrinking to 2 rows (P2 — see §2) |
| Decision | Vendor taps into a tool | Add category grouping inside Automation Centre specifically (§3) |
| Configuration | Per-tool, see §3–5 below | See below |
| Review | Varies by tool | See below |
| Confirmation | Varies | See below |
| Processing | Varies | See below |
| Success | Varies | See below |
| Ongoing management | Varies | See below |
| Edit | Varies | See below |
| Pause/skip/cancel | Varies | See below |
| Failure/recovery | Varies | See below |
| Completion | Varies | See below |

### 0.3 PARTICIPANT (Community Buy, buyer role)

| Stage | Current state | Target state |
|---|---|---|
| Entry point | Profile menu or push notification only | **P0 fix:** real Home-screen entry point, market-gated (REQ-CB-P-001) |
| Discovery | Discovery screen with market filter + campaign cards | Keep as-is; benefits automatically once entry point exists |
| Decision | Campaign detail screen | **P0 fix:** add "how it works" + move financial disclosure earlier (REQ-CB-P-002/003) |
| Configuration | Quantity picker | Keep as-is |
| Review | Implicit in the pledge flow | Keep as-is (already reasonably clear) |
| Confirmation | Pledge/payment confirm screen | Keep as-is — copy already accurate |
| Processing | Payment processing state | Keep as-is |
| Success | "Pledge recorded" / "Payment confirmed" states | Keep as-is |
| Ongoing management | My Community Buys dashboard, campaign screen | Add milestone markers (P2), rescue countdown (P2) |
| Edit | N/A (a pledge quantity isn't editable post-commitment by design — confirm this is intentional, not audited as a gap since no requirement named it) | Unchanged pending confirmation |
| Pause/skip/cancel | N/A (participation isn't recurring) | Unchanged |
| Failure/recovery | Payment-failed states, refund status labels | **Fix the FAILED-outcome copy contradiction first** (REQ-CB-P-005) before any further refund-copy work |
| Completion | Fulfilment tracking | **P1 fix:** reuse the existing organiser/supplier tracker in read-only form (REQ-CB-P-008) |

### 0.4 ORGANISER (Community Buy, buyer role)

| Stage | Current state | Target state |
|---|---|---|
| Entry point | Vendor dashboard (cross-role, needs a transition cue — REQ-GLOBAL-002) or buyer Profile menu | Add the transition cue (§2); buyer-side entry unchanged |
| Discovery | N/A (organiser applies once, then manages campaigns directly) | Unchanged |
| Decision | Campaign-creation form | Add fee disclosure (REQ-CB-O-003), native date picker (REQ-CB-O-006) |
| Configuration | Min/goal/max/price/deadline/supplier selection | Pending scoping: product picker (REQ-CB-O-001) |
| Review | Implicit — form fields are simply submitted | Consider a lightweight review step before "Submit for review" given the number of financial fields being locked in (P2, not currently blocking) |
| Confirmation | "Submitted" alert | Keep as-is |
| Processing | Awaiting admin review; "Waiting for supplier" state | Keep as-is — these are already honest, real states |
| Success | Approved → Live | Keep as-is |
| Ongoing management | Participant list, campaign updates, extension requests | Add supplier-update visibility if supplier update-posting ships (participant list already shows both) |
| Edit | Title/description only, while live | Correct as designed (financial terms locked) — no change recommended without a specific client ask |
| Pause/skip/cancel | Pause/Resume (before rescue), End Campaign (rescue-only) | Pending confirmation: allow top-up at any LIVE stage, not only rescue (REQ-CB-O-004) |
| Failure/recovery | FAILED-outcome banner | **Fix the copy contradiction first** (REQ-CB-P-005 applies identically here) |
| Completion | Fulfilment step tracker | Keep as-is — already correct and complete for this role |

### 0.5 SUPPLIER (Community Buy, vendor role)

| Stage | Current state | Target state |
|---|---|---|
| Entry point | Vendor dashboard Business Tools | Unchanged |
| Discovery | "Assigned campaigns" list | Expand card or add detail view to show description/deadline/organiser (REQ-CB-S-002) |
| Decision | Only "Confirm supply commitment" exists | **Add a real Decline action** (REQ-CB-S-001) — genuine new capability, not a display fix |
| Configuration | Fulfilment method + notes | Keep as-is |
| Review | N/A | Add as part of the expanded detail view above |
| Confirmation | "Confirm inventory" | Keep as-is |
| Processing | Step tracker (Confirmed → Packing → Ready → Dispatched) | Keep as-is — well built |
| Success | Dispatched/Collected marked | Keep as-is |
| Ongoing management | No update-posting capability | **Add update-composer** reusing the organiser's existing pattern (REQ-CB-S-003) |
| Edit | Fulfilment plan editable before locking | Keep as-is |
| Pause/skip/cancel | N/A once committed (by design — a supplier who over-commits has a real supply obligation) | Unchanged; Decline (above) is the correct pre-commitment "out" |
| Failure/recovery | Payment card shows Failed/On-hold with reason | Add placeholder state before a payment record exists (REQ-CB-S-004) |
| Completion | Payment released | Keep as-is |

### 0.6 ADMIN (across Automation, Community Buy, Regular Delivery)

| Stage | Current state | Target state |
|---|---|---|
| Entry point | Admin nav sections | Fix stale "Escrow" label (REQ-GLOBAL-004) |
| Discovery | Review queues, monitoring lists | Add manual refresh (REQ-CB-A-005); render unused fetched fields (REQ-CB-A-006) |
| Decision | Approve/reject/pause/resume/etc. | **Add confirmation to every currently-unconfirmed destructive action** (REQ-CB-A-001) — the single highest-value fix in the entire admin surface |
| Configuration | Market feature flags, fee rates | Add confirmation to flag toggles specifically (part of REQ-CB-A-001) |
| Review | Campaign review queue | Keep as-is — already well built |
| Confirmation | (currently missing in most places — see Decision) | See above |
| Processing | N/A (admin doesn't process, it acts on already-processing things) | — |
| Success | Approved/verified states | Keep as-is |
| Ongoing management | Live-campaign monitoring, refunds, support cases | Add contribution-record lookup (REQ-CB-A-004) |
| Edit | No campaign edit exists | Scope and add (REQ-CB-A-002), pending financial-lock decision |
| Pause/skip/cancel | Pause/Resume exist; no cancel/end exists | Scope and add cancel (REQ-CB-A-002) |
| Failure/recovery | Refund recheck/escalate only, no force-refund; Regular Delivery exceptions are fully read-only | **Add real remediation actions to the Regular Delivery exception queue** (REQ-CB-A-007) — the most operationally serious gap found in this whole audit |
| Completion | Audit log (platform-wide, not Community-Buy-scoped) | Consider a campaign-ID search/filter on the existing audit log rather than a new page (P2) |

---

## 1. INFORMATION ARCHITECTURE

No change to the top-level architecture (buyer/vendor/admin as three separate apps/panels is correct and unquestioned). Changes are additive within the existing structure:

- **Buyer Home** gains one new conditionally-rendered section (Community Buy entry point) and one new header icon (notifications bell), matching patterns that already exist elsewhere in the app.
- **Vendor dashboard's Business Tools** section gains a visible-but-informational Community Buy row in markets where it's disabled (rather than silently omitting the row), so the section's shape doesn't change based on market — only its contents' enabled state does.
- **Automation Centre** gains an internal grouping layer (categories) — no new top-level route.
- No new bottom tabs on either buyer or vendor navigators. No existing tab is removed or renamed. This directly satisfies the client's explicit bottom-navigation requirement from the prior engagement round (already verified correct and unchanged by this work).

## 2. NAVIGATION CHANGES

- Buyer Home: + Community Buy section, + notifications bell (both additive, no restructuring of existing sections).
- Vendor dashboard: Business Tools section always shows 3 rows (Automation, Regular Deliveries, Community Buy), with Community Buy shown in a visually distinct "not available in your market" state rather than being hidden — preserves the backend-authoritative gate (never a live CTA into a disabled feature) while fixing the discoverability half of REQ-GLOBAL-002/vendor dashboard findings.
- Vendor → Organiser cross-role hop: add a header context cue on arrival at `(buyer)/community-buy-organiser` when reached from a vendor context (a query param or navigation state flag is sufficient — no route restructuring needed).
- No change to hidden-route (`href: null`) screen counts or bottom-tab sets — confirmed both are already correct per the client's own prior requirement and this audit found no violation to fix.

## 3. AUTOMATION REDESIGN

1. Group the 9 vendor automation types into categories on the Automation Centre list (Sales recovery: First Sale, Cart Recovery, Buyer Win-Back; Buyer relationship: Referrals, Review Requests; Store health: Low-Stock Alerts; Regular Delivery operations: Payment Recovery, Renewal Reminders, Price Approval Reminders). This is a pure grouping/label change — no automation is moved, renamed, or merged at the data level.
2. Add a trailing value indicator to list rows that have a real setting (currently just Cart Recovery / Buyer Win-Back's 3-chip preset) so the list itself signals "these are configurable" without opening the detail screen.
3. Add an "Eligibility" section to the detail screen for every type, written from the real backend logic (requires reading `automation.service.ts`'s actual scheduling functions before writing copy — never guessed).
4. Add recipient (buyer name) to Activity rows and the tap-through modal.
5. Add a third, visually distinct Suppressed status treatment to Activity, surfacing `suppressedReason` on tap.
6. Resolve REQ-AUTO-002's scoping question with the client (Reorder Reminders, Review Referral Offer, Payment-Recovery split) before any new `AutomationType` work — this plan does not commit to new automation types until that's confirmed.
7. Add a lightweight confirmation before deactivating an automation with recent activity (mirrors the general confirmation principle applied elsewhere in this plan).

## 4. REGULAR DELIVERY REDESIGN

1. Reorder the existing vendor offer-creation form's sections: foodstuff selection moves before pricing/fulfilment rules.
2. Add a compact review summary directly above the primary action button.
3. Change the primary button to "Create and publish offer" (combining today's two separate steps into the default path), keeping "Save as draft" as a clearly secondary option.
4. Fix the buyer subscription-detail screen's status rendering to use the existing `STATUS_LABEL` map instead of raw `.replace()` — eliminates the "PAYMENT ATTENTION" bug immediately.
5. Add a dedicated stock-wait card to the buyer detail screen, matching the existing price-approval/payment-failure card treatment.
6. Add substitution-policy and fulfilment-method info rows to both the buyer offer-preview screen (before subscribing) and the subscription-detail screen (after).
7. Add an optional "Resume on" date to the Pause action.
8. Relabel the vendor's offer-level pause action to be scope-explicit ("Pause renewals for all subscribers") and add a confirmation dialog to it.
9. Resolve the "Every 4 weeks" frequency question with the client before any schema work — this plan does not commit to a new `SubscriptionFrequency` enum value until intent (fixed 28-day cycle vs. calendar semantics) is confirmed.

## 5. COMMUNITY BUY REDESIGN

**Participant:**
1. Add a Home-screen entry point, market-gated.
2. Add a persistent/first-time "how it works" explainer.
3. Move the existing, accurate financial-disclosure copy up onto the campaign detail screen (decision-stage), keeping the existing confirm-stage copy too.
4. Add a rescue-window countdown, reusing data already computed for the organiser.
5. Reuse the existing fulfilment step-tracker component in read-only form for participants once a campaign succeeds.
6. Do not touch the FAILED-outcome copy on either participant or organiser screens until the underlying refund mechanics are verified against the real `campaign-contributions.service.ts` logic — this is a blocking prerequisite, not a parallel task.

**Organiser:**
1. Add a real fee-disclosure line to the campaign-creation form.
2. Replace both raw-text deadline fields (creation + extension request) with a native date picker.
3. Resolve product-picker (REQ-CB-O-001) and top-up-scope (REQ-CB-O-004) questions with the client before building either.

**Supplier:**
1. Expand the campaign card or add a detail view showing description, deadline, and organiser identity.
2. Add a real Decline action with a reason field and organiser-facing consequence messaging (genuine new backend logic required — flagged clearly as such, not treated as a simple UI add).
3. Add an update-composer, reusing the organiser's existing implementation, since the backend already models `SUPPLIER` as a valid update author.
4. Add a placeholder state to the payment card for the pre-payment-record period.

**Admin:**
1. Add confirmation dialogs to every currently-unconfirmed action across `community-campaigns`, `community-refunds`, `community-verification`, `community-support-cases`, and `community-markets` pages — reuse the `confirm()` pattern already correctly used elsewhere on these same pages (Reject already does this).
2. Render `rescueEndsAt`, `extensionCount`, `reviewNotes`, `paidTotal`, `targetAmount` on the campaign monitoring cards.
3. Add a manual refresh control to the live-campaign list.
4. Add a per-campaign contribution-record view.
5. Scope and add campaign edit/cancel capability with the client before building (financial-lock interaction needs a real decision).
6. Fix the stale "Escrow" nav label.
7. Scope and add real remediation actions to the Regular Delivery exception queue (this is Section 6 territory but grouped here since it's the same "admin needs to actually be able to act" principle) — treat as its own workstream given its size and the financial-safety considerations involved.

## 6. COMPONENT REUSE PLAN

The single biggest efficiency opportunity in this whole plan: most of what's "missing" already exists as a working component two screens away.

| Existing component | Currently used by | Reuse target |
|---|---|---|
| Fulfilment step tracker | Organiser, Supplier | Participant (read-only variant) |
| Update-composer | Organiser | Supplier |
| `STATUS_LABEL` map (Regular Delivery) | Buyer list screen | Buyer detail screen (fixes the raw-enum bug) |
| `confirm()` dialog pattern | Vendors/Users/Roles/Disputes/Reject-campaign admin pages | Every other Community Buy admin action |
| Vendor dashboard notification bell | Vendor Home header | Buyer Home header |
| Vendor dashboard market-gate check (`communityBuyEnabled`) | Vendor Business Tools | Buyer Home Community Buy section |
| Price-approval / payment-failure card pattern | Buyer Regular Delivery detail | New stock-wait card (same visual family, new copy) |
| `PremiumBlocks.tsx` primitives (`EmptyState`, `ErrorState`, `StatusPill`, `FloatingCard`, etc.) | 19 Automation/RD/CB files | Promote to shared barrels; available app-wide going forward |

## 7. NEW COMPONENTS REQUIRED

- `AutomationEligibilityCard` — per-type eligibility explanation.
- `AutomationCategorySection` — grouped list wrapper for Automation Centre.
- `SubstitutionPolicyRow` / `FulfilmentMethodRow` — small info-row components, Regular Delivery.
- `StockWaitCard` — new card variant, visually consistent with existing price-approval/payment-failure cards.
- `CommunityBuyHowItWorksSection` — explainer component, participant-side.
- `RescueCountdown` — small countdown element.
- `ReadOnlyFulfilmentTracker` — a read-only wrapper around the existing tracker's rendering (not a rebuild).
- `FeeDisclosureRow` — organiser creation form.
- `SupplierDeclineDialog` — new decline flow, supplier side.
- `AdminConfirmAction` — thin wrapper standardizing the confirm-before-action pattern for admin buttons, to make future consistency easier to maintain (optional convenience, not required to ship the fix — plain `confirm()` calls, matching the existing precedent on the same pages, are sufficient on their own).

No new bottom-sheet library, no new design system, no new navigation pattern.

## 8. SCREENS TO MODIFY

`automation-center.tsx`, `automation-detail.tsx`, `automation-activity.tsx`, `regular-delivery-offer-edit.tsx`, `regular-delivery-detail.tsx` (buyer), `regular-delivery-offer.tsx` (buyer), `regular-deliveries.tsx` (vendor — pause-label/confirmation), `app/(buyer)/index.tsx` (Home — new section + bell), `app/(vendor)/index.tsx` (Business Tools row visibility), `community-buy.tsx`, `community-buy-campaign.tsx`, `community-buy-organiser-campaign.tsx`, `community-buy-supplier.tsx`, `community-buy-supplier-fulfilment.tsx`, admin `community-campaigns/page.tsx`, `community-refunds/page.tsx`, `community-verification/page.tsx`, `community-support-cases/page.tsx`, `community-markets/page.tsx`, `subscription-exceptions/page.tsx`, `AdminLayout.tsx` (nav label fix).

## 9. SCREENS TO CREATE

None at the top-level route/screen granularity — every gap identified is addressable via new sections/components within existing screens, or (for admin Regular Delivery oversight, REQ-CB-A-007) possibly one new admin page for a vendor-offers/subscriber catalog if the exception-queue-plus-actions approach proves insufficient once scoped with the client. No new buyer or vendor mobile screens are required.

## 10. SCREENS TO REMOVE/MERGE

None. No duplicated screens were found in this audit that warrant removal — the two Community Buy entry surfaces for vendors (Supply vs. Organize) are legitimately different roles/flows, not accidental duplication, and both should remain.

## 11. STATE MODEL

For every feature area, the following states must be distinctly representable in the UI (not merely possible in the data model):

- **Automation (per type):** Not configured / Active-no-recent-activity / Active-with-activity / Suppressed (with reason) / Failed (with reason) / Deactivated.
- **Regular Delivery offer (vendor):** Draft-unpublished / Published-active / Paused (all subscribers) / Individual product paused (with reason + expected return, once REQ-RD's product-pause gap is closed).
- **Regular Delivery subscription (buyer):** Active / Paused (indefinite or until-date) / Payment attention / Awaiting stock / Awaiting price approval / Cancelled / Expired.
- **Community Buy campaign (all roles, role-appropriate framing of the same underlying status):** Draft / Under review / Changes required / Live / Rescue window (with time remaining) / Succeeded (goal or minimum, distinctly labeled) / Failed / Refunding / Fulfilling / Completed / Financially closed / Cancelled.
- **Supplier commitment:** Invited/pending (once Decline exists) / Committed / Declined (new) / Fulfilling / Completed.
- **Admin action confirmation:** Idle → Confirming → In-flight → Success/Failure, consistently, for every action identified in REQ-CB-A-001.

## 12. EMPTY / ERROR / LOADING STATES

- Continue using `PremiumBlocks.tsx`'s `EmptyState`/`ErrorState`/`LoadingBlock` pattern for every screen touched in this redesign (already the correct, honest, non-fabricating pattern — confirmed no fake data in any empty/loading state audited).
- Add the specific new empty/placeholder states identified: "no eligible buyers right now" (automation), "payment will appear once fulfilment is confirmed" (supplier), stock-wait explanation (buyer Regular Delivery).
- Any new admin confirmation dialog must have its own loading state during the in-flight request (disable the button, show a spinner) — do not allow a second click to double-fire an action like a supplier-payment release.

## 13. ACCESSIBILITY REQUIREMENTS

- Every new interactive element (category section headers, value chips, decline buttons, date pickers) needs a real `accessibilityLabel`/`accessibilityRole`, matching the standard already set by the existing Regular Delivery action buttons (confirmed these already carry proper roles).
- Status pills conveying meaning through color alone (e.g. a new Suppressed state) must also carry it in text, not color alone — the existing pattern (text label + color) already does this correctly and must be preserved for any new status added.
- Native date pickers (replacing raw text fields) are themselves an accessibility improvement over free-text date entry — this redesign item directly serves accessibility, not just ergonomics.
- Confirmation dialogs must trap focus appropriately and be dismissible via the platform's standard back gesture/escape, consistent with existing `Alert.alert` usage patterns already in the app.

## 14. MOBILE INTERACTION PATTERNS

- Continue using native `Alert.alert` for confirmations on mobile (the existing, consistent pattern for the 21 files already doing this correctly) — do not introduce a new custom confirmation-modal component for mobile when the native pattern already works and is already used correctly elsewhere.
- Continue using native date/time pickers where the platform provides one, rather than custom-built pickers, for the deadline-field fixes.
- Keep single-scroll forms for Regular Delivery offer creation (no wizard/stepper needed) — the content is simple enough for one screen; a multi-step wizard would add navigation overhead without a corresponding clarity benefit, and was not requested.
- Bottom-sheet-style modals: continue the existing ad hoc `Modal` pattern for any new sheet-like UI in this redesign rather than introducing a new shared `BottomSheet` component mid-redesign — that consolidation (noted in the audit as a real but separate finding) is a candidate for a future, dedicated pass, not bundled into this one.

## 15. IMPLEMENTATION ORDER

Sequenced by (a) blocking dependencies, (b) risk (fix-only-what's-broken items before scope-pending items), and (c) value-per-effort (pure display fixes on already-correct backend logic first).

**Wave 1 — Verify before building anything else:**
1. Resolve REQ-CB-P-005 (FAILED-campaign refund copy contradiction) against real backend logic. Nothing else in Community Buy's refund/failure copy should change until this is settled.

**Wave 2 — Zero-risk display fixes on already-correct backend data (highest value, lowest risk):**
2. Automation: Suppressed-status visibility, recipient in Activity.
3. Regular Delivery: fix the raw-enum "PAYMENT ATTENTION" bug; add substitution-policy/fulfilment-method/stock-wait visibility to the buyer.
4. Community Buy: reuse the fulfilment tracker for participants; add fee disclosure for organisers (once the one supporting field is confirmed/added); add update-composer for suppliers.
5. Admin: add confirmation dialogs everywhere identified in REQ-CB-A-001 (this alone addresses the single largest cluster of findings in the entire audit, at near-zero implementation risk since it reuses an existing, proven pattern from the same pages).
6. Admin: render the five unused fetched fields on the campaign monitoring page; fix the stale "Escrow" nav label.

**Wave 3 — Real UX/flow restructuring, still low backend risk:**
7. Community Buy: add the Home-screen entry point for participants; add "how it works" and move the financial disclosure earlier; add rescue countdown.
8. Regular Delivery: reorder and consolidate the vendor offer-creation flow (foodstuff-first, combined create+publish, review summary).
9. Automation: category grouping + eligibility explanations on the detail screen.
10. Vendor dashboard: always-visible-but-gated Community Buy row; cross-role navigation transition cue.
11. Buyer Home: notifications bell.

**Wave 4 — Genuine new capability (needs its own backend design, not just frontend work):**
12. Supplier Decline/reject action.
13. Admin Regular Delivery remediation actions (highest operational priority in this wave, given it's a live money feature with currently zero admin recourse).
14. Admin campaign contribution-record view.

**Wave 5 — Needs client scoping before estimation, do not build speculatively:**
15. "Every 4 weeks" frequency (confirm intent).
16. Reorder Reminders / Review Referral Offer / payment-recovery split (confirm intent).
17. Organiser product picker; top-up-scope widening; admin campaign edit/cancel; force-refund capability.
18. Design-system consolidation (`PremiumBlocks.tsx` → shared barrels) — apply opportunistically to screens already being touched by the waves above, rather than as a standalone pass, to avoid unnecessary churn on screens this engagement doesn't otherwise need to open.

## 16. QA PLAN

See `UX_REDESIGN_PLAN.md` §0 journeys for the full state-by-state walk to re-test after each wave. In addition to normal typecheck/build/regression-script passes (which verify the code runs, not that it's usable), every wave above must be closed out against the acceptance standard stated in the client's own brief:

> "Can a first-time user understand: where they are, what this feature does, what happens next, what choices they have, what has already happened, how to change their decision, how to recover from an error, how to leave/cancel safely?"

Concretely, for each wave:
- **Wave 1:** Confirm the real refund mechanics with a traced test (a campaign that fails below minimum, with at least one prior contribution) before writing a single word of new copy.
- **Wave 2:** For each fixed screen, verify the specific bug is gone (no more raw enum strings, Suppressed runs visible, recipient visible) using real data, not a mock.
- **Wave 3:** Full journey walk-through per §0 for Participant and Vendor roles specifically, on a real device, checking every state named in §11 (loading/empty/success/error/paused/cancelled/unavailable/payment-pending/payment-failed/permission-denied/unsaved-changes/stale-data), plus accessibility and small-screen checks per the client's Phase 10 requirement.
- **Wave 4:** Full journey walk-through for Supplier and Admin roles, plus a specific test of the Decline flow's downstream effect on the organiser's experience (does the organiser actually find out, clearly, that they need to pick a new supplier).
- **Wave 5:** Each item re-enters this same QA process only after its scoping question is answered and it's been through Waves 1–4's design discipline — do not fast-track anything here just because it was requested; scope-pending means design-pending, not skip-the-audit.

**Do not mark any wave complete because TypeScript/build/tests pass.** Passing tests confirm the code runs; they do not confirm a first-time user understands it. Each wave's sign-off requires a real walk-through against the acceptance standard above, on a real device, by someone approaching the flow as a first-time user — not the person who just built it.
