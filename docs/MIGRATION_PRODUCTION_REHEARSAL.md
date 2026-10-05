# Migration Production Rehearsal

Scope: every Prisma migration that is in the backend repo (branch `feat/admin-handbook-phase0`) but **not yet applied to production**.
Nothing here was run against production. Evidence below comes from reading the SQL and from running `prisma migrate deploy` on a **disposable local Postgres** (fresh DB), followed by `prisma migrate diff` (schema drift check).

Already applied to production (do not re-run): `20261002130033`, `20261002130100` (AuditLog append-only trigger), `20261002140100`, `20261002140200`.

## Pending migrations (in apply order)

| # | Migration | Schema change | Data migration | Defaults / nullability | Lock / risk | Needs code deployed first? | Rollback |
|---|-----------|---------------|----------------|------------------------|-------------|----------------------------|----------|
| 1 | `20261002140500_communications_content_review` | New `Broadcast`, `CommunicationTemplateVersion` tables, enum `BroadcastStatus`; add cols to `CommunicationLog`, `ContentDecision`, `ContentReport`, `PushTicket`, `ScheduledCommunication` | none | `ScheduledCommunication.category NOT NULL DEFAULT 'marketing'`, `channels TEXT[] DEFAULT '{}'`; others nullable | ADD COLUMN with constant default = metadata-only on PG11+. Short ACCESS EXCLUSIVE lock per table. Low | No (old code ignores new columns) | Forward-only. Revert = redeploy previous code; leave columns (additive) |
| 2 | `20261002140600_admin_platform_setting_description` | `AdminPlatformSetting.description TEXT` | none | nullable | Trivial | No | Same |
| 3 | `20261002140800_foodstuffs_subscription_admin` | `BuyerSubscription.pausedAt/pausedReason/cancelReason`, `Renewal.awaitingStockSince/nextRetryAt`, index `Renewal(status,nextRetryAt)` | none | all nullable | Index build on `Renewal` blocks writes while building (CREATE INDEX not CONCURRENTLY). Renewal table small. Low | No | Same |
| 4 | `20261002140900_community_buy_ops_markets_suppliers` | `CommunityCampaign` cols + unique `slug`; `MarketConfiguration` readiness booleans; `SupplierAccount` cols; `ALTER TYPE SupplierAccountState ADD VALUE IF NOT EXISTS 'REJECTED'` | **`UPDATE MarketConfiguration SET readinessUnverified=true WHERE communityBuyPaymentsEnabled=true`** (marks already-enabled markets as needing re-verification; does **not** disable payments) | booleans `NOT NULL DEFAULT false` | `CREATE UNIQUE INDEX CommunityCampaign.slug` fails if duplicate non-null slugs exist -> **verify with `SELECT slug,count(*) ... HAVING count(*)>1` before** (new nullable column, so duplicates impossible unless backfilled; low). Enum `ADD VALUE` does not use the new value in the same file, safe inside Prisma's transaction on PG12+ | No | Same. Data change is a flag only; reversible by `UPDATE ... SET readinessUnverified=false` |
| 5 | `20261002141000_gift_cards_products_admin` | `GiftCard.archivedAt`, `Product.adminUnpublishedAt`, `Reward.archivedAt`; `PurchasedGiftCard` add `code` (unique), `remainingBalance`, `status` enum `GiftCardStatus`; new `GiftCardRedemption` + FK | **`UPDATE PurchasedGiftCard SET status='REDEEMED' WHERE isRedeemed=true`** (backfill). Note: other rows get default `PENDING_PAYMENT` and `remainingBalance 0` -> **review**: existing paid, unredeemed cards must not be stuck as `PENDING_PAYMENT`. See MR-1 | `remainingBalance NOT NULL DEFAULT 0`, `status NOT NULL DEFAULT 'PENDING_PAYMENT'` | Full-table UPDATE on `PurchasedGiftCard` (small table). See MR-1 | No | Data backfill not auto-reversible; take Neon branch/backup first |
| 6 | `20261002141100_automation_centre_events` | New `Event`, `AutomationRule` tables, enum `AutomationRuleState`; `AutomationRun` cols (`attempt` etc.); `ALTER TYPE AutomationType ADD VALUE 'VENDOR_TRIAL_ENDING'` | none | `attempt INT NOT NULL DEFAULT 1`, `isTest BOOLEAN NOT NULL DEFAULT false` | Index on `AutomationRun` (small). `ADD VALUE` (no IF NOT EXISTS) – fails if re-run manually, fine under migrate | **Code that emits events assumes `Event` exists: deploy migration first** | Forward-only |
| 7 | `20261004200139_refunds` | New `Refund` table + enum `RefundStatus`; unique `idempotencyKey`, `providerRefundId` | none | n/a (new table) | None (new table) | Admin refund code needs table; run migration **before** code | Forward-only; drop table only if no refunds recorded |
| 8 | `20261005094856_vendor_subscription_trial_dates` | `VendorSubscription.trialStartedAt/trialEndsAt` | none (existing rows keep NULL = no known trial; lifecycle derives correctly) | nullable | Trivial | No | Forward-only |
| 9 | `20261005110000_dispute_v2_delivery_proof` | `Dispute` +13 cols; new enums; new `DisputeEvidence`, `DisputeMessage`, `OrderEvidence` tables + FKs | `UPDATE Dispute SET respondByAt = createdAt + 5 days WHERE respondByAt IS NULL` | `type NOT NULL DEFAULT 'OTHER'`, `appealStatus NOT NULL DEFAULT 'NONE'`; rest nullable | Dispute table small. Backfill sets deadlines on historic disputes in the past -> they will look "overdue" in admin; acceptable, noted | Dispute/proof routes need tables: migration before code | Forward-only |

## Rules for the production run (manual)
1. Take a Neon backup/branch first (see `BACKUP_RESTORE_RUNBOOK.md`). **Manual: Neon console.**
2. Run `npx prisma migrate status` against production (read-only) to confirm exactly the nine above are pending and nothing is "failed".
3. Run `npx prisma migrate deploy` once, from one machine, **or** let the production Vercel build do it (`VERCEL_ENV=production` only; previews never migrate — `scripts/vercel-migrate.js`, tested in `src/tests/vercel-migrate.test.ts`).
4. After: `prisma migrate status` clean; `prisma migrate diff --from-url <prod> --to-schema-datamodel prisma/schema.prisma --exit-code` must be empty (**manual, needs prod URL**).
5. Verify audit trigger still blocks UPDATE/DELETE on `AuditLog`.

## Open item MR-1 (gift card legacy rows) - NEEDS MANUAL PRODUCTION VERIFICATION
Migration 5 leaves legacy `PurchasedGiftCard` rows as `PENDING_PAYMENT` (hidden, not redeemable) unless already `isRedeemed`. This is deliberate and documented in the SQL: before this migration there was **no redemption path and no code**, so legacy cards could never have been redeemed anyway. No code-side fix is warranted; guessing "paid" from the DB would be wrong without Stripe evidence.
**Manual action (read-only, Neon SQL editor + Stripe dashboard):** `SELECT count(*) FROM "PurchasedGiftCard";`. If 0, nothing to do. If >0, reconcile each row's `stripePaymentIntentId` against Stripe; ops can then activate genuinely paid cards through the admin gift-card tools.

## Local rehearsal evidence
- Fresh DB `eki_fresh` (local disposable Postgres, port 54329): all migrations apply in order, `prisma migrate diff` reports no drift. Re-run results are recorded in `CODE_SIDE_BLOCKERS_CLOSED.md` after the final verification pass.
- This does **not** prove behaviour against production data volume or shape. That is a manual Neon-branch rehearsal.
