# Environment guide (Handbook §17)

No secret values appear here. Set them in Vercel, EAS or a local `.env` file that stays out of git.

## Repositories

| Repository | Contains | Deploys through |
|---|---|---|
| `andyeazugbene-blip/ekiapp-backend` | API, public web pages, database schema | Vercel, on merge to `main` |
| `andyeazugbene-blip/ekiapp-frontnend-application-ios-android` | Mobile app, and the admin panel in `admin-web/` | EAS Update for the app; Vercel for admin |

## Local setup

You need Node, Docker Desktop and Git.

Start a throwaway database. Tests must never point at production.

```bash
docker run -d --name eki-verify-pg -e POSTGRES_PASSWORD=verify -e POSTGRES_DB=eki_verify -p 5544:5432 postgres:16-alpine
```

Then, in `ekiapp-backend-main`, with `DATABASE_URL` set to `postgresql://postgres:verify@localhost:5544/eki_verify?schema=public`:

```bash
npx prisma migrate deploy
```

```bash
ADMIN_EMAIL=seed_qa_admin@example.com ADMIN_PASSWORD=<choose-one> npx tsx prisma/seed.ts
```

```bash
npm run dev
```

`npm run dev` has no file watcher, so restart it after every change.

- Run the backend test suite with `DATABASE_URL` **unset**. Some permission tests fail falsely against a real database.
- For the app, don't set `CI=1` with Expo: it serves a stale bundle.
- Admin's `NEXT_PUBLIC_API_URL` must end in `/api`.

## Backend variables

| Group | Names |
|---|---|
| Core | `NODE_ENV`, `PORT`, `CORS_ORIGINS`, `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `FRONTEND_URL`, `CRON_SECRET`, `LOG_LEVEL` |
| Payments | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_IDENTITY_WEBHOOK_SECRET`, `DEFAULT_CURRENCY`, `PLATFORM_FEE_BPS` |
| Email and SMS | `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `EMAIL_FROM`, `OPS_ALERT_EMAIL`, `SMS_PROVIDER`, `SMS_API_KEY`, `AT_USERNAME`, `SMS_SENDER_ID` |
| Push | `EXPO_ACCESS_TOKEN` |
| Storage | `S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_PUBLIC_URL`, `UPLOAD_BASE_URL` |
| Sign-in | `GOOGLE_IOS_CLIENT_ID`, `GOOGLE_ANDROID_CLIENT_ID`, `GOOGLE_WEB_CLIENT_ID`, `APPLE_BUNDLE_ID`, `TURNSTILE_SECRET_KEY` |
| Community Buy switches | `COMMUNITY_BUY_INDIVIDUAL_DELIVERY_ENABLED`, `COMMUNITY_BUY_PAYOUT_CUSTODY_CONFIRMED`, `COMMUNITY_BUY_ORGANISER_PAYOUT_ENABLED`, `COMMUNITY_BUY_ORGANISER_FEE_SETTLEMENT_CONFIRMED` |
| Other | `SENTRY_DSN`, `REDIS_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `AUTOMATION_EVENTS_URL`, `AUTOMATION_WEBHOOK_SECRET` |

## App and admin variables

`EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_PUBLIC_WEB_URL`, `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY`, the `EXPO_PUBLIC_GOOGLE_*_CLIENT_ID` values, `EXPO_PUBLIC_SENTRY_DSN`, `EXPO_PUBLIC_TURNSTILE_SITE_KEY`, `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_STRIPE_LIVEMODE`.

## Settings an admin changes without a deploy

Admin → Settings → **Launch decisions**: UK launch mode, vendor trial, referrals per credit, First Sale switch and buyer cap, review targets, hold timing, unfinished card release, new vendor boost, demand threshold, automation-assisted window.

Admin → **Community Buy markets**: per-market switches, payment mode, fees, refund timeframe.

Admin → Settings → **Operational thresholds**: reminders, grace period, referral credit months.

## Test accounts

Demo accounts are made in Admin → Users → Create demo account. They are flagged `isTest`, can't reach real stores or money, and are left out of reports. A full-feature one starts with an open supplier account and an example of every status. To fill one made earlier, open it and choose Fill demo data. Never create accounts on production for testing any other way.
