# Live Verification Blockers

Every row is code-complete (unit/HTTP tests with mocks, local DB) but has **never been run against the real provider**. Status stays `NOT TESTED` until someone executes the live test and records evidence. No row is PASS.

| Feature | Code Ready | External Provider | Exact Live Test | Status |
|---|---|---|---|---|
| Production migrations (9 pending) | Yes; fresh-DB apply + no drift | Neon | Neon backup branch -> `prisma migrate deploy` on a branch copy of prod -> `migrate status` clean -> `migrate diff` empty | NOT TESTED |
| Audit append-only trigger in prod | Yes; proven on local DB | Neon | After migrate, as app role: UPDATE/DELETE on `AuditLog` must fail | NOT TESTED |
| Preview/Prod DB separation | Migration guard in code | Neon + Vercel | Preview build log shows "SKIP migrate"; Preview uses a different DATABASE_URL host/branch | NOT TESTED |
| Production-only migrate on build | Yes (`scripts/vercel-migrate.js`) | Vercel | Production build log shows migrate step; preview build does not | NOT TESTED |
| CORS | Yes | Vercel | Browser preflight from admin origin succeeds; from foreign origin fails | NOT TESTED |
| Cron daily sweep | Yes | Vercel | Call with `Authorization: Bearer CRON_SECRET`; 401 without; check run log | NOT TESTED |
| Checkout / payment_succeeded | Yes | Stripe | Test-mode card checkout -> webhook -> order PAID, one `payment_succeeded` Event | NOT TESTED |
| Webhook signature + replay | Yes | Stripe | Send bad-signature (400) and replay same event id (processed once) | NOT TESTED |
| Refund (admin + charge.refunded) | Yes | Stripe | Partial then full refund; cumulative cap; one reversal per order | NOT TESTED |
| Vendor subscription + 14-day trial | Yes | Stripe | Start trial; `trialEndsAt` = Stripe trial_end; invoice at day 14; cancel in trial | NOT TESTED |
| Stripe Connect onboarding / account.updated / deauthorization | Yes | Stripe Connect | Onboard test vendor; requirements-due; deauthorize app; dashboard state follows | NOT TESTED |
| Stripe Identity verification | Yes | Stripe Identity | Complete a test verification session; vendor verified via webhook | NOT TESTED |
| Payouts (admin approve / mark paid, receipt PDF email) | Yes | Stripe + Resend | Approve test payout; receipt email received | NOT TESTED |
| Transactional + broadcast email | Yes | Resend | Domain verified; send test; bounce/complaint handling observed | NOT TESTED |
| Push notifications | Yes | Expo push | Send to real device; receipt tickets resolve | NOT TESTED |
| Dispute evidence + delivery-proof uploads (private, signed 5-min URLs) | Yes (mocked storage) | S3 | Upload photo as buyer/vendor; open signed URL; URL dies after expiry; other users get 404 | NOT TESTED |
| Mobile dispute / delivery-proof flows | See mobile section of FINAL doc | Real devices (iOS/Android) | Walk each flow on device incl. permission denial, offline, upload failure | NOT TESTED |
| Google/Apple sign-in | Yes | Google/Apple | Real-device sign-in on release build | NOT TESTED |
| 2FA enforcement for admins | Yes | Production env | `ADMIN_2FA_ENFORCE` effective; admin without 2FA blocked on sensitive actions | NOT TESTED |
| Role assignments for real admins | Yes | Production DB | Log in as each of Support/Operations/Finance/Super; compare to role matrix | NOT TESTED |
| Admin UI against production API | Build passes | Vercel (admin-web) | `NEXT_PUBLIC_API_URL` correct; all pages load with real data | NOT TESTED |
| Backup restore | Runbook only | Neon | Restore branch from PITR; row-count compare | NOT TESTED |
