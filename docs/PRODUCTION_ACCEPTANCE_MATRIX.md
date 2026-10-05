# Production Acceptance Matrix

Every row says what was **actually executed**. "Local" = code + unit/integration tests + a local disposable Postgres, API calls and a browser session against the real admin UI. No row below was run against live Stripe, Resend, Expo/APNs/FCM, real devices or production data. Every critical journey therefore still requires an owner-observed live run: **NEEDS MANUAL PRODUCTION VERIFICATION**.

Test identities (local only, seeded in the disposable DB): buyer `buyer1@seed.test`; vendors alpha-echo `@seed.test`; admins `admin@local.test` (Super) and `ops1@local.test` (Operations Admin). Support/Finance/Organiser/Supplier journeys were exercised through the permission tests and API, not with separate real devices.

| # | Critical journey | Input -> action | DB state (local) | Provider state | Notification / outcome | Audit | Failure behaviour | Result |
|---|---|---|---|---|---|---|---|---|
| 1 | Stripe vendor cannot be manually approved | admin PATCH verifications/vendors approve | unchanged | n/a | 409 STRIPE_MANAGED | none needed | UI hides buttons | Local PASS / LIVE needed |
| 2 | Vendor Connect sync | `account.updated` (mocked event) | charges/payouts/requirements columns written | mocked | admin panel shows 3 separate states | webhook row | handler throws -> claim released -> Stripe retries | Local PASS (unit) / LIVE needed |
| 3 | Failed checkout | PaymentIntent failed event | Payment FAILED + code/message; fee/earnings nulled | mocked | admin: "No funds were collected..." | WebhookEvent | idempotent | Local PASS |
| 4 | Partial refund, multi-vendor checkout | admin refund 25% of order A | Refund row; order A still open; order B untouched | mocked Stripe | "requested - awaiting Stripe" | ORDER_REFUNDED (fail-closed) | cap exceeded -> 400; replay -> same refund | Local PASS (unit) / LIVE needed |
| 5 | Full refund then webhook | charge.refunded | order REFUNDED once; wallet reversed once; stock once | mocked | buyer "Refund processed" | yes | re-delivery no-op | Local PASS (unit) |
| 6 | Suspension | admin suspends user/vendor with reason | suspended* columns, token revoked | n/a | in-app + email (queued) | before/after | anonymised -> 409 | Local PASS (browser) / device LIVE |
| 7 | Close vendor | close with open orders | blocked 409 + list | n/a | - | - | pre-checks | Local PASS (API) |
| 8 | 14-day trial | `subscription.updated` trialing | trialStartedAt/EndsAt = Stripe window (14 days) | mocked | `trial_will_end` automation | webhook row | non-trial: no dates invented | Local PASS (unit); real Stripe checkout trial **LIVE** |
| 9 | Subscription renewal failure | payment fails x3 | retry +1d/+3d/+5d; then renewal CANCELLED, subscription PAUSED payment_failed | mocked | buyer notified each step | audit | no double charge (idempotent) | Local PASS (unit + DB) / LIVE |
| 10 | Support round trip | buyer/vendor thread -> admin reply | message rows; internal notes hidden | n/a | push+in-app to recipient (queued) | support.reply | closed thread reopens on user message | Local PASS (API+browser); **device LIVE** |
| 11 | Broadcast | test -> confirm -> send | Broadcast + per-recipient logs | Expo/Resend not reachable locally | email honestly "not configured"; push "handed to Expo" until receipt | yes (2FA+reason) | double-click idempotent; pause blocks | Local PASS; **LIVE** |
| 12 | Community Buy payments enablement | non-super admin tries | blocked 403 | n/a | participants notified on disable | yes | readiness incomplete -> 409 | Local PASS (unit+API) |
| 13 | Gift card redeem | 3 concurrent redeems | exactly 1 success; ledger row | n/a | - | yes | expired/paused/currency mismatch refused | Local PASS (DB); purchase via Stripe **LIVE** |
| 14 | Automation suppression/retry | quiet hours / no consent / failed run | SUPPRESSED rows with reason; retry creates new run key | n/a | - | rule changes audited | no duplicate on retry | Local PASS (unit) |
| 15 | Content review | reject with reason | ContentDecision + owner notified | n/a | owner notified | yes | concurrent reviewer guarded | Local PASS (API) |
| 16 | Admin RBAC / 2FA | ops admin on settings | 403 | n/a | - | - | ENFORCE flag: TWO_FACTOR_SETUP_REQUIRED then success with code | Local PASS (API) |
| 17 | Migrations on empty DB | `migrate deploy` of all 119 | schema matches Prisma (diff empty); audit UPDATE/DELETE blocked | n/a | - | - | - | PASS |
| 18 | Preview cannot migrate production | `VERCEL_ENV=preview` build step | no migration run | n/a | - | - | - | Local PASS; Vercel Preview DB split **BLOCKED - MANUAL ACTION REQUIRED** |

Not built (cannot be accepted): First Sale Campaign engine, vendor referral + credit ledger, state-aware vendor dashboard, attribution metrics, dispute evidence model, delivery-proof model, most canonical event emits. SMS is out of scope.
