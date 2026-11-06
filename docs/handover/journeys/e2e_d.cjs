// Discovery, demand matching and recommendations against the local verification database only.
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
async function call(method, p, token) {
  const res = await fetch(API + p, { method, headers: { "content-type": "application/json", ...(token ? { authorization: "Bearer " + token } : {}) } });
  const text = await res.text(); let json; try { json = JSON.parse(text); } catch { json = { raw: text.slice(0, 200) }; }
  return { status: res.status, body: json };
}
const tokenFor = (u) => jwt.sign({ sub: u.id, role: u.role, email: u.email, tv: u.tokenVersion }, process.env.JWT_SECRET, { expiresIn: "2h" });
let n = 0;
const user = (role = "BUYER", extra = {}) => prisma.user.create({ data: { email: `d${++n}.${run}@example.test`, password: "x", name: `D ${n}`, country: "United Kingdom", role, emailVerifiedAt: new Date(), ...extra } });
const vendor = async (label, extra = {}, products = 1) => {
  const u = await user("VENDOR");
  const v = await prisma.vendor.create({ data: { userId: u.id, storeName: `${label} ${run}`, storeSlug: `${label.toLowerCase().replace(/\s/g, "-")}-${run}`, ...extra } });
  for (let i = 0; i < products; i++) await prisma.product.create({ data: { vendorId: v.id, title: `${label} item ${i}`, priceInCents: 1000, currency: "GBP", stock: 5, status: "PUBLISHED", isActive: true } });
  return { u, v };
};

(async () => {
  console.log("\n=== OCT 19 LEFTOVERS");
  const unverified = await vendor("Unverified Live");
  const empty = await vendor("Unverified Empty", {}, 0);
  const demo = await vendor("Demo Store", { isTest: true });
  const suspended = await vendor("Suspended Store", { isSuspended: true });
  let r = await call("GET", `/vendors?search=${run}&limit=50`);
  const names = (r.body.items || r.body.vendors || r.body || []).map((v) => v.storeName);
  check(`unverified store with foodstuff is listed [${r.status}]`, names.includes(unverified.v.storeName), names);
  check("empty unverified store stays hidden", !names.includes(empty.v.storeName), names);
  check("demo store stays hidden", !names.includes(demo.v.storeName), names);
  check("suspended store stays hidden", !names.includes(suspended.v.storeName), names);
  r = await call("GET", `/vendors/${unverified.v.id}`);
  check(`its page opens [${r.status}]`, r.status === 200, r.body);
  r = await call("GET", `/vendors/${suspended.v.id}`);
  check(`a suspended store's page doesn't [${r.status}]`, r.status === 404, r.status);

  console.log("\n=== NEW VENDOR BOOST");
  await prisma.adminPlatformSetting.deleteMany({ where: { key: "NEW_VENDOR_BOOST_DAYS" } });
  const fresh = await vendor("Fresh Rank");
  const old = await vendor("Old Rank", { verificationStatus: "VERIFIED", createdAt: new Date(Date.now() - 200 * 864e5) }, 3);
  const order = (list, a, b) => list.indexOf(a) - list.indexOf(b);
  r = await call("GET", `/vendors?search=Rank ${run}&sort=popular&limit=50`);
  let list = (r.body.items || r.body.vendors || r.body || []).map((v) => v.storeName);
  check("new store with no orders ranks above an old quiet one", order(list, fresh.v.storeName, old.v.storeName) < 0, list);
  await prisma.adminPlatformSetting.create({ data: { key: "NEW_VENDOR_BOOST_DAYS", value: 0 } });
  r = await call("GET", `/vendors?search=Rank ${run}&sort=popular&limit=50`);
  list = (r.body.items || r.body.vendors || r.body || []).map((v) => v.storeName);
  check("admin setting turns the boost off", order(list, old.v.storeName, fresh.v.storeName) < 0, list);
  await prisma.adminPlatformSetting.deleteMany({ where: { key: "NEW_VENDOR_BOOST_DAYS" } });

  console.log("\n=== RECOMMENDATIONS");
  r = await call("GET", "/vendors/me/dashboard", tokenFor(unverified.u));
  check(`unverified: honest about verification [${r.status}]`, r.body.recommended_action?.type === "verify_account" && /withdraw/.test(r.body.recommended_action.reason), r.body.recommended_action);
  r = await call("GET", "/vendors/me/dashboard", tokenFor(old.u));
  check("verified, no orders: First Sale Campaign", r.body.recommended_action?.type === "first_sale_campaign", r.body.recommended_action);
  const buyer = await user();
  const product = await prisma.product.findFirst({ where: { vendorId: old.v.id } });
  for (let i = 0; i < 2; i++) {
    const o = await prisma.order.create({ data: { buyerId: buyer.id, vendorId: old.v.id, subtotalAmount: 1000, deliveryFeeAmount: 0, totalAmount: 1000, currency: "GBP", status: "COMPLETED", items: { create: [{ productId: product.id, vendorId: old.v.id, quantity: 1, unitAmount: 1000, totalAmount: 1000, productTitle: product.title }] } } });
    await prisma.payment.create({ data: { orderId: o.id, amount: 1000, currency: "GBP", status: "SUCCEEDED", platformFeeAmount: 0, vendorEarningsAmount: 1000, stripePaymentIntentId: `pi_${run}_${i}` } });
  }
  r = await call("GET", "/vendors/me/dashboard", tokenFor(old.u));
  check("with sales, it moves on from First Sale", r.status === 200 && r.body.recommended_action && r.body.recommended_action.type !== "first_sale_campaign" && !!r.body.recommended_action.route, r.body.recommended_action);

  console.log("\n=== DEMAND MATCHING");
  const yamWord = "Yam" + run;
  const yamSupplier = await user();
  await prisma.supplierAccount.create({ data: { userId: yamSupplier.id, supplierState: "APPROVED", approvedAt: new Date(), businessName: "S " + run, categories: [yamWord], coverageRegions: ["GB"], fulfilmentMethods: ["COLLECTION"], termsAcceptedAt: new Date() } });
  const pending = await user();
  await prisma.supplierAccount.create({ data: { userId: pending.id, supplierState: "UNDER_REVIEW", businessName: "P " + run, categories: [yamWord], coverageRegions: ["GB"], fulfilmentMethods: ["COLLECTION"], termsAcceptedAt: new Date() } });
  const organisers = [await user(), await user(), await user()];
  const job = async () => { const res = await fetch(`${API}/internal/jobs/demand-matching`, { method: "POST", headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } }); return { status: res.status, body: await res.json() }; };
  const told = (u) => prisma.notification.count({ where: { userId: u.id, title: "Organisers are asking for this" } });
  await prisma.demandRequest.create({ data: { userId: organisers[0].id, foodstuff: yamWord, market: "GB" } });
  await prisma.demandRequest.create({ data: { userId: organisers[1].id, foodstuff: yamWord, market: "GB" } });
  let j = await job();
  check(`two requests isn't enough [${j.status}]`, j.status === 200 && (await told(yamSupplier)) === 0, j.body);
  await prisma.demandRequest.create({ data: { userId: organisers[2].id, foodstuff: yamWord.toUpperCase(), market: "GB" } });
  j = await job();
  check("third request tells the approved supplier", (await told(yamSupplier)) === 1, j.body);
  check("unapproved supplier isn't told", (await told(pending)) === 0);
  await job();
  check("running again doesn't repeat it", (await told(yamSupplier)) === 1);

  console.log(`\nRESULT ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
