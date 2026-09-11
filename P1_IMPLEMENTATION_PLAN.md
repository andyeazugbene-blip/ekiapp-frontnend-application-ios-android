# P1 Implementation Plan

**Date:** 2026-09-09
**Scope:** Re-verification of all 26 P1 findings from `FINAL_CLIENT_GAP_AUDIT.md` / `FINAL_CLIENT_REQUIREMENTS_STATUS.md` against current code (post-P0-hardening commits `83a370a` backend / `7180b0b` frontend), plus the two special checks requested (buyer_order_confirmed, shipped/delivered double-send). **No code was changed to produce this document.** This is a triage/planning document only — implementation has not started.

**Companion documents:** `FINAL_CLIENT_GAP_AUDIT.md`, `FINAL_CLIENT_REQUIREMENTS_STATUS.md`, `FINAL_MANUAL_QA_PLAN.md`.

---

## Phase P1-1 Implementation Status (2026-09-09) — IMPLEMENTED, PENDING COMMIT APPROVAL

All 7 Phase P1-1 items (Section 8) are implemented, tested, and verified in the working tree. **Not committed or pushed — awaiting explicit approval.** See the end-of-session completion report for full root-cause/fix/test detail per item. One-line status per item:

| ID | Status |
|---|---|
| SEC-01 | Fixed — `listPublic()`/`getPublic()` added; public routes now return only the 7 gating fields; `get()`/`list()` unchanged for internal callers. |
| NAV-04 | Fixed — all 4 payout notifications carry `data.type`; frontend routes to `/(vendor)/payout-history`. |
| REG-01 | Fixed — root cause was a test-mock gap (unmocked dynamic import), not a production bug; `escrowService` now mocked in the test. Confirmed deterministic across repeated runs. |
| NAV-05 | Fixed — both escrow notifications carry `data.type: "order_status"`; the redundant `pushNotifications.orderStatusUpdate()` duplicate on delivery-confirm removed. |
| CBA-06 | Fixed — `escalateRefund()` now idempotent (new `escalated`/`escalatedAt`/`escalatedSupportCaseId` columns + migration, atomic claim against a concurrent race). |
| PAY-03 | Fixed — 5 confirmed strings reworded from "escrow" to "secured/protected payment" language, matching existing frontend copy. |
| NOTIF-DUP-01 | Fixed — CAMPAIGN_MILESTONE/CAMPAIGN_REFUND_UPDATE's redundant `scheduleAutomation()` calls removed (no shared dedupeKey, no vendor-toggle semantics to preserve); RENEWAL_REMINDER/PRICE_APPROVAL_REMINDER's push channel now gated on the same dedupeKey the in_app channel already respected. |

Full backend suite: 96 files / 1348 tests passing. Backend typecheck, mobile typecheck, admin-web typecheck+build, no-mock-data check, tab-registration check: all clean. P1-2/P1-3/P1-4/P1-5 remain entirely unstarted.

---

## 1. Executive Summary

All 26 P1 findings were re-verified directly against current source (not assumed from the audit docs). **None were incidentally fixed by the P0 hardening work** — P0's scope was narrow by design (4 specific fixes) and none of its file changes overlap with any P1's location, confirmed by re-reading every P1's cited file/function directly. One item (REG-01) got *new* evidence that changes its risk profile: re-running the failing test in isolation shows it fails **deterministically**, not intermittently as originally suspected — root cause is very likely identifiable and is diagnosed below, not fixed.

One accounting discrepancy in the source audit is worth flagging up front: `FINAL_CLIENT_GAP_AUDIT.md`'s own P1 table lists 24 IDs (not the 22 its own text claims), and separately states "4 more are variants... AUTO-04 pairing with AUTO-01/AUTO-02" to reach 26. Taken literally, table (24) + AUTO-01 + AUTO-02 = 26, which is internally consistent even though the "22" in the prose is off by two. Independently, this re-verification pass surfaced one FAIL-severity item — **PAY-03** (user-facing "escrow" language) — that exists in the requirements matrix with FAIL status but was never bucketed into the P0/P1/P2 lists by the original audit at all. It is real, current, user/buyer-facing, and trivial to fix (string replacement, no logic risk), so it is added to this plan as a 27th tracked item rather than silently dropped or silently folded into the stated "26." This is disclosed, not invented — the underlying finding already existed in the source audit; only its priority bucket was missing.

No new P0 was found. The two special checks (below) both confirm real, already-flagged behavior — neither is a new critical risk, both are correctly classified as P1/informational.

---

## 2. Current P1 Count

- **26 P1 IDs from the source audit** (24 explicit table entries + AUTO-01/AUTO-02 bundled under AUTO-04 per the audit's own accounting) — all re-verified.
- **+1 additional item surfacing during this pass:** PAY-03, previously an unbucketed FAIL. Total tracked in this plan: **27**.
- **0 became PASS.** **0 new P0s.** **2 reclassified as BLOCKED-CLIENT-DECISION-only within their own scope** (RD-08's non-retry-payment asks; RD-05's frequency-edit half) — these were already partially flagged this way in the source audit; this pass confirms exactly which slice of each is safe to build now vs. blocked.

---

## 3. P1s That Became PASS After P0 Work

**None.** P0 touched exactly: `vercel.json`, `automation.service.ts` (comment only), `payouts.service.ts`/`payouts.controller.ts`, `communication.service.ts`, `orders.service.ts`/`payments.service.ts`/`stripe.service.ts` (added `data.orderId` to 3 already-existing send calls), `app/_layout.tsx` (added `vendor_verification_*`/6-event routing), `community-campaigns/page.tsx` (2FA modal), `payout-requests/page.tsx` (ON_HOLD/PROCESSING UI). None of these are the files/functions any P1 lives in. Verified directly, not inferred — see Section 4 for per-item evidence.

---

## 4. P1s Still Open (Re-Verified Against Current Code)

Each entry: **Status** (re-confirmed) · **Evidence** (current code, re-read this pass) · **Complexity** · **Category**.

### Category P1-A — Production Correctness / Money / Security

**NAV-04 — Payout lifecycle notifications (requested/approved/rejected/paid) are dead taps**
Status: **FAIL, confirmed unchanged.** `payouts.service.ts` still sends all 4 notifications (`PAYOUT_REQUESTED` line 116, `PAYOUT_APPROVED` line 177, `PAYOUT_REJECTED` line 242, `PAYOUT_PAID` in the new `sendPayoutPaidNotificationAndReceipt` helper) with `data: { payoutRequestId, ... }` — **none set `data.type`**. `app/_layout.tsx`'s router only matches `type === "payout_approved"`, which no backend call ever sets — confirmed still-dead branch. P0-2 rewrote the surrounding payout status machinery extensively but did not touch these notification payloads.
Role: Vendor. Business impact: vendor never learns their payout state changed except by opening the app manually — real trust/support-load cost on a financial event. UX impact: high (silent, no fallback). Backend: add `data.type` per event (`payout_requested`/`payout_approved`/`payout_rejected`/`payout_paid`) + real `payoutRequestId`. Frontend: add 4 matching branches to `handleNotificationTap`, mirroring the exact P0-3 pattern already used for the 6 communications events. Admin: none. Payment/security risk: none directly, but a vendor who can't easily confirm payout status is more likely to raise disputes/support tickets over money that did move correctly. Dependencies: none; shares `app/_layout.tsx` with NAV-05/08/10 — batch together. Complexity: **Small**.

**NAV-05 — Escrow "delivery confirmed" / "auto-release" notifications are dead taps (delivery-confirm also double-sends)**
Status: **FAIL (auto-release) / PARTIAL (delivery-confirm), confirmed unchanged.** `escrow.service.ts`: delivery-confirm (line ~406) sends `notificationsService.enqueue({..., data:{orderId}})` (no `type` — dead) **and separately** calls `pushNotifications.orderStatusUpdate(...)` (line 415), which — confirmed via `push-notifications.ts:29-35` — sends a **second**, correctly-routable push (`data:{type:"order_status", orderNumber, status, orderId}`). Auto-release (line ~474) sends only the dead-tap version, no duplicate. Untouched by P0.
Role: Vendor. Business impact: escrow auto-release (a real-money event) is silently untappable; delivery-confirm produces 2 pushes, 1 useless. UX: confusing/duplicate. Backend: give the delivery-confirm and auto-release `notificationsService.enqueue()` calls a real `data.type`, and remove (or fold into) the redundant `pushNotifications.orderStatusUpdate()` duplicate on delivery-confirm — collapse to one correctly-routed push. Frontend: none needed if backend reuses `order_status`. Admin: none. Payment/security risk: none directly (informational only), but escrow auto-release is exactly the kind of event a vendor should be able to act on/verify. Dependencies: shares `escrow.service.ts` with PAY-03 (same file, different function) — do in one pass. Complexity: **Small**.

**PAY-03 — Real "escrow" language survives in user-facing strings** *(newly explicit-P1-classified this pass — see Section 1)*
Status: **FAIL, confirmed unchanged.** `dispute.service.ts:84`: `"A buyer has raised a dispute for order ${orderNumber}. The escrow is frozen until resolved."` — vendor-visible notification body. `paystack.service.ts`: 4 buyer-visible `AppError` checkout strings still say "escrow" (`"Escrow checkout supports one vendor per secured order..."`, `"Escrow checkout is not available because..."`, `"Domestic escrow checkout only supports items from a single vendor country"`, `"Escrow checkout is not available for this vendor country yet"`). Marketing-site copy not re-checked this pass (3 lines per original audit; no reason to expect it changed, P0 didn't touch `public-site.page.ts`).
Role: Buyer, Vendor, public visitors. Business impact: low (no functional break) but real trust/positioning risk — "escrow" implies custodial holding the product deliberately avoids claiming elsewhere. UX: minor confusion at checkout-failure time. Backend: reword the 5 confirmed strings (1 notification body + 4 error strings) to the same "protected/secured payment" language already used correctly on order-status screens. Frontend: none (these are backend-authored strings). Admin: none. Payment/security risk: none — reword only, zero logic change. Dependencies: none. Complexity: **Small** (pure string edits, but touch legal-adjacent wording — recommend a quick legal/copy sign-off given the Terms page's deliberate, different use of "escrow" to *disclaim* being one).

**SEC-01 — Public MarketConfiguration endpoints over-expose fields**
Status: **FAIL, confirmed unchanged.** `market-configuration.service.ts:74,79` — `get()`/`list()` are still bare `findUnique`/`findMany` with **no `select` clause**, confirmed by direct re-read. `community-buy.controller.ts`'s public routes still call these unauthenticated. Untouched by P0 (P0 never touched this module).
Role: All (unauthenticated). Business impact: commercially sensitive config (fee bps, live/test payment mode per market) readable by any unauthenticated party today, right now. UX: none. Backend: add an explicit `select`/mapper restricting the public response to `countryCode, currency, communityBuyEnabled, communityBuyPaymentsEnabled, organiserApplicationsEnabled, supplierApplicationsEnabled, regularDeliveriesEnabled`. Frontend: none (mobile app already only reads the gating flags). Admin: none. Payment/security risk: **real, live data-disclosure** — not exploitable for fraud/account-takeover, but should not ship as-is; it is currently shipped. Dependencies: none — safe to fix same-day. Complexity: **Small**.

**CBA-06 — `escalateRefund()` is not idempotent**
Status: **PARTIAL, confirmed unchanged.** `campaign-contributions.service.ts:696-708` — `escalateRefund()` still unconditionally calls `supportCaseService.create()` then `adminUpdate(..., {escalated:true})` on every call, with no check for an existing case tied to this refund and no persisted `escalated` marker read back before creating. A reload + re-click still creates a duplicate `CommunityBuySupportCase`. Untouched by P0.
Role: Admin. Business impact: duplicate support cases clutter the queue and could confuse refund-status reporting; low financial risk (no double-refund, just double-case). Backend: check for an existing open support case for this refund before creating a new one (or persist/read an `escalated` flag on `CampaignRefund` directly, matching `requeryRefund()`'s already-idempotent pattern one function above it in the same file). Frontend: remove the client-session-only "Escalated" badge once the backend state persists correctly. Admin: direct UX fix on the refund-case screen. Payment/security risk: none. Dependencies: none. Complexity: **Small**.

**NOTIF-DUP-01 — 4 event types send 2 pushes for 1 event**
Status: **FAIL, confirmed unchanged for the 2 sites directly re-checked.** `community-campaigns.service.ts`: the `cancelAfterFailure` path (line ~703-718) calls `notifyCampaign(p.userId, "cancelled", ...)` (real push+in-app via `notificationsService.enqueue`) **and** `automationService.scheduleAutomation({type:"CAMPAIGN_REFUND_UPDATE", ...})` for the same participant, same event, in the same loop. `notifyOutcome("succeeded")` (line ~836-850) does the identical double-fire for `CAMPAIGN_MILESTONE`. Both `automationService`-side sends are also **dead taps** per NAV-10 below — so today the user actually gets one working push + one silent no-op push, not two working duplicates; that changes once NAV-10 is fixed (see Section 7, Dependencies). Renewal-reminder / price-approval-reminder sites (subscriptions module) were not re-derived line-by-line this pass — no reason to expect they changed (P0 didn't touch that module) — carried forward from the original audit at the same confidence level.
Role: Buyer, Vendor. Business impact: none direct; UX/trust cost at scale (users get spammed). Backend: stop double-triggering — either drop the `scheduleAutomation()` call for these 4 event types (the `notifyCampaign`/direct-enqueue path already covers them correctly) or gate the push channel in `communicationService.send()` on the same dedupe outcome the in-app channel already respects. Frontend: none. Admin: none. Payment/security risk: none. Dependencies: **must be sequenced with or before NAV-10** — implementing NAV-10's missing frontend branches without also fixing this would turn an invisible duplicate into a visible, tappable duplicate (a worse regression, not a fix). Complexity: **Medium** (touches 2 confirmed call sites + at least 2 more in the subscriptions module not re-derived this pass — verify count before estimating final effort).

**REG-01 — Backend test suite: `dispute-resolution.test.ts` timeout** *(re-verified live this pass — re-run in isolation, not just re-read)*
Status: **Upgraded finding.** Re-ran `dispute-resolution.test.ts` in isolation just now: 4/5 tests pass, "a vendor-favour resolution never calls the refund provider" times out at exactly 5000ms **every time**, not intermittently — this is stronger evidence than the original audit had (which only saw it fail once, in the full suite run, and flagged it as "more consistent with flakiness, re-run to confirm"). Reading `dispute.service.ts:250-254`, the vendor-resolution branch does `const { escrowService } = await import("./escrow.service.js");` — a **dynamic import**, awaited directly, of a module the test file does not mock. This is a strong, specific lead: the real `escrow.service.ts` (and whatever it transitively imports — real Prisma client init, real Paystack SDK init, etc.) is very likely being loaded for real inside a unit test that mocks everything else, and something in that real import graph hangs (most plausibly a real `PrismaClient` construction attempting a connection the test environment never provides). This reads as a **test-infrastructure gap** (missing mock for the dynamic import), not a demonstrated production bug — in production this same dynamic import always resolves against already-loaded modules and returns instantly.
Role: n/a (test suite / CI confidence). Business impact: a real test covering money-adjacent dispute-resolution logic cannot currently run to completion, so that logic path has less actual regression coverage than the suite's pass count implies. Backend: add a `vi.mock("../modules/paystack/escrow.service", ...)` (mirroring how `dispute-resolution.test.ts` already mocks its other dependencies) so the dynamic import resolves against a mock instead of the real module graph; re-run to confirm the hang disappears. Frontend: none. Admin: none. Payment/security risk: none directly, but "the dispute/refund test suite doesn't fully run" is exactly the kind of gap that should be closed before doing more work in that area. Dependencies: none. Complexity: **Small** (test-only fix, once diagnosed — diagnosis is now done; not implemented per this phase's no-code-changes instruction).

### Category P1-B — Broken User Journeys

**NAV-08 — Community Buy organiser-targeted events misroute to the participant screen**
Status: **FAIL, confirmed unchanged.** Re-read `app/_layout.tsx:220-234` directly: the `community_campaign_update` branch's organiser allow-list is still exactly `approved|changes_requested|rejected|supplier_accepted|inventory_confirmed`. Every other organiser-directed event (`admin_cancelled`, `cancelled`, `rescue_opened`, `extension_approved`, `succeeded`, `failed`, `supplier_declined`, organiser-recipient `fulfilment_update`) falls through to the final `else` → participant screen. Confirmed still real — including the most time-sensitive case, `supplier_declined`, exactly as the original audit found. Untouched by P0 (P0 only added `vendor_verification_*`/order-event branches to this same function, not touching the `community_campaign_update` branch's logic).
Role: Organiser. Business impact: an organiser whose supplier just declined lands on a read-only screen instead of the reassignment flow, at the exact moment speed matters. Backend: none — this is a frontend routing-table gap only (the backend already sends the correct `event` value; verified `notifyCampaign()` passes `event` through unchanged). Frontend: expand the organiser allow-list in `handleNotificationTap` to cover every organiser-directed event actually fired. Admin: none. Dependencies: shares `app/_layout.tsx` with NAV-04/05/10 — batch together. Complexity: **Small**.

**NAV-10 — 4 of 12 Automation push types are dead taps for buyers**
Status: **FAIL, confirmed unchanged.** Re-read `app/_layout.tsx:235-249` directly: the `automation_` branch still only explicitly handles `cart_recovery`, `review_request`, `buyer_referral`, `renewal_reminder`/`price_approval_reminder`, `payment_recovery`; falls through to `role === "vendor"` → Automation Centre, or **nothing at all for a buyer** on `automation_buyer_win_back`, `automation_campaign_milestone`, `automation_campaign_deadline`, `automation_campaign_refund_update`. Confirmed silent no-op for buyers on these 4, exactly as audited.
Role: Buyer. Business impact: 2 of the 4 (campaign milestone/refund-update) are Community Buy financial-lifecycle events — time-sensitive, tappable-but-dead. Backend: none needed beyond confirming `campaignId`/entity id is already present in the `data` payload for these types (spot-checked: `community-campaigns.service.ts` passes `data:{campaign_title}` only, **no `campaignId`** — this needs adding for the new branches to route anywhere useful). Frontend: add the 4 missing branches + a generic fallback (route to Home/Notifications) instead of silent no-op for any future unhandled automation type. Admin: none. Dependencies: **must not ship before or without NOTIF-DUP-01's fix for the 2 overlapping types** (see above) — shares `app/_layout.tsx` with NAV-04/05/08. Complexity: **Small–Medium** (frontend trivial; backend needs one field added to 2-3 call sites first).

**RD-09 — Vendor sees raw enum status text instead of the existing label map**
Status: **FAIL, confirmed unchanged.** Re-read both files directly: `regular-deliveries.tsx:196` — `s.status.replace("_", " ")`. `regular-delivery-subscriber-detail.tsx:72` — `subscription.status.replace("_", " ")`. Both sit one line/a few lines away from correct usage of `RENEWAL_STATUS_LABELS[r.status]` for the sibling `Renewal.status` field in the same files — confirmed the map exists and works, it's just not applied to `BuyerSubscriptionStatus`.
Role: Vendor. Business impact: none functional; pure clarity/professionalism ("PAYMENT ATTENTION" style raw enum text next to a properly-labeled sibling field looks like a bug even though nothing is broken). Backend: none. Frontend: import and apply the existing `BUYER_SUBSCRIPTION_STATUS_LABELS` map (confirmed to already exist per the original audit — reused, not invented) at both sites. Admin: none. Dependencies: none. Complexity: **Small** (genuinely one-line-per-site).

### Category P1-C — Missing Required Functionality

**RD-08 — Admin has no Regular Delivery remediation tooling** *(retry-payment slice only — see Section 10 for the rest)*
Status: **FAIL, confirmed unchanged.** Re-read `admin-web/src/app/subscription-exceptions/page.tsx` in full (91 lines) — confirmed still 100% read-only: 3 metric cards + a list, zero buttons, zero handlers, zero mutation calls. No admin-scoped service method exists beyond the single `GET /admin/subscription-exceptions` route (re-confirmed no new admin RD routes were added by P0).
Role: Admin. Business impact: admin cannot act on a real stuck payment today — a genuine real-money feature with zero recourse. Backend: add one admin route wrapping the already-idempotent `attemptPayment()` (`renewals.service.ts` — an admin call is just a third caller of the same safe path already used by the buyer-initiated and cron-initiated callers). Frontend (admin-web): add a "Retry payment" button to each `PAYMENT_FAILED` row on `subscription-exceptions/page.tsx`, calling the new route, with a confirm dialog (consistent with UX-06/CBA-12's confirm-everywhere pattern). Admin: this *is* the admin surface. Payment/security risk: low — reuses an already-idempotent, already-tested payment path; add an audit-log entry for the admin action (matches every other admin mutation in this codebase). Dependencies: none. Complexity: **Small**. **Approve/deny price-change-on-buyer's-behalf, force-cancel, and contact-buyer are explicitly NOT included in this phase — see Section 10.**

**RD-04 — Pre-subscribe screen still missing fulfilment/substitution info**
Status: **PARTIAL, confirmed unchanged.** Re-read `regular-delivery-offer.tsx` — zero matches for "fulfilment"/"substitution" anywhere in the file; the post-subscribe screen (`regular-delivery-detail.tsx`) does render both correctly (fixed since the docs, per the original audit), confirming the data and label maps already exist and just aren't reused here.
Role: Buyer. Business impact: buyer commits to a subscription without seeing fulfilment method or substitution policy — a real pre-purchase disclosure gap. Backend: none — data already loaded in the `offer` object. Frontend: add a fulfilment/substitution info block to the pre-subscribe screen, reusing the exact label maps already used on the post-subscribe screen. Admin: none. Dependencies: none. Complexity: **Small**.

**RD-05 — Buyer pause has no resume-date picker** *(resume-date slice only — frequency-edit is BLOCKED, see Section 10)*
Status: **PARTIAL, confirmed unchanged.** Re-read `regular-delivery-detail.tsx:310` — the Pause `ActionButton` still calls `regularDeliveriesService.pauseSubscription(sub.id)` with no date argument at all. Backend already accepts `resumeAt` per the original audit (not re-derived this pass, no reason to expect it changed — P0 didn't touch this module).
Role: Buyer. Business impact: buyer can pause but can't tell the system when to auto-resume, forcing manual resume or indefinite pause. Backend: none (already supports it). Frontend: add a date picker to the Pause flow, wire it into the existing `pauseSubscription(id, resumeAt?)` call. Admin: none. Dependencies: none. Complexity: **Small**.

**RD-10 — Product-level pause collects no reason or expected-return date**
Status: **FAIL, confirmed unchanged.** Re-read `regular-delivery-offer-edit.tsx:201` — the pause action still calls `pauseOfferProduct(offerId, productId)` with no reason/date arguments. Note: the service method itself (`regularDeliveriesService.ts:357`) has *already* gained an optional `reason?: string` parameter since the original audit — but it is never populated by any call site, and there is still no `expectedReturnAt` parameter at all. So the UI-facing gap is unchanged even though the service signature is one field closer to ready.
Role: Vendor. Business impact: buyer-side display already supports rendering both fields (confirmed by the original audit, not re-derived) — vendor just has no way to populate them. Backend: add `expectedReturnAt` to `pauseOfferProduct()`. Frontend: add a reason text field + date picker to the pause trigger UI, pass both through. Admin: none. Dependencies: none. Complexity: **Small–Medium**.

**REQ-CB-P-008 — Participant fulfilment tracker never renders real status**
Status: **PARTIAL, confirmed unchanged.** Re-read `community-buy-campaign.tsx:198-199` — still a static "Fulfilment updates will be shared with participants" sentence regardless of real `fulfilment.status`. Confirmed by contrast: `community-buy-organiser-campaign.tsx:526` **does** render `FULFILMENT_STEP_LABEL[fulfilment.status]` correctly for the organiser — the label map and backend data are proven to exist and work, just not wired into the participant screen.
Role: Participant. Business impact: none functional (data exists, just not shown) — real trust/transparency gap post-purchase. Backend: none. Frontend: render `FULFILMENT_STEP_LABEL[fulfilment.status]` on the participant screen, same pattern as the organiser screen. Admin: none. Dependencies: none. Complexity: **Small** — cheapest, highest-value item in this entire plan.

**CBO-13 — Organiser has no live progress visualization for a healthy LIVE campaign**
Status: **PARTIAL, confirmed unchanged.** Re-read `community-buy-organiser-campaign.tsx:535-553` — the LIVE-status branch renders only a "want to help this along?" top-up prompt card, no `RangeProgressBar`. The component is imported and used elsewhere in the same file (edit/review context, line 454) — confirmed real and reusable, just not rendered in the live-monitoring branch.
Role: Organiser. Business impact: none functional; organiser can't see progress at a glance until the campaign is already in crisis (RESCUE_WINDOW), which is exactly backwards from what's useful. Backend: none. Frontend: render the existing `RangeProgressBar` in the LIVE branch alongside the top-up card. Admin: none. Dependencies: none. Complexity: **Small**.

**CBA-09 — `pause()`/`resume()` admin campaign controls never notify the organiser**
Status: **PARTIAL, confirmed unchanged.** Re-read `community-campaigns.service.ts:402-414` — both `pause()` and `resume()` are still a bare `prisma.communityCampaign.update()` with no `notifyCampaign()` call, unlike every sibling admin action (`cancel()`, `approveExtension()`, etc.) in the same file, which all call `notifyCampaign()`.
Role: Organiser. Business impact: organiser gets no explanation when admin pauses/resumes their campaign — support-ticket risk. Backend: add `notifyCampaign(organiserId, "admin_paused"/"admin_resumed", ...)` calls, matching the existing pattern exactly. Frontend: none (once NAV-08 is fixed, these will also route correctly). Admin: none beyond the fix itself. Dependencies: pair with NAV-08 (the new event names must be added to NAV-08's organiser allow-list, or they'll suffer the identical misroute on day one). Complexity: **Small**.

**NOTIF-08 — Support-case customer-visible response never notifies the customer**
Status: **MISSING, confirmed unchanged.** Re-read `support-case.service.ts:95-120` — `adminUpdate()` still only ever writes `customerVisibleResponse` to the DB; no `notificationsService.enqueue()` call anywhere in the function, confirmed by full read of the method body.
Role: Buyer/Organiser/Supplier (whoever filed the case). Business impact: a customer only learns their case was answered by manually reopening the app — real support-quality gap, not a device limitation. Backend: add a `notificationsService.enqueue()` call when `input.customerVisibleResponse` is set and differs from the existing value (transition from unset/changed). Frontend: add a matching tap-route (new event type, e.g. `support_case_response` → case detail screen). Admin: none. Dependencies: none. Complexity: **Small**.

**AUTO-06 — `PAYMENT_RECOVERY`/`PRICE_APPROVAL_REMINDER` runs never pass `vendorId`, so they're invisible in vendor Activity**
Status: **PARTIAL, confirmed for `PAYMENT_RECOVERY`.** Re-read `automation.detectors.ts:242-260` directly — `detectPaymentRecovery()`'s `scheduleAutomation()` call still passes only `recipientUserId: payment.order.buyerId`, no vendor-identifying field. `PRICE_APPROVAL_REMINDER`'s call site (in the subscriptions/renewals module) was not re-derived line-by-line this pass — same file family untouched by P0, no reason to expect it changed.
Role: Vendor. Business impact: 2 of 9 vendor-facing automations are real and sending, but a vendor can never verify they're working via Activity — undermines trust in the whole Automation Centre. Backend: thread the order's/subscription's `vendorId` through to `scheduleAutomation()` at both call sites. Frontend: none (Activity already renders `vendorId`-scoped runs correctly once present). Admin: none. Dependencies: none. Complexity: **Small**.

**REQ-CB-A-002 — Admin cannot edit campaign financial terms** *(BLOCKED-CLIENT-DECISION — do not implement — see Section 5/10)*
Status: **MISSING (edit) / PASS (organiser-side lock), confirmed unchanged.** Confirmed via targeted search: no `adminUpdateCampaign` method or route exists anywhere in the community-buy module. `termsLockedAt` (the organiser-side lock this would need to override) is confirmed still real and enforced.

### Category P1-D — UX Polish / Clarity

**AUTO-04 — Automation config UI still offers only 3 hardcoded chip presets**
Status: **PARTIAL, confirmed unchanged.** Re-read `automation-detail.tsx:41,193-213` — `CONFIG_PRESETS` is still a fixed `{options: number[]}` array rendered as chips; no free-numeric-input path exists. Backend already accepts any numeric value ≥1 (not re-derived this pass — no reason to expect it changed).
Role: Vendor. Business impact: vendor can't pick a value outside the 3 presets (e.g. the system default). Frontend: replace/augment the chip row with a numeric text input. Complexity: **Small–Medium**.

**AUTO-05 — No eligibility explanation anywhere**
Status: **MISSING, confirmed unchanged.** Re-read `automation-detail.tsx` — zero matches for "eligib"/"How this decides" anywhere in the file.
Role: Vendor. Business impact: vendor can't predict when/why an automation fires. Frontend: new "How this decides" section per type, surfacing the real thresholds already used server-side (e.g. `LOW_STOCK_THRESHOLD`). Complexity: **Medium** (needs a small content pass across ~9 automation types).

**UX-07 — Accessibility label coverage ~35%**
Status: **FAIL, carried forward at same confidence.** Not re-scanned screen-by-screen this pass (P0 touched zero UI copy/accessibility attributes across its entire file list — there is no code-change surface that could have moved this number). Recommend a fresh automated scan (the same method the original audit used) immediately before scheduling this phase, purely because it is the single largest-surface-area item in this plan and the most likely to have quietly drifted from unrelated work landing between now and implementation.
Role: Buyer, Vendor (screen-reader users). Complexity: **Large** (breadth, not difficulty — real pass across every CB/Automation screen).

**MKT-03 — Regular Delivery vendor-Home entry point not market-gated**
Status: **PARTIAL, confirmed unchanged.** Re-read `app/(vendor)/index.tsx:608-644` directly — the "Regular Deliveries" `FoodRow` (line 617-623) renders unconditionally; the adjacent Community Buy rows (line 628-643) are correctly wrapped in `{communityBuyEnabled && (...)}` with an explicit market-gating comment. Confirmed real, side-by-side contrast in the same file.
Role: Vendor. Business impact: low (audit's own finding: the two consumer-facing paths — discovery, subscribe — remain correctly gated, so no real transaction can occur) but a vendor in a disabled market can still build/publish a "dead" offer catalog with no warning. Frontend: wrap the row in the existing `marketing_tools`/`regularDeliveriesEnabled` flag, mirroring the adjacent CB code exactly. Backend: optionally add a create/publish gate to `subscriptionOffersService` for defense in depth (not required to close the user-facing gap). Complexity: **Small**.

**REG-05 — Buyer Home screen has an unbounded, coupled Community Buy fetch** *(QA gate, not a code-change item)*
Status: **PARTIAL, confirmed unchanged.** Re-read `app/(buyer)/index.tsx:134,193-194` — `loadCommunityBuy()` is still fired unconditionally in the mount effect, defensively coded (try/catch, hides section on error) but with no timeout bound, coupling 100% of buyer sessions' Home load time to Community Buy backend health. Untouched by P0.
Role: Buyer (100% of sessions). This item's "fix" is manual QA, not a code change: confirm Home behaves acceptably under (a) CB disabled, (b) CB enabled with live campaigns, (c) CB enabled with zero campaigns, (d) simulated slow/erroring CB backend — per `FINAL_MANUAL_QA_PLAN.md`. If QA finds a real problem, a timeout/circuit-breaker becomes a P1 code fix at that point; until then this is a standing verification gate, not an implementation task.

---

## 5. P1s That Are Actually Client Decisions

These cannot be responsibly built without an explicit client answer — confirmed unchanged from the original audit, re-verified not to have been quietly resolved by any P0/other work:

1. **REQ-CB-A-002** — Should admin be exempt from the same financial-terms lock organisers are held to? Real reconciliation risk if built speculatively and mismatched against what participants already pledged.
2. **RD-08 (partial)** — Beyond retry-payment (in this plan, safe to build now): should admin be able to approve/deny a price change or force-cancel a subscription *on a buyer's behalf*? What notice/consent applies?
3. **RD-05 (partial)** — Is post-subscribe frequency editing required, or is cancel-and-resubscribe acceptable? (Resume-date picker, the other half of RD-05, is NOT blocked and is in this plan.)
4. **AUTO-01 / AUTO-02** (bundled under AUTO-04 per the audit's own accounting) — Are "Reorder Reminders" and a distinct "Checkout Payment Follow-Up" actually wanted as separate automation types from the merged `PAYMENT_RECOVERY`? Not re-derived line-by-line this pass; no reason to expect the underlying schema/enum changed.

Two items the *original* audit flagged as needing a decision are **not** repeated here because they are P2, not P1, and this phase's mandate is P1-only: REQ-CB-O-001/CBO-05 (product picker) and REQ-CB-O-005 (trackable invites) both live in the audit's P2 list, not the P1 list — confirmed by re-reading that list directly this pass, despite being named in the "known P1s to verify" example list in the triage instructions. Flagging this explicitly rather than silently promoting or demoting them: **the audit's own P0/P1/P2 classification, not the example list, is the authority used here**, per this task's instruction to re-verify against current evidence.

---

## 6. P1 Priority Order (Top 5, Ranked by Risk — Not Ease)

Ranked by production risk, financial risk, security risk, and user impact, per the ranking factors specified for this triage — explicitly not by implementation ease (several of these are genuinely small; that's a coincidence of this particular gap list, not the ranking basis):

1. **SEC-01** — a live, currently-exploitable, unauthenticated data-disclosure endpoint. Zero dependency, small fix, no reason a single day should pass with this shipped as-is.
2. **NAV-04** — payout notifications are the most financially-adjacent, highest-frequency dead-tap surface in the whole plan; every vendor who requests a payout hits this.
3. **REG-01** — a test covering money-adjacent dispute-resolution logic cannot currently run to completion; until the mock gap is closed, real regression coverage on that code path is weaker than the suite's green checkmarks imply.
4. **NAV-05** — escrow auto-release is a real-money event with a fully silent dead tap; delivery-confirm's duplicate push actively confuses the highest-friction moment in the escrow flow.
5. **CBA-06** — an admin-facing refund-operations idempotency gap; low blast radius per incident, but it is a genuine "the same click twice creates two support cases" data-integrity bug in a financial workflow, not a cosmetic issue.

(NOTIF-DUP-01, NAV-08, and PAY-03 were close calls for this list — all are real and scheduled early in Phase P1-1/P1-2 below, just narrowly edged out of the top 5 by lower financial/security stakes than the five above.)

---

## 7. Dependencies

- **NAV-04, NAV-05, NAV-08, NAV-10** all edit the same function (`handleNotificationTap` in `app/_layout.tsx`) — implement together in one PR to avoid merge churn and to re-verify the whole routing table's shape once, not four times.
- **NOTIF-DUP-01 must ship before or together with NAV-10** for the 2 overlapping event types (`CAMPAIGN_MILESTONE`, `CAMPAIGN_REFUND_UPDATE`). Fixing NAV-10 alone first would take a currently-silent duplicate push and make it a *visible* duplicate — a worse user-facing regression than today's dead tap.
- **CBA-09's new notification events must be added to NAV-08's organiser allow-list in the same change** — otherwise the newly-added `admin_paused`/`admin_resumed` notifications ship already broken on day one.
- **REQ-CB-A-002, RD-08's non-retry-payment asks, and RD-05's frequency-edit half** have a hard dependency on a client decision arriving before any implementation work starts — no technical blocker, a decision blocker.
- Everything else in this plan is independent and can be sequenced by risk/phase without cross-item blocking.

---

## 8. Recommended Phases

The triage instructions offered a suggested phase order (P1-A production-correctness → P1-B Regular Delivery → P1-C Community Buy → P1-D UX) and explicitly asked me not to follow it blindly. Evidence says: don't. A strictly domain-ordered plan would ship RD screen polish (RD-04/RD-09/RD-10) before fixing a live public data-exposure bug (SEC-01) and dead payout notifications (NAV-04) purely because they're in a different product area — that's backwards by the stated ranking factors. The phases below group by **risk tier first, domain second**, which is a deliberate deviation from the suggested order.

### Phase P1-1 — Production Correctness / Money / Security (do first)
**IDs:** SEC-01, NAV-04, NAV-05, REG-01, CBA-06, PAY-03, NOTIF-DUP-01
**Repos:** backend (all); frontend mobile (NAV-04/NAV-05 routing only).
**Screens/services touched:** `market-configuration.service.ts`, `payouts.service.ts` (no logic change, payload only), `escrow.service.ts`, `dispute.service.ts`, `paystack.service.ts`, `campaign-contributions.service.ts`, `community-campaigns.service.ts`, `app/_layout.tsx` (routing additions only), `src/tests/dispute-resolution.test.ts` (mock fix).
**Backend changes:** `select` clause on 2 MarketConfiguration queries; `data.type` added to 4 payout notifications + 2 escrow notifications; collapse escrow delivery-confirm's duplicate push; reword 5 "escrow"-language strings; add existing-case check to `escalateRefund()`; stop double-triggering `CAMPAIGN_REFUND_UPDATE`/`CAMPAIGN_MILESTONE` via `automationService` where `notifyCampaign()` already covers the event; add `vi.mock` for `escrow.service` in the dispute-resolution test.
**Frontend changes:** 4 new branches in `handleNotificationTap` for payout events; reuse `order_status` for escrow events (no new branch needed if backend standardizes the type).
**Admin changes:** none beyond CBA-06's badge-persistence fix.
**Tests required:** unit tests for the new `data.type` payloads (mirror the P0-3 `communication.test.ts` pattern exactly); a real idempotency test for `escalateRefund()` (reload + re-click scenario); confirm `dispute-resolution.test.ts` passes in full after the mock fix; a regression test asserting `CAMPAIGN_MILESTONE`/`CAMPAIGN_REFUND_UPDATE` fire exactly once per participant per event.
**Production verification required:** SEC-01 — confirm the public endpoint's response shape live post-deploy (safe, read-only check). NAV-04/NAV-05 — code-trace + unit test sufficient; live device tap-test optional, not blocking (same standard applied to P0-3's device-untested items).

### Phase P1-2 — Broken User Journeys (notification routing)
**IDs:** NAV-08, NAV-10 (sequenced after Phase P1-1's NOTIF-DUP-01 fix), RD-09
**Repos:** frontend mobile only.
**Screens/services touched:** `app/_layout.tsx` (same function as Phase P1-1 — do in the same PR as NAV-04/05 if timing allows, or immediately after), `regular-deliveries.tsx`, `regular-delivery-subscriber-detail.tsx`.
**Backend changes:** add `campaignId` to the `CAMPAIGN_MILESTONE`/`CAMPAIGN_DEADLINE`/`CAMPAIGN_REFUND_UPDATE`/buyer-win-back automation `data` payloads (currently missing — needed for the new frontend branches to route anywhere useful).
**Frontend changes:** expand NAV-08's organiser allow-list; add NAV-10's 4 missing automation branches + generic fallback; apply the existing label map at RD-09's 2 call sites.
**Admin changes:** none.
**Tests required:** routing-table unit tests (if any exist for `handleNotificationTap` — if not, this is a good place to add the first ones, directly addressing REG-06's process recommendation from the original audit).
**Production verification required:** no — code-trace + unit test sufficient, consistent with how NAV-type fixes were verified in P0-3.

### Phase P1-3 — Missing Required Functionality: Regular Delivery
**IDs:** RD-08 (retry-payment slice only), RD-04, RD-05 (resume-date slice only), RD-10, AUTO-06
**Repos:** backend + frontend mobile + admin-web (RD-08 only).
**Screens/services touched:** `subscription-exceptions/page.tsx` (admin-web), `renewals.service.ts`, `regular-delivery-offer.tsx`, `regular-delivery-detail.tsx`, `regular-delivery-offer-edit.tsx`, `regularDeliveriesService.ts`, `automation.detectors.ts`.
**Backend changes:** one new admin route wrapping `attemptPayment()`; `expectedReturnAt` param on `pauseOfferProduct()`; thread `vendorId` through 2 `scheduleAutomation()` call sites.
**Frontend changes:** fulfilment/substitution block on pre-subscribe screen; resume-date picker on Pause; reason+date fields on product-pause trigger.
**Admin changes:** "Retry payment" button + confirm dialog on `subscription-exceptions/page.tsx`; audit-log entry for the action.
**Tests required:** admin retry-payment route test (reusing existing `attemptPayment()` idempotency test patterns); AUTO-06 Activity-visibility regression test per vendor.
**Production verification required:** RD-08's retry-payment — yes, a real (test-mode) Stripe retry against the QA DB before considering it done, matching the rigor applied to P0-2's payout work, since this is real money.

### Phase P1-4 — Missing Required Functionality: Community Buy
**IDs:** REQ-CB-P-008, CBO-13, CBA-09 (paired with its NAV-08 allow-list addition), NOTIF-08
**Repos:** backend + frontend mobile.
**Screens/services touched:** `community-buy-campaign.tsx`, `community-buy-organiser-campaign.tsx`, `community-campaigns.service.ts`, `support-case.service.ts`, `app/_layout.tsx` (new support-case route + CBA-09's new events).
**Backend changes:** `notifyCampaign()` calls added to `pause()`/`resume()`; notification enqueue added to `supportCaseService.adminUpdate()`.
**Frontend changes:** render `FULFILMENT_STEP_LABEL[fulfilment.status]` on the participant screen; render `RangeProgressBar` in the organiser LIVE branch; new tap-route for support-case responses.
**Admin changes:** none beyond what CBA-09 already touches.
**Tests required:** notification-fired assertions for pause/resume and support-case response (mirror the CBA-17/approve-extension pattern already established in Phase 9's test suite).
**Production verification required:** no.

### Phase P1-5 — UX Polish / Clarity + Standing QA Gate
**IDs:** AUTO-04, AUTO-05, UX-07, MKT-03, REG-05 (QA gate, not code)
**Repos:** frontend mobile.
**Screens/services touched:** `automation-detail.tsx`, `app/(vendor)/index.tsx`, and the full CB/Automation screen set for UX-07.
**Backend changes:** none required (AUTO-04's backend threshold support already exists).
**Frontend changes:** numeric input for AUTO-04; new "How this decides" content for AUTO-05; accessibility label pass for UX-07; market-gate wrap for MKT-03 (trivial — could be pulled forward into any earlier phase opportunistically, since it's a one-line change with no dependency on anything else in this plan).
**Admin changes:** none.
**Tests required:** none beyond standard snapshot/lint checks for the accessibility pass.
**Production verification required:** no. **REG-05 requires manual device/browser QA per `FINAL_MANUAL_QA_PLAN.md`'s 4 scenarios before or during this phase** — if QA surfaces a real problem, promote the timeout/circuit-breaker fix to Phase P1-1 retroactively (it would become a production-correctness item, not UX polish).

---

## 9. Risks

- **NOTIF-DUP-01 / NAV-10 sequencing risk** (detailed in Section 7) — the single most important ordering constraint in this plan; getting it backwards actively regresses the user experience rather than merely delaying a fix.
- **REG-01's diagnosis is a strong lead, not a confirmed root cause** — the recommended fix (mock the dynamic `escrow.service` import) should be tried and the test re-run before assuming it's fully resolved; if the hang persists after mocking, it would warrant a second look at whether something in `dispute.service.ts`'s vendor-resolution path itself has a real (not test-only) issue.
- **PAY-03's wording fix touches legal-adjacent copy** — the Terms page's own defensive use of "escrow" is deliberately out of scope (it exists to *disclaim* being one); a copy/legal sign-off on the 5 in-scope strings is cheap insurance against introducing a new inconsistency.
- **UX-07 is the widest-surface item in this plan** — recommend re-scanning before scheduling rather than trusting the original audit's percentage as still accurate by the time this phase is reached, purely because of how much unrelated work could land between now and then.
- **RD-08's retry-payment fix is real money** — apply the same live-verification rigor used for P0-2 (real Stripe test-mode transfer against the QA DB, not just unit tests) before calling it done.
- **This plan's own "26" vs "27" count** (Section 1) should be explicitly acknowledged to the client/stakeholders rather than silently reconciled, so nobody later assumes a miscount was hidden.

---

## 10. Items That Should NOT Be Implemented Without Client Approval

1. **REQ-CB-A-002** — admin financial-terms editing (full item; do not build any part of it).
2. **RD-08** — everything except "retry payment": approve/deny price-change on a buyer's behalf, force-cancel a subscription, and admin-initiated contact-buyer all require an explicit client answer on acting on a buyer's behalf and what notice/consent applies.
3. **RD-05** — the frequency-edit half specifically (resume-date picker is approved and in Phase P1-3).
4. **AUTO-01 / AUTO-02** — do not add, split, or merge any automation type based on this plan alone; these remain bundled under AUTO-04's BLOCKED status per the source audit.

Nothing else in this plan requires client approval before implementation — every other item is a confirmed, current, code-verified gap with a scoped, non-speculative fix.

---

## Final Notes

- 26 P1 findings re-verified (per the source audit's own count) + 1 additional item (PAY-03) surfaced during this pass and disclosed rather than folded in silently = 27 tracked.
- 0 became PASS after P0. 0 new P0s found.
- 4 items (or item-halves) confirmed BLOCKED-CLIENT-DECISION, unchanged from the original audit.
- Recommended phase order deliberately deviates from the suggested draft order — risk-tier-first, not domain-first — with the reasoning stated in Section 8.
- No code, migrations, commits, or pushes were made to produce this document. This file (`P1_IMPLEMENTATION_PLAN.md`) is the only file created or modified this phase.
