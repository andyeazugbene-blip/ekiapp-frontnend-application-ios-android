// Product ranking against the local verification database only.
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
async function get(url, token) {
  const res = await fetch(API + url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  return { status: res.status, body: await res.json().catch(() => null) };
}
(async () => {
  const stamp = Date.now();
  const cat = `G${stamp}`;
  let n = 0;
  const vendor = async (over = {}, country = "United Kingdom") => {
    n += 1;
    const u = await prisma.user.create({ data: { email: `g${n}.${stamp}@example.test`, password: "x", name: `G ${n}`, role: "VENDOR", country: "United Kingdom" } });
    return prisma.vendor.create({ data: { userId: u.id, storeName: `G Store ${n} ${stamp}`, storeSlug: `g-${n}-${stamp}`, country, currency: "GBP", createdAt: new Date(Date.now() - 365 * 86400000), ...over } });
  };
  const product = (v, title, over = {}) => prisma.product.create({ data: { vendorId: v.id, title, description: "A staple", priceInCents: 1000, currency: "GBP", stock: 20, isActive: true, status: "PUBLISHED", category: cat, ...over } });
  const buyer = await prisma.user.create({ data: { email: `g.buyer.${stamp}@example.test`, password: "x", name: "G Buyer", role: "BUYER", country: "United Kingdom" } });
  const token = tokenFor(buyer);

  const seller = await vendor();
  const best = await product(seller, "Best seller beans");
  await prisma.order.create({ data: { orderNumber: `G${stamp}`, buyerId: buyer.id, vendorId: seller.id, status: "PAID", totalAmount: 50000, currency: "GBP", items: { create: [{ productId: best.id, vendorId: seller.id, quantity: 50, unitAmount: 1000, totalAmount: 50000, productTitle: "x", currency: "GBP" }] } } });
  const plain = await vendor();
  const plainP = await product(plain, "Plain beans");
  const soldOutV = await vendor();
  const soldOut = await product(soldOutV, "Sold out beans", { stock: 0 });
  const delivering = await vendor();
  const deliveringP = await product(delivering, "Delivering beans");
  await prisma.deliveryZone.create({ data: { vendorId: delivering.id, name: "UK", country: "United Kingdom", baseFeeAmount: 300, feePerKgAmount: 0, currency: "GBP", isActive: true } });
  const fresh = await vendor({ createdAt: new Date() });
  const freshP = await product(fresh, "New store beans");

  let r = await get(`/products?category=${cat}&limit=100`, token);
  const ids = r.body?.items?.map((p) => p.id) ?? [];
  console.log("    order:", r.body?.items?.map((p) => p.title).join(" > "));
  check(`everything is listed [${r.status}]`, ids.length === 5, ids.length);
  check("best seller ranks above a plain product", ids.indexOf(best.id) < ids.indexOf(plainP.id));
  check("delivering to the buyer ranks above a plain product", ids.indexOf(deliveringP.id) < ids.indexOf(plainP.id));
  check("a new store ranks above a plain product", ids.indexOf(freshP.id) < ids.indexOf(plainP.id));
  check("sold out ranks last, still listed", ids[ids.length - 1] === soldOut.id);

  const anon = await get(`/products?category=${cat}&limit=100`);
  const anonIds = anon.body?.items?.map((p) => p.id) ?? [];
  check("signed-out buyers get no delivery boost", anonIds.indexOf(deliveringP.id) > anonIds.indexOf(freshP.id), anon.body?.items?.map((p) => p.title));

  r = await get(`/products?category=${cat}&limit=2`, token);
  const page1 = r.body;
  const page2 = (await get(`/products?category=${cat}&limit=2&cursor=${encodeURIComponent(page1.nextCursor)}`, token)).body;
  const page3 = (await get(`/products?category=${cat}&limit=2&cursor=${encodeURIComponent(page2.nextCursor)}`, token)).body;
  const paged = [...page1.items, ...page2.items, ...page3.items].map((p) => p.id);
  check("pages add up to the same order, no repeats", JSON.stringify(paged) === JSON.stringify(ids), paged);
  check("the last page says there is no more", page3.nextCursor === null, page3.nextCursor);

  r = await get(`/products?category=${cat}&search=SOLD&limit=100`, token);
  check("search filters, ignoring case", r.body?.items?.length === 1 && r.body.items[0].id === soldOut.id, r.body?.items?.map((p) => p.title));
  r = await get(`/products?category=${cat}&sort=popular&limit=1`, token);
  check("sort=popular leads with the best seller", r.body?.items?.[0]?.id === best.id);
  r = await get(`/products?category=${cat}&sort=newest&limit=100`, token);
  check("sort=newest is newest first", r.body?.items?.[0]?.id === freshP.id);
  r = await get(`/products?vendorId=${seller.id}&limit=100`, token);
  check("a store's own list still works", r.body?.items?.[0]?.id === best.id);
  check("no cost data in the list", r.body?.items?.every((p) => p.costAmount === undefined), r.body?.items?.[0]);
  r = await get(`/products?category=${cat}&limit=100&cursor=oldstylecursor`, token);
  check("an old-style cursor starts from the top, no error", r.status === 200 && r.body?.items?.length === 5, r.status);

  const testUser = await prisma.user.create({ data: { email: `g.test.${stamp}@example.test`, password: "x", name: "G T", role: "VENDOR", isTest: true } });
  const testVendor = await prisma.vendor.create({ data: { userId: testUser.id, storeName: `G Demo ${stamp}`, storeSlug: `g-demo-${stamp}`, currency: "GBP", isTest: true } });
  const demo = await product(testVendor, "Demo beans");
  r = await get(`/products?category=${cat}&limit=100`, token);
  check("demo products stay out of real lists", !r.body?.items?.some((p) => p.id === demo.id));
  await prisma.product.update({ where: { id: plainP.id }, data: { isActive: false } });
  r = await get(`/products?category=${cat}&limit=100`, token);
  check("inactive products stay out", !r.body?.items?.some((p) => p.id === plainP.id));

  console.log(`\nRESULT pass=${pass} fail=${fail}`);
  await prisma.$disconnect();
  process.exit(fail ? 1 : 0);
})().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
