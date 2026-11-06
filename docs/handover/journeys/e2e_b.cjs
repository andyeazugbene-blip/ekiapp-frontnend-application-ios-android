// CB65, CB67 and CB69 against the local verification database only.
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
const user = () => prisma.user.create({ data: { email: `b${++n}.${run}@example.test`, password: "x", name: `B ${n}`, country: "United Kingdom", role: "BUYER", emailVerifiedAt: new Date() } });

(async () => {
  const sup = await user(); const org = await user(); const other = await user(); const buyer = await user();
  const account = await prisma.supplierAccount.create({ data: { userId: sup.id, supplierState: "APPROVED", approvedAt: new Date(), businessName: "B Foods " + run, categories: ["Grains"], coverageRegions: ["GB"], fulfilmentMethods: ["COLLECTION"], termsAcceptedAt: new Date() } });
  const organiser = await prisma.organiserProfile.create({ data: { userId: org.id, country: "GB" } });
  const camp = await prisma.communityCampaign.create({ data: { organiserId: organiser.id, supplierAccountId: account.id, supplierCommitted: true, title: "Yam " + run, country: "GB", currency: "GBP", targetAmount: 40000, status: "LIVE", pricePerShareMinor: 4000, minimumShares: 10, goalShares: 20, maximumShares: 30, deadline: new Date(Date.now() + 5 * 864e5) } });

  console.log("\n=== CB69 INVENTORY STATUS");
  let r = await call("POST", `/supplier/campaigns/${camp.id}/inventory-status`, tokenFor(other), { status: "LIMITED" });
  check(`someone else can't report it [${r.status}]`, r.status === 404 || r.status === 403, r.body);
  r = await call("POST", `/supplier/campaigns/${camp.id}/inventory-status`, tokenFor(sup), { status: "MAYBE" });
  check(`unknown status refused [${r.status}]`, r.status === 400, r.body);
  r = await call("POST", `/supplier/campaigns/${camp.id}/inventory-status`, tokenFor(sup), { status: "CONFIRMED" });
  check(`supplier confirms [${r.status}]`, r.status === 200 && r.body.campaign.supplierInventoryStatus === "CONFIRMED", r.body);
  check("confirming doesn't bother the organiser", (await prisma.notification.count({ where: { userId: org.id } })) === 0);
  r = await call("POST", `/supplier/campaigns/${camp.id}/inventory-status`, tokenFor(sup), { status: "NO_LONGER_AVAILABLE" });
  check(`supplier reports a problem [${r.status}]`, r.status === 200, r.body);
  check("organiser told straight away", (await prisma.notification.count({ where: { userId: org.id, title: "Stock is no longer available" } })) === 1);
  check("campaign record holds it", (await prisma.communityCampaign.findUnique({ where: { id: camp.id } })).supplierInventoryStatus === "NO_LONGER_AVAILABLE");

  console.log("\n=== CB67 ASK A QUESTION");
  r = await call("POST", `/supplier/campaigns/${camp.id}/question`, tokenFor(other), { question: "Hello" });
  check(`someone else can't ask [${r.status}]`, r.status === 404 || r.status === 403, r.body);
  r = await call("POST", `/supplier/campaigns/${camp.id}/question`, tokenFor(sup), { question: "  " });
  check(`needs a question [${r.status}]`, r.status === 400, r.body);
  r = await call("POST", `/supplier/campaigns/${camp.id}/question`, tokenFor(sup), { question: "When is collection?" });
  check(`question sent [${r.status}]`, r.status === 201, r.body);
  const cases = await prisma.communityBuySupportCase.findMany({ where: { campaignId: camp.id, participantId: sup.id } });
  check("reaches the support queue", cases.length === 1 && cases[0].description.includes("When is collection?"), cases);
  r = await call("GET", "/community-buy/support-cases", tokenFor(sup));
  check("supplier can see it to read the reply", JSON.stringify(r.body).includes("When is collection?"), r.body);

  console.log("\n=== CB65 ORGANISER HISTORY");
  r = await call("GET", "/organiser/history", tokenFor(other));
  check(`no profile reads as empty [${r.status}]`, r.status === 200 && r.body.campaignsOrganised === 0 && r.body.participantCompletionRate === null, r.body);
  const done = await prisma.communityCampaign.create({ data: { organiserId: organiser.id, title: "Done " + run, country: "GB", currency: "GBP", targetAmount: 1000, status: "COMPLETED" } });
  await prisma.communityCampaign.create({ data: { organiserId: organiser.id, title: "Draft " + run, country: "GB", currency: "GBP", targetAmount: 1000, status: "DRAFT" } });
  const part = await prisma.campaignParticipant.create({ data: { campaignId: done.id, userId: buyer.id } });
  for (const status of ["PAID", "PAID", "PAID", "CHARGE_FAILED"]) await prisma.campaignContribution.create({ data: { campaignId: done.id, participantId: part.id, quantity: 1, amount: 1000, currency: "GBP", status } });
  await prisma.communityBuySupportCase.create({ data: { campaignId: done.id, participantId: buyer.id, caseType: "FULFILMENT_ISSUE", description: "Late" } });
  r = await call("GET", "/organiser/history", tokenFor(org));
  check(`history counts correctly [${r.status}]`, r.body.campaignsOrganised === 2 && r.body.successfulCampaigns === 1 && r.body.participantCompletionRate === 75 && r.body.fulfilmentIssues === 1, r.body);
  check("organiser payments off without a rate", r.body.organiserPaymentsEnabled === false, r.body);
  r = await call("GET", "/organiser/history", null);
  check("signed out refused", r.status === 401, r.status);

  console.log(`\nRESULT ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
