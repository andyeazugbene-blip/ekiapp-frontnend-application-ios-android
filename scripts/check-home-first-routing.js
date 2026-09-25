#!/usr/bin/env node
/**
 * check-home-first-routing
 *
 * Client rules this guards:
 *   1. Signing in / re-opening the app as a Buyer or Vendor lands on that
 *      role's HOME — never straight into a feature screen (Community Buy,
 *      payout setup, a campaign...). The remembered destination only picks
 *      WHICH home.
 *   2. Registration (including the Community Buy entry card) lands on Home
 *      too; it must not carry a redirect into Community Buy.
 *   3. The vendor side-menu scrolls, so every entry is reachable on short
 *      screens instead of being pinned/clipped.
 *
 * (1) is a behavioural test: the real utils/homeRoute.ts is transpiled with
 * the project's own TypeScript and executed against a case table.
 */
const fs = require("fs");
const path = require("path");
const ts = require("typescript");

const ROOT = path.join(__dirname, "..");
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), "utf8");

let failures = 0;
const fail = (msg) => {
  failures += 1;
  console.error(`FAIL check-home-first-routing: ${msg}`);
};

// ── 1. Behaviour of resolveHomeRoute ────────────────────────────────────────
const helperSource = read("utils", "homeRoute.ts");
const { outputText } = ts.transpileModule(helperSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019 },
});
const mod = { exports: {} };
new Function("module", "exports", "require", outputText)(mod, mod.exports, require);
const { resolveHomeRoute } = mod.exports;
if (typeof resolveHomeRoute !== "function") {
  fail("utils/homeRoute.ts no longer exports resolveHomeRoute().");
} else {
  const buyer = { role: "buyer", hasVendor: false };
  const vendor = { role: "vendor", hasVendor: true };
  const buyerWithVendorProfile = { role: "buyer", hasVendor: true };
  const admin = { role: "admin", hasVendor: false };
  const cases = [
    // [label, user, lastDestination, expected]
    ["buyer, no preference → Buyer Home", buyer, null, "/(buyer)"],
    ["buyer, last=buy → Buyer Home", buyer, "buy", "/(buyer)"],
    ["buyer, last=community_buy → Buyer Home (NOT Community Buy)", buyer, "community_buy", "/(buyer)"],
    ["vendor, no preference → Vendor Home", vendor, null, "/(vendor)"],
    ["vendor, last=sell → Vendor Home", vendor, "sell", "/(vendor)"],
    ["vendor, last=community_buy → Vendor Home (their default Home, never the Community Buy screen)", vendor, "community_buy", "/(vendor)"],
    ["dual account, last=community_buy → default Home (Vendor Home)", buyerWithVendorProfile, "community_buy", "/(vendor)"],
    ["vendor, last=buy → Buyer Home (their explicit choice)", vendor, "buy", "/(buyer)"],
    ["buyer with a stale last=sell (no vendor profile) → Buyer Home", buyer, "sell", "/(buyer)"],
    ["dual account, last=sell → Vendor Home", buyerWithVendorProfile, "sell", "/(vendor)"],
    ["dual account, last=buy → Buyer Home", buyerWithVendorProfile, "buy", "/(buyer)"],
    ["dual account, no preference → Vendor Home (existing default)", buyerWithVendorProfile, undefined, "/(vendor)"],
    ["supplier preference → Supplier Centre (its own dashboard)", buyer, "supply", "/(supplier)/community-buy-supplier"],
    ["admin always → Admin", admin, "buy", "/(admin)"],
    ["no user, no preference → Buyer Home", null, null, "/(buyer)"],
  ];
  for (const [label, user, last, expected] of cases) {
    const got = resolveHomeRoute(user, last);
    if (got !== expected) fail(`${label}: expected ${expected}, got ${got}`);
  }
  // Nothing may ever resolve to a feature screen.
  for (const last of [null, "buy", "sell", "supply", "community_buy"]) {
    for (const user of [null, { role: "buyer", hasVendor: false }, { role: "vendor", hasVendor: true }]) {
      const got = resolveHomeRoute(user, last);
      if (/community-buy(?!-supplier)/.test(got) || /payout|stripe|settings|campaign/i.test(got)) {
        fail(`resolveHomeRoute(${JSON.stringify(user)}, ${last}) returned a feature route: ${got}`);
      }
    }
  }
}

// ── 2. Static guards on the entry points ────────────────────────────────────
const indexSource = read("app", "index.tsx");
if (!indexSource.includes("resolveHomeRoute(")) {
  fail("app/index.tsx no longer routes signed-in users through resolveHomeRoute().");
}
if (/router\.replace\(\s*["'`]\/\(buyer\)\/community-buy/.test(indexSource)) {
  fail("app/index.tsx replaces straight into Community Buy on launch — must open Home.");
}

const roleSelect = read("app", "(auth)", "role-select.tsx");
if (/redirect:\s*["']\/\(buyer\)\/community-buy/.test(roleSelect)) {
  fail("role-select.tsx registers Community Buy users with a redirect into Community Buy — they must land on Home.");
}

// ── 3. Vendor drawer scrolls ────────────────────────────────────────────────
const drawer = read("components", "vendor", "Drawer.tsx");
if (!/import\s*\{[^}]*\bScrollView\b[^}]*\}\s*from\s*["']react-native["']/.test(drawer) || !/<ScrollView\b/.test(drawer)) {
  fail("components/vendor/Drawer.tsx no longer wraps the menu in a ScrollView — the sidebar must scroll.");
}
const menuIdx = drawer.indexOf("MENU_ITEMS.map");
const scrollOpen = drawer.indexOf("<ScrollView");
const scrollClose = drawer.indexOf("</ScrollView>");
if (menuIdx !== -1 && !(scrollOpen !== -1 && scrollOpen < menuIdx && menuIdx < scrollClose)) {
  fail("the vendor drawer's menu items are not inside its ScrollView.");
}

if (failures > 0) process.exit(1);
console.log("check-home-first-routing passed.");
