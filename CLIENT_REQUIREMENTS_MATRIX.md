# CLIENT_REQUIREMENTS_MATRIX.md

**Purpose:** reconstruct what the client wants, A to Z, for Automation, Regular Delivery, and Community Buy — and state precisely where the current product does or doesn't deliver it.

**A note on sources, stated plainly rather than assumed:** no master architecture document and no Figma file are present in either repository. The codebase's own comments repeatedly cite an external document by section number (e.g. "architecture doc §7", "spec §18.11", "spec §31") that the client evidently supplied to earlier development work directly — it was never committed to git and is not available to this audit. Two things stand in for it here: (1) the client's own two task messages in this engagement, which specify required behaviour for Automation, Regular Delivery, and Community Buy in detail — treated below as **SOURCE: Client message (this engagement)** — and (2) fragments of the original spec's intent that survive in code comments — treated as **SOURCE: Code comment (references external spec §X)**. Where a requirement comes from neither, it is marked **SOURCE: Inferred from existing architecture** (i.e., the shape of an adjacent, already-built feature implies what this one should do) and flagged as needing client confirmation, not treated as confirmed fact.

Every "CURRENT IMPLEMENTATION" line below is drawn from direct code inspection (file:line citations available in the underlying audit — omitted here for readability, kept in `UX_REDESIGN_AUDIT.md` and `CLIENT_TO_SCREEN_TRACEABILITY.md`), not from assumption. Nothing is marked PASS unless the exact behaviour was found in the code.

---

## How to read this document

- **PASS** — the required behaviour exists, is correct, and is understandable to the intended user.
- **PARTIAL — UX GAP** — the backend/business logic is real and correct, but the UI doesn't expose it, exposes it incompletely, or exposes it confusingly.
- **PARTIAL — UX/CONTROL GAP** — the feature works technically but restricts or confuses the user more than the business rules require.
- **FAIL — FUNCTIONAL GAP** — UI exists but doesn't actually perform the required behaviour, or the underlying capability doesn't exist at all.
- **MISSING** — no UI and no backend capability exists for this requirement.

---

# SECTION 1 — AUTOMATION

### REQ-AUTO-001
**SOURCE:** Client message (this engagement), Phase 3
**SECTION:** Automation Centre structure
**USER ROLE:** Vendor
**CLIENT REQUIREMENT:** "Automation Centre must NOT be a list of identical toggles. Different automation types require different controls."
**INTENDED USER BEHAVIOUR:** A vendor opens Automation Centre and immediately sees that Cart Recovery, Low-Stock Alerts, and Renewal Reminders are different kinds of things needing different attention — not 9 rows that only differ by icon and label.
**CURRENT IMPLEMENTATION:** `automation-center.tsx` renders every one of the 9 vendor-facing automation types through one identical template: icon, title, one-line explainer, on/off `Switch`. `automation-detail.tsx` gives every type a status pill and one full-width Activate/Deactivate button; only 2 of 9 types (Cart Recovery, Buyer Win-Back) get anything beyond that — a fixed 3-value numeric chip picker hardcoded in the frontend (`CONFIG_PRESETS`), not fetched from the backend and not free-editable.
**CURRENT STATUS:** FAIL — FUNCTIONAL GAP
**UX PROBLEM:** A vendor cannot tell, without opening each one, that Low-Stock Alerts needs a stock threshold, Renewal Reminders needs a lead time, and Referrals needs a reward amount — because none of those settings exist in the UI at all. The interface actively hides the fact that these are different products.
**USER FREEDOM ISSUE:** A vendor who wants a 2-hour cart-recovery window instead of 1/4/24 cannot set it. A vendor who wants Low-Stock Alerts to fire at 10 units instead of whatever the backend defaults to has no way to say so.
**BUSINESS RULE:** None found that would prevent free-text/numeric configuration — the 3-chip limitation is a frontend choice, not a backend constraint.
**REQUIRED UX:** Automation Centre list groups by category (Sales recovery, Buyer relationship, Store health, Regular Delivery operations) with a control affordance appropriate to each type shown directly on the list row (e.g. a value chip for threshold-based automations, a plain toggle for binary ones). Detail screen renders a settings section that is empty/absent when there's nothing to configure, and a real form (not 3 fixed options) when there is.
**REQUIRED COMPONENT CHANGES:** New `AutomationSettingsForm` component per type-category, replacing the one hardcoded `CONFIG_PRESETS` chip row. List item component needs a variant slot for a trailing value (e.g. "Fires after 4h") instead of only a `Switch`.
**REQUIRED BACKEND/API CHANGES:** Confirm whether `VendorAutomationSetting` (the backend settings model) already supports arbitrary numeric config beyond the 3 presets — if so this is UI-only; if the backend also only stores one of 3 enum values, the settings model needs to accept a free numeric value with sane min/max validation.
**QA REQUIRED:** For each of the 9 types, a vendor can find and change its actual configurable value (if any) without opening a code file to know it exists.
**PRIORITY:** P1

---

### REQ-AUTO-002
**SOURCE:** Client message (this engagement), Phase 3 (named automation list)
**SECTION:** Automation type coverage
**USER ROLE:** Vendor
**CLIENT REQUIREMENT:** Named automations: First Sale Campaign, Cart Recovery, Buyer Win-Back, Reorder Reminders, Referrals, Review Referral Offer, Review Requests, Low-Stock Alerts, Checkout Payment Follow-Up, Regular Delivery Payment Recovery, Renewal Reminders, Price Approval Reminders.
**INTENDED USER BEHAVIOUR:** A vendor sees all 12 as distinct, controllable items.
**CURRENT IMPLEMENTATION:** Backend `AutomationType` enum (`prisma/schema.prisma`) has exactly 12 values, but 3 of them (`CAMPAIGN_MILESTONE`, `CAMPAIGN_DEADLINE`, `CAMPAIGN_REFUND_UPDATE`) are Community-Buy buyer-facing system notifications, not vendor-controllable automations — confirmed they fire for real (`community-campaigns.service.ts:668,697,536`) but appear on zero vendor or buyer automation screen; they are delivered purely as push notifications. Of the 9 vendor-facing types: Reorder Reminders does not exist as an automation at all (a similarly-named but unrelated "reorder as a Regular Delivery" product carousel exists on the buyer Regular Deliveries screen — a different feature, not an automation). Review Referral Offer does not exist as a combined type — "Buyer referral" and "Review request" exist as two separate, unconnected automations. Checkout Payment Follow-Up and Regular Delivery Payment Recovery are merged into one type, `PAYMENT_RECOVERY` ("Payment recovery"), whose explainer text covers both "an order or a renewal" without distinguishing them to the vendor.
**CURRENT STATUS:** PARTIAL — 8 of 12 map cleanly (First Sale→"First sale nudge", Cart Recovery, Buyer Win-Back, Review Requests, Low-Stock Alerts, Referrals→"Buyer referral", Renewal Reminders, Price Approval Reminders); 1 (Reorder Reminders) is MISSING entirely; 1 (Review Referral Offer) is MISSING as a distinct concept; 2 (Checkout Payment Follow-Up, Regular Delivery Payment Recovery) are collapsed into one type — FAIL — FUNCTIONAL GAP for those two specifically.
**UX PROBLEM:** A vendor cannot separately enable/disable "remind buyers who abandoned checkout" vs. "recover a failed Regular Delivery renewal payment" — they are the same on/off switch today, and the vendor has no way to know that.
**USER FREEDOM ISSUE:** A vendor who wants renewal-payment recovery on but checkout-abandonment follow-up off (or vice versa) cannot do this.
**BUSINESS RULE:** Needs client confirmation on whether Reorder Reminders and Review Referral Offer were meant to be genuinely new automation types (requiring a new `AutomationType` enum value + trigger logic) or whether the client considers the existing adjacent features (the buyer-side reorder carousel; the separate referral/review automations) as already satisfying the intent under different names. Do not invent new business logic without this confirmation.
**REQUIRED UX:** Once the backend question above is resolved: either split `PAYMENT_RECOVERY` into two vendor-visible entries reusing the existing failure/retry mechanics, or (if it must stay one backend type) at minimum show the vendor which context each activity-log entry belongs to (order checkout vs. renewal) — the data already exists in `AutomationRun`, it is a display gap for this part.
**REQUIRED COMPONENT CHANGES:** Split list entry for payment-recovery type once backend decision is made.
**REQUIRED BACKEND/API CHANGES:** Needs client decision before backend work: either add `CHECKOUT_PAYMENT_FOLLOWUP` as a distinct `AutomationType` (splitting current `PAYMENT_RECOVERY`), or confirm current merge is acceptable and only fix the display layer.
**QA REQUIRED:** Vendor can independently enable/disable checkout follow-up vs. renewal payment recovery (pending the decision above), or — if kept merged — vendor can clearly tell which failures were checkout vs. renewal in the activity log.
**PRIORITY:** P1 (payment recovery split — real automations vendors may want independent), P2 (Reorder Reminders / Review Referral Offer — needs client scoping before it's actionable)

---

### REQ-AUTO-003
**SOURCE:** Client message (this engagement), Phase 3
**SECTION:** Per-automation required elements
**USER ROLE:** Vendor
**CLIENT REQUIREMENT:** "Every automation must have: clear explanation, status, appropriate controls, eligibility explanation, settings, activity, result, error state, pause/resume where applicable, honest empty state."
**INTENDED USER BEHAVIOUR:** For any automation, a vendor can answer "what is this, is it on, what does it need to run, and what has it done" without guessing.
**CURRENT IMPLEMENTATION:** Explanation: yes, one sentence per type. Status: yes, Active/Not active pill. Controls: binary Activate/Deactivate only (no true pause distinct from deactivate — deactivating and reactivating are the only states; there's no "paused, will resume automatically" concept). Eligibility explanation: **not found anywhere** — no screen tells a vendor what makes a buyer eligible for Cart Recovery, what "low stock" threshold triggers an alert, or what inactivity window counts as a win-back candidate. Settings: only 2 of 9 types. Activity: yes, filterable by type. Result: yes (Sent / Failed / Checking eligibility). Error state: generic "We hit a snag" reused everywhere, not automation-specific. Pause/resume: no — see above. Empty state: yes, honest ("No automation runs yet" / "Activity will appear here once your automations start sending" — does not fabricate data).
**CURRENT STATUS:** PARTIAL — UX GAP (explanation/status/activity/result/empty-state genuinely satisfy the requirement; eligibility explanation and per-type settings do not exist at all; pause/resume is conflated with on/off)
**UX PROBLEM:** A vendor turning on Low-Stock Alerts has no idea what stock level triggers it, so they can't judge whether it's useful before enabling it, and can't verify after the fact why a particular product did or didn't get flagged.
**USER FREEDOM ISSUE:** Without eligibility criteria visible, a vendor can't reason about the automation's behaviour — they can only turn it on and observe outcomes after the fact.
**BUSINESS RULE:** Whatever the real backend eligibility logic is for each of the 9 types (needs a direct read of `automationService`'s scheduling/eligibility functions, not assumed here) must be summarized in plain language, not re-implemented client-side.
**REQUIRED UX:** Each automation detail screen gets a short, real "How this decides who to message" section, sourced from the actual backend logic in plain English (e.g. "Sent when a cart has 1+ item and no order in the following 4 hours" for Cart Recovery) — not invented, and not shown at all if the true logic can't be honestly summarized without guessing.
**REQUIRED COMPONENT CHANGES:** New "Eligibility" info section on the automation detail screen.
**REQUIRED BACKEND/API CHANGES:** None if the eligibility logic is already fixed server-side and just needs describing; if any threshold is meant to be vendor-configurable (e.g. stock level), that's REQ-AUTO-001's settings gap, not this one.
**QA REQUIRED:** For every one of the 9 types, a vendor reading the detail screen can correctly predict, in their own words, roughly when the automation will fire.
**PRIORITY:** P1

---

### REQ-AUTO-004
**SOURCE:** Client message (this engagement), Phase 3
**SECTION:** Automation Activity content
**USER ROLE:** Vendor
**CLIENT REQUIREMENT:** "Automation Activity must show: automation, buyer, date/time, result."
**INTENDED USER BEHAVIOUR:** A vendor can see which specific buyer an automation acted on.
**CURRENT IMPLEMENTATION:** Shows automation name, relative date/time, and result. Does **not** show the buyer at all — `AutomationRun.recipientUserId` exists on the backend model but is never rendered on either the center-screen modal or the full activity screen. The modal instead shows an order number, product count, referral code, or store name (whichever is relevant), never the buyer's name.
**CURRENT STATUS:** FAIL — FUNCTIONAL GAP
**UX PROBLEM:** A vendor cannot answer "did automation X reach buyer Y" — a directly requested field is absent.
**USER FREEDOM ISSUE:** None directly (this is a visibility gap, not a control restriction), but it undermines trust in the "Sent" claim since the vendor can't verify who received it.
**BUSINESS RULE:** Standard privacy consideration: showing a buyer's name to the vendor who's already their counterparty in an order/store relationship is not a new disclosure — vendors already see buyer names elsewhere (Buyers tab, order details).
**REQUIRED UX:** Add buyer name (or "Buyer" + masked identifier if a real name isn't available for that recipient) to both the activity list row and the tap-through modal.
**REQUIRED COMPONENT CHANGES:** Activity row/modal template needs a recipient field.
**REQUIRED BACKEND/API CHANGES:** The activity-list/detail API response needs to join and return the recipient's display name — confirm whether the current endpoint already returns `recipientUserId` to the client (if so, this is a display-only fix plus one lookup; if not, the endpoint needs the join added).
**QA REQUIRED:** Every activity-log entry shows a real buyer name, not a placeholder.
**PRIORITY:** P1

---

### REQ-AUTO-005
**SOURCE:** Client message (this engagement), Phase 3
**SECTION:** Terminology — "Sales influenced" not "Sales caused"
**USER ROLE:** Vendor
**CLIENT REQUIREMENT:** Use "Sales influenced", not "Sales caused."
**INTENDED USER BEHAVIOUR:** A vendor never believes automation is claiming more credit for a sale than it can prove.
**CURRENT IMPLEMENTATION:** No overclaiming language exists anywhere in the codebase (confirmed by full grep — zero hits for "caused"/"generated" in an automation-attribution sense). The word "influenced" appears exactly once, in a definitional tooltip inside the center-screen modal: `"Influenced" means Eki sent this message and the buyer had not already completed the action it prompted.` It is not attached to any actual "Sales influenced: N" metric anywhere, and does not appear at all on the full Automation Activity screen (only reachable by tapping into a run from the center screen).
**CURRENT STATUS:** PASS (no overclaiming exists) with a **PARTIAL — UX GAP** noted: the correct clarifying language exists in only one of the two places a vendor would need it, and there is no summary "Sales influenced" count anywhere for a vendor to see the automation's aggregate value.
**UX PROBLEM:** None on the overclaiming risk. Missed opportunity: a vendor gets no headline number showing automation's overall contribution, which likely reduces perceived value of the whole feature (a plausible contributor to "the vendor doesn't feel this does anything for them").
**USER FREEDOM ISSUE:** None.
**BUSINESS RULE:** Any "Sales influenced" count must be computed honestly — an order placed after a message was sent, correlated (not proven caused) — and labeled as such, matching the existing tooltip's own definition exactly, everywhere it appears.
**REQUIRED UX:** Move the "Influenced" definition to also appear on the Activity screen (not just the modal); consider a real "Orders influenced this month: N" summary metric on the Automation Centre home, using the same defined meaning and never implying certainty of causation.
**REQUIRED COMPONENT CHANGES:** Copy addition to Activity screen; new metric card if a summary is added.
**REQUIRED BACKEND/API CHANGES:** If a summary count is added, needs a real aggregate query (count of SENT runs where a qualifying order followed within the automation's own window) — never a fabricated or estimated number.
**QA REQUIRED:** Any new "influenced" number is traceable to real `AutomationRun` + `Order` data, and a vendor reading it understands it's correlation, not certainty.
**PRIORITY:** P2

---

### REQ-AUTO-006
**SOURCE:** Client message (this engagement), Phase 3
**SECTION:** Required states
**USER ROLE:** Vendor
**CLIENT REQUIREMENT:** "Include: eligibility evidence, completed automations, automation settings, notification permission, error, pause confirmation, unsaved changes, no eligible buyers, suppressed action, temporarily unavailable, result states."
**INTENDED USER BEHAVIOUR:** Every one of these situations has an honest, distinct screen/message.
**CURRENT IMPLEMENTATION, item by item:**
- Eligibility evidence: not found (see REQ-AUTO-003).
- Completed automations / history: yes, Activity screen.
- Automation settings: 2 of 9 types only (see REQ-AUTO-001).
- Notification permission: yes — dismissible banner on the center screen plus a dedicated `notification-permission.tsx` screen with 4 real, distinct copy states (granted / denied-and-can't-re-ask / unsupported-in-preview-build / not-yet-asked).
- Error: generic only, not automation-specific (see REQ-AUTO-003).
- Pause confirmation: N/A as designed today — there is no pause distinct from deactivate, and deactivating does not show a confirmation dialog at all (direct toggle, no Alert).
- Unsaved changes: N/A today since there are almost no editable settings to lose (2 of 9 types have any).
- No eligible buyers: **not found** — no screen states "0 buyers currently eligible" for any automation.
- Suppressed action: the backend has a real `SUPPRESSED` `AutomationRunStatus` value (distinct from `SENT`/`FAILED`) but it is **never surfaced anywhere in the vendor UI** — confirmed the frontend only renders `SENT`/`FAILED`/`ELIGIBILITY_CHECK` labels; a suppressed run (e.g., template disabled, no eligible channel) is invisible to the vendor.
- Temporarily unavailable: not found as a distinct state.
- Result states: yes (Sent / Failed / Checking eligibility), but incomplete per the Suppressed gap above.
**CURRENT STATUS:** PARTIAL — UX GAP (notification permission and activity history genuinely satisfy the requirement; suppressed-action display, no-eligible-buyers state, and deactivate-confirmation are real, concrete gaps)
**UX PROBLEM:** The single most important gap here: a vendor cannot currently tell the difference between "this automation sent nothing because there was nothing to send" and "this automation sent nothing because it's silently misconfigured" — both currently look identical (no activity), because `SUPPRESSED` runs aren't shown.
**USER FREEDOM ISSUE:** Deactivating an automation with no confirmation risks an accidental tap turning off a working automation with zero recovery prompt (though re-enabling is trivial, so this is low-severity).
**BUSINESS RULE:** `SUPPRESSED` already exists as a real backend status (confirmed this session's own earlier work on `automation.service.ts` — `scheduleAutomation()` maps `communicationService.send()`'s real outcome to `SENT`/`SUPPRESSED`(+reason)/`FAILED`(+reason)) — this is a pure display gap, not a missing capability.
**REQUIRED UX:** Show Suppressed as its own status pill/color in Activity, with its `suppressedReason` visible on tap (mirroring how `failureReason` already displays for Failed). Add a lightweight confirmation ("Turn off Cart Recovery? Buyers currently mid-recovery won't be messaged.") before deactivating an automation that has recent activity.
**REQUIRED COMPONENT CHANGES:** Status pill needs a third visual state (Suppressed, distinct color from Failed); Activate/Deactivate button needs a confirm step.
**REQUIRED BACKEND/API CHANGES:** None — `SUPPRESSED` + `suppressedReason` already exist server-side per this session's own backend work; this is entirely a frontend display fix.
**QA REQUIRED:** A vendor can distinguish "nothing happened because nothing qualified" from "nothing happened because something's misconfigured" without contacting support.
**PRIORITY:** P0 (suppressed-state visibility — this directly hides a real problem from vendors) / P2 (deactivate confirmation)

---

### REQ-AUTO-007
**SOURCE:** Client message (this engagement), Phase 3
**SECTION:** No fake metrics
**USER ROLE:** Vendor
**CLIENT REQUIREMENT:** "Do not create fake metrics."
**INTENDED USER BEHAVIOUR:** Every number a vendor sees is real.
**CURRENT IMPLEMENTATION:** Confirmed clean — no hardcoded sales/revenue numbers found anywhere in the three automation screens or the service layer; all counts are derived client-side from real API-returned arrays. The only hardcoded values are the 3-option config presets (a UX limitation, not a fabricated metric — see REQ-AUTO-001).
**CURRENT STATUS:** PASS
**UX PROBLEM:** None.
**USER FREEDOM ISSUE:** None.
**BUSINESS RULE:** N/A.
**REQUIRED UX:** None — maintain this standard when adding the new metrics proposed in REQ-AUTO-005/006.
**REQUIRED COMPONENT CHANGES:** None.
**REQUIRED BACKEND/API CHANGES:** None.
**QA REQUIRED:** Re-verify after redesign that no new screen introduces a placeholder/estimated number presented as real.
**PRIORITY:** P3 (maintain, re-verify post-redesign)

---

# SECTION 2 — REGULAR DELIVERY / SUBSCRIPTION

### REQ-RD-001
**SOURCE:** Client message (this engagement), Phase 4
**SECTION:** Vendor offer-creation flow
**USER ROLE:** Vendor
**CLIENT REQUIREMENT:** "Regular Deliveries Hub → Create Offer → Select eligible foodstuff → Select supported frequencies → Pricing rules → Fulfilment rules → Review → Publish."
**INTENDED USER BEHAVIOUR:** A vendor moves through a clear, ordered sequence and sees a final review before anything goes live.
**CURRENT IMPLEMENTATION:** One single long scrolling form (`regular-delivery-offer-edit.tsx`), all sections visible simultaneously, in this order: Title/Description → Frequencies → Pricing rules → Fulfilment rules → **Eligible foodstuff (last, not first)** → one "Create offer"/"Save changes" button → a **separate** "Publish this offer" button that only appears after the offer is already saved. There is no dedicated per-step flow and no Review step at all — saving jumps straight to a generic `Alert.alert("Saved", ...)`.
**CURRENT STATUS:** PARTIAL — UX/CONTROL GAP (every required field is capturable — nothing is functionally missing — but the sequence, order, and lack of a review/publish-together step do not match the required flow and add real risk: a vendor can create a valid offer, tap away, and never notice it was never published)
**UX PROBLEM:** Product selection is placed after pricing and fulfilment rules, reversing the natural "what am I selling, then how" order. There is no moment where the vendor sees everything they configured in one place before it's live.
**USER FREEDOM ISSUE:** None in terms of what the vendor CAN do (all fields are editable later) — but the missing Review step removes the vendor's chance to catch a mistake before saving, and the missing "Create & Publish" affordance means a vendor's reasonable expectation ("I made an offer, it should be live") silently fails.
**BUSINESS RULE:** Draft-vs-published as separate states is presumably intentional (lets a vendor prepare an offer without it being buyer-visible yet) — the fix here is making the transition from draft to published an explicit, hard-to-miss step, not removing the draft state itself.
**REQUIRED UX:** Reorder the existing single-screen form so foodstuff selection comes first (matching required flow) with no new screens needed if a single well-structured scrolling form is retained; add a lightweight review summary immediately before the primary action button, and combine save+publish into one clear default action ("Create and publish offer") while still allowing "Save as draft" as a secondary, clearly-labeled option.
**REQUIRED COMPONENT CHANGES:** Reordered section layout on the existing form; new review-summary component; button group change (primary = publish, secondary = save-draft).
**REQUIRED BACKEND/API CHANGES:** None required if `createOffer`/`updateOffer`/`publishOffer` already exist as separable calls (confirmed they do) — this is a client-side sequencing and button-labeling change only.
**QA REQUIRED:** A vendor who completes the form once, using the primary button, ends up with a live, buyer-visible offer — not a silent draft.
**PRIORITY:** P0 (the "offer never actually goes live" failure mode is a real business-impacting gap, not cosmetic)

---

### REQ-RD-002
**SOURCE:** Client message (this engagement), Phase 4; cross-checked against `prisma/schema.prisma`
**SECTION:** Frequency options
**USER ROLE:** Vendor, Buyer
**CLIENT REQUIREMENT:** "Weekly / Every 2 weeks / Every 4 weeks / Monthly."
**INTENDED USER BEHAVIOUR:** A vendor and buyer can choose from 4 real cadences.
**CURRENT IMPLEMENTATION:** Backend `SubscriptionFrequency` enum has exactly 3 values: `WEEKLY`, `BIWEEKLY`, `MONTHLY`. There is no distinct "every 4 weeks" value at the database level at all — this is not a frontend oversight, the option does not exist to be shown. "Weekly"/"Every 2 weeks"/"Monthly" labels match the required wording exactly.
**CURRENT STATUS:** MISSING (for "Every 4 weeks" specifically) — this is a genuine backend schema gap, not fixable by a UI change alone.
**UX PROBLEM:** N/A at the UI layer — the 3 existing options are labeled correctly and clearly.
**USER FREEDOM ISSUE:** A vendor or buyer who specifically wants a 28-day cadence (meaningfully different from a calendar month, which varies 28–31 days) cannot get one.
**BUSINESS RULE:** Needs client confirmation: is "Every 4 weeks" meant to be a genuinely distinct cadence from Monthly (28 days always, vs. calendar-month-based), or was the client's phrasing colloquial for the existing Monthly option? Do not add a new enum value without confirming the exact interval semantics wanted (fixed 28-day cycle vs. calendar month).
**REQUIRED UX:** Once confirmed: add a 4th frequency chip labeled "Every 4 weeks" on both vendor offer-creation and buyer subscription screens.
**REQUIRED COMPONENT CHANGES:** `ALL_FREQUENCIES` array and label map extended by one value on both vendor and buyer sides.
**REQUIRED BACKEND/API CHANGES:** Add a new `SubscriptionFrequency` enum value (e.g. `EVERY_4_WEEKS`) with a Prisma migration, plus renewal-date-calculation logic for the new fixed 28-day interval (must not be confused with the existing `MONTHLY` calculation).
**QA REQUIRED:** A subscription set to "Every 4 weeks" renews exactly 28 days later, every time, distinct from a Monthly subscription's calendar-month renewal.
**PRIORITY:** P1 (pending client confirmation of intent — do not build speculatively)

---

### REQ-RD-003
**SOURCE:** Client message (this engagement), Phase 4
**SECTION:** Vendor-configurable offer fields
**USER ROLE:** Vendor
**CLIENT REQUIREMENT:** Vendor must be able to configure: eligible products, frequencies, pricing rules, discount, maximum price increase without approval, delivery/collection, preparation time, renewal cutoff, substitution policy.
**INTENDED USER BEHAVIOUR:** Every one of these is a real, working control.
**CURRENT IMPLEMENTATION:** All nine are present and functional on `regular-delivery-offer-edit.tsx`, with real hint text for each (e.g. "Buyers must approve changes above this limit before payment. Leave blank to use Eki's default." for max price increase; "How many hours before a renewal buyers can still pause, skip, or edit it." for renewal cutoff).
**CURRENT STATUS:** PASS
**UX PROBLEM:** None functionally — the only issue is field ORDER (see REQ-RD-001), not field existence.
**USER FREEDOM ISSUE:** None.
**BUSINESS RULE:** N/A — already correctly implemented.
**REQUIRED UX:** None beyond the reordering in REQ-RD-001.
**REQUIRED COMPONENT CHANGES:** None.
**REQUIRED BACKEND/API CHANGES:** None.
**QA REQUIRED:** Re-verify after reordering that no field's behaviour changed, only its position.
**PRIORITY:** P3 (maintain)

---

### REQ-RD-004
**SOURCE:** Client message (this engagement), Phase 4
**SECTION:** Substitution policy — options and visibility
**USER ROLE:** Vendor, Buyer
**CLIENT REQUIREMENT:** "Do not substitute / Ask buyer before substituting / Allow similar substitutions within buyer's limit."
**INTENDED USER BEHAVIOUR:** A vendor sets the policy; a buyer, before subscribing, knows what will happen if an item is out of stock.
**CURRENT IMPLEMENTATION:** All 3 options exist on the vendor form with wording matching the client's requirement **exactly**, word for word, defaulting to "Ask buyer before substituting." However, this setting is captured on the vendor side and **never displayed anywhere on the buyer side** — confirmed zero references to `substitutionPolicy`/`substitutionMode` in either buyer Regular Delivery screen.
**CURRENT STATUS:** PARTIAL — UX GAP (vendor-side: PASS; buyer-side: FAIL — FUNCTIONAL GAP, since a value the buyer needs to make an informed subscribe decision is fully computed and available, and simply not shown)
**UX PROBLEM:** A buyer commits to a recurring purchase without knowing whether an out-of-stock item will be silently swapped for something else, silently skipped, or the buyer will be asked each time.
**USER FREEDOM ISSUE:** The buyer cannot make an informed choice about a real future consequence of subscribing, and cannot pre-emptively object to "Allow similar substitutions" if they'd prefer "Ask me first" — there is no visible signal that would even prompt them to look for such a control.
**BUSINESS RULE:** This is the vendor's own setting (per-offer, not per-buyer) — the buyer's "control" here is informational (know before subscribing) and, if the policy is "Ask buyer," reactive (approve/decline per instance) rather than a buyer-side override of the vendor's chosen policy.
**REQUIRED UX:** Show the offer's substitution policy plainly on both the offer detail screen (before subscribing) and the buyer's active-subscription detail screen (after subscribing), using the vendor's own selected wording.
**REQUIRED COMPONENT CHANGES:** New info row on `regular-delivery-offer.tsx` and `regular-delivery-detail.tsx` (buyer side).
**REQUIRED BACKEND/API CHANGES:** Confirm the buyer-facing offer/subscription API responses already include `substitutionMode` (it's stored, so likely already returned) — if not returned to the buyer client today, add it to the response.
**QA REQUIRED:** A buyer can state, before subscribing, what will happen if their next renewal has an out-of-stock item.
**PRIORITY:** P1

---

### REQ-RD-005
**SOURCE:** Client message (this engagement), Phase 4
**SECTION:** Buyer control — pause / skip / edit / cancel
**USER ROLE:** Buyer
**CLIENT REQUIREMENT:** "Buyer must have control over their Regular Delivery: pause, skip, edit, cancel."
**INTENDED USER BEHAVIOUR:** All four actions are available and clear.
**CURRENT IMPLEMENTATION:** All four exist on `regular-delivery-detail.tsx`: Pause (while Active), Skip next (while Active), Resume (while Paused), Cancel (while Active or Paused, with a real confirmation dialog: "Cancel this Regular Delivery? / Future renewals will stop. This can't be undone. / Keep it / Cancel delivery"), Edit (inline quantity editor with a real safety rail — cannot save down to zero items without being told to cancel instead).
**CURRENT STATUS:** PASS
**UX PROBLEM:** None on the core four actions. One related, smaller gap: the backend's `pauseSubscription` supports an optional resume-on-a-specific-date parameter, but the buyer UI's Pause button never collects or passes one — a buyer can only pause indefinitely, not "pause until the 15th."
**USER FREEDOM ISSUE:** A buyer who knows exactly when they want deliveries to resume (e.g., back from a trip on a known date) cannot set that — they must pause, then remember to come back and manually resume.
**BUSINESS RULE:** N/A — the backend already supports the more flexible behaviour; this is purely a UI gap.
**REQUIRED UX:** Add an optional "Resume on" date picker to the Pause action, defaulting to indefinite if left blank.
**REQUIRED COMPONENT CHANGES:** Pause button opens a small date-optional sheet instead of firing immediately.
**REQUIRED BACKEND/API CHANGES:** None — `pauseSubscription(id, resumeAt?)` already accepts this.
**QA REQUIRED:** A buyer can pause with a specific resume date and the subscription actually resumes automatically on that date.
**PRIORITY:** P2

---

### REQ-RD-006
**SOURCE:** Client message (this engagement), Phase 4
**SECTION:** Buyer visibility — renewal/payment/price/stock/fulfilment
**USER ROLE:** Buyer
**CLIENT REQUIREMENT:** "Buyer UX must clearly expose: upcoming renewal, payment status, price approval, stock issues, failed payment, recovery, fulfilment."
**INTENDED USER BEHAVIOUR:** All seven are visible and clear on the subscription detail screen.
**CURRENT IMPLEMENTATION, item by item:**
- Upcoming renewal: yes, clear date, or "Paused" in its place.
- Payment status: **inconsistent** — the detail screen renders the raw enum with only word-splitting (`sub.status.replace("_", " ")`), producing literal text like "PAYMENT ATTENTION", while the buyer's own list screen (a different screen) correctly maps the same status to "Needs attention" via a proper label table. Same status, two different renderings, on two buyer-facing screens.
- Price approval: yes, a real warning card with Approve / "Skip this delivery" actions.
- Stock issues: **not found** — `AWAITING_STOCK` exists as a renewal status with a defined label ("Awaiting stock confirmation") but gets no dedicated card the way price-approval and payment-failure do; it only appears as a plain status pill in renewal history, easy to miss.
- Failed payment + recovery: yes, a real error card with a "Retry payment" button.
- Fulfilment (delivery/collection): **not found** — captured at offer creation, never shown to the buyer anywhere on the subscription screens.
**CURRENT STATUS:** PARTIAL — UX GAP (4 of 7 fully satisfy the requirement; payment status has a real inconsistency bug; stock issues and fulfilment method are missing)
**UX PROBLEM:** A buyer whose renewal is stuck on stock has no clear explanation and no distinct call-to-action, unlike every other blocking state, which does. A buyer never learns whether their subscription is set up for delivery or collection.
**USER FREEDOM ISSUE:** Without a clear "this needs stock, here's what that means" state, a buyer can't understand why their delivery hasn't happened or what (if anything) they need to do.
**BUSINESS RULE:** Stock-wait presumably auto-resolves once the vendor confirms stock (`AWAITING_STOCK` → next status) — the fix is explanatory, not a new business rule.
**REQUIRED UX:** Add a dedicated "Waiting on stock" card matching the visual treatment already used for price-approval/payment-failure, with honest copy (e.g. "Your vendor needs to confirm stock before this renewal proceeds — we'll notify you"). Add a fulfilment-method row to the subscription detail screen. Fix the label-mapping inconsistency so `regular-delivery-detail.tsx` uses the same status label table the buyer list screen already has.
**REQUIRED COMPONENT CHANGES:** New status card variant for stock-wait; new info row for fulfilment method; reuse existing `STATUS_LABEL` map instead of raw `.replace()`.
**REQUIRED BACKEND/API CHANGES:** None — all underlying data (`fulfilmentMethod`, `AWAITING_STOCK` status) already exists and is already returned to relevant callers; confirm the buyer subscription-detail endpoint includes `fulfilmentMethod` in its response (add if missing).
**QA REQUIRED:** A buyer whose renewal is awaiting stock sees a clear, distinct explanation, not a raw enum string; a buyer can state whether their subscription is delivery or collection.
**PRIORITY:** P0 (raw enum string "PAYMENT ATTENTION" shown to a real buyer is a visible, embarrassing bug, not a nuance) / P1 (stock + fulfilment visibility)

---

### REQ-RD-007
**SOURCE:** Client message (this engagement), Phase 4
**SECTION:** "Never make the user feel locked into a subscription."
**USER ROLE:** Buyer
**CLIENT REQUIREMENT:** No lock-in feeling.
**INTENDED USER BEHAVIOUR:** Cancel is always visible and easy when applicable.
**CURRENT IMPLEMENTATION:** Cancel is visible and reachable in exactly the states it should be (Active, Paused), with clear, non-manipulative confirmation copy. No dark-pattern wording or hidden-cancel path was found. One naming ambiguity found: "Pause" is used identically for two different-scope actions — a vendor pausing renewals for an entire offer (affecting every subscriber) and a buyer pausing their own individual subscription — both surfaces use the bare word "Pause"/"Resume" with nothing distinguishing scope, which risks a vendor misunderstanding the blast radius of their own action (this is a vendor-side clarity issue, not a buyer lock-in issue).
**CURRENT STATUS:** PASS (buyer lock-in specifically) with a **PARTIAL — UX/CONTROL GAP** noted for vendor-side terminology clarity.
**UX PROBLEM:** A vendor tapping "Pause" on their offer might not immediately register that this pauses renewals for every current subscriber, not just stops new signups.
**USER FREEDOM ISSUE:** None for the buyer. For the vendor: risk of an action with a bigger effect than the label suggests.
**BUSINESS RULE:** N/A — this is a labeling clarity fix.
**REQUIRED UX:** Vendor-side offer pause button copy changes to something scope-explicit, e.g. "Pause renewals for all subscribers", with its own confirmation dialog stating the effect plainly.
**REQUIRED COMPONENT CHANGES:** Copy-only change on the vendor offer pause control, plus adding a confirmation dialog (currently fires with none, per the same finding as REQ-AUTO-006's deactivate gap — this is a comparable case).
**REQUIRED BACKEND/API CHANGES:** None.
**QA REQUIRED:** A vendor cannot pause an offer for all subscribers without a dialog explicitly stating that scope.
**PRIORITY:** P1

---

# SECTION 3 — COMMUNITY BUY

## 3.1 Participant (buyer)

### REQ-CB-P-001
**SOURCE:** Client message (this engagement), Phase 5
**SECTION:** Entry point / discovery
**USER ROLE:** Participant (buyer)
**CLIENT REQUIREMENT:** "Home → Campaign discovery" as the first step of the participant journey.
**INTENDED USER BEHAVIOUR:** A buyer discovers Community Buy from the app's Home screen.
**CURRENT IMPLEMENTATION:** There is no Community Buy entry point on the buyer Home tab at all. The only ways in are: the Profile screen's menu list (one row among many, several taps deep from Home), or tapping a push notification about a campaign the buyer is already involved in.
**CURRENT STATUS:** FAIL — FUNCTIONAL GAP
**UX PROBLEM:** A buyer who has never heard of Community Buy, and never gets a push notification about it, has effectively no way to discover the feature exists — it is not visible from the primary navigation surface at all.
**USER FREEDOM ISSUE:** A buyer isn't being denied a choice they know about — they're being denied the chance to even know the choice exists.
**BUSINESS RULE:** Community Buy is market-gated (only shown where the backend enables it) — any Home-screen entry point must respect this same gate, not bypass it.
**REQUIRED UX:** A real Community Buy entry point on the buyer Home screen (a card or section, not just a Profile-menu row), shown only in markets where the feature is enabled, matching the same backend gate the vendor dashboard already correctly uses.
**REQUIRED COMPONENT CHANGES:** New Home-screen section/card, conditionally rendered.
**REQUIRED BACKEND/API CHANGES:** None — buyer Home already has access to the buyer's own market context; confirm the same "is Community Buy enabled here" check already used for the vendor dashboard is reachable from the buyer Home data-loading call, or add it.
**QA REQUIRED:** A first-time buyer, in an enabled market, discovers Community Buy from Home without needing to know to check their Profile menu.
**PRIORITY:** P0

---

### REQ-CB-P-002
**SOURCE:** Client message (this engagement), Phase 5
**SECTION:** "How it works"
**USER ROLE:** Participant
**CLIENT REQUIREMENT:** "How it works" as an explicit step in the participant journey.
**INTENDED USER BEHAVIOUR:** A first-time participant can read a plain explanation of what Community Buy is and how contributing works before they commit.
**CURRENT IMPLEMENTATION:** No "how it works" copy exists anywhere in the entire app (confirmed by an app-wide grep, not just Community Buy files) — zero matches for the phrase in any form.
**CURRENT STATUS:** MISSING
**UX PROBLEM:** A buyer who's never used Community Buy before is dropped straight into a specific campaign's numbers (min/goal/max, price, deadline) with no general orientation to the concept.
**USER FREEDOM ISSUE:** A buyer cannot make an informed first-time decision to participate without understanding the model, and currently has no way to learn it inside the app at all.
**BUSINESS RULE:** Must accurately describe the real mechanism already confirmed in code: pledge now, no charge until the campaign succeeds (reaches its minimum), refund process if it doesn't. Must not describe anything the backend doesn't actually do.
**REQUIRED UX:** A real "How Community Buy works" explainer — either a first-time-only screen shown before the first campaign detail view, or a permanently accessible link/section from the discovery screen — written from the real, confirmed mechanics (pledge → no charge yet → charged only if minimum is reached → refund if not).
**REQUIRED COMPONENT CHANGES:** New explainer screen or expandable section.
**REQUIRED BACKEND/API CHANGES:** None.
**QA REQUIRED:** A first-time participant can explain, in their own words, when they'll be charged and what happens if a campaign doesn't succeed, having read only in-app copy.
**PRIORITY:** P0

---

### REQ-CB-P-003
**SOURCE:** Client message (this engagement), Phase 5
**SECTION:** Financial disclosure
**USER ROLE:** Participant
**CLIENT REQUIREMENT:** "Financial disclosure" as an explicit journey step.
**INTENDED USER BEHAVIOUR:** Before committing money/card details, a participant sees a clear statement of the financial terms.
**CURRENT IMPLEMENTATION:** A real disclosure line exists — but only reactively, after the buyer has already selected a quantity and payment method, as part of the confirm-contribution screen: "Your card will not be charged now. It will only be charged {amount} if this campaign reaches its minimum or goal." A second, narrower line appears only after pledging. There is no standalone/upfront disclosure section shown earlier in the flow.
**CURRENT STATUS:** PARTIAL — UX GAP (the disclosure exists and is accurate, but arrives late in the flow rather than as its own clear step, and there's no standing refund-policy reference the buyer could check back on later)
**UX PROBLEM:** A buyer forms their decision to participate based on the campaign card/detail numbers before ever seeing the financial terms — the disclosure is confirmation-stage, not decision-stage, information.
**USER FREEDOM ISSUE:** A buyer cannot factor the real financial terms into their initial decision to proceed; they only learn them once they're already most of the way through committing.
**BUSINESS RULE:** N/A — the existing disclosure text is accurate to the real `PLEDGE_THEN_CHARGE` mechanism; this is a sequencing issue, not a correctness issue.
**REQUIRED UX:** Surface the same accurate disclosure text earlier — on the campaign detail screen itself, not only at the final confirm step — so it's decision-stage information, not just confirmation-stage.
**REQUIRED COMPONENT CHANGES:** New disclosure section on campaign detail screen (can reuse identical copy already proven accurate at the confirm step).
**REQUIRED BACKEND/API CHANGES:** None.
**QA REQUIRED:** A buyer sees the "not charged until minimum reached" statement before selecting a quantity, not only after.
**PRIORITY:** P1

---

### REQ-CB-P-004
**SOURCE:** Client message (this engagement), Phase 5
**SECTION:** Minimum / Goal / Maximum distinction
**USER ROLE:** Participant, Organiser
**CLIENT REQUIREMENT:** "Minimum shares / Goal shares / Maximum shares. Goal is NOT necessarily the minimum required for success... the UI must never imply 'Goal not reached = failed'."
**INTENDED USER BEHAVIOUR:** A participant clearly understands three different numbers and correctly understands that reaching the minimum (not the goal) is what makes the campaign proceed.
**CURRENT IMPLEMENTATION:** All three numbers are shown as distinct labeled values ("Min {n}", "Goal {n}", "Max {n}") beneath the progress bar. Success/failure messaging is genuinely correct and explicit: outcome text branches on the real `fundingOutcome` field (`GOAL_REACHED` vs `MINIMUM_REACHED` vs `BELOW_MINIMUM`), with copy such as "This campaign will proceed — the supplier-approved minimum was reached" clearly distinguishing minimum-reached-success from goal-reached-success, and "This campaign did not reach its minimum" (never "did not reach its goal") for the failure case. This requirement is met correctly.
**CURRENT STATUS:** PASS
**UX PROBLEM:** One presentation-only issue: the primary headline number under the progress bar reads only "{confirmed} of {maximum} slots filled" — minimum and goal appear solely in small 10px labels beneath the bar, not in the primary copy, so while the distinction is never WRONG, it is easy to skim past. Separately, campaign cards also show a currency figure labeled "Target {amount}" which is a different underlying field (`targetAmount`, a money value) from "Goal" (`goalShares`, a share count) shown on the detail screen's progress bar — nothing explains the relationship between these two numbers, which could read as a fourth, unexplained figure.
**USER FREEDOM ISSUE:** None — this is a clarity issue, not a control issue.
**BUSINESS RULE:** N/A — correctness is already right; only presentation needs polish.
**REQUIRED UX:** Make the primary headline copy reference the minimum explicitly when relevant (e.g. "62 of 100 goal — 40 needed to proceed" once minimum is passed, or similar), and either drop the separate "Target {amount}" money figure from cards or explicitly label it as the goal's monetary equivalent so it doesn't read as an unexplained fourth number.
**REQUIRED COMPONENT CHANGES:** `RangeProgressBar` headline text; campaign card layout.
**REQUIRED BACKEND/API CHANGES:** None.
**QA REQUIRED:** A first-time viewer of a campaign card can correctly state what "Target £450" refers to relative to the shares progress bar shown on the same card.
**PRIORITY:** P2

---

### REQ-CB-P-005 — CONFIRMED DEFECT
**SOURCE:** Direct code comparison (this audit)
**SECTION:** FAILED-campaign refund messaging — contradiction between buyer and organiser copy
**USER ROLE:** Participant, Organiser
**CLIENT REQUIREMENT:** Implicit in the general accuracy requirement — UI copy must not contradict itself about the same real event.
**INTENDED USER BEHAVIOUR:** Both a participant and the organiser of the same failed campaign are told the same true thing about what happens to money.
**CURRENT IMPLEMENTATION:** For the identical `FAILED` campaign status, the buyer-facing copy states: "This campaign did not reach its minimum. No supplier order will be created — **no participant was ever charged, so there is nothing to refund.** Any saved pledge has been cancelled." The organiser-facing copy for the same status states: "This campaign did not reach its minimum requirement. No supplier order will be created. **Eki is creating an individual refund record for every eligible confirmed contribution.**" These two descriptions of the same real event directly contradict each other on whether any refund activity occurs.
**CURRENT STATUS:** FAIL — FUNCTIONAL GAP (this is a factual copy bug, not a design preference)
**UX PROBLEM:** Whichever statement is true, the other is actively misinforming its reader about their own money.
**USER FREEDOM ISSUE:** A participant told "nothing to refund" who is in fact owed a refund has no reason to check for one and may miss it entirely.
**BUSINESS RULE:** Needs a direct read of the actual `PLEDGE_THEN_CHARGE` mechanics for the FAILED-with-existing-contributions case: is it true that under `PLEDGE_THEN_CHARGE` a card is truly never charged pre-minimum (making the buyer copy correct and the organiser copy wrong), or can a contribution be confirmed/charged before a campaign is later found to have fallen below minimum on an edge case (making the organiser copy correct)? This audit does not resolve which is true — it only confirms the contradiction exists and must be resolved before any redesign ships new copy in this area.
**REQUIRED UX:** Once resolved, make both screens state the identical true outcome, in role-appropriate language, but never in conflict.
**REQUIRED COMPONENT CHANGES:** Copy fix on whichever screen is wrong, once the underlying truth is confirmed.
**REQUIRED BACKEND/API CHANGES:** None anticipated — this looks like a copy-authoring inconsistency, not a logic bug — but must be confirmed against the real `campaign-contributions.service.ts` refund-triggering logic before assuming so.
**QA REQUIRED:** A real end-to-end test of a campaign that fails below minimum, with at least one prior contribution, confirms exactly what happens to that contribution's payment method/charge, and both buyer and organiser copy are checked against that real outcome.
**PRIORITY:** P0

---

### REQ-CB-P-006
**SOURCE:** Client message (this engagement), Phase 5
**SECTION:** Milestones
**USER ROLE:** Participant
**CLIENT REQUIREMENT:** "Milestones" as an explicit journey step.
**INTENDED USER BEHAVIOUR:** A participant sees discrete progress signals (e.g. "halfway there") as a campaign fills.
**CURRENT IMPLEMENTATION:** No progress-milestone UI exists (no "50% funded" badge/toast or similar). The only backend-real "milestone" concept is `CAMPAIGN_MILESTONE`, which fires exactly once, only on final success ("Campaign succeeded!"), as a push notification — not a progressive milestone system, and not reflected as a persistent visual marker if the buyer views the campaign in-app afterward. The only in-app progress signal is the bar's fill color switching from amber to green once the minimum is crossed.
**CURRENT STATUS:** MISSING (for progressive milestones as commonly understood — e.g. 25%/50%/75%); PARTIAL — UX GAP for the one real milestone that does exist (success notification fires, but leaves no visible trace on the campaign screen afterward for someone who opens the app later rather than tapping the notification).
**UX PROBLEM:** A participant checking a campaign's progress gets no sense of momentum beyond the raw share count and a single color change at the minimum threshold.
**USER FREEDOM ISSUE:** None directly — this is an engagement/motivation gap, not a control restriction.
**BUSINESS RULE:** Needs client confirmation of what specific milestones are wanted (percentage thresholds? minimum-crossed? both?) before backend/frontend work — do not invent thresholds.
**REQUIRED UX:** Pending confirmation: likely a small set of milestone badges on the progress bar itself (e.g. a marker at minimum, at goal) plus persisting the "reached minimum"/"reached goal" moment as a visible state on the campaign screen, not only as a one-time push notification.
**REQUIRED COMPONENT CHANGES:** `RangeProgressBar` enhancement for milestone markers.
**REQUIRED BACKEND/API CHANGES:** None needed for the minimum/goal-crossing case (data already exists); a percentage-based milestone system (25/50/75%) would need new threshold-tracking logic if the client wants it — confirm before building.
**QA REQUIRED:** A participant can tell at a glance whether a campaign has crossed its minimum, without reading the small numeric labels.
**PRIORITY:** P2 (pending client scoping)

---

### REQ-CB-P-007
**SOURCE:** Client message (this engagement), Phase 5
**SECTION:** Rescue-period visibility
**USER ROLE:** Participant
**CLIENT REQUIREMENT:** "Deadline outcome → Completion/rescue" as explicit journey steps.
**INTENDED USER BEHAVIOUR:** A participant in a rescue-window campaign can see how much time remains.
**CURRENT IMPLEMENTATION:** The rescue-window banner text is accurate and clear ("The organiser has until the rescue deadline to complete the remaining requirement... No additional payment is required from you.") but the actual rescue deadline/countdown is **never shown on the participant screen** — only the organiser's own campaign-management screen shows "Time remaining."
**CURRENT STATUS:** PARTIAL — UX GAP (the explanatory copy is correct; the specific timing data a participant would reasonably want is withheld from them despite existing and being shown to the organiser)
**UX PROBLEM:** A participant knows a rescue window exists but not how long it lasts or how much is left.
**USER FREEDOM ISSUE:** None directly (participants aren't the ones acting during rescue), but withholding a real, already-computed number from an interested party for no apparent reason reduces trust and the sense of being kept informed.
**BUSINESS RULE:** None found preventing this — the organiser already sees the same field (`rescueEndsAt`).
**REQUIRED UX:** Show the rescue deadline/countdown on the participant campaign screen using the same data already computed for the organiser view.
**REQUIRED COMPONENT CHANGES:** Add a countdown element to the participant rescue-window banner.
**REQUIRED BACKEND/API CHANGES:** Confirm the participant-facing campaign-detail endpoint already returns `rescueEndsAt` (the organiser endpoint does) — add if it's currently withheld from the participant response.
**QA REQUIRED:** A participant viewing a rescue-window campaign sees the same deadline the organiser sees.
**PRIORITY:** P2

---

### REQ-CB-P-008
**SOURCE:** Client message (this engagement), Phase 5
**SECTION:** Fulfilment tracking
**USER ROLE:** Participant
**CLIENT REQUIREMENT:** "Fulfilment tracking" as an explicit journey step.
**INTENDED USER BEHAVIOUR:** A participant can see real progress toward their order being prepared/dispatched.
**CURRENT IMPLEMENTATION:** A real, structured fulfilment step tracker (`AWAITING_INVENTORY_CONFIRMATION → ... → COMPLETED`) exists and is shown to the organiser and the supplier. The participant screen never references this tracker at all — participants only see the generic line "Fulfilment updates will be shared with participants" plus whatever the organiser/supplier manually posts to the campaign's "Campaign updates" feed.
**CURRENT STATUS:** FAIL — FUNCTIONAL GAP (real, structured status data exists and is computed; it is simply not shown to the one role the client's own requirement names as needing it)
**UX PROBLEM:** A participant has no way to check fulfilment progress themselves — they are entirely dependent on the organiser or supplier remembering to post a manual update.
**USER FREEDOM ISSUE:** A participant cannot self-serve an answer to "is my order being prepared yet" and must wait passively.
**BUSINESS RULE:** The step tracker already exists and is already computed for two other roles on the same campaign — showing a read-only version to participants introduces no new business logic.
**REQUIRED UX:** A read-only version of the same fulfilment step tracker, shown on the participant campaign screen once the campaign has succeeded and entered fulfilment.
**REQUIRED COMPONENT CHANGES:** New read-only tracker component (can likely be a simplified reuse of the existing organiser/supplier tracker component).
**REQUIRED BACKEND/API CHANGES:** Confirm the participant-facing campaign endpoint returns the `CampaignFulfilment` step data (organiser/supplier endpoints do) — add if withheld.
**QA REQUIRED:** A participant can see the same fulfilment step (e.g. "Dispatched") the supplier just marked, without needing a manual update post.
**PRIORITY:** P1

---

## 3.2 Organiser

### REQ-CB-O-001
**SOURCE:** Client message (this engagement), Phase 5
**SECTION:** Product selection at campaign creation
**USER ROLE:** Organiser
**CLIENT REQUIREMENT:** "select product" as an explicit organiser capability.
**INTENDED USER BEHAVIOUR:** An organiser picks a real catalog product to base the campaign on.
**CURRENT IMPLEMENTATION:** The `Campaign` model has no product field at all — only free-text title/description. There is no catalog link anywhere in the creation flow.
**CURRENT STATUS:** MISSING
**UX PROBLEM:** An organiser must describe the product in prose rather than selecting it, and nothing connects a campaign to a real, structured product record (with its own images, existing price history, etc.).
**USER FREEDOM ISSUE:** An organiser has no faster/more accurate way to represent the product than typing a description from scratch each time.
**BUSINESS RULE:** Needs client confirmation of intent: is a campaign meant to be tied to one of the supplier's existing catalog products (in which case product data — image, base price — could pre-fill the campaign form), or is free-text description a deliberate choice (e.g. because campaign products are often bespoke bulk-buy configurations not otherwise listed)? Do not add a schema field without this confirmation.
**REQUIRED UX:** Pending confirmation: a product picker (searching the chosen supplier's real catalog) that pre-fills title/description/image, still allowing edits.
**REQUIRED COMPONENT CHANGES:** New product-picker step in campaign creation.
**REQUIRED BACKEND/API CHANGES:** If confirmed: add a `productId` (nullable, to not break existing free-text campaigns) to `CommunityCampaign`.
**QA REQUIRED:** An organiser creating a campaign for an existing catalog item doesn't have to retype what's already in the product record.
**PRIORITY:** P2 (pending client scoping)

---

### REQ-CB-O-002
**SOURCE:** Client message (this engagement), Phase 5
**SECTION:** Configure fulfilment (organiser)
**USER ROLE:** Organiser
**CLIENT REQUIREMENT:** "configure fulfilment" listed as an organiser capability.
**INTENDED USER BEHAVIOUR:** The organiser has some say in fulfilment terms at setup.
**CURRENT IMPLEMENTATION:** Fulfilment method (Delivery/Collection) is set entirely by the supplier, later, during their own fulfilment-planning step — never by the organiser at campaign creation.
**CURRENT STATUS:** PARTIAL — UX/CONTROL GAP (a real fulfilment configuration exists in the product, it's just owned by a different role than the client's phrasing implies)
**UX PROBLEM:** None if this division of responsibility (organiser sets commercial terms, supplier sets fulfilment logistics) is intentional — it's a reasonable real-world split (the supplier is the one who actually ships/hands over goods). This may simply be a wording mismatch between the client's requirement and the existing, sensible role split.
**USER FREEDOM ISSUE:** None evident — needs client confirmation this split is acceptable rather than assuming a gap exists.
**BUSINESS RULE:** N/A pending confirmation.
**REQUIRED UX:** If the client confirms the current organiser/supplier split is correct: no change, but consider showing the organiser a read-only view of the fulfilment plan once the supplier sets it (currently not found on the organiser screen at all — the organiser has no visibility into the fulfilment plan the supplier configures).
**REQUIRED COMPONENT CHANGES:** Read-only fulfilment-plan display on organiser campaign screen, if confirmed useful.
**REQUIRED BACKEND/API CHANGES:** None if only adding a read-only view of already-captured data.
**QA REQUIRED:** Confirm with client whether organiser needs to SET fulfilment terms or merely SEE them once the supplier sets them.
**PRIORITY:** P3 (needs scoping first)

---

### REQ-CB-O-003
**SOURCE:** Client message (this engagement), Phase 5
**SECTION:** Review fees
**USER ROLE:** Organiser
**CLIENT REQUIREMENT:** "review fees" as an explicit organiser capability before submitting a campaign.
**INTENDED USER BEHAVIOUR:** An organiser sees what Eki's fee will be before committing to a campaign.
**CURRENT IMPLEMENTATION:** No fee/commission line-item appears anywhere in the campaign creation flow or on the live campaign screen.
**CURRENT STATUS:** MISSING
**UX PROBLEM:** An organiser cannot factor Eki's fee into their price-per-share decision, and has no way to know their real take (or the participants' real total cost, if fees are passed through) before submitting.
**USER FREEDOM ISSUE:** A financially material fact is withheld from the person making a pricing decision.
**BUSINESS RULE:** Backend already has `organiserFeeBps` on `MarketConfiguration` (confirmed from earlier work this session) — the fee rate is real and per-market-configured, not invented.
**REQUIRED UX:** Show the real, current fee rate (and computed fee amount once a price-per-share is entered) on the campaign creation form before submission.
**REQUIRED COMPONENT CHANGES:** New fee-disclosure row on the creation form, computed live from price × fee rate.
**REQUIRED BACKEND/API CHANGES:** Confirm the campaign-creation form's data-loading call already has access to the market's `organiserFeeBps` (likely needs one additional field returned if not already).
**QA REQUIRED:** An organiser can see the exact fee amount before submitting, matching what's actually deducted later.
**PRIORITY:** P1

---

### REQ-CB-O-004
**SOURCE:** Client message (this engagement), Phase 5
**SECTION:** Buy missing shares through normal checkout
**USER ROLE:** Organiser
**CLIENT REQUIREMENT:** "buy missing shares through normal checkout" as an explicit organiser capability.
**INTENDED USER BEHAVIOUR:** An organiser can top up shares themselves at any point they judge it useful, not only as a last resort.
**CURRENT IMPLEMENTATION:** A top-up action exists but is restricted to the `RESCUE_WINDOW` status only — there is no equivalent "buy more shares" control while a campaign is simply LIVE and healthy.
**CURRENT STATUS:** PARTIAL — UX/CONTROL GAP
**UX PROBLEM:** An organiser who wants to proactively push a slow-moving but not-yet-failing campaign toward its minimum has no way to do so until it's already in a rescue crisis.
**USER FREEDOM ISSUE:** The organiser is denied a legitimate, low-risk action (buying shares themselves, same as any participant could) except in the one moment it's already urgent.
**BUSINESS RULE:** Needs confirmation this restriction is intentional (e.g. to avoid organisers "gaming" their own campaign's visible momentum) vs. simply not yet built for the LIVE state.
**REQUIRED UX:** If confirmed acceptable: expose the same top-up/contribute action to the organiser at any LIVE-campaign stage, not only during rescue.
**REQUIRED COMPONENT CHANGES:** Reuse existing top-up UI, remove the `RESCUE_WINDOW`-only gate (pending confirmation).
**REQUIRED BACKEND/API CHANGES:** Confirm/relax any status check in the top-up endpoint that currently restricts it to `RESCUE_WINDOW`.
**QA REQUIRED:** An organiser can contribute shares to their own LIVE campaign at any time, not only during a rescue window (once confirmed intended).
**PRIORITY:** P2 (pending client confirmation of intent)

---

### REQ-CB-O-005
**SOURCE:** Client message (this engagement), Phase 5
**SECTION:** Invite participants
**USER ROLE:** Organiser
**CLIENT REQUIREMENT:** "invite participants" as an explicit organiser capability.
**INTENDED USER BEHAVIOUR:** An organiser can directly invite specific people, not just broadcast a generic share link.
**CURRENT IMPLEMENTATION:** Only a native OS share-sheet exists (generic message with a campaign progress summary) — no invite-link tracking, no contact picker, no referral/attribution mechanism tied to invites specifically.
**CURRENT STATUS:** MISSING
**UX PROBLEM:** An organiser cannot see who they invited, whether an invite converted, or target specific contacts directly from the app.
**USER FREEDOM ISSUE:** The organiser's only promotion tool is the least controllable one (a generic share sheet) — no more targeted option exists.
**BUSINESS RULE:** Needs client confirmation of scope: is a trackable invite-link system wanted (with attribution), or is generic sharing considered sufficient and "invite" was describing that same native-share capability in different words?
**REQUIRED UX:** Pending confirmation: a trackable invite link (showing the organiser how many people opened it / joined via it) as a distinct feature from generic sharing.
**REQUIRED COMPONENT CHANGES:** New invite-link generation UI, "invited via you" indicator on participant list.
**REQUIRED BACKEND/API CHANGES:** A referral/attribution mechanism for campaign invites specifically (does not currently exist for Community Buy, though a similar mechanism exists for the unrelated buyer-referral automation — could potentially be adapted, needs investigation, not assumed reusable as-is).
**QA REQUIRED:** Confirm with client whether "invite" means trackable invites or the existing native share already satisfies this.
**PRIORITY:** P2 (needs scoping first)

---

### REQ-CB-O-006
**SOURCE:** Client message (this engagement), Phase 5
**SECTION:** Deadline input ergonomics
**USER ROLE:** Organiser
**CLIENT REQUIREMENT:** Implicit in "configure deadline" — a usable way to set a date.
**INTENDED USER BEHAVIOUR:** An organiser picks a deadline without typing a date string by hand.
**CURRENT IMPLEMENTATION:** The deadline field is a raw text input requiring the exact format "YYYY-MM-DD" typed by hand, with validation copy "Enter a valid future date (YYYY-MM-DD)" if it's wrong. Same pattern for the extension-request's "Requested new deadline" field.
**CURRENT STATUS:** PARTIAL — UX/CONTROL GAP
**UX PROBLEM:** Manually typing a strict date format on a phone keyboard is error-prone and slower than a native date picker, and gives no visual calendar context (e.g. seeing today relative to the chosen date).
**USER FREEDOM ISSUE:** None directly — this is an ergonomics gap, not a permissions gap.
**BUSINESS RULE:** N/A.
**REQUIRED UX:** Replace the raw text field with a native date picker on both the campaign-creation deadline field and the extension-request deadline field.
**REQUIRED COMPONENT CHANGES:** Swap `TextInput` for a native date-picker component (already a common pattern elsewhere in the app for date fields — confirm and reuse rather than building new).
**REQUIRED BACKEND/API CHANGES:** None — same date value, different input method.
**QA REQUIRED:** An organiser can set a deadline without typing digits/dashes by hand, and cannot submit a malformed date (impossible by construction with a picker).
**PRIORITY:** P2

---

## 3.3 Supplier (vendor role)

### REQ-CB-S-001
**SOURCE:** Client message (this engagement), Phase 5
**SECTION:** Accept/reject invitation
**USER ROLE:** Supplier
**CLIENT REQUIREMENT:** "accept/reject" as an explicit supplier capability.
**INTENDED USER BEHAVIOUR:** A supplier can decline a campaign they don't want to fulfil, not only accept.
**CURRENT IMPLEMENTATION:** Only "Confirm supply commitment" (accept) exists. No reject/decline method exists anywhere in the service layer.
**CURRENT STATUS:** MISSING
**UX PROBLEM:** A supplier who wants to decline has no in-app way to do so — presumably they must simply never tap confirm, leaving the campaign in limbo rather than actively resolved.
**USER FREEDOM ISSUE:** A legitimate, named-in-the-requirement choice (reject) does not exist at all.
**BUSINESS RULE:** Needs a real decision on what happens to a campaign/organiser when a supplier rejects (does the organiser get notified immediately to pick another supplier? does the campaign revert to draft?) — this is genuine new business logic, not a UI-only fix.
**REQUIRED UX:** A real "Decline this campaign" action, with a reason field, and clear next-step messaging to both supplier and organiser about what happens next.
**REQUIRED COMPONENT CHANGES:** New decline action + confirmation dialog on the supplier assigned-campaigns screen.
**REQUIRED BACKEND/API CHANGES:** New reject/decline method in `organiserSupplierService` or equivalent Community Buy supplier service, plus the state transition and organiser-notification logic for a declined commitment.
**QA REQUIRED:** A supplier can decline a campaign and the organiser is clearly informed and can act (e.g. pick a different supplier) rather than the campaign silently stalling.
**PRIORITY:** P1

---

### REQ-CB-S-002
**SOURCE:** Client message (this engagement), Phase 5
**SECTION:** Review campaign — information completeness
**USER ROLE:** Supplier
**CLIENT REQUIREMENT:** "review campaign" as an explicit step before accept/reject.
**INTENDED USER BEHAVIOUR:** A supplier sees everything relevant before committing.
**CURRENT IMPLEMENTATION:** The supplier's campaign card shows only title, status, share progress vs. minimum, and price per share. No description, deadline, or organiser information is shown — there is no full campaign-detail screen for the supplier at all (unlike organiser and participant, who each get one).
**CURRENT STATUS:** FAIL — FUNCTIONAL GAP
**UX PROBLEM:** A supplier is asked to commit real inventory to a campaign without seeing its deadline, full description, or who's organising it.
**USER FREEDOM ISSUE:** The supplier cannot make an informed accept/reject decision (once REQ-CB-S-001 exists) without this information.
**BUSINESS RULE:** All of this data already exists on the `CommunityCampaign` record — this is a display gap, not a missing capability.
**REQUIRED UX:** A real supplier campaign-detail view (or at minimum, an expanded card) showing description, deadline, and organiser name before the supplier is asked to accept.
**REQUIRED COMPONENT CHANGES:** New/expanded supplier campaign card or detail screen.
**REQUIRED BACKEND/API CHANGES:** Confirm the supplier-facing campaign list/detail endpoint already returns description/deadline/organiser fields — add if currently trimmed from the response.
**QA REQUIRED:** A supplier can state the campaign's deadline and who organised it without leaving the review screen.
**PRIORITY:** P1

---

### REQ-CB-S-003
**SOURCE:** Client message (this engagement), Phase 5
**SECTION:** Monitor campaign — participant/progress visibility, updates
**USER ROLE:** Supplier
**CLIENT REQUIREMENT:** "monitor campaign" as an explicit supplier capability.
**INTENDED USER BEHAVIOUR:** A supplier can track how a campaign is doing and communicate with participants.
**CURRENT IMPLEMENTATION:** Supplier gets only the summary card and the fulfilment step tracker — no participant list, no progress bar visualization, and no way to post a campaign update, despite the backend's `CampaignUpdateAuthorRole` enum explicitly including `SUPPLIER` as a recognized update author (participants can already see supplier-authored updates on their own screen — the capability to send one just isn't exposed to the supplier).
**CURRENT STATUS:** PARTIAL — UX GAP
**UX PROBLEM:** A supplier who wants to tell participants "running slightly behind, dispatching Thursday instead of Wednesday" has no way to do so, even though the system is fully built to display exactly that kind of message if the supplier could send it.
**USER FREEDOM ISSUE:** A capability the backend already models as legitimate (`SUPPLIER` as an update author) is invisible to the one role it's meant for.
**BUSINESS RULE:** None — this is purely a missing UI entry point to an already-modeled capability.
**REQUIRED UX:** Add a "Post an update" control to the supplier's campaign screen, identical in spirit to whatever the organiser already uses for the same feature.
**REQUIRED COMPONENT CHANGES:** Reuse/adapt the organiser's existing update-composer UI for the supplier screen.
**REQUIRED BACKEND/API CHANGES:** None if the update-creation endpoint already accepts a supplier-authored update (the enum suggests it does) — confirm and wire the frontend call.
**QA REQUIRED:** A supplier can post an update and a participant sees it correctly attributed to the supplier (not the organiser).
**PRIORITY:** P1

---

### REQ-CB-S-004
**SOURCE:** Client message (this engagement), Phase 5
**SECTION:** Supplier payment state visibility
**USER ROLE:** Supplier
**CLIENT REQUIREMENT:** "view supplier payment state" as an explicit capability.
**INTENDED USER BEHAVIOUR:** A supplier always knows where their payment stands.
**CURRENT IMPLEMENTATION:** A real payment-status card exists (Not yet released / Processing / Paid / On hold / Failed, with hold reason shown if present) — but it only renders once a payment record already exists. Before that point, the supplier sees nothing about payment at all — no placeholder explaining that payment will appear once the campaign completes.
**CURRENT STATUS:** PARTIAL — UX GAP
**UX PROBLEM:** A supplier checking on an in-progress campaign, before fulfilment/payment has started, sees a gap where the payment section would be, with no explanation of when it will appear.
**USER FREEDOM ISSUE:** None directly — an information/reassurance gap, not a control gap.
**BUSINESS RULE:** N/A.
**REQUIRED UX:** Add a placeholder state to the payment card ("Payment will appear here once fulfilment is confirmed") rather than showing nothing.
**REQUIRED COMPONENT CHANGES:** New empty/placeholder variant of the existing payment card.
**REQUIRED BACKEND/API CHANGES:** None.
**QA REQUIRED:** A supplier viewing a not-yet-fulfilled campaign sees an honest placeholder, not a blank gap.
**PRIORITY:** P2

---

## 3.4 Admin

### REQ-CB-A-001 — CONFIRMED DEFECT
**SOURCE:** Client message (this engagement), Phase 5 ("control campaign"); direct code inspection
**SECTION:** Confirmation dialogs on destructive/high-stakes admin actions
**USER ROLE:** Admin
**CLIENT REQUIREMENT:** Not explicitly stated as a line item, but directly implied by the client's own stated complaint about missing confirmations and by Phase 6's "destructive actions without confirmation" anti-pattern list.
**INTENDED USER BEHAVIOUR:** An admin is asked to confirm before an action with real financial or customer-facing consequences fires.
**CURRENT IMPLEMENTATION:** In the Community Buy admin section specifically, the following fire **immediately with no confirmation of any kind**: Pause campaign, Resume campaign, Approve campaign, Approve extension request, Approve supplier-payment release, Place supplier payment on hold, Recheck refund, Escalate refund, Verify organiser, Verify supplier, Restrict/lift-restriction on organiser or supplier, Save internal note, **Send response to reporter** (a customer-visible, irreversible communication), support-case status changes, and Community Buy market feature-flag toggles (including the payments-enablement flag). By contrast, every OTHER admin area in the exact same codebase (vendors, users, roles, disputes, gift cards, delivery zones, reviews) consistently uses a real `confirm()` dialog for equivalent actions. Two genuine exceptions exist within Community Buy: rejecting a campaign or an extension request uses `confirm()`, and the Fulfilment Delays screen uses a real modal requiring a mandatory note.
**CURRENT STATUS:** FAIL — FUNCTIONAL GAP
**UX PROBLEM:** This is not a subtle inconsistency — it's a section-wide pattern where the exact same class of action (approve/reject, release/hold money, restrict an account) is treated as needing confirmation everywhere else in the app except here.
**USER FREEDOM ISSUE:** N/A for the end customer directly, but this is exactly the "destructive actions without confirmation" pattern the client explicitly named as something to avoid — here it's an admin, not a customer, but releasing real supplier money or sending a real customer-facing message with no confirmation step is a materially riskier gap than most customer-facing ones.
**BUSINESS RULE:** None that would justify the inconsistency — the same actions elsewhere in this codebase already use confirmation dialogs, proving the pattern is known and considered necessary by whoever built those other screens.
**REQUIRED UX:** Add `confirm()` (or a proper modal, matching the Fulfilment Delays precedent for anything requiring a reason) to every action listed above, matching the confirmation rigor already used elsewhere in the same admin panel.
**REQUIRED COMPONENT CHANGES:** None new — reuse the existing `confirm()`/modal patterns already proven elsewhere in this same codebase.
**REQUIRED BACKEND/API CHANGES:** None.
**QA REQUIRED:** Every action in the list above requires an explicit confirm step before it takes effect; verify no destructive Community Buy admin action can fire from a single accidental tap.
**PRIORITY:** P0

---

### REQ-CB-A-002
**SOURCE:** Client message (this engagement), Phase 5
**SECTION:** Control campaign — edit / end
**USER ROLE:** Admin
**CLIENT REQUIREMENT:** "control campaign" as an explicit admin capability.
**INTENDED USER BEHAVIOUR:** Admin can edit a campaign's details or end/cancel one outright when needed, not only pause/resume.
**CURRENT IMPLEMENTATION:** The entire admin Community Buy API surface contains: get-for-review, get-recently-closed, approve, request-changes, reject, pause, resume. There is no edit-campaign-fields method and no cancel/end/terminate method anywhere in the API.
**CURRENT STATUS:** MISSING
**UX PROBLEM:** An admin who discovers a campaign needs correcting (wrong price, needs an early end for a legitimate support reason) has no direct tool — only the organiser-initiated request-changes/extension-request pathways, which the admin can approve or reject but not originate on the admin's own authority.
**USER FREEDOM ISSUE:** The admin (not a customer, but still a real user of this system) is denied a legitimate, expected control.
**BUSINESS RULE:** Needs a decision on scope: should admin be able to directly edit financial terms (price, min/goal/max) on a live campaign, given the existing rule that "financial terms are locked once a campaign is live" for the organiser? An admin override of that same lock is a real business-rule decision, not a UI addition — do not build without confirming whether admin should be exempt from the same lock.
**REQUIRED UX:** Pending that decision: an admin edit action (scoped per the confirmed rule) and a genuine admin-initiated end/cancel action with the same confirmation rigor as REQ-CB-A-001.
**REQUIRED COMPONENT CHANGES:** New admin edit form and end-campaign action.
**REQUIRED BACKEND/API CHANGES:** New admin-only edit-campaign and cancel-campaign endpoints, with audit logging (matching the pattern already used for other sensitive admin actions in this codebase).
**QA REQUIRED:** Confirm with client the exact scope of admin edit authority before this is estimated or built.
**PRIORITY:** P1 (needs scoping)

---

### REQ-CB-A-003
**SOURCE:** Client message (this engagement), Phase 5
**SECTION:** Manage refunds — force/manual trigger
**USER ROLE:** Admin
**CLIENT REQUIREMENT:** "manage refunds" as an explicit admin capability.
**INTENDED USER BEHAVIOUR:** Admin can act decisively on a stuck refund, not only monitor it.
**CURRENT IMPLEMENTATION:** Admin can "Recheck" (poll current status) or "Escalate" (open a support case) an existing automated refund record. There is no way to manually trigger, override, or force a refund from the admin panel.
**CURRENT STATUS:** PARTIAL — UX/CONTROL GAP
**UX PROBLEM:** For a refund stuck in a failed/needs-attention state that Recheck can't resolve, escalating to a support case is the only lever — there's no direct remediation tool.
**USER FREEDOM ISSUE:** N/A for a customer directly, but the admin lacks the tool that would let them resolve a customer's stuck refund without a secondary support-case workflow.
**BUSINESS RULE:** Needs confirmation of whether "force refund" should exist as an admin override of the normal automated flow, given real financial/reconciliation implications (a manually-forced refund must still reconcile correctly against the ledger) — this is a genuine business-rule and financial-safety decision, not a simple UI add.
**REQUIRED UX:** Pending that decision: a "Force refund" action, scoped tightly (e.g. only reachable after escalation, requiring a reason, fully audited).
**REQUIRED COMPONENT CHANGES:** New action on the refunds admin page, gated appropriately.
**REQUIRED BACKEND/API CHANGES:** New manual-refund-trigger endpoint with real Stripe-side execution and ledger reconciliation — this is real financial-system work requiring careful design, not a checkbox.
**QA REQUIRED:** Confirm with client and finance/ops stakeholders whether this capability is wanted at all before scoping further.
**PRIORITY:** P2 (needs scoping — genuine financial-safety implications)

---

### REQ-CB-A-004
**SOURCE:** Client message (this engagement), Phase 5
**SECTION:** Inspect contribution records
**USER ROLE:** Admin
**CLIENT REQUIREMENT:** "inspect contribution records" as an explicit admin capability, distinct from the ledger.
**INTENDED USER BEHAVIOUR:** Admin can look up participant-level contribution records directly.
**CURRENT IMPLEMENTATION:** Contribution-level detail exists only inside the ledger's expandable entries (generic description/amount, not participant-identified) or inside the refunds table (participant name/email shown only for already-refunded contributions). There is no dedicated page listing all contributions/pledges for a given campaign with participant identity.
**CURRENT STATUS:** PARTIAL — UX GAP
**UX PROBLEM:** An admin investigating a specific participant's contribution (e.g. a support inquiry: "did my pledge go through?") has no direct lookup — they must cross-reference the ledger and refunds pages, neither of which is built for this purpose.
**USER FREEDOM ISSUE:** N/A directly for admin, but this slows down every support interaction that depends on it, indirectly affecting how quickly a real customer's question gets answered.
**BUSINESS RULE:** No new business logic — this is a reporting/visibility gap on data that already exists (`CampaignContribution` records).
**REQUIRED UX:** A per-campaign participant/contribution list (participant name, share count, amount, status) reachable directly from the campaign review/monitoring screen.
**REQUIRED COMPONENT CHANGES:** New contributions table, likely embeddable in the existing campaign detail/monitoring view rather than a wholly separate page.
**REQUIRED BACKEND/API CHANGES:** A new or extended endpoint returning per-campaign contribution records with participant identity (likely straightforward given the ledger/refund endpoints already do similar joins).
**QA REQUIRED:** An admin can answer "what did participant X pledge to campaign Y and what's its status" from one screen.
**PRIORITY:** P1

---

### REQ-CB-A-005
**SOURCE:** Direct code inspection (this audit)
**SECTION:** Live-campaign data staleness
**USER ROLE:** Admin
**CLIENT REQUIREMENT:** Implicit in "monitor live campaigns."
**INTENDED USER BEHAVIOUR:** An admin monitoring a live campaign sees current data.
**CURRENT IMPLEMENTATION:** The live/recently-closed campaigns list loads once on page mount, with no auto-refresh and no manual refresh button — an admin must reload the entire page to see updated pledge counts.
**CURRENT STATUS:** PARTIAL — UX/CONTROL GAP
**UX PROBLEM:** "Monitoring" implies watching something change; a page that only updates on a full reload undermines that.
**USER FREEDOM ISSUE:** None directly — a data-freshness gap, not a permissions gap.
**BUSINESS RULE:** N/A.
**REQUIRED UX:** A manual "Refresh" button at minimum; genuine live-monitoring value would come from periodic auto-refresh or a real-time update mechanism, but a manual control is the minimum bar.
**REQUIRED COMPONENT CHANGES:** Refresh button + re-fetch logic on the existing page.
**REQUIRED BACKEND/API CHANGES:** None.
**QA REQUIRED:** An admin can get current campaign numbers without a full page reload.
**PRIORITY:** P2

---

### REQ-CB-A-006
**SOURCE:** Direct code inspection (this audit)
**SECTION:** Unrendered fields on the campaign monitoring screen
**USER ROLE:** Admin
**CLIENT REQUIREMENT:** Implicit in "evaluate deadlines" and "review completion."
**INTENDED USER BEHAVIOUR:** Data the admin API already fetches for this purpose is actually shown.
**CURRENT IMPLEMENTATION:** The `AdminCampaign` type includes `rescueEndsAt`, `extensionCount`, `reviewNotes`, `paidTotal`, and `targetAmount` — none of these five fields are rendered anywhere on the campaign monitoring page, despite being fetched into every page load.
**CURRENT STATUS:** PARTIAL — UX GAP
**UX PROBLEM:** An admin cannot see how many extensions a campaign has already used (relevant since only one extension is ever allowed — REQ elsewhere confirms this), or the actual rescue deadline, without separately opening the extension-requests card and doing the arithmetic themselves.
**USER FREEDOM ISSUE:** N/A directly.
**BUSINESS RULE:** No new logic — purely a display gap on already-fetched data.
**REQUIRED UX:** Render `extensionCount` (e.g. "1 of 1 extensions used") and `rescueEndsAt` (as a countdown or timestamp) directly on the relevant campaign row/card.
**REQUIRED COMPONENT CHANGES:** Additional fields on the existing campaign card in `community-campaigns/page.tsx`.
**REQUIRED BACKEND/API CHANGES:** None — data is already fetched.
**QA REQUIRED:** An admin can see extension count and rescue deadline without cross-referencing a separate card.
**PRIORITY:** P2

---

### REQ-CB-A-007
**SOURCE:** Client message (this engagement), Phase 5
**SECTION:** Admin Regular Delivery / subscription tooling
**USER ROLE:** Admin
**CLIENT REQUIREMENT:** Not named as its own Phase 5 line item, but Phase 4's full vendor/buyer Regular Delivery control set implies admin needs equivalent oversight — cross-referenced against the client's Phase 9/prior-engagement pattern of admin parity for every buyer/vendor-facing money feature (already established for Community Buy and Automation in this same message).
**INTENDED USER BEHAVIOUR:** Admin can see and act on stuck Regular Delivery subscriptions.
**CURRENT IMPLEMENTATION:** Admin capability is limited to exactly two things: one on/off market-level feature flag ("Regular Deliveries" toggle, no confirmation dialog), and a read-only exception queue (stuck payments / price approvals / stock waits) with **zero action buttons of any kind** — no retry payment, no approve/deny price change, no force-cancel, no contact-buyer action. There is no catalog of vendor offers and no list of individual buyer subscriptions anywhere in admin.
**CURRENT STATUS:** FAIL — FUNCTIONAL GAP
**UX PROBLEM:** An admin who spots a stuck renewal in the exception queue can look at it and nothing else — every real remediation must happen some other way (direct database/support intervention outside the admin panel, presumably), which is a significant operational gap for a real money-moving feature.
**USER FREEDOM ISSUE:** N/A directly for the buyer/vendor, but this is a serious support-capability gap that will eventually surface as a real customer waiting on an admin who has no tool to help them.
**BUSINESS RULE:** Needs scoping: which of the vendor/buyer self-service actions (retry payment, approve/deny price change on the buyer's behalf, pause/cancel a subscription) should admin be able to perform on someone else's behalf, and under what safeguards (reason required, audit logged, notification sent to the affected party)?
**REQUIRED UX:** At minimum: action buttons on the exception queue matching the exception type (retry payment for payment failures, view/resolve for price approvals, notify-vendor for stock waits), each with confirmation and audit logging consistent with REQ-CB-A-001's standard.
**REQUIRED COMPONENT CHANGES:** Action buttons + confirmation dialogs on `subscription-exceptions/page.tsx`; likely a new vendor-offers list and subscriber list page for genuine oversight.
**REQUIRED BACKEND/API CHANGES:** New admin-scoped endpoints for each remediation action, all audit-logged.
**QA REQUIRED:** An admin can resolve a stuck renewal from within the admin panel, end to end, without needing developer/database intervention.
**PRIORITY:** P0 (a real-money feature with zero admin remediation tooling is a genuine operational risk, not a nice-to-have)

---

# SECTION 4 — GLOBAL / CROSS-CUTTING

### REQ-GLOBAL-001 — CONFIRMED DEFECT
**SOURCE:** Direct code inspection (this audit)
**SECTION:** Design system adoption
**USER ROLE:** All (Buyer, Vendor, Admin)
**CLIENT REQUIREMENT:** Implicit in "Existing Eki visual language and components" (this engagement's stated source of truth #6) and the general consistency requirement in Phase 6/global audit.
**INTENDED USER BEHAVIOUR:** The app looks and feels like one product throughout.
**CURRENT IMPLEMENTATION:** Centralized `colors.ts`, `typography.ts`, and `spacing.ts` files exist and are well-designed, but adoption is nearly zero: typography constants used in 3 of 189 screen/component files, spacing constants in 0 of 189, color constants in 5 of 189. The remaining 150+ files hardcode font family strings, hex colors, and pixel values independently, per screen. Separately, a second, self-contained mini design system (`PremiumBlocks.tsx` — `EmptyState`, `ErrorState`, `LoadingBlock`, `StatusPill`, `FloatingCard`, etc.) is used consistently across exactly the 19 files that make up Automation, Regular Deliveries, and Community Buy — and nowhere else in the app.
**CURRENT STATUS:** FAIL — FUNCTIONAL GAP (not a UX-only nuance: this is a structural, repo-wide inconsistency)
**UX PROBLEM:** This directly explains a specific, nameable version of the client's "does not feel intuitive" complaint: the three newest feature areas (exactly the ones under review in this audit) visually and structurally diverge from the rest of the app, because they use a different, newer, self-contained component set that the original 150+ screens never adopted. A user moving from their Dashboard to Automation Center is moving between two different design systems without a clear reason to notice why it feels different — it just does.
**USER FREEDOM ISSUE:** None directly, but inconsistent patterns (two different empty-state looks, two different error-state looks, ad hoc modals in 11 different flavors) make the app harder to predict, which erodes a user's sense of control indirectly.
**BUSINESS RULE:** N/A.
**REQUIRED UX:** Consolidate `PremiumBlocks.tsx`'s primitives into the shared `components/ui`/`components/shared` layer (not deleted — it's good work, just siloed) so every screen, old and new, draws from one source; migrate the highest-traffic older screens toward the centralized tokens over time rather than in one disruptive pass.
**REQUIRED COMPONENT CHANGES:** Merge `PremiumBlocks.tsx` exports into the proper shared barrels; a phased token-adoption plan (see `UX_REDESIGN_PLAN.md` §6–7) rather than a single rewrite.
**REQUIRED BACKEND/API CHANGES:** None.
**QA REQUIRED:** A visual audit confirming Automation/Regular Delivery/Community Buy screens and (at minimum) the highest-traffic legacy screens read as the same product.
**PRIORITY:** P1 (structural, but must be sequenced carefully — see Implementation Order in the Plan — to avoid the "redesign for its own sake" trap the client explicitly warned against)

---

### REQ-GLOBAL-002 — CONFIRMED DEFECT
**SOURCE:** Direct code inspection (this audit)
**SECTION:** Cross-role navigation confusion
**USER ROLE:** Vendor
**CLIENT REQUIREMENT:** Implicit in Phase 6's "confusing navigation" anti-pattern and the general "user should understand where they are" acceptance standard.
**INTENDED USER BEHAVIOUR:** A vendor tapping a vendor-dashboard button stays within a coherent vendor experience (or is clearly told they're switching context).
**CURRENT IMPLEMENTATION:** The vendor dashboard's "Community Buy — Organize a campaign" button navigates out of the `(vendor)` route group entirely, into `(buyer)/community-buy-organiser` — the same screen a buyer would reach from their own Profile menu — with no transition messaging explaining the switch.
**CURRENT STATUS:** FAIL — FUNCTIONAL GAP
**UX PROBLEM:** A vendor who is also acting as an organiser is silently dropped into buyer-navigation-shaped screens from a vendor-navigation-shaped entry point, with nothing marking the transition — this is precisely the kind of "confusing navigation" the client named as a problem category.
**USER FREEDOM ISSUE:** None directly, but disorientation ("where am I, why does this look different") undermines the user's sense of control.
**BUSINESS RULE:** Organiser is legitimately a buyer-side role even when the same human is also a vendor — the underlying design (one screen serving one role regardless of the user's other role) is reasonable. The gap is presentation, not architecture.
**REQUIRED UX:** Either give this entry point its own vendor-context-aware wrapper (same underlying organiser screen, addressed via a vendor-facing route so the tab bar/header context stays consistent), or, if that's not practical, at minimum a brief transitional cue (e.g. a header indicating "You're now in Organiser mode") so the shift is intentional-feeling rather than jarring.
**REQUIRED COMPONENT CHANGES:** Route/navigation wrapper change, or a header treatment change on the organiser screen when reached from a vendor context.
**REQUIRED BACKEND/API CHANGES:** None.
**QA REQUIRED:** A vendor tapping into "Organize a campaign" from their dashboard understands they've moved into a different role context, rather than experiencing it as an unexplained visual discontinuity.
**PRIORITY:** P1

---

### REQ-GLOBAL-003
**SOURCE:** Direct code inspection (this audit)
**SECTION:** Buyer/vendor parity — notifications entry point
**USER ROLE:** Buyer
**CLIENT REQUIREMENT:** Implicit consistency requirement (same feature should be equally discoverable for both roles unless there's a real reason not to be).
**INTENDED USER BEHAVIOUR:** A buyer can reach their notifications as easily as a vendor can reach theirs.
**CURRENT IMPLEMENTATION:** The vendor dashboard has a bell icon in its hero header, plus a bell on the order-detail screen, plus a Settings row — three real entry points. The buyer side has exactly one entry point to notifications: a row inside the Profile menu. No bell icon or equivalent exists anywhere on the buyer Home screen.
**CURRENT STATUS:** PARTIAL — UX/CONTROL GAP
**UX PROBLEM:** A buyer is less able to notice they have a new notification than a vendor is, for the identical underlying feature.
**USER FREEDOM ISSUE:** None directly — a discoverability/parity gap.
**BUSINESS RULE:** N/A.
**REQUIRED UX:** Add a bell icon to the buyer Home header, matching the vendor pattern.
**REQUIRED COMPONENT CHANGES:** Header icon addition on `app/(buyer)/index.tsx`, reusing the existing vendor bell component/pattern.
**REQUIRED BACKEND/API CHANGES:** None — the buyer notifications endpoint already exists and is already used by the Profile-menu entry point.
**QA REQUIRED:** A buyer with an unread notification notices it from Home, the same way a vendor would.
**PRIORITY:** P2

---

### REQ-GLOBAL-004
**SOURCE:** Client message (this engagement), Phase 7 (terminology audit)
**SECTION:** Prohibited terminology sweep
**USER ROLE:** All
**CLIENT REQUIREMENT:** Do not use: Escrow, Guaranteed revenue, Guaranteed savings, Investment, Deposit, Wallet (in the Community-Buy-money sense), Guaranteed target, "your order is confirmed before payment verification."
**INTENDED USER BEHAVIOUR:** No user is misled about the nature of their money.
**CURRENT IMPLEMENTATION:** Confirmed clean across the entire app, admin panel, and backend-facing service layer, with one nuance: "Escrow" is used extensively at the *code/variable/internal-type* level (function and type names in `services/escrowStatus.ts`, `types/order.ts`, admin nav labels) for the real, separate marketplace payment-protection feature (unrelated to Community Buy) — but the literal word is never shown to end users; rendered copy consistently uses "Protected payment" / "Protection window" / "Secured" instead. The one user-visible exception is the Terms of Service, which explicitly states "Eki is not a bank, financial institution, or regulated escrow provider" — a disclaimer, not a claim. One small, real inconsistency: the admin nav link is still labeled "Escrow" even though the page it opens is now a disabled stub with unrelated content. "Guaranteed revenue/savings/target", "Investment", and "Deposit" return zero matches anywhere. "Wallet" is used only for the legitimate, separate buyer/vendor Wallet feature — zero Community-Buy-money usage.
**CURRENT STATUS:** PASS (terminology discipline is already strong) with one **PARTIAL — UX GAP** noted (stale admin nav label).
**UX PROBLEM:** Minor — an admin clicking "Escrow" in the nav and landing on an unrelated disabled-feature page is a small, confusing mismatch, not a terminology-safety issue.
**USER FREEDOM ISSUE:** None.
**BUSINESS RULE:** N/A.
**REQUIRED UX:** Rename the admin nav item to match what the page actually now shows (or remove the link if the page is permanently retired).
**REQUIRED COMPONENT CHANGES:** One label change in `AdminLayout.tsx`.
**REQUIRED BACKEND/API CHANGES:** None.
**QA REQUIRED:** Re-run this same terminology sweep after the redesign ships, to confirm no new screen reintroduces any of the prohibited terms.
**PRIORITY:** P3 (maintain; fix the one stale label opportunistically)

---

*(End of matrix. Cross-referenced in `CLIENT_TO_SCREEN_TRACEABILITY.md` and `UX_REDESIGN_AUDIT.md`.)*
