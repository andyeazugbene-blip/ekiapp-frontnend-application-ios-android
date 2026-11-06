// Community Buy stage 4 against the local verification database only.
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
const inDays = (d) => new Date(Date.now() + d * 864e5);
const user = (label, extra = {}) => prisma.user.create({ data: { email: `${label}.${run}@example.test`, password: "x", name: `${label} ${run}`, country: "United Kingdom", role: "BUYER", emailVerifiedAt: new Date(), ...extra } });

(async () => {
  const adminUser = await prisma.user.findUniqueOrThrow({ where: { email: "seed_qa_admin@example.com" } });
  const superRole = await prisma.adminRole.findUniqueOrThrow({ where: { name: "Super Administrator" } });
  await prisma.adminRoleAssignment.upsert({ where: { roleId_userId: { roleId: superRole.id, userId: adminUser.id } }, create: { roleId: superRole.id, userId: adminUser.id }, update: {} });
  const admin = tokenFor(adminUser);
  const org = await user("org");
  const buyer = await user("buyer");
  const other = await user("other");
  const organiser = await prisma.organiserProfile.create({ data: { userId: org.id, country: "GB" } });
  await prisma.marketConfiguration.updateMany({ where: { countryCode: "GB" }, data: { communityBuyEnabled: true, deadlineExtensionEnabled: true, organiserTopUpEnabled: true } });

  console.log("\n=== PART L FLAGS");
  let r = await call("GET", "/community-buy/markets/GB");
  check("public view has the flags", r.body.config?.organiserTopUpEnabled === true && r.body.config?.deadlineExtensionEnabled === true && r.body.config?.marketRefundTimeframe === "5 to 10 business days", r.body);
  check("public view hides the refund route and fee flag", r.body.config && !("refundRoute" in r.body.config) && !("organiserFeeEnabled" in r.body.config), r.body.config);
  const camp = await prisma.communityCampaign.create({ data: { organiserId: organiser.id, title: "Yam " + run, country: "GB", currency: "GBP", targetAmount: 40000, status: "RESCUE_WINDOW", pricePerShareMinor: 4000, minimumShares: 10, goalShares: 20, maximumShares: 30, deadline: inDays(1), rescueEndsAt: inDays(2) } });
  const gb = await prisma.marketConfiguration.findFirst({ where: { countryCode: "GB" } });
  const patch = (data) => call("PATCH", `/admin/community-buy/markets/${gb.countryCode}`, admin, { ...data, reason: "local test run" });
  r = await patch({ deadlineExtensionEnabled: false, organiserTopUpEnabled: false, marketRefundTimeframe: "3 to 5 business days", supportedPaymentMethods: ["CARD", "APPLE_PAY"] });
  check(`admin can change them [${r.status}]`, r.status === 200, r.body);
  r = await call("GET", "/community-buy/markets/GB");
  check("change shows straight away", r.body.config?.deadlineExtensionEnabled === false && r.body.config?.marketRefundTimeframe === "3 to 5 business days", r.body.config);
  r = await call("POST", `/organiser/campaigns/${camp.id}/rescue/extension-request`, tokenFor(org), { requestedDeadline: inDays(9).toISOString(), reason: "More", supplierReconfirmed: true, priceUnchangedConfirmed: true, participantTermsUnchanged: true });
  check(`extension off is refused [${r.status}]`, r.status === 409 && r.body.code === "EXTENSION_NOT_AVAILABLE", r.body);
  r = await call("POST", `/organiser/campaigns/${camp.id}/rescue/top-up`, tokenFor(org), { quantity: 1, paymentMethodId: "pm_card_visa" });
  check(`top-up off is refused [${r.status}]`, r.status === 409 && r.body.code === "TOP_UP_NOT_AVAILABLE", r.body);
  r = await patch({ marketRefundTimeframe: "   " });
  check(`empty text refused [${r.status}]`, r.status === 400, r.body);
  await patch({ deadlineExtensionEnabled: true, organiserTopUpEnabled: true, marketRefundTimeframe: "5 to 10 business days", supportedPaymentMethods: ["CARD"] });

  console.log("\n=== CB02 NOTIFY ME");
  const mkt = await prisma.marketConfiguration.findFirst({ where: { countryCode: "CA" } });
  await prisma.marketConfiguration.update({ where: { id: mkt.id }, data: { communityBuyEnabled: true, communityBuyPaymentsEnabled: false } });
  const code = mkt.countryCode;
  await prisma.marketAvailabilityRequest.deleteMany({ where: { market: code } });
  r = await call("PATCH", `/admin/community-buy/markets/${code}`, admin, { communityBuyEnabled: false, organiserApplicationsEnabled: false, supplierApplicationsEnabled: false, reason: "local test run" });
  if (r.status !== 200) console.log("  disable said", r.status, JSON.stringify(r.body).slice(0, 200));
  check("market switched off to start", r.status === 200 && r.body.communityBuyEnabled !== true && (r.body.market?.communityBuyEnabled ?? r.body.config?.communityBuyEnabled ?? false) === false, r.body);
  r = await call("POST", `/community-buy/markets/${code}/notify-me`, null, {});
  check("needs an account", r.status === 401, r.status);
  r = await call("POST", `/community-buy/markets/${code}/notify-me`, tokenFor(buyer), {});
  check(`saved [${r.status}]`, r.status === 201, r.body);
  r = await call("POST", `/community-buy/markets/${code}/notify-me`, tokenFor(buyer), {});
  check("second tap is harmless", r.status === 201 && (await prisma.marketAvailabilityRequest.count({ where: { userId: buyer.id, market: code } })) === 1, r.body);
  r = await call("POST", `/community-buy/markets/nowhere/notify-me`, tokenFor(buyer), {});
  check("nonsense market refused", r.status === 400, r.status);
  r = await call("PATCH", `/admin/community-buy/markets/${code}`, admin, { communityBuyEnabled: true, reason: "local test run" });
  check(`market opens [${r.status}]`, r.status === 200, r.body);
  const told = await prisma.notification.findMany({ where: { userId: buyer.id, title: "Community Buy is available" } });
  check("waiting buyer is told once", told.length === 1, told.length);
  const waitRow = await prisma.marketAvailabilityRequest.findFirst({ where: { userId: buyer.id, market: code } });
  check("marked as told", !!waitRow?.notifiedAt, waitRow);

  console.log("\n=== CB27 RECEIPT");
  const part = await prisma.campaignParticipant.create({ data: { campaignId: camp.id, userId: buyer.id } });
  const contribution = await prisma.campaignContribution.create({ data: { campaignId: camp.id, participantId: part.id, quantity: 2, amount: 8000, buyerServiceFeeAmount: 400, deliveryFeeAmountMinor: 500, currency: "GBP", status: "PAID" } }).catch(async (e) => { console.log(String(e.message).slice(-400)); throw e; });
  r = await call("POST", `/community-buy/contributions/${contribution.id}/receipt-link`, tokenFor(other), {});
  check(`another buyer can't get the link [${r.status}]`, r.status === 404, r.body);
  r = await call("POST", `/community-buy/contributions/${contribution.id}/receipt-link`, tokenFor(buyer), {});
  check(`buyer gets a link [${r.status}]`, r.status === 200 && r.body.url.includes("/receipt/"), r.body);
  const receiptPath = new URL(r.body.url).pathname;
  let res = await fetch(HOST + receiptPath);
  let html = await res.text();
  check("receipt opens with the client's fields", res.status === 200 && ["Contribution receipt", "Contribution reference", "Total paid", "£89.00", "Yam " + run].every((t) => html.includes(t)), html.slice(0, 200));
  check("isn't cached", res.headers.get("cache-control") === "private, no-store", res.headers.get("cache-control"));
  res = await fetch(HOST + receiptPath + "x");
  check("tampered link refused", res.status === 410, res.status);

  console.log("\n=== CB48 PARTICIPANTS");
  r = await call("GET", `/organiser/campaigns/${camp.id}/participants`, tokenFor(org));
  const rows = r.body.items || r.body.participants || [];
  const row = rows.find((x) => x.userId === buyer.id);
  check("organiser sees status and quantity", row?.contributionStatus === "Confirmed" && row?.totalQuantity === 2, r.body);
  check("no payment details exposed", !/pm_|card|stripe|payment/i.test(JSON.stringify(row || {})), row);

  console.log("\n=== CB77 AND CB79");
  r = await call("GET", "/admin/community-buy/operations-summary", tokenFor(buyer));
  check("buyer refused", r.status === 403, r.status);
  r = await call("GET", "/admin/community-buy/operations-summary", admin);
  check(`tiles load [${r.status}]`, r.status === 200 && ["awaitingReview", "liveAtRisk", "completionPeriods", "paymentExceptions", "refundsNeedingAttention", "fulfilmentIssues"].every((k) => typeof r.body[k] === "number"), r.body);
  check("completion period counted", r.body.completionPeriods >= 1, r.body);
  r = await call("GET", `/admin/community-campaigns/${camp.id}/monitoring`, admin);
  check(`monitoring loads with risk [${r.status}]`, r.status === 200 && r.body.risk === "Needs attention" && r.body.confirmedPayments === 1 && r.body.paidShares === 2, r.body);
  await prisma.communityCampaign.update({ where: { id: camp.id }, data: { deadline: inDays(-1) } });
  r = await call("GET", `/admin/community-campaigns/${camp.id}/monitoring`, admin);
  check("outcome counts only confirmed shares", r.body.suggestedOutcome === "Fail campaign", r.body);

  console.log(`\nRESULT ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
