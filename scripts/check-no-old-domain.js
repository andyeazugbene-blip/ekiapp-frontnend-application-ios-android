#!/usr/bin/env node
/**
 * Fail the build when any production source/doc still references the old
 * domain `neon.online` / `www.neon.online` / `support@neon.online`.
 *
 * Allowed only inside:
 *   - docs/archive/**
 *   - migration notes (DOMAIN_MIGRATION_*.md)
 *   - CHANGELOG (old-domain note)
 *   - this script and check-no-old-domain itself
 *
 * Scans:
 *   - app/, src/, services/, components/, utils/, stores/
 *   - docs/ (excluding docs/archive)
 *   - README.md, app.json, .env.example, package.json
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");

const SCAN_DIRS = ["app", "src", "services", "components", "utils", "stores", "docs", "scripts"];
const SCAN_FILES = ["README.md", "app.json", ".env.example", "package.json"];

const ALLOW_RE = /(^|[\\/])(docs[\\/]archive|DOMAIN_MIGRATION_.*\.md|CHANGELOG\.md|check-no-old-domain\.js|check-domain-links\.js)/;

const FORBIDDEN_RE = /\bneon\.online\b/i;
const FILE_EXT_RE = /\.(t|j)sx?$|\.json$|\.md$|\.env(?:\..*)?$|\.example$|\.txt$|\.yml$|\.yaml$/i;

function walk(dir, out) {
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    let stat;
    try {
      stat = fs.statSync(full);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      // skip node_modules, .git, .expo
      if (["node_modules", ".git", ".expo", "dist", "build"].includes(name)) continue;
      walk(full, out);
    } else if (FILE_EXT_RE.test(name) || SCAN_FILES.includes(name)) {
      out.push(full);
    }
  }
}

const files = [];
for (const d of SCAN_DIRS) walk(path.join(ROOT, d), files);
for (const f of SCAN_FILES) {
  const full = path.join(ROOT, f);
  if (fs.existsSync(full)) files.push(full);
}

const violations = [];

for (const full of files) {
  const rel = path.relative(ROOT, full).replace(/\\/g, "/");
  if (ALLOW_RE.test(rel)) continue;

  let src;
  try {
    src = fs.readFileSync(full, "utf8");
  } catch {
    continue;
  }

  if (!FORBIDDEN_RE.test(src)) continue;

  const lines = src.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    if (FORBIDDEN_RE.test(lines[i])) {
      violations.push({ file: rel, line: i + 1, text: lines[i].trim().slice(0, 200) });
    }
  }
}

if (violations.length === 0) {
  console.log(`✓ No references to old domain neon.online found across ${files.length} files.`);
  process.exit(0);
}

console.error("✖ Old-domain references still present:\n");
for (const v of violations) {
  console.error(`  ${v.file}:${v.line}`);
  console.error(`    ${v.text}\n`);
}
console.error(`Found ${violations.length} occurrence(s). Replace with waqti.pro and try again.`);
process.exit(1);
