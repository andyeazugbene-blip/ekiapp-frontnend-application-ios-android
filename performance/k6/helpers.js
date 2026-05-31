/**
 * Shared helpers for k6 scripts.
 *
 * Provides:
 *  - BASE_URL, TOKENS, IDS from env
 *  - url(), jsonHeaders(), authHeaders()
 *  - safeParse(res)
 *  - Custom metrics:
 *      controlled_responses    — 2xx/3xx counted as success
 *      expected_auth_blocks    — 401/403 when no token / wrong role
 *      expected_rate_limits    — 429 in rate-limit-safe.js (PASS)
 *      unexpected_5xx          — server errors (FAIL)
 *      business_failures       — 4xx that aren't expected for the flow
 *  - classifyResponse(res, opts) — counts the response into the right bucket
 *  - skipOrRun(token, name, fn) — skip authenticated scenarios cleanly
 *  - markSkipped(name) — log a skip line; iterations still 0
 */
import { Counter, Rate } from "k6/metrics";
import { check } from "k6";

export const BASE_URL = (__ENV.K6_BASE_URL || "https://italian-market-place.vercel.app/api").replace(/\/+$/, "");

export const TOKENS = {
  buyer: __ENV.K6_BUYER_TOKEN || "",
  vendor: __ENV.K6_VENDOR_TOKEN || "",
  admin: __ENV.K6_ADMIN_TOKEN || "",
};

export const IDS = {
  productId: __ENV.K6_PRODUCT_ID || "",
  vendorId: __ENV.K6_VENDOR_ID || "",
  cartProductId: __ENV.K6_CART_PRODUCT_ID || "",
};

// ─── Custom metrics ──────────────────────────────────────────────────────────
export const controlledResponses = new Counter("controlled_responses");
export const expectedAuthBlocks = new Counter("expected_auth_blocks");
export const expectedRateLimits = new Counter("expected_rate_limits");
export const unexpected5xx = new Counter("unexpected_5xx");
export const businessFailures = new Counter("business_failures");
export const controlledRate = new Rate("controlled_rate");

// ─── URL + header helpers ────────────────────────────────────────────────────
export function url(path) {
  if (!path) return BASE_URL;
  if (path.startsWith("http")) return path;
  return `${BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export function jsonHeaders() {
  return { "Content-Type": "application/json", Accept: "application/json" };
}

export function authHeaders(role) {
  const headers = jsonHeaders();
  const token = TOKENS[role];
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export function safeParse(res) {
  try { return res.json(); } catch { return null; }
}

// ─── Response classification ─────────────────────────────────────────────────

/**
 * Classify a response into the right bucket and run a check.
 *
 * opts = {
 *   name: string                    — label for the check
 *   role?: "buyer"|"vendor"|"admin" — used to decide if 401/403 is expected
 *   privateEndpoint?: boolean       — if true, 401/403 without token = expected_auth_blocks
 *   allowRateLimit?: boolean        — if true, 429 = expected_rate_limits (PASS)
 *   allow404?: boolean              — if true, 404 = controlled (e.g. backend module missing)
 *   expectedStatuses?: number[]     — explicit list of statuses to treat as controlled
 *                                     (e.g. [400,401,423] for invalid-login probe)
 * }
 *
 * Returns true if the response is considered "controlled" (i.e. PASS).
 */
export function classifyResponse(res, opts) {
  const status = res.status;
  const name = opts?.name ?? "request";
  const role = opts?.role;
  const privateEndpoint = !!opts?.privateEndpoint;
  const allowRateLimit = !!opts?.allowRateLimit;
  const allow404 = !!opts?.allow404;
  const expectedStatuses = Array.isArray(opts?.expectedStatuses) ? opts.expectedStatuses : [];
  const hasToken = role ? !!TOKENS[role] : false;

  let controlled = false;
  let category = "uncategorized";

  if (status >= 500) {
    unexpected5xx.add(1);
    category = "unexpected_5xx";
  } else if (expectedStatuses.includes(status)) {
    controlledResponses.add(1);
    controlled = true;
    category = `expected_${status}`;
  } else if (status === 429) {
    if (allowRateLimit) {
      expectedRateLimits.add(1);
      controlled = true;
      category = "expected_rate_limit";
    } else {
      // Unexpected throttling under low VUs is a real concern
      businessFailures.add(1);
      category = "unexpected_429";
    }
  } else if (status === 401 || status === 403) {
    // Expected when accessing private endpoint without token / with wrong role
    if (privateEndpoint && !hasToken) {
      expectedAuthBlocks.add(1);
      controlled = true;
      category = "expected_auth_block";
    } else if (privateEndpoint && hasToken) {
      // Token present but rejected — real failure (token expired? wrong role?)
      businessFailures.add(1);
      category = "auth_failure";
    } else {
      // Public endpoint returning 401/403 — backend misconfiguration
      businessFailures.add(1);
      category = "unexpected_auth";
    }
  } else if (status === 404 && allow404) {
    controlled = true;
    category = "expected_404";
    controlledResponses.add(1);
  } else if (status >= 200 && status < 400) {
    controlled = true;
    category = "ok";
    controlledResponses.add(1);
  } else {
    businessFailures.add(1);
    category = `business_${status}`;
  }

  controlledRate.add(controlled);

  // Run k6 check so the iteration is marked correctly
  check(res, {
    [`${name} controlled (${category}, status=${status})`]: () => controlled,
    [`${name} no 5xx`]: (r) => r.status < 500,
  });

  return controlled;
}

// ─── Scenario skipping ───────────────────────────────────────────────────────

export function hasToken(role) {
  return !!TOKENS[role];
}

/**
 * If the required token is missing, log a SKIPPED message once and return false.
 * Use at the top of a scenario function.
 */
export function requireTokenOrSkip(role, scenarioName) {
  if (!TOKENS[role]) {
    if (__VU === 1 && __ITER === 0) {
      // eslint-disable-next-line no-console
      console.warn(`⚠ SKIPPED: ${scenarioName} (K6_${role.toUpperCase()}_TOKEN not set)`);
    }
    return false;
  }
  return true;
}
