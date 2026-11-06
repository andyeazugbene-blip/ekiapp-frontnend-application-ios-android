// Regular Delivery stage 5 against the local verification database only.
const path = require("path");
const BACKEND = process.env.EKI_BACKEND_DIR || path.resolve(__dirname, "../../../../ekiapp-backend-main");
const req = (m) => require(path.join(BACKEND, "node_modules", m));
req("dotenv").config({ path: path.join(BACKEND, ".env") });
if (!/localhost:5544\/eki_verify/.test(process.env.DATABASE_URL || "")) throw new Error("Refusing to run: not the verification DB");
const { PrismaClient } = req("@prisma/client");
const jwt = req("jsonwebtoken");
const prisma = new PrismaClient();
const HOST = "http://localhost:4177";
const API = HOST + "/api";
const run = Date.now().toString(36);
let pass = 0, fail = 0;
const check = (n, ok, d) => { if (ok) { pass++; console.log("  PASS " + n); } else { fail++; console.log("  FAIL " + n + " -> " + String(JSON.stringify(d)).slice(0, 300)); } };
async function call(method, p, token, body) {
  const res = await fetch(API + p, { method, headers: { "content-type": "application/json", ...(token ? { authorization: "Bearer " + token } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text(); let json; try { json = JSON.parse(text); } catch { json = { raw: text.slice(0, 200) }; }
  return { status: res.status, body: json };
}
const tokenFor = (u) => jwt.sign({ sub: u.id, role: u.role, email: u.email, tv: u.tokenVersion }, process.env.JWT_SECRET, { expiresIn: "2h" });

(async () => {
  const adminUser = await prisma.user.findUniqueOrThrow({ where: { email: "seed_qa_admin@example.com" } });
  const superRole = await prisma.adminRole.findUniqueOrThrow({ where: { name: "Super Administrator" } });
  await prisma.adminRoleAssignment.upsert({ where: { roleId_userId: { roleId: superRole.id, userId: adminUser.id } }, create: { roleId: superRole.id, userId: adminUser.id }, update: {} });
  const admin = tokenFor(adminUser);
  const buyer = await prisma.user.create({ data: { email: `rdbuyer.${run}@example.test`, password: "x", name: "RD Buyer", country: "United Kingdom", role: "BUYER", emailVerifiedAt: new Date() } });
  const other = await prisma.user.create({ data: { email: `rdother.${run}@example.test`, password: "x", name: "RD Other", country: "United Kingdom", role: "BUYER", emailVerifiedAt: new Date() } });
  const vendorUser = await prisma.user.create({ data: { email: `rdvendor.${run}@example.test`, password: "x", name: "RD Vendor", country: "United Kingdom", role: "VENDOR", emailVerifiedAt: new Date() } });
  const vendor = await prisma.vendor.create({ data: { userId: vendorUser.id, storeName: "RD Store " + run, storeSlug: "rd-store-" + run } });
  const mk = (title, price) => prisma.product.create({ data: { vendorId: vendor.id, title: title + " " + run, description: title, priceInCents: price, currency: "GBP", stock: 100 } }).catch(async (e) => { console.log(String(e.message).slice(-500)); throw e; });
  const yam = await mk("Yam", 1200);
  const rice = await mk("Rice", 500);
  const address = await prisma.buyerAddress.create({ data: { buyerId: buyer.id, recipientName: "RD Buyer", line1: "1 Road", city: "London", postalCode: "SW1A 1AA", country: "United Kingdom" } }).catch(async (e) => { console.log(String(e.message).slice(-400)); throw e; });
  const offer = await prisma.subscriptionOffer.create({ data: { vendorId: vendor.id, title: "Box " + run, frequencies: ["MONTHLY"] } });
  const sub = await prisma.buyerSubscription.create({ data: { buyerId: buyer.id, offerId: offer.id, status: "ACTIVE", frequency: "MONTHLY", deliveryAddressId: address.id, nextRenewalAt: new Date(Date.now() + 3 * 864e5), items: { create: [{ productId: yam.id, quantity: 2 }, { productId: rice.id, quantity: 1 }] } } });
  const pcr = await prisma.priceChangeRequest.create({ data: { previousUnitPrice: 1000, proposedUnitPrice: 1200, percentageDifference: 20, approvalLimitBps: 500, approvalRequired: true } });
  const renewal = await prisma.renewal.create({
    data: { subscriptionId: sub.id, cycleDate: new Date(Date.now() + 3 * 864e5), status: "AWAITING_PRICE_APPROVAL", priceChangeRequestId: pcr.id, subtotalAmount: 2900, currency: "GBP",
      items: { create: [{ productId: yam.id, quantity: 2, previousUnitPrice: 1000, currentUnitPrice: 1200 }, { productId: rice.id, quantity: 1, previousUnitPrice: 500, currentUnitPrice: 500 }] } },
  });

  console.log("\n=== S46 PRICE CHANGE");
  let r = await call("GET", `/buyer/subscriptions/${sub.id}`, tokenFor(buyer));
  const shown = (r.body.subscription || r.body).renewals?.[0]?.items || [];
  check(`detail shows the renewal's items and prices [${r.status}]`, shown.length === 2 && shown.some((i) => i.currentUnitPrice === 1200 && i.previousUnitPrice === 1000 && i.product?.title), r.body);
  r = await call("POST", `/renewals/${renewal.id}/remove-item`, tokenFor(other), { productId: yam.id });
  check(`another buyer can't [${r.status}]`, r.status === 404, r.body);
  r = await call("POST", `/renewals/${renewal.id}/remove-item`, tokenFor(buyer), {});
  check(`needs a product [${r.status}]`, r.status === 400, r.body);
  r = await call("POST", `/renewals/${renewal.id}/remove-item`, tokenFor(buyer), { productId: yam.id });
  check(`buyer removes the changed item [${r.status}]`, r.status === 200, r.body);
  const after = await prisma.renewal.findUnique({ where: { id: renewal.id }, include: { items: true } });
  check("renewal can now pay, at the lower total", after.status === "READY_FOR_PAYMENT" && after.subtotalAmount === 500 && after.items.length === 1, after);
  check("it's gone from future renewals too", (await prisma.subscriptionItem.count({ where: { subscriptionId: sub.id, productId: yam.id } })) === 0);
  check("the rest of the basket stays", (await prisma.subscriptionItem.count({ where: { subscriptionId: sub.id, productId: rice.id } })) === 1);
  check("decision recorded", (await prisma.priceChangeRequest.findUnique({ where: { id: pcr.id } })).buyerDecision === "accepted");
  r = await call("POST", `/renewals/${renewal.id}/remove-item`, tokenFor(buyer), { productId: rice.id });
  check(`can't change it once decided [${r.status}]`, r.status === 409, r.body);

  console.log("\n=== S57 RECEIPT");
  r = await call("POST", `/renewals/${renewal.id}/receipt-link`, tokenFor(buyer), {});
  check(`no receipt before an order [${r.status}]`, r.status === 409 && r.body.code === "RECEIPT_NOT_AVAILABLE", r.body);
  const order = await prisma.order.create({ data: { buyerId: buyer.id, vendorId: vendor.id, subtotalAmount: 450, deliveryFeeAmount: 300, totalAmount: 750, currency: "GBP" } }).catch(async (e) => { console.log(String(e.message).slice(-500)); throw e; });
  await prisma.renewal.update({ where: { id: renewal.id }, data: { orderId: order.id, status: "ORDER_CREATED" } });
  r = await call("POST", `/renewals/${renewal.id}/receipt-link`, tokenFor(other), {});
  check(`another buyer can't get the link [${r.status}]`, r.status === 404, r.body);
  r = await call("POST", `/renewals/${renewal.id}/receipt-link`, tokenFor(buyer), {});
  check(`buyer gets the link [${r.status}]`, r.status === 200, r.body);
  const res = await fetch(HOST + new URL(r.body.url).pathname);
  const html = await res.text();
  check("receipt shows the client's fields", res.status === 200 && ["Regular Delivery receipt", "RD Store " + run, "Order reference", "Renewal reference", "Rice " + run, "£7.50", "£0.50"].every((t) => html.includes(t)), html.slice(0, 300));
  check("no payment yet, so it doesn't say paid", !html.includes("Total paid") && html.includes("Payment under review"), html.slice(0, 120));

  console.log("\n=== S58 AND S59");
  r = await call("GET", "/admin/subscriptions/operations-summary", tokenFor(buyer));
  check("buyer refused", r.status === 403, r.status);
  r = await call("GET", "/admin/subscriptions/operations-summary", admin);
  check(`tiles load [${r.status}]`, r.status === 200 && r.body.activeSubscriptions >= 1 && ["upcomingRenewals", "paymentsUnderReview", "failedRenewalPayments", "priceApprovalsOutstanding", "subscriptionExceptions"].every((k) => typeof r.body[k] === "number"), r.body);
  for (const [label, q] of [["renewal reference", renewal.id], ["order id", order.id], ["order number", order.orderNumber], ["subscription reference", sub.id]]) {
    r = await call("GET", `/admin/subscriptions?q=${encodeURIComponent(q)}`, admin);
    const items = r.body.items || r.body.subscriptions || r.body.rows || [];
    check(`finds by ${label}`, items.some((s) => s.id === sub.id), { status: r.status, keys: Object.keys(r.body) });
  }

  console.log(`\nRESULT ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
