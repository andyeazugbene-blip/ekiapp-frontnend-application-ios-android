// A local vendor to sign in as in the web build. Local verification database only.
const path = require("path");
const BACKEND = process.env.EKI_BACKEND_DIR || path.resolve(__dirname, "../../../../ekiapp-backend-main");
const req = (m) => require(path.join(BACKEND, "node_modules", m));
req("dotenv").config({ path: path.join(BACKEND, ".env") });
if (!/localhost:5544\/eki_verify/.test(process.env.DATABASE_URL || "")) throw new Error("Refusing to run: not the verification DB");
const { PrismaClient } = req("@prisma/client");
const prisma = new PrismaClient();
(async () => {
  const email = "uivendor@example.test";
  let u = await prisma.user.findUnique({ where: { email } });
  if (!u) {
    const res = await fetch("http://localhost:4177/api/auth/register", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password: "LocalVerify123!", name: "UI Vendor", role: "VENDOR", country: "United Kingdom" }) });
    console.log("register", res.status);
    u = await prisma.user.findUnique({ where: { email } });
  }
  await prisma.user.update({ where: { id: u.id }, data: { emailVerifiedAt: new Date(), role: "VENDOR" } });
  const v = await prisma.vendor.findUnique({ where: { userId: u.id } }) || await prisma.vendor.create({ data: { userId: u.id, storeName: "UI Store", storeSlug: "ui-store", country: "United Kingdom" } });
  const count = await prisma.product.count({ where: { vendorId: v.id } });
  if (!count) await prisma.product.create({ data: { vendorId: v.id, title: "UI Yam", priceInCents: 1000, currency: "GBP", stock: 10, status: "PUBLISHED", isActive: true, images: ["https://example.test/y.jpg"] } });
  console.log("ready", v.id.slice(0, 6));
})().catch((e) => { console.error(String(e.message).slice(-400)); process.exit(1); }).finally(() => prisma.$disconnect());
