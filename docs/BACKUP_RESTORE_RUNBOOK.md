# Backup & Restore Runbook (Neon PostgreSQL)

**Status: BLOCKED - MANUAL ACTION REQUIRED.** No backup or restore evidence exists in the repositories and the Neon console is not accessible from the engineering session. Nothing below has been performed. Last tested date: **never recorded**. Owner: **TO BE ASSIGNED by Eki**.

## 1. Requirements before any production migration
- Neon plan with point-in-time restore (PITR) of at least 7 days (verify in Neon Console > Project > Settings > Storage / Restore window).
- A named **pre-deploy restore point**: create a Neon branch `pre-admin-overhaul-<date>` from the production branch (branches are copy-on-write and instant).
- A written owner and an escalation contact.

## 2. Confirm backup exists (owner, Neon console)
1. Console > project > Branches: note production branch id and current LSN/time.
2. Settings: confirm plan + "Restore window" value.
3. Record: plan, retention days, timestamp, who verified -> fill the table in section 6.

## 3. Pre-deploy snapshot (every schema-changing release)
1. Create branch `pre-<release>` from the production branch at "now".
2. Note the branch connection string in the secret vault (never in git/chat).
3. Proceed with the deploy only after the branch shows state "ready".

## 4. Restore procedure
A) **Non-destructive check (do this once before launch - the "restore drill")**
1. Create a branch from production at a timestamp ~1 hour ago.
2. Point a local backend (`DATABASE_URL=<branch>`, `NODE_ENV=development`) at it; run `npx prisma migrate status` (expect: database schema up to date or the known pending list).
3. Run read-only checks: row counts for `User`, `Vendor`, `Order`, `Payment`, `AuditLog`; open the admin panel against it.
4. Record RTO (time from start to usable) and result PASS/FAIL. Delete the drill branch.

B) **Real restore (incident)**
1. Stop writes: set the backend to maintenance by promoting the last good Vercel deployment AND (if needed) pausing crons.
2. In Neon: Restore production branch to the chosen timestamp/branch (PITR) - Neon keeps the pre-restore state as a backup branch.
3. Re-run `prisma migrate deploy` only if the restore point is older than the latest deployed migration.
4. Verify: health endpoint, admin login, one order, one Stripe webhook replay (idempotent), audit log row count.
5. Re-enable crons; announce.

## 5. Rollback strategy for this release
- Migrations are **forward-only and additive** (new columns have defaults). Application rollback = promote the previous Vercel deployment; old code runs on the new schema.
- Schema rollback is NOT supported; use the pre-deploy Neon branch (section 3) if data repair is required.
- The audit table is append-only (DB trigger); a restore to an earlier point loses audit rows after that point - note this in the incident record.

## 6. Verification record (to be completed by the owner)
| Field | Value |
|---|---|
| Neon plan | [FILL] |
| PITR window | [FILL days] |
| Pre-deploy branch created | [FILL timestamp / name] |
| Restore drill date | [FILL] |
| Drill result (PASS/FAIL) / RTO | [FILL] |
| Verified by | [FILL name] |
| Next scheduled drill | [FILL] |

## 7. Read-only SQL to confirm audit protection in production
```sql
SELECT tgname FROM pg_trigger WHERE tgrelid = '"AuditLog"'::regclass AND NOT tgisinternal;
-- expect: audit_log_immutable
SELECT migration_name, finished_at FROM "_prisma_migrations" ORDER BY started_at DESC LIMIT 12;
```

## Addendum 2026-10-05 - which steps need which console
- Neon console (MANUAL): create backup branch / confirm PITR window before migrating; restore rehearsal on a branch; verify row counts.
- Vercel dashboard (MANUAL): scope DATABASE_URL, confirm only Production builds migrate; keep prior deployment for instant rollback.
- Stripe dashboard (MANUAL): no backup concept; export webhook endpoint config and event delivery log before cutover.
- Code-side (done): migrations are additive/forward-only, so rollback = redeploy previous code; schema stays. 9 pending migrations are described in MIGRATION_PRODUCTION_REHEARSAL.md.
No backup or restore has been performed or evidenced by this work.
