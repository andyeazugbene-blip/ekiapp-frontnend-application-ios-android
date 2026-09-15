#!/usr/bin/env node
/**
 * check-supplier-routing-and-copy
 *
 * Two confirmed client-facing bugs found by a routing audit:
 *
 * Bug 1 (routing) — TWO superseded attempts before this one:
 *  (a) Original: a buyer-role user with hasVendor=true tapping "Suppliers"
 *      was bounced back to /(buyer) because (vendor)'s own layout redirected
 *      role==="buyer" back to /(buyer) even when hasVendor was true. Fixed
 *      per call site with a role check + switchRole() before entering.
 *  (b) That workaround was too narrow — the same layout gate also blocked
 *      an approved SupplierAccount user with NO Vendor row at all (the exact
 *      case Workstream 1/3 exists to support). Fixed by making (vendor)/
 *      _layout.tsx bypass its own hasVendor gate for the two Supplier
 *      Centre paths specifically.
 *  (c) Real-device testing showed (b) was STILL wrong: a Vendor+
 *      SupplierAccount user tapping "Suppliers" from the Vendor Dashboard
 *      landed on the real screen, but still wrapped in (vendor)'s own Tabs
 *      chrome (Dashboard/Orders/Foodstuff/Buyers/Earnings tab bar) — an
 *      explicitly-chosen Supplier destination must never be presented as
 *      "still Vendor mode" regardless of what other capabilities the user
 *      has. Root-caused for real this time: Supplier Centre moved out of
 *      (vendor) entirely into its own independent route group, (supplier)/,
 *      with its own auth-only (no hasVendor) layout. This check now verifies
 *      that real architecture, not either retired workaround.
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
const VENDOR_HOME = path.join(ROOT, "app", "(vendor)", "index.tsx");
const VENDOR_NOTIFICATIONS = path.join(ROOT, "app", "(vendor)", "notifications.tsx");
const SETUP_STORE = path.join(ROOT, "app", "(vendor-onboarding)", "setup-store.tsx");
const ROOT_LAYOUT = path.join(ROOT, "app", "_layout.tsx");
const VENDOR_LAYOUT = path.join(ROOT, "app", "(vendor)", "_layout.tsx");
const SUPPLIER_LAYOUT = path.join(ROOT, "app", "(supplier)", "_layout.tsx");
const SUPPLIER_SCREEN = path.join(ROOT, "app", "(supplier)", "community-buy-supplier.tsx");
const SUPPLIER_FULFILMENT_SCREEN = path.join(ROOT, "app", "(supplier)", "community-buy-supplier-fulfilment.tsx");
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

// ─── Bug 1: routing — Supplier Centre must be its own independent route
// group, never nested inside (vendor), and every navigation call site must
// target it there. ───────────────────────────────────────────────────────

if (!fs.existsSync(SUPPLIER_LAYOUT) || !fs.existsSync(SUPPLIER_SCREEN) || !fs.existsSync(SUPPLIER_FULFILMENT_SCREEN)) {
  fail("app/(supplier)/ is missing its layout or screens — Supplier Centre must live in its own independent route group, not under (vendor).");
} else {
  const supplierLayoutSource = read(SUPPLIER_LAYOUT);
  // Matches real property-access usage (.hasVendor) only — not the word
  // appearing in this file's own explanatory comments about why it's absent.
  if (supplierLayoutSource && (/\.hasVendor\b/.test(supplierLayoutSource) || /<Tabs\b/.test(supplierLayoutSource))) {
    fail("app/(supplier)/_layout.tsx reads hasVendor or renders a Tabs navigator — it must only require authentication, with no Vendor Tabs chrome, so a Vendor+SupplierAccount user's explicit Supplier choice is never presented as Vendor mode.");
  }
}

for (const [label, file] of [
  ["role-select.tsx", ROLE_SELECT],
  ["app/(buyer)/index.tsx", BUYER_HOME],
  ["app/(vendor)/index.tsx", VENDOR_HOME],
  ["app/(vendor)/notifications.tsx", VENDOR_NOTIFICATIONS],
  ["app/(vendor-onboarding)/setup-store.tsx", SETUP_STORE],
  ["app/_layout.tsx", ROOT_LAYOUT],
]) {
  const source = read(file);
  if (!source) continue;
  if (!source.includes("community-buy-supplier")) {
    fail(`${label}: Suppliers no longer routes to the real supplier dashboard.`);
  }
  if (source.includes("(vendor)/community-buy-supplier")) {
    fail(`${label}: still navigates to community-buy-supplier under (vendor) — it must target (supplier)/community-buy-supplier now that the screen has moved to its own independent route group.`);
  }
}

const vendorLayoutSource = read(VENDOR_LAYOUT);
if (vendorLayoutSource && vendorLayoutSource.includes("community-buy-supplier")) {
  fail("(vendor)/_layout.tsx still references community-buy-supplier — Supplier Centre must not be special-cased inside the Vendor layout at all any more; it should have no knowledge of these screens now that they live under (supplier)/.");
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
