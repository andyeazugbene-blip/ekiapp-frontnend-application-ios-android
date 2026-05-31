/**
 * Admin dashboard read-only endpoints.
 *
 * Behavior:
 *  - If K6_ADMIN_TOKEN is missing, SKIPS (1 VU, 1 iteration, logs and exits).
 *  - If K6_ADMIN_TOKEN is present, runs the full admin readonly flow.
 *
 * Load: ramp 1→5 VUs over 30s, hold 2 min, ramp down 30s.
 *
 * Thresholds (production-safe):
 *  - unexpected_5xx must be 0
 *  - controlled_rate > 0.95
 *  - p95 < 1500
 */
import http from "k6/http";
import { sleep, group } from "k6";
import { textSummary } from "https://jslib.k6.io/k6-summary/0.0.2/index.js";
import { url, authHeaders, hasToken, classifyResponse } from "./helpers.js";

const ADMIN_TOKEN_PRESENT = hasToken("admin");

export const options = ADMIN_TOKEN_PRESENT
  ? {
      stages: [
        { duration: "30s", target: 5 },
        { duration: "2m", target: 5 },
        { duration: "30s", target: 0 },
      ],
      thresholds: {
        "unexpected_5xx": ["count<1"],
        "controlled_rate": ["rate>0.95"],
        "http_req_duration": ["p(95)<1500"],
      },
    }
  : {
      vus: 1,
      iterations: 1,
      thresholds: { "unexpected_5xx": ["count<1"] },
    };

const adminHeaders = authHeaders("admin");

export function setup() {
  if (!ADMIN_TOKEN_PRESENT) {
    console.warn("⚠ SKIPPED: admin-readonly (K6_ADMIN_TOKEN not set)");
  } else {
    console.log("✓ K6_ADMIN_TOKEN present — running admin readonly flow.");
  }
  return { adminTokenPresent: ADMIN_TOKEN_PRESENT };
}

export default function (data) {
  if (!data.adminTokenPresent) return;

  group("admin", () => {
    const me = http.get(url("/auth/me"), { headers: adminHeaders, tags: { kind: "auth" } });
    classifyResponse(me, { name: "GET /auth/me", privateEndpoint: true, role: "admin" });

    const dashboard = http.get(url("/admin/dashboard"), { headers: adminHeaders, tags: { kind: "admin" } });
    classifyResponse(dashboard, { name: "GET /admin/dashboard", privateEndpoint: true, role: "admin" });

    const orders = http.get(url("/admin/orders?page=1"), { headers: adminHeaders, tags: { kind: "admin" } });
    classifyResponse(orders, { name: "GET /admin/orders", privateEndpoint: true, role: "admin" });

    const vendors = http.get(url("/admin/vendors?page=1"), { headers: adminHeaders, tags: { kind: "admin" } });
    classifyResponse(vendors, { name: "GET /admin/vendors", privateEndpoint: true, role: "admin" });

    const users = http.get(url("/admin/users?page=1"), { headers: adminHeaders, tags: { kind: "admin" } });
    classifyResponse(users, { name: "GET /admin/users", privateEndpoint: true, role: "admin" });

    const analytics = http.get(url("/admin/analytics/revenue?range=30d"), { headers: adminHeaders, tags: { kind: "admin" } });
    classifyResponse(analytics, { name: "GET /admin/analytics/revenue", privateEndpoint: true, role: "admin" });
  });

  sleep(Math.random() * 2 + 1);
}

export function handleSummary(data) {
  return {
    stdout: textSummary(data, { indent: " ", enableColors: true }),
    "performance/results/k6-summary.json": JSON.stringify(data, null, 2),
  };
}
