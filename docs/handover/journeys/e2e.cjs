// End-to-end check of the four value features against the local verification
// database. Run from ekiapp-backend-main with DATABASE_URL pointing at it.
const path = require("path");
const BACKEND = process.env.EKI_BACKEND_DIR || path.resolve(__dirname, "../../../../ekiapp-backend-main");
const req = (m) => require(path.join(BACKEND, "node_modules", m));
require(path.join(BACKEND, "node_modules", "dotenv")).config({ path: path.join(BACKEND, ".env") });
if (!/localhost:5544\/eki_verify/.test(process.env.DATABASE_URL || "")) throw new Error("Refusing to run: not the verification DB");
const { PrismaClient } = req("@prisma/client");
const Stripe = req("stripe");
const prisma = new PrismaClient();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
if (!process.env.STRIPE_SECRET_KEY.startsWith("sk_test_")) throw new Error("Refusing to run: not a Stripe test key");

const API = (process.env.E2E_API || "http://localhost:4177") + "/api";
const run = Date.now().toString(36);
const PW = "Verify-" + run + "-Aa1!";
let pass = 0, fail = 0;
const failures = [];
const section = (s) => console.log("\n=== " + s);
function check(name, ok, detail) {
  if (ok) { pass++; console.log("  PASS " + name); }
  else { fail++; failures.push(name); console.log("  FAIL " + name + (detail ? "  -> " + String(detail).slice(0, 260) : "")); }
  return ok;
}
async function call(method, p, token, body, headers = {}) {
  const res = await fetch(API + p, {
    method,
    headers: { "content-type": "application/json", ...(token ? { authorization: "Bearer " + token } : {}), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null;
  const text = await res.text();
  try { json = JSON.parse(text); } catch { json = { raw: text.slice(0, 200) }; }
  return { status: res.status, body: json };
}
const expectStatus = (name, r, ...codes) => check(`${name} [${r.status}]`, codes.includes(r.status), JSON.stringify(r.body));

const jwt = req("jsonwebtoken");
const bcrypt = req("bcryptjs");
function tokenFor(u) {
  return jwt.sign({ sub: u.id, role: u.role, email: u.email, tv: u.tokenVersion }, process.env.JWT_SECRET, global.__jwtOptions || { expiresIn: "2h" });
}
async function login(email) {
  const u = await prisma.user.findUniqueOrThrow({ where: { email } });
  return { token: tokenFor(u), user: u };
}
let pwHash;
async function register(label, country = "United Kingdom") {
  const email = `${label}.${run}@example.test`;
  pwHash = pwHash || (await bcrypt.hash(PW, 4));
  await prisma.user.create({ data: { email, password: pwHash, name: `${label} ${run}`, country, role: "BUYER", emailVerifiedAt: new Date() } });
  return login(email);
}
async function savedCard(token, cardPm = "pm_card_visa") {
  const si = await call("POST", "/buyer/payment-methods/setup-intent", token, {});
  if (si.status >= 300) throw new Error("setup-intent " + JSON.stringify(si.body));
  const id = si.body.clientSecret.split("_secret_")[0];
  await stripe.setupIntents.confirm(id, { payment_method: cardPm });
  const saved = await call("POST", "/buyer/payment-methods", token, { setupIntentId: id });
  if (saved.status >= 300) throw new Error("save card " + JSON.stringify(saved.body));
  const list = await call("GET", "/buyer/payment-methods", token);
  return (list.body.items ?? [])[0];
}
const job = (name) => call("POST", "/internal/jobs/" + name, null, {}, { authorization: "Bearer " + process.env.CRON_SECRET });

(async () => {
  const admin = await login("seed_qa_admin@example.com");
  const superRole = await prisma.adminRole.findUniqueOrThrow({ where: { name: "Super Administrator" } });
  await prisma.adminRoleAssignment.upsert({ where: { roleId_userId: { roleId: superRole.id, userId: admin.user.id } }, create: { roleId: superRole.id, userId: admin.user.id }, update: {} });
  const deadline = new Date(Date.now() + 7 * 864e5).toISOString();
  // Match production's public GB market settings.
  await prisma.marketConfiguration.updateMany({ where: { countryCode: "GB" }, data: { communityBuyEnabled: true, communityBuyPaymentsEnabled: true, regularDeliveriesEnabled: true, paymentMode: "TEST", communityBuyPaymentMode: "PLEDGE_THEN_CHARGE" } });

  // ---------------------------------------------------------------- suppliers
  section("SUPPLIERS");
  const sup = await register("supplier");
  let r = await call("GET", "/supplier/profile", sup.token);
  expectStatus("no-store user opens Supplier Centre", r, 200);
  check("state starts NOT_STARTED", r.body.account?.supplierState === "NOT_STARTED", JSON.stringify(r.body));
  r = await call("POST", "/supplier/applications", sup.token, { country: "GB", categories: ["Rice", "Yam"], coverageRegions: ["GB"], businessName: "Verify Foods Ltd", businessRegistrationNumber: "123", fulfilmentMethods: ["DELIVERY", "HACK"], collectionCapacityPerDay: 40 });
  expectStatus("apply with no store", r, 201);
  check("business details saved", r.body.account?.businessName === "Verify Foods Ltd", JSON.stringify(r.body));
  check("invalid fulfilment method dropped", JSON.stringify(r.body.account?.fulfilmentMethods) === '["DELIVERY"]', JSON.stringify(r.body.account?.fulfilmentMethods));
  const supAccountId = r.body.account?.id;
  r = await call("POST", `/admin/community-buy/supplier-accounts/${supAccountId}/approve`, sup.token, {});
  check(`supplier can't approve themselves [${r.status}]`, r.status === 403 || r.status === 401, JSON.stringify(r.body));
  r = await call("GET", "/admin/community-buy/supplier-accounts?state=UNDER_REVIEW", admin.token);
  expectStatus("admin sees review queue", r, 200);
  check("application in queue with business name", (r.body.items ?? []).some((a) => a.id === supAccountId && a.businessName === "Verify Foods Ltd"), JSON.stringify(r.body).slice(0, 200));
  r = await call("POST", `/admin/community-buy/supplier-accounts/${supAccountId}/approve`, admin.token, { reason: "E2E verification approval" });
  expectStatus("admin approves supplier", r, 200, 201);
  await prisma.supplierAccount.update({ where: { id: supAccountId }, data: { chargesEnabled: true, payoutsEnabled: true, detailsSubmitted: true } });

  // ------------------------------------------------------------ community buy
  section("COMMUNITY BUY");
  const org = await register("organiser");
  r = await call("GET", "/organiser/profile", org.token);
  check("fresh user has no profile, no application needed", r.status === 200 && r.body.profile === null, JSON.stringify(r.body));
  r = await call("GET", "/organiser/suppliers?country=GB", org.token);
  expectStatus("picker loads", r, 200);
  check("payout-ready supplier offered by business name", (r.body.items ?? []).some((s) => s.id === supAccountId && s.displayName === "Verify Foods Ltd"), JSON.stringify(r.body).slice(0, 300));
  r = await call("POST", "/organiser/campaigns", org.token, { title: "E2E Rice Buy " + run, country: "GB" });
  expectStatus("start campaign without applying", r, 201, 200);
  const campaignId = r.body.campaign?.id;
  r = await call("PATCH", `/organiser/campaigns/${campaignId}`, org.token, {
    description: "Bulk rice", currency: "GBP", minimumShares: 2, goalShares: 3, maximumShares: 10, pricePerShareMinor: 2000, deadline, unit: "bag", quantityPerOrder: 1,
    fulfilmentOwner: "SUPPLIER", supplierAccountId: supAccountId, wholesaleAmountMinor: 3000, deliveryPreference: "DELIVERY", deliveryCoverageAreas: ["BL"], deliveryFeeAmountMinor: 500,
  });
  expectStatus("fill in campaign", r, 200);
  const intruder = await register("intruder");
  r = await call("PATCH", `/organiser/campaigns/${campaignId}`, intruder.token, { title: "hacked" });
  check(`other user can't edit campaign [${r.status}]`, r.status === 403 || r.status === 404, JSON.stringify(r.body));
  r = await call("POST", `/organiser/campaigns/${campaignId}/submit`, intruder.token, {});
  check(`other user can't submit campaign [${r.status}]`, r.status === 403 || r.status === 404, JSON.stringify(r.body));
  r = await call("POST", `/organiser/campaigns/${campaignId}/submit`, org.token, {});
  expectStatus("first-time organiser submits", r, 200);
  r = await call("GET", "/supplier/campaigns", sup.token);
  check("supplier sees invitation", (r.body.items ?? []).some((c) => c.id === campaignId), JSON.stringify(r.body).slice(0, 200));
  r = await call("POST", `/supplier/campaigns/${campaignId}/supplier-commitment`, intruder.token, {});
  check(`non-supplier can't accept [${r.status}]`, r.status === 403 || r.status === 404, JSON.stringify(r.body));
  r = await call("POST", `/supplier/campaigns/${campaignId}/supplier-commitment`, sup.token, {});
  expectStatus("supplier accepts", r, 200, 201);
  const criteria = { productAccurate: true, priceFair: true, termsClear: true, supplierOrSelfSupplyVerified: true, deliveryPlanValid: true, contentAppropriate: true };
  r = await call("POST", `/admin/community-campaigns/${campaignId}/approve`, org.token, { criteria });
  check(`organiser can't approve own campaign [${r.status}]`, r.status === 403, JSON.stringify(r.body));
  r = await call("POST", `/admin/community-campaigns/${campaignId}/approve`, admin.token, { criteria });
  expectStatus("admin approves campaign", r, 200);
  r = await call("GET", "/organiser/profile", org.token);
  check("first approval verified organiser", r.body.profile?.isVerified === true, JSON.stringify(r.body));
  r = await call("POST", `/organiser/campaigns/${campaignId}/publish`, org.token, {});
  expectStatus("organiser publishes", r, 200);
  check("campaign LIVE", r.body.campaign?.status === "LIVE", JSON.stringify(r.body).slice(0, 200));

  const buyerA = await register("buyera");
  const buyerB = await register("buyerb");
  const foreign = await register("foreign", "France");
  const noCountry = await register("nocountry");
  await prisma.user.update({ where: { id: noCountry.user.id }, data: { country: null } });
  r = await call("GET", "/community-buy/campaigns", buyerA.token);
  expectStatus("buyer discovers", r, 200);
  check("live campaign listed in buyer's market", (r.body.items ?? []).some((c) => c.id === campaignId), JSON.stringify(r.body).slice(0, 200));
  r = await call("GET", "/community-buy/campaigns", foreign.token);
  check("other market doesn't see it", !(r.body.items ?? []).some((c) => c.id === campaignId), JSON.stringify(r.body).slice(0, 200));
  r = await call("GET", "/community-buy/campaigns", noCountry.token);
  check(`missing country gets COUNTRY_REQUIRED [${r.status}]`, r.status === 403 && r.body.code === "COUNTRY_REQUIRED", JSON.stringify(r.body));
  r = await call("PATCH", "/auth/me", noCountry.token, { country: "United Kingdom" });
  r = await call("GET", "/community-buy/campaigns", noCountry.token);
  check("setting country fixes it", r.status === 200, JSON.stringify(r.body).slice(0, 200));
  r = await call("GET", `/community-buy/campaigns/${campaignId}`, buyerA.token);
  expectStatus("campaign detail", r, 200);
  const est = r.body.campaign?.perShareFeeEstimate;
  check("fee estimate has rate and bounds", est?.feeBps === 500 && est?.minAmount === 120 && est?.maxAmount === 500, JSON.stringify(est));
  check("organiser name disclosed", !!r.body.campaign?.organiserDisplayName, String(JSON.stringify(r.body.campaign)).slice(0, 200));
  const leaked = JSON.stringify(r.body);
  check("no organiser email leaked to buyers", !leaked.includes(org.user.email), "email leak");
  check("no supplier email leaked to buyers", !leaked.includes(sup.user.email), "email leak");

  let pmA, pmB, stripeOk = true;
  try {
    pmA = await savedCard(buyerA.token);
    pmB = await savedCard(buyerB.token);
    check("buyers save test cards via Stripe", !!pmA && !!pmB);
  } catch (e) { stripeOk = false; check("buyers save test cards via Stripe", false, e.message); }
  const addr = { recipientName: "Buyer", addressLine1: "1 Test St", city: "Bolton", postcode: "BL1 1AA", phone: "+447700900000" };
  if (stripeOk) {
    r = await call("POST", `/community-buy/campaigns/${campaignId}/contributions`, foreign.token, { quantity: 1, paymentMethodId: pmA.id, deliveryAddress: addr });
    check(`other-market buyer can't pledge [${r.status}]`, r.status >= 400 && r.status < 500, JSON.stringify(r.body));
    r = await call("POST", `/community-buy/campaigns/${campaignId}/contributions`, buyerB.token, { quantity: 1, paymentMethodId: pmA.id, deliveryAddress: addr });
    check(`can't pledge with someone else's card [${r.status}]`, r.status >= 400 && r.status < 500, JSON.stringify(r.body));
    r = await call("POST", `/community-buy/campaigns/${campaignId}/contributions`, buyerA.token, { quantity: 2, paymentMethodId: pmA.id, deliveryAddress: addr });
    expectStatus("buyer A pledges 2", r, 201);
    const contribA = r.body.contributionId;
    r = await call("GET", `/community-buy/contributions/${contribA}`, buyerB.token);
    check(`other buyer can't read pledge [${r.status}]`, r.status === 403 || r.status === 404, JSON.stringify(r.body));
    r = await call("POST", `/community-buy/campaigns/${campaignId}/contributions`, buyerB.token, { quantity: 1, paymentMethodId: pmB.id, deliveryAddress: addr });
    expectStatus("buyer B pledges 1", r, 201);
    r = await call("POST", `/community-buy/campaigns/${campaignId}/contributions`, buyerB.token, { quantity: 1000, paymentMethodId: pmB.id, deliveryAddress: addr });
    check(`can't pledge over maximum [${r.status}]`, r.status >= 400 && r.status < 500, JSON.stringify(r.body));
    const before = await prisma.communityCampaign.findUnique({ where: { id: campaignId }, select: { confirmedShares: true, minimumShares: true } });
    check("shares counted", before.confirmedShares === 3, JSON.stringify(before));
    const stored = await prisma.campaignContribution.findFirst({ where: { id: contribA }, select: { deliveryPhone: true } });
    check("buyer phone reaches the delivery record", stored?.deliveryPhone === "+447700900000", JSON.stringify(stored));
    r = await call("GET", `/organiser/campaigns/${campaignId}/participants`, org.token);
    expectStatus("organiser lists participants", r, 200);
    const partText = JSON.stringify(r.body);
    check("organiser context hides participant address", !partText.includes("1 Test St") && !partText.includes("BL1 1AA"), partText.slice(0, 300));
    check("organiser context hides participant email", !partText.includes(buyerA.user.email), partText.slice(0, 300));
    // close it: past deadline, sweep decides and charges
    await prisma.communityCampaign.update({ where: { id: campaignId }, data: { deadline: new Date(Date.now() - 60000) } });
    r = await job("community-buy-sweep");
    if (r.status === 404) r = await job("community-campaigns-sweep");
    console.log("  info sweep", r.status, JSON.stringify(r.body).slice(0, 200));
    const after = await prisma.communityCampaign.findUnique({ where: { id: campaignId }, select: { status: true, fundingOutcome: true } });
    console.log("  info campaign after close", JSON.stringify(after));
    check("campaign closes successfully", ["SUCCEEDED", "FULFILLING"].includes(after.status), JSON.stringify(after));
    const contribs = await prisma.campaignContribution.findMany({ where: { campaignId }, select: { status: true, amount: true, buyerServiceFeeAmount: true } });
    console.log("  info contributions", JSON.stringify(contribs));
    check("pledges charged in test mode", contribs.every((c) => c.status === "PAID"), JSON.stringify(contribs));
    check("buyer service fee 5% with £1.20 minimum", contribs.some((c) => c.amount === 4000 && c.buyerServiceFeeAmount === 200) && contribs.some((c) => c.amount === 2000 && c.buyerServiceFeeAmount === 120), JSON.stringify(contribs));
    r = await call("GET", `/supplier/campaigns/${campaignId}/fulfilment`, sup.token);
    expectStatus("supplier opens fulfilment", r, 200);
    r = await call("GET", `/supplier/campaigns/${campaignId}/fulfilment/deliveries`, intruder.token);
    check(`stranger can't read deliveries [${r.status}]`, r.status >= 400, JSON.stringify(r.body).slice(0, 200));
    r = await call("GET", `/supplier/campaigns/${campaignId}/fulfilment/deliveries`, org.token);
    check(`organiser can't read supplier deliveries [${r.status}]`, r.status >= 400, JSON.stringify(r.body).slice(0, 200));
    r = await call("GET", `/supplier/campaigns/${campaignId}/payment`, sup.token);
    console.log("  info supplier payment", r.status, JSON.stringify(r.body).slice(0, 260));
    r = await call("GET", "/admin/community-buy/ledger", admin.token);
    expectStatus("admin ledger", r, 200);
    const row = (r.body.items ?? []).find((x) => x.campaignId === campaignId);
    check("ledger shows buyer fee revenue", row?.buyerServiceFeeRevenue === 320, JSON.stringify(row));
  }

  // ------------------------------------------------------------- subscription
  section("FOODSTUFFS SUBSCRIPTION + MARKETING SETUP");
  const demoEmail = `demo.${run}@example.test`;
  r = await call("POST", "/admin/users/demo-create", admin.token, { email: demoEmail, password: PW, name: "Demo " + run, reason: "E2E verification run", storeName: "E2E Store " + run, country: "GB", supplier: true });
  expectStatus("admin creates demo account", r, 200, 201);
  const demoVendorId = r.body.vendor?.id;
  await prisma.vendorMarketAssignment.upsert({ where: { vendorId_marketCode: { vendorId: demoVendorId, marketCode: "GB" } }, create: { vendorId: demoVendorId, marketCode: "GB", countryName: "United Kingdom", currency: "GBP", enabled: true }, update: {} });
  const demo = await login(demoEmail, PW);
  r = await call("GET", "/auth/me/destinations", demo.token);
  expectStatus("launcher status", r, 200);
  console.log("  info destinations", JSON.stringify(r.body));
  r = await call("GET", "/auth/me/destinations");
  check(`launcher status needs login [${r.status}]`, r.status === 401);
  const prods = [];
  for (const [title, price, stock] of [["E2E Rice", 2500, 50], ["E2E Yam", 1800, 40], ["E2E Sold Out", 900, 0]]) {
    r = await call("POST", "/products", demo.token, { title, description: "desc", priceAmount: price, images: ["https://example.test/x.jpg"], category: "Grains", stock, weightGrams: 1000 });
    expectStatus("create product " + title, r, 201);
    prods.push(r.body.product);
    check(title + " published immediately", r.body.product?.status === "PUBLISHED", JSON.stringify(r.body.product?.status));
  }
  r = await call("PATCH", `/products/${prods[0].id}`, buyerA.token, { title: "hacked" });
  check(`other user can't edit product [${r.status}]`, r.status === 403, JSON.stringify(r.body).slice(0, 200));

  r = await call("GET", `/subscription-offers/public?vendorId=${demoVendorId}`);
  check("no offers before setup", r.status === 200 && (r.body.items ?? []).length === 0, JSON.stringify(r.body).slice(0, 200));
  r = await call("POST", "/vendor/subscription-offers", buyerA.token, { title: "x", productIds: [prods[0].id], frequencies: ["WEEKLY"] });
  check(`buyer without store can't create offer [${r.status}]`, r.status === 403, JSON.stringify(r.body).slice(0, 200));
  r = await call("POST", "/vendor/subscription-offers", demo.token, { title: "Weekly staples", productIds: prods.map((p) => p.id), frequencies: ["WEEKLY", "MONTHLY"], substitutionMode: "ASK_BUYER", fulfilmentMethod: "DELIVERY", discountPercent: 5 });
  expectStatus("vendor creates offer", r, 201);
  const offerId = r.body.offer?.id;
  r = await call("POST", `/subscription-offers/${offerId}/publish`, buyerA.token, {});
  check(`other user can't publish offer [${r.status}]`, r.status === 403, JSON.stringify(r.body).slice(0, 200));
  r = await call("POST", `/subscription-offers/${offerId}/publish`, demo.token, {});
  console.log("  info publish offer", r.status, JSON.stringify(r.body).slice(0, 220));
  await prisma.marketConfiguration.updateMany({ where: { countryCode: "GB" }, data: { regularDeliveriesEnabled: true } });
  r = await call("POST", `/subscription-offers/${offerId}/publish`, demo.token, {});
  check(`publish works once market on [${r.status}]`, r.status === 200 || /already/i.test(JSON.stringify(r.body)), JSON.stringify(r.body).slice(0, 220));
  await prisma.subscriptionOffer.update({ where: { id: offerId }, data: { isActive: true } });
  // Isolation: a demo store's offer is invisible and unusable for real buyers.
  r = await call("GET", `/subscription-offers/public?vendorId=${demoVendorId}`);
  check("demo offer hidden from anonymous", (r.body.items ?? []).length === 0, JSON.stringify(r.body).slice(0, 200));
  r = await call("GET", `/subscription-offers/public?vendorId=${demoVendorId}`, demo.token);
  check("demo offer visible to a demo account", (r.body.items ?? []).length === 1, JSON.stringify(r.body).slice(0, 200));
  r = await call("GET", `/subscription-offers/${offerId}`, buyerA.token);
  check(`demo offer detail hidden from real buyer [${r.status}]`, r.status === 404, JSON.stringify(r.body).slice(0, 200));
  r = await call("GET", `/subscription-offers/${offerId}`, demo.token);
  check(`demo offer detail open to demo account [${r.status}]`, r.status === 200, JSON.stringify(r.body).slice(0, 200));
  // The subscription flow below is exercised real-to-real.
  await prisma.vendor.update({ where: { id: demoVendorId }, data: { isTest: false } });
  await prisma.user.update({ where: { id: demo.user.id }, data: { isTest: false } });
  r = await call("GET", `/subscription-offers/public?vendorId=${demoVendorId}`);
  check("offer discoverable", (r.body.items ?? []).some((o) => o.id === offerId), JSON.stringify(r.body).slice(0, 300));
  const listedOffer = (r.body.items ?? []).find((o) => o.id === offerId);
  check("sold-out product still listed with stock so app can mark it", listedOffer?.products?.some((p) => p.product.stock === 0), JSON.stringify(listedOffer?.products?.map((p) => p.product.stock)));
  r = await call("GET", `/subscription-offers/${offerId}`);
  expectStatus("offer detail public", r, 200);
  check("offer detail hides vendor private data", !JSON.stringify(r.body).includes(demoEmail) && !JSON.stringify(r.body).includes("stripeAccountId"), JSON.stringify(r.body).slice(0, 300));
  if (stripeOk) {
    const a = await call("POST", "/addresses", buyerA.token, { recipientName: "Buyer A", line1: "1 Test St", city: "Bolton", postalCode: "BL1 1AA", country: "United Kingdom", phone: "+447700900000", isDefault: true });
    expectStatus("buyer saves address", a, 201, 200);
    const addressId = a.body.address?.id;
    const subBody = { offerId, frequency: "WEEKLY", deliveryAddressId: addressId, paymentMethodId: pmA.id, recurringConsent: true };
    {
      const noConsent = await call("POST", "/buyer/subscriptions", buyerA.token, { ...subBody, recurringConsent: undefined, items: [{ productId: prods[0].id, quantity: 1 }] });
      check(`subscribing without consent refused [${noConsent.status}]`, noConsent.status === 400 && noConsent.body.code === "RECURRING_CONSENT_REQUIRED", JSON.stringify(noConsent.body).slice(0, 200));
      const badDate = await call("POST", "/buyer/subscriptions", buyerA.token, { ...subBody, firstDeliveryDate: new Date(Date.now() + 3600000).toISOString(), items: [{ productId: prods[0].id, quantity: 1 }] });
      check(`first date too soon refused [${badDate.status}]`, badDate.status === 400 && badDate.body.code === "FIRST_DELIVERY_DATE_UNAVAILABLE", JSON.stringify(badDate.body).slice(0, 200));
    }
    r = await call("POST", "/buyer/subscriptions", buyerA.token, { ...subBody, items: [{ productId: prods[2].id, quantity: 1 }] });
    check(`sold-out product rejected [${r.status}]`, r.status === 400, JSON.stringify(r.body).slice(0, 200));
    r = await call("POST", "/buyer/subscriptions", buyerB.token, { ...subBody, items: [{ productId: prods[0].id, quantity: 1 }] });
    check(`can't subscribe with another's card and address [${r.status}]`, r.status >= 400 && r.status < 500, JSON.stringify(r.body).slice(0, 200));
    r = await call("POST", "/buyer/subscriptions", buyerA.token, { ...subBody, items: [{ productId: prods[0].id, quantity: 2 }] });
    expectStatus("buyer subscribes", r, 201);
    const subId = r.body.subscription?.id;
    r = await call("GET", `/buyer/subscriptions/${subId}`, buyerB.token);
    check(`other buyer can't read subscription [${r.status}]`, r.status === 403 || r.status === 404, JSON.stringify(r.body).slice(0, 200));
    r = await call("POST", `/buyer/subscriptions/${subId}/cancel`, buyerB.token, {});
    check(`other buyer can't cancel subscription [${r.status}]`, r.status === 403 || r.status === 404, JSON.stringify(r.body).slice(0, 200));
    for (const [n, p, b] of [["skip next", "skip-next", {}], ["pause", "pause", {}], ["resume", "resume", {}], ["change frequency", "change-frequency", { frequency: "MONTHLY" }]]) {
      r = await call("POST", `/buyer/subscriptions/${subId}/${p}`, buyerA.token, b);
      expectStatus("buyer " + n, r, 200);
    }
    r = await call("GET", "/vendor/subscribers", demo.token);
    check("vendor sees subscriber", (r.body.items ?? []).length >= 1, JSON.stringify(r.body).slice(0, 200));
    check("vendor list hides buyer card details", !JSON.stringify(r.body).includes("pm_"), JSON.stringify(r.body).slice(0, 200));
    r = await call("GET", "/vendor/insights", demo.token);
    expectStatus("vendor insights", r, 200);
    if (subId) {
      await prisma.buyerSubscription.update({ where: { id: subId }, data: { status: "ACTIVE", nextRenewalAt: new Date(Date.now() - 60000) } });
      r = await job("renewals-sweep");
      console.log("  info renewal sweep", r.status, JSON.stringify(r.body).slice(0, 220));
      const renewals = await prisma.renewal.findMany({ where: { subscriptionId: subId }, select: { status: true } });
      console.log("  info renewals", JSON.stringify(renewals));
    }
    r = await call("GET", "/vendor/renewals", demo.token);
    expectStatus("vendor renewals list", r, 200);
  }

  // ---------------------------------------------------------------- marketing
  section("MARKETING TOOLS");
  await prisma.vendor.update({ where: { id: demoVendorId }, data: { isTest: true } });
  await prisma.user.update({ where: { id: demo.user.id }, data: { isTest: true } });
  const promoBody = { code: "E2E" + run.toUpperCase(), type: "PERCENTAGE", value: 10, validFrom: new Date().toISOString(), validUntil: new Date(Date.now() + 864e5).toISOString() };
  r = await call("POST", "/promo-codes/me", demo.token, promoBody);
  console.log("  info promo on default plan", r.status, JSON.stringify(r.body).slice(0, 220));
  const lockedPromo = r.status === 403;
  if (lockedPromo) check("locked plan error is readable", /Upgrade/.test(r.body.message) && r.body.code === "PLAN_FEATURE_REQUIRED", JSON.stringify(r.body));
  r = await call("GET", "/subscriptions/me/limits", demo.token);
  console.log("  info limits", r.status, JSON.stringify(r.body).slice(0, 260));
  const growth = await prisma.sellerPlan.findUnique({ where: { slug: "growth" } });
  r = await call("PATCH", `/admin/vendors/${demoVendorId}/seller-plan`, buyerA.token, { sellerPlanSlug: "growth" });
  check(`buyer can't assign plan [${r.status}]`, r.status === 403, JSON.stringify(r.body).slice(0, 200));
  r = await call("PATCH", `/admin/vendors/${demoVendorId}/seller-plan`, admin.token, { sellerPlanId: growth?.id, plan: "GROWTH", planSlug: "growth", slug: "growth", reason: "E2E verification plan" });
  console.log("  info assign growth", r.status, JSON.stringify(r.body).slice(0, 220));
  check("admin assigns Growth", r.status === 200, JSON.stringify(r.body).slice(0, 200));
  r = await call("POST", "/promo-codes/me", demo.token, promoBody);
  expectStatus("create coupon", r, 201, 200);
  r = await call("POST", "/bundles/me", demo.token, { name: "E2E Bundle", productIds: [prods[0].id, prods[1].id], bundlePriceMinor: 3500, currency: "GBP" });
  expectStatus("create bundle", r, 201, 200);
  r = await call("POST", "/flash-sales/me", demo.token, { productId: prods[1].id, salePriceMinor: 1200, currency: "GBP", startsAt: new Date(Date.now() - 1000).toISOString(), endsAt: new Date(Date.now() + 864e5).toISOString() });
  expectStatus("create flash sale", r, 201, 200);
  r = await call("POST", "/flash-sales/me", demo.token, { productId: prods[1].id, salePriceMinor: 99999, currency: "GBP", startsAt: new Date().toISOString(), endsAt: new Date(Date.now() + 864e5).toISOString() });
  check(`flash sale above normal price rejected [${r.status}]`, r.status >= 400 && r.status < 500, JSON.stringify(r.body).slice(0, 200));
  r = await call("POST", "/bundles/me", demo.token, { name: "Stolen", productIds: ["not-mine"], bundlePriceMinor: 100, currency: "GBP" });
  check(`bundle of others' products rejected [${r.status}]`, r.status >= 400 && r.status < 500, JSON.stringify(r.body).slice(0, 200));
  r = await call("GET", "/promo-codes/deals");
  check("public deals list", r.status === 200, JSON.stringify(r.body).slice(0, 200));
  r = await call("GET", "/vendor/automations", demo.token);
  expectStatus("automation center", r, 200);
  r = await call("GET", "/vendors/me/public-store-analytics", demo.token);
  expectStatus("store analytics", r, 200);

  // A real wallet-paid order so the store has a buyer to message
  const shopperEmail = `shopper.${run}@example.test`;
  r = await call("POST", "/admin/users/demo-create", admin.token, { email: shopperEmail, password: PW, name: "Shopper " + run, reason: "E2E verification run", country: "GB" });
  const shopper = await login(shopperEmail, PW);
  r = await call("POST", "/cart/items", shopper.token, { productId: prods[0].id, quantity: 1 });
  expectStatus("add to basket", r, 200, 201);
  r = await call("POST", "/promo-codes/validate", shopper.token, { code: promoBody.code, orderAmount: 2500, vendorId: demoVendorId });
  console.log("  info validate promo", r.status, JSON.stringify(r.body).slice(0, 180));
  const shopAddr = await call("POST", "/addresses", shopper.token, { recipientName: "Shopper", line1: "2 Test St", city: "Bolton", postalCode: "BL1 1AA", country: "United Kingdom", phone: "+447700900001", isDefault: true });
  const cart = await call("GET", "/cart", shopper.token);
  r = await call("POST", "/payments/create-intent", shopper.token, { cartId: cart.body.cart?.id, deliveryCountry: "United Kingdom", deliveryAddress: "2 Test St, Bolton", walletAmount: 3000, checkoutCurrency: "GBP" });
  console.log("  info checkout", r.status, JSON.stringify(r.body).slice(0, 300));
  check("wallet checkout creates a real order", r.status < 300, JSON.stringify(r.body).slice(0, 300));
  r = await call("POST", "/vendors/me/offers", demo.token, { buyerIds: [shopper.user.id, buyerB.user.id], message: "10% off this week" });
  console.log("  info offer", r.status, JSON.stringify(r.body));
  check("store owner with BUYER role can send offer", r.status === 200 && r.body.sent === 1, JSON.stringify(r.body));
  check("offer refused for non-customer", r.body.failed === 1, JSON.stringify(r.body));
  r = await call("POST", "/vendors/me/offers", demo.token, { buyerIds: [shopper.user.id], message: "10% off this week" });
  check("retry doesn't message twice", r.body.alreadySent === 1 && r.body.sent === 0, JSON.stringify(r.body));
  r = await call("POST", "/vendors/me/offers", buyerB.token, { buyerIds: [shopper.user.id], message: "spam" });
  check(`no-store user can't send offers [${r.status}]`, r.status === 403, JSON.stringify(r.body));
  r = await call("POST", "/vendors/me/offers", demo.token, { buyerIds: Array.from({ length: 201 }, (_, i) => "x" + i), message: "bulk" });
  check(`bulk cap enforced [${r.status}]`, r.status === 400, JSON.stringify(r.body));
  r = await call("GET", "/vendors/me/buyers", demo.token);
  check("vendor buyer list works", r.status === 200 && (r.body.items ?? []).length >= 1, JSON.stringify(r.body).slice(0, 200));
  r = await call("GET", `/vendors/me/buyers/${buyerB.user.id}`, demo.token);
  check(`can't read a non-customer's profile [${r.status}]`, r.status === 404, JSON.stringify(r.body).slice(0, 200));

  // ----------------------------------------------------------- general abuse
  section("ACCESS CONTROL SWEEP");
  for (const [m, p] of [
    ["GET", "/admin/users"], ["GET", "/admin/community-buy/ledger"], ["GET", "/admin/subscriptions"], ["GET", "/admin/community-buy/supplier-accounts"],
    ["POST", "/admin/users/demo-create"], ["GET", "/admin/community-buy/markets"],
  ]) {
    r = await call(m, p, buyerA.token, m === "POST" ? {} : undefined);
    check(`buyer blocked from ${m} ${p} [${r.status}]`, r.status === 403, JSON.stringify(r.body).slice(0, 120));
    r = await call(m, p, null, m === "POST" ? {} : undefined);
    check(`anonymous blocked from ${m} ${p} [${r.status}]`, r.status === 401, JSON.stringify(r.body).slice(0, 120));
  }
  r = await call("POST", "/internal/jobs/automation-sweep", buyerA.token, {});
  check(`internal jobs reject user tokens [${r.status}]`, r.status === 401 || r.status === 403, JSON.stringify(r.body).slice(0, 120));
  r = await call("GET", "/auth/me", "not.a.token");
  check(`forged token rejected [${r.status}]`, r.status === 401);
  r = await call("PATCH", "/auth/me", buyerB.token, { role: "ADMIN", isTest: true, name: "Renamed" });
  const b = await prisma.user.findUnique({ where: { id: buyerB.user.id }, select: { role: true } });
  check("can't self-promote through profile update", b.role !== "ADMIN", JSON.stringify(b));

  console.log(`\nRESULT pass=${pass} fail=${fail}`);
  if (failures.length) console.log("FAILED:\n - " + failures.join("\n - "));
  await prisma.$disconnect();
})().catch(async (e) => {
  console.log("CRASH", e.stack || e);
  console.log(`\nRESULT pass=${pass} fail=${fail}`);
  if (failures.length) console.log("FAILED:\n - " + failures.join("\n - "));
  await prisma.$disconnect();
  process.exit(1);
});
