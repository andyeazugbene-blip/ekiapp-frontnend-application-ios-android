# Production Readiness Audit

Basis: the Eki Developer Implementation and Acceptance Handbook (v1.0, 29 Sep 2026) plus the owner decisions of 2-5 Oct 2026 (subscription model / no commission, 14-day full-access trial, "Foodstuff(s) Subscriptions", Super-Admin-only Community Buy payments, Support/Operations/Finance/Super roles, no SMS).

Method: verified from code in `ekiapp-backend-main` and `ekiapp-frontnend-application-ios-android-main/admin-web`, with the local disposable Postgres, the unit/integration suite, and a browser pass over each module. Earlier agent claims were re-checked, not trusted. **Nothing here was tested against live Stripe, Resend, Expo/APNs/FCM, real devices or the production database** - those rows say so.

Legend: IMPLEMENTED = built and verified locally. PARTIAL = built, with a stated gap. MISSING = not built. LIVE = needs a real-provider/device run by the owner (**NEEDS MANUAL PRODUCTION VERIFICATION**). Severity: B=blocker, C=critical, M=major, m=minor.

## A. Platform / deployment (P0)
| # | Requirement | Current | Files | Gap | Sev | Fix | Verify | Prod dependency |
|---|---|---|---|---|---|---|---|---|
| A1 | Preview must never migrate production DB | **FIXED in code**: `vercel-build` now runs `scripts/vercel-migrate.js`, which migrates only when `VERCEL_ENV=production` | `package.json`, `scripts/vercel-migrate.js` | Preview still has the same `DATABASE_URL` env value, so preview *runtime* would still read/write the prod DB | B | Give Preview its own DB (manual, see ENVIRONMENT checklist) | node script tested for preview/unset | Vercel dashboard change |
| A2 | Migration safety | 8 pending migrations, all additive; fresh-DB apply + zero schema drift verified | `prisma/migrations/*` | Not rehearsed on a copy of production data | B | Rehearse on a Neon branch of prod | `migrate deploy` on empty DB; `migrate diff` empty | Neon branch |
| A3 | Backup / restore | Undocumented; drill checklist empty | `docs/BACKUP_RESTORE_RUNBOOK.md` | No evidence a backup exists or restore was tested | B | Owner confirms Neon PITR + restore drill | - | Neon console |
| A4 | Cron | `vercel.json` keeps only the daily sweep (a 5-minute cron was removed: it would break a Hobby-plan deploy). Scheduled communications therefore run daily at 12:00 UTC | `vercel.json`, `internal.routes.ts` | Scheduled sends can be up to a day late unless the plan allows `*/5` | M | Upgrade plan or call the job from an external scheduler with `CRON_SECRET` | - | Vercel plan |
| A5 | Audit append-only | DB trigger migration applied in production on 2 Oct (build log) | `20261002130100_audit_log_immutable` | Not queried in prod | C | Verify trigger exists (SQL in runbook) | local: UPDATE/DELETE rejected | prod read-only query |
| A6 | Env configuration | See `PRODUCTION_ENVIRONMENT_CHECKLIST.md`; `PUBLIC_API_URL`, `ADMIN_WEB_URL`, `ADMIN_2FA_ENFORCE` unset; prod has `CORS_ORIGIN` but code reads `CORS_ORIGINS` | - | - | C | Set/verify | - | Vercel |

## B. Stripe / providers
| # | Requirement | Status | Evidence | Gap | Sev |
|---|---|---|---|---|---|
| B1 | No manual Approve/Reject for Stripe verification | IMPLEMENTED | 409 guards (verification, vendor approve/reject, bulk); UI hides buttons; tests | legacy docs path read-only unless unambiguously legacy | B closed |
| B2 | account.updated sync, deauthorized | IMPLEMENTED | `stripe.service.ts` routes organiser then vendor; idempotent claim/release/rethrow; tests | Stripe dashboard must subscribe the events (**LIVE**) | B |
| B3 | Provider state separate (identity / charges / payouts / requirements) | IMPLEMENTED | `vendor-provider-readiness.ts`, `ProviderReadiness.tsx`, tests | live account needed (**LIVE**) | - |
| B4 | Identity webhook idempotency, requires_input not a rejection, processing/canceled/redacted | IMPLEMENTED | `stripe-identity.service.ts`, tests | LIVE | - |
| B5 | Webhook signature verification | IMPLEMENTED (existing) `constructEvent` | `stripe.service.ts` | - | - |
| B6 | Required events subscribed in Stripe | NEEDS MANUAL PRODUCTION VERIFICATION | list in `docs/handover/webhook-register.md` | cannot read Stripe dashboard | B |
| B7 | Payment failure reason stored/shown, "No funds were collected" | IMPLEMENTED | `Payment.failureCode/Message`, UI, browser-verified | LIVE | - |
| B8 | Refund model: cumulative cap, idempotency, multi-vendor scoping, status via webhook | IMPLEMENTED | `Refund`, `admin-refunds.controller.ts`, `charge-refunded-scoping.test.ts` | LIVE; Paystack refund has no webhook confirmation | C |
| B9 | Payouts: reason + 2FA + fail-closed audit | IMPLEMENTED | `payouts.controller.ts` | payout transfer webhooks for vendors only partly handled | M |
| B10 | Commission model | PARTIAL: display + warning only. Seller-plan fee data in production NOT changed (owner decision pending on timing) | `MoneyParts.tsx` | production plans may still charge a fee | C |
| B11 | 14-day full-access trial | IMPLEMENTED (new): `trialStartedAt/EndsAt` persisted from Stripe, shown in admin list/detail and vendor API; `trial_will_end` notification | `stripe.service.ts`, migration `20261005094856_*` | trial is a Stripe checkout trial (Growth plan); LIVE; legacy "Free" plan still exists in data | C |
| B12 | Dispute evidence / chargeback evidence | MISSING (`Dispute` has no type/deadline/evidence/messages) | - | handbook L455 | M |
| B13 | Delivery proof model | MISSING | - | handbook L454 | M |

## C. Admin modules
| Module | Status | Gap |
|---|---|---|
| Overview / Action Centre | IMPLEMENTED (12 server-computed queues, drill-down hrefs, per-tile unavailable state). | Webhook "FAILED" status doesn't exist - health detects stuck PROCESSING only; queue/worker health not monitored (documented) |
| Global search | IMPLEMENTED (users, vendors, orders, payments, campaigns, subscriptions) | saved views, per-list sort controls not built (M) |
| Users | IMPLEMENTED (search/status/role, anonymised handling, suspension flow, notes, timeline, last-active) | PII masking helper only; no click-to-reveal (m) |
| Vendors | IMPLEMENTED (separate statuses, provider panel, trial, GMV per currency, close flow, notes) | referral/First-Sale panels not built |
| Orders | IMPLEMENTED (server-side filters, honest timeline, refund dialog, Stripe re-check) | delivery proof missing |
| Payments / Payouts | IMPLEMENTED (above) | - |
| Subscriptions | IMPLEMENTED (admin list/detail/actions, recovery schedule, dead-end fix, reports) | substitution flow not built; reports are counts, not full churn analytics |
| Community Buy / Markets / Suppliers | IMPLEMENTED (Super-Admin-only payments, readiness, supplier workflow, transition map, notifications) | no DISPUTED state; REFUNDING/FINANCIALLY_CLOSED not reachable; existing pending suppliers must resubmit (terms) |
| Automations | PARTIAL (rules, runs, suppression recording, retry, emergency stop, trial-ending) | event emits not wired for payment/order/subscription/communication; First Sale engine, referral, state-aware dashboard, attribution NOT built |
| Communications | IMPLEMENTED (single flow, channel status, consent, test proof, idempotency, pause, receipts, unsubscribe) | email needs live Resend verification; scheduled sends daily unless cron upgraded; no per-channel preference table |
| Conversations / Support | IMPLEMENTED (lifecycle, internal notes, filters, vendor entry) | live buyer/vendor round trip on devices (**LIVE**) |
| Content Review | IMPLEMENTED (queue, decisions, identity docs separate) | message attachments not detached on "remove" |
| Disputes / Escrow | PARTIAL (list/detail/decision fixed) | evidence model missing; Provider Controls page removed (it was a disabled notice) |
| Gift cards / Hot deals | IMPLEMENTED (code, balance, ledger, atomic redeem, pause/archive) | legacy purchased cards hidden until reconciled; cancel does not refund; LIVE purchase |
| Products | PARTIAL: list/detail/unpublish/restore/contact done; admin cannot create/edit (vendor app owns that) | seller-payment gate built but OFF by default (needs flag accuracy first) |
| Settings / Audit / RBAC | IMPLEMENTED (team, roles, 2FA enforcement, flags, integrations status, audit filters/export) | no device/session table; flags only act where code reads them |

## D. Handbook §8 / §12 (vendor growth & events)
First Sale Campaign engine, vendor referral + credit ledger, state-aware vendor dashboard, attribution metrics, canonical event emission beyond automation: **MISSING** (P2). Event table + `emit()` exist; only automation/trial events emit. Documented in `backend/docs/automation-centre.md`.

## E. Highest-risk findings (ordered)
1. No verified backup / restore (B).
2. Preview and Production share one DATABASE_URL (B) - migration step fixed in code; DB split is a manual action.
3. Required Stripe webhook events unverified in the Stripe dashboard (B).
4. 2FA enforcement will be ON in production by default; the owner admin must enrol first (C).
5. Missing env: `PUBLIC_API_URL`, `ADMIN_WEB_URL`; `CORS_ORIGIN` vs code's `CORS_ORIGINS` (C).
6. Commission data in production seller plans (C, owner decision).
7. Missing dispute-evidence and delivery-proof models, First Sale/referral/attribution (M, handbook gaps).

## Addendum 2026-10-05 (code-side closure pass)
Closed in code: CORS canonicalization (`CORS_ORIGINS`), production-only migration step, 14-day trial lifecycle + persisted trial dates, commission forced to 0 (`SALES_COMMISSION_ENABLED` opt-in), Super-Admin-only Community Buy payments verified over HTTP (67-case role matrix), canonical events (see EVENT_INVENTORY.md), dispute evidence/appeal + delivery proof (backend + admin), admin rate limiter. Still open: First Sale engine, vendor referral/credit ledger, state-aware vendor dashboard, attribution, mobile dispute/proof screens. See CODE_SIDE_BLOCKERS_CLOSED.md and MIGRATION_PRODUCTION_REHEARSAL.md (9 pending migrations).
