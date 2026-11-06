# Acceptance Evidence Matrix (Handbook Appendix B / §15 / §16.1)

Status vocabulary - used honestly:
- **Built + locally verified** - implemented, unit-tested, and exercised against a local disposable Postgres (API + browser). NOT proof against live providers.
- **Needs live proof** - the handbook requires a real account/device/provider run observed by the product owner. No item below is marked Pass for that.
- **Not built** - listed so nothing is silently missing.

Test suite on 2026-11-06: backend 219 files / 3419 tests passing; admin-web and mobile `tsc` clean; all 147 migrations apply to an empty database. See `test-evidence.md`.

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
| Attribution and email results (12, 12.1, 6.2) | Yes | Journey 26; admin Results tab | Real automation followed by a real order; Resend webhook set up and a real open and click |
| Contact masking and reveal (13) | Yes | Journey 30, browser | Each admin role reveals a contact; check the audit log |
| Community Buy dispute hold (10.2, 10.4) | Yes | Journey 30 | Dispute on a real campaign holds a real supplier payment |
| Test-record isolation (2.1 L139) | Yes | isTest flags + exclusion; flag script is dry-run only | Run `scripts/flag-test-data.ts` dry-run against production, review, then `--apply` |
| Launch settings, entry routing, partner codes (Phase 1) | Yes | Journeys 21 + settings journey | Scan a partner code on a real phone; install path needs a deep-link provider (K13) |
| My Community Buys, drafts, offers, extensions (Phase 1) | Yes | Journeys 68 + 25 | Organiser and supplier on two real devices |
| Community Buy CB01-CB89 flags, receipts, supplier actions | Yes | Journeys 27 + 16 | Live campaign to success and to failure. Card holds blocked on Connect (K12) |
| Regular Delivery S01-S63 | Yes | Journeys 20 + 29 | Real renewal, failed payment, recovery |
| Account close, dashboard states, handbook automations | Yes | Journey 14 | Close a real test account; see each dashboard state on a device |
| Vendor referral programme (Handbook) | Yes | Journey 37 | Real referral through first membership payment, credit visible on a real invoice |
| First Sale Campaign (Handbook) | Yes | Journey 37 | Real vendor with no sale; buyer with consent receives the message |
| Discovery, new vendor boost, demand matching | Yes, except product list ranking (K17) | Journey 15 | Owner reviews real listing order |

## Not built (see docs/admin-handbook-gap-analysis.md)
SMS (out of scope by client decision); estimated incremental revenue, which needs a holdout group.

Corrected 2026-11-06: order disputes with evidence, messages and appeal, and order delivery proof, were already built when this list last said otherwise. Automatic substitution and per-user timezone aren't in the client documents. Unavailable items follow the controlled flow, and admin dates show their timezone.

Vendor referral, the credit ledger, First Sale Campaign, the state-aware dashboard, all 83 canonical events, email opened and clicked results, attribution, contact masking with audited reveal and the Community Buy dispute hold moved out of this list on 2026-11-06. They are built and await live proof.

## Operational items that code cannot close
GitHub / Vercel / EAS / Stripe / Apple / Google / Firebase ownership transfer to Eki; secrets vault + rotation of the loose credential files; database backup + restore drill; Sentry alert owner; iOS build 124 (Codemagic or EAS plan); Android Google Sign-In real-device test; production values for ADMIN_2FA_ENFORCE, RESEND_API_KEY, PUBLIC_API_URL, ADMIN_WEB_URL.
