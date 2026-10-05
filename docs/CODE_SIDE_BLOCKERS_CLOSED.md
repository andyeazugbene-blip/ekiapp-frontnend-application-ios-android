# Code-Side Blockers: Closed / Open (2026-10-05)

Branches (local only, NOT pushed): BE `feat/admin-handbook-phase0`, FE `feat/admin-handbook-overhaul`. Nothing deployed, no production migration, no production DB/secret touched.

## Verification run (this pass)
| Check | Result |
|---|---|
| Backend `tsc --noEmit` | clean |
| Backend `vitest run` (all) | 177 files / 2835 tests pass |
| Admin-web `tsc --noEmit`, `next build` | clean / success |
| Admin-web `next lint` | 0 errors (a few pre-existing hook-deps warnings) |
| Mobile `tsc --noEmit` | clean |
| Mobile eslint | not runnable (no eslint v9 config in repo) - not claimed |
| Fresh local Postgres: `prisma migrate deploy` | 120 migrations applied; `migrate status` up to date |
| `prisma migrate diff` vs schema | No difference |
| AuditLog trigger (local) | UPDATE and DELETE rejected: "AuditLog is append-only" |

## Blocker table
| Blocker | Status | Evidence | Manual Action |
|---|---|---|---|
| 1 CORS var canonicalization | CLOSED | `src/config/cors.ts`, `cors-config.test.ts`; CORS_ORIGINS canonical, CORS_ORIGIN alias, prod never wildcard | Set `CORS_ORIGINS` in Vercel prod (names only in checklist) |
| 2 Migration architecture | CLOSED in code | `scripts/vercel-migrate.js` runs only when VERCEL_ENV=production (or FORCE_MIGRATE=1); `vercel-migrate.test.ts` | Preview/Prod share one Neon DB: split is MANUAL (Neon branch + Vercel env scoping) |
| 3 14-day trial lifecycle | CLOSED | `vendor-subscription-state.ts`, trial dates migration, webhook persistence tests, UI badges, "Override plan (no billing)" admin-only | Live Stripe trial test |
| 4 Financial correctness / no commission | CLOSED | `commission-policy.test.ts` (fee forced 0 unless SALES_COMMISSION_ENABLED=true), refund cap/idempotency tests | Live payment/refund test |
| 5 Stripe provider-state | CLOSED in code | signed + idempotent `runIdempotentWebhook`, account.updated/deauth/refund/subscription/identity handlers + tests, `vendor-provider-state-untrusted.test.ts` | Register webhook endpoint/events in Stripe dashboard; live event replay |
| 6 RBAC | CLOSED | `admin-role-matrix-http.test.ts` (67 direct HTTP cases), CB payments Super-Admin-only server-side | Confirm role assignments in production |
| 7-14 Support, comms, automations, foodstuff subs, community buy, products, gift cards, users/vendors | CLOSED in code (admin APIs + UI, tested); see ACCEPTANCE_MATRIX | test suite | Live acceptance per matrix |
| 15 Audit append-only | CLOSED | DB trigger + local proof above; failClosed audit | Verify trigger present on production after migrate |
| 16 Event inventory | PARTIAL | `EVENT_INVENTORY.md`; ~35 of ~70 canonical names emitted, rest listed NOT EMITTED, no dashboards on them | - |
| Dispute evidence / appeal | CLOSED backend+admin | migration `20261005110000`, `dispute-v2.test.ts` (29) | Mobile buyer/vendor screens NOT BUILT |
| Delivery proof | CLOSED backend+admin | `delivery-proof.*`, tests | Mobile vendor upload screen NOT BUILT; S3 signed URLs unverified live |
| Migration audit | CLOSED | `MIGRATION_PRODUCTION_REHEARSAL.md` | Neon branch rehearsal + MR-1 gift-card count |

## OPEN (handbook-required, NOT BUILT - owner parameters needed)
- First Sale Campaign engine (§8) - needs owner decisions on offer rules/limits.
- Vendor referral + credit ledger (§8) - needs reward amounts/qualification rules.
- State-aware vendor dashboard (§8) - not built.
- Attribution metrics (§12) - blocked on the two above and on un-emitted events; must be labelled "automation-assisted", never incremental.
- Remaining events (see inventory); mobile dispute/delivery-proof screens; automatic overdue-dispute job; admin evidence upload.
Not invented as "out of scope": these remain acceptance gaps.
