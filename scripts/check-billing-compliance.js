#!/usr/bin/env node
/**
 * Fails when the mobile app contains subscription steering copy or external
 * subscription checkout links that are not allowed in App Review builds.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const APP_DIR = path.join(ROOT, "app");
const SERVICE_FILE = path.join(ROOT, "services", "subscriptionService.ts");

const FILE_EXT_RE = /\.(t|j)sx?$/i;
const SKIP_DIRS = new Set(["node_modules", ".git", ".expo", "dist", "build"]);

const FORBIDDEN_PATTERNS = [
  { label: "pay on website", re: /\bpay\s+on\s+(the\s+)?website\b/i },
  { label: "subscribe on website", re: /\bsubscribe\s+on\s+(the\s+)?website\b/i },
  { label: "pay on web", re: /\bpay\s+on\s+(the\s+)?web\b/i },
  { label: "subscribe on web", re: /\bsubscribe\s+on\s+(the\s+)?web\b/i },
  { label: "external checkout", re: /\bexternal\s+checkout\b/i },
  { label: "Stripe checkout", re: /\bstripe\s+checkout\b/i },
  { label: "upgrade at old domain", re: /\bupgrade\s+at\s+waqti\.pro\b/i },
  { label: "subscription checkout endpoint", re: /\/api\/subscriptions\/checkout/i },
  { label: "checkout URL field", re: /\bcheckoutUrl\b/i },
  { label: "subscription checkout opener", re: /\bopenCheckout\b/i },
  { label: "subscription checkout route", re: /(?:waqti\.pro|culinarytales\.app)\/(?:subscribe|subscription|subscriptions|checkout|pricing|plans|upgrade)\b/i },
  { label: "paid subscription CTA", re: /<(?:Text|Button)\b[^>]*>[^<]*(?:Upgrade now|Upgrade Plan|Choose Plan|View Plans|See Plans|Subscribe|Activate\s+[-\u2013\u2014])[^<]*<\/(?:Text|Button)>/i },
];

const WEB_ONLY_SUBSCRIPTION_ROUTE = "app/vendor/subscription.tsx";

function isAllowedViolation(rel, label, line) {
  // This route is served by Expo Web only. On native it renders a read-only
  // fallback and never opens checkout, so it is allowed to contain web billing
  // copy and Stripe Checkout routing.
  if (rel === WEB_ONLY_SUBSCRIPTION_ROUTE) return true;

  // The shared service exposes only the public web checkout helper. Native
  // subscription screens must not call it; this scanner still catches checkout
  // copy/openers anywhere else under app/.
  if (rel === "services/subscriptionService.ts" && label === "checkout URL field") {
    return true;
  }
  if (rel === "services/subscriptionService.ts" && line.includes("/api/subscriptions/web-checkout")) {
    return true;
  }

  return false;
}

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
      if (!SKIP_DIRS.has(name)) walk(full, out);
      continue;
    }

    if (FILE_EXT_RE.test(name)) out.push(full);
  }
}

function scanFile(full, violations) {
  const rel = path.relative(ROOT, full).replace(/\\/g, "/");
  let src;
  try {
    src = fs.readFileSync(full, "utf8");
  } catch {
    return;
  }

  const lines = src.split(/\r?\n/);
  lines.forEach((line, index) => {
    for (const pattern of FORBIDDEN_PATTERNS) {
      if (pattern.re.test(line)) {
        if (isAllowedViolation(rel, pattern.label, line)) continue;
        violations.push({
          file: rel,
          line: index + 1,
          label: pattern.label,
          text: line.trim().slice(0, 220),
        });
      }
    }
  });
}

const files = [];
walk(APP_DIR, files);
if (fs.existsSync(SERVICE_FILE)) files.push(SERVICE_FILE);

const violations = [];
files.forEach((file) => scanFile(file, violations));

if (violations.length > 0) {
  console.error("Billing compliance check failed:\n");
  for (const violation of violations) {
    console.error(`  ${violation.file}:${violation.line} [${violation.label}]`);
    console.error(`    ${violation.text}\n`);
  }
  console.error(`Found ${violations.length} billing compliance violation(s).`);
  process.exit(1);
}

console.log(`Billing compliance check passed across ${files.length} mobile source file(s).`);
