/**
 * Vendor dashboard read-heavy flow.
 *
 * Behavior:
 *  - If K6_VENDOR_TOKEN is missing, the test SKIPS (1 VU, 1 iteration that
 *    logs SKIPPED and exits clean — no private endpoints called).
 *  - If K6_VENDOR_TOKEN is present, runs the full authenticated read flow.
 *
 * Load: ramp 1→10 VUs in 1 min, hold 2 min, ramp down 1 min.
 *
 * Thresholds (production-safe):
 *  - unexpected_5xx must be 0
 *  - controlled_rate > 0.95
 *  - p95 < 1200, p99 < 2500
 */
import http from "k6/http";
import { sleep, group } from "k6";
import { textSummary } from "https://jslib.k6.io/k6-summary/0.0.2/index.js";
import { url, authHeaders, IDS, hasToken, classifyResponse } from "./helpers.js";

const VENDOR_TOKEN_PRESENT = hasToken("vendor");

export const options = VENDOR_TOKEN_PRESENT
  ? {
      stages: [
        { duration: "1m", target: 10 },
        { duration: "2m", target: 10 },
        { duration: "1m", target: 0 },
      ],
      thresholds: {
        "unexpected_5xx": ["count<1"],
        "controlled_rate": ["rate>0.95"],
        "http_req_duration": ["p(95)<1200", "p(99)<2500"],
      },
    }
  : {
      // Skip mode — 1 VU, 1 iteration that just logs and exits.
      vus: 1,
      iterations: 1,
      thresholds: { "unexpected_5xx": ["count<1"] },
    };

const vendorHeaders = authHeaders("vendor");

export function setup() {
  if (!VENDOR_TOKEN_PRESENT) {
    console.warn("⚠ SKIPPED: vendor-flow (K6_VENDOR_TOKEN not set)");
  } else {
    console.log("✓ K6_VENDOR_TOKEN present — running full authenticated vendor flow.");
  }
  return { vendorTokenPresent: VENDOR_TOKEN_PRESENT };
}

export default function (data) {
  if (!data.vendorTokenPresent) {
    // Skip cleanly — no requests made.
    return;
  }

  group("auth", () => {
    const me = http.get(url("/auth/me"), { headers: vendorHeaders, tags: { kind: "auth" } });
    classifyResponse(me, { name: "GET /auth/me", privateEndpoint: true, role: "vendor" });
  });

  group("vendor-profile", () => {
    const profile = http.get(url("/vendors/me"), { headers: vendorHeaders, tags: { kind: "vendor" } });
    classifyResponse(profile, { name: "GET /vendors/me", privateEndpoint: true, role: "vendor" });

    const dashboard = http.get(url("/vendors/me/dashboard"), { headers: vendorHeaders, tags: { kind: "vendor" } });
    classifyResponse(dashboard, { name: "GET /vendors/me/dashboard", privateEndpoint: true, role: "vendor" });
  });

  group("vendor-data", () => {
    const orders = http.get(url("/vendors/me/orders"), { headers: vendorHeaders, tags: { kind: "vendor" } });
    classifyResponse(orders, { name: "GET /vendors/me/orders", privateEndpoint: true, role: "vendor" });

    const buyers = http.get(url("/vendors/me/buyers"), { headers: vendorHeaders, tags: { kind: "vendor" } });
    classifyResponse(buyers, { name: "GET /vendors/me/buyers", privateEndpoint: true, role: "vendor" });

    const revenue = http.get(url("/vendors/me/analytics/revenue?range=30d"), {
      headers: vendorHeaders,
      tags: { kind: "vendor-analytics" },
    });
    classifyResponse(revenue, { name: "GET /vendors/me/analytics/revenue", privateEndpoint: true, role: "vendor" });

    if (IDS.vendorId) {
      const products = http.get(url(`/products?vendorId=${IDS.vendorId}`), {
        headers: vendorHeaders,
        tags: { kind: "vendor-products" },
      });
      classifyResponse(products, { name: "GET /products?vendorId" });
    }
  });

  sleep(Math.random() * 2 + 1);
}

export function handleSummary(data) {
  return {
    stdout: textSummary(data, { indent: " ", enableColors: true }),
    "performance/results/k6-summary.json": JSON.stringify(data, null, 2),
  };
}
