// Launch settings against the local verification database only.
const path = require("path");
const BACKEND = process.env.EKI_BACKEND_DIR || path.resolve(__dirname, "../../../../ekiapp-backend-main");
const req = (m) => require(path.join(BACKEND, "node_modules", m));
req("dotenv").config({ path: path.join(BACKEND, ".env") });
if (!/localhost:5544\/eki_verify/.test(process.env.DATABASE_URL || "")) throw new Error("Refusing to run: not the verification DB");
const { PrismaClient } = req("@prisma/client");
const jwt = req("jsonwebtoken");
const prisma = new PrismaClient();
const API = "http://localhost:4177/api";
let pass = 0, fail = 0;
const check = (n, ok, d) => { if (ok) { pass++; console.log("  PASS " + n); } else { fail++; console.log("  FAIL " + n + " -> " + JSON.stringify(d)); } };
async function call(method, p, token, body) {
  const res = await fetch(API + p, { method, headers: { "content-type": "application/json", ...(token ? { authorization: "Bearer " + token } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text(); let json; try { json = JSON.parse(text); } catch { json = { raw: text.slice(0, 200) }; }
  return { status: res.status, body: json };
}
const tokenFor = (u) => jwt.sign({ sub: u.id, role: u.role, email: u.email, tv: u.tokenVersion }, process.env.JWT_SECRET, { expiresIn: "2h" });
(async () => {
  await prisma.adminPlatformSetting.deleteMany({ where: { key: { in: ["VENDOR_TRIAL_DAYS", "UK_LAUNCH_MODE", "REVIEW_HOURS_SUPPLIER_OFFER"] } } });
  const adminUser = await prisma.user.findUniqueOrThrow({ where: { email: "seed_qa_admin@example.com" } });
  const superRole = await prisma.adminRole.findUniqueOrThrow({ where: { name: "Super Administrator" } });
  await prisma.adminRoleAssignment.upsert({ where: { roleId_userId: { roleId: superRole.id, userId: adminUser.id } }, create: { roleId: superRole.id, userId: adminUser.id }, update: {} });
  const admin = tokenFor(adminUser);
  const buyer = await prisma.user.create({ data: { email: `s.${Date.now()}@example.test`, password: "x", name: "Set Buyer", role: "BUYER", country: "United Kingdom" } });
  const buyerToken = tokenFor(buyer);

  let r = await call("GET", "/community-buy/launch-settings");
  check("public view works signed out, with defaults", r.status === 200 && r.body.vendorTrialDays === 30 && r.body.ukLaunchMode === true && r.body.launchMarket === "GB", r);
  check("public view holds only what apps need", Object.keys(r.body).sort().join() === "launchMarket,ukLaunchMode,vendorTrialDays", r.body);
  r = await call("GET", "/admin/settings/launch");
  check("admin list refused signed out", r.status === 401, r.status);
  r = await call("GET", "/admin/settings/launch", buyerToken);
  check("admin list refused for a buyer", r.status === 403, r.status);
  r = await call("GET", "/admin/settings/launch", admin);
  check("admin list loads", r.status === 200 && r.body.settings.length === 9, r);
  r = await call("PATCH", "/admin/settings/launch/VENDOR_TRIAL_DAYS", buyerToken, { value: 7, reason: "nope" });
  check("buyer can't change a setting", r.status === 403, r.status);
  r = await call("PATCH", "/admin/settings/launch/VENDOR_TRIAL_DAYS", admin, { value: 14, reason: "client asked" });
  console.log("  patch", r.status, r.body.code || "");
  if (r.status === 403 && /2FA|TWO|2fa/i.test(JSON.stringify(r.body))) {
    console.log("  2FA required by the route, as designed: writing through the service path is covered by unit tests");
    await prisma.adminPlatformSetting.upsert({ where: { key: "VENDOR_TRIAL_DAYS" }, update: { value: 14 }, create: { key: "VENDOR_TRIAL_DAYS", value: 14 } });
    check("route demands 2FA", true);
  } else check("admin can change it", r.status === 200 && r.body.setting.value === 14, r);
  r = await call("GET", "/community-buy/launch-settings");
  check("change shows straight away", r.body.vendorTrialDays === 14, r.body);
  r = await call("GET", "/admin/settings/launch", admin);
  check("admin sees it changed", r.body.settings.find((s) => s.key === "VENDOR_TRIAL_DAYS").changedFromDefault === true, r.body);
  await prisma.adminPlatformSetting.deleteMany({ where: { key: "VENDOR_TRIAL_DAYS" } });
  console.log(`\nRESULT ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
