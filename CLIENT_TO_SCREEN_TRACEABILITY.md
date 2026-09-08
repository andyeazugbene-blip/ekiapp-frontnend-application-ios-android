# CLIENT_TO_SCREEN_TRACEABILITY.md

**Purpose:** trace each requirement in `CLIENT_REQUIREMENTS_MATRIX.md` through the real chain — flow → screen → component → API → database state → notification → admin control → final user outcome — so gaps between what the backend supports and what the UI exposes are visible in one place, not buried in prose.

**Legend:** ✅ = confirmed working end-to-end. ⚠️ = link exists but is incomplete/inconsistent. ❌ = link is broken or missing. 🆕 = requires new backend work, not just a UI fix.

---

## AUTOMATION

### REQ-AUTO-001 / 003 / 006 — Per-type settings, eligibility, suppressed-state visibility

| Stage | Detail | Status |
|---|---|---|
| User flow | Vendor → Automation Centre → tap a type → Automation Detail | ✅ |
| Screen | `automation-center.tsx` (list) → `automation-detail.tsx` (detail) | ✅ |
| Component | Flat `FloatingCard` + `Switch` (list); `StatusPill` + one Activate/Deactivate `PrimaryButton` (detail) — no per-type settings component exists except a hardcoded 3-chip picker for 2 of 9 types | ⚠️ |
| API | `GET /vendors/me/automation` (list, real), `PATCH .../automation/:type` (toggle, real) | ✅ |
| Database state | `VendorAutomationSetting` row per type — need to confirm exact stored config shape (bounded to the 3 presets, or free numeric already supported and just unused by the client) | ⚠️ 🆕 (pending confirmation) |
| Notification | `AutomationRun` rows created per trigger, with real `SENT`/`SUPPRESSED`/`FAILED` status and `suppressedReason`/`failureReason` | ✅ (backend) |
| Admin control | Admin automation page shows aggregate sent/suppressed/failed counts platform-wide, but not per-vendor drill-down | ⚠️ |
| Final user outcome | Vendor cannot see WHY an automation is quiet (suppressed vs. genuinely nothing to do) — **the backend already knows the difference (`SUPPRESSED` status exists and is written), the frontend simply never asks for or renders it.** | ❌ **UI GAP** — highest-value single fix in this whole area |

### REQ-AUTO-004 — Buyer identity in Activity

| Stage | Detail | Status |
|---|---|---|
| User flow | Vendor → Automation Activity → tap a run | ✅ |
| Screen | `automation-activity.tsx`, modal in `automation-center.tsx` | ✅ |
| Component | Activity row / modal — renders order/product/referral/store detail, never recipient | ❌ |
| API | Activity-list endpoint | ⚠️ (needs confirmation it returns `recipientUserId`/name — likely returns the ID already since it's a real model field, just unused by the client render) |
| Database state | `AutomationRun.recipientUserId` — a real column, populated on every run | ✅ (backend) |
| Notification | N/A (this is about admin/vendor-facing display of an already-sent notification, not the notification itself) | — |
| Admin control | N/A | — |
| Final user outcome | Vendor cannot verify who was messaged. **Backend has the answer; frontend never displays it.** | ❌ **UI GAP** |

---

## REGULAR DELIVERY

### REQ-RD-001 — Offer creation → publish

| Stage | Detail | Status |
|---|---|---|
| User flow | Vendor → Regular Deliveries hub → "+" → single long form → Save → (separately) Publish | ⚠️ (two disconnected steps, no review) |
| Screen | `regular-delivery-offer-edit.tsx` | ✅ exists, ⚠️ sequencing |
| Component | One scrolling form, sections in non-required order (products last) | ⚠️ |
| API | `POST /subscription-offers` (create), `PATCH .../publish` (separate call) | ✅ both real, confirmed distinct |
| Database state | `SubscriptionOffer.publishedAt` (nullable) — a real draft/published distinction | ✅ (backend, working as designed) |
| Notification | None on publish (no evidence found of a "your offer went live" confirmation to the vendor beyond the generic Alert) | ⚠️ |
| Admin control | None — no admin page for Regular Delivery offers at all (see REQ-CB-A-007 for the parallel admin gap) | ❌ |
| Final user outcome | A vendor can complete the form, tap Save, and walk away believing they're done — **the offer is a real, correctly-stored draft, but nothing in the flow forces or clearly invites the second Publish step.** | ⚠️ **SEQUENCING GAP, not a data-loss risk** |

### REQ-RD-002 — "Every 4 weeks" frequency

| Stage | Detail | Status |
|---|---|---|
| User flow | Vendor sets frequency at offer creation; buyer picks it at subscribe time | ✅ for the 3 that exist |
| Screen | `regular-delivery-offer-edit.tsx` (vendor), `regular-delivery-offer.tsx` (buyer) | ✅ |
| Component | Frequency chip row, 3 options | ⚠️ (missing a 4th) |
| API | Offer/subscription creation payload includes `frequency: SubscriptionFrequency` | ⚠️ |
| Database state | `enum SubscriptionFrequency { WEEKLY BIWEEKLY MONTHLY }` — **no 4-weeks value exists in the schema at all** | ❌ 🆕 **BACKEND GAP, not a frontend oversight** |
| Notification | N/A | — |
| Admin control | N/A | — |
| Final user outcome | Neither vendor nor buyer can select a fixed 28-day cadence distinct from a calendar month, **because the database itself has nowhere to store that value.** | ❌ 🆕 |

### REQ-RD-004 — Substitution policy visible to buyer

| Stage | Detail | Status |
|---|---|---|
| User flow | Vendor sets policy at offer creation → (should) buyer sees it before/after subscribing | ⚠️ breaks at buyer side |
| Screen | `regular-delivery-offer-edit.tsx` (vendor, works) → `regular-delivery-offer.tsx` / `regular-delivery-detail.tsx` (buyer, never renders it) | ❌ on buyer side |
| Component | Vendor: real chip picker + conditional detail field. Buyer: no component exists for this field at all | ❌ |
| API | Vendor save call includes `substitutionMode` | ✅ |
| Database state | `SubscriptionOffer.substitutionMode` — stored correctly | ✅ (backend) |
| Notification | N/A | — |
| Admin control | N/A | — |
| Final user outcome | The vendor's real, saved choice is invisible to the one person it actually affects. **This is purely a missing read on an already-correct write — the buyer-facing API response for an offer/subscription likely already has this field available and it's simply not rendered.** | ❌ **UI GAP** |

### REQ-RD-006 — Stock-wait and fulfilment-method visibility

| Stage | Detail | Status |
|---|---|---|
| User flow | Buyer → subscription detail screen, expects to see current state | ⚠️ |
| Screen | `regular-delivery-detail.tsx` | ⚠️ |
| Component | Dedicated cards exist for price-approval and payment-failure; no equivalent card for `AWAITING_STOCK`; no row at all for fulfilment method | ❌ (2 of 7 required states) |
| API | Renewal/subscription detail response | ⚠️ (needs confirmation `fulfilmentMethod` is included — likely present since it's a stored offer field, just unrendered) |
| Database state | `RenewalStatus.AWAITING_STOCK` (real enum value, already has a label defined); `SubscriptionOffer.fulfilmentMethod` (real, stored at creation) | ✅ (backend) |
| Notification | Presumably a real notification fires when a renewal enters `AWAITING_STOCK` (consistent with the pattern used for price-approval and payment-failure) — not independently verified in this audit, flagged for confirmation | ⚠️ |
| Admin control | The admin exception queue does list "Awaiting vendor stock confirmation" as a category | ✅ (admin sees it; buyer doesn't have an equivalent clear card) |
| Final user outcome | A buyer's renewal can be stuck for a real, already-labeled reason, and admin can see that reason in their queue, but **the buyer — the person actually waiting — gets only a generic status pill, not an explanation.** | ❌ **UI GAP**, buyer-side specifically |

---

## COMMUNITY BUY — PARTICIPANT

### REQ-CB-P-001 — Home discovery entry point

| Stage | Detail | Status |
|---|---|---|
| User flow | Buyer opens Home → (should) sees Community Buy | ❌ breaks at first step |
| Screen | `app/(buyer)/index.tsx` — zero Community Buy references | ❌ |
| Component | None exists | ❌ |
| API | Buyer Home data-loading call — would need the same market-gate check the vendor dashboard already performs | ⚠️ (gate logic exists elsewhere, just not wired to this screen) |
| Database state | `MarketConfiguration.communityBuyEnabled` — real, per-market flag, already correctly used to gate the vendor-side entry point | ✅ (backend, proven working elsewhere) |
| Notification | N/A | — |
| Admin control | Admin controls this exact flag via Market Controls | ✅ |
| Final user outcome | A buyer in an enabled market has no way to discover Community Buy unless they already know to check Profile, or happen to receive a push notification about a campaign they're already part of. **The gating mechanism is proven and correct; it's simply never consulted by the Home screen.** | ❌ **UI GAP**, highest-priority in the whole audit — this blocks discovery of the entire feature |

### REQ-CB-P-005 — FAILED-campaign refund contradiction

| Stage | Detail | Status |
|---|---|---|
| User flow | A campaign fails to reach minimum → participant and organiser both view outcome | ⚠️ |
| Screen | `community-buy-campaign.tsx` (participant) vs. `community-buy-organiser-campaign.tsx` (organiser) | ⚠️ both render, but disagree |
| Component | Outcome-banner text block, hardcoded per status on each screen independently | ❌ (duplicated, drifted) |
| API | Both screens read the same `CommunityCampaign.status === "FAILED"` value | ✅ (same source data) |
| Database state | Whatever `campaign-contributions.service.ts`'s real failure-handling logic actually does to existing contributions on a below-minimum outcome — **not independently re-verified in this audit; this is exactly the fact that must be confirmed before either copy block is trusted** | ⚠️ **NEEDS BACKEND VERIFICATION** |
| Notification | Presumably a real notification accompanies this outcome for both roles — content should be corrected alongside the in-app copy once the truth is confirmed | ⚠️ |
| Admin control | Admin's own FAILED-status label is a neutral "Did not reach minimum," which sidesteps the refund-mechanics question entirely — admin isn't shown enough to catch this contradiction either | ⚠️ |
| Final user outcome | **Two different users can be told two different, incompatible things about the same real event, from the same underlying data.** This is a copy-authoring bug, not (as far as this audit can determine) a data bug — but it cannot be fixed by guessing which line is right. | ❌ **CONFIRMED DEFECT, blocked on backend verification** |

### REQ-CB-P-008 — Fulfilment tracking for participants

| Stage | Detail | Status |
|---|---|---|
| User flow | Campaign succeeds → enters fulfilment → participant wants to check progress | ❌ breaks here |
| Screen | `community-buy-campaign.tsx` — no fulfilment-tracker reference at all | ❌ |
| Component | The step-tracker component exists and is used by `community-buy-organiser-campaign.tsx` and `community-buy-supplier-fulfilment.tsx` — it is simply never reused on the participant screen | ❌ (reuse gap, not a build-from-scratch gap) |
| API | Organiser/supplier fulfilment endpoints return the step data; participant-facing campaign endpoint status unconfirmed | ⚠️ 🆕 (confirm/extend) |
| Database state | `CampaignFulfilment` — a real, structured model, already fully populated by the time a campaign is in this stage | ✅ (backend) |
| Notification | Manual "Campaign updates" posts are the only channel participants currently get for fulfilment news | ⚠️ (works, but depends on a human remembering to post) |
| Admin control | Admin's Fulfilment Delays page can see stuck fulfilments — but this is an internal admin tool, not something a participant benefits from directly | — |
| Final user outcome | A participant is fully dependent on someone else remembering to post an update, for data that **already exists, in structured form, and is already rendered correctly two screens away.** | ❌ **UI GAP — pure reuse opportunity, low backend risk** |

---

## COMMUNITY BUY — ORGANISER

### REQ-CB-O-003 — Fee disclosure

| Stage | Detail | Status |
|---|---|---|
| User flow | Organiser fills campaign-creation form → sets price per share → (should) sees fee impact → submits | ❌ breaks before submit |
| Screen | `community-buy-organiser-campaign.tsx` (creation form) | ❌ no fee row |
| Component | None exists | ❌ |
| API | Creation-form data-loading call — would need the market's fee rate included | ⚠️ 🆕 (confirm/extend) |
| Database state | `MarketConfiguration.organiserFeeBps` — a real, per-market-configured value | ✅ (backend, confirmed to exist from this engagement's own earlier backend work) |
| Notification | N/A | — |
| Admin control | Admin sets `organiserFeeBps` via Market Controls | ✅ |
| Final user outcome | An organiser commits to a price-per-share without ever seeing the real, already-configured fee that will apply. **The number exists and is administered correctly; it's simply never shown to the person whose pricing decision depends on it.** | ❌ **UI GAP** |

---

## COMMUNITY BUY — SUPPLIER

### REQ-CB-S-001 — Reject/decline capability

| Stage | Detail | Status |
|---|---|---|
| User flow | Supplier is assigned a campaign → (should) accept or reject | ❌ only accept exists |
| Screen | `community-buy-supplier.tsx` | ❌ no reject control |
| Component | "Confirm supply commitment" button only | ❌ |
| API | No reject/decline method in the service layer at all | ❌ 🆕 **does not exist, must be built** |
| Database state | No status transition exists for a rejected commitment | ❌ 🆕 |
| Notification | N/A — nothing to notify about, since the action doesn't exist | — |
| Admin control | N/A | — |
| Final user outcome | A supplier who wants to decline has no real path — this is the one Community Buy gap in this whole audit that is a genuine missing capability on both ends, not a display gap on top of working logic. | ❌ **REAL FUNCTIONAL GAP, requires new backend logic** |

### REQ-CB-S-003 — Supplier can post updates

| Stage | Detail | Status |
|---|---|---|
| User flow | Supplier wants to tell participants about a delay → (should) post an update | ❌ breaks here |
| Screen | `community-buy-supplier.tsx` / `community-buy-supplier-fulfilment.tsx` — no compose-update control | ❌ |
| Component | The organiser's update-composer exists and works; nothing equivalent on supplier screens | ❌ (reuse gap) |
| API | `CampaignUpdateAuthorRole` enum already includes `SUPPLIER` as a valid author | ✅ (backend already models this correctly) |
| Database state | `CampaignUpdate` rows already render correctly on the participant side regardless of author role | ✅ (backend + participant display both already correct) |
| Notification | Participants are already notified of new updates regardless of author (confirmed via the participant-side update feed) | ✅ |
| Admin control | N/A | — |
| Final user outcome | **The backend already fully supports a supplier-authored update, end to end, including participant display. The only missing piece is a compose button on the supplier's own screen.** | ❌ **UI GAP — smallest-effort, highest-clarity fix in this whole audit** |

---

## COMMUNITY BUY — ADMIN

### REQ-CB-A-001 — Missing confirmation dialogs

| Stage | Detail | Status |
|---|---|---|
| User flow | Admin clicks Pause/Approve/Release/Restrict/Send-response → action fires | ❌ no confirmation step |
| Screen | `community-campaigns/page.tsx`, `community-refunds/page.tsx`, `community-verification/page.tsx`, `community-support-cases/page.tsx`, `community-markets/page.tsx` | ❌ across all five |
| Component | Plain `Button onClick={...}` with no intermediate dialog, in every case listed | ❌ |
| API | Real, working endpoints for every action (approve/reject/pause/resume/release/hold/recheck/escalate/verify/restrict/save-note/send-response/toggle-flag) | ✅ (this is the frustrating part — the actions themselves all work correctly) |
| Database state | Every action correctly updates real state and (per the codebase's own general pattern) is presumably audit-logged like other admin mutations | ✅ (backend logic is sound) |
| Notification | "Send response to reporter" specifically fires a real, customer-visible message with no admin-side confirmation at all | ❌ **highest-risk single item** |
| Admin control | This IS the admin control — the gap is the missing safety rail in front of it | — |
| Final user outcome | **Every one of these backend actions is correct and necessary. The entire gap is a missing confirmation step in front of already-correct functionality — the cheapest possible fix for the highest-visibility problem in the admin audit.** | ❌ **UI GAP, zero backend risk, P0** |

### REQ-CB-A-007 — Admin Regular Delivery tooling

| Stage | Detail | Status |
|---|---|---|
| User flow | Admin → (should) see and act on stuck subscriptions | ⚠️ can see, cannot act |
| Screen | `subscription-exceptions/page.tsx` | ⚠️ view-only |
| Component | Read-only list, zero action buttons | ❌ |
| API | No admin-scoped remediation endpoints exist for retry-payment/approve-price/force-cancel on a buyer's behalf | ❌ 🆕 |
| Database state | The underlying `Renewal`/`BuyerSubscription` records are real and correctly reflect the stuck state | ✅ (backend data is correct — admin just can't act on it) |
| Notification | N/A for admin action (none exists to notify about) | — |
| Admin control | This is precisely the missing control | ❌ 🆕 |
| Final user outcome | **Admin can observe a real customer's stuck money-moving transaction and do nothing about it from within the tool built for exactly this purpose.** | ❌ 🆕 **REAL FUNCTIONAL GAP — this is the most operationally serious finding in the entire audit** |

---

## SUMMARY — WHERE THE BACKEND IS AHEAD OF THE UI

The pattern across nearly every "UI GAP" row above is consistent: **the backend already computed or stored the correct answer, and the screen simply never asked for it.** In order of how much real backend work each actually needs:

1. **Zero backend work, pure display fixes:** Suppressed-automation visibility (REQ-AUTO-006), buyer identity in Automation Activity (REQ-AUTO-004), substitution policy shown to buyer (REQ-RD-004), stock-wait/fulfilment-method cards (REQ-RD-006), participant fulfilment tracker reuse (REQ-CB-P-008), organiser fee disclosure (REQ-CB-O-003, pending one field addition to a response), supplier update-posting (REQ-CB-S-003), all admin confirmation dialogs (REQ-CB-A-001), stale admin nav label (REQ-GLOBAL-004), unrendered admin campaign fields (REQ-CB-A-006).
2. **Small, well-scoped new backend work:** Community Buy Home entry point gating (REQ-CB-P-001 — reuses an existing flag, just needs wiring to a new screen), admin live-campaign refresh (REQ-CB-A-005), buyer-side notification bell (REQ-GLOBAL-003).
3. **Genuine new backend capability required:** Supplier reject/decline (REQ-CB-S-001), admin Regular Delivery remediation actions (REQ-CB-A-007), "Every 4 weeks" frequency (REQ-RD-002, pending client confirmation of intent), admin campaign edit/cancel (REQ-CB-A-002, pending scope decision), force-refund (REQ-CB-A-003, pending financial-safety scoping).
4. **Needs investigation before any fix, backend or frontend:** The FAILED-campaign refund-copy contradiction (REQ-CB-P-005) — the single most important item to resolve first, since building UI on top of an unverified fact would risk shipping a confident-sounding but still-wrong statement to real users.
