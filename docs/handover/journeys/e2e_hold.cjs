// Two-stage payment against Stripe test mode and the local verification database only.
const path = require("path");
const BACKEND = process.env.EKI_BACKEND_DIR || path.resolve(__dirname, "../../../../ekiapp-backend-main");
const req = (m) => require(path.join(BACKEND, "node_modules", m));
req("dotenv").config({ path: path.join(BACKEND, ".env") });
if (!/localhost:5544\/eki_verify/.test(process.env.DATABASE_URL || "")) throw new Error("Refusing to run: not the verification DB");
if (!(process.env.STRIPE_SECRET_KEY || "").startsWith("sk_test_")) throw new Error("Refusing to run: not a Stripe test key");
const { PrismaClient } = req("@prisma/client");
const Stripe = req("stripe");
const jwt = req("jsonwebtoken");
const prisma = new PrismaClient();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const API = "http://localhost:4177/api";
const run = Date.now().toString(36);
let pass = 0, fail = 0;
const failures = [];
const section = (s) => console.log("\n=== " + s);
function check(name, ok, detail) {
  if (ok) { pass++; console.log("  PASS " + name); }
  else { fail++; failures.push(name); console.log("  FAIL " + name + (detail !== undefined ? "  -> " + String(detail).slice(0, 320) : "")); }
  return ok;
}
async function call(method, p, token, body, headers = {}) {
  const res = await fetch(API + p, {
    method,
    headers: { "content-type": "application/json", ...(token ? { authorization: "Bearer " + token } : {}), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text.slice(0, 200) }; }
  return { status: res.status, body: json };
}
const tokenFor = (u) => jwt.sign({ sub: u.id, role: u.role, email: u.email, tv: u.tokenVersion }, process.env.JWT_SECRET, { expiresIn: "2h" });
async function register(label, extra = {}) {
  const u = await prisma.user.create({ data: { email: `${label}.${run}@example.test`, password: "x", name: `${label} ${run}`, country: "United Kingdom", role: "BUYER", emailVerifiedAt: new Date(), phoneVerifiedAt: new Date(), ...extra } });
  return { user: u, token: tokenFor(u) };
}
const inDays = (d) => new Date(Date.now() + d * 864e5);
const sweep = () => call("POST", "/internal/jobs/community-buy-authorisation-sweep", null, {}, { authorization: "Bearer " + process.env.CRON_SECRET });
const ADDRESS = { recipientName: "Buyer", addressLine1: "1 Test St", city: "Coventry", postcode: "CV1 1AA", phone: "+447700900000", instructions: "Side door" };

async function saveCard(token, contributionId, commit, card) {
  const si = commit.setupIntentClientSecret.split("_secret_")[0];
  await stripe.setupIntents.confirm(si, { payment_method: card, return_url: "https://example.test" });
  return call("POST", `/community-buy/contributions/${contributionId}/confirm-setup`, token, {});
}
const hold = (contributionId) => prisma.communityBuyPaymentAuthorisation.findUnique({ where: { contributionId } });

(async () => {
  const adminUser = await prisma.user.findUniqueOrThrow({ where: { email: "seed_qa_admin@example.com" } });
  const superRole = await prisma.adminRole.findUniqueOrThrow({ where: { name: "Super Administrator" } });
  await prisma.adminRoleAssignment.upsert({ where: { roleId_userId: { roleId: superRole.id, userId: adminUser.id } }, create: { roleId: superRole.id, userId: adminUser.id }, update: {} });
  const admin = tokenFor(adminUser);
  await prisma.marketConfiguration.updateMany({
    where: { countryCode: "GB" },
    data: { communityBuyEnabled: true, communityBuyPaymentsEnabled: true, organiserApplicationsEnabled: true, paymentMode: "TEST", communityBuyPaymentMode: "AUTHORISE_THEN_CAPTURE", communityBuyOffersRequired: true, communityBuyFeeBps: 800, buyerServiceFeeBps: 500, buyerServiceFeeMinAmount: 120, buyerServiceFeeMaxAmount: 500 },
  });

  section("SETUP: harness drops the connected-account header (no Connect on this test account)");
  const account = { id: "acct_harness" };
  const fs = require("fs");
  const FEE_LOG = path.join(__dirname, "fees.log");
  fs.rmSync(FEE_LOG, { force: true });

  const sup = await register("sup");
  const org = await register("org");
  const supAccount = await prisma.supplierAccount.create({
    data: { userId: sup.user.id, supplierState: "APPROVED", approvedAt: new Date(), businessName: "Hold Foods " + run, categories: ["Grains"], coverageRegions: ["GB"], fulfilmentMethods: ["DELIVERY", "COLLECTION"], termsAcceptedAt: new Date(), providerConnectedAccountId: account.id, chargesEnabled: true, payoutsEnabled: true, detailsSubmitted: true },
  });
  const offer = await prisma.supplierOffer.create({
    data: {
      supplierAccountId: supAccount.id, market: "GB", foodstuffName: "Yam " + run, packSize: "10kg", currency: "GBP", pricePerShareMinor: 4000, minimumShares: 2, maximumShares: 8,
      windowStartsAt: new Date(), windowEndsAt: inDays(30), fulfilmentMethods: ["DELIVERY", "COLLECTION"], deliveryAreas: ["CV"], deliveryFeeMinor: 500, collectionAddressLine1: "1 Market St", collectionCity: "Coventry", collectionPostcode: "CV1 1AA", status: "APPROVED", approvedAt: new Date(),
    },
  });

  async function liveCampaign(name, days = 10) {
    const created = await call("POST", "/organiser/offer-campaigns", org.token, { offerId: offer.id, goalShares: 6, deadline: inDays(days).toISOString(), groupName: name, fulfilmentMethod: "DELIVERY" });
    if (created.status !== 201) throw new Error("create campaign " + JSON.stringify(created.body));
    const submitted = await call("POST", `/organiser/offer-campaigns/${created.body.campaign.id}/submit`, org.token, {});
    if (submitted.status !== 200) throw new Error("submit " + JSON.stringify(submitted.body));
    if (submitted.body.outcome !== "LIVE") {
      const request = await prisma.reviewRequest.findFirst({ where: { subjectId: created.body.campaign.id } });
      const approved = await call("POST", `/admin/approvals-queue/${request.id}/approve`, admin, {});
      if (approved.status !== 200) throw new Error("approve " + JSON.stringify(approved.body));
    }
    return prisma.communityCampaign.findUniqueOrThrow({ where: { id: created.body.campaign.id } });
  }

  section("SCHEDULE");
  const camp = await liveCampaign("Coventry yam");
  check("campaign uses two-stage payment, on home delivery", camp.paymentMode === "AUTHORISE_THEN_CAPTURE" && camp.deliveryPreference === "DELIVERY" && camp.status === "LIVE", JSON.stringify({ m: camp.paymentMode, d: camp.deliveryPreference, s: camp.status }));
  check("hold starts 48h before the deadline", Math.round((camp.deadline - camp.holdWindowStartsAt) / 36e5) === 48);
  check("decision is 24h after the deadline", Math.round((camp.decisionDeadline - camp.deadline) / 36e5) === 24);

  section("JOIN: no money moves");
  const a = await register("buyera");
  let r = await call("POST", `/community-buy/campaigns/${camp.id}/commit`, a.token, { quantity: 2 });
  check(`no address refused [${r.status}]`, r.status === 400 && r.body.code === "DELIVERY_ADDRESS_REQUIRED", JSON.stringify(r.body));
  r = await call("POST", `/community-buy/campaigns/${camp.id}/commit`, a.token, { quantity: 2, deliveryAddress: { ...ADDRESS, postcode: "M1 1AA" } });
  check(`postcode outside delivery area refused [${r.status}]`, r.status === 409 && r.body.code === "DELIVERY_ADDRESS_OUT_OF_COVERAGE", JSON.stringify(r.body));
  r = await call("POST", `/community-buy/campaigns/${camp.id}/commit`, a.token, { quantity: 2, deliveryAddress: ADDRESS });
  check(`buyer joins [${r.status}]`, r.status === 201 && !!r.body.setupIntentClientSecret && r.body.stripeAccountId === account.id, JSON.stringify(r.body));
  const commitA = r.body;
  const contribA = await prisma.campaignContribution.findUnique({ where: { id: commitA.contributionId } });
  check("delivery address and fee stored", contribA.deliveryPostcode === "CV1 1AA" && contribA.deliveryPhone === "+447700900000" && contribA.deliveryFeeAmountMinor === 500, JSON.stringify(contribA).slice(0, 300));
  const expectedTotal = 8000 + contribA.buyerServiceFeeAmount + 500;
  check("buyer consents to product, service fee and delivery", (await hold(commitA.contributionId)).consentedChargeAmount === expectedTotal, String(expectedTotal));
  r = await call("POST", `/community-buy/contributions/${commitA.contributionId}/confirm-setup`, a.token, {});
  check(`can't claim a card was saved before it was [${r.status}]`, r.status === 409, JSON.stringify(r.body));
  r = await saveCard(a.token, commitA.contributionId, commitA, "pm_card_visa");
  check(`card saved [${r.status}]`, r.status === 200, JSON.stringify(r.body));
  let h = await hold(commitA.contributionId);
  check("before the window, no hold is placed", h.holdStatus === "NOT_REQUESTED" && !h.paymentIntentId, h.holdStatus);
  const other = await register("other");
  r = await call("POST", `/community-buy/contributions/${commitA.contributionId}/refresh-hold`, other.token, {});
  check(`another buyer can't touch this hold [${r.status}]`, r.status === 404);
  r = await call("GET", `/community-buy/contributions/${commitA.contributionId}/hold-action`, other.token);
  check(`another buyer can't read the bank check [${r.status}]`, r.status === 404);

  section("ABANDONED CHECKOUT");
  const b = await register("buyerb");
  r = await call("POST", `/community-buy/campaigns/${camp.id}/commit`, b.token, { quantity: 6, deliveryAddress: ADDRESS });
  check(`second buyer takes the remaining shares [${r.status}]`, r.status === 201, JSON.stringify(r.body));
  const abandonedId = r.body.contributionId;
  const c = await register("buyerc");
  r = await call("POST", `/community-buy/campaigns/${camp.id}/commit`, c.token, { quantity: 1, deliveryAddress: ADDRESS });
  check(`campaign is full meanwhile [${r.status}]`, r.status === 409 && r.body.code === "CAPACITY_UNAVAILABLE", JSON.stringify(r.body));
  await prisma.communityBuyPaymentAuthorisation.update({ where: { contributionId: abandonedId }, data: { createdAt: new Date(Date.now() - 31 * 60000) } });
  r = await call("POST", `/community-buy/campaigns/${camp.id}/commit`, c.token, { quantity: 1, deliveryAddress: ADDRESS });
  check(`abandoned place goes back to others [${r.status}]`, r.status === 201, JSON.stringify(r.body));
  const commitC = r.body;
  const abandoned = await prisma.campaignContribution.findUnique({ where: { id: abandonedId } });
  check("abandoned commitment cancelled", abandoned.status === "CANCELLED");
  let fresh = await prisma.communityCampaign.findUnique({ where: { id: camp.id } });
  check("shares add up after release", fresh.confirmedShares === 3, String(fresh.confirmedShares));

  section("HOLD WINDOW OPENS WHILE JOINING IS OPEN");
  await prisma.communityCampaign.update({ where: { id: camp.id }, data: { holdWindowStartsAt: new Date(Date.now() - 60000) } });
  r = await sweep();
  check(`daily job runs [${r.status}]`, r.status === 200, JSON.stringify(r.body).slice(0, 200));
  h = await hold(commitA.contributionId);
  check("buyer with a card now has a real hold", h.holdStatus === "HOLD_SUCCEEDED" && !!h.paymentIntentId, `${h.holdStatus} ${h.providerErrorCode}`);
  const piA = await stripe.paymentIntents.retrieve(h.paymentIntentId);
  check("Stripe holds the full amount, uncaptured", piA.status === "requires_capture" && piA.amount_capturable === expectedTotal, `${piA.status} ${piA.amount_capturable}`);
  check("buyer mid-way through saving a card isn't declined", (await hold(commitC.contributionId)).holdStatus === "NOT_REQUESTED");
  r = await saveCard(c.token, commitC.contributionId, commitC, "pm_card_visa");
  h = await hold(commitC.contributionId);
  check("joining inside the window gets a hold straight away", r.status === 200 && h.holdStatus === "HOLD_SUCCEEDED", `${h.holdStatus} ${h.providerErrorCode}`);

  section("DECLINED CARD, THEN A NEW ONE");
  const d = await register("buyerd");
  r = await call("POST", `/community-buy/campaigns/${camp.id}/commit`, d.token, { quantity: 1, deliveryAddress: ADDRESS });
  const commitD = r.body;
  r = await saveCard(d.token, commitD.contributionId, commitD, "pm_card_chargeCustomerFail");
  h = await hold(commitD.contributionId);
  check("declined card doesn't get a hold", h.holdStatus === "HOLD_DECLINED", `${h.holdStatus} ${h.providerErrorCode}`);
  r = await call("GET", `/community-buy/contributions/${commitD.contributionId}`, d.token);
  check("buyer's screen can see the decline", r.body.contribution?.paymentAuthorisation?.holdStatus === "HOLD_DECLINED", JSON.stringify(r.body).slice(0, 240));
  check("buyer's screen isn't sent card details", !JSON.stringify(r.body.contribution?.paymentAuthorisation).includes("pm_"));
  r = await call("POST", `/community-buy/contributions/${commitD.contributionId}/update-card`, d.token, {});
  check(`can start again with a new card [${r.status}]`, r.status === 200 && !!r.body.setupIntentClientSecret, JSON.stringify(r.body));
  r = await saveCard(d.token, commitD.contributionId, r.body, "pm_card_visa");
  h = await hold(commitD.contributionId);
  check("new card gets the hold", h.holdStatus === "HOLD_SUCCEEDED", `${h.holdStatus} ${h.providerErrorCode}`);

  section("OUTCOME: CAPTURE");
  check("nobody charged before the outcome", (await prisma.campaignContribution.count({ where: { campaignId: camp.id, status: "PAID" } })) === 0);
  r = await call("GET", `/community-buy/campaigns/${camp.id}/authorisation-summary`, a.token);
  check("summary counts authorised shares", r.body.authorisedQuantity === 4, JSON.stringify(r.body).slice(0, 220));
  await prisma.communityCampaign.update({ where: { id: camp.id }, data: { deadline: new Date(Date.now() - 2000) } });
  r = await call("POST", "/internal/jobs/community-buy-sweep", null, {}, { authorization: "Bearer " + process.env.CRON_SECRET });
  if (r.status === 404) r = await call("POST", "/internal/jobs/community-campaigns-sweep", null, {}, { authorization: "Bearer " + process.env.CRON_SECRET });
  fresh = await prisma.communityCampaign.findUnique({ where: { id: camp.id } });
  check("joining closes at the deadline, nothing decided yet", fresh.status === "HOLD_WINDOW", fresh.status);
  await prisma.communityCampaign.update({ where: { id: camp.id }, data: { decisionDeadline: new Date(Date.now() - 2000) } });
  await sweep();
  fresh = await prisma.communityCampaign.findUnique({ where: { id: camp.id } });
  check("minimum met: campaign moves to fulfilment", fresh.status === "FULFILLING", fresh.status);
  h = await hold(commitA.contributionId);
  const captured = await stripe.paymentIntents.retrieve(h.paymentIntentId);
  check("Stripe really captured it", captured.status === "succeeded" && captured.amount_received === expectedTotal, `${captured.status} ${captured.amount_received}`);
  const commission = Math.round(8000 * 0.08);
  const feeLine = fs.readFileSync(FEE_LOG, "utf8").split("\n").find((line) => line.includes(h.paymentIntentId)) || "";
  check("Eki keeps commission on product plus service fee, not on delivery", Number(feeLine.split(" ")[1]) === commission + contribA.buyerServiceFeeAmount, `${feeLine} vs ${commission + contribA.buyerServiceFeeAmount}`);
  const paid = await prisma.campaignContribution.findUnique({ where: { id: commitA.contributionId } });
  check("contribution marked paid", paid.status === "PAID", paid.status);

  section("OUTCOME: CANCEL RELEASES EVERY HOLD");
  const camp2 = await liveCampaign("Second group");
  const e = await register("buyere");
  r = await call("POST", `/community-buy/campaigns/${camp2.id}/commit`, e.token, { quantity: 1, deliveryAddress: ADDRESS });
  const commitE = r.body;
  await prisma.communityCampaign.update({ where: { id: camp2.id }, data: { holdWindowStartsAt: new Date(Date.now() - 60000) } });
  await saveCard(e.token, commitE.contributionId, commitE, "pm_card_visa");
  h = await hold(commitE.contributionId);
  check("hold placed", h.holdStatus === "HOLD_SUCCEEDED", `${h.holdStatus} ${h.providerErrorCode}`);
  const shareBefore = (await prisma.communityCampaign.findUnique({ where: { id: camp2.id } })).confirmedShares;
  await prisma.communityCampaign.update({ where: { id: camp2.id }, data: { deadline: new Date(Date.now() - 2000) } });
  r = await call("POST", "/internal/jobs/community-buy-sweep", null, {}, { authorization: "Bearer " + process.env.CRON_SECRET });
  if (r.status === 404) r = await call("POST", "/internal/jobs/community-campaigns-sweep", null, {}, { authorization: "Bearer " + process.env.CRON_SECRET });
  await prisma.communityCampaign.update({ where: { id: camp2.id }, data: { decisionDeadline: new Date(Date.now() - 2000) } });
  await sweep();
  fresh = await prisma.communityCampaign.findUnique({ where: { id: camp2.id } });
  check("below minimum: organiser must decide, nobody charged", fresh.status === "DECISION_REQUIRED" && shareBefore === 1, fresh.status);
  r = await call("POST", `/organiser/campaigns/${camp2.id}/decision`, org.token, { action: "cancel" });
  check(`organiser cancels [${r.status}]`, r.status === 200, JSON.stringify(r.body).slice(0, 200));
  h = await hold(commitE.contributionId);
  const released = await stripe.paymentIntents.retrieve(h.paymentIntentId);
  check("Stripe released the hold, money never taken", released.status === "canceled" && h.holdStatus === "HOLD_RELEASED", `${released.status} ${h.holdStatus}`);

  section("BELOW MINIMUM: ORGANISER AND SUPPLIER DECIDE");
  const closeCampaign = async (id) => {
    await prisma.communityCampaign.update({ where: { id }, data: { deadline: new Date(Date.now() - 2000) } });
    await call("POST", "/internal/jobs/community-buy-sweep", null, {}, { authorization: "Bearer " + process.env.CRON_SECRET });
    await prisma.communityCampaign.update({ where: { id }, data: { decisionDeadline: new Date(Date.now() - 2000) } });
    await sweep();
    return prisma.communityCampaign.findUnique({ where: { id } });
  };
  const empty = await liveCampaign("Nobody joined");
  fresh = await closeCampaign(empty.id);
  check("no holds: decision needed", fresh.status === "DECISION_REQUIRED", fresh.status);
  r = await call("POST", `/organiser/campaigns/${empty.id}/decision`, org.token, { action: "proceed" });
  check(`can't go ahead with nobody confirmed [${r.status}]`, r.status === 409 && r.body.code === "NO_AUTHORISED_SHARES", JSON.stringify(r.body));

  const camp5 = await liveCampaign("Small group");
  const k = await register("buyerk");
  r = await call("POST", `/community-buy/campaigns/${camp5.id}/commit`, k.token, { quantity: 1, deliveryAddress: ADDRESS });
  const commitK = r.body;
  await prisma.communityCampaign.update({ where: { id: camp5.id }, data: { holdWindowStartsAt: new Date(Date.now() - 60000) } });
  await saveCard(k.token, commitK.contributionId, commitK, "pm_card_visa");
  fresh = await closeCampaign(camp5.id);
  check("below minimum: decision needed", fresh.status === "DECISION_REQUIRED", fresh.status);
  r = await call("POST", `/organiser/campaigns/${camp5.id}/decision`, org.token, { action: "proceed" });
  check(`organiser asks the supplier [${r.status}]`, r.status === 200 && r.body.campaign?.status === "AWAITING_SUPPLIER_RECONFIRMATION", JSON.stringify(r.body).slice(0, 200));
  fresh = await prisma.communityCampaign.findUnique({ where: { id: camp5.id } });
  check("supplier is asked about the real quantity", fresh.reconfirmationQuantity === 1, String(fresh.reconfirmationQuantity));
  r = await call("POST", `/supplier/campaigns/${camp5.id}/reconfirm`, other.token, { action: "confirm" });
  check(`another user can't accept for the supplier [${r.status}]`, r.status === 403 || r.status === 404, JSON.stringify(r.body).slice(0, 160));
  r = await call("POST", `/supplier/campaigns/${camp5.id}/reconfirm`, sup.token, { action: "confirm" });
  check(`supplier accepts the final quantity [${r.status}]`, r.status === 200, JSON.stringify(r.body).slice(0, 200));
  h = await hold(commitK.contributionId);
  const capturedK = await stripe.paymentIntents.retrieve(h.paymentIntentId);
  check("only then is the buyer charged", capturedK.status === "succeeded" && h.captureStatus === "CAPTURED", `${capturedK.status} ${h.captureStatus}`);

  section("BANK CHECK (a card that always asks for 3-D Secure)");
  const camp4 = await liveCampaign("Fourth group");
  await prisma.communityCampaign.update({ where: { id: camp4.id }, data: { holdWindowStartsAt: new Date(Date.now() - 60000) } });
  const g = await register("buyerg");
  r = await call("POST", `/community-buy/campaigns/${camp4.id}/commit`, g.token, { quantity: 1, deliveryAddress: ADDRESS });
  const commitG = r.body;
  const authG = await hold(commitG.contributionId);
  const sca = await stripe.paymentMethods.attach("pm_card_authenticationRequired", { customer: authG.stripeCustomerId });
  await prisma.communityBuyPaymentAuthorisation.update({ where: { id: authG.id }, data: { paymentMethodReference: sca.id } });
  await sweep();
  h = await hold(commitG.contributionId);
  check("a bank check isn't treated as a decline", h.holdStatus === "REQUIRES_ACTION" && !!h.paymentIntentId, `${h.holdStatus} ${h.providerErrorCode}`);
  check("buyer gets time to finish it", !!h.holdRecoveryDeadline);
  r = await call("GET", `/community-buy/contributions/${commitG.contributionId}/hold-action`, g.token);
  check(`app can start the bank check [${r.status}]`, r.status === 200 && !!r.body.clientSecret && r.body.paymentMethodId === sca.id, JSON.stringify(r.body).slice(0, 160));
  r = await call("POST", `/community-buy/contributions/${commitG.contributionId}/refresh-hold`, g.token, {});
  check("unfinished bank check stays open", r.body.holdStatus === "REQUIRES_ACTION", JSON.stringify(r.body));
  const oldIntent = h.paymentIntentId;
  r = await call("POST", `/community-buy/contributions/${commitG.contributionId}/update-card`, g.token, {});
  check(`buyer can switch card instead [${r.status}]`, r.status === 200 && !!r.body.setupIntentClientSecret, JSON.stringify(r.body).slice(0, 160));
  const cancelledIntent = await stripe.paymentIntents.retrieve(oldIntent);
  check("old attempt can't complete later", cancelledIntent.status === "canceled", cancelledIntent.status);
  r = await saveCard(g.token, commitG.contributionId, r.body, "pm_card_visa");
  h = await hold(commitG.contributionId);
  check("new card gets the hold", h.holdStatus === "HOLD_SUCCEEDED", `${h.holdStatus} ${h.providerErrorCode}`);

  section("BOUNDARIES");
  const camp3 = await liveCampaign("Third group");
  const demo = await register("demobuyer", { isTest: true });
  r = await call("POST", `/community-buy/campaigns/${camp3.id}/commit`, demo.token, { quantity: 1, deliveryAddress: ADDRESS });
  check(`demo buyer can't join a real campaign [${r.status}]`, r.status === 404, JSON.stringify(r.body));
  const f = await register("buyerf");
  r = await call("POST", `/community-buy/campaigns/${camp3.id}/commit`, f.token, { quantity: 1, deliveryAddress: ADDRESS });
  const before = (await prisma.communityCampaign.findUnique({ where: { id: camp3.id } })).confirmedShares;
  r = await call("POST", `/community-buy/contributions/${r.body.contributionId}/withdraw`, f.token, {});
  const afterShares = (await prisma.communityCampaign.findUnique({ where: { id: camp3.id } })).confirmedShares;
  check(`withdrawing gives the place back [${r.status}]`, r.status === 200 && before === 1 && afterShares === 0, `${before} ${afterShares}`);

    console.log(`\nRESULT pass=${pass} fail=${fail}`);
  if (fail) console.log("FAILED:\n - " + failures.join("\n - "));
})()
  .catch((e) => { console.log("CRASH", String(e.stack).slice(0, 900)); console.log(`\nRESULT pass=${pass} fail=${fail}`); })
  .finally(() => prisma.$disconnect());
