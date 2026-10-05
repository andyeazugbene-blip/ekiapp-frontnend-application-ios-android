# Acceptance Evidence Matrix (Handbook Appendix B / §15 / §16.1)

Status vocabulary - used honestly:
- **Built + locally verified** - implemented, unit-tested, and exercised against a local disposable Postgres (API + browser). NOT proof against live providers.
- **Needs live proof** - the handbook requires a real account/device/provider run observed by the product owner. No item below is marked Pass for that.
- **Not built** - listed so nothing is silently missing.

Test suite at hand-off: backend 167 files / 2676 tests passing; admin-web and mobile `tsc` clean; admin-web production build succeeds; all 36 migrations apply to an empty database with no schema drift.

| Feature (handbook) | Built | Local evidence | Live proof still required (owner-observed) |
|---|---|---|---|
| Stripe-led verification (§5.1, 14.3) | Yes | 409 on manual approve/reject for Stripe vendors (API + unit); account.updated + identity webhooks claim/rethrow tests; provider readiness UI | Complete, restrict, restore a real Stripe test account; show matching state in Stripe, admin, vendor app |
| Payments / failed payment (14.8) | Yes | Failed payment shows real code + "No funds were collected..." (browser); fee/earnings nulled | One successful checkout, one deliberately failed with real Stripe reason, reconcile in Stripe |
| Refunds (5.2, 14.8) | Yes | Cumulative cap, idempotency, partial leaves order open, multi-vendor scoping (unit) | Real refund: Stripe confirmation -> webhook -> status Completed; partial refund on a multi-vendor checkout |
| Users / suspension (14.5, 4.3) | Yes | Suspend/restore dialog end-to-end in browser; anonymised cannot be suspended (unit + UI) | Suspend + reactivate a real test user; confirm app access change + notification received |
| Vendors (14.7) | Yes | Reconciled counts, list/detail share subscription, Close Account pre-checks | Register -> verify -> trial -> product -> order -> GMV -> disable market -> suspend/reactivate |
| Conversations (14.2) | Yes | Lifecycle, internal notes hidden from participants (unit + API) | Buyer and vendor each message from the real apps; admin replies; both receive |
| Communications (6.2, 15.6) | Yes | Channel status, eligible/excluded counts, test proof, idempotency, pause (API + browser) | Push on iOS TestFlight + Android; email needs RESEND_API_KEY + verified sender; receipts recorded |
| Content Review (7) | Yes | Moderation transitions, identity docs separated (API) | Review a real flagged upload end to end |
| Foodstuffs Subscriptions (9, 15.4) | Yes | Admin list/detail/actions, retry schedule, dead-end fix (unit + API + browser) | Real subscription create -> renewal -> payment failure -> recovery |
| Community Buy / markets / suppliers (10, 14.9, 14.11) | Yes | Transition map, Super-Admin-only payments enablement, supplier guards (unit + API) | Live campaign visible to a second buyer; success + failure/refund paths |
| Gift cards (14.4) | Yes | Concurrent redeem -> exactly one success (local DB) | Purchase, deliver, redeem once, second redeem blocked, same balance in app/admin/payment |
| Products + seller readiness (14.6) | Yes (gate default OFF) | Unpublish/restore with reason + vendor notice | Enable gate only after vendor readiness flags verified |
| Automations (14.10, 15.3) | Partly | Suppression recording, rules, retry w/o duplicate, emergency stop (unit + API) | Trigger real events on test devices; one failure; pause/reactivate a rule |
| Security (13) | Yes | 2FA enforcement flow, invite -> set password -> login, reasons required (API) | Role journeys with support / ops / finance accounts; production 2FA enrolment |
| Overview / search / nav (2, 3) | Yes | Action Centre with real aggregates; Ctrl+K search (browser) | - |
| Test-record isolation (2.1 L139) | Yes | isTest flags + exclusion; flag script is dry-run only | Run `scripts/flag-test-data.ts` dry-run against production, review, then `--apply` |

## Not built (see docs/admin-handbook-gap-analysis.md)
SMS (out of scope by client decision); vendor referral programme + credit ledger; First Sale Campaign engine / diagnostic; state-aware vendor dashboard; attribution (assisted/incremental) metrics; opened/clicked tracking; DISPUTED campaign state; dispute evidence/messages model; order delivery-proof model; automatic substitution for subscriptions; PII click-to-reveal; event emits beyond automation/trial; per-user timezone.

## Operational items that code cannot close
GitHub / Vercel / EAS / Stripe / Apple / Google / Firebase ownership transfer to Eki; secrets vault + rotation of the loose credential files; database backup + restore drill; Sentry alert owner; iOS build 124 (Codemagic or EAS plan); Android Google Sign-In real-device test; production values for ADMIN_2FA_ENFORCE, RESEND_API_KEY, PUBLIC_API_URL, ADMIN_WEB_URL.
