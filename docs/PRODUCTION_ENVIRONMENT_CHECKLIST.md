# Production Environment Checklist (variable NAMES only - no values)

Status column = what `vercel env ls production` showed on 5 Oct 2026 (names only; values are encrypted and were not read). "Unknown" = exists but validity cannot be checked from here.

## Backend (project `ekiapp-backend`)
| Variable | Required? | Purpose / where used | Current status | Manual action |
|---|---|---|---|---|
| DATABASE_URL | Yes | Prisma (`prisma/schema.prisma`) | Set for **Production AND Preview (same value)** | Create a separate Neon branch/DB for Preview and set a Preview-only value. Until then preview builds skip migrations (code fix) but previews still use the prod DB at runtime |
| JWT_SECRET | Yes | `config/env.ts` | Set (Preview+Prod per list) | Prod and Preview should differ |
| STRIPE_SECRET_KEY | Yes | `lib/stripe.ts`, admin Stripe links mode | Set (Prod+Preview) - Preview should use a TEST key | Use `sk_test_` for Preview |
| STRIPE_WEBHOOK_SECRET | Yes | `stripe.service.handleWebhook` | Set | - |
| STRIPE_IDENTITY_WEBHOOK_SECRET | Yes | identity events | Set | - |
| NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY | web only | public store | Set | - |
| CRON_SECRET | Yes | `/api/internal/jobs/*` auth | Set | Rotate if ever shared |
| RESEND_API_KEY / EMAIL_FROM | Yes for email | `lib/email.ts` (unconfigured => email reported NOT sent) | Set, validity unknown | Send a real test email; verify sender domain |
| PUBLIC_API_URL | Yes (new) | unsubscribe links in marketing email | **Not set** | Set to `https://<api host>/api` |
| ADMIN_WEB_URL | Yes (new) | admin invite / set-password links | **Not set** (falls back to public site) | Set to the admin panel URL |
| ADMIN_2FA_ENFORCE | Decide | mandatory admin 2FA | **Not set => ON in production** | Enrol the owner admin first, or set `false` for the first deploy |
| CORS_ORIGINS | Yes | `app.ts` allow-list | Production has **`CORS_ORIGIN`** (different name) - code reads `CORS_ORIGINS` | Confirm the admin panel origin is allowed; rename var if needed |
| ADMIN_EMAIL / ADMIN_PASSWORD | bootstrap only | `admin-bootstrap.ts` | Set | Remove ADMIN_PASSWORD after first login if policy allows |
| S3_* (BUCKET, REGION, ENDPOINT, ACCESS_KEY_ID, SECRET_ACCESS_KEY, PUBLIC_URL) | Yes | uploads | Set (some Preview-only per list) | Verify Production has all six |
| TURNSTILE_SECRET_KEY | Yes (signup) | CAPTCHA | Set | - |
| COMMUNITY_BUY_* confirmation flags (4) | Yes (gates) | payout custody / organiser payout / delivery | Set | Owner confirms values are intentional |
| GOOGLE_*_CLIENT_ID, APPLE_BUNDLE_ID | Yes | OAuth sign-in | Set | - |
| EXPO_ACCESS_TOKEN | Optional | Expo push (higher rate limits / enhanced security) | Not set | Optional |
| SENTRY_DSN | Recommended | error monitoring | Not set | Set + name an alert owner |
| SELLER_PAYMENT_READINESS_GATE | Optional | purchase gate | Not set => OFF | Turn on only after vendor Stripe flags verified |
| SUPPORT_RETENTION_DAYS / SUPPORT_RETENTION_ENABLED | Optional | support retention sweep (dry-run by default) | Not set | Leave unset until a retention policy is approved |
| GIFT_CARD_VALIDITY_MONTHS | Optional | gift card expiry (default 12) | Not set | - |
| PLATFORM_FEE_BPS | Legacy | commission fallback | Set (Preview listed) | Confirm 0 or remove once seller plans are zeroed |
| SMS_API_KEY / AT_USERNAME / AFRICASTALKING_* | **Out of scope** | SMS | Present | Do not rely on SMS; may be removed |
| NODE_ENV, VERCEL_ENV | Platform | production behaviour, migration gate | Platform-provided | - |

## Admin panel (project `admin-web`, NOT git-linked)
| NEXT_PUBLIC_API_URL | Yes | all API calls (baked in at build time) | Set for Production | Must be the production API (`.../api`) at `vercel --prod` time |
|---|---|---|---|---|
| NEXT_PUBLIC_STRIPE_LIVEMODE | No | no longer used (backend now returns the mode) | n/a | - |

## Manual Vercel actions (exact)
1. Backend project > Settings > Environment Variables: edit `DATABASE_URL` so it applies to **Production only**; add a separate `DATABASE_URL` for **Preview** pointing at a Neon branch ("preview"). Same for `STRIPE_SECRET_KEY` (Preview = test key).
2. Add `PUBLIC_API_URL`, `ADMIN_WEB_URL` (Production). Decide `ADMIN_2FA_ENFORCE`.
3. Settings > Git: confirm Production Branch = `main`. Do not push feature branches until step 1 is done.
4. Stripe Dashboard > Developers > Webhooks: ensure the endpoint (`/api/stripe/webhook`) lists the events in `docs/handover/webhook-register.md`, including connected-account events for `account.updated` / `account.application.deauthorized`.
