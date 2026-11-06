# Known Issues & Launch Risks (Handbook §14.13, §15, §18)

Severity vocabulary follows the handbook: **Blocker** (cannot accept), **Critical** (money/security/data loss), **Major** (feature wrong/incomplete), **Minor**.
(The earlier handover used Critical/High/Medium/Low; mapping: Critical->Blocker/Critical, High->Major, Medium->Major/Minor, Low->Minor.)

Status column is updated as each fix is verified. "Needs live proof" means code is in place but acceptance needs a real account/device.

| ID | Severity | Area | Issue | Owner | Status |
|---|---|---|---|---|---|
| K1 | Blocker | Android | The owner tested on iPhone and reported everything working (2026-11-07). Android, including native Google sign-in, is **not yet proven on a real device** | Eki/dev | Needs live proof on Android |
| K2 | Blocker | iOS | Build 124 not produced (EAS free-tier quota); use Codemagic or upgrade | Eki | Open |
| K3 | Blocker | Continuity | GitHub/Vercel/EAS on personal accounts | Eki | Open (admin task) |
| K4 | Blocker | Recovery | No tested DB backup/restore | Eki | Open |
| K5 | Major | Email results | Resend sends email (owner, 2026-11-07). Delivered, opened and clicked aren't recorded until `RESEND_WEBHOOK_SECRET` is set in Vercel and the webhook endpoint is added in Resend. Until then `/api/resend/webhook` answers 503 | Eki | Open: set the secret |
| K6 | Critical | Live proof | End-to-end payment/refund/payout/KYC with real provider accounts not yet recorded | Eki/dev | Open |
| K7 | Major | Push | Receipts are checked by cron; delivery to iOS/Android devices not yet proven | Eki/dev | Needs live proof |
| K8 | Major | Referral / First Sale / state-aware vendor dashboard | Built and live in code (2026-11-06). Not yet proven on real devices or with a real referral | dev | Needs live proof |
| K9 | Major | Attribution | Assisted revenue, net, subscription recovery and qualified referrals are in Automation Centre → Results. Estimated incremental revenue appears once a comparison group is set in Settings → Launch decisions and each group has 30 buyers. Default is 0%, so it's off | Andy | Default shipped, admin decides |
| K10 | Minor | Data | Test/QA records flagged via `isTest`; run `scripts/flag-test-data.ts` (dry-run first) against production | dev | Needs action |
| K11 | Critical | Scheduled jobs | The `CRON_SECRET` GitHub secret was empty, so 10-minute jobs never ran. Set by the owner on 2026-11-06, and a triggered run succeeded | Eki | Fixed |
| K12 | Blocker | Card holds | Read-only production check on 2026-11-07: `stripe_connect` is ok, so connected accounts exist on the live key. Two-stage payment still hasn't run against real Connect, because that needs a real hold on a real card. The owner runs it with `live-card-test.md`. The UK stays on pledge mode until it has | Eki | Open: owner runs the live test |
| K13 | Major | Deep links | A code can't survive an app store install without a provider and a native build. Partners' codes are typed at sign-up instead | Eki | Open: choose a provider |
| K14 | Major | Progress counting | In pledge mode, a pledge counts towards campaign progress before any payment. The client's copy says only verified contributions count, so that line isn't used. The market's payment mode decides this: moving to verified card holds makes it true | Andy | Default shipped: Admin → Community Buy markets |
| K15 | Major | Exact copy | Community Buy 136 of 314 sentences and Regular Delivery 196 of 247 match word for word. See `copy-differences.md` | dev/Andy | Partly done |
| K16 | Major | Legal | Terms and policies still say "Payment Protection" | Eki | Open: owner sign-off |
| K17 | Minor | Discovery | Marketplace products are ranked on relevance, vendor rating, sales, delivery to the buyer's country and the new vendor boost. Signed-out buyers get no delivery input, because their country isn't known | dev | Done, awaiting review of real listings |
| K18 | Minor | App size | The QR code library added about 0.8 MB to the update bundle | dev | Accepted |
| K19 | Major | Database | One of seven production health checks on 2026-11-06 reported a connection pool timeout (limit 5, timeout 10s). The next six passed. Cause not established | dev | Open: check Vercel logs and the Neon pooled connection string |

See `docs/admin-handbook-gap-analysis.md` for the per-row acceptance status.
