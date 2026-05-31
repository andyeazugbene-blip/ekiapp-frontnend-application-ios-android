#!/usr/bin/env node
/**
 * Print a human-readable summary of the latest k6 run from
 * performance/results/k6-summary.json.
 *
 * Distinguishes:
 *   total requests
 *   p95 / p99 latency
 *   unexpected 5xx (real failures)
 *   expected auth blocks (401/403 — controlled)
 *   expected rate limits (429 — controlled when allowed)
 *   business failures (unexpected 4xx)
 *   skipped scenarios (when tokens are missing)
 *
 * Final verdict: PERFORMANCE READY FOR SOFT LAUNCH | NOT READY.
 */
const fs = require("fs");
const path = require("path");

const SUMMARY_PATH = path.join(__dirname, "..", "results", "k6-summary.json");

if (!fs.existsSync(SUMMARY_PATH)) {
  console.error("✖ No k6 summary found. Run a `k6:*` script first.");
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(SUMMARY_PATH, "utf8"));
const m = data.metrics ?? {};

function num(metric, key) {
  const v = m[metric]?.values;
  if (!v) return null;
  return v[key] ?? null;
}
function counter(name) {
  return m[name]?.values?.count ?? 0;
}
function rate(name) {
  return m[name]?.values?.rate ?? 0;
}

const totalReqs = num("http_reqs", "count");
const avg = num("http_req_duration", "avg");
const p95 = num("http_req_duration", "p(95)");
const p99 = num("http_req_duration", "p(99)");
const checkRate = rate("checks");

const controlledResponses = counter("controlled_responses");
const expectedAuth = counter("expected_auth_blocks");
const expectedRate = counter("expected_rate_limits");
const unexpected5xx = counter("unexpected_5xx");
const businessFailures = counter("business_failures");
const controlledRate = rate("controlled_rate");

console.log("k6 Run Summary");
console.log("==============\n");

if (totalReqs != null) console.log(`Total requests:           ${totalReqs}`);
if (avg != null) console.log(`Avg latency:              ${avg.toFixed(0)}ms`);
if (p95 != null) console.log(`p95 latency:              ${p95.toFixed(0)}ms`);
if (p99 != null) console.log(`p99 latency:              ${p99.toFixed(0)}ms`);
console.log(`Checks pass rate:         ${(checkRate * 100).toFixed(2)}%`);
console.log(`Controlled response rate: ${(controlledRate * 100).toFixed(2)}%`);

console.log("\nResponse classification:");
console.log(`  ✓ Controlled (2xx/3xx + expected 4xx): ${controlledResponses}`);
console.log(`  ✓ Expected auth blocks (401/403):       ${expectedAuth}`);
console.log(`  ✓ Expected rate limits (429):           ${expectedRate}`);
console.log(`  ${businessFailures > 0 ? "✖" : "✓"} Business failures (unexpected 4xx):  ${businessFailures}`);
console.log(`  ${unexpected5xx > 0 ? "✖" : "✓"} Unexpected 5xx (real failures):      ${unexpected5xx}`);

console.log("\nThresholds:");
let allPassed = true;
for (const [metricName, info] of Object.entries(m)) {
  if (!info.thresholds) continue;
  for (const [name, t] of Object.entries(info.thresholds)) {
    const ok = t.ok === true;
    if (!ok) allPassed = false;
    console.log(`  ${ok ? "✓" : "✖"} ${metricName} ${name}`);
  }
}

console.log("");
const realFail = unexpected5xx > 0 || businessFailures > 0 || !allPassed;
const verdict = realFail ? "NOT READY" : "PERFORMANCE READY FOR SOFT LAUNCH";
console.log(`Verdict: ${verdict}`);

if (realFail) {
  if (unexpected5xx > 0) console.log("  - Backend returned unexpected 5xx responses.");
  if (businessFailures > 0) console.log("  - Some requests returned unexpected 4xx (not auth-block / not rate-limit).");
  if (!allPassed) console.log("  - One or more thresholds failed (see above).");
}

process.exit(realFail ? 1 : 0);
