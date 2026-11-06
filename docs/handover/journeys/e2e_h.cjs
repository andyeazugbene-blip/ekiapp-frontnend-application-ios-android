// Demo account with every status, against the local verification database only.
const path = require("path");
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
  else { fail += 1; console.log("  FAIL " + name, detail === undefined ? "" : JSON.stringify(detail).slice(0, 400)); }
}
async function call(method, url, token, body, headers = {}) {
  const res = await fetch(API + url, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, body: json };
}
const ALL_STATUSES = ["DRAFT", "UNDER_REVIEW", "CHANGES_REQUIRED", "APPROVED", "REJECTED", "LIVE", "PAUSED", "CLOSING", "RESCUE_WINDOW", "SUCCEEDED", "FAILED", "REFUNDING", "FULFILLING", "COMPLETED", "FINANCIALLY_CLOSED", "CANCELLED", "CANCELLATION_UNDER_REVIEW"];

(async () => {
  const stamp = Date.now();
  const adminUser = await prisma.user.findUniqueOrThrow({ where: { email: "seed_qa_admin@example.com" } });
  const superRole = await prisma.adminRole.findUniqueOrThrow({ where: { name: "Super Administrator" } });
  await prisma.adminRoleAssignment.upsert({ where: { roleId_userId: { roleId: superRole.id, userId: adminUser.id } }, create: { roleId: superRole.id, userId: adminUser.id }, update: {} });
  const admin = tokenFor(adminUser);

  console.log("New demo account");
  const stripeBefore = await prisma.communityBuyPaymentAuthorisation.count();
  let r = await call("POST", "/admin/users/demo-create", admin, { email: `h.demo.${stamp}@example.test`, password: "LocalVerify123!", name: "H Demo", reason: "Testing the full demo account", fullFeature: true, country: "GB", storeName: `H Demo Foods ${stamp}` });
  check(`created [${r.status}]`, r.status === 201, r.body);
  check("every step finished, no warnings", Array.isArray(r.body?.showcase?.warnings) && r.body.showcase.warnings.length === 0, r.body?.showcase?.warnings);
  const userId = r.body.userId;
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const token = tokenFor(user);

  console.log("Supplier, already open");
  const account = await prisma.supplierAccount.findUniqueOrThrow({ where: { userId } });
  check("supplier account is approved from the start", account.supplierState === "APPROVED" && account.approvedAt !== null);
  const supplierCampaigns = await prisma.communityCampaign.findMany({ where: { supplierAccountId: account.id }, select: { title: true, status: true, supplierCommitted: true } });
  check("supplier has campaigns to work on", supplierCampaigns.length >= 11, supplierCampaigns.length);
  const offers = await prisma.supplierOffer.groupBy({ by: ["status"], where: { supplierAccountId: account.id } });
  check("supplier has an offer in each state", ["DRAFT", "IN_REVIEW", "INFO_REQUIRED", "APPROVED", "REJECTED"].every((s) => offers.some((o) => o.status === s)), offers);
  const fulfilments = await prisma.campaignFulfilment.groupBy({ by: ["status"], where: { campaign: { supplierAccountId: account.id } } });
  check("supplier has each fulfilment stage", ["AWAITING_INVENTORY_CONFIRMATION", "INVENTORY_CONFIRMED", "PACKING", "READY_FOR_DISPATCH_OR_COLLECTION", "DISPATCHED", "COMPLETED"].every((s) => fulfilments.some((f) => f.status === s)), fulfilments);
  const supList = await call("GET", "/supplier/campaigns", token);
  const supRows = supList.body?.items ?? supList.body?.campaigns ?? supList.body ?? [];
  check(`the supplier screen's data loads [${supList.status}]`, supList.status === 200 && Array.isArray(supRows) && supRows.length >= 11, Array.isArray(supRows) ? supRows.length : supList.body);
  const offerList = await call("GET", "/community-buy/supplier-offers/mine", token);
  console.log(`    supplier offers route said ${offerList.status}`);

  console.log("Every Community Buy status");
  const organiser = await prisma.organiserProfile.findUniqueOrThrow({ where: { userId } });
  const own = await prisma.communityCampaign.groupBy({ by: ["status"], where: { organiserId: organiser.id } });
  const missing = ALL_STATUSES.filter((s) => !own.some((o) => o.status === s));
  check(`organiser has all ${ALL_STATUSES.length} statuses`, missing.length === 0, missing);
  const disputed = await prisma.communityCampaign.count({ where: { organiserId: organiser.id, disputedAt: { not: null } } });
  check("a disputed campaign exists", disputed === 1, disputed);
  const cancelReq = await prisma.campaignCancellationRequest.count({ where: { requestedByUserId: userId, status: "PENDING" } });
  check("a cancellation request backs that status", cancelReq === 1, cancelReq);
  r = await call("GET", "/organiser/campaigns", token);
  const orgRows = r.body?.items ?? r.body?.campaigns ?? r.body ?? [];
  const orgStatuses = new Set(Array.isArray(orgRows) ? orgRows.map((c) => c.status) : []);
  check(`the organiser screen shows all statuses [${r.status}]`, r.status === 200 && ALL_STATUSES.every((st) => orgStatuses.has(st)), ALL_STATUSES.filter((st) => !orgStatuses.has(st)));

  const participant = await prisma.campaignContribution.groupBy({ by: ["status"], where: { participant: { userId } } });
  check("as a buyer: pledged, paid, failed, refunding and refunded", ["PLEDGED", "PAID", "CHARGE_FAILED", "REFUND_PROCESSING", "REFUNDED", "CANCELLED"].every((s) => participant.some((p) => p.status === s)), participant);
  r = await call("GET", "/community-buy/my-contributions", token);
  const mine = r.body?.items ?? r.body?.contributions ?? r.body ?? [];
  check(`the buyer's Community Buys load [${r.status}]`, r.status === 200 && Array.isArray(mine) && mine.length >= 10, Array.isArray(mine) ? mine.length : r.body);

  console.log("Orders and subscriptions");
  const asBuyer = await prisma.order.groupBy({ by: ["status"], where: { buyerId: userId, isTest: true } });
  check("buyer has an order in each status", asBuyer.length >= 11, asBuyer.length);
  const vendor = await prisma.vendor.findUniqueOrThrow({ where: { userId } });
  const asVendor = await prisma.order.groupBy({ by: ["status"], where: { vendorId: vendor.id } });
  check("vendor has an order in each status", asVendor.length >= 11, asVendor.length);
  const subs = await prisma.buyerSubscription.groupBy({ by: ["status"], where: { buyerId: userId } });
  check("buyer has subscriptions in each state", ["ACTIVE", "PAUSED", "PAYMENT_ATTENTION", "CANCELLED"].every((s) => subs.some((x) => x.status === s)), subs);
  const dispute = await prisma.dispute.count({ where: { buyerId: userId } });
  check("a disputed order has its case", dispute === 1, dispute);

  console.log("Safety");
  const real = await prisma.user.create({ data: { email: `h.real.${stamp}@example.test`, password: "x", name: "H Real", role: "BUYER", country: "United Kingdom" } });
  const realUser = await prisma.user.create({ data: { email: `h.real2.${stamp}@example.test`, password: "x", name: "H Real 2", role: "BUYER", country: "United Kingdom" } });
  const publicList = await call("GET", "/community-buy/campaigns", tokenFor(real));
  const leaked = JSON.stringify(publicList.body ?? {}).includes("Demo Rice");
  check(`real buyers don't see demo campaigns [${publicList.status}]`, publicList.status === 200 && !leaked);
  r = await call("POST", `/admin/users/${real.id}/demo-fill`, admin, { reason: "Trying it on a real account" });
  check(`refused on a real account [${r.status}]`, r.status === 409 && r.body?.code === "NOT_A_DEMO_ACCOUNT", r.body);
  check("the real account got nothing", (await prisma.supplierAccount.count({ where: { userId: real.id } })) === 0);

  const authorisationsAfter = await prisma.communityBuyPaymentAuthorisation.count();
  check("no card holds were created", authorisationsAfter === stripeBefore);
  const withStripe = await prisma.campaignContribution.count({ where: { participant: { userId }, stripePaymentIntentId: { not: null } } });
  check("no demo contribution has a Stripe payment", withStripe === 0, withStripe);

  const before = await prisma.communityCampaign.findFirstOrThrow({ where: { organiserId: organiser.id, status: "LIVE", title: { contains: "below minimum" } } });
  await prisma.communityCampaign.update({ where: { id: before.id }, data: { deadline: new Date(Date.now() - 86400000) } });
  const rescue = await prisma.communityCampaign.findFirstOrThrow({ where: { organiserId: organiser.id, status: "RESCUE_WINDOW" } });
  await prisma.communityCampaign.update({ where: { id: rescue.id }, data: { rescueEndsAt: new Date(Date.now() - 86400000) } });
  const pc = await prisma.campaignContribution.findFirstOrThrow({ where: { campaignId: before.id } });
  await prisma.communityCampaign.update({ where: { id: before.id }, data: { deadline: new Date(Date.now() - 86400000) } });
  await prisma.campaignContribution.update({ where: { id: pc.id }, data: { status: "REFUND_PENDING" } });
  const pendingRefund = await prisma.campaignRefund.create({ data: { contributionId: pc.id, amount: 100, currency: "GBP", status: "REFUND_PENDING", idempotencyKey: `h:${stamp}` } });

  const realOrg = await prisma.organiserProfile.create({ data: { userId: realUser.id, country: "GB" } });
  const realCampaign = await prisma.communityCampaign.create({ data: { organiserId: realOrg.id, title: `H Real ${stamp}`, country: "GB", currency: "GBP", targetAmount: 1000, status: "LIVE", minimumShares: 1, goalShares: 2, maximumShares: 3, pricePerShareMinor: 500, deadline: new Date(Date.now() - 86400000) } });

  r = await call("POST", "/internal/jobs/community-buy-sweep", null, {}, { Authorization: `Bearer ${SECRET}` });
  if (r.status === 404 || r.status === 405) r = await call("GET", "/internal/jobs/community-buy-sweep", null, undefined, { Authorization: `Bearer ${SECRET}` });
  check(`sweep ran [${r.status}]`, r.status === 200, r.body);
  const afterLive = await prisma.communityCampaign.findUniqueOrThrow({ where: { id: before.id } });
  check("a demo campaign past its deadline isn't closed or charged", afterLive.status === "LIVE", afterLive.status);
  const afterRescue = await prisma.communityCampaign.findUniqueOrThrow({ where: { id: rescue.id } });
  check("a demo completion period doesn't end by itself", afterRescue.status === "RESCUE_WINDOW", afterRescue.status);
  const afterRefund = await prisma.campaignRefund.findUniqueOrThrow({ where: { id: pendingRefund.id } });
  check("a demo refund is never sent to Stripe", afterRefund.status === "REFUND_PENDING" && !afterRefund.stripeRefundId, afterRefund);
  const afterReal = await prisma.communityCampaign.findUniqueOrThrow({ where: { id: realCampaign.id } });
  check("a real campaign past its deadline still closes", afterReal.status !== "LIVE", afterReal.status);

  console.log("What each person can see");
  const staff = ["adminIssueNotes", "disputeReason", "disputedById", "reviewedById"];
  const commercial = ["wholesaleAmountMinor", "reviewNotes", "reviewCriteria", "supplierDeclineReason", "paidTotal", "disputedAt"];
  const stripeBits = ["providerConnectedAccountId", "stripeRequirements", "chargesEnabled", "payoutsEnabled"];
  const noneOf = (body, keys) => keys.filter((k) => JSON.stringify(body ?? {}).includes(`"${k}"`));
  const supplierCamp = await prisma.communityCampaign.findFirstOrThrow({ where: { supplierAccountId: account.id, status: "LIVE", title: { contains: "Accepted" } } });
  const otherBuyer = await prisma.user.create({ data: { email: `h.other.${stamp}@example.test`, password: "x", name: "H Other", role: "BUYER", country: "United Kingdom", isTest: true } });
  const other = tokenFor(otherBuyer);
  r = await call("GET", "/community-buy/campaigns", other);
  check(`a buyer's list has no staff notes [${r.status}]`, r.status === 200 && r.body.items.length > 0 && noneOf(r.body, staff).length === 0, noneOf(r.body, staff));
  check("a buyer's list has no commercial terms", noneOf(r.body, commercial).length === 0, noneOf(r.body, commercial));
  check("a buyer's list has no supplier payout details", noneOf(r.body, stripeBits).length === 0, noneOf(r.body, stripeBits));
  r = await call("GET", `/community-buy/campaigns/${supplierCamp.id}`, other);
  check(`a buyer's campaign page has none of them [${r.status}]`, r.status === 200 && noneOf(r.body, [...staff, ...commercial, ...stripeBits]).length === 0, noneOf(r.body, [...staff, ...commercial, ...stripeBits]));
  check("a buyer still sees the supplier's name and the price", r.body?.campaign?.supplierAccount?.user?.name && r.body?.campaign?.pricePerShareMinor === 2500, r.body?.campaign?.supplierAccount);
  r = await call("GET", `/community-buy/campaigns/${supplierCamp.id}`, token);
  check("the supplier keeps the wholesale price", r.body?.campaign?.wholesaleAmountMinor === 1800, r.body?.campaign?.wholesaleAmountMinor);
  check("the supplier doesn't get staff notes", noneOf(r.body, staff).length === 0, noneOf(r.body, staff));
  const ownDisputed = await prisma.communityCampaign.findFirstOrThrow({ where: { organiserId: organiser.id, disputedAt: { not: null } } });
  r = await call("GET", `/community-buy/campaigns/${ownDisputed.id}`, token);
  check("the organiser sees it's disputed, not the staff reason", Boolean(r.body?.campaign?.disputedAt) && noneOf(r.body, staff).length === 0, noneOf(r.body, staff));
  r = await call("GET", "/organiser/campaigns", token);
  check("the organiser list has no staff notes", noneOf(r.body, staff).length === 0, noneOf(r.body, staff));
  r = await call("GET", "/supplier/campaigns", token);
  check("the supplier list has no staff notes", noneOf(r.body, staff).length === 0, noneOf(r.body, staff));
  const joined = await prisma.communityCampaign.findFirstOrThrow({ where: { title: { contains: "You pledged, campaign live" }, participants: { some: { userId } } } });
  r = await call("GET", `/community-buy/campaigns/${joined.id}`, token);
  check("a participant opens their campaign without commercial terms", r.status === 200 && noneOf(r.body, commercial).length === 0, noneOf(r.body, commercial));
  r = await call("GET", `/admin/community-campaigns/${ownDisputed.id}/admin-detail`, admin);
  check(`staff still see the reason in the admin panel [${r.status}]`, r.status === 200 && JSON.stringify(r.body).includes("disputeReason"));

  console.log("Filling an existing account");
  r = await call("POST", `/admin/users/${userId}/demo-fill`, admin, { reason: "Running it a second time" });
  check(`running again adds nothing [${r.status}]`, r.status === 200 && r.body?.created?.campaigns === 0 && r.body?.created?.offers === 0 && r.body?.created?.orders === 0 && r.body?.created?.subscriptions === 0, r.body);

  const older = await prisma.user.create({ data: { email: `h.old.${stamp}@example.test`, password: "x", name: "H Old", role: "VENDOR", country: "United Kingdom", isTest: true } });
  await prisma.vendor.create({ data: { userId: older.id, storeName: `H Old Store ${stamp}`, storeSlug: `h-old-${stamp}`, country: "United Kingdom", currency: "GBP", isTest: true } });
  r = await call("POST", `/admin/users/${older.id}/demo-fill`, admin, { reason: "Filling an older demo account" });
  check(`an older demo account gets everything [${r.status}]`, r.status === 200 && r.body?.created?.campaigns >= 40 && r.body?.supplierAccountId, r.body);
  const olderAccount = await prisma.supplierAccount.findUnique({ where: { userId: older.id } });
  check("its supplier account is open", olderAccount?.supplierState === "APPROVED");
  const audit = await prisma.auditLog.count({ where: { action: "user.demo_fill", entityId: older.id } });
  check("the fill is audited", audit === 1, audit);

  console.log(`\nRESULT pass=${pass} fail=${fail}`);
  console.log(`DEMO ${user.email}`);
  await prisma.$disconnect();
  process.exit(fail ? 1 : 0);
})().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
