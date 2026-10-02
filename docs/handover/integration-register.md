# Integration & Account Register (Handbook §16–18, App. B)

Purpose: one place that says **what each external service is for, where its credentials live, and who must own it**.
Rule (handbook L105–107): every account below must end up under an **Eki-controlled** owner, with credentials in an approved
secret store (never in code, chat, or loose files), role-based, revocable access and 2FA.

"Owner today" is what the repository shows. "Eki owner" is filled in by the client at handover - **nothing here is assumed**.

| Service | Used for | Where configured (no secrets here) | Owner today | Eki owner / 2FA / recovery contact |
|---|---|---|---|---|
| GitHub | Source (backend + app + admin-web) | repo remotes | personal account `andyeazugbene-blip` | TO CONFIRM - transfer to Eki org |
| Vercel (backend) | API hosting, daily cron | project `ekiapp-backend` | team `andyekiapp-s-projects` | TO CONFIRM |
| Vercel (admin-web) | Admin panel | project `admin-web`; **not git-linked** - deploy with `cd admin-web && npx vercel --prod` | same team | TO CONFIRM + git-link |
| PostgreSQL (Neon implied) | Primary database | `DATABASE_URL` | not verifiable from repo | TO CONFIRM; backup + restore drill required (docs/DISASTER_RECOVERY_DRILL.md) |
| Stripe | Card payments, Connect payouts, Identity (KYC), subscriptions | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | not verifiable | TO CONFIRM; record account id + Connect model (Express/Standard) |
| Paystack | NG/GH payments | `PAYSTACK_SECRET_KEY` | not verifiable | TO CONFIRM |
| Resend | Email | `RESEND_API_KEY`; sender domain must be verified | not verifiable | TO CONFIRM - **email is not live until key + domain are set** |
| Expo Push Service -> APNs / FCM | Push notifications (see docs/communications-providers.md in backend repo) | Expo project id, `google-services.json`, APNs key | Expo account `chialimouad-2-2` | TO CONFIRM - move EAS project to Eki account |
| Africa's Talking | SMS | `SMS_API_KEY` | - | **Out of scope (client decision: no SMS)** |
| Sentry | Error monitoring | `SENTRY_DSN` | not verifiable | TO CONFIRM; alert owner |
| S3-compatible storage | Uploads | `S3_*` env | not verifiable (R2?) | TO CONFIRM |
| Cloudflare Turnstile | Web CAPTCHA | env | - | TO CONFIRM |
| Apple Developer / App Store Connect | iOS builds (Codemagic -> TestFlight) | `codemagic.yaml` | not verifiable | TO CONFIRM team + signing ownership |
| Google Play Console | Android releases | `eas.json`, upload keystore | not verifiable | TO CONFIRM; Play service-account key needed for `eas submit` |
| Firebase | Android FCM credentials | `google-services.json` | project `comekiappmobile` | TO CONFIRM |
| Google OAuth | Sign-in | Web client id in app config | - | TO CONFIRM |

## Credential hygiene findings (action required)
- Loose credential files exist in the working folder outside the repos (service-account JSONs, `.p8` keys, OAuth client secrets, a text file of credentials, an APK). They must be **rotated, moved into a vault, and deleted from the folder**. They are not inside the repos and are git-ignored there, but they are not safe where they are.
- `credentials.json` (Android keystore passwords) is untracked in the app repo; keep the keystore + passwords in the vault and back up the upload key.
