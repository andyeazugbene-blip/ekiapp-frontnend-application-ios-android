// Extension journey against the local verification database only.
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
const inDays = (d) => new Date(Date.now() + d * 864e5);
const user = (label) => prisma.user.create({ data: { email: `${label}.${run}@example.test`, password: "x", name: `${label} ${run}`, country: "United Kingdom", role: "BUYER", emailVerifiedAt: new Date() } });

async function campaignFor(supplierAccount, organiser, offer, title, extra = {}) {
  return prisma.communityCampaign.create({
    data: {
      organiserId: organiser.id, supplierAccountId: supplierAccount.id, supplierOfferId: offer.id, title: title + " " + run, country: "GB", currency: "GBP", targetAmount: 40000,
      status: "LIVE", pricePerShareMinor: 4000, minimumShares: 10, goalShares: 20, maximumShares: 30, deadline: inDays(5), ...extra,
    },
  });
}

(async () => {
  const adminUser = await prisma.user.findUniqueOrThrow({ where: { email: "seed_qa_admin@example.com" } });
  const superRole = await prisma.adminRole.findUniqueOrThrow({ where: { name: "Super Administrator" } });
  await prisma.adminRoleAssignment.upsert({ where: { roleId_userId: { roleId: superRole.id, userId: adminUser.id } }, create: { roleId: superRole.id, userId: adminUser.id }, update: {} });
  const admin = tokenFor(adminUser);
  const sup = await user("sup");
  const org = await user("org");
  const other = await user("other");
  const account = await prisma.supplierAccount.create({ data: { userId: sup.id, supplierState: "APPROVED", approvedAt: new Date(), businessName: "Ext Foods " + run, categories: ["Grains"], coverageRegions: ["GB"], fulfilmentMethods: ["COLLECTION"], termsAcceptedAt: new Date() } });
  const organiser = await prisma.organiserProfile.create({ data: { userId: org.id, country: "GB" } });
  const offer = await prisma.supplierOffer.create({
    data: { supplierAccountId: account.id, market: "GB", currency: "GBP", status: "APPROVED", approvedAt: new Date(), foodstuffName: "Yam " + run, description: "Yam", packSize: "10kg", weightGrams: 10000, images: [], pricePerShareMinor: 4000, minimumShares: 3, maximumShares: 40, windowStartsAt: inDays(-1), windowEndsAt: inDays(30), fulfilmentMethods: ["COLLECTION"], collectionAddressLine1: "1 Market St", collectionCity: "Coventry", collectionPostcode: "CV1 1AA", leadTimeDays: 3 },
  });
  const camp = await campaignFor(account, organiser, offer, "First");
  const url = `/organiser/campaigns/${camp.id}/rescue/extension-request`;
  const body = (d, extra = {}) => ({ requestedDeadline: inDays(d).toISOString(), reason: "Need more time", supplierReconfirmed: true, priceUnchangedConfirmed: true, participantTermsUnchanged: true, ...extra });

  console.log("\n=== ASKING");
  let r = await call("POST", url, tokenFor(other), body(10));
  check(`someone else can't ask [${r.status}]`, r.status === 403 || r.status === 404, r.body);
  r = await call("POST", url, tokenFor(org), body(3));
  check(`an earlier date is refused [${r.status}]`, r.status === 400 && r.body.code === "EXTENSION_NOT_LATER", r.body);
  r = await call("POST", url, tokenFor(org), body(60));
  check(`past the offer's window is refused [${r.status}]`, r.status === 400 && r.body.code === "CAMPAIGN_OUTSIDE_OFFER_LIMITS", r.body);
  r = await call("POST", url, tokenFor(org), body(10));
  check(`organiser asks while live [${r.status}]`, r.status === 201, r.body);
  const ext = r.body.extensionRequest;
  check("organiser can't vouch for the supplier", ext?.supplierReconfirmed === false, ext);
  r = await call("POST", url, tokenFor(org), body(12));
  check(`a second open request is refused [${r.status}]`, r.status === 409 && r.body.code === "EXTENSION_ALREADY_OPEN", r.body);

  console.log("\n=== APPROVALS QUEUE");
  r = await call("GET", "/admin/approvals-queue?type=EXTENSION", admin);
  const row = (r.body.items || r.body.requests || []).find((x) => x.subjectId === camp.id);
  check("request appears in Approvals", !!row && row.type === "EXTENSION", r.body);
  r = await call("POST", `/admin/approvals-queue/${row.id}/approve`, admin, {});
  check(`can't approve before the supplier confirms [${r.status}]`, r.status === 409 && r.body.code === "SUPPLIER_NOT_RECONFIRMED", r.body);
  r = await call("POST", `/admin/approvals-queue/${row.id}/request-information`, admin, { message: "why" });
  check(`no information step for an extension [${r.status}]`, r.status === 409 || r.status === 404, r.body);

  console.log("\n=== SUPPLIER");
  r = await call("POST", `/supplier/offer-extensions/${ext.id}/reconfirm`, tokenFor(other), { canSupply: true });
  check(`another user can't confirm [${r.status}]`, r.status === 403 || r.status === 404, r.body);
  r = await call("GET", "/supplier/offer-orders", tokenFor(sup));
  const order = (r.body.items || []).find((x) => x.id === camp.id);
  check("supplier sees the question", order?.extensionRequests?.[0]?.id === ext.id && order.extensionRequests[0].supplierReconfirmed === false, order);
  r = await call("POST", `/supplier/offer-extensions/${ext.id}/reconfirm`, tokenFor(sup), { canSupply: true });
  check(`supplier confirms [${r.status}]`, r.status === 200 && r.body.extensionRequest.supplierReconfirmed === true, r.body);

  console.log("\n=== DECISION");
  r = await call("POST", `/admin/approvals-queue/${row.id}/approve`, admin, {});
  check(`admin approves in the queue [${r.status}]`, r.status === 200, r.body);
  let c = await prisma.communityCampaign.findUnique({ where: { id: camp.id } });
  check("deadline moved, extension used, still live", c.status === "LIVE" && c.extensionCount === 1 && c.deadline > inDays(9), c);
  r = await call("POST", url, tokenFor(org), body(14));
  check(`only one extension per campaign [${r.status}]`, r.status === 409, r.body);
  r = await call("GET", "/admin/approvals-queue?type=EXTENSION", admin);
  check("gone from the open queue", !(r.body.items || r.body.requests || []).some((x) => x.subjectId === camp.id && x.status === "SUBMITTED"), r.body);

  console.log("\n=== SUPPLIER DECLINES");
  const camp2 = await campaignFor(account, organiser, offer, "Second");
  r = await call("POST", `/organiser/campaigns/${camp2.id}/rescue/extension-request`, tokenFor(org), body(10));
  const ext2 = r.body.extensionRequest;
  r = await call("POST", `/supplier/offer-extensions/${ext2.id}/reconfirm`, tokenFor(sup), { canSupply: false });
  check(`supplier declines [${r.status}]`, r.status === 200 && r.body.extensionRequest.status === "REJECTED", r.body);
  const queued = await prisma.reviewRequest.findFirst({ where: { type: "EXTENSION", subjectId: camp2.id } });
  check("queue closes with it", queued?.status === "REJECTED", queued);
  c = await prisma.communityCampaign.findUnique({ where: { id: camp2.id } });
  check("deadline unchanged", c.extensionCount === 0 && c.deadline < inDays(6), c);

  console.log("\n=== ADMIN DECLINES");
  const camp3 = await campaignFor(account, organiser, offer, "Third");
  r = await call("POST", `/organiser/campaigns/${camp3.id}/rescue/extension-request`, tokenFor(org), body(10));
  const q3 = await prisma.reviewRequest.findFirst({ where: { type: "EXTENSION", subjectId: camp3.id } });
  r = await call("POST", `/admin/approvals-queue/${q3.id}/reject`, admin, { reasonCode: "Other", detail: "No" });
  check(`admin declines in the queue [${r.status}]`, r.status === 200, r.body);
  const e3 = await prisma.campaignExtensionRequest.findFirst({ where: { campaignId: camp3.id } });
  check("extension marked declined", e3?.status === "REJECTED", e3);

  console.log("\n=== CARD HOLDS");
  const camp4 = await campaignFor(account, organiser, offer, "Fourth", { paymentMode: "AUTHORISE_THEN_CAPTURE", holdWindowStartsAt: inDays(-1), decisionDeadline: inDays(6) });
  r = await call("POST", `/organiser/campaigns/${camp4.id}/rescue/extension-request`, tokenFor(org), body(10));
  check(`refused once holds have started [${r.status}]`, r.status === 409 && r.body.code === "EXTENSION_AFTER_HOLDS", r.body);
  const camp5 = await campaignFor(account, organiser, offer, "Fifth", { paymentMode: "AUTHORISE_THEN_CAPTURE", holdWindowStartsAt: inDays(3), decisionDeadline: inDays(6) });
  r = await call("POST", `/organiser/campaigns/${camp5.id}/rescue/extension-request`, tokenFor(org), body(10));
  const ext5 = r.body.extensionRequest;
  await call("POST", `/supplier/offer-extensions/${ext5.id}/reconfirm`, tokenFor(sup), { canSupply: true });
  const q5 = await prisma.reviewRequest.findFirst({ where: { type: "EXTENSION", subjectId: camp5.id } });
  r = await call("POST", `/admin/approvals-queue/${q5.id}/approve`, admin, {});
  c = await prisma.communityCampaign.findUnique({ where: { id: camp5.id } });
  check(`hold schedule follows the new deadline [${r.status}]`, r.status === 200 && Math.abs(c.holdWindowStartsAt.getTime() - (c.deadline.getTime() - 48 * 36e5)) < 1000 && Math.abs(c.decisionDeadline.getTime() - (c.deadline.getTime() + 24 * 36e5)) < 1000, c);

  console.log("\n=== DAILY DEMAND DIGEST");
  await prisma.demandRequest.create({ data: { userId: org.id, foodstuff: "Egusi " + run, market: "GB" } }).catch(async (e) => { console.log(String(e.message).slice(-300)); throw e; });
  await prisma.notification.deleteMany({ where: { userId: adminUser.id, title: "Foodstuff requests today" } });
  const secret = process.env.CRON_SECRET;
  const res = await fetch(`${API}/internal/jobs/demand-digest`, { method: "POST", headers: { authorization: `Bearer ${secret}` } });
  const dj = await res.json();
  check(`digest job runs [${res.status}]`, res.status === 200 && dj.foodstuffs >= 1, dj);
  const inbox = await prisma.notification.findMany({ where: { userId: adminUser.id, title: "Foodstuff requests today" } });
  check("admin gets it, with the foodstuff named", inbox.some((n) => n.body.includes("Egusi " + run)), inbox.length);

  console.log(`\nRESULT ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
