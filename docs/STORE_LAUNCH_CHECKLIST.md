# Eki Store Launch Checklist

Last updated: 2026-05-15

## Identity

| Field             | Value                                  |
| ----------------- | -------------------------------------- |
| App name          | Eki Marketplace                        |
| Short description | Buy and sell authentic African foodstuff with global delivery. |
| Tagline           | African foodstuff, delivered.          |
| Bundle ID (iOS)   | `com.ekiapp.mobile`                    |
| Package (Android) | `com.ekiapp.mobile`                    |
| Public domain     | https://waqti.pro                      |
| Privacy policy    | https://waqti.pro/privacy              |
| Terms of service  | https://waqti.pro/terms                |
| Support email     | support@waqti.pro                      |

## Full description (sample, ≤4000 chars)

Eki connects African vendors with buyers worldwide. Sellers manage their store, foodstuff inventory, delivery, and earnings in one place. Buyers shop authentic foodstuff with secure payment and protected delivery.

Vendor features
- Set up your store and add foodstuff in minutes
- Configure delivery for the UK, US, Canada, and Europe
- Accept and ship orders with tracking
- Receive payouts via bank, Stripe, or PayPal
- Run discounts, bundles, flash sales, and private offers
- Get verified to unlock buyer trust and higher selling limits

Buyer features
- Order from multiple vendors in one cart
- Pay securely with Stripe
- Track orders end-to-end
- Earn rewards and refer friends
- Chat with vendors directly inside the app

## Required assets

- App icon: `assets/icon.png` (1024×1024 PNG, no alpha for iOS)
- Adaptive icon (Android): `assets/adaptive-icon.png` (1024×1024 PNG, foreground)
- Splash screen: `assets/splash-icon.png` (centered)
- Web favicon: `assets/favicon.png`
- Feature graphic (Play Store): 1024×500 JPG/PNG (TODO)
- Screenshots (≥4 per platform):
  - Onboarding
  - Vendor dashboard
  - Foodstuff list / add product
  - Buyer home / product detail
  - Cart / Stripe checkout
  - Orders / tracking

## Permissions

| Permission                | Why                                                       |
| ------------------------- | --------------------------------------------------------- |
| INTERNET                  | API calls.                                                |
| CAMERA                    | Selfie verification, product photos.                      |
| READ_EXTERNAL_STORAGE     | Pick existing photos for product/verification uploads.    |
| POST_NOTIFICATIONS        | Order updates, payout notifications, verification status. |

iOS uses the standard photo library / camera privacy strings via Expo defaults.

## Data Safety (Play Store)

| Data type        | Collected | Shared | Purpose                          |
| ---------------- | --------- | ------ | -------------------------------- |
| Email address    | Yes       | No     | Account, login, transactional emails |
| Phone number     | Optional  | No     | OTP verification                  |
| Name             | Yes       | No     | Account, order delivery           |
| Address          | Buyer-only| No     | Order fulfillment                 |
| Photos           | Yes       | No     | Product photos, verification      |
| Government ID    | Vendor-only | No   | Identity verification (encrypted) |
| Purchase history | Yes       | No     | Order history, analytics          |
| Device IDs       | Yes       | No     | Push notification delivery        |
| Crash logs       | Yes       | No     | Sentry, redacted (no PII/secrets) |

Encryption in transit: yes (HTTPS).
Account deletion: contact support@waqti.pro (UI flow planned).

## Build profiles (eas.json)

- `development` — internal distribution, dev client, mock API enabled.
- `preview` — internal distribution, real API; APK on Android, IPA on iOS.
- `production` — public submission; AAB on Android, IPA on iOS; auto-increments build number.

Common commands

```bash
# Configure once
eas build:configure

# Internal preview
eas build -p android --profile preview
eas build -p ios --profile preview

# Production
eas build -p android --profile production
eas build -p ios --profile production

# Submit
eas submit -p android --profile production
eas submit -p ios --profile production
```

## Pre-launch sanity checks

- `npx tsc --noEmit` clean
- `npx expo-doctor` — flag-only warnings acceptable
- All vendor & buyer flows tested against the production API base URL
- Stripe publishable key set in `.env` and `eas.json` (production)
- Sentry DSN set (optional, but recommended)
- Privacy policy & terms accessible at the URLs in `app.json`
- Deep link `https://waqti.pro/store/<slug>` opens the public store on web; opens the app when installed
