# Deployment runbook (Handbook §17)

Backend always goes first. An app update can rely on a new API, but the API must keep working for the app already on phones.

## Before anything ships

1. Branch from `origin/main`. Commit subjects are lower case (commitlint).
2. Backend, with `DATABASE_URL` unset: `npx vitest run`, `npx tsc --noEmit`, `npm run check:scaffolding`, `npm run test:coverage-map`.
3. App and admin: `npx tsc --noEmit` in the root and in `admin-web`.
4. Run the journey for what changed against the throwaway database. Mocked tests have hidden real bugs here more than once, so anything touching money runs against Stripe test mode.

## Migrations

Vercel runs `prisma migrate deploy` during the build, so a migration reaches production when its PR merges.

- Migrations must be additive: new tables, new nullable or defaulted columns, new enum values.
- Never remove or rename something the running app reads in the same release.
- Test it with `npx prisma migrate deploy` against the throwaway database first.

## Backend

1. Open a PR. Wait for CI and the Vercel preview to pass.
2. Merge. Wait for the merge commit's status to succeed.
3. Smoke test, read-only: `GET /api/health` returns 200, and a route you changed answers as expected.

## App

The runtime version is 1.5.8. JavaScript changes ship over the air. A native change needs a new store build.

1. Merge the PR, after the backend is live.
2. From a clean `main`, export:

```bash
npx expo export --platform ios --platform android --output-dir <folder>
```

3. Run the preflight check on `<folder>`. Don't publish if it fails.
4. Publish:

```bash
npx eas-cli update --channel production --environment production --skip-bundler --input-dir <folder> --message "<what changed>" --non-interactive --json
```

If this fails with `git --help exited with status 3221225794`, that's a Windows process start failure, not a problem with the bundle. Confirm `git --help` works, then publish again.

Don't edit the working tree between export and publish.

## Admin panel

Admin deploys from `main` through Vercel. Check the page you changed after the deploy finishes.

## Rollback

| What | How |
|---|---|
| App | Republish the previous update group: `eas-cli update:republish --group <id>` (see Update history) |
| Backend | Promote the previous deployment in Vercel. This doesn't undo a migration, which is why they must be additive |
| Setting | Change it back in admin. Every change is in its history |
| Migration | Write a new forward migration. Don't edit one that has run |

## Approvals

- Anything that switches on real money behaviour, such as moving a market to card holds, needs the owner's explicit decision. It isn't part of a deploy.
- Never run tests against production.
