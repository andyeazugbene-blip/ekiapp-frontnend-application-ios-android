/**
 * Realistic low-volume mixed read traffic.
 *
 * Traffic mix (when all tokens present):
 *   60% public product browsing
 *   20% buyer authenticated reads
 *   15% vendor dashboard reads
 *    5% admin readonly
 *
 * If a role's token is missing, that scenario is set to 0 VUs (skipped).
 * public_browse always runs.
 *
 * Load:
 *   ramp 1 → 20 VUs over 2 min
 *   hold 20 VUs for 3 min
 *   ramp down 1 min
 *
 * Thresholds (production-safe):
 *   unexpected_5xx == 0
 *   controlled_rate > 0.98
 *   p95 < 1500ms, p99 < 3000ms
 */
import http from "k6/http";
import { sleep, group } from "k6";
import { textSummary } from "https://jslib.k6.io/k6-summary/0.0.2/index.js";
import { url, authHeaders, jsonHeaders, IDS, hasToken, classifyResponse } from "./helpers.js";

const BUYER_OK = hasToken("buyer");
const VENDOR_OK = hasToken("vendor");
const ADMIN_OK = hasToken("admin");

function stages(target) {
  return [
    { duration: "2m", target },
    { duration: "3m", target },
    { duration: "1m", target: 0 },
  ];
}

export const options = {
  scenarios: {
    public_browse: {
      executor: "ramping-vus",
      exec: "publicBrowse",
      startVUs: 1,
      stages: stages(12), // 60% of 20
      gracefulRampDown: "30s",
    },
    buyer_reads: {
      executor: "ramping-vus",
      exec: "buyerReads",
      startVUs: 0,
      stages: stages(BUYER_OK ? 4 : 0),
      gracefulRampDown: "30s",
    },
    vendor_reads: {
      executor: "ramping-vus",
      exec: "vendorReads",
      startVUs: 0,
      stages: stages(VENDOR_OK ? 3 : 0),
      gracefulRampDown: "30s",
    },
    admin_reads: {
      executor: "ramping-vus",
      exec: "adminReads",
      startVUs: 0,
      stages: stages(ADMIN_OK ? 1 : 0),
      gracefulRampDown: "30s",
    },
  },
  thresholds: {
    "unexpected_5xx": ["count<1"],
    "controlled_rate": ["rate>0.98"],
    "http_req_duration": ["p(95)<1500", "p(99)<3000"],
  },
};

const publicHeaders = jsonHeaders();
const buyerHeaders = authHeaders("buyer");
const vendorHeaders = authHeaders("vendor");
const adminHeaders = authHeaders("admin");

export function setup() {
  console.log(`scenario-mixed-read tokens: buyer=${BUYER_OK} vendor=${VENDOR_OK} admin=${ADMIN_OK}`);
  if (!BUYER_OK) console.warn("⚠ SKIPPED scenario: buyer_reads (no K6_BUYER_TOKEN)");
  if (!VENDOR_OK) console.warn("⚠ SKIPPED scenario: vendor_reads (no K6_VENDOR_TOKEN)");
  if (!ADMIN_OK) console.warn("⚠ SKIPPED scenario: admin_reads (no K6_ADMIN_TOKEN)");
}

export function publicBrowse() {
  group("public-browse", () => {
    const list = http.get(url("/products?limit=20"), { headers: publicHeaders, tags: { kind: "catalog" } });
    classifyResponse(list, { name: "GET /products" });

    if (IDS.productId) {
      const detail = http.get(url(`/products/${IDS.productId}`), { headers: publicHeaders, tags: { kind: "catalog" } });
      classifyResponse(detail, { name: "GET /products/:id", allow404: true });
    }

    const search = http.get(url("/products?search=garri"), { headers: publicHeaders, tags: { kind: "search" } });
    classifyResponse(search, { name: "GET /products?search" });
  });
  sleep(Math.random() * 3 + 1);
}

export function buyerReads() {
  group("buyer-reads", () => {
    const cart = http.get(url("/cart"), { headers: buyerHeaders, tags: { kind: "buyer" } });
    classifyResponse(cart, { name: "GET /cart", privateEndpoint: true, role: "buyer" });

    const orders = http.get(url("/orders/me"), { headers: buyerHeaders, tags: { kind: "buyer" } });
    classifyResponse(orders, { name: "GET /orders/me", privateEndpoint: true, role: "buyer" });

    const wallet = http.get(url("/wallet/me"), { headers: buyerHeaders, tags: { kind: "buyer" } });
    classifyResponse(wallet, { name: "GET /wallet/me", privateEndpoint: true, role: "buyer" });
  });
  sleep(Math.random() * 3 + 2);
}

export function vendorReads() {
  group("vendor-reads", () => {
    const dashboard = http.get(url("/vendors/me/dashboard"), { headers: vendorHeaders, tags: { kind: "vendor" } });
    classifyResponse(dashboard, { name: "GET /vendors/me/dashboard", privateEndpoint: true, role: "vendor" });

    const orders = http.get(url("/vendors/me/orders"), { headers: vendorHeaders, tags: { kind: "vendor" } });
    classifyResponse(orders, { name: "GET /vendors/me/orders", privateEndpoint: true, role: "vendor" });
  });
  sleep(Math.random() * 4 + 2);
}

export function adminReads() {
  group("admin-reads", () => {
    const dashboard = http.get(url("/admin/dashboard"), { headers: adminHeaders, tags: { kind: "admin" } });
    classifyResponse(dashboard, { name: "GET /admin/dashboard", privateEndpoint: true, role: "admin" });
  });
  sleep(Math.random() * 5 + 3);
}

export function handleSummary(data) {
  return {
    stdout: textSummary(data, { indent: " ", enableColors: true }),
    "performance/results/k6-summary.json": JSON.stringify(data, null, 2),
  };
}
