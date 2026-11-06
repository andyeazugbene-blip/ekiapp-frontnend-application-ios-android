// Events, email tracking and attribution against the local verification database only.
const path = require("path");
const crypto = require("crypto");
const BACKEND = process.env.EKI_BACKEND_DIR || path.resolve(__dirname, "../../../../ekiapp-backend-main");
const req = (m) => require(path.join(BACKEND, "node_modules", m));
if (!/localhost:5544\/eki_verify/.test(process.env.DATABASE_URL || "")) throw new Error("Refusing to run: not the local verification database");
const { PrismaClient } = req("@prisma/client");
const jwt = req("jsonwebtoken");
req("dotenv").config({ path: path.join(BACKEND, ".env") });
const tokenFor = (u) => jwt.sign({ sub: u.id, role: u.role, email: u.email, tv: u.tokenVersion }, process.env.JWT_SECRET, { expiresIn: "2h" });
const prisma = new PrismaClient();
const API = "http://localhost:4177/api";
const SECRET = process.env.RESEND_WEBHOOK_SECRET;
if (!SECRET) throw new Error("Set RESEND_WEBHOOK_SECRET to the value the local server uses");

let pass = 0, fail = 0;
function check(name, ok, detail) {
  if (ok) { pass += 1; console.log("  PASS " + name); }
  else { fail += 1; console.log("  FAIL " + name, detail === undefined ? "" : JSON.stringify(detail).slice(0, 300)); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function call(method, url, token, body, headers = {}) {
  const res = await fetch(API + url, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, body: json };
}
function signed(body, age = 0) {
  const id = "msg_" + crypto.randomBytes(6).toString("hex");
  const ts = String(Math.floor(Date.now() / 1000) - age);
  const key = Buffer.from(SECRET.replace(/^whsec_/, ""), "base64");
  const sig = crypto.createHmac("sha256", key).update(`${id}.${ts}.${body}`).digest("base64");
  return { "svix-id": id, "svix-timestamp": ts, "svix-signature": `v1,${sig}` };
}
async function hook(event, age) {
  const body = JSON.stringify(event);
  return call("POST", "/resend/webhook", null, body, signed(body, age));
}
const events = (name, where = {}) => prisma.event.count({ where: { name, ...where } });

(async () => {
  const stamp = Date.now();
  const adminUser = await prisma.user.findFirst({ where: { email: "seed_qa_admin@example.com" } });
  const superRole = await prisma.adminRole.findUniqueOrThrow({ where: { name: "Super Administrator" } });
  await prisma.adminRoleAssignment.upsert({ where: { roleId_userId: { roleId: superRole.id, userId: adminUser.id } }, create: { roleId: superRole.id, userId: adminUser.id }, update: {} });
  const adminToken = tokenFor(adminUser);

  console.log("Resend webhook");
  const buyer = await prisma.user.create({ data: { email: `e_buyer_${stamp}@example.test`, name: "E Buyer", password: "x", role: "BUYER", country: "United Kingdom" } });
  const log = await prisma.communicationLog.create({ data: { recipientId: buyer.id, recipientType: "BUYER", eventKey: "automation_cart_recovery", channel: "email", title: "T", body: "B", status: "QUEUED" } });
  const tags = { log_id: log.id };

  let r = await call("POST", "/resend/webhook", null, JSON.stringify({ type: "email.opened", data: { tags } }), { "svix-id": "x", "svix-timestamp": String(Math.floor(Date.now() / 1000)), "svix-signature": "v1,forged" });
  check(`forged signature refused [${r.status}]`, r.status === 400);
  r = await hook({ type: "email.opened", data: { tags } }, 3600);
  check(`old message refused [${r.status}]`, r.status === 400);
  let row = await prisma.communicationLog.findUnique({ where: { id: log.id } });
  check("refused messages changed nothing", row.openedAt === null);

  r = await hook({ type: "email.delivered", data: { email_id: `re_${stamp}`, tags } });
  row = await prisma.communicationLog.findUnique({ where: { id: log.id } });
  check(`delivered recorded [${r.status}]`, row.status === "DELIVERED" && row.deliveredAt !== null && row.providerRef === `re_${stamp}`, row);

  await hook({ type: "email.opened", data: { email_id: `re_${stamp}` } });
  const firstOpen = (await prisma.communicationLog.findUnique({ where: { id: log.id } })).openedAt;
  check("opened recorded, found by provider id", firstOpen !== null);
  await hook({ type: "email.opened", data: { email_id: `re_${stamp}`, tags }, created_at: "2030-01-01T00:00:00Z" });
  row = await prisma.communicationLog.findUnique({ where: { id: log.id } });
  check("a repeated open keeps the first time", row.openedAt.getTime() === firstOpen.getTime());

  await hook({ type: "email.clicked", data: { email_id: `re_${stamp}`, tags } });
  await hook({ type: "email.clicked", data: { email_id: `re_${stamp}`, tags } });
  await sleep(500);
  row = await prisma.communicationLog.findUnique({ where: { id: log.id } });
  check("clicked recorded", row.clickedAt !== null);
  check("one opened event despite repeats", (await events("message_opened", { entityId: log.id })) === 1);
  check("one clicked event despite repeats", (await events("message_clicked", { entityId: log.id })) === 1);
  check("automation click recorded once", (await events("automation_clicked", { entityId: log.id })) === 1);

  r = await hook({ type: "email.bounced", data: { email_id: "re_unknown" } });
  check(`unknown email acknowledged, so Resend stops retrying [${r.status}]`, r.status === 200 && r.body?.result === "ignored");

  const log2 = await prisma.communicationLog.create({ data: { recipientId: buyer.id, recipientType: "BUYER", eventKey: "admin_x", channel: "email", title: "T", body: "B", status: "QUEUED" } });
  await hook({ type: "email.bounced", data: { tags: { log_id: log2.id }, bounce: { message: "Mailbox full" } } });
  row = await prisma.communicationLog.findUnique({ where: { id: log2.id } });
  check("bounce is failed, with the reason", row.status === "FAILED" && row.statusDetail === "Mailbox full", row);

  console.log("Events");
  const vendorUser = await prisma.user.create({ data: { email: `e_vendor_${stamp}@example.test`, name: "E Vendor", password: "x", role: "VENDOR", country: "United Kingdom", referralCode: `EV${stamp}`, referredBy: buyer.id } });
  const vendor = await prisma.vendor.create({ data: { userId: vendorUser.id, storeName: `E Store ${stamp}`, storeSlug: `e-${stamp}`, country: "United Kingdom", currency: "GBP", city: "London" } });
  const vendorToken = tokenFor(vendorUser);
  const product = await prisma.product.create({ data: { vendorId: vendor.id, title: "E Rice", description: "Rice", priceInCents: 1000, currency: "GBP", stock: 50, isActive: true, status: "PUBLISHED", category: "Grains" } });

  const buyerToken = tokenFor(buyer);
  await call("GET", `/products/${product.id}`, buyerToken);
  await call("GET", `/products/${product.id}`, vendorToken);
  await sleep(400);
  check("buyer view is recorded, the owner's isn't", (await events("product_viewed", { entityId: product.id })) === 1);

  r = await call("POST", "/cart/items", buyerToken, { productId: product.id, quantity: 2 });
  await call("POST", "/cart/items", buyerToken, { productId: product.id, quantity: 1 });
  await sleep(400);
  check(`new basket recorded once [${r.status}]`, (await events("cart_created", { actorId: buyer.id })) === 1);

  await call("GET", "/growth/referrals", vendorToken);
  await call("GET", "/growth/referrals", vendorToken);
  await sleep(400);
  check("referral link recorded once", (await events("referral_created", { actorId: vendorUser.id })) === 1);

  r = await call("POST", "/delivery/zones/me", vendorToken, { name: "London", country: "United Kingdom", baseFeeAmount: 300, feePerKgAmount: 0, currency: "GBP" });
  await sleep(800);
  check(`store ready recorded when delivery is set up [${r.status}]`, r.status < 300 && (await events("store_ready", { entityId: vendor.id })) === 1, r.body);
  check("referred store is recorded for the referrer", (await events("referral_store_ready", { entityId: vendor.id })) === 1);
  r = await call("POST", "/delivery/zones/me", vendorToken, { name: "Essex", country: "United Kingdom", baseFeeAmount: 300, feePerKgAmount: 0, currency: "GBP" });
  await sleep(500);
  check("a second zone doesn't record it again", (await events("store_ready", { entityId: vendor.id })) === 1);

  console.log("Attribution");
  const now = Date.now();
  const mk = (over) => prisma.automationRun.create({ data: { type: "CART_RECOVERY", recipientUserId: buyer.id, status: "SENT", dedupeKey: `e:${stamp}:${Math.random()}`, sentAt: new Date(now - 2 * 86400000), ...over } });
  const order = (over) => prisma.order.create({ data: { orderNumber: `E${stamp}${Math.floor(Math.random() * 1e6)}`, buyerId: buyer.id, vendorId: vendor.id, status: "PAID", totalAmount: 5000, currency: "GBP", createdAt: new Date(now - 86400000), items: { create: [{ productId: product.id, vendorId: vendor.id, quantity: 1, unitAmount: over.totalAmount ?? 5000, totalAmount: over.totalAmount ?? 5000, productTitle: "E Rice", currency: "GBP" }] }, ...over } });
  await mk({ vendorId: vendor.id });
  await mk({ vendorId: vendor.id, sentAt: new Date(now - 29 * 86400000) });
  const assisted = await order({});
  await prisma.refund.create({ data: { orderId: assisted.id, amountMinor: 1000, currency: "GBP", status: "COMPLETED", reason: "e2e", actorId: buyer.id, idempotencyKey: `e:${stamp}` } }).catch((e) => console.log("    refund row:", e.message.slice(0, 120)));
  await order({ status: "PENDING" });
  await order({ createdAt: new Date(now - 20 * 86400000), totalAmount: 7777 });
  await mk({ isTest: true, dedupeKey: `e:${stamp}:test` });

  r = await call("GET", `/admin/automation/attribution?vendorId=${vendor.id}`, adminToken);
  const row1 = r.body?.assisted?.find((a) => a.type === "CART_RECOVERY" && a.currency === "GBP");
  check(`report answers with the default window [${r.status}]`, r.status === 200 && r.body.windowDays === 7, r.body);
  check("counts only the paid order inside the window", row1?.orders === 1 && row1?.gross === 5000, row1);
  check("net is after the completed refund", row1?.refunds === 1000 && row1?.net === 4000, row1);
  check("incremental stays unestimated", r.body?.estimatedIncremental === null && /comparison group/i.test(r.body?.notes?.incremental));

  r = await call("PATCH", "/admin/settings/launch/ATTRIBUTION_WINDOW_DAYS", adminToken, { value: 30, reason: "Testing a longer window" });
  check(`admin can change the window [${r.status}]`, r.status === 200, r.body);
  r = await call("GET", `/admin/automation/attribution?vendorId=${vendor.id}`, adminToken);
  const wider = r.body?.assisted?.find((a) => a.type === "CART_RECOVERY" && a.currency === "GBP");
  check("the older order joins with a longer window", r.body?.windowDays === 30 && wider?.orders === 2 && wider?.gross === 12777, wider);
  await call("PATCH", "/admin/settings/launch/ATTRIBUTION_WINDOW_DAYS", adminToken, { value: 7, reason: "Back to the default" });

  const noAuth = await call("GET", "/admin/automation/attribution", null);
  check(`report needs admin [${noAuth.status}]`, noAuth.status === 401);
  const asBuyer = await call("GET", "/admin/automation/attribution", buyerToken);
  check(`buyer refused [${asBuyer.status}]`, asBuyer.status === 403);

  console.log(`\nRESULT pass=${pass} fail=${fail}`);
  await prisma.$disconnect();
  process.exit(fail ? 1 : 0);
})().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
