# Production Readiness - Final Report

Date: 5 Oct 2026. Code state: backend branch `feat/admin-handbook-phase0` @ `65cc7f4`; frontend branch `feat/admin-handbook-overhaul` @ `f618073`. **Nothing pushed, nothing deployed, no production database or secret touched.** Production currently runs backend `ffc6eb3` (deployed 2 Oct).

## 1. Executive Summary
**Verdict: NOT PRODUCTION READY.**

The admin system's code is in good shape (2678 backend tests, type-checks, lint and production build all pass; all 119 migrations apply to an empty database with zero schema drift). It is not production ready because several gates are outside code or unproven, and some handbook features are not built:
1. No verified database backup or restore drill (hard gate).
2. Preview and Production share one `DATABASE_URL` (code now stops previews from migrating; the database split is a manual Vercel step).
3. Required Stripe webhook events and live provider behaviour have not been verified; nothing has been run against live Stripe, Resend, push, or devices.
4. Missing/unchecked production env: `PUBLIC_API_URL`, `ADMIN_WEB_URL`, 2FA enrolment plan.
5. Handbook features not built: First Sale Campaign engine, vendor referral + credit ledger, state-aware vendor dashboard, attribution metrics, dispute-evidence and delivery-proof models, most event emission.

## 2. PASS
- Stripe-led verification: no manual approve/reject (server 409 + UI), provider state shown as identity / charges / payouts / requirements.
- Failed payments show the real provider reason and "No funds were collected"; fee/earnings not shown.
- Refunds: per-order records, cumulative cap, idempotency, multi-vendor scoping, webhook-driven status.
- Users/vendors: separate statuses, suspension with reason/notify/audit, anonymised accounts protected, Close Account (no hard delete), notes, timeline.
- 14-day trial persisted from Stripe (start/end/days left) and shown in admin and vendor API.
- RBAC server-side; Operations/Finance Admin roles seeded; mandatory-2FA mechanism; append-only audit (proved: UPDATE and DELETE rejected by DB).
- Communications engine (one flow), Content Review, support inbox, Action Centre, global search, Foodstuffs Subscriptions admin + recovery schedule, gift-card redemption (atomic), Community Buy Super-Admin-only payments + readiness, supplier workflow, automation rules/runs/retry/emergency stop.
- Migration build step: previews/unset skip migrations (script tested).

## 3. PASS WITH CAVEAT
- Commission: UI flags any fee as non-agreed; **production seller-plan fee data was not changed**.
- Scheduled communications run on the daily sweep only (5-minute cron removed to avoid breaking a Hobby-plan deploy).
- Seller-payment purchase gate built but **OFF by default** (vendor Stripe flags in prod are unverified).
- Existing pending supplier applications must be re-submitted (terms acceptance was not stored before).
- Old purchased gift cards are hidden until reconciled against Stripe.
- Automation Centre: monitoring + controls done; events emitted only for automation/trial.

## 4. BLOCKED
| Item | Why |
|---|---|
| Backup / restore | No evidence; Neon console not accessible. Steps in `BACKUP_RESTORE_RUNBOOK.md` |
| Preview DB isolation | Needs a separate Preview `DATABASE_URL` in Vercel (manual) |
| Stripe dashboard webhook subscription | Not readable from here |
| `PUBLIC_API_URL`, `ADMIN_WEB_URL`, 2FA decision | Owner/Vercel action |
| Production-data migration rehearsal | Needs a Neon branch of production |

## 5. NEEDS MANUAL PRODUCTION VERIFICATION
Real checkout success + failure; real refund end to end; Connect account complete/restrict/restore; real 14-day trial through Stripe checkout and the `trial_will_end` notification; subscription renewal failure on a real card; push on iOS and Android; real email via Resend with unsubscribe; buyer/vendor -> support -> reply on devices; gift-card purchase through Stripe; production 2FA enrolment; role journeys with real Support/Ops/Finance accounts; Android Google Sign-In (separate task). See `PRODUCTION_ACCEPTANCE_MATRIX.md`.

## 6. Missing Handbook Features
First Sale Campaign engine + diagnostic; vendor referral programme + credit ledger; state-aware vendor dashboard; attribution (assisted/incremental) metrics; dispute evidence/deadline/messages model; delivery-proof model; canonical events for payments/orders/subscriptions/communications/merchant activation; automatic subscription substitution; PII click-to-reveal; user-created audience segments; per-user timezone; DISPUTED campaign state; saved views.

## 7. Database / Migration Status
- Applied in production (per 2 Oct build log): `20261002130033`, `130100` (audit append-only trigger), `140100`, `140200`.
- **Pending (8)**, all additive (new nullable columns or columns with defaults; new tables; enum additions): `20261002140500` communications/content review, `140600` setting description, `140800` subscription admin, `140900` Community Buy markets/suppliers (also flags already-enabled markets "readiness unverified"; no feature disabled), `141000` gift cards/products (marks legacy purchased cards PENDING_PAYMENT), `141100` automation centre + events, `20261004200139` refunds, `20261005094856` vendor trial dates.
- Verified: empty-DB apply OK; `migrate diff` empty; no destructive SQL (no DROP/TRUNCATE/DELETE); only two data `UPDATE`s (markets flag, gift-card status). Lock risk low (ADD COLUMN with defaults is metadata-only on PostgreSQL 11+; small tables for the UPDATEs). Rollback: forward-only; app rollback by promoting the previous deployment; data repair via Neon restore.
- Unknown: contents of the production `_prisma_migrations` beyond the 2 Oct log (read-only SQL in runbook).

## 8. Backup / Restore Status
BLOCKED - MANUAL ACTION REQUIRED. No backup evidence; restore never tested. Runbook created, not executed.

## 9. Vercel / Deployment Status
- Backend: production deployment `dpl_HkPodFumHBNGZBsD9JcdP2nMFLMx` (2 Oct 19:49, commit `ffc6eb3` by timing). Build step previously ran `migrate deploy` for **every** environment; now production-only.
- `DATABASE_URL` still shared by Preview and Production (**fix manually**, checklist).
- Admin panel: separate Vercel project `admin-web`, not git-linked, deployed with `vercel --prod` from `admin-web` using `NEXT_PUBLIC_API_URL`.
- Frontend repo `main` on GitHub contains a merged early PR (docs + UI toolkit) from 2 Oct; the full overhaul is unmerged.

## 10. Environment Variables
See `PRODUCTION_ENVIRONMENT_CHECKLIST.md`. Notable: unset in production - `PUBLIC_API_URL`, `ADMIN_WEB_URL`, `ADMIN_2FA_ENFORCE` (so ON), `SENTRY_DSN`, `EXPO_ACCESS_TOKEN` (optional). `CORS_ORIGIN` exists but code reads `CORS_ORIGINS` (falls back to the built-in allow-list, which includes the current admin host).

## 11. Stripe / Webhooks
Handlers present, signature-verified, idempotent (claim -> work -> mark; failure releases the claim and returns non-2xx): `charge.refund.updated`, `charge.refunded`, `account.updated` (organiser then vendor), `account.application.deauthorized`, `customer.subscription.trial_will_end`, `customer.subscription.updated/deleted`, `invoice.payment_failed`, identity `verified/requires_input/processing/canceled/redacted`, payment/dispute/payout events. **Dashboard subscription to these events is unverified** (NEEDS MANUAL PRODUCTION VERIFICATION). Connected-account events require the endpoint to receive Connect events.

## 12. Notifications
In-app + push (via Expo Push Service -> APNs/FCM) + email (Resend) paths exist with failure handling; delivery is recorded as "handed to provider" and becomes "delivered" only with an Expo receipt; email reports "not configured" instead of faking success. Receipts are polled in the daily sweep. No real delivery has been observed. SMS out of scope.

## 13. Security / RBAC / 2FA
Server-side permission checks on every admin route (only self-service routes are role-only); reasons required and fail-closed audit on money/role/settings mutations; 2FA enforcement flag (default ON in production, OFF elsewhere) with enrolment UI; admin API rate budget 600/min/IP; secrets never logged or committed. Caveats: in-memory rate limiter is per-instance; 2FA enrol/disable audit is best-effort; no device/session table.

## 14. Critical User Journeys
All executed locally only - see `PRODUCTION_ACCEPTANCE_MATRIX.md` (18 rows). None is accepted as live.

## 15. Test Results
Backend: 167 files / **2678 tests pass**; `tsc` clean. Admin-web: `tsc` clean, `next lint` + production build succeed. Mobile `tsc` clean (checked before the final small changes, which did not touch mobile). Fresh-database migration: pass, no drift. Not run: end-to-end tests excluded by project config; no live-provider tests.

## 16. Exact Manual Actions Remaining
1. Neon: confirm plan/PITR, create branch `pre-admin-overhaul`, run the restore drill; fill the runbook table.
2. Neon: create a Preview branch DB; in Vercel set Preview-only `DATABASE_URL` and Preview `STRIPE_SECRET_KEY` (test key).
3. Vercel Production env: add `PUBLIC_API_URL`, `ADMIN_WEB_URL`; decide `ADMIN_2FA_ENFORCE`; verify S3/Resend values are valid.
4. Stripe dashboard: confirm webhook events + Connect events subscription.
5. Decide commission handling: zero the production seller plans via Admin > Seller plans (the code does not do this).
6. Owner admin: enrol 2FA (or set the flag false for first deploy).
7. Rehearse the 8 pending migrations on a Neon branch of production.
8. Run the live journeys in the acceptance matrix with the owner observing.

## 17. Exact Deployment Sequence (only after explicit approval)
1. Complete actions 1-4 and 7 above.
2. Merge `feat/admin-handbook-phase0` to backend `main` and push -> Vercel production build runs `prisma generate` then `migrate deploy` (production only).
3. Check build log shows the 8 migrations applied; `GET /api/health` and `/api/health/detailed`.
4. Sign in to the current admin panel; confirm login and 2FA path.
5. `cd admin-web && npx vercel --prod` (with production `NEXT_PUBLIC_API_URL`).
6. Smoke test: Overview, Vendors, Payments, Support, Communications (test send only).
7. Merge frontend branch to GitHub only after confirming it does not trigger mobile CI unintentionally.

## 18. Rollback Plan
App: Vercel "Promote" the previous deployment (old code is compatible with the new additive schema). Admin panel: promote its previous deployment. Data: Neon restore to the pre-deploy branch. Migrations are not reversible in place.

## 19. Final Recommendation
**NOT PRODUCTION READY.** Close the manual blockers in section 16 first. The code can be deployed safely once the backup and environment gates pass, but the handbook's P2 features (section 6) remain unbuilt, and live acceptance has not been performed.

| Area | Status | Evidence | Remaining Action |
|------|--------|----------|------------------|
| Code quality | PASS | 2678 tests, tsc, lint, build | - |
| Migrations | PASS WITH CAVEAT | empty-DB apply, no drift, additive | rehearse on prod copy |
| Backup / restore | BLOCKED | none | owner drill |
| Preview/Prod DB isolation | BLOCKED | shared DATABASE_URL | split DB (manual) |
| Env configuration | BLOCKED | names audited | set PUBLIC_API_URL, ADMIN_WEB_URL, 2FA decision |
| Stripe webhooks | NEEDS MANUAL VERIFICATION | handlers + tests | confirm dashboard subscription |
| Payments / refunds | PASS WITH CAVEAT | unit + local | live run |
| Subscriptions / trial | PASS WITH CAVEAT | unit + local | live Stripe trial + renewal |
| Notifications | NEEDS MANUAL VERIFICATION | engine + local | device/email run |
| Security / RBAC / 2FA | PASS WITH CAVEAT | tests + API | production enrolment, role journeys |
| Audit append-only | PASS (local) | trigger blocks UPDATE/DELETE | confirm in prod |
| Handbook P2 features | MISSING | audit | build or accept deferral |
