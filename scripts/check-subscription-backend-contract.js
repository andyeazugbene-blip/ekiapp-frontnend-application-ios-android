#!/usr/bin/env node
/**
 * Verifies the subscription backend contract against a real test account.
 *
 * Required:
 *   SUBSCRIPTION_TEST_TOKEN=<vendor auth token>
 *
 * Optional:
 *   SUBSCRIPTION_TEST_API_URL=https://italian-market-place.vercel.app
 *   SUBSCRIPTION_TEST_ALLOW_MUTATION=true
 *
 * Without SUBSCRIPTION_TEST_ALLOW_MUTATION=true this script verifies read-only
 * entitlement endpoints and skips POST /activate checks.
 */
const API_URL =
  process.env.SUBSCRIPTION_TEST_API_URL ||
  process.env.EXPO_PUBLIC_API_URL ||
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  "https://italian-market-place.vercel.app";
const TOKEN = process.env.SUBSCRIPTION_TEST_TOKEN;
const ALLOW_MUTATION = process.env.SUBSCRIPTION_TEST_ALLOW_MUTATION === "true";

const failures = [];
const skipped = [];

function endpoint(path) {
  return `${API_URL.replace(/\/$/, "")}${path}`;
}

async function request(path, options = {}) {
  const response = await fetch(endpoint(path), {
    ...options,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${TOKEN}`,
      ...(options.headers || {}),
    },
  });

  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  return { response, body };
}

function pass(label) {
  console.log(`PASS ${label}`);
}

function fail(label, detail) {
  failures.push(`${label}: ${detail}`);
  console.error(`FAIL ${label}: ${detail}`);
}

function skip(label, detail) {
  skipped.push(`${label}: ${detail}`);
  console.warn(`SKIP ${label}: ${detail}`);
}

function hasPlanPayload(body) {
  const payload = body?.subscription ?? body;
  const plan = payload?.plan ?? payload?.planId ?? payload?.slug;
  return typeof plan === "string" && plan.length > 0;
}

function hasLimitsPayload(body) {
  const payload = body?.limits ?? body;
  return (
    payload &&
    (typeof payload.maxProducts === "number" || typeof payload.canSendOffers === "boolean") &&
    (typeof payload.currentProducts === "number" || typeof body?.currentProducts === "number")
  );
}

async function verifyReadEndpoints() {
  const me = await request("/api/subscriptions/me");
  if (!me.response.ok) {
    fail("GET /api/subscriptions/me", `expected 2xx, got ${me.response.status}`);
  } else if (!hasPlanPayload(me.body)) {
    fail("GET /api/subscriptions/me", "response does not include a backend plan payload");
  } else {
    pass("GET /api/subscriptions/me returns subscription status from backend");
  }

  const limits = await request("/api/subscriptions/me/limits");
  if (!limits.response.ok) {
    fail("GET /api/subscriptions/me/limits", `expected 2xx, got ${limits.response.status}`);
  } else if (!hasLimitsPayload(limits.body)) {
    fail("GET /api/subscriptions/me/limits", "response does not include plan limits");
  } else {
    pass("GET /api/subscriptions/me/limits returns server-side limits");
  }
}

async function verifyActivationContract() {
  if (!ALLOW_MUTATION) {
    skip(
      "POST /api/subscriptions/activate",
      "set SUBSCRIPTION_TEST_ALLOW_MUTATION=true with a disposable test vendor to verify activation behavior"
    );
    return;
  }

  const paid = await request("/api/subscriptions/activate", {
    method: "POST",
    body: JSON.stringify({ plan: "GROWTH" }),
  });
  const paidCode = paid.body?.code ?? paid.body?.errorCode;
  if (paid.response.status !== 409 || paidCode !== "SUBSCRIPTIONS_NOT_AVAILABLE") {
    fail(
      "paid activate from app",
      `expected 409 SUBSCRIPTIONS_NOT_AVAILABLE, got ${paid.response.status} ${paidCode || ""}`.trim()
    );
  } else {
    pass("paid activate from app returns 409 SUBSCRIPTIONS_NOT_AVAILABLE");
  }

  const free = await request("/api/subscriptions/activate", {
    method: "POST",
    body: JSON.stringify({ plan: "FREE" }),
  });
  if (!free.response.ok) {
    fail("free activate", `expected 2xx, got ${free.response.status}`);
  } else if (!hasPlanPayload(free.body)) {
    fail("free activate", "response does not include activated subscription payload");
  } else {
    pass("free activate works");
  }
}

async function main() {
  if (!TOKEN) {
    console.error("Missing SUBSCRIPTION_TEST_TOKEN for backend contract verification.");
    process.exit(2);
  }

  console.log(`Checking subscription backend contract at ${API_URL}`);
  await verifyReadEndpoints();
  await verifyActivationContract();

  if (failures.length > 0) {
    console.error(`\nSubscription backend contract check failed with ${failures.length} issue(s).`);
    process.exit(1);
  }

  if (skipped.length > 0) {
    console.warn(`\nSubscription backend contract check passed read-only checks with ${skipped.length} skipped mutation check(s).`);
    process.exit(3);
  }

  console.log("\nSubscription backend contract check passed.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
