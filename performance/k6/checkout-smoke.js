/**
 * Checkout performance smoke — SAFE.
 *
 * Verifies the backend's create-intent path returns a Stripe clientSecret
 * within acceptable latency. Does NOT confirm any payment.
 *
 * Behavior:
 *  - If K6_BUYER_TOKEN is missing → SKIPS (logs SKIPPED, exits 0).
 *  - If K6_BUYER_TOKEN is present → runs the real flow.
 *
 * Load: 1 VU, 1 iteration.
 *
 * Thresholds:
 *  - unexpected_5xx must be 0
 *  - controlled_rate > 0.95
 *  - create-intent < 3000ms
 */
import http from "k6/http";
import { check } from "k6";
import { textSummary } from "https://jslib.k6.io/k6-summary/0.0.2/index.js";
import { url, authHeaders, IDS, hasToken, classifyResponse, safeParse } from "./helpers.js";

const BUYER_TOKEN_PRESENT = hasToken("buyer");

export const options = {
  vus: 1,
  iterations: 1,
  thresholds: {
    "unexpected_5xx": ["count<1"],
    "controlled_rate": BUYER_TOKEN_PRESENT ? ["rate>0.95"] : ["rate>=0"],
    "http_req_duration{kind:create-intent}": ["p(95)<3000"],
  },
};

const buyerHeaders = authHeaders("buyer");

export function setup() {
  if (!BUYER_TOKEN_PRESENT) {
    console.warn("⚠ SKIPPED: checkout-smoke (K6_BUYER_TOKEN not set)");
    return { skip: true };
  }
  if (!IDS.cartProductId) {
    console.warn("⚠ K6_CART_PRODUCT_ID not set — will only call GET /cart and skip add/intent.");
  }
  return { skip: false };
}

export default function (data) {
  if (data?.skip) return;

  // 1. GET /cart
  const cartRes = http.get(url("/cart"), { headers: buyerHeaders, tags: { kind: "cart" } });
  classifyResponse(cartRes, { name: "GET /cart", privateEndpoint: true, role: "buyer" });

  const cart = safeParse(cartRes);
  const cartIsEmpty = !cart?.items || cart.items.length === 0;

  // 2. Add an item if the cart is empty AND we have a product id
  if (cartIsEmpty && IDS.cartProductId) {
    const addRes = http.post(
      url("/cart/items"),
      JSON.stringify({ productId: IDS.cartProductId, quantity: 1 }),
      { headers: buyerHeaders, tags: { kind: "cart-add" } }
    );
    classifyResponse(addRes, { name: "POST /cart/items", privateEndpoint: true, role: "buyer" });
  }

  // Only continue to payment-intent if we have a product id
  if (!IDS.cartProductId) return;

  // 3. Calculate delivery (default country)
  const deliveryRes = http.post(
    url("/delivery/calculate"),
    JSON.stringify({ country: "UK" }),
    { headers: buyerHeaders, tags: { kind: "delivery-calc" } }
  );
  classifyResponse(deliveryRes, { name: "POST /delivery/calculate", privateEndpoint: true, role: "buyer" });

  // 4. Create payment intent — DO NOT CONFIRM PAYMENT
  const cartId = cart?.id || cart?.cartId || (safeParse(cartRes)?.cartId);
  const intentBody = {
    cartId,
    deliveryAddress: "K6 QA Test Address",
    deliveryCountry: "UK",
  };
  const intentRes = http.post(url("/payments/create-intent"), JSON.stringify(intentBody), {
    headers: buyerHeaders,
    tags: { kind: "create-intent" },
  });

  classifyResponse(intentRes, { name: "POST /payments/create-intent", privateEndpoint: true, role: "buyer" });

  // Extra check: clientSecret must be present
  check(intentRes, {
    "create-intent has clientSecret": (r) => {
      const body = safeParse(r);
      return !!body && typeof body.clientSecret === "string" && body.clientSecret.length > 0;
    },
  });

  // We do NOT confirm the payment intent. Stripe will auto-cancel pending intents.
}

export function handleSummary(data) {
  return {
    stdout: textSummary(data, { indent: " ", enableColors: true }),
    "performance/results/k6-summary.json": JSON.stringify(data, null, 2),
  };
}
