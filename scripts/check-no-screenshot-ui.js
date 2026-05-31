#!/usr/bin/env node
/**
 * Fail the build when a production screen still uses a Figma screenshot
 * mockup as its primary UI.
 *
 * Forbidden in app/**:
 *   - require("../assets/figma-screens/...") or any path containing
 *     /screenshot|mockup|figma_|figma-screens|onboarding-png|dashboard-png/
 *   - imports that match the same patterns
 *   - <ImageBackground source={...} resizeMode="stretch"> (we used these as
 *     full-screen mockup overlays; legitimate ImageBackground use is rare)
 *
 * Allowed:
 *   - Image with resizeMode="cover" for user-uploaded photos
 *   - Image with resizeMode="cover" for product/vendor pictures
 *   - Decorative LinearGradient / Icon assets
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const APP_DIR = path.join(ROOT, "app");

const FORBIDDEN_PATH_RE = /(?:figma-screens|figma_|screenshot|mockup|onboarding-png|dashboard-png|9-?41|fake-9-41)/i;
const REQUIRE_RE = /require\(\s*["'`]([^"'`]+)["'`]\s*\)/g;
const IMPORT_RE = /import\s+(?:[\w*\s{},]+\s+from\s+)?["'`]([^"'`]+)["'`]/g;
const STRETCH_BG_RE = /<ImageBackground\b[^>]*resizeMode\s*=\s*["'`]stretch["'`][^>]*>/;

function walk(dir, out) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      walk(full, out);
    } else if (/\.(t|j)sx?$/.test(name)) {
      out.push(full);
    }
  }
}

const violations = [];

if (!fs.existsSync(APP_DIR)) {
  console.error(`✖ ${APP_DIR} does not exist`);
  process.exit(1);
}

const files = [];
walk(APP_DIR, files);

for (const file of files) {
  const src = fs.readFileSync(file, "utf8");
  const rel = path.relative(ROOT, file).replace(/\\/g, "/");

  // require()
  let m;
  REQUIRE_RE.lastIndex = 0;
  while ((m = REQUIRE_RE.exec(src))) {
    const target = m[1];
    if (FORBIDDEN_PATH_RE.test(target)) {
      violations.push({
        file: rel,
        kind: "forbidden-require",
        detail: target,
      });
    }
  }

  // imports
  IMPORT_RE.lastIndex = 0;
  while ((m = IMPORT_RE.exec(src))) {
    const target = m[1];
    if (FORBIDDEN_PATH_RE.test(target)) {
      violations.push({
        file: rel,
        kind: "forbidden-import",
        detail: target,
      });
    }
  }

  // <ImageBackground resizeMode="stretch">
  if (STRETCH_BG_RE.test(src)) {
    violations.push({
      file: rel,
      kind: "screenshot-imagebackground",
      detail: '<ImageBackground resizeMode="stretch">',
    });
  }
}

if (violations.length === 0) {
  console.log(`✓ No screenshot/mockup UI found across ${files.length} app/ files.`);
  process.exit(0);
}

console.error("✖ Screenshot/mockup UI found in production screens:\n");
for (const v of violations) {
  console.error(`  ${v.file}`);
  console.error(`    ${v.kind}: ${v.detail}\n`);
}
console.error(`Found ${violations.length} violation(s). Fix the screens above and try again.`);
process.exit(1);
