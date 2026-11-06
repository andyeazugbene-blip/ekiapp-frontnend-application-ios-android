# Test evidence (Handbook §17)

Recorded 2026-11-06. **This is engineering evidence, not acceptance.** The Handbook requires the product owner to observe each journey on real devices and accounts. `acceptance-evidence-matrix.md` lists what is still needed.

## Automated tests

| Check | Result |
|---|---|
| Backend tests (`npx vitest run`, with `DATABASE_URL` unset) | 223 files, 3474 tests passing |
| Backend CI: type-check, scaffolding check, coverage map | Passing on each merged PR |
| App and admin type-check | Clean |

## End-to-end journeys

These ran against the real API with a throwaway PostgreSQL database and a Stripe **test** key. They never touched production. The scripts are in `journeys/`, and its README says how to run them.

| Journey | Checks | Covers |
|---|---|---|
| Full regression | 129 | Sign-up, orders, payments, refunds, roles |
| Phase 1 | 68 | Account, routing, Community Buy |
| Entry routing | 21 | Partner codes, guest browsing, web page |
| Extensions | 25 | Extension requests, supplier reconfirmation |
| Community Buy stage | 27 | Flags, notify me, receipts, operations |
| Regular Delivery stage | 20 | Remove item, renewal receipts, S58, S59 |
| Handbook stage | 14 | Account close checks, dashboard state, automations |
| Remaining screens | 29 | Offer steps, stock allocation, recheck, support cases |
| Supplier actions | 16 | CB65, CB67, CB69 |
| Growth | 37 | Referrals, credit release and reversal, First Sale |
| Discovery | 15 | Unverified vendor listing, boost, demand matching |
| Events and email results | 26 | Resend webhook signatures and repeats, once-only events, attribution, window setting |
| Privacy and dispute hold | 30 | Masking, audited reveal, permissions, dispute hold on money |
| Product ranking | 16 | Ranking inputs, paging, search, sort, demo and inactive products |

Mobile screens were also checked in a browser, using the web build at phone width.

## What this does not prove

- **No real phone has run any of it.** That includes the card sheet, QR scan, push notifications and app store install.
- **Card holds (`AUTHORISE_THEN_CAPTURE`) have not run against real Stripe Connect**, because the test key's account doesn't have Connect. The UK stays on pledge mode. See K12.
- **Real SMS** hasn't been sent.
- **Backup restore** hasn't been run. See `database-package.md`.
- **The 10-minute scheduler is failing** on production. See K11.
- Stripe Identity, bank verification and live payouts need real accounts.
- Email delivered, opened and clicked results need the Resend webhook set up. See `webhook-register.md`.

## Live release record

| Stage | Backend PR | Mobile PR | Update group |
|---|---|---|---|
| Launch settings | 61 | 18 | `1a2aedff` |
| Entry routing | 62 | 19 | `360e664f` |
| Phase 1 gaps | 63 | 20 | `45fad8e7` |
| Community Buy | 64 | 21 | `e3e2ef5e` |
| Regular Delivery | 65 | 22 | `bdd845da` |
| Handbook | 66 | 23 | `2015e66a` |
| Copy pass 1 | - | 24 | `47891a66` |
| Remaining screens | 67 | 25 | `5d1ec80a` |
| Growth | 68 | 26 | `4369a678` |
| Discovery | 69 | 27 | `21be4693` |
| Copy pass 2 and handover | - | 28 | `36cac69e` |
| Health route hardening | 70 | - | Not needed |
| Events, email results, attribution | 71 | 30 | Not needed (admin) |
| Contact masking, dispute hold | 72 | 31 | Not needed (admin) |
| Product ranking, insights, wording | 73 | 32 | `b4a758af` |
