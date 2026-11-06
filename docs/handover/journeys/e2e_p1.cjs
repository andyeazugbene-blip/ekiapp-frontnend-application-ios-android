// End-to-end check of the Phase 1 supplier offer journey, against the local verification database only.
const crypto = require("crypto");
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
const failures = [];
const section = (s) => console.log("\n=== " + s);
function check(name, ok, detail) {
  if (ok) { pass++; console.log("  PASS " + name); }
  else { fail++; failures.push(name); console.log("  FAIL " + name + (detail ? "  -> " + String(detail).slice(0, 300) : "")); }
  return ok;
}
async function call(method, p, token, body) {
  const res = await fetch(API + p, {
    method,
    headers: { "content-type": "application/json", ...(token ? { authorization: "Bearer " + token } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text.slice(0, 200) }; }
  return { status: res.status, body: json };
}
const tokenFor = (u) => jwt.sign({ sub: u.id, role: u.role, email: u.email, tv: u.tokenVersion }, process.env.JWT_SECRET, { expiresIn: "2h" });
async function register(label, extra = {}) {
  const u = await prisma.user.create({ data: { email: `${label}.${run}@example.test`, password: "x", name: `${label} ${run}`, country: "United Kingdom", role: "BUYER", emailVerifiedAt: new Date(), ...extra } });
  return { user: u, token: tokenFor(u) };
}
const expectStatus = (name, r, ...codes) => check(`${name} [${r.status}]`, codes.includes(r.status), JSON.stringify(r.body));
const inDays = (d) => new Date(Date.now() + d * 864e5).toISOString();

const OFFER = {
  foodstuffName: "Puna yam " + run, description: "Fresh yam", packSize: "10kg box", weightGrams: 10000, images: ["https://example.test/y.jpg"],
  pricePerShareMinor: 4000, minimumShares: 3, maximumShares: 6, windowStartsAt: inDays(0), windowEndsAt: inDays(30),
  fulfilmentMethods: ["COLLECTION"], collectionAddressLine1: "1 Market St", collectionCity: "Coventry", collectionPostcode: "CV1 1AA", leadTimeDays: 3,
};

(async () => {
  const adminUser = await prisma.user.findUniqueOrThrow({ where: { email: "seed_qa_admin@example.com" } });
  const superRole = await prisma.adminRole.findUniqueOrThrow({ where: { name: "Super Administrator" } });
  await prisma.adminRoleAssignment.upsert({ where: { roleId_userId: { roleId: superRole.id, userId: adminUser.id } }, create: { roleId: superRole.id, userId: adminUser.id }, update: {} });
  const admin = tokenFor(adminUser);
  await prisma.marketConfiguration.updateMany({ where: { countryCode: "GB" }, data: { communityBuyEnabled: true, communityBuyPaymentsEnabled: true, organiserApplicationsEnabled: true, paymentMode: "TEST", communityBuyPaymentMode: "PLEDGE_THEN_CHARGE", communityBuyOffersRequired: false } });

  section("SUPPLIER OFFER");
  const sup = await register("sup");
  const buyer = await register("buyer");
  const organiser = await register("organiser");
  let r = await call("POST", "/supplier/offers", sup.token, OFFER);
  check(`no supplier details yet is refused cleanly [${r.status}]`, r.status === 409 && r.body.code === "SUPPLIER_DETAILS_REQUIRED", JSON.stringify(r.body));
  const account = await prisma.supplierAccount.create({
    data: {
      userId: sup.user.id, supplierState: "UNDER_REVIEW", businessName: "Ade Foods " + run, categories: ["Grains"], coverageRegions: ["GB"],
      fulfilmentMethods: ["COLLECTION"], termsAcceptedAt: new Date(), providerConnectedAccountId: "acct_verify", chargesEnabled: true, payoutsEnabled: true, detailsSubmitted: true,
    },
  });
  r = await call("POST", "/supplier/offers", sup.token, { ...OFFER, maximumShares: 2 });
  check(`server refuses max below min [${r.status}]`, r.status === 400 && r.body.code === "OFFER_INVALID", JSON.stringify(r.body));
  r = await call("POST", "/supplier/offers", sup.token, OFFER);
  expectStatus("offer saved", r, 201);
  const offerId = r.body.offer?.id;
  check("offer starts as draft", r.body.offer?.status === "DRAFT", JSON.stringify(r.body.offer));

  r = await call("GET", "/organiser/offers", organiser.token);
  check("draft offer invisible to organisers", !(r.body.items ?? []).some((o) => o.id === offerId), JSON.stringify(r.body));

  const [s1, s2] = await Promise.all([call("POST", `/supplier/offers/${offerId}/submit`, sup.token, {}), call("POST", `/supplier/offers/${offerId}/submit`, sup.token, {})]);
  check(`double tap on submit both succeed [${s1.status},${s2.status}]`, s1.status === 200 && s2.status === 200, JSON.stringify([s1.body, s2.body]));
  const offerRequests = await prisma.reviewRequest.findMany({ where: { subjectType: "SupplierOffer", subjectId: offerId } });
  check("double tap creates exactly one request", offerRequests.length === 1, JSON.stringify(offerRequests.map((x) => x.id)));
  const eligibility = await prisma.reviewRequest.findMany({ where: { subjectType: "SupplierAccount", subjectId: account.id } });
  check("first offer also opens one eligibility request", eligibility.length === 1 && eligibility[0].type === "SUPPLIER_ELIGIBILITY");
  check("targets: 24h for offer, 72h for eligibility", Math.round((offerRequests[0].slaDueAt - offerRequests[0].submittedAt) / 36e5) === 24 && Math.round((eligibility[0].slaDueAt - eligibility[0].submittedAt) / 36e5) === 72);

  section("APPROVALS QUEUE");
  r = await call("GET", "/admin/approvals-queue", buyer.token);
  check(`buyer blocked from queue [${r.status}]`, r.status === 403);
  r = await call("GET", "/admin/approvals-queue", null);
  check(`anonymous blocked from queue [${r.status}]`, r.status === 401);
  r = await call("GET", "/admin/approvals-queue", admin);
  expectStatus("admin opens queue", r, 200);
  const row = (r.body.items ?? []).find((x) => x.id === offerRequests[0].id);
  check("admin finds it with right type and submitter", row?.type === "SUPPLIER_OFFER" && row?.submittedById === sup.user.id, JSON.stringify(row));
  check("queue shows a readable name", row?.subjectLabel === OFFER.foodstuffName, row?.subjectLabel);
  r = await call("GET", "/admin/approvals-queue?type=SUPPLIER_ELIGIBILITY", admin);
  check("queue filters by type", (r.body.items ?? []).every((x) => x.type === "SUPPLIER_ELIGIBILITY") && (r.body.items ?? []).length >= 1);
  r = await call("GET", `/admin/approvals-queue/${offerRequests[0].id}`, admin);
  check("detail shows subject and submitter's checks", r.body.subject?.foodstuffName === OFFER.foodstuffName && r.body.submitter?.email === sup.user.email, JSON.stringify(r.body).slice(0, 200));

  r = await call("POST", `/admin/approvals-queue/${offerRequests[0].id}/approve`, admin, {});
  check(`offer can't be approved before eligibility [${r.status}]`, r.status === 409 && r.body.code === "SUPPLIER_NOT_ELIGIBLE", JSON.stringify(r.body));
  r = await call("POST", `/admin/approvals-queue/${eligibility[0].id}/approve`, admin, {});
  expectStatus("eligibility approved", r, 200);
  const grant = await prisma.capabilityGrant.findUnique({ where: { userId_capability_market: { userId: sup.user.id, capability: "SUPPLIER", market: "GB" } } });
  check("supplier capability granted", grant?.status === "ACTIVE", JSON.stringify(grant));
  r = await call("POST", `/admin/approvals-queue/${offerRequests[0].id}/approve`, admin, {});
  expectStatus("offer approved", r, 200);
  const approved = await prisma.supplierOffer.findUnique({ where: { id: offerId } });
  check("offer is live", approved.status === "APPROVED");
  const audit = await prisma.auditLog.count({ where: { entityType: "ReviewRequest", entityId: offerRequests[0].id, action: "review_request.approved" } });
  check("decision audited", audit === 1);
  const supNotice = await prisma.notification.findFirst({ where: { userId: sup.user.id, body: { contains: "Organisers can now build Community Buys on it." } } });
  check("supplier got the required message", !!supNotice);
  r = await call("POST", `/admin/approvals-queue/${offerRequests[0].id}/approve`, admin, {});
  check(`decided request can't be decided again [${r.status}]`, r.status === 409);

  section("REJECT AND INFO");
  r = await call("POST", "/supplier/offers", sup.token, { ...OFFER, foodstuffName: "Rice " + run });
  const offer2 = r.body.offer.id;
  await call("POST", `/supplier/offers/${offer2}/submit`, sup.token, {});
  let req2 = await prisma.reviewRequest.findFirst({ where: { subjectId: offer2 } });
  r = await call("POST", `/admin/approvals-queue/${req2.id}/request-information`, admin, { message: "What brand?" });
  expectStatus("info requested", r, 200);
  r = await call("GET", `/supplier/offers/${offer2}`, sup.token);
  check("supplier sees the admin's message", r.body.offer?.review?.status === "INFO_REQUIRED" && r.body.offer?.review?.infoMessage === "What brand?", JSON.stringify(r.body).slice(0, 240));
  r = await call("POST", `/supplier/offers/${offer2}/submit`, sup.token, {});
  expectStatus("resubmits after info", r, 200);
  r = await call("POST", `/admin/approvals-queue/${req2.id}/reject`, admin, { reasonCode: "nope" });
  check(`rejection needs a listed reason [${r.status}]`, r.status === 400, JSON.stringify(r.body));
  r = await call("POST", `/admin/approvals-queue/${req2.id}/reject`, admin, { reasonCode: "Wording needs changing", detail: "Add the brand" });
  expectStatus("rejected with reason", r, 200);
  r = await call("GET", `/supplier/offers/${offer2}`, sup.token);
  check("reason shown and draft kept", r.body.offer?.foodstuffName?.startsWith("Rice") && /Add the brand/.test(r.body.offer?.review?.decisionReason ?? ""), JSON.stringify(r.body).slice(0, 240));

  section("ORGANISER");
  r = await call("GET", "/organiser/offers", organiser.token);
  const card = (r.body.items ?? []).find((o) => o.id === offerId);
  check("approved offer visible, with supplier name and badge", card?.supplierName?.startsWith("Ade Foods") && card?.verifiedSupplier === true, JSON.stringify(r.body).slice(0, 240));
  check("rejected offer stays hidden", !(r.body.items ?? []).some((o) => o.id === offer2));
  check("offer card exposes no account details", !JSON.stringify(card).includes("acct_verify") && !JSON.stringify(card).includes(sup.user.email));
  r = await call("POST", "/organiser/demand-requests", organiser.token, { foodstuff: "Garri", area: "CV1" });
  expectStatus("foodstuff request saved", r, 201);
  r = await call("GET", "/admin/approvals-queue/demand", admin);
  check("admin sees demand grouped by foodstuff", (r.body.items ?? []).some((d) => d.foodstuff === "Garri"), JSON.stringify(r.body));

  r = await call("POST", "/organiser/offer-campaigns", organiser.token, { offerId, goalShares: 99 });
  check(`goal outside offer refused by server [${r.status}]`, r.status === 400 && r.body.code === "CAMPAIGN_OUTSIDE_OFFER_LIMITS", JSON.stringify(r.body));
  r = await call("POST", "/organiser/offer-campaigns", organiser.token, { offerId, deadline: inDays(90) });
  check(`deadline outside offer refused by server [${r.status}]`, r.status === 400 && r.body.code === "CAMPAIGN_OUTSIDE_OFFER_LIMITS", JSON.stringify(r.body));
  r = await call("POST", "/organiser/offer-campaigns", organiser.token, { offerId, goalShares: 5, deadline: inDays(10), groupName: "Coventry yam group", pricePerShareMinor: 1, minimumShares: 1 });
  expectStatus("draft created at once for a new user", r, 201);
  const campId = r.body.campaign?.id;
  check("price and quantities come from the offer", r.body.campaign?.pricePerShareMinor === 4000 && r.body.campaign?.minimumShares === 3 && r.body.campaign?.maximumShares === 6 && r.body.campaign?.goalShares === 5, JSON.stringify(r.body.campaign).slice(0, 300));
  check("campaign linked and supplier committed", r.body.campaign?.supplierOfferId === offerId && r.body.campaign?.supplierCommitted === true);
  const invited = await prisma.notification.count({ where: { userId: sup.user.id, title: "New Community Buy invitation" } });
  check("supplier isn't asked to accept their own offer", invited === 0);

  r = await call("POST", `/organiser/offer-campaigns/${campId}/submit`, organiser.token, {});
  check(`can't go live without phone; only that is asked [${r.status}]`, r.status === 409 && r.body.code === "ORGANISER_CHECKS_MISSING" && JSON.stringify(r.body.details?.missing) === '["phone"]', JSON.stringify(r.body));
  const draft = await prisma.communityCampaign.findUnique({ where: { id: campId } });
  check("draft kept", draft.status === "DRAFT");

  r = await call("POST", "/organiser/checks/phone/send", organiser.token, { phone: "12345" });
  check(`bad phone refused [${r.status}]`, r.status === 400 && r.body.code === "PHONE_INVALID");
  const phone = "+4477009" + String(Date.now()).slice(-5);
  r = await call("POST", "/organiser/checks/phone/send", organiser.token, { phone });
  expectStatus("code sent", r, 200);
  r = await call("POST", "/organiser/checks/phone/confirm", organiser.token, { code: "000000" });
  check(`wrong code refused [${r.status}]`, r.status === 400 && r.body.code === "PHONE_CODE_WRONG", JSON.stringify(r.body));
  const code = "123456";
  await prisma.phoneVerification.update({ where: { userId: organiser.user.id }, data: { codeHash: crypto.createHash("sha256").update(`${organiser.user.id}:${code}`).digest("hex") } });
  r = await call("POST", "/organiser/checks/phone/confirm", organiser.token, { code });
  check(`right code verifies [${r.status}]`, r.status === 200 && r.body.verified === true && r.body.missing.length === 0, JSON.stringify(r.body));

  const [c1, c2] = await Promise.all([call("POST", `/organiser/offer-campaigns/${campId}/submit`, organiser.token, {}), call("POST", `/organiser/offer-campaigns/${campId}/submit`, organiser.token, {})]);
  console.log("  info submit outcomes", c1.status, c1.body.outcome ?? c1.body.message, c2.status, c2.body.outcome ?? c2.body.message);
  r = await call("POST", `/organiser/offer-campaigns/${campId}/submit`, organiser.token, {});
  check("first campaign goes to manual review", r.body.outcome === "IN_REVIEW", JSON.stringify(r.body).slice(0, 240));
  const campRequests = await prisma.reviewRequest.findMany({ where: { subjectType: "CommunityCampaign", subjectId: campId } });
  check("exactly one campaign request", campRequests.length === 1, String(campRequests.length));
  r = await call("POST", `/organiser/campaigns/${campId}/interest`, buyer.token, {});
  check("coming-soon interest saved without payment", r.status === 200 && r.body.count === 1, JSON.stringify(r.body));
  r = await call("GET", "/community-buy/campaigns", buyer.token);
  check("campaign in review isn't listed for buyers", !(r.body.items ?? []).some((c) => c.id === campId));

  r = await call("POST", `/admin/approvals-queue/${campRequests[0].id}/approve`, admin, {});
  expectStatus("admin approves campaign", r, 200);
  const live = await prisma.communityCampaign.findUnique({ where: { id: campId } });
  check("campaign goes live", live.status === "LIVE", live.status);
  r = await call("GET", "/community-buy/campaigns", buyer.token);
  check("buyer can now see it", (r.body.items ?? []).some((c) => c.id === campId), JSON.stringify(r.body).slice(0, 200));
  const liveNotice = await prisma.notification.findFirst({ where: { userId: organiser.user.id, body: "Your Community Buy is live. Share it to reach the minimum." } });
  check("organiser got the required message", !!liveNotice);
  const startNotice = await prisma.notification.findFirst({ where: { userId: sup.user.id, body: { contains: "has started on your offer." } } });
  check("supplier got the required message", !!startNotice);
  const orgGrant = await prisma.capabilityGrant.findUnique({ where: { userId_capability_market: { userId: organiser.user.id, capability: "ORGANISER", market: "GB" } } });
  check("organiser capability active", orgGrant?.status === "ACTIVE");
  r = await call("GET", "/supplier/offer-orders", sup.token);
  check("supplier sees campaigns on their offer", (r.body.items ?? []).some((c) => c.id === campId), JSON.stringify(r.body).slice(0, 200));

  r = await call("POST", "/supplier/offers/" + offerId, sup.token, {});
  r = await call("PATCH", `/supplier/offers/${offerId}`, sup.token, { ...OFFER, pricePerShareMinor: 5000 });
  check(`offer in use can't change price [${r.status}]`, r.status === 409 && r.body.code === "OFFER_IN_USE", JSON.stringify(r.body));

  section("AUTO-APPROVAL");
  await prisma.communityCampaign.update({ where: { id: campId }, data: { status: "COMPLETED" } });
  r = await call("POST", "/organiser/offer-campaigns", organiser.token, { offerId, goalShares: 4, deadline: inDays(12), groupName: "Second yam group" });
  const camp2 = r.body.campaign?.id;
  r = await call("POST", `/organiser/offer-campaigns/${camp2}/submit`, organiser.token, {});
  check("second campaign auto-approves", r.status === 200 && r.body.outcome === "LIVE" && r.body.campaign?.status === "LIVE", JSON.stringify(r.body).slice(0, 300));
  const auto = await prisma.reviewRequest.findFirst({ where: { subjectId: camp2 } });
  check("auto-approval leaves a record", auto?.autoApproved === true && auto?.status === "APPROVED", JSON.stringify(auto));
  r = await call("POST", `/organiser/offer-campaigns/${camp2}/withdraw`, organiser.token, {});
  check(`withdraw before anyone joins returns to draft [${r.status}]`, r.status === 200 && r.body.campaign?.status === "DRAFT", JSON.stringify(r.body).slice(0, 200));

  r = await call("POST", "/organiser/offer-campaigns", organiser.token, { offerId, goalShares: 4, deadline: inDays(12), groupName: "Guaranteed savings" });
  const camp3 = r.body.campaign?.id;
  r = await call("POST", `/organiser/offer-campaigns/${camp3}/submit`, organiser.token, {});
  check("banned wording means manual review", r.body.outcome === "IN_REVIEW", JSON.stringify(r.body).slice(0, 200));

  section("MARKET FLAG");
  const legacy = { title: "Legacy " + run, country: "GB", currency: "GBP", deadline: inDays(9) };
  r = await call("POST", "/organiser/campaigns", organiser.token, legacy);
  check(`flag off: existing flow still works [${r.status}]`, r.status === 201, JSON.stringify(r.body).slice(0, 200));
  await prisma.marketConfiguration.updateMany({ where: { countryCode: "GB" }, data: { communityBuyOffersRequired: true } });
  r = await call("POST", "/organiser/campaigns", organiser.token, legacy);
  check(`flag on: organisers can't type their own price [${r.status}]`, r.status === 409 && r.body.code === "SUPPLIER_OFFER_REQUIRED", JSON.stringify(r.body).slice(0, 200));
  r = await call("POST", "/organiser/offer-campaigns", organiser.token, { offerId, goalShares: 4, deadline: inDays(12) });
  check(`flag on: offer flow works [${r.status}]`, r.status === 201, JSON.stringify(r.body).slice(0, 200));
  await prisma.marketConfiguration.updateMany({ where: { countryCode: "GB" }, data: { communityBuyOffersRequired: false } });

  section("DEMO BOUNDARY");
  const demo = await register("demoorg", { isTest: true });
  r = await call("GET", "/organiser/offers", demo.token);
  check("demo organiser doesn't see real offers", !(r.body.items ?? []).some((o) => o.id === offerId), JSON.stringify(r.body).slice(0, 200));
  r = await call("POST", "/organiser/offer-campaigns", demo.token, { offerId });
  check(`demo organiser can't build on real offer [${r.status}]`, r.status === 404, JSON.stringify(r.body));

  console.log(`\nRESULT pass=${pass} fail=${fail}`);
  if (fail) console.log("FAILED:\n - " + failures.join("\n - "));
})()
  .catch((e) => { console.log("CRASH", String(e.stack).slice(0, 900)); console.log(`\nRESULT pass=${pass} fail=${fail}`); })
  .finally(() => prisma.$disconnect());
