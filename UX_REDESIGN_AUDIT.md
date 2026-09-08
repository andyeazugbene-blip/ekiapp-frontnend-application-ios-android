# UX_REDESIGN_AUDIT.md

Per-screen UX audit. Cross-referenced against `CLIENT_REQUIREMENTS_MATRIX.md` (REQ-IDs noted where applicable) and `CLIENT_TO_SCREEN_TRACEABILITY.md`. Every finding here was directly observed in the current codebase — nothing is speculative.

Priority key: **P0** = blocks core usability. **P1** = major UX problem. **P2** = improvement. **P3** = polish.

---

## SCREEN: Automation Centre (`app/(vendor)/automation-center.tsx`)

**CURRENT UX:** A vertical list of 9 identical rows — icon, title, one-line explainer, on/off switch — followed by a "Recent activity" preview (up to 5 entries) that opens a modal on tap.

**PROBLEM:** Every automation looks and behaves the same regardless of what it actually does. Low-Stock Alerts (a store-health signal) and Buyer Referral (a growth tool) are visually indistinguishable except for their label.

**WHY IT IS NOT INTUITIVE:** A vendor scanning this list has no way to guess which of these 9 things need a decision from them (a threshold, a reward amount, a time window) versus which are genuinely just on/off. The list format implies "these are all the same kind of setting" when they aren't.

**USER FREEDOM ISSUE:** A vendor cannot configure anything beyond a binary toggle for 7 of the 9 types, and only a fixed 3-choice preset for the other 2 (REQ-AUTO-001). There is no path to "I want this, but with my own number."

**REQUIRED BEHAVIOUR:** Different automation types should present different controls appropriate to what they actually do (per the client's explicit Phase 3 instruction).

**RECOMMENDED UX:** Group the list into 3–4 labeled categories (e.g. "Sales recovery," "Buyer relationship," "Store health," "Regular Delivery operations") rather than one flat list. Give each row a trailing value chip when the automation has a real setting ("Fires after 4h", "Alert at 10 units") instead of only a switch — this alone visually signals "these are different" without opening anything.

**REQUIRED COMPONENT CHANGES:** New grouped-list-section component; row template gets an optional trailing-value slot.

**REQUIRED BACKEND/API CHANGES:** None to reach this first improvement (grouping and showing an existing value) — REQ-AUTO-001's deeper per-type settings work is a separate, larger follow-on.

**PRIORITY:** P1

---

## SCREEN: Automation Detail (`app/(vendor)/automation-detail.tsx`)

**CURRENT UX:** Icon, status pill, one explainer paragraph, one full-width Activate/Deactivate button, a 3-chip preset picker for 2 of 9 types only, and a link to filtered activity.

**PROBLEM:** No eligibility explanation exists anywhere on this screen (REQ-AUTO-003) — a vendor cannot learn what actually triggers the automation they're about to turn on.

**WHY IT IS NOT INTUITIVE:** Turning something on without understanding when it fires means the vendor is trusting a black box. The explainer sentence says what the automation is for ("lets you know when your foodstuff is running low") but not the actual mechanism (at what stock count, checked how often).

**USER FREEDOM ISSUE:** A vendor can't decide "is this useful to me" with confidence, and can't verify after the fact "did this behave the way I expected" without cross-referencing Activity manually.

**REQUIRED BEHAVIOUR:** "Eligibility explanation" is explicitly named as a required element in Phase 3.

**RECOMMENDED UX:** A short, factual "How this decides who to message" section beneath the main explainer, written from the real backend eligibility logic — never invented, and left out entirely (rather than guessed) for any type whose real logic can't be honestly summarized without further investigation.

**REQUIRED COMPONENT CHANGES:** New "Eligibility" info card, reused across all 9 types with per-type copy.

**REQUIRED BACKEND/API CHANGES:** None if the logic is fixed and just needs describing in the frontend copy; confirm against the actual `automation.service.ts` scheduling logic before writing any of the 9 descriptions, screen by screen.

**PRIORITY:** P1

---

## SCREEN: Automation Activity (`app/(vendor)/automation-activity.tsx`)

**CURRENT UX:** A filterable (by type) vertical list of activity cards: icon, automation label, status pill, relative time.

**PROBLEM:** No buyer/recipient is shown anywhere (REQ-AUTO-004). No `SUPPRESSED` status is rendered — only `SENT`/`FAILED`/`ELIGIBILITY_CHECK` labels exist client-side, even though the backend writes a real, distinct `SUPPRESSED` status with a reason.

**WHY IT IS NOT INTUITIVE:** "Activity" implies a log a vendor can actually investigate. Without knowing who was messaged, or whether "nothing happened" means "nothing qualified" versus "something's broken," the log doesn't actually answer the questions a vendor would open it to ask.

**USER FREEDOM ISSUE:** No ability to self-diagnose a misconfigured automation — the vendor must contact support to learn something the backend already recorded.

**REQUIRED BEHAVIOUR:** "Automation Activity must show: automation, buyer, date/time, result" (Phase 3, verbatim) with results explicitly including a distinguishable suppressed/blocked state.

**RECOMMENDED UX:** Add a recipient field to every row. Add a third, visually distinct status treatment for Suppressed (separate color from Failed, not just a different word), with the `suppressedReason` shown on tap exactly as `failureReason` already is for Failed.

**REQUIRED COMPONENT CHANGES:** Row/modal template updated with a recipient field and a third status-pill color.

**REQUIRED BACKEND/API CHANGES:** None for the Suppressed status (already exists server-side, confirmed this session's own earlier backend work). Confirm the activity-list endpoint returns recipient name, not just ID, or add the join if it doesn't.

**PRIORITY:** P0 (Suppressed visibility — this actively hides a real operational problem from the person who needs to see it)

---

## SCREEN: Regular Delivery Offer Editor (`app/(vendor)/regular-delivery-offer-edit.tsx`)

**CURRENT UX:** A single long scrolling form with every section visible at once: title/description, frequencies, pricing rules, fulfilment rules, eligible foodstuff (last), then one Save button, then a separate Publish button that only appears post-save.

**PROBLEM:** Section order doesn't match the required flow (products should come before pricing, not after — REQ-RD-001), there is no Review step, and Publish is a second, easy-to-forget action.

**WHY IT IS NOT INTUITIVE:** A vendor configuring pricing and fulfilment rules for a product they haven't picked yet is reasoning about a product they can't see. And a vendor who taps the one obviously-primary "Create offer" button has no signal that a second action is still required before buyers can see anything.

**USER FREEDOM ISSUE:** None of the configuration itself is restricted — every field described in the client's brief exists and works (REQ-RD-003, PASS). The freedom issue is the opposite direction: the vendor isn't given a review moment to catch a mistake, and isn't clearly told their offer isn't live yet.

**REQUIRED BEHAVIOUR:** Hub → Create Offer → Select eligible foodstuff → Select frequencies → Pricing rules → Fulfilment rules → Review → Publish.

**RECOMMENDED UX:** Reorder existing sections (foodstuff first) within the same single-screen form — no need for a multi-screen wizard, since every field is already simple enough for one scroll. Add a compact review summary directly above the primary action button. Make the primary button "Create and publish offer" (doing both steps at once), with "Save as draft" as a clearly secondary, separately-labeled option for vendors who genuinely want to prepare something ahead of time.

**REQUIRED COMPONENT CHANGES:** Section reorder (no new component types needed); new review-summary block; button-group change.

**REQUIRED BACKEND/API CHANGES:** None — `create`/`publish` already exist as separate calls; this is purely about which one the primary button triggers by default.

**PRIORITY:** P0

---

## SCREEN: Buyer Regular Delivery Detail (`app/(buyer)/regular-delivery-detail.tsx`)

**CURRENT UX:** Status pill (raw enum text in two of three places it appears app-wide), next-renewal date, conditional price-approval/payment-failure cards, action grid (Pause/Skip/Resume/Cancel/Edit).

**PROBLEM:** `sub.status.replace("_", " ")` renders `PAYMENT_ATTENTION` as the literal string **"PAYMENT ATTENTION"** on this screen, while the buyer's own separate list screen correctly shows "Needs attention" for the exact same status (REQ-RD-006). Substitution policy, stock-wait explanation, and fulfilment method are all absent (REQ-RD-004, REQ-RD-006).

**WHY IT IS NOT INTUITIVE:** A raw enum string like "PAYMENT ATTENTION" reads as a bug, not a status — it breaks the illusion that a real product is speaking to the user, and it's inconsistent with a screen one tap away that gets it right.

**USER FREEDOM ISSUE:** Without a substitution policy or fulfilment method visible, a buyer manages a subscription without two pieces of information relevant to what actually happens on their next delivery.

**REQUIRED BEHAVIOUR:** Client's Phase 4: "clearly expose... payment status... stock issues... fulfilment."

**RECOMMENDED UX:** Route this screen's status rendering through the same label map the list screen already uses (a one-line fix, immediately eliminates the raw-enum bug). Add a stock-wait card matching the visual weight already given to price-approval and payment-failure. Add a substitution-policy row and a fulfilment-method row to the offer summary section.

**REQUIRED COMPONENT CHANGES:** Reuse existing `STATUS_LABEL` map instead of `.replace()`; new stock-wait card variant; two new info rows.

**REQUIRED BACKEND/API CHANGES:** Confirm the subscription-detail response includes `fulfilmentMethod` and `substitutionMode` (both stored server-side already) — add to the response if currently trimmed.

**PRIORITY:** P0 (raw enum string is a visible, shipped bug) / P1 (stock/fulfilment/substitution visibility)

---

## SCREEN: Community Buy Discovery (`app/(buyer)/community-buy.tsx`)

**CURRENT UX:** Market-filter chips, a vertical list of campaign cards (title, vendor, progress bar, "Target £X", days-left), reached only via the Profile menu or a push notification.

**PROBLEM:** No entry point exists from the buyer Home screen at all (REQ-CB-P-001) — this screen is correctly built, but almost nobody who doesn't already know it exists will ever open it.

**WHY IT IS NOT INTUITIVE:** A feature that can't be found isn't unintuitive so much as invisible — but the effect on the user's experience of "the app doesn't give me freedom" is the same: they never got the choice to try it.

**USER FREEDOM ISSUE:** A buyer is denied the chance to even discover a legitimate way to save money together with other buyers.

**REQUIRED BEHAVIOUR:** "Home → Campaign discovery" as the literal first step of the required participant journey.

**RECOMMENDED UX:** A real Community Buy section/card on buyer Home, shown only where the backend market flag enables it (reusing the exact gating logic already proven correct on the vendor dashboard).

**REQUIRED COMPONENT CHANGES:** New Home-screen section, conditionally rendered.

**REQUIRED BACKEND/API CHANGES:** None if buyer Home's data-loading already has access to the buyer's market context; otherwise, extend it to include the same `communityBuyEnabled` check.

**PRIORITY:** P0

---

## SCREEN: Community Buy Campaign Detail (`app/(buyer)/community-buy-campaign.tsx`)

**CURRENT UX:** Header with share icon, progress bar with Min/Goal/Max labels, headline "{confirmed} of {maximum} slots filled" text, status-dependent banners (rescue/success/failed/refunding), quantity/payment flow, receipt toggle, campaign updates feed.

**PROBLEM:** No "how it works" content exists (REQ-CB-P-002). Financial disclosure only appears at the confirmation step, not on this earlier decision-making screen (REQ-CB-P-003). No milestone markers beyond a single color change (REQ-CB-P-006). No rescue countdown (REQ-CB-P-007). No fulfilment tracker (REQ-CB-P-008). The FAILED-outcome copy on this screen directly contradicts the organiser's equivalent screen (REQ-CB-P-005 — needs backend verification before either side is corrected).

**WHY IT IS NOT INTUITIVE:** This screen asks a first-time participant to make a financial commitment (pledge a card) without ever having explained the model in general terms, and without showing the specific financial terms until they're already most of the way through committing.

**USER FREEDOM ISSUE:** A buyer cannot make a genuinely informed first decision here — the information needed to decide arrives after the decision-point, not before it.

**REQUIRED BEHAVIOUR:** The full required participant journey: discovery → detail → how it works → financial disclosure → quantity → fulfilment → review → payment → processing → confirmed/failed → dashboard → sharing → milestones → deadline outcome → completion/rescue → refund → fulfilment tracking.

**RECOMMENDED UX:** Move the existing, accurate financial-disclosure text up onto this screen (not just the confirm step). Add a persistent "How this works" expandable section or first-time explainer. Add a rescue countdown using data already computed for the organiser. Reuse the existing fulfilment step-tracker component in read-only form once a campaign succeeds.

**REQUIRED COMPONENT CHANGES:** New "how it works" section; disclosure text relocated (copy already exists, no new writing needed); rescue-countdown element; reused fulfilment tracker.

**REQUIRED BACKEND/API CHANGES:** Confirm/extend the participant-facing campaign endpoint to include `rescueEndsAt` and the fulfilment step data (both already computed for other roles).

**PRIORITY:** P0 (how it works, financial disclosure timing, fulfilment tracking — these are core to whether a first-time user understands what they're doing) / P1 (the FAILED-copy contradiction, pending backend verification) / P2 (milestones)

---

## SCREEN: Organiser Campaign Management (`app/(buyer)/community-buy-organiser-campaign.tsx`)

**CURRENT UX:** Single screen handling creation form, live-campaign management, participant list, extension requests, and outcome banners, all in one file.

**PROBLEM:** No product picker (REQ-CB-O-001, needs client scoping), no fee disclosure at all (REQ-CB-O-003), deadline fields are raw text requiring exact "YYYY-MM-DD" typing (REQ-CB-O-006), top-up/buy-more-shares only works during `RESCUE_WINDOW` (REQ-CB-O-004, needs confirmation).

**WHY IT IS NOT INTUITIVE:** Typing a date by hand on a phone, in one specific format, with no calendar reference, is real friction for an action (setting a deadline) that every phone OS already has a better native pattern for. A price-per-share decision made without visibility into Eki's fee is a decision made with incomplete information the organiser has every right to expect upfront.

**USER FREEDOM ISSUE:** The organiser can't act on a healthy-but-slow campaign proactively (top-up is rescue-only) — only once it's already in crisis.

**REQUIRED BEHAVIOUR:** "configure deadline... review fees... buy missing shares through normal checkout" as explicit organiser capabilities.

**RECOMMENDED UX:** Native date picker for both the creation-deadline and extension-request-deadline fields. Real, computed fee line-item on the creation form. Pending client confirmation: extend the top-up action to any LIVE campaign state, not only rescue.

**REQUIRED COMPONENT CHANGES:** Date-picker component swap (2 fields); new fee-disclosure row.

**REQUIRED BACKEND/API CHANGES:** Confirm the creation-form's data call has access to `organiserFeeBps`; relax any status check gating top-up to `RESCUE_WINDOW` only (pending confirmation this is desired).

**PRIORITY:** P1 (fee disclosure, date picker) / P2 (top-up scope, pending scoping)

---

## SCREEN: Supplier Campaigns (`app/(vendor)/community-buy-supplier.tsx`) & Fulfilment (`community-buy-supplier-fulfilment.tsx`)

**CURRENT UX:** A summary card per assigned campaign (title, status, share progress vs. minimum, price per share) with a "Confirm supply commitment" action; a separate fulfilment-plan and step-tracker screen once committed.

**PROBLEM:** No reject/decline action exists at all (REQ-CB-S-001 — a genuine missing capability, not a display gap). No full campaign detail — description, deadline, organiser identity are all absent from the review card (REQ-CB-S-002). No way for the supplier to post an update, despite the backend already recognizing `SUPPLIER` as a valid update author (REQ-CB-S-003). Payment-status card has no placeholder before a payment record exists (REQ-CB-S-004).

**WHY IT IS NOT INTUITIVE:** A supplier is asked to commit real inventory based on a card that doesn't show them the deadline or who's asking. And a supplier who wants to communicate with participants — clearly an anticipated, backend-modeled capability — finds no button to do it.

**USER FREEDOM ISSUE:** No reject path at all means the only way to "decline" is to do nothing, leaving the campaign in limbo rather than the supplier making an active, clear choice.

**REQUIRED BEHAVIOUR:** "receive invitation → review campaign → accept/reject → confirm inventory → define fulfilment plan → monitor campaign..." — the full required supplier journey.

**RECOMMENDED UX:** Expand the campaign card (or add a detail screen) to show description, deadline, organiser name before commitment. Add a real "Decline" action with a reason field and clear organiser-facing consequence messaging. Add an update-composer reusing the organiser's existing pattern. Add a payment-card placeholder state.

**REQUIRED COMPONENT CHANGES:** Expanded/new detail view; new decline action + dialog; reused update-composer; new payment-card empty state.

**REQUIRED BACKEND/API CHANGES:** New reject/decline endpoint and state transition (genuine new logic — the one real gap in this section that isn't just a display fix). Confirm supplier-facing endpoint already returns description/deadline/organiser (likely yes, unused by the client).

**PRIORITY:** P1 (reject capability, campaign detail completeness, update-posting) / P2 (payment placeholder)

---

## SCREEN: Admin Community Campaigns (`admin-web/src/app/community-campaigns/page.tsx`)

**CURRENT UX:** Three cards — review queue (Approve/Request changes/Reject), live & recently closed list, extension requests, supplier payments — each with inline action buttons.

**PROBLEM:** Pause, Resume, Approve campaign, Approve extension, Approve supplier-payment release, and Place-on-hold all fire immediately with **zero confirmation dialog** (REQ-CB-A-001) — while Reject (campaign and extension) correctly use `confirm()` on the very same page. `rescueEndsAt`, `extensionCount`, `reviewNotes`, `paidTotal`, and `targetAmount` are all fetched but never rendered (REQ-CB-A-006). No edit or cancel/end action exists for a campaign at all (REQ-CB-A-002). Data loads once with no refresh control (REQ-CB-A-005).

**WHY IT IS NOT INTUITIVE:** An admin on this exact page sees Reject prompt a confirmation and Approve not — there's no internal logic to that difference; it reads as an oversight, and it's a real one. Releasing real supplier money with a single unconfirmed click is the highest-consequence version of this same pattern.

**USER FREEDOM ISSUE:** N/A directly for a customer, but the admin has no safety net against their own misclick on financially consequential actions, and no direct tool once a campaign genuinely needs correcting or ending outside the organiser-initiated pathways.

**REQUIRED BEHAVIOUR:** Confirmation before consequential actions (a general product principle the client states directly); "control campaign" as an explicit admin capability.

**RECOMMENDED UX:** Add `confirm()` (matching this same page's own Reject pattern) to every action currently missing one. Render the five unused fields directly on the relevant cards. Add a manual refresh control. Scope and add an edit/cancel action (pending the financial-terms-lock decision noted in the matrix).

**REQUIRED COMPONENT CHANGES:** None new — reuse the `confirm()` pattern already on this same page; additional display fields; refresh button.

**REQUIRED BACKEND/API CHANGES:** New admin edit/cancel endpoints only for REQ-CB-A-002 (pending scope decision) — everything else on this screen is frontend-only.

**PRIORITY:** P0 (confirmations) / P1 (edit/cancel capability, pending scoping) / P2 (unused fields, refresh)

---

## SCREEN: Admin Community Buy Refunds, Verification, Support Cases (`admin-web/src/app/community-refunds/page.tsx`, `community-verification/page.tsx`, `community-support-cases/page.tsx`)

**CURRENT UX:** Refunds: Recheck / Escalate buttons, no confirmation. Verification: Verify / Restrict / Lift-restriction, no confirmation (Restrict requires a typed reason first, at least). Support cases: internal-note save, customer-facing response send, status dropdown, escalate toggle — **none of these four actions has any confirmation**, including the customer-visible response send.

**PROBLEM:** Same missing-confirmation pattern as the campaigns page (REQ-CB-A-001), most acute on "Send response to reporter," which is an irreversible, customer-facing communication sent with a single click and no review step.

**WHY IT IS NOT INTUITIVE:** N/A for the intuition of the action itself (each screen's purpose is clear) — the problem is the complete absence of a safety pause before something that can't be undone.

**USER FREEDOM ISSUE:** N/A for the reporter/customer on the receiving end, but the admin sending it has no chance to catch a typo or a wrong recipient before it's gone.

**REQUIRED BEHAVIOUR:** Same general confirmation principle as above.

**RECOMMENDED UX:** Add confirmation before: Send response, Recheck/Escalate refund, Verify/Restrict organiser or supplier, status-dropdown changes on support cases, and (from `community-markets/page.tsx`) any feature-flag toggle including Community Buy payments enablement.

**REQUIRED COMPONENT CHANGES:** None new — same reusable pattern as the campaigns page fix.

**REQUIRED BACKEND/API CHANGES:** None.

**PRIORITY:** P0 (send-response specifically, given it's irreversible and customer-facing) / P1 (the rest)

---

## SCREEN: Admin Subscription Exceptions (`admin-web/src/app/subscription-exceptions/page.tsx`)

**CURRENT UX:** A read-only table of stuck renewals (payment failures, price approvals pending, awaiting stock), with metric counts at the top and zero action buttons.

**PROBLEM:** This is the entire admin Regular Delivery toolset alongside one on/off market flag — there is no catalog of vendor offers, no subscriber list, and this exception queue itself has no way to act on anything it shows (REQ-CB-A-007).

**WHY IT IS NOT INTUITIVE:** N/A for comprehension (the table is clear about what's stuck) — the problem is that understanding a problem and being able to do nothing about it from the same screen is a dead end for whoever's using this tool to help a real customer.

**USER FREEDOM ISSUE:** N/A directly for buyer/vendor, but this is the most operationally serious gap in the entire audit: a real-money feature (Regular Deliveries) has no admin remediation path at all.

**REQUIRED BEHAVIOUR:** Admin parity with the level of control already built (correctly) for Community Buy and Automation.

**RECOMMENDED UX:** Add scoped action buttons per exception type — retry payment for payment failures, a resolution path for price approvals, a vendor-notification trigger for stock waits — each properly confirmed and audit-logged.

**REQUIRED COMPONENT CHANGES:** Action buttons + confirmation dialogs on this page; likely new vendor-offers and subscriber-list pages for full oversight parity with the other two feature areas.

**REQUIRED BACKEND/API CHANGES:** New admin-scoped remediation endpoints (genuine new backend work, not a display fix) — needs scoping on exactly which self-service actions admin should be able to perform on a customer's behalf, and under what safeguards.

**PRIORITY:** P0

---

## GLOBAL: Design System Fragmentation

**CURRENT UX:** Two parallel, independently-maintained visual systems coexist: `PremiumBlocks.tsx` (used consistently across the 19 Automation/Regular Delivery/Community Buy files) and ad hoc per-screen styling everywhere else (150+ files), with centralized `colors.ts`/`typography.ts`/`spacing.ts` tokens existing but adopted by fewer than 5 files total.

**PROBLEM:** The three feature areas under review in this audit look and feel different from the rest of the app they're embedded in.

**WHY IT IS NOT INTUITIVE:** A user doesn't consciously register "this screen uses a different design system" — they register "this feels like a different app" or "this feels less finished," without being able to say why. This is a very plausible concrete contributor to the client's stated feeling that "the new development does not represent what I wanted."

**USER FREEDOM ISSUE:** Indirect — inconsistent patterns (two empty-state looks, two error-state looks, 11 independently-built modal implementations) make the app less predictable, which erodes a user's confidence that they understand how it will behave.

**REQUIRED BEHAVIOUR:** "Existing Eki visual language and components" as a named source of truth — meaning consistency with what already exists, not a wholesale new system.

**RECOMMENDED UX:** Do not redesign either system to match the other wholesale. Instead: promote `PremiumBlocks.tsx`'s primitives into the proper shared component barrels (they're good, just siloed), and apply them going forward to any screen touched during this redesign — including screens outside the three feature areas if they're touched for unrelated reasons — rather than attempting an all-at-once repaint the client did not ask for and which risks the "redesigned just because it could look better" trap the client explicitly warned against.

**REQUIRED COMPONENT CHANGES:** Barrel-export consolidation; no new components required, only relocation/promotion of existing ones.

**REQUIRED BACKEND/API CHANGES:** None.

**PRIORITY:** P1 — real and structural, but must be sequenced carefully (see `UX_REDESIGN_PLAN.md`, Implementation Order) rather than treated as a blanket rewrite.

---

## GLOBAL: Vendor Dashboard → Community Buy Organiser Cross-Role Navigation

**CURRENT UX:** Tapping "Community Buy — Organize a campaign" from the vendor dashboard's Business Tools section navigates directly into `(buyer)/community-buy-organiser` with no transition cue.

**PROBLEM:** A vendor-initiated tap lands in a screen built and shaped for the buyer navigation context, silently.

**WHY IT IS NOT INTUITIVE:** The user has no reason to expect a role switch from a button on their own vendor dashboard, and nothing on the destination screen tells them one happened.

**USER FREEDOM ISSUE:** None directly, but disorientation undermines the "do I understand where I am" acceptance criterion directly.

**REQUIRED BEHAVIOUR:** Organiser is a legitimate buyer-side role even for a vendor acting as one — the underlying design decision (one screen per role) is reasonable; the presentation needs a seam.

**RECOMMENDED UX:** At minimum, a brief header/context cue on arrival ("You're now managing this as an organiser") so the shift reads as intentional. A deeper fix (a vendor-context-aware wrapper around the same screen) is a larger change and should be scoped separately if the lighter cue doesn't fully resolve the confusion in testing.

**REQUIRED COMPONENT CHANGES:** Header treatment addition on arrival from a vendor context.

**REQUIRED BACKEND/API CHANGES:** None.

**PRIORITY:** P1
