# Known Issues & Launch Risks (Handbook §14.13, §15, §18)

Severity vocabulary follows the handbook: **Blocker** (cannot accept), **Critical** (money/security/data loss), **Major** (feature wrong/incomplete), **Minor**.
(The earlier handover used Critical/High/Medium/Low; mapping: Critical->Blocker/Critical, High->Major, Medium->Major/Minor, Low->Minor.)

Status column is updated as each fix is verified. "Needs live proof" means code is in place but acceptance needs a real account/device.

| ID | Severity | Area | Issue | Owner | Status |
|---|---|---|---|---|---|
| K1 | Blocker | Android Google Sign-In | Native sign-in implemented in build 113; **not proven on a real device** | Eki/dev | Needs live proof |
| K2 | Blocker | iOS | Build 124 not produced (EAS free-tier quota); use Codemagic or upgrade | Eki | Open |
| K3 | Blocker | Continuity | GitHub/Vercel/EAS on personal accounts | Eki | Open (admin task) |
| K4 | Blocker | Recovery | No tested DB backup/restore | Eki | Open |
| K5 | Critical | Email | Email unusable until `RESEND_API_KEY` + verified sender set | Eki | Open |
| K6 | Critical | Live proof | End-to-end payment/refund/payout/KYC with real provider accounts not yet recorded | Eki/dev | Open |
| K7 | Major | Push | Receipts are checked by cron; delivery to iOS/Android devices not yet proven | Eki/dev | Needs live proof |
| K8 | Major | Referral / First Sale / state-aware vendor dashboard | Built and live in code (2026-11-06). Not yet proven on real devices or with a real referral | dev | Needs live proof |
| K9 | Major | Attribution | No assisted/incremental metrics (intentionally not invented) | dev | Backlog |
| K10 | Minor | Data | Test/QA records flagged via `isTest`; run `scripts/flag-test-data.ts` (dry-run first) against production | dev | Needs action |
| K11 | Critical | Scheduled jobs | The `CRON_SECRET` GitHub secret reaches `automation-scheduler.yml` empty, so 10-minute jobs never run. Only the daily sweep does, so reminders and deadlines can be up to a day late | Eki | Open: set the secret to the Vercel value |
| K12 | Blocker | Card holds | Two-stage payment has never run against real Stripe Connect, because the local test key's account has no Connect. The UK stays on pledge mode until it has | Eki/dev | Open: enable Connect on that account |
| K13 | Major | Deep links | A code can't survive an app store install without a provider and a native build. Partners' codes are typed at sign-up instead | Eki | Open: choose a provider |
| K14 | Major | Progress counting | In pledge mode, a pledge counts towards campaign progress before any payment. The client's copy says only verified contributions count, so that line isn't used | Andy | Open: true once the UK moves to holds, or rule on it |
| K15 | Major | Exact copy | Community Buy 112 of 314 sentences and Regular Delivery 170 of 247 match word for word. See `copy-differences.md` | dev/Andy | Partly done |
| K16 | Major | Legal | Terms and policies still say "Payment Protection" | Eki | Open: owner sign-off |
| K17 | Minor | Discovery | Product lists aren't ranked, and shipping compatibility isn't a ranking input. Vendor lists are ranked | dev | Backlog |
| K18 | Minor | App size | The QR code library added about 0.8 MB to the update bundle | dev | Accepted |
| K19 | Major | Database | One of seven production health checks on 2026-11-06 reported a connection pool timeout (limit 5, timeout 10s). The next six passed. Cause not established | dev | Open: check Vercel logs and the Neon pooled connection string |

See `docs/admin-handbook-gap-analysis.md` for the per-row acceptance status.
