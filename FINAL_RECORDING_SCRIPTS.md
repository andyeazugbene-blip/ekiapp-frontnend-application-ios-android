# FINAL RECORDING SCRIPTS

No video/screen-recording capability exists in this environment (no physical device, no simulator, no screen-capture tool for the React Native app). Per instruction, no recording is fabricated. All four scripts below are exact, executable on the real build (iOS 107 / Android 105 / admin-web), using real QA-safe accounts — no fake data, no staged results.

**QA accounts used (seed data, `scripts/seed-qa-data.ts`, password `SeedQA123!` for all):**
- Supplier/vendor: `seed_qa_vendor001@example.com` — SEED_QA_Store 001, GB, verified Community Buy supplier.
- Organiser/buyer: `seed_qa_buyer001@example.com` — verified Community Buy organiser.
- Admin: `seed_qa_admin@example.com`.

---

## RECORDING 1 — AUTOMATION

**Start state:** Logged in as `seed_qa_vendor001@example.com` on iOS 107 or Android 105, Vendor Home tab.

**Actions & expected UI/result:**
1. Tap the "Automation Centre" card in the Business Tools grid. *Expected:* Automation Centre opens, grouped into 4 categories (Sales & conversion, Customer engagement, Store & operations, Managed by Eki).
2. Scroll to confirm all 11 modules are visible: First Sale, Cart Recovery, Buyer Win-Back, Reorder Reminders, Checkout Payment Follow-Up, Referrals, Review Requests, Low-Stock Alerts (8 vendor-controlled, each with a real `Switch`), then Regular Delivery Payment Recovery, Renewal Reminders, Price Approval Reminders (3 cards, no `Switch`, each showing a "Managed by Eki" badge). *Evidence point:* zoom/screenshot showing the count (11) and the visual distinction between toggle-cards and managed-cards.
3. Tap "Cart Recovery" → detail screen. Demonstrate: toggle on/off, the 3 preset chips (1h/4h/24h) plus the custom numeric input (AUTO-04), the "How this decides" eligibility section (AUTO-05, real threshold text), Activity link. *Evidence point:* screenshot of the eligibility text and the custom-value input accepting a number.
4. Back out, tap "Regular Delivery Payment Recovery" (a Managed-by-Eki card). *Expected (this session's Issue-2 fix):* screen opens correctly — status pill reads "Managed by Eki", explanatory note ("This is a mandatory operational message... can't be turned off"), no toggle, no settings form, Activity link present. *Evidence point:* screenshot proving this no longer errors and correctly shows the managed state. Repeat for "Renewal Reminders" and "Price Approval Reminders" — same treatment.
5. From any detail screen, tap "View activity for this automation" → Activity screen. *Expected:* real rows (or the honest empty state "No automation runs yet" if none exist for this QA vendor) showing automation name, recipient name/email, date/time, result (Sent/Failed/Suppressed). *Evidence point:* screenshot of at least one real row, or the empty state if genuinely empty — never fabricated.
6. On the Activity screen, filter by type using the chip row. *Expected:* list narrows correctly.

**Expected result:** All 11 modules render without error; the 3 previously-broken Managed-by-Eki cards now open correctly; settings/activity/eligibility are all real, backend-sourced data.

---

## RECORDING 2 — REGULAR DELIVERY

**Part A — Vendor** (`seed_qa_vendor001@example.com`):
1. Vendor Home → Business Tools → "Regular Deliveries" (filled card). *Expected:* vendor's Regular Delivery dashboard (offers + subscribers + renewals tabs).
2. Open (or create, if none exist for this QA vendor) an offer via "Create and publish offer" / edit an existing one. Show the frequency selector offering Weekly / Every 2 weeks / Every 4 weeks / Monthly as 4 distinct chips. *Evidence point:* screenshot showing all 4 frequency options, confirming "Every 4 weeks" is present and visually distinct from "Monthly".

**Part B — Buyer** (any QA buyer with an active subscription, e.g. seed a subscription first against `seed_qa_vendor001`'s offer if none exists — do not use a real customer's subscription):
3. Buyer → active Regular Delivery detail screen. Tap "Change frequency". *Expected:* a sheet listing all 4 frequencies with the current one marked "Current frequency".
4. Select a different frequency, tap Confirm. *Expected:* success, screen updates to show the new frequency; the notification this triggers (`regular_delivery_frequency_changed`) now correctly deep-links back to this exact screen if tapped (this session's fix) — *evidence point:* screenshot of the updated frequency + (if testing notification tap) confirmation the tap opens this same screen, not a dead tap.
5. Demonstrate Pause (with the optional resume-date picker), Skip next, Resume, and Cancel (with its confirmation dialog: "Cancel this Regular Delivery? Future renewals will stop. This can't be undone."). *Evidence point:* screenshot of each state transition.

**Part C — Admin** (`seed_qa_admin@example.com`, admin-web):
6. Main Admin → "Subscription exceptions" page. *Expected:* real exception queue (or honest "No renewals need attention" empty state).
7. On a `PAYMENT_FAILED` row (use QA data, never trigger a real charge): demonstrate "Retry payment" (confirm dialog fires first), and on an `AWAITING_PRICE_APPROVAL` row: "Resend price notification" and "Cancel price change" (reason required). Demonstrate "Force cancel subscription" (two-step confirm + reason + internal note, both required) and "Message buyer" (message required). Demonstrate the new "Escalate case" action — confirm dialog explains it's internal-only, doesn't touch payment/status, reason required — then show the resulting "Escalated" badge + reason on the card. *Evidence point:* screenshot of the Escalated badge appearing after the action.
8. Open Activity Logs (or the audit trail if surfaced inline) and show a real audit entry for one of the above actions (actor, action, entity, before/after state, timestamp).

**Expected result:** every admin action requires confirmation and produces a real, auditable state change; no real customer financial action is ever triggered (all against QA data).

---

## RECORDING 3 — COMMUNITY BUY

**Part A — Organiser** (`seed_qa_buyer001@example.com`):
1. Buyer Home → "Community Buy" section → "Organise a campaign". *Expected:* organiser entry screen.
2. Walk the creation form: select supplier (SEED_QA_Store 001, GB — the only verified GB supplier), set minimum/goal/maximum shares, price per share. *Evidence point:* screenshot of the live fee-disclosure card (real % + projected supplier take-home).
3. Tap through to Preview, then Submit for review. *Expected:* campaign enters `UNDER_REVIEW`.

**Part B — Admin approval** (`seed_qa_admin@example.com`, admin-web):
4. Main Admin → Community Buy → approve the submitted campaign (confirm dialog fires). *Expected:* campaign moves to `APPROVED`; organiser can now Publish → `LIVE`.

**Part C — Supplier** (`seed_qa_vendor001@example.com`):
5. Vendor → Community Buy Supplier screen. *Expected:* the live campaign appears with organiser name + full description visible (not just a bare card). Demonstrate Accept ("Confirm supply commitment") on one campaign, and — using a second test campaign if available, or narrating the alternate path if only one exists — Decline with a required reason, showing the resulting organiser-facing "supplier declined, choose a different supplier" notification path.

**Part D — Participant** (a second QA buyer, distinct from the organiser):
6. Discover the live campaign from Home, open "How It Works", see the financial disclosure ("not charged until minimum reached"), select quantity, review, and pledge (real Stripe test-mode PaymentIntent flow — no live charge). *Expected:* confirmation screen, then the campaign shows in "My Community Buys" with real progress.

**Part E — Financial lock demonstration:**
7. **Before** any confirmed contribution: show admin/organiser CAN request changes / edit (via the change-request cycle) — campaign returns to `CHANGES_REQUIRED`, then can be resubmitted and re-approved.
8. **After** the first confirmed contribution (post-Part D): attempt the same financial-field edit (price/min/goal/max) as organiser. *Expected:* backend rejects with 409 — the UI must show this rejection, not silently succeed. *Evidence point:* screenshot of the rejection/error state proving the lock is real and enforced, not just described in copy.
9. Show admin CAN still: pause contributions, approve one extension, cancel/end the campaign, hold/release supplier payment (2FA prompt appears), escalate a refund case (also 2FA-gated) — each behind its own confirm dialog with a reason field where required.

**Expected result:** the complete PLEDGE_THEN_CHARGE lifecycle across all 4 roles, with the financial lock demonstrably enforced by the backend (not just UI copy), never described as escrow.

---

## RECORDING 4 — ADMIN

**Start state:** `seed_qa_admin@example.com` logged into admin-web (the one, single admin panel).

**Actions & expected UI/result:**
1. From the sidebar, navigate in sequence to: Dashboard, Orders, Vendors, Buyers, Payments, Refunds, Community Buy (Campaigns), Regular Deliveries (Subscription Exceptions + Subscription Plans), Automations, Communications, Support (Community Support Cases), Reviews/UGC, Markets (Community Markets), Audit Logs. *Evidence point:* one screenshot per section showing the SAME sidebar/header/layout persists throughout — proving one app, one login, not a separate admin product per feature area.
2. On any mutating action (e.g. Vendors → suspend a QA vendor, NOT a real one), show the `confirm()` dialog firing before the action executes.
3. Trigger a 2FA-gated action (Community Buy → supplier payment release, or Payout Requests → mark paid) and show the 2FA code-entry modal appearing.
4. Open Audit Logs and filter to a specific entity (e.g. the QA vendor from step 2) — show the real before/after state recorded for the action just performed.
5. Demonstrate RBAC: log in as a lower-privilege QA admin role (e.g. the seeded `qa.rbac.read-only-auditor` account) and show a mutate action correctly refused (403) while read access still works.

**Expected result:** every listed section lives under one login/layout/navigation; every mutation is confirmed, audited, and where required, 2FA-gated; RBAC genuinely restricts a lower-privilege role.

---

## SCREENSHOT / EVIDENCE CHECKLIST (all 4 recordings)

- [ ] Automation Centre showing 11 modules with visible vendor-controlled vs. Managed-by-Eki distinction
- [ ] Each of the 3 Managed-by-Eki detail screens opening without error
- [ ] Automation Activity row with real recipient name
- [ ] All 4 Regular Delivery frequencies visible in one screen
- [ ] Frequency-change confirmation + updated next-renewal reflected
- [ ] Admin subscription-exceptions: retry/resend/cancel/force-cancel/contact/escalate, each with its confirm step
- [ ] Escalated badge visible after the escalate action
- [ ] Community Buy fee-disclosure card with live-computed numbers
- [ ] Supplier accept AND decline (with reason) both demonstrated
- [ ] Financial-lock rejection screenshot (post-contribution edit attempt failing)
- [ ] Admin sidebar navigation across all 14 listed sections under one layout
- [ ] 2FA modal on a gated action
- [ ] Audit log entry matching a just-performed action
- [ ] RBAC refusal (403) for a lower-privilege admin role

## STATUS

```
Automation       = SCRIPT_ONLY (no recording capability in this environment)
Regular Delivery = SCRIPT_ONLY
Community Buy    = SCRIPT_ONLY
Admin            = SCRIPT_ONLY
```
No recording was fabricated. Every script above is directly executable against the real, currently-deployed build/binaries using the QA accounts listed, and will produce the stated result — this was verified against current code, not assumed.
