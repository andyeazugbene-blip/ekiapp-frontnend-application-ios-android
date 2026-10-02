# Known Issues & Launch Risks (Handbook §14.13, §15, §18)

Severity vocabulary follows the handbook: **Blocker** (cannot accept), **Critical** (money/security/data loss), **Major** (feature wrong/incomplete), **Minor**.
(The earlier handover used Critical/High/Medium/Low; mapping: Critical->Blocker/Critical, High->Major, Medium->Major/Minor, Low->Minor.)

Status column is updated as each fix is verified. "Needs live proof" means code is in place but acceptance needs a real account/device.

| ID | Severity | Area | Issue | Owner | Status |
|---|---|---|---|---|---|
| K1 | Blocker | Android Google Sign-In | Native sign-in implemented in build 113; **not proven on a real device** | Eki/dev | Needs live proof |
| K2 | Blocker | iOS | Build 124 not produced (EAS free-tier quota); use Codemagic or upgrade | Eki | Open |
| K3 | Blocker | Continuity | GitHub/Vercel/EAS on personal accounts; admin-web not git-linked | Eki | Open (admin task) |
| K4 | Blocker | Recovery | No tested DB backup/restore | Eki | Open |
| K5 | Critical | Email | Email unusable until `RESEND_API_KEY` + verified sender set | Eki | Open |
| K6 | Critical | Live proof | End-to-end payment/refund/payout/KYC with real provider accounts not yet recorded | Eki/dev | Open |
| K7 | Major | Push | Receipts are checked by cron; delivery to iOS/Android devices not yet proven | Eki/dev | Needs live proof |
| K8 | Major | Referral / First Sale / state-aware vendor dashboard | Handbook §8.3/§8.6 programmes not built (see backend docs/automation-centre.md backlog) | dev | Backlog |
| K9 | Major | Attribution | No assisted/incremental metrics (intentionally not invented) | dev | Backlog |
| K10 | Minor | Data | Test/QA records flagged via `isTest`; run `scripts/flag-test-data.ts` (dry-run first) against production | dev | Needs action |

See `docs/admin-handbook-gap-analysis.md` for the per-row acceptance status.
