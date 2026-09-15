#!/usr/bin/env node
/**
 * check-supplier-routing-and-copy
 *
 * Two confirmed client-facing bugs found by a routing audit:
 *
 * Bug 1 (routing) — ORIGINAL fix, since superseded: a buyer-role user with
 * hasVendor=true tapping "Suppliers" was bounced back to /(buyer) because
 * (vendor)'s own layout redirected role==="buyer" back to /(buyer) even
 * when hasVendor was true. The original fix worked around this per call
 * site with a role check + switchRole() before entering. A follow-up audit
 * found the workaround was too narrow — the SAME layout gate also blocked
 * an approved SupplierAccount user who has NO Vendor row at all (the exact
 * case Workstream 1/3 exists to support), since it only ever bypassed
 * itself for hasVendor=true accounts. Root-caused and fixed at the actual
 * source instead: (vendor)/_layout.tsx no longer requires hasVendor (or
 * any role check) for the Supplier Centre routes specifically, so every
 * authenticated user reaches them directly — no pre-emptive role switch
 * needed at either call site any more. This check now verifies the real
 * fix (the layout bypass) rather than the retired per-call-site workaround.
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
const VENDOR_LAYOUT = path.join(ROOT, "app", "(vendor)", "_layout.tsx");
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

// ─── Bug 1: routing — every authenticated user must reach Supplier Centre
// directly, and (vendor)/_layout.tsx must not require hasVendor to do so. ─

for (const [label, file] of [["role-select.tsx", ROLE_SELECT], ["app/(buyer)/index.tsx", BUYER_HOME]]) {
  const source = read(file);
  if (!source) continue;
  if (!source.includes("community-buy-supplier")) {
    fail(`${label}: Suppliers no longer routes to the real supplier dashboard.`);
  }
  if (source.includes('user.role === "buyer"') || source.includes('user?.role === "buyer"')) {
    fail(`${label}: still branches Suppliers navigation on the current role — the real fix (vendor layout no longer requiring hasVendor for this route) makes this unnecessary, and it blocks SupplierAccount-only users with no Vendor row who therefore have no hasVendor/role to satisfy.`);
  }
}

const vendorLayoutSource = read(VENDOR_LAYOUT);
if (vendorLayoutSource) {
  if (!vendorLayoutSource.includes("community-buy-supplier")) {
    fail("(vendor)/_layout.tsx no longer references community-buy-supplier — cannot confirm the Supplier Centre bypass still exists.");
  }
  if (!(vendorLayoutSource.includes("!hasVendor") && vendorLayoutSource.includes("isSupplierCentreRoute"))) {
    fail("(vendor)/_layout.tsx no longer bypasses the hasVendor gate for Supplier Centre routes — a SupplierAccount-only user with no Vendor row will be redirected out before reaching Supplier Centre.");
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
