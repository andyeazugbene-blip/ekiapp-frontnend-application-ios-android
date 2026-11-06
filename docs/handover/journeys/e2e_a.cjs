// Subscription screens against the local verification database and Stripe test mode only.
const path = require("path");
const BACKEND = process.env.EKI_BACKEND_DIR || path.resolve(__dirname, "../../../../ekiapp-backend-main");
const req = (m) => require(path.join(BACKEND, "node_modules", m));
req("dotenv").config({ path: path.join(BACKEND, ".env") });
if (!/localhost:5544\/eki_verify/.test(process.env.DATABASE_URL || "")) throw new Error("Refusing to run: not the verification DB");
if (!(process.env.STRIPE_SECRET_KEY || "").startsWith("sk_test_")) throw new Error("Refusing to run: not a Stripe test key");
const { PrismaClient } = req("@prisma/client");
const jwt = req("jsonwebtoken");
const Stripe = req("stripe");
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const prisma = new PrismaClient();
const API = "http://localhost:4177/api";
const run = Date.now().toString(36);
let pass = 0, fail = 0;
const check = (n, ok, d) => { if (ok) { pass++; console.log("  PASS " + n); } else { fail++; console.log("  FAIL " + n + " -> " + String(JSON.stringify(d)).slice(0, 300)); } };
async function call(method, p, token, body) {
  const res = await fetch(API + p, { method, headers: { "content-type": "application/json", ...(token ? { authorization: "Bearer " + token } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text(); let json; try { json = JSON.parse(text); } catch { json = { raw: text.slice(0, 200) }; }
  return { status: res.status, body: json };
}
const tokenFor = (u) => jwt.sign({ sub: u.id, role: u.role, email: u.email, tv: u.tokenVersion }, process.env.JWT_SECRET, { expiresIn: "2h" });
let n = 0;
const user = (role = "BUYER") => prisma.user.create({ data: { email: `a${++n}.${run}@example.test`, password: "x", name: `A ${n}`, country: "United Kingdom", role, emailVerifiedAt: new Date() } });

(async () => {
  const adminUser = await prisma.user.findUniqueOrThrow({ where: { email: "seed_qa_admin@example.com" } });
  const superRole = await prisma.adminRole.findUniqueOrThrow({ where: { name: "Super Administrator" } });
  await prisma.adminRoleAssignment.upsert({ where: { roleId_userId: { roleId: superRole.id, userId: adminUser.id } }, create: { roleId: superRole.id, userId: adminUser.id }, update: {} });
  const admin = tokenFor(adminUser);
  const vu = await user("VENDOR");
  const vendor = await prisma.vendor.create({ data: { userId: vu.id, storeName: "A Store " + run, storeSlug: "a-store-" + run } });
  const otherVu = await user("VENDOR");
  await prisma.vendor.create({ data: { userId: otherVu.id, storeName: "B Store " + run, storeSlug: "b-store-" + run } });
  const yam = await prisma.product.create({ data: { vendorId: vendor.id, title: "Yam " + run, priceInCents: 1000, currency: "GBP", stock: 3, status: "PUBLISHED", isActive: true } });
  const offer = await prisma.subscriptionOffer.create({ data: { vendorId: vendor.id, title: "Box " + run, frequencies: ["MONTHLY"], products: { create: [{ productId: yam.id }] } } });
  const mkSub = async (days) => {
    const b = await user();
    const address = await prisma.buyerAddress.create({ data: { buyerId: b.id, recipientName: "A", line1: "1 Road", city: "London", postalCode: "SW1A 1AA", country: "United Kingdom" } });
    const sub = await prisma.buyerSubscription.create({ data: { buyerId: b.id, offerId: offer.id, status: "ACTIVE", frequency: "MONTHLY", deliveryAddressId: address.id, nextRenewalAt: new Date(Date.now() + days * 864e5), items: { create: [{ productId: yam.id, quantity: 2 }] } } });
    const renewal = await prisma.renewal.create({ data: { subscriptionId: sub.id, cycleDate: new Date(Date.now() + days * 864e5), status: "AWAITING_STOCK", subtotalAmount: 2000, currency: "GBP", items: { create: [{ productId: yam.id, quantity: 2, previousUnitPrice: 1000, currentUnitPrice: 1000 }] } } });
    return { b, sub, renewal };
  };
  const early = await mkSub(2);
  const late = await mkSub(5);

  console.log("\n=== S17 LIMITED STOCK");
  let r = await call("GET", "/vendor/stock-shortages", tokenFor(vu));
  const row = (r.body.items || [])[0];
  check(`shortage found with both numbers [${r.status}]`, row?.productId === yam.id && row.availableQuantity === 3 && row.requiredQuantity === 4 && row.affectedRenewals === 2, r.body);
  r = await call("POST", `/vendor/stock-shortages/${yam.id}/resolve`, tokenFor(otherVu), { mode: "earliest" });
  check(`another vendor can't touch it [${r.status}]`, r.status === 404, r.body);
  r = await call("POST", `/vendor/stock-shortages/${yam.id}/resolve`, tokenFor(vu), { mode: "nonsense" });
  check(`unknown mode refused [${r.status}]`, r.status === 400, r.body);
  r = await call("POST", `/vendor/stock-shortages/${yam.id}/resolve`, tokenFor(vu), { mode: "earliest" });
  check(`earliest gets the stock [${r.status}]`, r.status === 200 && r.body.confirmed === 1 && r.body.waiting === 1, r.body);
  const e = await prisma.renewal.findUnique({ where: { id: early.renewal.id } });
  const l = await prisma.renewal.findUnique({ where: { id: late.renewal.id }, include: { items: true } });
  check("earliest moved on", e.status !== "AWAITING_STOCK" && !!e.stockConfirmedAt, e.status);
  check("later one waits, marked short", l.status === "AWAITING_STOCK" && l.items[0].stockAvailable === false, l);
  check("waiting buyer is told before any payment", (await prisma.notification.count({ where: { userId: late.b.id, title: "Stock is limited" } })) === 1);
  check("first buyer isn't told it's limited", (await prisma.notification.count({ where: { userId: early.b.id, title: "Stock is limited" } })) === 0);
  r = await call("POST", `/vendor/stock-shortages/${yam.id}/resolve`, tokenFor(vu), { mode: "pause" });
  check(`pause takes it out of the offer [${r.status}]`, r.status === 200 && r.body.paused === 1, r.body);
  const link = await prisma.subscriptionOfferProduct.findFirst({ where: { offerId: offer.id, productId: yam.id } });
  check("offer product paused with the reason", !!link.pausedAt && link.pauseReason === "Stock is limited", link);

  console.log("\n=== S61 RECHECK PROVIDER (Stripe test mode)");
  r = await call("POST", `/admin/renewals/${late.renewal.id}/recheck-provider`, admin, {});
  check(`no payment yet is explained [${r.status}]`, r.status === 409 && r.body.code === "NO_PROVIDER_PAYMENT", r.body);
  const pi = await stripe.paymentIntents.create({ amount: 2000, currency: "gbp", payment_method: "pm_card_visa", payment_method_types: ["card"], confirm: true });
  await prisma.renewal.update({ where: { id: late.renewal.id }, data: { status: "PAYMENT_PROCESSING" } });
  await prisma.subscriptionPaymentAttempt.create({ data: { renewalId: late.renewal.id, attemptNumber: 1, status: "PENDING", idempotencyKey: `${late.renewal.id}:1`, stripePaymentIntentId: pi.id } });
  r = await call("POST", `/admin/renewals/${late.renewal.id}/recheck-provider`, tokenFor(vu), {});
  check("vendor refused", r.status === 403, r.status);
  r = await call("POST", `/admin/renewals/${late.renewal.id}/recheck-provider`, admin, {});
  console.log("    recheck said", r.status, JSON.stringify(r.body).slice(0, 160));
  check(`a late success reaches the renewal [${r.status}]`, r.status === 200 && r.body.providerStatus === "succeeded", r.body);
  const after = await prisma.renewal.findUnique({ where: { id: late.renewal.id } });
  check("not left processing", after.status !== "PAYMENT_PROCESSING", after.status);
  r = await call("POST", `/admin/renewals/${late.renewal.id}/recheck-provider`, admin, {});
  check("second check changes nothing", r.status === 200 && r.body.changed === false, r.body);
  check("no second order", (await prisma.renewal.count({ where: { id: late.renewal.id, orderId: { not: null } } })) <= 1);
  r = await call("GET", `/admin/subscriptions/${late.sub.id}`, admin);
  const detail = (r.body.renewals || []).find((x) => x.id === late.renewal.id);
  check("detail has what S61 shows", detail && "stockConfirmedAt" in detail && "priceChange" in detail && "escalated" in detail, detail);

  console.log("\n=== S63 SUPPORT CASE");
  const base = `/admin/subscriptions/${late.sub.id}/support-cases`;
  r = await call("GET", base, tokenFor(vu));
  check("vendor refused", r.status === 403, r.status);
  r = await call("POST", base, admin, { caseType: "NOPE", description: "x" });
  check(`bad type refused [${r.status}]`, r.status === 400, r.body);
  r = await call("POST", base, admin, { caseType: "STOCK", description: "  " });
  check(`needs a description [${r.status}]`, r.status === 400, r.body);
  r = await call("POST", base, admin, { caseType: "STOCK", description: "Short", renewalId: early.renewal.id });
  check(`renewal must belong to it [${r.status}]`, r.status === 400 && r.body.code === "RENEWAL_MISMATCH", r.body);
  r = await call("POST", base, admin, { caseType: "STOCK", description: "Short", evidenceUrls: ["javascript:alert(1)"] });
  check(`only https evidence [${r.status}]`, r.status === 400 && r.body.code === "INVALID_EVIDENCE", r.body);
  r = await call("POST", base, admin, { caseType: "STOCK", description: "Short", renewalId: late.renewal.id, internalNotes: "Secret note", evidenceUrls: ["https://example.test/a.jpg"] });
  check(`admin opens a case [${r.status}]`, r.status === 201 && r.body.supportCase.status === "OPEN", r.body);
  const id = r.body.supportCase.id;
  r = await call("PATCH", `/admin/subscriptions/support-cases/${id}`, admin, { escalate: true });
  check("escalates", r.body.supportCase?.escalated === true && r.body.supportCase.status === "ESCALATED", r.body);
  r = await call("PATCH", `/admin/subscriptions/support-cases/${id}`, admin, { customerVisibleResponse: "We are on it." });
  check(`response saved [${r.status}]`, r.status === 200, r.body);
  const told = await prisma.notification.findMany({ where: { userId: late.b.id, body: "We are on it." } });
  check("buyer hears the response only", told.length === 1 && !JSON.stringify(told).includes("Secret note"), told);
  await call("PATCH", `/admin/subscriptions/support-cases/${id}`, admin, { customerVisibleResponse: "We are on it." });
  check("saving the same response doesn't repeat it", (await prisma.notification.count({ where: { userId: late.b.id, body: "We are on it." } })) === 1);
  r = await call("PATCH", `/admin/subscriptions/support-cases/${id}`, admin, { status: "RESOLVED" });
  check("resolves, recording who", r.body.supportCase?.status === "RESOLVED" && r.body.supportCase.resolvedById === adminUser.id, r.body);
  r = await call("GET", base, admin);
  check("lists it", r.body.items?.some((c) => c.id === id), r.body);

  console.log(`\nRESULT ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
