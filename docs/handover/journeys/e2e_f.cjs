// Contact masking, audited reveal and the Community Buy dispute hold, against the local verification database only.
const path = require("path");
const BACKEND = process.env.EKI_BACKEND_DIR || path.resolve(__dirname, "../../../../ekiapp-backend-main");
const req = (m) => require(path.join(BACKEND, "node_modules", m));
if (!/localhost:5544\/eki_verify/.test(process.env.DATABASE_URL || "")) throw new Error("Refusing to run: not the local verification database");
req("dotenv").config({ path: path.join(BACKEND, ".env") });
const { PrismaClient } = req("@prisma/client");
const jwt = req("jsonwebtoken");
const prisma = new PrismaClient();
const API = "http://localhost:4177/api";
const tokenFor = (u) => jwt.sign({ sub: u.id, role: u.role, email: u.email, tv: u.tokenVersion }, process.env.JWT_SECRET, { expiresIn: "2h" });

let pass = 0, fail = 0;
function check(name, ok, detail) {
  if (ok) { pass += 1; console.log("  PASS " + name); }
  else { fail += 1; console.log("  FAIL " + name, detail === undefined ? "" : JSON.stringify(detail).slice(0, 300)); }
}
async function call(method, url, token, body) {
  const res = await fetch(API + url, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, body: json };
}

(async () => {
  const stamp = Date.now();
  const adminUser = await prisma.user.findUniqueOrThrow({ where: { email: "seed_qa_admin@example.com" } });
  const superRole = await prisma.adminRole.findUniqueOrThrow({ where: { name: "Super Administrator" } });
  await prisma.adminRoleAssignment.upsert({ where: { roleId_userId: { roleId: superRole.id, userId: adminUser.id } }, create: { roleId: superRole.id, userId: adminUser.id }, update: {} });
  const admin = tokenFor(adminUser);

  const email = `f.buyer.${stamp}@example.test`;
  const phone = `+4477${String(stamp).slice(-8)}`;
  const buyer = await prisma.user.create({ data: { email, phone, name: "F Buyer", password: "x", role: "BUYER", country: "United Kingdom" } });
  const vendorUser = await prisma.user.create({ data: { email: `f.vendor.${stamp}@example.test`, name: "F Vendor", password: "x", role: "VENDOR", country: "United Kingdom" } });
  const vendor = await prisma.vendor.create({ data: { userId: vendorUser.id, storeName: `F Store ${stamp}`, storeSlug: `f-${stamp}`, country: "United Kingdom", currency: "GBP", contactEmail: `shop.${stamp}@example.test`, contactPhone: `+4478${String(stamp).slice(-8)}` } });
  const product = await prisma.product.create({ data: { vendorId: vendor.id, title: "F Rice", priceInCents: 1000, currency: "GBP", stock: 5, isActive: true, status: "PUBLISHED" } });
  const order = await prisma.order.create({ data: { orderNumber: `F${stamp}`, buyerId: buyer.id, vendorId: vendor.id, status: "PAID", totalAmount: 1000, currency: "GBP", items: { create: [{ productId: product.id, vendorId: vendor.id, quantity: 1, unitAmount: 1000, totalAmount: 1000, productTitle: "F Rice", currency: "GBP" }] } } });

  console.log("Masking");
  let r = await call("GET", `/admin/users?search=${encodeURIComponent(email)}`, admin);
  const row = r.body?.items?.find((u) => u.id === buyer.id);
  check(`search by email still finds them [${r.status}]`, Boolean(row), r.body);
  check("list masks the email", row?.email === `f•••@example.test`, row?.email);

  r = await call("GET", `/admin/users/${buyer.id}`, admin);
  check("detail masks email and phone", r.body?.user?.email === "f•••@example.test" && r.body?.user?.phone?.includes("•") && !r.body?.user?.phone?.includes(phone.slice(4, 10)), r.body?.user);
  check("dates and ids survive masking", r.body?.user?.id === buyer.id && typeof r.body?.user?.createdAt === "string");

  r = await call("GET", `/admin/vendors/${vendor.id}`, admin);
  check("vendor contact masked, nested owner too", r.body?.vendor?.contactEmail?.includes("•") && r.body?.vendor?.contactPhone?.includes("•") && r.body?.vendor?.user?.email?.includes("•"), r.body?.vendor?.contactEmail);

  r = await call("GET", `/admin/orders/${order.id}`, admin);
  check("order hides the buyer's email", r.body?.order?.buyer?.email?.includes("•") && !JSON.stringify(r.body).includes(email), r.body?.order?.buyer);

  r = await call("GET", "/admin/admins", admin);
  check(`admin team isn't masked [${r.status}]`, r.status === 200 && JSON.stringify(r.body).includes("seed_qa_admin@example.com"));

  r = await call("PATCH", `/admin/vendors/${vendor.id}`, admin, { contactEmail: "s•••@example.test" });
  const kept = await prisma.vendor.findUnique({ where: { id: vendor.id }, select: { contactEmail: true } });
  check(`a masked value can't overwrite the real one [${r.status}]`, r.status === 400 && kept.contactEmail.startsWith("shop."), r.body);

  console.log("Reveal");
  r = await call("POST", `/admin/users/${buyer.id}/reveal-contact`, admin, {});
  check(`needs a reason [${r.status}]`, r.status === 400);
  const before = await prisma.auditLog.count({ where: { action: "pii.reveal", entityId: buyer.id } });
  r = await call("POST", `/admin/users/${buyer.id}/reveal-contact`, admin, { reason: "Buyer asked support about delivery" });
  check(`returns the real values [${r.status}]`, r.body?.contact?.email === email && r.body?.contact?.phone === phone, r.body);
  const audit = await prisma.auditLog.findFirst({ where: { action: "pii.reveal", entityId: buyer.id }, orderBy: { createdAt: "desc" } });
  check("recorded with who and why", (await prisma.auditLog.count({ where: { action: "pii.reveal", entityId: buyer.id } })) === before + 1 && audit.actorId === adminUser.id && /delivery/.test(audit.reason) && audit.permissionUsed === "users.read", audit);
  check("the audit doesn't store the revealed value", !JSON.stringify(audit).includes(email));
  r = await call("POST", `/admin/vendors/${vendor.id}/reveal-contact`, admin, { reason: "Checking a payout query" });
  check("vendor reveal works", r.body?.contact?.email === `shop.${stamp}@example.test`, r.body);

  const nonAdmin = tokenFor(buyer);
  r = await call("POST", `/admin/users/${buyer.id}/reveal-contact`, nonAdmin, { reason: "Trying to see someone's details" });
  check(`non-admin refused [${r.status}]`, r.status === 403);
  const limitedUser = await prisma.user.create({ data: { email: `f.lim.${stamp}@example.test`, name: "F Limited", password: "x", role: "ADMIN" } });
  r = await call("POST", `/admin/users/${buyer.id}/reveal-contact`, tokenFor(limitedUser), { reason: "Admin with no permissions tries this" });
  check(`admin without the permission refused [${r.status}]`, r.status === 403);

  console.log("Dispute hold");
  const organiserUser = await prisma.user.create({ data: { email: `f.org.${stamp}@example.test`, name: "F Org", password: "x", role: "BUYER", country: "United Kingdom" } });
  const organiser = await prisma.organiserProfile.create({ data: { userId: organiserUser.id, country: "GB" } });
  const supplierUser = await prisma.user.create({ data: { email: `f.sup.${stamp}@example.test`, name: "F Supplier", password: "x", role: "BUYER", country: "United Kingdom" } });
  const account = await prisma.supplierAccount.create({ data: { userId: supplierUser.id, supplierState: "APPROVED", approvedAt: new Date(), businessName: `F Foods ${stamp}`, categories: ["Grains"], coverageRegions: ["GB"], fulfilmentMethods: ["COLLECTION"], termsAcceptedAt: new Date() } });
  const campaign = await prisma.communityCampaign.create({ data: { organiserId: organiser.id, supplierAccountId: account.id, title: `F Rice ${stamp}`, country: "GB", currency: "GBP", targetAmount: 1000, status: "LIVE" } });

  r = await call("POST", `/admin/community-campaigns/${campaign.id}/dispute`, admin, { reason: "Trying while the campaign is live" });
  check(`a live campaign can't be disputed [${r.status}]`, r.status === 409 && r.body?.code === "NOT_DISPUTABLE", r.body);

  await prisma.communityCampaign.update({ where: { id: campaign.id }, data: { status: "FULFILLING" } });
  r = await call("POST", `/admin/community-campaigns/${campaign.id}/dispute`, admin, {});
  check(`needs a reason [${r.status}]`, r.status === 400);
  r = await call("POST", `/admin/community-campaigns/${campaign.id}/dispute`, admin, { reason: "Several bags arrived damaged" });
  check(`disputes during fulfilment [${r.status}]`, r.status === 200 && r.body?.campaign?.disputedAt, r.body);
  r = await call("POST", `/admin/community-campaigns/${campaign.id}/dispute`, admin, { reason: "Trying a second time" });
  check(`can't dispute twice [${r.status}]`, r.status === 409 && r.body?.code === "ALREADY_DISPUTED", r.body);

  const status = await prisma.communityCampaign.findUnique({ where: { id: campaign.id }, select: { status: true } });
  check("fulfilment status is unchanged", status.status === "FULFILLING");
  const organiserNote = await prisma.notification.count({ where: { userId: organiserUser.id, data: { path: ["event"], equals: "disputed" } } });
  check("organiser is told", organiserNote === 1, organiserNote);
  const supplierNote = await prisma.notification.count({ where: { userId: supplierUser.id, data: { path: ["event"], equals: "disputed" } } });
  check("supplier is told", supplierNote === 1, supplierNote);

  const pay = await prisma.campaignSupplierPayment.create({ data: { campaignId: campaign.id, status: "NOT_RELEASED", amount: 1000, currency: "GBP" } }).catch((e) => { console.log("    payment:", e.message.split("\n").slice(-3).join(" ").slice(0, 300)); return null; });
  r = await call("POST", `/admin/community-campaigns/${campaign.id}/supplier-payment/release`, admin, { reason: "Trying to release while disputed" });
  check(`supplier payment refused while disputed [${r.status}]`, r.status === 409 && r.body?.code === "CAMPAIGN_DISPUTE_HOLD", r.body);
  const still = pay && await prisma.campaignSupplierPayment.findUnique({ where: { id: pay.id }, select: { status: true } });
  check("payment didn't move", still?.status === "NOT_RELEASED", still);

  r = await call("POST", `/admin/community-campaigns/${campaign.id}/dispute/resolve`, admin, { reason: "Replacement bags delivered" });
  check(`resolves [${r.status}]`, r.status === 200 && !r.body?.campaign?.disputedAt, r.body);
  r = await call("POST", `/admin/community-campaigns/${campaign.id}/dispute/resolve`, admin, { reason: "Trying a second time" });
  check(`can't resolve twice [${r.status}]`, r.status === 409);

  const issue = await prisma.communityBuySupportCase.create({ data: { campaignId: campaign.id, participantId: buyer.id, caseType: "FULFILMENT_ISSUE", description: "My bag was torn" } });
  r = await call("POST", `/admin/community-campaigns/${campaign.id}/supplier-payment/release`, admin, { reason: "Trying with an open issue" });
  check(`an open participant issue also holds it [${r.status}]`, r.status === 409 && r.body?.code === "CAMPAIGN_DISPUTE_HOLD", r.body);
  await prisma.communityBuySupportCase.update({ where: { id: issue.id }, data: { status: "RESOLVED" } });
  r = await call("POST", `/admin/community-campaigns/${campaign.id}/supplier-payment/release`, admin, { reason: "Issue is resolved now" });
  check(`once closed, the hold lifts and the normal payout check answers [${r.status}]`, r.status === 409 && r.body?.code !== "CAMPAIGN_DISPUTE_HOLD", r.body);
  r = await call("POST", `/admin/community-buy/supplier-accounts/${account.id}/reveal-contact`, admin, { reason: "Asking the supplier about stock" });
  check(`supplier reveal works [${r.status}]`, r.body?.contact?.email === supplierUser.email, r.body);

  const auditCount = await prisma.auditLog.count({ where: { entityId: campaign.id, action: { in: ["community_campaign.disputed", "community_campaign.dispute_resolved"] } } });
  check("both decisions are audited", auditCount === 2, auditCount);

  console.log(`\nRESULT pass=${pass} fail=${fail}`);
  await prisma.$disconnect();
  process.exit(fail ? 1 : 0);
})().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
