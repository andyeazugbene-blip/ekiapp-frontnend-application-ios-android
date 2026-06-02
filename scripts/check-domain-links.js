#!/usr/bin/env node
/**
 * Live domain health-check.
 *
 * Tests:
 *   1. https://culinarytales.app                             (200/3xx)
 *   2. https://www.culinarytales.app                         (200/3xx)
 *   3. https://culinarytales.app/store/<slug>                (200, no loop)
 *   4. https://www.culinarytales.app/store/<slug>            (200, no loop)
 *   5. https://ekiapp-backend.vercel.app/store/<slug>        (200)
 *   6. https://ekiapp-backend.vercel.app/api/health          (200)
 *
 * If TEST_VENDOR_SLUG is not provided in env, the script will fetch
 *   GET {API_BASE}/vendors?limit=10
 * and pick the first vendor that has a `storeSlug`. If no slug exists
 * anywhere, the store-route checks are SKIPPED with a clear message.
 *
 * Also scans response bodies of public pages and fails if stale launch
 * domain text is found in any HTML body.
 */

const DOMAIN_PRIMARY = process.env.DOMAIN_PRIMARY || "https://culinarytales.app";
const DOMAIN_WWW = process.env.DOMAIN_WWW || "https://www.culinarytales.app";
const VERCEL_WEB = process.env.VERCEL_WEB || "https://ekiapp-backend.vercel.app";
const API_BASE = process.env.API_BASE || `${VERCEL_WEB}/api`;
let TEST_VENDOR_SLUG = process.env.TEST_VENDOR_SLUG || "";
const FALLBACK_STORE_SLUGS = ["mama-chi-foodstuff", "mamachifoodstuff"];

const TIMEOUT_MS = 12_000;
const MAX_REDIRECTS = 5;
const STALE_DOMAIN_RE = /(?:waqti\.pro|italian-market-place\.vercel\.app|neon\.online)/i;

/**
 * Manual fetch with redirect following + cycle detection.
 * Uses Node's global fetch (Node 18+) with manual redirects.
 */
async function fetchWithChain(url, opts = {}) {
  const visited = new Set();
  let current = url;
  const chain = [current];

  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    if (visited.has(current)) {
      return { ok: false, status: 0, error: "redirect-loop", chain };
    }
    visited.add(current);

    let res;
    try {
      const ac = new AbortController();
      const t = setTimeout(() => ac.abort(), TIMEOUT_MS);
      res = await fetch(current, {
        method: opts.method || "GET",
        redirect: "manual",
        signal: ac.signal,
        headers: { "User-Agent": "eki-domain-check/1.0", Accept: "*/*", ...(opts.headers || {}) },
      });
      clearTimeout(t);
    } catch (err) {
      return { ok: false, status: 0, error: err.message || "fetch-failed", chain };
    }

    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      const loc = res.headers.get("location");
      const next = new URL(loc, current).toString();
      chain.push(next);
      current = next;
      continue;
    }

    let body = "";
    try {
      const ct = res.headers.get("content-type") || "";
      if (/text|json|html|xml/i.test(ct)) {
        body = await res.text();
      }
    } catch {
      /* ignore body errors */
    }

    return { ok: res.status < 400, status: res.status, body, chain, finalUrl: current };
  }

  return { ok: false, status: 0, error: "too-many-redirects", chain };
}

async function findVendorSlug() {
  if (TEST_VENDOR_SLUG) return TEST_VENDOR_SLUG;

  const apiBase = API_BASE.replace(/\/+$/, "");

  // Try public list endpoints (some backends gate these behind auth).
  for (const params of ["?limit=20", "?limit=20&sort=newest", ""]) {
    const url = `${apiBase}/vendors${params}`;
    const r = await fetchWithChain(url);
    if (!r.ok) continue;
    let data;
    try {
      data = JSON.parse(r.body);
    } catch {
      continue;
    }
    const list = data?.vendors || data?.items || [];
    const found = list.find((v) => typeof v?.storeSlug === "string" && v.storeSlug.length > 0);
    if (found?.storeSlug) return found.storeSlug;

    // Fallback: derive a slug from a vendor's name.
    const named = list.find((v) => typeof v?.storeName === "string" && v.storeName.trim().length > 0);
    if (named?.storeName) return slugify(named.storeName);
  }

  // Try the products feed (usually public). Each product carries a vendorId
  // and sometimes a vendor slug/name.
  try {
    const r = await fetchWithChain(`${apiBase}/products?limit=20`);
    if (r.ok) {
      const data = JSON.parse(r.body);
      const items = data?.items || data?.products || [];
      const p = items.find((x) => typeof x?.vendorSlug === "string" && x.vendorSlug.length > 0);
      if (p?.vendorSlug) return p.vendorSlug;
      const named = items.find((x) => typeof x?.vendorName === "string" && x.vendorName.trim());
      if (named?.vendorName) return slugify(named.vendorName);
    }
  } catch {
    /* ignore */
  }

  // Final fallback: probe stable seeded storefronts that should exist in
  // production-like environments. This keeps the health-check useful even
  // when vendor listing endpoints are auth-gated.
  for (const candidate of FALLBACK_STORE_SLUGS) {
    const r = await fetchWithChain(`${apiBase}/public/stores/${encodeURIComponent(candidate)}`);
    if (r.ok) {
      return candidate;
    }
  }

  return null;
}

function slugify(value) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

const checks = [];
let critical = 0;
let warnings = 0;
let oldDomainHits = 0;

function record({ name, target, ok, status, finalUrl, chain, body, error, severity = "critical", skipped = false }) {
  const hasOldDomain = body && STALE_DOMAIN_RE.test(body);
  if (hasOldDomain) oldDomainHits++;

  const passed = skipped ? null : (ok && !hasOldDomain);

  if (skipped) {
    checks.push({ name, target, status: "SKIPPED", note: error || "", passed: null });
    return;
  }
  if (!passed) {
    if (severity === "critical") critical++;
    else warnings++;
  }

  checks.push({
    name,
    target,
    finalUrl: finalUrl || target,
    status: status ?? "ERR",
    redirects: chain && chain.length - 1,
    passed,
    hasOldDomain,
    error: error || "",
  });
}

(async () => {
  console.log("Domain health-check");
  console.log("===================\n");
  console.log(`Primary:  ${DOMAIN_PRIMARY}`);
  console.log(`WWW:      ${DOMAIN_WWW}`);
  console.log(`Vercel:   ${VERCEL_WEB}`);
  console.log(`API base: ${API_BASE}\n`);

  // 1. Primary domain
  {
    const r = await fetchWithChain(DOMAIN_PRIMARY);
    record({ name: "primary domain", target: DOMAIN_PRIMARY, ...r });
  }

  // 2. www domain
  {
    const r = await fetchWithChain(DOMAIN_WWW);
    record({ name: "www domain", target: DOMAIN_WWW, ...r, severity: "warning" });
  }

  // 6. API health
  {
    const url = `${API_BASE.replace(/\/+$/, "")}/health`;
    const r = await fetchWithChain(url);
    record({ name: "api /health", target: url, ...r });
  }

  // Get a vendor slug
  if (!TEST_VENDOR_SLUG) {
    const slug = await findVendorSlug();
    if (slug) {
      TEST_VENDOR_SLUG = slug;
      console.log(`✓ Using vendor slug from API: ${TEST_VENDOR_SLUG}\n`);
    } else {
      console.warn("⚠ No vendor slug available — store-route checks will be SKIPPED.\n");
    }
  } else {
    console.log(`✓ Using TEST_VENDOR_SLUG=${TEST_VENDOR_SLUG}\n`);
  }

  if (TEST_VENDOR_SLUG) {
    const slug = encodeURIComponent(TEST_VENDOR_SLUG);
    // 3. culinarytales.app/store/:slug
    {
      const url = `${DOMAIN_PRIMARY}/store/${slug}`;
      const r = await fetchWithChain(url);
      record({ name: "store route (primary)", target: url, ...r });
    }
    // 4. www.culinarytales.app/store/:slug
    {
      const url = `${DOMAIN_WWW}/store/${slug}`;
      const r = await fetchWithChain(url);
      record({ name: "store route (www)", target: url, ...r, severity: "warning" });
    }
    // 5. vercel/store/:slug
    {
      const url = `${VERCEL_WEB}/store/${slug}`;
      const r = await fetchWithChain(url);
      record({ name: "store route (vercel)", target: url, ...r });
    }
  } else {
    record({ name: "store route (primary)", target: `${DOMAIN_PRIMARY}/store/<slug>`, skipped: true, error: "no slug" });
    record({ name: "store route (www)", target: `${DOMAIN_WWW}/store/<slug>`, skipped: true, error: "no slug" });
    record({ name: "store route (vercel)", target: `${VERCEL_WEB}/store/<slug>`, skipped: true, error: "no slug" });
  }

  // Print results
  console.log("Results");
  console.log("-------");
  for (const c of checks) {
    const tag = c.passed === null ? "⏭" : c.passed ? "✓" : "✖";
    console.log(`${tag} ${c.name.padEnd(28)} ${c.target}`);
    if (c.passed === null) {
      console.log(`    SKIPPED — ${c.note || c.error}`);
      continue;
    }
    console.log(`    status=${c.status}  redirects=${c.redirects ?? 0}  finalUrl=${c.finalUrl}`);
    if (c.error) console.log(`    error: ${c.error}`);
    if (c.hasOldDomain) console.log("    ⚠ stale launch-domain text found in response body");
  }

  console.log("");
  if (oldDomainHits > 0) {
    console.error(`✖ Old-domain text found in ${oldDomainHits} response body(ies).`);
  }
  console.log(`Summary: ${checks.length} checks, ${critical} critical failure(s), ${warnings} warning(s).`);

  // Exit codes
  // 0 = all critical OK
  // 1 = at least one critical failed
  process.exit(critical > 0 ? 1 : 0);
})().catch((err) => {
  console.error("✖ Unexpected error:", err);
  process.exit(2);
});
