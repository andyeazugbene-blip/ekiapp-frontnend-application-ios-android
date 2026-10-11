# Automation timing — why alerts feel delayed/inconsistent, and the fix

## Root cause

`vercel.json` defines exactly **one** cron job: the combined daily sweep, fixed at **12:00 UTC**:

```json
"crons": [{ "path": "/api/internal/jobs/daily-sweep", "schedule": "0 12 * * *" }]
```

Every time-windowed automation — low-stock alerts, the "get your first order" nudge, cart recovery, review requests, checkout/payment follow-ups, admin-scheduled broadcasts ("Schedule Later") — only gets evaluated once a day, at that one fixed clock time. A real-world trigger (stock crosses the low threshold, a vendor finishes onboarding, an admin schedules a broadcast for "in 20 minutes") sits unactioned for up to ~24 hours, and lands at a different local-time offset for every vendor depending on when in their day the 12:00 UTC sweep happens to fall. That is exactly what reads as "delayed and inconsistent" — it isn't random; it's a single fixed daily tick, which produces a *worse* experience than either "instant" or "predictably once-daily" because the apparent delay keeps shifting.

This was already anticipated in the code: a code comment on `handleDailySweep` (`src/modules/internal/internal.routes.ts`) explains that **Vercel's Hobby plan caps both the number of cron jobs and how often each may run (once/day)**, so the one combined cron exists specifically to keep the app working on that plan tier. Every individual job already has its own route for exactly this reason:

```
GET/POST /api/internal/jobs/automation-sweep           # cart recovery, low-stock, first-sale nudge, etc.
GET/POST /api/internal/jobs/run-scheduled-communications # admin "Schedule Later" broadcasts, push receipts
GET/POST /api/internal/jobs/renewals-sweep
GET/POST /api/internal/jobs/community-buy-sweep
... (see the `jobs` array in internal.routes.ts for the full list)
```

Each is authenticated identically to the combined endpoint — a bearer token, or `x-job-secret` header, matching `CRON_SECRET`.

## The fix — no app release, no code change required

Point an external scheduler at the two time-sensitive endpoints every **5–15 minutes**. Leave the heavier/non-urgent jobs (renewals, cleanup, reconciliation) on the existing once-daily combined sweep — don't call those more often than necessary.

**Option A — upgrade the Vercel project to a plan that allows frequent crons**, then add entries to `vercel.json`:
```json
{ "path": "/api/internal/jobs/automation-sweep", "schedule": "*/10 * * * *" },
{ "path": "/api/internal/jobs/run-scheduled-communications", "schedule": "*/5 * * * *" }
```
(Keep the existing daily combined entry for everything else.)

**Option B — any external pinger, no plan change** (cron-job.org, UptimeRobot, a GitHub Actions scheduled workflow, etc.), calling:
```bash
curl -X POST https://<backend-domain>/api/internal/jobs/automation-sweep \
  -H "Authorization: Bearer $CRON_SECRET"

curl -X POST https://<backend-domain>/api/internal/jobs/run-scheduled-communications \
  -H "Authorization: Bearer $CRON_SECRET"
```
every 5–15 minutes. `CRON_SECRET` is the same value already set in the backend's Vercel environment — never paste the real value into a third-party scheduler's UI in plain view of anyone who shouldn't have it; most of these services let you store it as a masked/secret header value.

## What this does NOT change

- Frequency caps (`frequencyCapDays` in `automation-rules.service.ts`) are unaffected — a vendor still gets the first-sale nudge at most once every 7 days, a low-stock alert at most once a day, etc. Running the sweep more often only shortens the *detection* latency, not the notification *frequency* a vendor receives.
- Quiet hours are unaffected.
- No business rule changes — this is purely about how often the existing, already-correct detection logic gets a chance to run.

## Status
Code-side: comment corrected (`src/modules/internal/internal.routes.ts`); no functional code change needed — the per-job endpoints already existed and are already safe to call independently and repeatedly (idempotent, per-day dedupe keys). **Manual action required:** pick Option A or B above and set it up. This doc exists so that action isn't lost.
