#!/usr/bin/env node
/**
 * check-hero-four-entry-points
 *
 * Client correction: the Hero/role-selection screen ("What do you want to
 * do on Eki?") must show four independent entry points — Foodstuffs,
 * Buyers, Community Buy, Suppliers — not the original two (Sell/Buy
 * Foodstuff). Community Buy and Suppliers must never require choosing
 * Foodstuffs first.
 *
 * This isn't a full parser — it verifies the specific markers a future
 * edit would have to touch to accidentally drop a card or its independent
 * routing, so a regression fails this check instead of shipping silently.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const TARGET = path.join(ROOT, "app", "(auth)", "role-select.tsx");

if (!fs.existsSync(TARGET)) {
  console.error(`FAIL check-hero-four-entry-points: ${TARGET} not found.`);
  process.exit(1);
}

const source = fs.readFileSync(TARGET, "utf8");

const requiredCardTitles = ["Foodstuffs", "Buyers", "Community Buy", "Suppliers"];
const missingCards = requiredCardTitles.filter((title) => !source.includes(`title="${title}"`));
if (missingCards.length > 0) {
  console.error(
    `FAIL check-hero-four-entry-points: missing Hero card(s): ${missingCards.join(", ")}. ` +
      "The Hero screen must independently expose Foodstuffs, Buyers, Community Buy, and Suppliers.",
  );
  process.exit(1);
}

const requiredRoleValues = ['"vendor"', '"buyer"', '"community_buy"', '"supplier"'];
const missingRoles = requiredRoleValues.filter((value) => !source.includes(value));
if (missingRoles.length > 0) {
  console.error(`FAIL check-hero-four-entry-points: Role type/branches missing value(s): ${missingRoles.join(", ")}.`);
  process.exit(1);
}

// Community Buy and Suppliers must route independently — never funneled
// through the vendor ("Sell Foodstuff") selection first.
if (!source.includes('router.push("/(buyer)/community-buy"')) {
  console.error(
    "FAIL check-hero-four-entry-points: Community Buy selection no longer routes directly to /(buyer)/community-buy — " +
      "this is the exact regression the client rejected (Community Buy buried behind another flow).",
  );
  process.exit(1);
}
if (!source.includes('pathname: "/(auth)/register", params: { role: "buyer", redirect: "/(buyer)/community-buy"')) {
  console.error(
    "FAIL check-hero-four-entry-points: a logged-out user choosing Community Buy no longer registers straight into " +
      "it (role=buyer + redirect=/(buyer)/community-buy) — this is what lets someone organise a Community Buy " +
      "without first becoming a foodstuff vendor.",
  );
  process.exit(1);
}
if (!source.includes('router.push("/(supplier)/community-buy-supplier"')) {
  console.error("FAIL check-hero-four-entry-points: Suppliers selection no longer routes to the real Supplier Centre (its own independent route group, not nested under (vendor)).");
  process.exit(1);
}

console.log("check-hero-four-entry-points passed.");
