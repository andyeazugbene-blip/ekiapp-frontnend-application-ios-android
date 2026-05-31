/**
 * Rate limiter sanity test.
 *
 * Hits read endpoints in a quick burst to verify the backend's rate limiter
 * returns controlled 429 responses (not 5xx errors).
 *
 * Load: max 5 VUs, 30 seconds.
 *
 * Thresholds:
 *  - unexpected_5xx must be 0 (rate limiter must not break the service)
 *  - controlled_rate > 0.99 (every response must be controlled — including 429)
 *
 * 429 is treated as PASS via classifyResponse({ allowRateLimit: true }).
 */
import http from "k6/http";
import { sleep } from "k6";
import { textSummary } from "https://jslib.k6.io/k6-summary/0.0.2/index.js";
import { url, jsonHeaders, classifyResponse } from "./helpers.js";

export const options = {
  vus: 5,
  duration: "30s",
  thresholds: {
    "unexpected_5xx": ["count<1"],
    "controlled_rate": ["rate>0.99"],
    "http_req_duration": ["p(95)<2000"],
  },
};

const HEADERS = jsonHeaders();

export default function () {
  // Burst: rapid GET /products
  for (let i = 0; i < 3; i++) {
    const r = http.get(url("/products?limit=20"), { headers: HEADERS, tags: { kind: "burst" } });
    classifyResponse(r, { name: "burst GET /products", allowRateLimit: true });
  }

  // Light auth-fail probe — only 1 invalid login per VU per iteration to stay safe
  const loginRes = http.post(
    url("/auth/login"),
    JSON.stringify({ email: `k6_qa_invalid_${__VU}@example.invalid`, password: "wrong-password" }),
    { headers: HEADERS, tags: { kind: "auth-fail" } }
  );
  // For invalid credentials, 400/401/422/423 are all expected controlled
  // responses; 429 is also acceptable under burst.
  classifyResponse(loginRes, {
    name: "POST /auth/login (invalid creds)",
    expectedStatuses: [400, 401, 422, 423],
    allowRateLimit: true,
  });

  sleep(0.5);
}

export function handleSummary(data) {
  return {
    stdout: textSummary(data, { indent: " ", enableColors: true }),
    "performance/results/k6-summary.json": JSON.stringify(data, null, 2),
  };
}
