# Eki Store Launch Checklist

Last updated: 2026-05-31

## Launch verdict

Status today: `not ready for store submission`

Why:
- The app-side production config is pointed at the new public domain and new backend API.
- The mobile app still needs a real production backend deployment check, real self-serve account deletion, and live payment credentials before App Store / Play Store submission.

## Identity

| Field | Value |
| --- | --- |
| App name | Eki |
| Product category | Marketplace for physical foodstuff |
| Bundle ID (iOS) | `com.ekiapp.mobilee` |
| Package (Android) | `com.ekiapp.mobile` |
| Public domain | `https://culinarytales.app` |
| WWW domain | `https://www.culinarytales.app` |
| Backend API | `https://ekiapp-backend.vercel.app` |
| Privacy policy | `https://culinarytales.app/privacy` |
| Terms of service | `https://culinarytales.app/terms` |
| Help page | `https://culinarytales.app/help` |
| Support email | `adminandy@eki.app` |

## Current frontend config

Verified in this repo:
- [app.json](/C:/Users/PC%20SOFT/Desktop/frontend%20italian/app.json) points to `culinarytales.app` and `ekiapp-backend.vercel.app`
- [eas.json](/C:/Users/PC%20SOFT/Desktop/frontend%20italian/eas.json) uses the new public URLs and new backend API URL
- [.env](/C:/Users/PC%20SOFT/Desktop/frontend%20italian/.env) uses the new public URLs, new backend API URL, and new Turnstile site key
- [.env.example](/C:/Users/PC%20SOFT/Desktop/frontend%20italian/.env.example) documents the new public config
- [utils/shareLinks.ts](/C:/Users/PC%20SOFT/Desktop/frontend%20italian/utils/shareLinks.ts) builds public links from `culinarytales.app`
- [services/api/config.ts](/C:/Users/PC%20SOFT/Desktop/frontend%20italian/services/api/config.ts) defaults to `https://ekiapp-backend.vercel.app`

Expo ownership cleanup:
- Old Expo `owner` was removed from [app.json](/C:/Users/PC%20SOFT/Desktop/frontend%20italian/app.json)
- Old Expo `projectId` was removed from [app.json](/C:/Users/PC%20SOFT/Desktop/frontend%20italian/app.json)

## Store review requirements

### Apple

Ready:
- Physical goods marketplace flow can use direct card payments outside IAP
- Privacy policy and terms URLs are defined in app config
- Camera and photo-library permission copy is present in app config

Blocked:
- Account deletion is not yet self-serve inside the product flow
- Current deletion entry is a request path, not a full in-app delete flow backed by API

### Google Play

Ready:
- Data collection categories are known
- Notification permission and media permissions are declared

Blocked:
- A working public account deletion path is still required in addition to the in-app path

## Live credentials status

Public client-side values currently wired in the app:
- `EXPO_PUBLIC_API_URL=https://ekiapp-backend.vercel.app`
- `EXPO_PUBLIC_API_BASE_URL=https://ekiapp-backend.vercel.app`
- `EXPO_PUBLIC_APP_WEBSITE=https://culinarytales.app`
- `EXPO_PUBLIC_PUBLIC_WEB_URL=https://culinarytales.app`
- `EXPO_PUBLIC_PUBLIC_WEB_URL_WWW=https://www.culinarytales.app`
- `EXPO_PUBLIC_STORE_BASE_URL=https://culinarytales.app/store`
- `EXPO_PUBLIC_VERCEL_FALLBACK_URL=https://ekiapp-backend.vercel.app`
- `EXPO_PUBLIC_TURNSTILE_SITE_KEY` is set
- `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` is set

Server-side credentials:
- Must live only in the backend deployment environment
- Must not be committed to this repo
- Must be verified on the new backend deployment before release

Important:
- The Stripe keys currently provided are `test` keys, not `live` keys
- Production checkout is not release-ready until live Stripe credentials replace the test pair

## Backend launch gate

Required before submission:
1. Backend deploy at `https://ekiapp-backend.vercel.app` returns healthy responses
2. Public site at `https://culinarytales.app` loads without `FUNCTION_INVOCATION_FAILED`
3. Database migrations are applied to the production database actually used by the deployed backend
4. Uploads work against Cloudflare R2
5. OTP and transactional email flows work with Resend
6. Turnstile is enforced correctly in production
7. Stripe webhook is reachable and verified in production

Suggested production env checklist for the backend:
- `DATABASE_URL`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `JWT_SECRET`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `RESEND_API_KEY`
- `EMAIL_FROM`
- `SMS_PROVIDER`
- `SMS_API_KEY`
- `AT_USERNAME`
- `S3_BUCKET`
- `S3_REGION`
- `S3_ENDPOINT`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`
- `S3_PUBLIC_URL`
- `TURNSTILE_SECRET_KEY`
- `PUBLIC_STORE_BASE_URL=https://culinarytales.app`
- `PLATFORM_FEE_BPS`

## App flow gate

The following must be verified on device builds, not Expo Go:
- Buyer signup, login, OTP verification
- Vendor signup, onboarding, store setup
- Product create/edit with image upload
- Vendor verification uploads
- Buyer cart and checkout
- Buyer wallet top-up
- Vendor order acceptance and shipment updates
- Buyer order tracking
- Buyer/vendor messaging with image attachments
- Push notifications for orders and messages
- Deep links for `/store`, `/product`, `/order`, `/chat`, `/invite`

Note:
- Native Stripe PaymentSheet is not testable in Expo Go
- Use EAS development/preview builds for payment validation

## Assets checklist

Ready:
- `assets/icon.png`
- `assets/adaptive-icon.png`
- `assets/splash-icon.png`
- `assets/favicon.png`

Still needed for store listing:
- Final App Store screenshots
- Final Play Store screenshots
- Android feature graphic
- Final release description copy
- Final privacy answers / Play Data Safety form answers

## Build commands

```bash
eas build -p android --profile preview
eas build -p ios --profile preview
eas build -p android --profile production
eas build -p ios --profile production
```

Submission commands after all blockers are cleared:

```bash
eas submit -p android --profile production
eas submit -p ios --profile production
```

## Repo checks

Checks that have already passed during launch prep:
- `npm run check:no-mock-data`
- `npm run check:billing-compliance`
- `npm run check:no-old-domain`
- `npx expo export --platform web`
- `npx expo-doctor`

Current note:
- `npm run typecheck` is not clean in the current workspace because of `admin-web/` TypeScript issues unrelated to the mobile app config pass

## Final release gate

Do not submit to App Store / Play Store until all of these are true:
- backend health is green on the new deployment
- public site is loading on the new domain
- Stripe uses live keys
- account deletion is truly self-serve in app and backed by API
- EAS ownership is linked to the client account
- App Store Connect and Play Console ownership are on the client side
- preview build smoke test passes on real iPhone and Android devices
