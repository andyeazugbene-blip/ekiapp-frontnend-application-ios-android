# Admin Panel vs Implementation & Acceptance Handbook — Gap Analysis

Source of truth: *Eki Developer Implementation and Acceptance Handbook* (§14.13 decision: **Request changes**).
Method: handbook read line-by-line (L1–800), then seven read-only code audits (admin-web + backend). Every row below was traced to code; "live proof" items need real accounts/devices and are listed separately.

Status key: **DONE** verified in code · **PARTIAL** exists but fails acceptance · **MISSING** not built.
Effort: S ≤ ½ day · M ≈ 1–2 days · L ≥ 3 days.

> All seven audits complete. Subscriptions / Community Buy / markets / suppliers findings are in §6b.

---

## Implementation status (updated 2026-10-05)

Blockers B1-B19, B21-B24 are **built and verified locally** (unit tests + local API + browser); none is marked accepted because the handbook requires live-provider proof - see `docs/handover/acceptance-evidence-matrix.md`.
Still open: B20 (account ownership), vendor referral / First Sale engine / state-aware vendor dashboard (§8), attribution metrics, dispute-evidence model, delivery-proof model, PII reveal, remaining event emits.
Decisions applied: no commission model (display + warning; seller-plan fee data NOT changed in production), 14-day trial kept, "Foodstuffs Subscription" naming, Super-Admin-only Community Buy payments, Operations/Finance Admin roles, no SMS.
Not deployed: awaiting the owner's go-ahead.

---

## 1. Scoreboard

| Handbook area | Done | Partial | Missing | Verdict |
|---|---|---|---|---|
| §2 / §2.1 IA & global behaviours | 0 | 8 | 3 | Navigation is table-shaped, not queue-shaped; no global search; no test-record isolation |
| §3 Overview / Action Centre | 0 | 4 | 5 | KPI wall with mislabelled rows; not an action queue |
| §4 / §14.5 / §14.7 Users & vendors | 2 | 24 | 14 | Contradictions on vendor counts, plan, anonymised users |
| §5 / §14.3 / §14.8 Verification & money | 3 | 17 | 11 | **Blocker**: manual Approve/Reject on Stripe vendors; failed payments show fees |
| §6 / §14.2 Conversations & comms | 4 | 14 | 12 | No open/closed, no vendor support entry, no confirm step, no provider truth |
| §7 Uploads → Content Review | 0 | 2 | 6 | Still a raw storage browser |
| §8 / §12 / §14.10 Automations & events | 1 | 14 | 14 | Run history only; no rule console, no event table, no attribution |
| §9 Foodstuff subscriptions | 3 | 8 | 5 | Renewal job idempotent and safe; **no admin module**, no retry schedule, dead-end after 3 failed attempts |
| §10 Community Buy | 6 | 9 | 4 | Money/payout controls strong; state machine incomplete (never reaches COMPLETED), no admin comms, missing notifications |
| §14.9 Market configuration | 0 | 4 | 4 | **Blocker**: payments enabled without readiness proof or Super-Admin gate; mass-assignment on update; Africa cannot be added |
| §14.11 Supplier accounts | 0 | 4 | 5 | Suspend offered on pending, no Reject, no notifications, approve unguarded |
| §13 / §14.12 Settings, security, audit | 3 | 14 | 3 | 2FA optional, audit gaps, no emergency pause |
| §14.4 Gift cards / Hot Deals | 1 | 5 | 5 | **Blocker**: no redemption path exists |
| §14.6 Products | 3 | 5 | 9 | No unpublish reason, purchasable when seller can't be paid |
| §16–18 Handover | 0 | 11 | 4 | Ownership personal; backup/restore unproven |

---

## 2. Already done / fixed (do not redo)

- Admin **Messages** nav routes to a real support inbox (`/support-messages`), not the Users list (L504). List + thread + reply + unread count + buyer-side entry work.
- **Stripe Identity vendors visible** in the verification queue with session id and method label.
- User detail enriched (vendor/organiser/supplier panels, orders, activity/support links); users list uses real buttons, not red text links.
- Zero role assignments ⇒ zero permissions; `admin.*` wildcard; 10 seeded roles; `requireAdminPermission` on routes; bootstrap admin backfill.
- `require2fa` on ~35 sensitive routes; four-eyes `AdminApprovalRule` on refunds; audit table has actor/action/entity/reason/before/after/IP columns.
- Payment webhook idempotency (`WebhookEvent` unique id + Serializable txn) for payments.
- Market **disable/enable** with 2FA, reason, audit, last-active-market guard.
- Escrow page language is honest (provider controls disabled, Stripe-only).
- Product currency locked to vendor currency; display-currency change never alters stored price.
- Hot Deals draft leak fixed; promos/bundles/flash-sales public-feed filters.
- Community Buy admin pages, ledger, holds, payout stuck-scan exist.
- Notification taps deep-link for orders, refunds, messages, subscriptions, Community Buy, verification.
- Honest-metrics: no fabricated attribution numbers anywhere.

---

## 3. Blockers (handbook §14.12 — must clear before acceptance)

| # | Item | Handbook | Evidence | Effort |
|---|---|---|---|---|
| B1 | Manual Approve/Reject still offered for Stripe Identity vendors; second bypass via `vendors/:id/approve` + `bulk-approve` | §5.1, §14.3 L531 | `verification/page.tsx:307-308`, `admin.routes.ts:468,515,538-539` | M |
| B2 | No vendor `account.updated` handling; charges/payouts/requirements never reach admin | §5.1, §14.3, §14.7 | `stripe.service.ts:104`, `stripe-connect.service.ts:168` unused | M |
| B3 | Failed payment shows Platform Fee / Vendor Earnings | §14.8 L585 | `payments/[id]/page.tsx:32-33`, `orders/[id]/page.tsx:231-232` | S |
| B4 | `charge.refunded` refunds **every** order in the checkout, even on partial; partial refund marks order REFUNDED and blocks further refunds | §11, §5.2 | `stripe.service.ts:1382-1500`, `admin-refunds.controller.ts:62,83,133` | M |
| B5 | Vendor "Approved" stat double-counts (`active == verified`); detail hard-codes plan "free"; Total orders always 0 | §14.7 L571 | `admin-listings.service.ts:610`, `vendors/page.tsx:215`, `vendors/[id]/page.tsx:138` | S |
| B6 | Anonymised user displays Suspended and offers **Unsuspend** (would reactivate scrubbed account) | §14.5 L548 | `users/page.tsx:125`, `admin-listings.service.ts:729,821` | S |
| B7 | Delete Vendor / permanent market Remove destroy history | §14.7 L576, §14.12 L638 | `vendor-markets.service.ts:168`, vendors pages | M |
| B8 | Suspension: reason optional, no notification, no evidence/duration, user vs vendor paths inconsistent | §4.3, §14.5 | `admin-listings.controller.ts:35-79`, `admin-vendors.service.ts` | M |
| B9 | Global search absent (dead `<span>`) | §2.1 L132 | `dashboard/page.tsx:217` | M |
| B10 | Overview is not an Action Centre; rows mislabelled; 50-order sampling | §3 | `dashboard/page.tsx:106,264-272` | L |
| B11 | No Subscriptions module (buyer baskets); lives under Community Buy as "exceptions" | §2 L122 | `AdminLayout.tsx:82` | L |
| B12 | 2FA optional, no enrol UI, not on broadcast/payout approve/settings/roles | §13 L491 | `require-2fa.ts:44` | M |
| B13 | Audit gaps (templates, schedules, escrow provider, promos, verification, gift-card, product disable, broadcast, support replies); no immutability trigger; refund audit lacks IP/states | §13 L492, §14.12 L638 | see §13 audit | M |
| B14 | Gift-card redemption does not exist; no code, balance, expiry, status enum, delivery | §14.4 | `gift-cards.routes.ts` | L |
| B15 | Active product purchasable when seller cannot receive payment | §14.6 L563 | `cart.service.ts:37`, `payments.service.ts:86` | M |
| B16 | Channel claims without provider truth: email returns `true` when unconfigured; broadcast ignores consent/quiet hours/caps; no confirm/preview; broadcasts not logged | §6.2, §15.6 | `lib/email.ts:30-36`, `admin-communications.service.ts` | L |
| B17 | No emergency pause for outbound comms/automations | §6.2 L266, §13 L496 | none | M |
| B18 | No test-record flag; production metrics include QA data | §2.1 L139, §14.12 L637 | none | L |
| B19 | Refund requires reason client-side only; no `Refund` model; Payment/order language "Refund issued" before Stripe confirms | §5.2 L214/L219 | `admin-refunds.controller.ts` | L |
| B21 | Market config: Community Buy payments `LIVE` for every seeded market with no readiness proof; any `community_buy.mutate` admin can flip it; `request.body` passed straight to Prisma (mass assignment); no dependency checks; Africa cannot be added | §14.9 L596-598, L601 | `market-configuration.service.ts:88-97,207-244`, `admin.routes.ts:401` | M-L |
| B22 | Supplier workflow: Suspend offered on pending apps, no Reject, `approve()` unguarded (can re-approve CLOSED/SUSPENDED), no supplier notifications, no payout-readiness gate at assignment | §14.11 | `supplier-account.service.ts:163,243`, `community-supplier-accounts/page.tsx:262-266` | M |
| B23 | Subscription payment recovery dead-ends: after 3 attempts renewal CANCELLED, subscription stuck PAYMENT_ATTENTION, no automatic retry schedule | §9 L386 | `renewals.service.ts:717`, `internal.routes.ts:96` | S-M |
| B24 | Community Buy campaign never reaches COMPLETED / REFUNDING / target-reached; missing campaign-live, milestone, completed notifications; no admin comms to participants | §10 | `community-campaigns.service.ts:1896-1936,2325` | M |
| B20 | Ownership/continuity: GitHub, EAS, Vercel on personal accounts; admin-web not git-linked; restore drill unproven | §16–18 | handover | admin task |

---

## 4. Product-owner decisions required (cannot be coded around)

1. **Commission vs subscription model.** Handbook L587 says subscription, no commission unless approved. Code applies 1500 bps by default. → Zero starter tiers + relabel, or approve and label "Eki fee".
2. **30-day full-access trial** replacing Free/14-day Growth trial (L573). Touches Stripe `trial_period_days`, `VendorSubscription` schema, vendor UI.
3. **"Regular Deliveries" naming** vs "Subscriptions" in admin (§2 L122).
4. **Who may enable Community Buy payments** (Super-Admin-only?).
5. **Role names**: add explicit *Operations Admin* and *Finance Admin* roles (handbook names them; seeds don't).
6. **SMS in scope?** Country allow-list/cost model needed before SMS can be marked accepted.

---

## 5. Phased plan

### Phase 0 — Truth & safety (this iteration; small, high value, all admin-visible)
| Id | Change | Where |
|---|---|---|
| 0.1 | Stripe vendors: hide Approve/Reject, show "Managed by Stripe Identity"; BE returns 409 for approve/reject/vendor-approve/bulk-approve on Stripe-managed vendors; legacy docs labelled read-only | verification page, vendors pages, `admin.routes.ts`, `verification.service.ts`, `admin-listings.service.ts` |
| 0.2 | Vendor `account.updated` webhook → persist charges/payouts/status/requirements/last-update; `GET /admin/vendors/:id/stripe-status`; vendor detail "Provider readiness" panel with three separate badges (Identity / Charges / Payouts) + Open in Stripe | schema migration, `stripe.service.ts`, `stripe-connect.service.ts`, vendor detail |
| 0.3 | Failed-payment presentation: hide fee/earnings unless SUCCEEDED; banner "No funds were collected. No vendor earnings or payout were created."; strip from list payloads | payments + orders pages, `admin-listings.service.ts` |
| 0.4 | Refund correctness: scope `handleChargeRefunded` to refunded order and `amount_refunded`; partial refund does not flip status; cumulative cap; server-side reason ≥10 chars; audit via `recordAudit` with request/states | `stripe.service.ts`, `admin-refunds.controller.ts` |
| 0.5 | Identity webhook idempotency + rethrow; `requires_input` ≠ REJECTED | `stripe.service.ts:1176`, `stripe-identity.service.ts` |
| 0.6 | Vendor list/detail contradictions: distinct approved/verified/pending/rejected/suspended counts; detail returns subscription + `storeOrders`; remove "free" fallback; remove fake Last Active; remove Delete; currency per record not hard-coded | `getVendorStats`, `getVendor`, vendors pages |
| 0.7 | Anonymised users: add `anonymisedAt`; state computed; Suspend/Unsuspend hidden; unsuspend rejected server-side | schema, `deleteUser`, users pages |
| 0.8 | Shared `ConfirmDialog` with **required reason** (replaces `window.confirm/prompt`), used by suspend, market disable, product unpublish, refund, payout actions | `AdminUI.tsx` + call sites |
| 0.9 | Suspension rewrite: required reason, optional duration/evidence, notify user (in-app + email), full before/after audit, one shared service for user+vendor | BE + users/vendor pages |
| 0.10 | Dispute UI bugs (`resolution` label, form-hide); order detail fabricated timestamps/fields removed; `normalizeOrderStatus` mapping; `force-process` verifies Stripe | disputes/orders pages, `admin-orders.service.ts` |
| 0.11 | Dead UI removed: Provider Controls page, duplicate `/communication` page, disabled placeholders | sidebar, pages |
| 0.12 | Audit hardening: `recordAudit` on all unaudited mutations; Postgres trigger blocking UPDATE/DELETE on `AuditLog`; `rewards.*` permissions added | BE |
| 0.13 | Market config: whitelist update fields, Super-Admin-only for `communityBuyPaymentsEnabled`, required reason, dependency validation, show "Austria (AT) — EUR" for all seeded markets | `market-configuration.service.ts`, `admin.routes.ts`, `lib/countries.ts` |
| 0.14 | Supplier queue: View/Request info/Approve/Reject (no Suspend on pending), `approve()` state guard, supplier notifications, counts reconcile, "Close Account" | `supplier-account.service.ts`, supplier page |
| 0.15 | Subscription recovery dead-end fix (stuck PAYMENT_ATTENTION) + retry schedule in sweep | `renewals.service.ts`, `internal.routes.ts` |

### Phase 1 — Daily-operations UX
1. **Global search** (`GET /admin/search`: user, vendor, store, order, payment ref, campaign, subscription) + header command-palette.
2. **Action Centre** dashboard: 8 priority areas (§3), every tile deep-links to URL-filtered list; honest counts from server aggregates; "last refreshed" stamp; timezone label.
3. **Shared DataTable** (server-side search/sort/pagination, URL-synced filters, CSV export, empty/loading/error/403 states) rolled out to Users, Vendors, Payments, Orders, Products, Disputes.
4. **Sidebar by workflow** (Overview · Users · Vendors · Orders · Payments & Payouts · Subscriptions · Automations · Communications · Conversations · Disputes · Content Review · Settings) filtered by the admin's permissions.
5. Users: search, status filter, pagination, total count, avatar, last active, orders, "Not provided".
6. Vendor workspace: store readiness, money by currency, refunds/disputes, internal notes, account timeline (audit by entity).

### Phase 2 — Conversations, Communications, Content Review
- Conversations: OPEN/CLOSED, close/reopen, filters (unread/reported/escalated/order-linked), vendor↔support entry in vendor app, attachments + readAt in thread, internal notes, audit on replies, show broadcast replies.
- Communication Center: single page, 8-stage flow (audience → eligible/excluded counts → channel-status gating → compose with per-channel preview → mandatory test send → confirm → deliver/schedule → measure), idempotency key, `Broadcast` + per-recipient `CommunicationLog`, consent/quiet-hours/caps enforced, template versioning, fix `sendEmail` dev-mode `true`, 5-min scheduler.
- Content Review: moderation status, entity link, names-first, approve/reject/remove/flag with reasons, merge `content-reports`, separate identity docs permission.

### Phase 3 — Platform depth
- Test-record flag (`isTest`) + metric exclusion.
- Subscriptions top-level module (list, 6 queues, detail, `subscriptions.*` permission).
- Automation Centre: `AutomationRule`, runs list/filter, pause/resume/retry/test, emergency stop; log every suppression; Event table + `eventsService.emit`.
- Gift-card redemption + purchased-card admin view; Hot Deals/Gift Cards two clean views.
- Product admin: filters, type, images, unpublish reason + vendor notice, checkout gate on seller payment readiness.
- `Refund`/`Dispute v2`/`OrderEvidence` models; webhook-events viewer.
- 30-day trial; commission decision.
- Mandatory 2FA + enrol screen + admin invite; session control; versioned settings + feature flags; Operations/Finance roles.

### Phase 4 — Handover & live proof
Ownership transfer, restore drill, integration/webhook register, known-issues table, Appendix B evidence matrix, severity re-mapping, live-proof matrix (iOS/Android push, email, SMS, real checkout/refund/payout, restrict/restore Stripe account, role journeys).

---

## 6. Detailed findings by area

Row-level tables (handbook line · requirement · status · evidence · gap · effort) are retained in the audit reports; the key rows are consolidated in §3 and §5. Additional findings not listed above:

**Admin IA / global (§2, §2.1)**: sidebar shows every item to every admin; `ProtectedRoute` checks `role === ADMIN` only; no date shows a timezone; IDs shown as primary labels in disputes/uploads/recent activity; 23 pages use `window.confirm/prompt`; no saved views; CSV export on 5 pages only.

**Verification/money (§5, §11, §14.8)**: Order status map collapses PAID/FAILED/DISPUTED to "pending"; payment detail lacks method type/failure code/webhook timestamps; no `Refund` table (refund list built from audit metadata); no cross-links order↔payment↔dispute↔payout↔renewal; dispute model has no type/deadline/evidence/messages; `StripeDispute` no evidence-due/Open in Stripe; Stripe `PROCESSING` webhook rows can be stranded as permanent duplicates; vendor transfer/payout webhooks only handled for Community Buy.

### 6b. Subscriptions, Community Buy, Markets, Suppliers

**Subscriptions (§9)** — there is *no* admin subscriptions module. "Seller Plans" is vendor billing config; "Subscription Exceptions" is a 200-row queue of 3 renewal statuses; "Subscription MRR" is vendor-plan revenue.
- DONE: renewal idempotency (unique `(subscriptionId, cycleDate)`, atomic claim, Stripe idempotency key per attempt); no unpaid fulfilment (order created only after PI succeeded); cancellation preserves history; admin retry via provider flow (not audited).
- PARTIAL: one date serves billing/order/delivery; `renewalCutoffHours`/`preparationHours`/`substitutionMode` stored but never used; no stored discount/tax/total; states lack trial/skipped/action-required; admin actions in AuditLog but not subscription history; `pausedUntil` never auto-resumes; price-change notice sent on due date not in advance and approval timeout is a no-op unless env set; vendor forecast absent until due date; refunds not linked to subscription.
- MISSING: admin list/filters/detail; admin set-next-date, pause, resume; buyer reschedule; substitution flow; automatic retry schedule; admin reports (active, MRR, churn, recovery, cancellation reasons — buyer cancel captures no reason).
- Naming: mobile says "Foodstuff Subscription", backend/admin say "Regular Delivery".

**Community Buy (§10)**
- DONE: commercial terms; money (contributions/refunds/payouts); hold/release payout with 2FA + four-eyes; joined/paid, target-reached, dispatched/ready notifications.
- PARTIAL: identity (no slug/public URL field, no product entity, single country); timing (no start, payment/fulfilment deadline, timezone); progress % client-derived; operations (admin cannot post updates, no stock tracking); state set (`SUCCEEDED`, `CLOSING`, `REFUNDING`, `COMPLETED`, `FINANCIALLY_CLOSED` never written; no central transition map; rejected is terminal); approve/reject has no criteria checklist; pause requires no reason and notifies only organiser; extension only organiser-requested in RESCUE_WINDOW, one max; campaign detail page lacks participant/payment list; no single monitor.
- MISSING: admin broadcast to participants/organiser/vendor; campaign-live discovery push; progress milestone (removed); completed prompt (confirm receipt/review/issue); target-missed copy lacks refund info.

**Markets (§14.9)**: display "Name · CUR" without code; `COUNTRIES` knows 10 of ~43 seeded markets; availability not separated from verified payment readiness; Super-Admin gate absent; no dependency enforcement; update takes raw `request.body`; no add-market endpoint; no per-market history view.

**Suppliers (§14.11)**: review queue offers Request info / Suspend / Approve (no View, no Reject); application/account/payout statuses merged; dashboard counts omit PAUSED/CLOSED; approval info set thin (no lead time, min quantity, documents in model); no performance data; "Close permanently" should read "Close Account"; reason + confirm + audit exist but zero supplier notifications.

**Comms (§6)**: Expo Push Service is the real push path (Expo → APNs/FCM); receipts swept once daily and never stored; scheduled comms run daily 12:00 UTC (times not honoured) and flip to SENT before sending; email has no unsubscribe/List-Unsubscribe; SMS reports `smsQueued` when provider is `NOT_CONFIGURED`; `admin_broadcast` push has no deep link; message retention undefined.

**Automations (§8, §12)**: 9 detectors + `AutomationRun` dedupe exist; suppressions for quiet hours/consent/frequency/disabled are only logged, not recorded; FIRST_SALE suppressed by *any* order incl. unpaid; no trial-ending handler; no vendor referral programme; no event table (public-store events live in `AuditLog`); vendor dashboard not state-aware.

**Settings/security (§13)**: only 3 numeric thresholds editable; General tab disabled placeholders; no feature flags; no retention job; no general PII masking in admin views.

**Products (§14.6)**: no search/category/type filters; detail lacks images/updatedAt/delivery methods/live link; converted amounts not labelled "Approx." (rates are static constants).

**Handover (§16–18)**: handover doc claims admin-web deploys via Git integration — inaccurate; loose credential files in working folder (rotate + vault); Severity vocabulary differs from handbook (Blocker/Critical/Major/Minor).
