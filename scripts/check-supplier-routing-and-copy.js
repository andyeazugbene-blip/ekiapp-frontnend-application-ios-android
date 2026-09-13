#!/usr/bin/env node
/**
 * check-supplier-routing-and-copy
 *
 * Two confirmed client-facing bugs found by a routing audit, fixed here:
 *
 * Bug 1 (routing): a buyer-role user with hasVendor=true tapping "Suppliers"
 * was pushed straight to /(vendor)/community-buy-supplier without calling
 * switchRole() first — (vendor)'s own layout redirects role==="buyer" back
 * to /(buyer) even when hasVendor is true, so the user was silently bounced
 * back to Buyer Home and never reached the supplier dashboard. Fixed in
 * both places that had this branch: role-select.tsx (Hero) and
 * app/(buyer)/index.tsx (Home).
 *
 * Bug 2 (copy): a user who explicitly chose "Suppliers" still registers
 * through the vendor role under the hood (SupplierProfile requires a
 * Vendor record — unchanged architecture), but register.tsx and the vendor
 * OTP screen showed generic retail-seller copy ("Create your vendor
 * account", "set up your store and seller profile") with no awareness of
 * why the user was actually there.
 *
 * This isn't a full parser — it verifies the specific markers a future
 * edit would have to touch to reintroduce either bug, so a regression
 * fails this check instead of shipping silently.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const ROLE_SELECT = path.join(ROOT, "app", "(auth)", "role-select.tsx");
const BUYER_HOME = path.join(ROOT, "app", "(buyer)", "index.tsx");
const REGISTER = path.join(ROOT, "app", "(auth)", "register.tsx");
const VENDOR_OTP = path.join(ROOT, "app", "(vendor-onboarding)", "otp.tsx");
const PENDING_INTENT = path.join(ROOT, "stores", "pendingIntent.ts");

let failed = false;
function fail(message) {
  console.error(`FAIL check-supplier-routing-and-copy: ${message}`);
  failed = true;
}

function read(file) {
  if (!fs.existsSync(file)) {
    fail(`${file} not found.`);
    return null;
  }
  return fs.readFileSync(file, "utf8");
}

// ─── Bug 1: routing — switchRole() must run before entering (vendor) when
// the current role is still "buyer", in both entry points. ─────────────

for (const [label, file] of [["role-select.tsx", ROLE_SELECT], ["app/(buyer)/index.tsx", BUYER_HOME]]) {
  const source = read(file);
  if (!source) continue;
  if (!source.includes('user.role === "buyer"') && !source.includes("user?.role === \"buyer\"")) {
    fail(`${label}: Suppliers navigation no longer checks the current role before entering (vendor) — this is exactly the bounce-back bug.`);
    continue;
  }
  if (!source.includes("switchRole()")) {
    fail(`${label}: no switchRole() call found near the Suppliers navigation — a buyer-role user with hasVendor=true will be bounced back to /(buyer).`);
  }
  if (!source.includes("community-buy-supplier")) {
    fail(`${label}: Suppliers no longer routes to the real supplier dashboard.`);
  }
}

// ─── Bug 2: copy — register.tsx and the vendor OTP screen must be aware of
// supplier intent, and normal vendor copy must remain unconditionally
// present (proving it wasn't deleted, only branched). ───────────────────

const registerSource = read(REGISTER);
if (registerSource) {
  if (!registerSource.includes("peekPendingIntent")) {
    fail("register.tsx no longer reads the supplier intent flag — supplier signups will show generic vendor copy again.");
  }
  if (!registerSource.includes("Create your supplier account")) {
    fail('register.tsx is missing the supplier-framed title "Create your supplier account".');
  }
  if (!registerSource.includes("apply as an Eki Community Buy supplier")) {
    fail("register.tsx is missing the supplier-framed subtitle.");
  }
  // The original vendor copy must still exist, reachable when NOT supplier
  // intent — this is what proves Bug 2 was fixed by branching, not by
  // replacing the normal vendor flow's copy.
  if (!registerSource.includes("Create your vendor account")) {
    fail("register.tsx no longer has the normal vendor registration title — the fix must branch, not replace, vendor copy.");
  }
  if (!registerSource.includes("set up your store and seller profile")) {
    fail("register.tsx no longer has the normal vendor registration subtitle — the fix must branch, not replace, vendor copy.");
  }
}

const otpSource = read(VENDOR_OTP);
if (otpSource) {
  if (!otpSource.includes("peekPendingIntent")) {
    fail("(vendor-onboarding)/otp.tsx no longer reads the supplier intent flag — this screen sits in the same chain as register.tsx and needs the same awareness.");
  }
  if (!otpSource.includes("Create Your Supplier")) {
    fail("(vendor-onboarding)/otp.tsx is missing supplier-framed copy.");
  }
  if (!otpSource.includes("Create Your Vendor")) {
    fail("(vendor-onboarding)/otp.tsx no longer has the normal vendor copy — the fix must branch, not replace it.");
  }
}

// pendingIntent.ts must expose both a consuming and a non-consuming reader
// — register.tsx/otp.tsx need to peek without clearing, since
// setup-store.tsx is the actual one-shot consumer later in the same chain.
const pendingIntentSource = read(PENDING_INTENT);
if (pendingIntentSource) {
  if (!pendingIntentSource.includes("export function peekPendingIntent")) {
    fail("stores/pendingIntent.ts is missing peekPendingIntent() — without it, register.tsx/otp.tsx would have to consume (clear) the flag, breaking setup-store.tsx's later read.");
  }
  if (!pendingIntentSource.includes("export function consumePendingIntent")) {
    fail("stores/pendingIntent.ts is missing consumePendingIntent().");
  }
}

if (failed) process.exit(1);
console.log("check-supplier-routing-and-copy passed.");
