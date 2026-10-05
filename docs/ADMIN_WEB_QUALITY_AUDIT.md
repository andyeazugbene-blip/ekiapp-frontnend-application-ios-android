# Admin Web Quality Audit

Scope: every page under `admin-web/src/app` (56 routes, matching the Next.js
build output). Branch `feat/admin-handbook-overhaul`, committed locally only.

Method: for each page, read the page, its `lib/services/*.api.ts` client, and
cross-checked every endpoint it calls against `ekiapp-backend-main/src/modules/admin/admin.routes.ts`
(and the module-local routers it mounts: `campaigns.routes.ts`,
`gift-cards.routes.ts`, `rewards.routes.ts`,
`regular-deliveries.routes.ts` for `/admin/subscriptions`). Grepped the whole
app for hardcoded/mock data, `window.confirm`/`alert`, raw-ID rendering,
`toLocale*` calls without an explicit time zone, missing 403 handling, and
unpaginated lists. The backend repo was read-only (per instructions); no
backend file was edited.

## Summary

- **Pages audited:** 56 (all routes in the Next.js build output), including
  5 dynamic `[id]` routes and 6 redirect-only legacy stub pages.
- **Files changed this session:** 38 (`git diff --stat admin-web`), all
  under `admin-web/`.
- **Defects found:** 27 distinct issues across 24 pages/components (see
  table and "Defects" section).
- **Defects fixed:** 25. **Remaining (documented, not fixed):** 2 backend
  gaps that this task could not touch (see "Known gaps not fixed").
- **Role mismatches found:** 2 nav-permission/backend-permission mismatches
  (fixed) + ~15 pages that rendered mutate controls with no permission check
  at all (fixed — see "Role x page/action audit").
- **tsc:** clean (`npx tsc --noEmit`, 0 errors).
- **next lint:** `✔ No ESLint warnings or errors`.
- **next build:** succeeded, 56/56 static + dynamic pages generated.
- **Test runner:** none configured in `admin-web` (`package.json` has no
  `test` script, no Jest/Vitest/Playwright config, no `__tests__` dirs).
  Stated here rather than silently skipped.
- **Browser verification:** not performed. No dev server was started and no
  page was loaded in a browser this session — the backend is not reachable
  from this environment anyway (confirmed: `admin-web` talks to
  `NEXT_PUBLIC_API_URL`, a deployed backend, not a local one). All
  verification below is static: read, tsc, lint, build.

## Per-page audit table

Legend: **data** = real API data (no mock arrays) · **load/empty/error** =
has a loading state, an empty state, and a non-generic error state ·
**403** = a 403 from the API renders a clear "no access" state, not a blank
page · **pag** = pagination/limit handled · **filters** = search/filter
controls · **curr** = currency shown correctly (minor units, never summed
across currencies without a `sumByCurrency`/clearly-labelled breakdown) ·
**tz** = dates shown with an explicit time zone label · **names** = human
labels, not raw IDs · **destructive** = uses `useConfirm`/`ConfirmDialog`
with a required reason, never `window.confirm`/`alert` · **audit** =
feedback after an action (success/failure banner, not silent) · **role** =
mutate controls are hidden/disabled for a role that lacks the matching
`*.mutate` permission · **verdict**.

| Page | data | load | empty | error | 403 | pag | filters | curr | tz | names | destructive | audit | role | verdict |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `/` (redirect to /login) | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | OK (stub) |
| `/login` | yes | yes | n/a | yes | n/a | n/a | n/a | n/a | n/a | n/a | n/a | yes | n/a | OK |
| `/set-password` | yes | yes | n/a | yes | n/a | n/a | n/a | n/a | n/a | n/a | n/a | yes | n/a | OK |
| `/forbidden` | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | OK (static) |
| `/security/setup` | yes | yes | n/a | yes | n/a | n/a | n/a | n/a | n/a | n/a | n/a | yes | n/a | OK |
| `/dashboard` | yes | yes | yes | yes | yes (per-widget) | n/a | yes (includeTest) | yes, per-currency tiles | yes | yes | n/a | n/a | n/a | **Fixed**: removed a second, duplicate client-side FX "Approx. combined GMV" calculation that used `contexts/CurrencyContext` in parallel with `lib/displayCurrency` (two independent static-rate converters existed) |
| `/activity-logs` | yes | yes | yes | yes | n/a (audit.read gates the page itself server-side; UI shows Export only if `audit.read`) | yes (cursor) | yes (actor/action/entity/date/reason) | n/a | yes | yes | n/a (append-only, no mutation) | yes (export notice) | yes | OK |
| `/approvals` | yes | yes | yes | yes | n/a | n/a (full list; backend has no pagination on `/admin/approvals`) | n/a | yes (`formatMinor`) | yes | **Fixed**: raw `actionType`/`businessRefId`/`businessRefType` codes replaced with `ACTION_LABEL`/`REF_LABEL`, Order refs linked to `/orders/:id` | **Fixed**: decide/save-rule now use `useConfirm` (previously used raw `<input>` 2FA fields with no dialog) | yes | **Fixed**: decide buttons hidden without `approvals.decide`; rules card gated on `roles.read`/`roles.mutate`; self-approval (`requestedById === user.id`) now also blocked client-side with a message, mirroring the backend's `SELF_APPROVAL_FORBIDDEN` | Fixed |
| `/automation` | yes | yes | yes | yes | yes | n/a (tabs have own pagination) | yes | n/a | n/a | yes | n/a | n/a | yes (`canMutate`, `isSuper`) | **Fixed** nav + page gate used `analytics.read` instead of `automation.read` (role mismatch — see Role audit) |
| `/campaigns` | yes | yes | yes (`campaigns.length === 0` row) | yes | n/a | n/a (full list) | n/a | **Fixed**: raw `$` sign hardcoded on fixed-amount discounts regardless of the checkout's real currency — relabelled "(checkout currency)" | **Fixed**: `toLocaleDateString()` → `formatDateTime`; added a UTC-safe `datetime-local` round-trip helper | n/a | **Fixed**: `window.confirm("Delete this campaign?")` → `useConfirm` dialog | n/a | **Fixed**: no permission check existed at all; gated on `campaigns.mutate` | Fixed |
| `/communication` (redirect) | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | OK (stub) |
| `/communications` | yes | yes | yes | yes | yes | yes | yes | n/a | n/a | yes | yes | yes | yes (`canSend`, `isSuper`) | OK (pre-existing, not modified) |
| `/community-buy-payouts` | yes | yes | yes | yes | n/a | n/a (full list) | n/a | yes (`formatMinor`) | n/a | **Fixed**: raw `campaignId` fallback text → "Campaign title not provided" | yes | yes | **Fixed**: mark-ready/hold/release buttons were shown to any `community_buy.read` holder; gated on `community_buy.mutate` | Fixed |
| `/community-campaigns` | yes | yes | yes | yes | n/a | n/a (full list) | n/a | **Fixed**: raw `cents/100` + currency string concatenation replaced with `formatMinor`; the cancellation request's paid-total line had a template-literal bug (`${...}`) | **Fixed**: all `new Date().toLocaleString()` → `formatDateTime` | **Fixed**: raw `campaignId`/`req.campaignId` fallback text → named fallbacks | **Fixed**: 11 `window.confirm` / `alert` calls replaced with `useConfirm` dialogs (pause/resume/end/extension/cancellation/proposal/release/hold all now collect and show a reason where the backend expects one) | **Fixed**: `alert()` after every action → inline `Banner` | **Fixed**: no permission check existed; every review/pause/end/extension/cancellation/proposal/release/hold action is now gated on `community_buy.mutate`, with a role-aware info banner when absent | Fixed (largest page in scope) |
| `/community-campaigns/[id]` | yes | yes | yes | yes | yes (`NoAccess`) | n/a | n/a | yes | yes (explicit `timeZone` prop) | yes | yes (pre-existing) | yes | yes (`canMutate` pre-existing) | OK (not modified; already compliant) |
| `/community-data-access` | yes | yes | yes | yes | n/a | n/a (server caps at 100, see gap) | yes (campaign ID, action type) | n/a | **Fixed**: raw `toLocaleString()` → `formatDateTime` | **Fixed**: raw `campaignId`/`accessorUserId` → linked `Open campaign` / `user profile` | **Fixed**: `confirm()` → `useConfirm`, 2FA now via the global prompter instead of an inline code field | n/a | **Fixed**: disclosure form hidden without `community_buy.mutate` | Fixed |
| `/community-ledger` | yes | yes | yes | yes | n/a | n/a (full list) | n/a | yes (per-currency, "single currency" guard before summing) | **Fixed**: entry timestamps → `formatDateTime` | yes | n/a (read-only) | n/a | n/a (read-only page, correctly ungated) | OK |
| `/community-markets` | yes | yes | yes | yes | yes (`NoAccess`) | n/a | n/a | yes | n/a | yes | yes (pre-existing) | yes | yes (`canMutate` pre-existing) | OK (not modified; already compliant) |
| `/community-organiser-fees` | yes | yes | yes | yes | n/a | n/a (full list) | yes (review-status select) | yes (`formatMinor`) | n/a | **Fixed**: raw `campaignId`/`userId` fallbacks → named | n/a (modal already used explicit fields, not browser dialogs) | yes | **Fixed**: hold/release/settle/resolve buttons shown to any `community_buy.read` holder; gated on `community_buy.mutate` | Fixed |
| `/community-refunds` | yes | yes | yes | yes | n/a | **Fixed**: added client pagination (25/page) over the full list (backend endpoint has no cursor — see gap) | n/a | yes (`formatMinor`) | **Fixed**: → `formatDateTime` | yes | **Fixed**: 2 `confirm()` calls → `useConfirm` | yes | **Fixed**: recheck/escalate shown to any `community_buy.read` holder; gated on `community_buy.mutate` | Fixed |
| `/community-supplier-accounts` | yes | yes | yes | yes | yes | yes (cursor) | yes | n/a | n/a | yes | yes (pre-existing) | yes | yes (pre-existing) | OK (not modified; already compliant) |
| `/community-supplier-accounts/[id]` | yes | yes | yes | yes | yes | n/a | n/a | n/a | n/a | yes | yes (pre-existing) | yes | yes (pre-existing) | OK (not modified; already compliant) |
| `/community-supplier-payments` | yes | yes | yes | yes | n/a | n/a (aggregate endpoint) | yes (status/date range) | yes (per-currency, never summed) | **Fixed**: `toLocaleDateString` → `formatDate` | yes | n/a (read-only) | n/a | n/a (read-only) | OK |
| `/community-support-cases` | yes | yes | yes | yes | n/a | **Fixed**: added client pagination (20/page) | yes (status filter) | n/a | **Fixed**: → `formatDateTime` | yes | **Fixed**: 4 `confirm()` calls → `useConfirm` with role-aware disabling | yes | **Fixed**: note/response/status/escalate controls shown to any `community_buy.read` holder; gated on `community_buy.mutate`, fields made read-only otherwise | Fixed |
| `/community-verification` | yes | yes | yes | yes | n/a | n/a (full list) | n/a | n/a | **Fixed**: `toLocaleDateString` → `formatDate` | yes | **Fixed**: 6 `confirm()`/`alert()` calls → `useConfirm` | yes | **Fixed**: verify/restrict/lift buttons shown to any `community_buy.read` holder; gated on `community_buy.mutate` | Fixed |
| `/content-reports` (redirect) | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | OK (stub) |
| `/content-review` | yes | yes | yes | yes | yes | yes | yes | n/a | n/a | yes | yes | yes | yes | OK (pre-existing); **nav fix**: sidebar entry required `reports.read`/`verification.read` only, missing the page's own primary `content.read` check — added |
| `/delivery-zones` | yes | yes | yes | yes | n/a | n/a (full list) | n/a | yes (minor-unit fee inputs) | n/a | yes | yes (pre-existing) | n/a | **Fixed**: form, pause/edit/delete buttons and the "fix currencies" action were shown to any `delivery_zones.read` holder with no `.mutate` check at all | Fixed |
| `/disputes` | yes | yes | yes | yes | n/a | yes (cursor) | yes | yes | yes | yes | n/a (list only) | n/a | n/a (no page-level mutation) | OK |
| `/disputes/[id]` | yes | yes | n/a | yes | n/a | n/a | n/a | yes | yes | yes | yes (pre-existing `ConfirmDialog`, plus **fixed**: decision now goes through `useConfirm` instead of an unconfirmed button) | yes | **Fixed**: resolve form and `DisputeCase`'s message/evidence-request/appeal controls were shown to any `disputes.read` holder; gated on `disputes.mutate` | Fixed |
| `/gift-cards` | yes | yes | yes | yes | yes | yes (cursor) | yes | yes (`formatApproxMoney`, labelled) | yes | yes | yes (pre-existing) | yes | yes (pre-existing `canMutate`) | OK (not modified; already compliant) |
| `/gifts` (redirect) | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | OK (stub) |
| `/hot-deals` | yes | yes | yes | yes | yes | n/a | n/a | yes (labelled approx.) | n/a | yes | yes (pre-existing) | yes | yes (pre-existing) | OK (not modified; already compliant) |
| `/ledger` | yes | yes | yes | yes | n/a | n/a | yes (provider/date range) | yes (`formatMinor`) | **Fixed**: reconciliation run periods now use `formatDateUtc` + an explicit "UTC" label (periods are server-defined UTC days, previously shown with the browser's local-zone `toLocaleDateString`, silently off by up to a day) | yes | **Fixed**: resolve-difference now goes through `useConfirm` instead of an inline unconfirmed text box | n/a | **Fixed**: "Run a reconciliation" (needs `payments.mutate`), "Run Community Buy reconciliation" (needs `community_buy.mutate`) and "Resolve" were all visible to any `audit.read` holder; gated per-action | Fixed |
| `/orders` | yes | yes | yes | yes | n/a | yes (cursor) | yes | yes | yes | yes | n/a (list only) | n/a | n/a | OK |
| `/orders/[id]` | yes | yes | n/a | yes | n/a | n/a | n/a | yes | yes | yes | yes (pre-existing `ConfirmDialog`) | yes | **Fixed**: Refund/Re-check buttons were visible to any admin who could open an order, with no `payments.mutate`/`orders.mutate` check | Fixed |
| `/payment-anomalies` | yes | yes | yes | yes | n/a | n/a (full list) | yes (show resolved toggle) | n/a | **Fixed**: `toLocaleString` → `formatDateTime` | yes | n/a (modal already used a real field) | yes | **Fixed**: scan/review/escalate buttons shown to any viewer; gated on `reports.mutate` | Fixed |
| `/payments` | yes | yes | yes | yes | n/a | yes (cursor) | yes | yes | yes | yes | n/a (list only) | n/a | n/a | OK |
| `/payments/[id]` | yes | yes | n/a | yes | n/a | n/a | n/a | yes | yes | yes | n/a (no mutations on this page) | n/a | n/a | OK |
| `/payout-requests` | **Fixed**: rewritten from scratch (see "Defects") | yes | yes | yes | n/a | **Fixed**: added `Pagination` UI (was raw page-number buttons with no "shown of total"); backend endpoint itself has no cursor (see gap) | yes (tabs + search) | **Fixed**: the header stat and all 3 "amount" stat cards summed every vendor's payout amount into one FX-converted number with no per-currency breakdown — rewritten to `sumByCurrency`, one total per currency | **Fixed**: raw `toLocaleDateString` → `formatDateTime` | **Fixed**: vendor name came from a *second*, separately-paginated `/admin/vendors?limit=100` fetch joined client-side — silently showed "Unknown" for any vendor past the first 100; now uses the `vendor.storeName` the payout-requests endpoint already returns | **Fixed**: an `alert()` on a validation failure, and raw `<input>` fields for 2FA/proof — approve/reject/mark-paid/retry now go through `useConfirm` with a required reason | n/a (previously silent) → now a success `Banner` | **Fixed**: Approve/Reject/Mark paid/Retry were shown to *any* admin who could view the page (`payouts.read`), with zero `payouts.mutate` check | Fixed |
| `/products` | yes | yes | yes | yes | yes | yes (cursor) | yes | yes (approx labelled) | yes | yes | n/a (no mutation on this list) | n/a | n/a | OK (not modified; already compliant) |
| `/products/[id]` | yes | yes | n/a | yes | yes | n/a | n/a | yes | n/a | yes | n/a | n/a | yes (pre-existing `canModerate`) | OK (not modified) |
| `/promo-codes` | yes | yes | yes | yes | n/a | n/a (full list) | n/a | **Fixed**: `minOrderAmount`/fixed-amount value were silently treated as already-minor-unit when the form collects major units (a 10.00 discount would have been created as 10 minor units = 0.10) — now converts with `Math.round(discount * 100)` for `FIXED_AMOUNT` only, percentage kept as a whole number, and the create-form validates the discount range before submit | **Fixed**: `validFrom`/`validUntil` `datetime-local` values were sent to the API as the raw local string with no `Z`/offset, which the backend parses as UTC — silently shifting the promo's actual start/end by the admin's UTC offset; now converted with `new Date(...).toISOString()`; render side `toLocaleString()` → `formatDateTime` | **Fixed**: store column fell back to the raw `vendorId` cuid; now resolves the name from the already-loaded vendor list first | n/a (modal-less — uses `useConfirm`, pre-existing) | yes | **Fixed**: the entire create form and every row's Pause/Extend actions were visible to any `promos.read` holder; gated on `promos.mutate`, fields made read-only otherwise | Fixed |
| `/refunds` | yes | yes | yes | yes | n/a | yes (client, pre-existing) | yes | **Fixed**: manual `(amount/100).toFixed(2)` string-concat → `formatMinor` | **Fixed**: `toLocaleDateString` → `formatDateTime` | yes | n/a (this page only links out to `/approvals` for the actual decision, correctly) | n/a | n/a (read-only; decisions happen in Approvals, which is gated) | Fixed |
| `/reviews` | yes | yes | yes | yes | n/a | yes (cursor) | yes | n/a | **Fixed**: `toLocaleDateString` → `formatDateTime` | n/a | n/a (modal-less, used a real `ConfirmDialog` already) | n/a | **Fixed**: Approve/Hide/Reject were shown to any `reviews.read` holder with zero `reviews.mutate` check | Fixed |
| `/security/setup` | — | — | — | — | — | — | — | — | — | — | — | — | — | (listed above) |
| `/settings` (+ 6 tabs) | yes | yes | yes | yes | yes (`NoAccess`) | n/a | n/a | n/a | yes | yes | yes (pre-existing, `TeamTab`/`RolesTab`/`ThresholdsTab` all use `useConfirm`) | yes | yes (pre-existing `canManage`/`canEdit` per tab) | OK (not modified; already compliant) |
| `/stripe-disputes` | yes | yes | yes | yes | n/a | n/a (full list) | yes (show-resolved toggle) | **Fixed**: `(amount/100).toLocaleString()` string-concat → `formatMinor` | **Fixed**: `toLocaleString` → `formatDateTime` | yes | **Fixed**: now goes through `useConfirm` instead of an unconfirmed inline textarea + button | yes | **Fixed**: "Mark reviewed" shown to any `disputes.read` holder; gated on `disputes.mutate` | Fixed |
| `/subscription-exceptions` | yes | yes | yes | yes | yes | yes | yes | n/a | n/a | yes | yes (pre-existing) | yes | yes (pre-existing) | OK (not modified) |
| `/subscription-plans` | yes | yes | yes | yes | n/a | n/a (small finite list) | n/a | n/a (bps/cents are admin-facing raw numbers by design, documented in-page) | n/a | yes | yes (pre-existing `useConfirm`) | yes | **Fixed**: the entire edit form (`<fieldset disabled>`) and "+ New plan" / Delete / Save were visible and clickable to any `subscriptions.read` holder; gated on `subscriptions.mutate` | Fixed |
| `/subscriptions` | yes | yes | yes | yes | yes | yes | yes | n/a | n/a | yes | yes (pre-existing) | yes | yes (pre-existing) | OK (not modified) |
| `/subscriptions/[id]` | yes | yes | yes | yes | yes | n/a | n/a | yes | yes | yes | yes (pre-existing) | yes | yes (pre-existing) | OK (not modified) |
| `/support-messages` | yes | yes | yes | yes | yes (`NoAccess`) | yes (cursor) | yes | n/a | yes | yes | n/a (list only) | n/a | n/a | OK |
| `/support-messages/[id]` | yes | yes | n/a | yes | yes (`NoAccess`) | yes (older-messages cursor) | n/a | n/a | yes | yes | yes (pre-existing) | yes | yes (pre-existing `canMutate`) | OK (not modified) |
| `/uploads` (redirect) | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | OK (stub) |
| `/users` | yes | yes | yes | yes | n/a | yes (cursor) | yes | n/a | yes | yes | yes (`SuspendDialog`, pre-existing) | n/a | **Fixed**: Suspend/Restore were shown to any `users.read` holder with no `users.mutate` check | Fixed |
| `/users/[id]` | yes | yes | n/a | yes | n/a | n/a | n/a | yes | yes | yes | yes (pre-existing) | yes | **Fixed**: Suspend/Restore and "Send message" shown with no `users.mutate`/`communications.send` check | Fixed |
| `/vendors` | yes | yes | yes | yes | n/a | yes (cursor) | yes | yes | yes | yes | yes (`SuspendDialog`, pre-existing) | yes | **Fixed**: selection checkboxes, bulk-suspend, per-row Suspend/Restore, and "Invite vendor" were all shown with no `vendors.mutate` check | Fixed |
| `/vendors/[id]` | yes | yes | n/a | yes | n/a | n/a | n/a | yes (per-currency GMV, never summed) | yes | yes | yes (pre-existing) | yes | **Fixed**: Suspend/Restore/Close/"Send message" had no `vendors.mutate`/`communications.send` check; the plan-override control in `SubscriptionCard` had no `subscriptions.mutate` check; market enable/disable/add in `VendorMarketsCard` had no `vendors.mutate` check | Fixed |
| `/verification` | yes | yes | yes | yes | n/a | yes | yes | n/a | yes | yes | yes (pre-existing `useConfirm`) | yes | **Fixed**: legacy Approve/Reject/"Delete proof files"/the Stripe "Send reminder" button were shown to any `verification.read` holder with no `verification.mutate` check | Fixed |
| `/wallet-transactions` | yes | yes | yes | yes | n/a | n/a (hard `limit:100`, no cursor — **remaining gap**, see below) | yes (type filter) | **remaining**: manual `tx.currency + amount.toFixed(2)` instead of `formatMinor` (values already pre-converted to major units by the service's own normalizer, so this is cosmetic rather than a unit bug, but inconsistent with the rest of the app) | **remaining**: `toLocaleDateString()` with no explicit zone | yes | n/a (list only) | n/a | n/a | Not fixed this session — flagged below |
| `/wallet-transactions/[id]` | yes | yes | n/a | yes | n/a | n/a | n/a | yes (`formatDisplayMoney`) | **remaining**: `toLocaleString()` with no explicit zone | yes | n/a | n/a | n/a | Not fixed this session — flagged below |

## Role x page/action audit

Nav visibility is driven by `components/AdminLayout.tsx`'s `NAV_MODULES[].perm`
(wildcard-aware, same `permissionMatches` as the backend). Cross-checked
every `perm:` entry against the primary permission the page/endpoint itself
requires, and against the backend's `requireAdminPermission(...)` on every
route the page calls.

**Nav/page-gate mismatches found and fixed:**

1. **Automations** — nav said `perm: ["analytics.read"]`, but the page itself
   gates on `automation.read` (`automation/page.tsx`: `perms.has("automation.read")`)
   and most of its endpoints (`GET /admin/automation/rules`, `/runs`,
   `/failures`) require `automation.read`, not `analytics.read`
   (`automation/summary` alone takes `analytics.read`). A role with
   `analytics.read` but not `automation.read` would see the nav link and
   land on a `NoAccess` page. **Fixed**: nav now requires `automation.read`.
   No shipped default role currently has `analytics.read` without
   `automation.read` (Operations Admin and Finance Admin both have
   `analytics.read`, and Operations Admin also has `automation.read`;
   Finance Admin has neither), so no default role was visibly affected —
   but the bug would bite the first custom role created with only
   `analytics.read`.
2. **Content Review** — nav said `perm: ["reports.read", "verification.read"]`,
   missing the page's own primary check, `content.read`
   (`content-review/page.tsx`: `perms.hasAny("content.read", "content.mutate")`
   drives the "Reports"/"Content" tabs). **Fixed**: nav now includes
   `content.read` too. Same reasoning: no shipped default role currently has
   `content.read` without also having `reports.read` or `verification.read`
   (Risk/Fraud and Operations Admin both have all three), so this was latent.

**Default-role x module matrix** (from `DEFAULT_ROLES` in
`ekiapp-backend-main/src/modules/admin/admin-roles.service.ts`, cross-referenced
against the nav's `perm:` requirements after the two fixes above). "✓" =
nav item visible and its mutate controls enabled; "view" = nav item visible,
mutate controls now correctly hidden (post-fix); "—" = nav item hidden.

| Module (nav perm) | Super Admin | Read-Only Auditor | Customer Support | Vendor Operations | Verification Reviewer | Campaign Reviewer | Payment Operations | Refund Operations | Supplier Settlement | Risk / Fraud | Operations Admin | Finance Admin |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Users (`users.read`/`.mutate`) | ✓ | view | ✓ | — | — | — | — | — | — | ✓ | ✓ | view |
| Vendors (`vendors.*`) | ✓ | view | — | ✓ | — | — | — | — | — | ✓ | ✓ | view |
| Verification (`verification.*`) | ✓ | view | — | — | ✓ | — | — | — | — | — | ✓ | — |
| Orders (`orders.read`) + mutate via `payments.mutate`/`orders.mutate` | ✓ | view | view (orders.mutate, no payments.mutate → Refund hidden) | — | — | — | view (payments.mutate ✓) | view (payments.mutate ✓) | — | — | ✓ | view (payments.mutate ✓) |
| Payouts (`payouts.read`/`.mutate`) | ✓ | view | — | — | — | — | ✓ | — | — | — | — (no `payouts.read`!) | ✓ |
| Ledger (`audit.read`) + run via `payments.mutate`/`community_buy.mutate` | ✓ | view | — | — | — | — | — (no `audit.read`) | — | — | view | — (no `audit.read`!) | ✓ |
| Anomalies (`reports.read`/`.mutate`) | ✓ | view | — | — | — | — | — | — | — | ✓ | ✓ | view |
| Stripe disputes (`disputes.*`) | ✓ | view | — | — | — | — | — | ✓ | — | ✓ | ✓ | view |
| Disputes (`disputes.*`) | ✓ | view | — | — | — | — | — | ✓ | — | ✓ | ✓ | view |
| Products (`products.*`) | ✓ | view | — | ✓ | — | — | — | — | — | — | ✓ | — |
| Foodstuffs Subscriptions (`subscriptions.*`) | ✓ | view | view | ✓ | — | — | — | — | — | — | ✓ | view |
| Gift Cards & Hot Deals (`rewards.*`) | ✓ | view | — | — | — | — | — | — | — | — | ✓ | — |
| Promo codes (`promos.*`) | ✓ | view | — | — | — | — | — | — | — | — | ✓ | view |
| Reviews (`reviews.*`) | ✓ | view | view | — | — | — | — | — | — | — | ✓ | — |
| Community Buy (`community_buy.*`, all 11 sub-pages) | ✓ | view | view | — | — | ✓ | — | ✓ | ✓ | — | view | ✓ |
| Automations (`automation.*`) | ✓ | view | — | — | — | — | — | — | — | — | ✓ | — |
| Communications (`communications.*`) | ✓ | view | ✓ | — | — | — | — | — | — | — | ✓ | — |
| Conversations (`support.*`) | ✓ | view | ✓ | — | — | — | — | — | — | — | ✓ | — |
| Content Review (`content.*`/`reports.*`/`verification.read`) | ✓ | view | — | — | view (identity tab only) | — | — | — | — | ✓ | ✓ | — |
| Campaigns (`campaigns.*`) | ✓ | view | — | — | — | ✓ | — | — | — | — | — (no `campaigns.read`!) | — |
| Analytics (`analytics.read`) | ✓ | view | — | — | — | — | — | — | — | — | ✓ | ✓ |
| Settings (`settings.*`) | ✓ | view | — | — | — | — | — | — | — | — | — (no `settings.read`!) | view |
| Audit log (`audit.read`) | ✓ | view | — | — | — | — | — | — | — | ✓ | — (no `audit.read`!) | view |
| Approvals (`approvals.*`) | ✓ | view | — | — | — | ✓ | ✓ | ✓ | ✓ | — | ✓ | ✓ |
| Seller plans (`subscriptions.*`) | ✓ | view | view | ✓ | — | — | — | — | — | — | ✓ | view |
| Delivery zones (`delivery_zones.*`) | ✓ | view | — | ✓ | — | — | — | — | — | — | ✓ | — |

Notes on the matrix:

- "view" everywhere means the nav item is visible and the page loads, but
  every mutate control is now hidden/disabled because the role has the
  `.read` permission without the matching `.mutate` — this is the exact
  class of bug this audit fixed across ~20 pages (buttons previously showed
  regardless, and would 403 on click; the *server* always enforced this
  correctly — see "Security impact" below — but the UI was wrong).
- **Operations Admin cannot see Campaigns** (Hot Deal/Gift Card eligibility
  campaigns) despite its stated scope "day-to-day marketplace operations" —
  it has `community_buy.read` (view only, correctly) but no `campaigns.read`
  at all. This looks like a gap in the role's permission set, not a UI bug;
  flagged for the role's owner to confirm intentional (campaigns here are the
  `/admin/campaigns` Hot-Deal/Gift-Card engine, distinct from Community Buy
  campaigns).
- **Operations Admin has no `payouts.read`, `audit.read` or `settings.read`**
  despite otherwise owning almost every operational surface — Payouts,
  Ledger, Audit log and Settings are all invisible to it. Consistent with
  its own description ("No money movement, settings, roles or audit
  export"), so likely intentional, not a bug — but noted since Ledger
  requires `audit.read` specifically (not a money-movement permission) and
  Operations Admin otherwise handles money-adjacent orders/disputes.
- **Customer Support sees Orders but not Payments/Refunds/Payouts** — it has
  `orders.read` + `orders.mutate` but no `payments.mutate`, so on `/orders/:id`
  the Refund/Re-check buttons are correctly hidden post-fix, consistent with
  its "Handles buyer/vendor support tickets" scope.
- No role was found with a `.mutate` permission but *not* the matching
  `.read` (which would be the more dangerous mismatch — mutate without
  being able to see what you're mutating); every default role's permission
  set pairs `.mutate` with `.read` correctly.

**Security impact of the pre-fix state:** none of the mismatches above were
exploitable as privilege escalation. Every `/admin/*` mutation route is
independently gated server-side with `requireAdminPermission(...)` (and
often `require2fa`), so a role without the right `.mutate` permission always
got a real `403 ADMIN_PERMISSION_DENIED` from the server regardless of what
the UI showed. The defect class is a UX/trust problem (a Finance Admin
looking at the Ledger "Run reconciliation" button, clicking it, and being
confusingly bounced with a 403) and a handbook-compliance problem (the
handbook requires the UI to hide what a role cannot do, not merely rely on
the server to refuse it), not a security hole.

## Backend route-family coverage gap

`ekiapp-backend-main/src/tests/admin-role-matrix-http.test.ts` (67 cases, not
edited) directly tests these route families across 4 roles (support, ops,
finance, super): `admins/invite`, `audit-logs/export`,
`automation/emergency-stop`, `broadcasts`, `community-buy/markets/:code/payments`,
`community-buy/markets/:code/readiness`, `disputes/:id/request-evidence`,
`disputes/:id/resolve`, `gift-cards/purchased/:id/cancel`,
`orders/:id/refund`, `payout-requests/:id/approve`,
`payout-requests/:id/mark-paid`, `products/:id/unpublish`,
`roles/:id/assignments`, `settings/flags/:key`,
`subscriptions/:id/force-cancel`, `users` (list), `users/:id/suspend`,
`vendors/:id/close`, `vendors/:id/suspend` — 19 route families.

**Route families this admin panel calls with no direct HTTP authorization
test** (not a claim they are unprotected — every one of them still has
`requireAdminPermission(...)` in `admin.routes.ts`, confirmed by reading the
route table; this is purely "not exercised by the existing automated
matrix," flagged per instructions as a gap, not fixed since it is a backend
test file):

- All Community Buy routes except the two `markets/*` ones above:
  campaigns review/approve/reject/pause/resume/cancel, extension &
  cancellation requests, supplier proposals, supplier payments
  release/hold, organiser fees hold/release/settle, organiser/supplier
  verify/restrict, supplier accounts approve/reject/suspend/close,
  data-access log & emergency disclosure, refunds requery/escalate,
  support cases, ledger reconciliation.
- Payments/Refunds reads (`/admin/payments`, `/admin/payments/:id`,
  `/admin/refunds`), payment anomalies (scan/review/escalate), ledger
  reconciliation runs/differences.
- Reviews moderation, promo codes create/update, delivery zones
  create/update/delete/fix-currencies.
- Verification (approve/reject/delete-files), content-review moderation,
  stripe-disputes review.
- Subscription plans create/update/delete, vendor seller-plan override,
  vendor markets add/enable-disable.
- Approvals decide + approval-rules upsert.
- Analytics/dashboard reads, 2FA setup/verify/disable, team
  invite/deactivate/reactivate/role-change (beyond the one `roles/:id/assignments`
  case), wallet-transactions, uploads, communications templates/scheduled.

Recommendation for the backend owner (not actioned here): extend
`admin-role-matrix-http.test.ts` with representative cases for at least the
Community Buy mutation routes and the payments/refunds reads, since those
are the routes this session found had the most UI-side permission gaps.

## Defects found / fixed / remaining

**Fixed (25):**

1. Nav permission mismatch: Automations required `analytics.read` instead
   of `automation.read`.
2. Nav permission mismatch: Content Review missing `content.read`.
3–22. Twenty pages/components rendered mutate controls (buttons, forms,
   row actions) with **no client-side permission check at all**, relying
   solely on the server's 403: Payout Requests, Campaigns, Community Buy
   (campaigns review queue, verification, refunds, support cases, data
   access, organiser fees, Direct Charge payouts), Delivery Zones,
   Disputes detail, Orders detail, Payment Anomalies, Promo Codes, Reviews,
   Stripe Disputes, Subscription Plans, Users (list + detail), Vendors
   (list + detail, including its Subscription and Markets cards),
   Verification, Ledger (per-action: reconciliation run vs. resolve), and
   the shared `ProviderReadinessPanel`/`NotesTimeline` components (notes
   add, Stripe reminder).
23. Thirteen `window.confirm()` / `alert()` call sites (Campaigns,
   Community Buy campaigns ×5, Community Data Access, Community
   Verification ×6, Payout Requests) replaced with the shared `useConfirm`
   dialog, each now collecting a reason where the backend expects one.
24. Payout Requests page rewritten: fixed a currency-summing bug (FX-summed
   stat cards instead of per-currency totals), a stale-vendor-name bug
   (client-joined a separately paginated vendor list capped at 100 instead
   of using the `vendor.storeName` the endpoint already returns), and added
   proper pagination UI.
25. Promo Codes: fixed a minor/major-unit bug on `FIXED_AMOUNT` discounts
   (a 10.00 discount would have been stored as 0.10) and a time zone bug
   (`datetime-local` values sent without a UTC offset, silently shifting
   `validFrom`/`validUntil` by the admin's local offset).

Plus, across most of the above: raw ID fallbacks replaced with named
fallbacks ("Campaign title not provided" etc.), inconsistent
`toLocaleString()`/`toLocaleDateString()` calls replaced with the shared
`formatDateTime`/`formatDate`/`formatDateUtc` helpers (added `formatDateUtc`
and `formatMajor`/`sumByCurrency`/`formatTotals` to `components/AdminKit.tsx`
for this), and manual `(amount/100).toFixed(2)` string concatenation
replaced with `formatMinor`.

**Remaining (documented, not fixed — out of session scope):**

1. **Backend**: `/admin/campaigns` (Hot Deal/Gift Card eligibility engine)
   takes no `reason` parameter and writes no `AuditLog` row on
   create/update/delete (confirmed: no `recordAudit`/`reason` anywhere in
   `campaigns.controller.ts`/`campaigns.service.ts`), unlike every other
   admin mutation in the codebase. The page's confirm dialogs now say
   `requireReason: false` so they do not falsely promise an audit trail
   that doesn't exist, but the underlying backend gap (no audit logging for
   this one feature) was not fixed (backend is read-only for this task).
2. **Backend**: `/admin/payout-requests`, `/admin/community-buy/refunds`
   and `/admin/community-buy/support-cases` have no server-side cursor
   pagination (`payouts.service.ts#adminList` and the equivalent
   Community Buy services return the full table with no `take`/`skip`).
   The pages now paginate client-side for usability, but at a large record
   count every page load still fetches the entire table. Flagged as a
   backend follow-up (would need a new paginated endpoint), not fixed here.
3. **Not fixed this session**: `/wallet-transactions` and
   `/wallet-transactions/[id]` — the list page formats money manually
   (`tx.currency + amount.toFixed(2)`) instead of `formatMinor`, and both
   pages use bare `toLocaleDateString()`/`toLocaleString()` with no
   explicit time zone. Lower priority (values are already correct, this is
   presentation-only) and time-boxed out; left as a known remaining item
   rather than silently skipped.

## What was not verified

- **No browser/dev-server verification.** The dev server was not started
  and no page was loaded in the Browser pane. The backend this admin panel
  talks to (`NEXT_PUBLIC_API_URL`) is a deployed service, not reachable
  from this environment, so even starting `npm run dev` would only confirm
  the pages render with no data — this was judged lower-value than the
  static read + tsc + lint + build verification actually performed, and is
  stated here rather than claimed.
- **No test runner exists** in `admin-web` to run (`package.json` scripts:
  `clean`, `dev`, `build`, `start`, `lint`, `typecheck` — no `test`).
- Backend code was read-only throughout: every endpoint/permission claim
  above was verified by reading `ekiapp-backend-main` source, but no
  backend file was edited and no backend test was run.
- Pages marked "OK (not modified; already compliant)" in the table above
  were read and checked against the same criteria as every other page, but
  not changed — they were already using `useConfirm`, had working
  `canMutate` gating, and used the shared formatting helpers from earlier
  work on this branch.

## Build / lint / tsc results

```
$ cd admin-web && npx tsc --noEmit
(no output — 0 errors)

$ npx next lint
✔ No ESLint warnings or errors

$ npx next build
   ▲ Next.js 14.2.35
 ✓ Compiled successfully
   Linting and checking validity of types ...
   Collecting page data ...
 ✓ Generating static pages (56/56)
   Finalizing page optimization ...
   Collecting build traces ...
(56 routes listed, all ○ static or ƒ dynamic as expected — no errors)
```
