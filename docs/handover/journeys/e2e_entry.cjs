// Entry routing against the local verification database only.
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
const check = (n, ok, d) => { if (ok) { pass++; console.log("  PASS " + n); } else { fail++; console.log("  FAIL " + n + " -> " + String(JSON.stringify(d)).slice(0, 260)); } };
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

  console.log("\n=== PARTNER SIGN-UP");
  const code = "WOSI" + run.toUpperCase();
  const reg = async (label, extra) => call("POST", "/auth/register", null, { email: `${label}.${run}@example.test`, password: "LocalVerify123!", name: `${label} ${run}`, ...extra });
  let r = await reg("p1", { partnerCode: code.toLowerCase(), role: "BUYER" });
  check(`sign-up with a code works [${r.status}]`, r.status === 201 || r.status === 200, r.body);
  let u = await prisma.user.findUnique({ where: { email: `p1.${run}@example.test` } });
  check("code saved, upper-cased", u?.partnerCode === code, u?.partnerCode);
  r = await reg("p2", { partnerCode: "<bad code>", role: "BUYER" });
  check(`a bad code doesn't block sign-up [${r.status}]`, r.status === 201 || r.status === 200, r.body);
  u = await prisma.user.findUnique({ where: { email: `p2.${run}@example.test` } });
  check("bad code not saved", u?.partnerCode === null, u?.partnerCode);
  r = await reg("p3", { role: "BUYER" });
  u = await prisma.user.findUnique({ where: { email: `p3.${run}@example.test` } });
  check("no code is fine", (r.status === 201 || r.status === 200) && u?.partnerCode === null, r.body);

  console.log("\n=== COHORT REPORT");
  const p1 = await prisma.user.findUnique({ where: { email: `p1.${run}@example.test` } });
  const demo = await prisma.user.create({ data: { email: `demo.${run}@example.test`, password: "x", name: "Demo", role: "BUYER", isTest: true, partnerCode: code } });
  r = await call("GET", "/admin/analytics/partner-cohorts");
  check("refused signed out", r.status === 401, r.status);
  r = await call("GET", "/admin/analytics/partner-cohorts", tokenFor(p1));
  check("refused for a buyer", r.status === 403, r.status);
  r = await call("GET", "/admin/analytics/partner-cohorts", admin);
  const row = (r.body.partners || []).find((p) => p.code === code);
  check("partner appears, demo account not counted", row?.signUps === 1, r.body);
  r = await call("GET", `/admin/analytics/partner-cohorts/${code}`, admin);
  check("detail lists the account without contact details", r.body.accounts?.length === 1 && r.body.accounts[0].userId === p1.id && !JSON.stringify(r.body).includes("example.test"), r.body);
  await prisma.user.delete({ where: { id: demo.id } });

  console.log("\n=== WEB PAGES");
  let res = await fetch(`${HOST}/invite/${code}?intent=sell`);
  let html = await res.text();
  check("partner page shows the code and store buttons", res.status === 200 && html.includes(code) && html.includes("apps.apple.com") && html.includes("Set up your store"), html.slice(0, 160));
  res = await fetch(`${HOST}/invite/${code}?intent=supply`);
  html = await res.text();
  check("supply partner page", html.includes("Supply bulk orders"), html.slice(0, 160));
  res = await fetch(`${HOST}/invite/ABC123`);
  html = await res.text();
  check("a plain referral link still reads as a referral", html.includes("referral code"), html.slice(0, 160));
  res = await fetch(`${HOST}/community-buy/nope`);
  html = await res.text();
  check(`unknown campaign shows a page, not JSON [${res.status}]`, res.status === 404 && html.startsWith("<!doctype html>") && html.includes("isn't available"), html.slice(0, 120));

  const orgUser = await prisma.user.create({ data: { email: `org.${run}@example.test`, password: "x", name: "Org", role: "BUYER" } });
  const organiser = await prisma.organiserProfile.create({ data: { userId: orgUser.id, country: "GB" } }).catch(async (e) => { console.log("organiser create", e.message.slice(0, 200)); throw e; });
  const camp = await prisma.communityCampaign.create({
    data: { organiserId: organiser.id, title: "Puna yam " + run, description: "Fresh <yam>", country: "GB", currency: "GBP", targetAmount: 40000, status: "UNDER_REVIEW", pricePerShareMinor: 4000, minimumShares: 10, goalShares: 20, deadline: new Date(Date.now() + 5 * 864e5) },
  });
  res = await fetch(`${HOST}/community-buy/${camp.id}`);
  html = await res.text();
  check("in-review campaign is a coming-soon page", res.status === 200 && html.includes("Coming soon") && html.includes("£40.00") && html.includes("Fresh &lt;yam&gt;"), html.slice(0, 200));
  check("page allows its inline script", !/script-src 'self'(?!.*unsafe-inline)/.test(res.headers.get("content-security-policy") || ""), res.headers.get("content-security-policy"));
  r = await call("POST", `/community-buy/campaigns/${camp.id}/interest`, null, { email: `Fan.${run}@Example.test` });
  check(`interest saved signed out [${r.status}]`, r.status === 201, r.body);
  r = await call("POST", `/community-buy/campaigns/${camp.id}/interest`, null, { email: `fan.${run}@example.test` });
  check("second tap is harmless", r.status === 201, r.body);
  check("one row for that email", (await prisma.campaignInterest.count({ where: { campaignId: camp.id } })) === 1);
  r = await call("POST", `/community-buy/campaigns/${camp.id}/interest`, null, { email: "not an email" });
  check("bad email refused", r.status === 400, r.status);

  await prisma.communityCampaign.update({ where: { id: camp.id }, data: { status: "LIVE" } });
  res = await fetch(`${HOST}/community-buy/${camp.id}`);
  html = await res.text();
  check("live campaign is joinable from the page", html.includes(`ekiapp://community-buy/${camp.id}`) && html.includes("0 of 10 confirmed shares"), html.slice(0, 200));
  r = await call("POST", `/community-buy/campaigns/${camp.id}/interest`, null, { email: "late@example.test" });
  check("no interest sign-up once it's live", r.status === 404, r.status);

  console.log(`\nRESULT ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
