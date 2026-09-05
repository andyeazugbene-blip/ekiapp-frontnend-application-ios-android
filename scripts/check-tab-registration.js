#!/usr/bin/env node
/**
 * check-tab-registration
 *
 * Real device bug (repeated across multiple TestFlight builds): a screen
 * file dropped into app/(vendor)/ or app/(buyer)/ with no matching
 * <Tabs.Screen> entry in that group's _layout.tsx gets a DEFAULT,
 * auto-generated, VISIBLE tab bar button from Expo Router — silently
 * turning an internal detail/sub-screen into an unwanted extra bottom-nav
 * tab. Every screen in a Tabs group must be explicitly registered (either
 * as a real visible tab, or with href: null to hide it from the bar) so
 * this can never regress unnoticed again.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const APP_DIR = path.join(ROOT, "app");

const TAB_GROUPS = ["(buyer)", "(vendor)", "(admin)"];

let violations = 0;

for (const group of TAB_GROUPS) {
  const dir = path.join(APP_DIR, group);
  const layoutPath = path.join(dir, "_layout.tsx");
  if (!fs.existsSync(layoutPath)) continue;

  const layoutSource = fs.readFileSync(layoutPath, "utf8");
  if (!/<Tabs\b/.test(layoutSource)) continue; // not a Tabs navigator — nothing to check

  const registered = new Set(
    [...layoutSource.matchAll(/<Tabs\.Screen\s+name="([^"]+)"/g)].map((m) => m[1]),
  );

  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".tsx") && f !== "_layout.tsx")
    .map((f) => f.replace(/\.tsx$/, ""));

  for (const name of files) {
    if (!registered.has(name)) {
      console.error(
        `✗ app/${group}/${name}.tsx has no <Tabs.Screen name="${name}"> entry in ${group}/_layout.tsx — ` +
          `Expo Router will auto-generate a VISIBLE tab bar button for it. Add an entry (with href: null if it should not appear in the bar).`,
      );
      violations++;
    }
  }
}

if (violations > 0) {
  console.error(`\n${violations} screen(s) missing an explicit Tabs.Screen registration.`);
  process.exit(1);
}

console.log(`✓ Every screen file in ${TAB_GROUPS.join(", ")} is explicitly registered in its Tabs navigator.`);
