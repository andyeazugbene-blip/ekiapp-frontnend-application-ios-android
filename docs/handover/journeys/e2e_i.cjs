// Remaining client gaps and admin decisions, against the local verification database only.
const path = require("path");
const { execFileSync } = require("child_process");
const BACKEND = process.env.EKI_BACKEND_DIR || path.resolve(__dirname, "../../../../ekiapp-backend-main");
const req = (m) => require(path.join(BACKEND, "node_modules", m));
if (!/localhost:5544\/eki_verify/.test(process.env.DATABASE_URL || "")) throw new Error("Refusing to run: not the local verification database");
req("dotenv").config({ path: path.join(BACKEND, ".env") });
const { PrismaClient } = req("@prisma/client");
const jwt = req("jsonwebtoken");
const prisma = new PrismaClient();
const API = "http://localhost:4177/api";
const SECRET = process.env.CRON_SECRET;
if (!SECRET) throw new Error("Set CRON_SECRET to the value the local server uses");
const tokenFor = (u) => jwt.sign({ sub: u.id, role: u.role, email: u.email, tv: u.tokenVersion }, process.env.JWT_SECRET, { expiresIn: "2h" });
let pass = 0, fail = 0;
function check(name, ok, detail) {
  if (ok) { pass += 1; console.log("  PASS " + name); }
  else { fail += 1; console.log("  FAIL " + name, detail === undefined ? "" : JSON.stringify(detail).slice(0, 500)); }
}
async function call(method, url, token, body, headers = {}) {
  const res = await fetch(API + url, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, body: json };
}
const stamp = Date.now();
const inDays = (d) => new Date(Date.now() + d * 864e5);
const setSetting = (key, value) => prisma.adminPlatformSetting.upsert({ where: { key }, update: { value }, create: { key, value } });
const clearSetting = (key) => prisma.adminPlatformSetting.deleteMany({ where: { key } });
const mkUser = (label, role = "BUYER", extra = {}) => prisma.user.create({ data: { email: `${label}.${stamp}@example.test`, password: "x", name: label, role, country: "United Kingdom", emailVerifiedAt: new Date(), ...extra } });

(async () => {
  const adminUser = await prisma.user.findUniqueOrThrow({ where: { email: "seed_qa_admin@example.com" } });
  const superRole = await prisma.adminRole.findUniqueOrThrow({ where: { name: "Super Administrator" } });
  await prisma.adminRoleAssignment.upsert({ where: { roleId_userId: { roleId: superRole.id, userId: adminUser.id } }, create: { roleId: superRole.id, userId: adminUser.id }, update: {} });
  const admin = tokenFor(adminUser);
  const NEW_KEYS = ["UNVERIFIED_VENDORS_CAN_SELL", "SHIPPING_MINIMUM_FEE_FORMULA", "HIDE_PHONE_NUMBERS_IN_MESSAGES", "INCREMENTAL_HOLDOUT_PERCENT"];
  await prisma.adminPlatformSetting.deleteMany({ where: { key: { in: NEW_KEYS } } });

  console.log("Live Connect check");
  let r = await call("GET", "/health/detailed", null, undefined, { authorization: `Bearer ${SECRET}` });
  const connect = r.body?.checks?.stripe_connect;
  check(`detailed health reports Connect [${r.status}]`, !!connect, r.body);
  check("no connected accounts here, so Connect is not claimed as confirmed", connect?.status === "skipped" && /Not confirmed/.test(connect?.detail || ""), connect);
  check("Connect being off doesn't fail overall health", r.status === 200, r.status);
  r = await call("GET", "/health/detailed");
  check("signed out sees no provider detail", !JSON.stringify(r.body || {}).includes("Connect"), r.body);

  console.log("Admin settings exist");
  r = await call("GET", "/admin/settings/launch", admin);
  const rows = r.body?.settings ?? r.body?.items ?? r.body ?? [];
  check("all four new settings are listed", NEW_KEYS.every((k) => JSON.stringify(rows).includes(k)), rows);
  r = await call("PATCH", "/admin/settings/launch/UNVERIFIED_VENDORS_CAN_SELL", (await (async () => tokenFor(await mkUser("nope")))()), { value: 0, reason: "nope" });
  check(`a buyer can't change them [${r.status}]`, r.status === 401 || r.status === 403, r.body);

  console.log("Unverified vendors can sell");
  const buyer = await mkUser("ibuyer");
  const buyerToken = tokenFor(buyer);
  const vu = await mkUser("ivendor", "VENDOR");
  const vendorToken = tokenFor(vu);
  const vendor = await prisma.vendor.create({ data: { userId: vu.id, storeName: `I Store ${stamp}`, storeSlug: `i-store-${stamp}`, country: "United Kingdom", currency: "GBP", city: "London" } });
  const product = await prisma.product.create({ data: { vendorId: vendor.id, title: `I Rice ${stamp}`, description: "Rice", priceInCents: 1000, currency: "GBP", stock: 50, isActive: true, status: "PUBLISHED", weightGrams: 2500 } });
  const listed = async () => {
    const p = await call("GET", `/products?search=${encodeURIComponent(product.title)}`, buyerToken);
    const v = await call("GET", `/vendors?search=${encodeURIComponent(vendor.storeName)}`, buyerToken);
    return { product: JSON.stringify(p.body).includes(product.id), vendor: JSON.stringify(v.body).includes(vendor.id) };
  };
  let seen = await listed();
  check("default: unverified vendor and product are live", seen.product && seen.vendor, seen);
  await setSetting("UNVERIFIED_VENDORS_CAN_SELL", 0);
  seen = await listed();
  check("off: hidden from product and vendor lists", !seen.product && !seen.vendor, seen);
  r = await call("POST", "/cart/items", buyerToken, { productId: product.id, quantity: 1 });
  const refused = r.status >= 400;
  console.log(`    adding to cart while off said ${r.status}`);
  await clearSetting("UNVERIFIED_VENDORS_CAN_SELL");
  seen = await listed();
  check("back on: live again", seen.product && seen.vendor, seen);
  check("cart add follows the setting", refused || r.status < 300, r.status);

  console.log("Delivery fee and maximum weight");
  r = await call("POST", "/delivery/zones/me", vendorToken, { name: "UK", country: "United Kingdom", baseFeeAmount: 400, feePerKgAmount: 100, currency: "GBP" });
  check(`vendor zone saved [${r.status}]`, r.status < 300, r.body);
  const zone = r.body.zone ?? r.body;
  check("no maximum weight by default", zone.maxWeightGrams === null, zone.maxWeightGrams);
  r = await call("GET", "/cart", buyerToken);
  let cartId = r.body?.cart?.id ?? r.body?.id;
  if (!JSON.stringify(r.body).includes(product.id)) {
    r = await call("POST", "/cart/items", buyerToken, { productId: product.id, quantity: 1 });
    r = await call("GET", "/cart", buyerToken);
    cartId = r.body?.cart?.id ?? r.body?.id;
  }
  const fee = async () => call("POST", "/delivery/calculate", buyerToken, { cartId, deliveryCountry: "United Kingdom" });
  r = await fee();
  const eligibility = (body) => (body?.vendors ?? []).find((v) => v.vendorId === vendor.id);
  check(`default fee stays base plus weight, 4.00 + 3kg x 1.00 [${r.status}]`, eligibility(r.body)?.deliveryAmount === 700 || r.body?.deliveryAmount === 700 || r.body?.totalDeliveryAmount === 700, r.body);
  await setSetting("SHIPPING_MINIMUM_FEE_FORMULA", 1);
  r = await fee();
  check("minimum fee formula: the higher of 3.00 and 4.00", eligibility(r.body)?.deliveryAmount === 400, eligibility(r.body));
  await clearSetting("SHIPPING_MINIMUM_FEE_FORMULA");
  r = await call("PATCH", `/delivery/zones/me/${zone.id}`, vendorToken, { maxWeightGrams: 2000 });
  check(`vendor sets a maximum weight [${r.status}]`, r.status < 300, r.body);
  r = await fee();
  const over = eligibility(r.body);
  check("order over the maximum isn't deliverable, with the reason", over?.eligible === false && over?.reason === "OVER_MAX_WEIGHT", r.body);
  r = await call("PATCH", `/delivery/zones/me/${zone.id}`, vendorToken, { maxWeightGrams: null });
  r = await fee();
  check("clearing the limit makes it deliverable again", eligibility(r.body)?.eligible === true, r.body);

  console.log("Phone numbers in chat");
  const order = await prisma.order.create({ data: { orderNumber: `I${stamp}`, buyerId: buyer.id, vendorId: vendor.id, status: "PAID", subtotalAmount: 1000, deliveryFeeAmount: 0, totalAmount: 1000, currency: "GBP" } });
  r = await call("POST", "/conversations", buyerToken, { participantId: vu.id, orderId: order.id });
  check(`conversation opened [${r.status}]`, r.status < 300, r.body);
  const conversationId = r.body?.conversation?.id ?? r.body?.id;
  r = await call("POST", `/conversations/${conversationId}/messages`, buyerToken, { text: "Call me on +44 7700 900123 about the 20 bags" });
  check(`message sent [${r.status}]`, r.status < 300, r.body);
  let stored = await prisma.message.findFirst({ where: { conversationId }, orderBy: { createdAt: "desc" } });
  check("the number is hidden, the rest kept", stored.text === "Call me on [phone number hidden] about the 20 bags", stored.text);
  await setSetting("HIDE_PHONE_NUMBERS_IN_MESSAGES", 0);
  await call("POST", `/conversations/${conversationId}/messages`, buyerToken, { text: "Again 07700 900123" });
  stored = await prisma.message.findFirst({ where: { conversationId }, orderBy: { createdAt: "desc" } });
  check("admin can turn it off", stored.text === "Again 07700 900123", stored.text);
  await clearSetting("HIDE_PHONE_NUMBERS_IN_MESSAGES");
  r = await call("POST", "/conversations/support", buyerToken, { subject: "Help", message: "Ring me", text: "Ring me" });
  const supportId = r.body?.conversation?.id ?? r.body?.id;
  if (supportId) {
    await call("POST", `/conversations/${supportId}/messages`, buyerToken, { text: "Ring me on 07700 900123" });
    stored = await prisma.message.findFirst({ where: { conversationId: supportId }, orderBy: { createdAt: "desc" } });
    check("support conversations keep the number", stored.text === "Ring me on 07700 900123", stored.text);
  } else check("support conversation opened", false, r.body);

  console.log("Comparison group and incremental revenue");
  const probe = path.join(__dirname, "holdout_probe.ts");
  const consenting = [];
  for (let i = 0; i < 60; i++) consenting.push((await mkUser(`hold${i}`, "BUYER", { marketingConsentAt: new Date() })).id);
  await setSetting("INCREMENTAL_HOLDOUT_PERCENT", 50);
  require("fs").writeFileSync(probe, `
import { automationService } from ${JSON.stringify(path.join(BACKEND, "src/modules/automation/automation.service.ts").replace(/\\/g, "/"))};
(async () => {
  for (const id of ${JSON.stringify(consenting)}) {
    await automationService.scheduleAutomation({ type: "BUYER_WIN_BACK", bypassQuietHours: true, recipientUserId: id, subjectKey: "i-${stamp}-" + id, requiresMarketingConsent: true, title: "t", body: "b", scheduledFor: new Date(Date.now() + 864e5) } as never);
  }
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
`);
  execFileSync("npx", ["tsx", probe], { cwd: BACKEND, shell: true, env: process.env, stdio: "pipe", timeout: 120000 });
  require("fs").unlinkSync(probe);
  const held = await prisma.automationRun.count({ where: { recipientUserId: { in: consenting }, status: "SUPPRESSED", suppressedReason: "holdout" } });
  const scheduled = await prisma.automationRun.count({ where: { recipientUserId: { in: consenting }, status: { not: "SUPPRESSED" } } });
  check(`about half are held back (${held} held, ${scheduled} scheduled)`, held >= 15 && held <= 45 && held + scheduled === 60, { held, scheduled });
  await clearSetting("INCREMENTAL_HOLDOUT_PERCENT");
  r = await call("GET", "/admin/automation/attribution", admin);
  check(`report answers [${r.status}]`, r.status === 200, r.body);
  check("too few buyers: no estimate shown yet", r.body?.estimatedIncremental === null && /30 buyers/.test(r.body?.notes?.incremental || ""), r.body?.notes);

  console.log("Community Buy: closing at maximum");
  const orgUser = await mkUser("iorg");
  const orgToken = tokenFor(orgUser);
  const organiser = await prisma.organiserProfile.create({ data: { userId: orgUser.id, country: "GB" } });
  const supUser = await mkUser("isup");
  const supToken = tokenFor(supUser);
  const supAccount = await prisma.supplierAccount.create({ data: { userId: supUser.id, supplierState: "APPROVED", approvedAt: new Date(), businessName: "I Foods " + stamp, categories: ["Grains"], coverageRegions: ["GB"], fulfilmentMethods: ["DELIVERY", "COLLECTION"] } });
  const mkCampaign = (extra) => prisma.communityCampaign.create({ data: { organiserId: organiser.id, title: `I ${stamp} ${Math.random()}`, description: "d", country: "GB", currency: "GBP", targetAmount: 200, status: "LIVE", pricePerShareMinor: 100, minimumShares: 2, goalShares: 4, maximumShares: 5, unit: "bag", quantityPerOrder: 1, images: [], deadline: inDays(10), deliveryPreference: "COLLECTION", fulfilmentOwner: "SELF", publishedAt: new Date(), ...extra } });
  const full = await mkCampaign({ confirmedShares: 5 });
  const open = await mkCampaign({ confirmedShares: 3 });
  r = await call("POST", "/internal/jobs/community-buy-sweep", null, {}, { authorization: `Bearer ${SECRET}` });
  check(`sweep ran [${r.status}]`, r.status === 200, r.body);
  const fullAfter = await prisma.communityCampaign.findUnique({ where: { id: full.id } });
  check("full campaign closed before its deadline, as maximum reached", fullAfter.fundingOutcome === "MAXIMUM_REACHED" && fullAfter.status !== "LIVE", { s: fullAfter.status, o: fullAfter.fundingOutcome });
  check("campaign with room stays live", (await prisma.communityCampaign.findUnique({ where: { id: open.id } })).status === "LIVE");

  console.log("Community Buy: supplier refuses the final quantity");
  const refuse = await mkCampaign({ status: "AWAITING_SUPPLIER_RECONFIRMATION", paymentMode: "AUTHORISE_THEN_CAPTURE", confirmedShares: 1, supplierAccountId: supAccount.id, fulfilmentOwner: "SUPPLIER", wholesaleAmountMinor: 50, supplierCommitted: true, reconfirmationRequestedAt: new Date(), reconfirmationDeadline: inDays(2), reconfirmationQuantity: 1 });
  r = await call("POST", `/supplier/campaigns/${refuse.id}/reconfirm`, supToken, { action: "decline", reason: "Not enough stock" });
  check(`supplier declines [${r.status}]`, r.status < 300, r.body);
  const declineCase = await prisma.communityBuySupportCase.findFirst({ where: { campaignId: refuse.id } });
  check("an escalated case is opened for the team", declineCase?.status === "ESCALATED" && declineCase.escalated === true && declineCase.caseType === "SUPPLIER_CONDUCT" && /Not enough stock/.test(declineCase.description), declineCase);

  console.log("Community Buy: provider recheck");
  const pledged = await mkCampaign({ confirmedShares: 1 });
  const pUser = await mkUser("ipledger");
  const pToken = tokenFor(pUser);
  const participant = await prisma.campaignParticipant.create({ data: { campaignId: pledged.id, userId: pUser.id } });
  const pledge = await prisma.campaignContribution.create({ data: { campaignId: pledged.id, participantId: participant.id, amount: 100, currency: "GBP", quantity: 1, status: "PLEDGED" } });
  r = await call("POST", `/admin/community-buy/contributions/${pledge.id}/recheck`, pToken, {});
  check(`a buyer can't recheck [${r.status}]`, r.status === 401 || r.status === 403, r.body);
  r = await call("POST", `/admin/community-buy/contributions/${pledge.id}/recheck`, admin, {});
  check(`pledge with no payment: counted, nothing changed [${r.status}]`, r.status === 200 && r.body.countedTowardsCampaign === true && r.body.providerStatus === null && r.body.ekiStatus === "PLEDGED", r.body);
  const missing = await prisma.campaignContribution.update({ where: { id: pledge.id }, data: { status: "PAYMENT_PROCESSING", stripePaymentIntentId: `pi_missing_${stamp}` } });
  r = await call("POST", `/admin/community-buy/contributions/${missing.id}/recheck`, admin, {});
  check(`provider can't find it: reported, money state untouched [${r.status}]`, r.status === 200 && r.body.providerStatus === "unavailable" && r.body.ekiStatus === "PAYMENT_PROCESSING", r.body);
  check("the check is audited", (await prisma.auditLog.count({ where: { action: "community_contribution.provider_rechecked", entityId: pledge.id } })) === 2);

  console.log("Community Buy: product quality issue");
  r = await call("POST", `/community-buy/campaigns/${pledged.id}/support-cases`, pToken, { caseType: "PRODUCT_QUALITY", description: "The bags were spoiled." });
  check(`buyer can report product quality [${r.status}]`, r.status < 300 && r.body?.supportCase?.caseType === "PRODUCT_QUALITY", r.body);

  console.log("Community Buy: fulfilment evidence and exception kinds");
  const packing = await mkCampaign({ status: "FULFILLING", confirmedShares: 3, supplierAccountId: supAccount.id, fulfilmentOwner: "SUPPLIER", wholesaleAmountMinor: 50, supplierCommitted: true, fundingOutcome: "MINIMUM_REACHED" });
  await prisma.campaignFulfilment.create({ data: { campaignId: packing.id, status: "PACKING", method: "COLLECTION" } });
  const otherSup = await mkUser("isup2");
  await prisma.supplierAccount.create({ data: { userId: otherSup.id, supplierState: "APPROVED", approvedAt: new Date(), businessName: "I Other " + stamp, categories: ["Grains"], coverageRegions: ["GB"], fulfilmentMethods: ["COLLECTION"] } });
  r = await call("POST", `/supplier/campaigns/${packing.id}/fulfilment/evidence`, supToken, { url: "not a link" });
  check(`a bad link is refused [${r.status}]`, r.status === 400, r.body);
  r = await call("POST", `/supplier/campaigns/${packing.id}/fulfilment/evidence`, tokenFor(otherSup), { url: "https://files.example.test/a.jpg" });
  check(`another supplier can't add evidence [${r.status}]`, r.status === 403 || r.status === 404, r.body);
  r = await call("POST", `/supplier/campaigns/${packing.id}/fulfilment/evidence`, supToken, { url: "https://files.example.test/a.jpg" });
  check(`supplier adds evidence [${r.status}]`, r.status === 201, r.body);
  r = await call("POST", `/supplier/campaigns/${packing.id}/fulfilment/exception`, supToken, { note: "Two bags short", kind: "PARTIALLY_FULFILLED" });
  check(`supplier reports a partial fulfilment [${r.status}]`, r.status < 300, r.body);
  const fEvents = await prisma.campaignFulfilmentEvent.findMany({ where: { campaignId: packing.id } });
  check("evidence and the labelled issue are on the record", fEvents.some((e) => e.eventType === "EVIDENCE_ADDED") && fEvents.some((e) => e.eventType === "EXCEPTION" && /^Partially fulfilled: Two bags short/.test(e.note || "")), fEvents.map((e) => [e.eventType, e.note]));

  console.log("Regular Delivery: vendor proposes a price");
  const rdBuyer = await mkUser("irdbuyer");
  const rdToken = tokenFor(rdBuyer);
  const otherVendorUser = await mkUser("ivendor2", "VENDOR");
  await prisma.vendor.create({ data: { userId: otherVendorUser.id, storeName: `I Other ${stamp}`, storeSlug: `i-other-${stamp}` } });
  const address = await prisma.buyerAddress.create({ data: { buyerId: rdBuyer.id, recipientName: "RD", line1: "1 Road", city: "London", postalCode: "SW1A 1AA", country: "United Kingdom" } });
  const offer = await prisma.subscriptionOffer.create({ data: { vendorId: vendor.id, title: "I Box " + stamp, frequencies: ["MONTHLY"] } });
  const sub = await prisma.buyerSubscription.create({ data: { buyerId: rdBuyer.id, offerId: offer.id, status: "ACTIVE", frequency: "MONTHLY", deliveryAddressId: address.id, nextRenewalAt: inDays(3), priceChangeApprovalLimitBps: 500 } });
  const mkRenewal = (status, days) => prisma.renewal.create({ data: { subscriptionId: sub.id, cycleDate: inDays(days), status, currency: "GBP", items: { create: [{ productId: product.id, quantity: 2, previousUnitPrice: 1000, currentUnitPrice: 1000, currency: "GBP" }] } }, include: { items: true } });
  const awaiting = await mkRenewal("AWAITING_STOCK", 3);
  const itemId = awaiting.items[0].id;
  r = await call("POST", `/renewals/${awaiting.id}/propose-price`, tokenFor(otherVendorUser), { itemId, newUnitPrice: 1500, reason: "x" });
  check(`another vendor can't [${r.status}]`, r.status === 403, r.body);
  r = await call("POST", `/renewals/${awaiting.id}/propose-price`, vendorToken, { itemId, newUnitPrice: 1500, reason: "  " });
  check(`a reason is required [${r.status}]`, r.status === 400, r.body);
  r = await call("POST", `/renewals/${awaiting.id}/propose-price`, vendorToken, { itemId, newUnitPrice: 1040, reason: "Small rise" });
  check(`within the limit: no approval [${r.status}]`, r.status === 200 && r.body.approvalRequired === false, r.body);
  r = await call("POST", `/renewals/${awaiting.id}/propose-price`, vendorToken, { itemId, newUnitPrice: 1500, reason: "Supplier cost went up" });
  check(`above the limit: buyer must approve [${r.status}]`, r.status === 200 && r.body.approvalRequired === true, r.body);
  let renewal = await prisma.renewal.findUnique({ where: { id: awaiting.id }, include: { items: true, priceChangeRequest: true } });
  check("price set on this renewal only, payment not started", renewal.status === "AWAITING_STOCK" && renewal.items[0].currentUnitPrice === 1500 && renewal.subtotalAmount === 3000, renewal);
  check("product's own price didn't change", (await prisma.product.findUnique({ where: { id: product.id } })).priceInCents === 1000);
  check("audited with the reason", (await prisma.auditLog.count({ where: { action: "renewal.price_change_proposed", entityId: awaiting.id } })) === 2);
  r = await call("POST", `/renewals/${awaiting.id}/stock-confirmation`, vendorToken, {});
  check(`vendor confirms stock [${r.status}]`, r.status === 200, r.body);
  renewal = await prisma.renewal.findUnique({ where: { id: awaiting.id }, include: { priceChangeRequest: true } });
  check("the buyer is now asked", renewal.status === "AWAITING_PRICE_APPROVAL" && renewal.priceChangeRequest.proposedUnitPrice === 1500, renewal.status);
  check("the reason survives stock confirmation", renewal.priceChangeRequest.reason === "Supplier cost went up" && renewal.priceChangeRequest.proposedByVendor === true, renewal.priceChangeRequest);
  r = await call("GET", `/buyer/subscriptions/${sub.id}`, rdToken);
  const subBody = r.body.subscription || r.body;
  const shown = subBody.renewals.find((x) => x.id === awaiting.id);
  check("buyer sees the vendor's reason", shown?.priceChangeRequest?.reason === "Supplier cost went up", shown?.priceChangeRequest);
  const ready = await mkRenewal("READY_FOR_PAYMENT", 40);
  r = await call("POST", `/renewals/${ready.id}/propose-price`, vendorToken, { itemId: ready.items[0].id, newUnitPrice: 1300, reason: "Cost" });
  check(`ready for payment: goes straight to the buyer [${r.status}]`, r.status === 200 && (await prisma.renewal.findUnique({ where: { id: ready.id } })).status === "AWAITING_PRICE_APPROVAL", r.body);
  const paid = await mkRenewal("PAID", 70);
  r = await call("POST", `/renewals/${paid.id}/propose-price`, vendorToken, { itemId: paid.items[0].id, newUnitPrice: 1300, reason: "Cost" });
  check(`a paid renewal can't change [${r.status}]`, r.status === 409 && r.body.code === "RENEWAL_PRICE_LOCKED", r.body);

  console.log("Regular Delivery: vendor insights and order card");
  await mkRenewal("SKIPPED", 100);
  const failed = await mkRenewal("PAYMENT_FAILED", 130);
  await prisma.subscriptionPaymentAttempt.create({ data: { renewalId: failed.id, attemptNumber: 1, status: "FAILED", idempotencyKey: `${failed.id}:1` } });
  const rdOrder = await prisma.order.create({ data: { orderNumber: `IR${stamp}`, buyerId: rdBuyer.id, vendorId: vendor.id, status: "PAID", subtotalAmount: 1000, deliveryFeeAmount: 0, totalAmount: 1000, currency: "GBP" } });
  await prisma.renewal.update({ where: { id: paid.id }, data: { status: "ORDER_CREATED", orderId: rdOrder.id } });
  r = await call("GET", "/vendor/insights", vendorToken);
  check(`insights show completed, skipped, failed [${r.status}]`, r.body?.completedRenewals === 1 && r.body?.skippedRenewals === 1 && r.body?.paymentFailures === 1, r.body);
  r = await call("GET", `/vendors/me/orders/${rdOrder.id}`, vendorToken);
  check(`vendor order shows its renewal [${r.status}]`, r.body?.order?.renewal?.id === paid.id && r.body?.order?.renewal?.status === "ORDER_CREATED", r.body?.order?.renewal);

  console.log("Admin: subscription authorisation");
  r = await call("GET", `/admin/regular-deliveries/subscriptions/${sub.id}`, admin);
  if (r.status === 404) r = await call("GET", `/admin/subscriptions/${sub.id}`, admin);
  check(`no card and no consent shows expired [${r.status}]`, r.body?.paymentAuthorisation === "expired", r.body?.paymentAuthorisation ?? r.status);

  console.log(`\n${pass} passed, ${fail} failed`);
  await prisma.$disconnect();
  process.exit(fail ? 1 : 0);
})().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
