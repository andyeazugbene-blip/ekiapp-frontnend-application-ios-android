#!/usr/bin/env node
/**
 * check-no-mock-data
 *
 * Fails CI if production code under app/ imports mock data or contains
 * obvious hard-coded fake product/order/vendor arrays.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const APP_DIR = path.join(ROOT, "app");

const FORBIDDEN_PATTERNS = [
  { regex: /from\s+["'][^"']*\/mockData["']/g, label: "import from mockData" },
  { regex: /from\s+["'][^"']*\/mocks?["']/g, label: "import from mocks/" },
  { regex: /\bMOCK_(PRODUCTS|VENDORS|ORDERS|BUYER|VENDOR|ADMIN)\b/g, label: "MOCK_* constant" },
  { regex: /\b(fake|dummy|sample)Products?\b/gi, label: "fakeProducts/dummyProducts/sampleProducts" },
  { regex: /\blorem ipsum\b/gi, label: "lorem ipsum text" },
  { regex: /https?:\/\/localhost/g, label: "localhost URL" },
];

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      walk(full, files);
    } else if (full.endsWith(".tsx") || full.endsWith(".ts")) {
      files.push(full);
    }
  }
  return files;
}

let violations = 0;
const files = walk(APP_DIR);

for (const file of files) {
  const content = fs.readFileSync(file, "utf8");
  for (const { regex, label } of FORBIDDEN_PATTERNS) {
    const matches = content.match(regex);
    if (matches) {
      console.error(`✖ ${path.relative(ROOT, file)} contains ${label}`);
      console.error(`  matches: ${matches.slice(0, 3).join(", ")}`);
      violations += matches.length;
    }
  }
}

if (violations > 0) {
  console.error(`\n${violations} mock-data violation(s) found in app/.`);
  process.exit(1);
}

console.log(`✓ No mock data leaks found across ${files.length} app/ files.`);
process.exit(0);
