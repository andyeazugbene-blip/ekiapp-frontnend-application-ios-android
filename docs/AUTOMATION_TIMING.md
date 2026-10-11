# Automation timing — root cause, the fix, and its current status

## Root cause

`vercel.json` defines exactly **one** Vercel-native cron job: the combined daily sweep, fixed at **12:00 UTC**. Every time-windowed automation — low-stock alerts, onboarding nudges, cart recovery, review requests, checkout/payment follow-ups, admin-scheduled broadcasts ("Schedule Later") — only got evaluated once a day, at that one fixed clock time. A real-world trigger could sit unactioned for up to ~24 hours and land at a different local-time offset for every vendor, which read as "delayed and inconsistent."

A code comment on `handleDailySweep` (`src/modules/internal/internal.routes.ts`) explains why: **Vercel's Hobby plan caps both the number of cron jobs and how often each may run (once/day)**, so the one combined cron exists specifically to keep the app working on that plan tier. Every individual job already had its own authenticated route for exactly this reason (`GET/POST /api/internal/jobs/<name>`, bearer or `x-job-secret` auth matching `CRON_SECRET`).

## The fix — IMPLEMENTED (2026-10-11), not just documented

`.github/workflows/automation-scheduler.yml` is a real, committed GitHub Actions scheduled workflow that calls:
- `POST /api/internal/jobs/automation-sweep` (cart recovery, low-stock alerts, onboarding nudges, win-back, referrals, reorder/checkout reminders)
- `POST /api/internal/jobs/run-scheduled-communications` (admin "Schedule Later" broadcasts, push receipt refresh)

every **10 minutes**, using `Authorization: Bearer ${{ secrets.CRON_SECRET }}`, with each curl call checked for a non-2xx status (`::error::` + non-zero exit on failure, so a broken call shows up as a failed Actions run, not a silent no-op). Heavier/non-urgent jobs (renewals, reconciliation, cleanup) stay on the existing once-daily combined sweep — they are not called more often than necessary.

**GitHub Actions' own documented limits, stated honestly, not hidden:** the shortest schedule interval it allows is 5 minutes, and scheduled runs are explicitly "best effort" — GitHub does not guarantee the exact minute, and delays are more likely during periods of high load on GitHub's infrastructure. This is a large, real improvement over one fixed daily tick; it is not a claim of real-time delivery.

### REQUIRED MANUAL ACTION — not yet done, the workflow is non-functional without it

The workflow authenticates with a GitHub Actions **repository secret** named `CRON_SECRET`, which does not exist yet and cannot be set by code — it must be copied from the backend's existing Vercel environment variable by someone with access to both:

1. Open the backend's Vercel project → Settings → Environment Variables → copy the value of `CRON_SECRET` (production).
2. GitHub repo (`ekiapp-backend`) → Settings → Secrets and variables → Actions → New repository secret → name `CRON_SECRET`, paste the same value.
3. (Optional) If the production backend URL is ever not `https://ekiapp-backend.vercel.app`, also add a repository **variable** (not secret) named `BACKEND_BASE_URL`.

Until step 2 is done, every run of this workflow fails at the curl step with a 401 — visible in the repo's Actions tab, and GitHub emails the repo's watchers on a scheduled-workflow failure by default. **That failure is the verification signal** that the secret still needs to be added; this doc does not claim the scheduler is live until that 401 stops appearing and a 200 response with real job output shows up in a run's logs.

## Other timing/consistency fixes shipped in the same change (2026-10-11)

- **Overlapping-run protection**: every job (whether triggered by the daily sweep, the new 10-minute workflow, or a manual call) is now wrapped in a real Postgres session advisory lock (`pg_try_advisory_lock`/`pg_advisory_unlock`, one key per job name) — a second concurrent call to the same job skips instead of racing it. Verified against a real local Postgres instance (not just unit-mocked): two concurrent calls to the same job name correctly serialize (second is skipped), the lock releases properly after the first completes, and two different job names never block each other.
- **Local-time quiet hours**: the default 22:00–07:00 quiet window is now computed in the recipient's own approximate country UTC offset (`shared/currency.ts`'s `localQuietHoursToUtc`), not one shared UTC window for every market. An admin-set per-rule override still always wins unchanged. DST is not modeled (documented approximation).
- **No stacked non-urgent notifications**: within one sweep run, a recipient eligible for more than one non-urgent automation (the exact "low stock + first order" screenshot) now only gets the highest-priority one; the rest are suppressed as `coalesced_same_run` and re-evaluated on the next sweep. Transactional types (payment recovery, checkout follow-up, renewal/price-approval reminders) always bypass this.
- **Low-stock alerts are now state-based**, not a daily repeat: the dedupe key is derived from the exact set of currently-low products (hashed) plus a 3-day cooldown bucket. A genuinely new low-stock item always alerts immediately; an unchanged situation reminds at most every 3 days instead of daily.
- **Onboarding nudges now depend on the vendor's actual next incomplete step** (add a product → set up delivery → verify → get your first order), reading the same columns the vendor app's own activation checklist uses, instead of a fixed "get your first order" message regardless of setup state.
- **First-order reminders already stopped correctly** once a vendor has any PAID order — confirmed unchanged, not a new fix.
- **Every decision is now loggable with a reason**: every `AutomationRun` row already carried `status` (`SENT`/`FAILED`/`SUPPRESSED`) and `suppressedReason`; the new suppression reasons added are `coalesced_same_run` (this change) alongside the existing `quiet_hours`, `frequency_capped`, `no_marketing_consent`, `vendor_disabled_automation`, `duplicate_key`, `rule_paused`, `emergency_pause`.
- **Retries still cannot duplicate a send** — unchanged: a retry creates a new `<root>:retry:<n>` dedupe key and refuses if an earlier retry already succeeded or is in flight.

## What this does NOT change

- Frequency caps (`frequencyCapDays`) are unaffected except for `LOW_STOCK_ALERT`, which deliberately moved from a blunt daily cap to the state-based hash+cooldown scheme above.
- No business rule changes — this is about how often and how carefully the existing detection logic runs, and about not showing a vendor two things at once.

## Status
Code-side: **done and tested** (backend: 181 test files / 2928 tests pass, tsc clean; admin-web: tsc/lint/build clean). The GitHub Actions scheduler file is **committed**, but **not yet verified running in production** — it needs the `CRON_SECRET` repository secret added (above) and then needs to be watched for at least one real 200-status run in the Actions tab before it can be called production-verified. See `docs/CODE_SIDE_BLOCKERS_CLOSED.md` / the latest status report for the exact implemented / deployed / production-verified breakdown.
