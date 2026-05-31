/**
 * Smoke test — verify core public endpoints respond correctly.
 *
 * Load: 1 VU for 30 seconds.
 *
 * Thresholds (production-safe):
 *  - unexpected_5xx must be 0 (a single 5xx fails the run)
 *  - p95 < 1000ms
 *  - controlled_rate > 0.95 (>= 95% of responses are 2xx/3xx or expected 4xx)
 *
 * Note: we do NOT use http_req_failed as a threshold here because k6 counts
 * any non-2xx (e.g. expected 401/404) as a "failure". We rely on the custom
 * controlled_rate / unexpected_5xx metrics instead.
 */
import http from "k6/http";
import { sleep } from "k6";
import { textSummary } from "https://jslib.k6.io/k6-summary/0.0.2/index.js";
import { BASE_URL, IDS, jsonHeaders, url, classifyResponse } from "./helpers.js";

export const options = {
  vus: 1,
  duration: "30s",
  thresholds: {
    "unexpected_5xx": ["count<1"],
    "controlled_rate": ["rate>0.95"],
    "http_req_duration": ["p(95)<1000"],
    "http_req_duration{kind:health}": ["p(95)<500"],
  },
};

const HEADERS = jsonHeaders();

export default function () {
  // ── Health (must be 2xx) ───────────────────────────────────────────────────
  const h1 = http.get(url("/health"), { headers: HEADERS, tags: { kind: "health" } });
  classifyResponse(h1, { name: "GET /health" });

  const h2 = http.get(url("/health/detailed"), { headers: HEADERS, tags: { kind: "health" } });
  classifyResponse(h2, { name: "GET /health/detailed" });

  // ── Public catalog (must be 2xx) ───────────────────────────────────────────
  const p1 = http.get(url("/products?limit=20"), { headers: HEADERS, tags: { kind: "products" } });
  classifyResponse(p1, { name: "GET /products" });

  if (IDS.productId) {
    const p2 = http.get(url(`/products/${IDS.productId}`), { headers: HEADERS, tags: { kind: "product" } });
    classifyResponse(p2, { name: "GET /products/:id", allow404: true });
  }

  // ── Vendors (may require auth on some backends — tolerate 401/403) ────────
  const v1 = http.get(url("/vendors"), { headers: HEADERS, tags: { kind: "vendors" } });
  classifyResponse(v1, { name: "GET /vendors", privateEndpoint: true, role: "buyer", allow404: true });

  // ── Reviews (allow 404 if module not yet deployed) ────────────────────────
  if (IDS.productId) {
    const r1 = http.get(url(`/reviews?productId=${IDS.productId}`), { headers: HEADERS, tags: { kind: "reviews" } });
    classifyResponse(r1, { name: "GET /reviews?productId", allow404: true });
  }

  // ── OpenAPI spec lives at /openapi.json under the host (not /api) ─────────
  const baseHost = BASE_URL.replace(/\/api$/, "");
  const o1 = http.get(`${baseHost}/openapi.json`, { headers: HEADERS, tags: { kind: "openapi" } });
  classifyResponse(o1, { name: "GET /openapi.json", allow404: true });

  sleep(1);
}

export function handleSummary(data) {
  return {
    stdout: textSummary(data, { indent: " ", enableColors: true }),
    "performance/results/k6-summary.json": JSON.stringify(data, null, 2),
  };
}
