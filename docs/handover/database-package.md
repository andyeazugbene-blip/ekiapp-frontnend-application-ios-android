# Database package (Handbook §17)

## What it is

PostgreSQL, hosted on Neon, accessed through Prisma. The schema is in `prisma/schema.prisma` in the backend repository: 136 models and 147 migrations as of 2026-11-06.

## Migrations

- Location: `prisma/migrations/`. Applied in name order.
- Production builds apply them automatically through `scripts/vercel-migrate.js`. Preview builds don't.
- See `deployment-runbook.md` for the additive rule and for how to reverse a change.

To check a migration set applies to an empty database:

```bash
npx prisma migrate deploy
```

Run that with `DATABASE_URL` pointing at a throwaway database, never production.

## Seed data

`prisma/seed.ts` creates reference data and the admin account named by `ADMIN_EMAIL` and `ADMIN_PASSWORD`. Use it on local and test databases.

## Backup and restore

**Not proven.** `docs/BACKUP_RESTORE_PROOF.md` in the backend repository has the steps and still says "EXTERNAL SETUP REQUIRED". Neon's retention depends on the plan, so the owner needs to:

1. Confirm the Neon plan and its recovery window.
2. Run a restore to a separate branch and confirm the data is there.
3. Record the date and result in that file.

Until then, treat recovery from data loss as unverified.

## Test data on production

Demo accounts carry `isTest` and are left out of reports. `scripts/flag-test-data.ts` is a dry run unless given `--apply`. Review its output before applying it.

## Retention

The recurring jobs `verification-proof-cleanup`, `privacy-expiry-sweep`, `support-retention-sweep` and `cart-cleanup` remove or anonymise old data. Closing an account keeps financial history and anonymises the person.
