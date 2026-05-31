/**
 * Buyer read-heavy flow.
 *
 * Behavior:
 *  - If K6_BUYER_TOKEN is missing, runs ONLY the public catalog reads
 *    (no private buyer endpoints are called → no false 401 noise).
 *  - If K6_BUYER_TOKEN is present, runs the full authenticated read flow.
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
import { url, authHeaders, jsonHeaders, IDS, hasToken, classifyResponse } from "./helpers.js";

export const options = {
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
};

const buyerHeaders = authHeaders("buyer");
const publicHeaders = jsonHeaders();
const BUYER_TOKEN_PRESENT = hasToken("buyer");

export function setup() {
  if (!BUYER_TOKEN_PRESENT) {
    console.warn("⚠ K6_BUYER_TOKEN not set — buyer-flow will only run PUBLIC reads.");
  } else {
    console.log("✓ K6_BUYER_TOKEN present — running full authenticated buyer flow.");
  }
  return { buyerTokenPresent: BUYER_TOKEN_PRESENT };
}

export default function (data) {
  // ── Public catalog (always runs) ──────────────────────────────────────────
  group("catalog", () => {
    const list = http.get(url("/products?limit=20"), { headers: publicHeaders, tags: { kind: "catalog" } });
    classifyResponse(list, { name: "GET /products" });

    if (IDS.productId) {
      const detail = http.get(url(`/products/${IDS.productId}`), { headers: publicHeaders, tags: { kind: "catalog" } });
      classifyResponse(detail, { name: "GET /products/:id", allow404: true });
    }
  });

  // ── Authenticated reads (only if buyer token present) ────────────────────
  if (data.buyerTokenPresent) {
    group("auth", () => {
      const me = http.get(url("/auth/me"), { headers: buyerHeaders, tags: { kind: "auth" } });
      classifyResponse(me, { name: "GET /auth/me", privateEndpoint: true, role: "buyer" });
    });

    group("buyer-private", () => {
      const cart = http.get(url("/cart"), { headers: buyerHeaders, tags: { kind: "buyer" } });
      classifyResponse(cart, { name: "GET /cart", privateEndpoint: true, role: "buyer" });

      // Conditional safe POST — only if a product id is provided
      if (IDS.cartProductId) {
        const add = http.post(
          url("/cart/items"),
          JSON.stringify({ productId: IDS.cartProductId, quantity: 1 }),
          { headers: buyerHeaders, tags: { kind: "buyer-write" } }
        );
        classifyResponse(add, { name: "POST /cart/items", privateEndpoint: true, role: "buyer" });
      }

      const orders = http.get(url("/orders/me"), { headers: buyerHeaders, tags: { kind: "buyer" } });
      classifyResponse(orders, { name: "GET /orders/me", privateEndpoint: true, role: "buyer" });

      const wallet = http.get(url("/wallet/me"), { headers: buyerHeaders, tags: { kind: "buyer" } });
      classifyResponse(wallet, { name: "GET /wallet/me", privateEndpoint: true, role: "buyer" });
    });
  }

  sleep(Math.random() * 2 + 1); // 1-3s think time
}

export function handleSummary(data) {
  return {
    stdout: textSummary(data, { indent: " ", enableColors: true }),
    "performance/results/k6-summary.json": JSON.stringify(data, null, 2),
  };
}
