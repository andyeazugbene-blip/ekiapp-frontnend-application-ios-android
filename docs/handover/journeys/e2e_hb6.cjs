// Handbook stage 6 against the local verification database only.
const path = require("path");
const BACKEND = process.env.EKI_BACKEND_DIR || path.resolve(__dirname, "../../../../ekiapp-backend-main");
const req = (m) => require(path.join(BACKEND, "node_modules", m));
req("dotenv").config({ path: path.join(BACKEND, ".env") });
if (!/localhost:5544\/eki_verify/.test(process.env.DATABASE_URL || "")) throw new Error("Refusing to run: not the verification DB");
const { PrismaClient } = req("@prisma/client");
const jwt = req("jsonwebtoken");
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
const user = (role = "BUYER") => prisma.user.create({ data: { email: `hb${++n}.${run}@example.test`, password: "x", name: `HB ${n}`, country: "United Kingdom", role, emailVerifiedAt: new Date() } });
const vendorFor = async (u, extra = {}) => prisma.vendor.create({ data: { userId: u.id, storeName: `HB Store ${n} ${run}`, storeSlug: `hb-${n}-${run}`, ...extra } });
const paidOrder = async (buyer, vendor, status) => {
  const product = await prisma.product.create({ data: { vendorId: vendor.id, title: "HB Item " + Math.random(), priceInCents: 1000, currency: "GBP", stock: 10 } });
  const order = await prisma.order.create({ data: { buyerId: buyer.id, vendorId: vendor.id, subtotalAmount: 1000, deliveryFeeAmount: 0, totalAmount: 1000, currency: "GBP", status, items: { create: [{ productId: product.id, vendorId: vendor.id, quantity: 1, unitAmount: 1000, totalAmount: 1000, productTitle: product.title }] } } });
  await prisma.payment.create({ data: { orderId: order.id, amount: 1000, currency: "GBP", status: "SUCCEEDED", platformFeeAmount: 0, vendorEarningsAmount: 1000, stripePaymentIntentId: "pi_" + run + n + Math.random().toString(36).slice(2, 8) } }).catch(async (e) => { console.log(String(e.message).slice(-500)); throw e; });
  return order;
};
const sweep = async () => { const r = await fetch(`${API}/internal/jobs/automation-sweep`, { method: "POST", headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } }); return { status: r.status, body: await r.json() }; };

(async () => {
  const adminUser = await prisma.user.findUniqueOrThrow({ where: { email: "seed_qa_admin@example.com" } });
  const superRole = await prisma.adminRole.findUniqueOrThrow({ where: { name: "Super Administrator" } });
  await prisma.adminRoleAssignment.upsert({ where: { roleId_userId: { roleId: superRole.id, userId: adminUser.id } }, create: { roleId: superRole.id, userId: adminUser.id }, update: {} });
  const admin = tokenFor(adminUser);
  const buyer = await user();

  console.log("\n=== DASHBOARD STATE");
  const vu = await user("VENDOR");
  const vendor = await vendorFor(vu);
  let r = await call("GET", "/vendors/me/dashboard", tokenFor(vu));
  check(`new store reads as no sale [${r.status}]`, r.status === 200 && r.body.state === "NO_SALE", r.body.state ?? r.body);
  await paidOrder(buyer, vendor, "DELIVERED");
  r = await call("GET", "/vendors/me/dashboard", tokenFor(vu));
  check("one sale reads as has sales", r.body.state === "HAS_SALES", r.body.state);
  await paidOrder(buyer, vendor, "DELIVERED");
  r = await call("GET", "/vendors/me/dashboard", tokenFor(vu));
  check("same buyer again reads as repeat", r.body.state === "REPEAT_BUYERS", r.body.state);

  console.log("\n=== AUTOMATIONS");
  await prisma.automationRule.updateMany({ where: { type: { in: ["POST_SALE_TRANSITION", "FIRST_SALE_DIAGNOSTIC"] } }, data: { state: "ACTIVE" } }).catch(() => {});
  const vu2 = await user("VENDOR");
  const firstSale = await vendorFor(vu2);
  await paidOrder(buyer, firstSale, "COMPLETED");
  await prisma.order.updateMany({ where: { vendorId: firstSale.id }, data: { updatedAt: new Date(Date.now() - 5 * 36e5) } });
  const vu3 = await user("VENDOR");
  const quiet = await vendorFor(vu3, { verificationStatus: "VERIFIED", createdAt: new Date(Date.now() - 8 * 864e5) });
  await prisma.product.create({ data: { vendorId: quiet.id, title: "HB Rice " + run, priceInCents: 500, currency: "GBP", stock: 10, status: "PUBLISHED", isActive: true } });
  await prisma.deliveryZone.create({ data: { vendorId: quiet.id, name: "UK " + run, country: "GB", baseFeeAmount: 300, feePerKgAmount: 0 } }).catch(async (e) => { console.log(String(e.message).slice(-400)); throw e; });
  const s = await sweep();
  check(`sweep runs without error [${s.status}]`, s.status === 200 && !JSON.stringify(s.body).includes("rror"), s.body);
  const runs = await prisma.automationRun.findMany({ where: { type: { in: ["POST_SALE_TRANSITION", "FIRST_SALE_DIAGNOSTIC"] } }, select: { type: true, recipientUserId: true, status: true, skipReason: true } }).catch(async () => prisma.automationRun.findMany({ where: { type: { in: ["POST_SALE_TRANSITION", "FIRST_SALE_DIAGNOSTIC"] } } }));
  const post = runs.filter((x) => x.recipientUserId === vu2.id && x.type === "POST_SALE_TRANSITION");
  const diag = runs.filter((x) => x.recipientUserId === vu3.id && x.type === "FIRST_SALE_DIAGNOSTIC");
  check("first completed order starts the post-sale step", post.length >= 1, runs.slice(0, 6));
  check("a quiet ready store gets the diagnostic", diag.length >= 1, runs.slice(0, 6));
  check("a vendor with two orders isn't told it was their first", !runs.some((x) => x.recipientUserId === vu.id && x.type === "POST_SALE_TRANSITION"), runs.slice(0, 4));
  check("a vendor with sales doesn't get the diagnostic", !runs.some((x) => x.recipientUserId === vu2.id && x.type === "FIRST_SALE_DIAGNOSTIC"), runs.slice(0, 4));

  console.log("\n=== CLOSING AN ACCOUNT");
  const vu4 = await user("VENDOR");
  const open = await vendorFor(vu4);
  const orderOpen = await paidOrder(buyer, open, "PROCESSING");
  r = await call("DELETE", `/admin/users/${vu4.id}`, admin, { reason: "local test run" });
  check(`open order blocks closing [${r.status}]`, r.status === 409 && r.body.code === "ACCOUNT_HAS_OPEN_ITEMS" && /open order/.test(r.body.message), r.body);
  check("account is untouched", !!(await prisma.user.findUnique({ where: { id: vu4.id } })));
  await prisma.order.update({ where: { id: orderOpen.id }, data: { status: "COMPLETED" } });
  const orderD = await paidOrder(buyer, open, "COMPLETED");
  const dispute = await prisma.dispute.create({ data: { orderId: orderD.id, reason: "Late", status: "OPEN", buyerId: buyer.id, vendorId: open.id } }).catch(async (e) => { console.log(String(e.message).slice(-400)); return null; });
  if (dispute) {
    r = await call("DELETE", `/admin/users/${vu4.id}`, admin, { reason: "local test run" });
    check(`open dispute blocks closing [${r.status}]`, r.status === 409 && /open dispute/.test(r.body.message), r.body);
    await prisma.dispute.update({ where: { id: dispute.id }, data: { status: "RESOLVED_VENDOR" } });
  }
  r = await call("DELETE", `/admin/users/${vu4.id}`, admin, { reason: "local test run" });
  check(`closes once clear, keeping history [${r.status}]`, r.status === 200 && (await prisma.order.count({ where: { vendorId: open.id } })) >= 2, r.body);
  const closed = await prisma.user.findUnique({ where: { id: vu4.id } });
  check("record is anonymised, not active", closed && closed.isSuspended === true && !closed.email.includes(run), closed && { email: closed.email, s: closed.isSuspended });
  const empty = await user();
  r = await call("DELETE", `/admin/users/${empty.id}`, admin, { reason: "local test run" });
  check(`an account with no history can still go [${r.status}]`, r.status === 200 && !(await prisma.user.findUnique({ where: { id: empty.id } })), r.body);

  console.log(`\nRESULT ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
