# Admin roles, permissions, 2FA and audit (handbook sections 13 and 14.12)

Source of truth: `ekiapp-backend-main/src/modules/admin/admin-roles.service.ts` (`ADMIN_PERMISSIONS`, `DEFAULT_ROLES`).
Roles are seeded idempotently on every backend start (`bootstrapAdmin()` calls `seedDefaultRoles()`): a missing default role is created, an existing role is never modified, so customised roles are safe.

## Matching rules

A permission is granted when the role holds the exact string, `admin.*` (everything, Super Administrator only), or a `prefix.*` wildcard (for example `orders.*` grants `orders.read`). The backend (`permissionMatches`) and the admin panel (`usePermissions().has()`) use the same rules. An admin with no role assignment has no permissions (fail closed).

`GET /api/admin/me/permissions` returns `{ permissions, roles, isSuperAdmin, twoFactor: { enabled, enforced, setupRequired } }` for the signed-in admin.

## Permission catalogue

dashboard.read, analytics.read, users.read/mutate, vendors.read/mutate, orders.read/mutate, payments.mutate, payouts.read/mutate, products.read/mutate, reviews.read/mutate, verification.read/mutate, delivery_zones.read/mutate, disputes.read/mutate, escrow.read, communications.read/send, promos.read/mutate, campaigns.read/mutate, subscriptions.read/mutate, community_buy.read/mutate, settings.read/mutate, security.mutate, roles.read/mutate, audit.read, reports.read/mutate, approvals.read/decide, support.read/mutate, rewards.read/mutate, content.read/mutate, plus `admin.*`.

Known coarse permission: `community_buy.mutate` covers campaign review, supplier settlement and Community Buy refunds, so those three roles overlap by design until it is split.

## Role matrix (X = granted)

| Area | Super Admin | Operations Admin | Finance Admin | Read-Only Auditor | Customer Support | Vendor Ops | Verification Reviewer | Campaign Reviewer | Payment Ops | Refund Ops | Supplier Settlement | Risk / Fraud |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Dashboard / analytics read | X | X | X | X | | | | | | | | |
| Users read | X | X | X | X | X | | | | | | | X |
| Users mutate (suspend, trust score) | X | X | | | | | | | | | | X |
| Vendors read | X | X | X | X | | X | | | | | | X |
| Vendors mutate | X | X | | | | X | | | | | | X |
| Orders read | X | X | X | X | X | | | | X | X | | |
| Orders mutate | X | X | | | X | | | | | | | |
| Products read / mutate | X | X | | X (read) | | X | | | | | | |
| Reviews / reports | X | X | | X (read) | X (reviews read) | | | | | | | X |
| Verification | X | X | | X (read) | | | X | | | | | |
| Delivery zones | X | X | | X (read) | | X | | | | | | |
| Disputes | X | X | X | X (read) | | | | | | X | | X |
| Payments mutate (refunds) | X | | X | | | | | | X | X | | |
| Payouts read / mutate | X | | X | X (read) | | | | | X | | | |
| Escrow read | X | X | X | X | | | | | X | | | |
| Community Buy read | X | X | X | X | X | | | X | | X | X | |
| Community Buy mutate | X | | X | | | | | X | | X | X | |
| Communications send | X | X | | | X | | | | | | | |
| Promos / campaigns | X | X | X (promos read) | X (read) | | | | X (campaigns) | | | | |
| Subscriptions | X | X | X (read) | X (read) | X (read) | X | | | | | | |
| Approvals read / decide | X | X (read) | X | X (read) | | | | X | X | X | X | |
| Audit read | X | | X | X | | | | | | | | X |
| Settings read | X | | X | X | | | | | | | | |
| Settings mutate | X | | | | | | | | | | | |
| Roles / admin accounts | X | | | X (read) | | | | | | | | |
| Support inbox | X | X | | X (read) | X | | | | | | | |
| Rewards, content | X | X | | X (read) | | | | | | | | X (content) |

Operations Admin and Finance Admin were added in this work. Operations Admin cannot move money, change settings, manage roles or read the audit log. Finance Admin cannot administer users or vendors, send communications, or change settings or roles.
The exact lists per role are in `DEFAULT_ROLES`; this table summarises them. Operators can clone and edit roles under Settings, Roles and permissions (every change needs a reason and a 2FA code and is audited fail-closed).

## Mandatory 2FA

- Env switch `ADMIN_2FA_ENFORCE`: `true` or `1` enforces, `false` or `0` does not. Unset means enforced only when `NODE_ENV=production`. It is read per request, so a restart is the only action needed.
- When enforced, an admin without enabled 2FA gets `403 TWO_FACTOR_SETUP_REQUIRED` on every `require2fa` route. The admin panel then redirects to `/security/setup` (QR code, manual key, code verification, one-time backup codes). The enrolment endpoints (`/admin/2fa/setup|verify|disable|backup-codes/regenerate`) need no role permission, only an admin session, so a newly invited admin can always enrol.
- Bootstrap and lock-out safety: the first admin is created from `ADMIN_EMAIL` and `ADMIN_PASSWORD`, signs in and enrols at first sign-in. To recover from a lock-out, set `ADMIN_2FA_ENFORCE=false`, restart, fix the account, then re-enable.
- 2FA-gated routes now include: refunds, payout approve/reject/mark-paid, broadcasts, community-campaign approve/request-changes/reject/pause/resume/issue-notes (plus the existing cancel and payout actions), product disable, role create/update/delete/assign/unassign, approval rules, operational thresholds, platform flags, escrow provider settings, admin invite/deactivate/reactivate/role change, audit export, and the existing suspend/delete flows.
- In the admin panel the second factor is collected by one global prompt (`ProtectedRoute` + `apiClient.setTwoFactorPrompter`): any request refused with `2FA_REQUIRED` asks for a code and retries once, so individual pages need no extra handling.

## Admin accounts

- `POST /api/admin/admins/invite` (roles.mutate + 2FA + reason): creates an ADMIN with no password, assigns the role, emails a one-time set-password link (72 hours, existing `PasswordResetToken` mechanism, link `ADMIN_WEB_URL/set-password?token=...`; set `ADMIN_WEB_URL` in production, it falls back to `FRONTEND_URL`). Only a Super Administrator can invite into a role holding `admin.*`.
- `POST /admins/:id/deactivate|reactivate`, `PUT /admins/:id/role`: audited with reason. Guards: no self-deactivation or self role change, and the last active Super Administrator cannot be deactivated or demoted. Deactivation suspends the user and bumps `tokenVersion`, which signs them out everywhere.
- "Last recorded action" in the Team tab is the latest audit entry by that admin (or `User.lastActiveAt` if a flow sets it). There is no session or device table.

## Sessions

- Idle sign-out: 30 minutes without interaction in the admin panel (shared across tabs via localStorage) with a one-minute warning. This is a browser-side control only.
- "Sign out all other sessions" (`POST /admin/me/sessions/revoke-others`, reason required, audited) bumps `tokenVersion` and returns a fresh token for the current browser. Limits: tokens are stateless, so there is no per-device list and no single-device revoke.

## Audit

- `recordAudit({ request, reason, beforeState, afterState, failClosed })`. `failClosed: true` rethrows a failed audit write as `500 AUDIT_WRITE_FAILED`, so the mutation is reported as failed rather than silently unaudited. Used for roles, admin accounts, settings, flags, escrow provider, delivery zones, promo codes, reviews and reports, audit export and session revocation.
- `requireAuditReason(raw)` validates a reason server-side (5 to 1000 characters, `400 REASON_REQUIRED`). Required on: promo create/update, escrow provider update, delivery zone create/update/delete/fix-currencies, review moderation, report review, trust score, seller plan upsert/delete/assign, platform settings and flags, role create/update/delete/assign/unassign, admin invite/deactivate/reactivate/role change, session revocation. DELETE endpoints take the reason as `?reason=`.
- Not changed: 2FA enrol/disable/regenerate events keep best-effort audit (the 2FA state is already changed when the audit is written, so failing closed would report a false failure).
- `AuditLog` is append-only at the database level (trigger from migration `audit_log_immutable`). Setting history in the admin panel reads from it.
- `GET /api/admin/audit-logs` filters: `actor` (name or email), `actorId`, `action` (contains), `entityType`, `entityId`, `from`, `to` (dates, UTC), `q` (reason contains), cursor pagination. `GET /audit-logs/export` returns up to 5,000 rows as CSV (audit.read + 2FA, formula-injection safe, and the export is itself audited).

## Privacy helper

`ekiapp-backend-main/src/shared/utils/mask.ts` exports `maskEmail` and `maskPhone`. Convention for list views: return masked values by default and provide a reveal endpoint that requires a reason and writes an audit entry (`pii.reveal`) before returning the full value. Not yet applied to the users list (owned by another module).

## Integrations status

`GET /api/admin/integrations/status` (settings.read) reports, from environment presence only, whether Stripe (key mode, webhook secrets), Resend, Expo push, Paystack, S3 storage, Redis, Sentry and the ops alert email are configured, plus build and system info. It never returns values and does not test live connectivity.
