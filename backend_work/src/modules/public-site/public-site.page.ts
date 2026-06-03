import type { Request, Response } from "express";

function escape(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

type PageSection = {
  title: string;
  body?: string[];
  bullets?: string[];
};

type PageAction = {
  href: string;
  label: string;
  variant?: "primary" | "secondary";
};

type PageDefinition = {
  title: string;
  description: string;
  eyebrow: string;
  heading: string;
  intro: string;
  actions?: PageAction[];
  sections: PageSection[];
  variant?: "home";
};

function renderSection(section: PageSection): string {
  const body = (section.body ?? [])
    .map((paragraph) => `<p>${escape(paragraph)}</p>`)
    .join("");
  const bullets = section.bullets?.length
    ? `<ul>${section.bullets.map((item) => `<li>${escape(item)}</li>`).join("")}</ul>`
    : "";

  return `
    <section class="card">
      <h2>${escape(section.title)}</h2>
      ${body}
      ${bullets}
    </section>
  `;
}

function renderLayout(page: PageDefinition): string {
  if (page.variant === "home") {
    return renderHomeLayout(page);
  }

  const actions = (page.actions ?? [])
    .map(
      (action) => `
        <a class="button ${action.variant === "secondary" ? "button-secondary" : "button-primary"}" href="${escape(action.href)}">
          ${escape(action.label)}
        </a>
      `,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="theme-color" content="#1F4D40" />
  <title>${escape(page.title)}</title>
  <meta name="description" content="${escape(page.description)}" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&display=swap" />
  <style>
    *,*::before,*::after{box-sizing:border-box}
    :root{
      --bg:#FAF7F2;
      --surface:#FFFFFF;
      --surface-soft:#F4EFE6;
      --border:#E8E0D2;
      --text:#1F1B16;
      --muted:#6B6256;
      --accent:#1F4D40;
      --accent-hover:#163A30;
    }
    html,body{margin:0;padding:0}
    body{
      background:var(--bg);
      color:var(--text);
      font-family:'Inter',-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
      line-height:1.6;
      -webkit-font-smoothing:antialiased;
      -moz-osx-font-smoothing:grayscale;
    }
    a{color:inherit}
    .shell{max-width:1040px;margin:0 auto;padding:0 20px}
    .topbar{
      background:#FFFFFFCC;
      backdrop-filter:saturate(180%) blur(12px);
      border-bottom:1px solid var(--border);
      position:sticky;
      top:0;
      z-index:10;
    }
    .topbar-inner{
      min-height:60px;
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:16px;
    }
    .brand{
      display:inline-flex;
      align-items:center;
      gap:8px;
      text-decoration:none;
      color:var(--text);
      font-family:'Fraunces',Georgia,serif;
      font-weight:700;
      font-size:22px;
      letter-spacing:-0.02em;
    }
    .brand-dot{
      width:10px;
      height:10px;
      border-radius:999px;
      background:var(--accent);
      display:inline-block;
    }
    .nav{
      display:flex;
      flex-wrap:wrap;
      gap:14px;
    }
    .nav a{
      text-decoration:none;
      color:var(--muted);
      font-size:14px;
      font-weight:600;
    }
    .nav a:hover{color:var(--accent)}
    .hero{
      padding:56px 0 28px;
    }
    .eyebrow{
      display:inline-block;
      background:#E8F1ED;
      color:var(--accent);
      padding:6px 12px;
      border-radius:999px;
      font-size:12px;
      font-weight:700;
      letter-spacing:0.04em;
      text-transform:uppercase;
    }
    h1{
      font-family:'Fraunces',Georgia,serif;
      font-size:48px;
      line-height:1.08;
      letter-spacing:-0.03em;
      margin:16px 0 16px;
      max-width:12ch;
    }
    .intro{
      max-width:64ch;
      color:var(--muted);
      font-size:17px;
      margin:0;
    }
    .actions{
      display:flex;
      flex-wrap:wrap;
      gap:12px;
      margin-top:24px;
    }
    .button{
      display:inline-flex;
      align-items:center;
      justify-content:center;
      min-height:46px;
      padding:0 18px;
      border-radius:14px;
      text-decoration:none;
      font-size:14px;
      font-weight:700;
      border:1px solid transparent;
    }
    .button-primary{
      background:var(--accent);
      color:#FFFFFF;
    }
    .button-primary:hover{
      background:var(--accent-hover);
    }
    .button-secondary{
      background:#FFFFFF;
      color:var(--text);
      border-color:var(--border);
    }
    .grid{
      display:grid;
      grid-template-columns:repeat(12,minmax(0,1fr));
      gap:18px;
      padding:18px 0 72px;
    }
    .card{
      grid-column:span 6;
      background:var(--surface);
      border:1px solid var(--border);
      border-radius:20px;
      padding:22px;
      box-shadow:0 10px 30px rgba(31,27,22,0.05);
    }
    .card h2{
      margin:0 0 12px;
      font-family:'Fraunces',Georgia,serif;
      font-size:26px;
      line-height:1.15;
      letter-spacing:-0.02em;
    }
    .card p{
      margin:0 0 12px;
      color:var(--muted);
      font-size:15px;
    }
    .card ul{
      margin:10px 0 0 18px;
      padding:0;
      color:var(--muted);
      font-size:15px;
    }
    .card li + li{
      margin-top:8px;
    }
    .foot{
      border-top:1px solid var(--border);
      background:#FFFFFF;
      padding:22px 0 36px;
      color:var(--muted);
      font-size:13px;
    }
    .foot a{
      color:var(--text);
      text-decoration:none;
      font-weight:700;
    }
    @media (max-width: 780px){
      .hero{padding-top:34px}
      h1{font-size:36px;max-width:none}
      .intro{font-size:15px}
      .card{grid-column:span 12;padding:18px}
      .topbar-inner{padding:6px 0}
      .nav{gap:12px}
    }
  </style>
</head>
<body>
  <header class="topbar">
    <div class="shell topbar-inner">
      <a class="brand" href="/">
        <span class="brand-dot"></span>
        Eki
      </a>
      <nav class="nav" aria-label="Public pages">
        <a href="/help">Help</a>
        <a href="/privacy">Privacy</a>
        <a href="/terms">Terms</a>
      </nav>
    </div>
  </header>

  <main class="shell">
    <section class="hero">
      <span class="eyebrow">${escape(page.eyebrow)}</span>
      <h1>${escape(page.heading)}</h1>
      <p class="intro">${escape(page.intro)}</p>
      ${actions ? `<div class="actions">${actions}</div>` : ""}
    </section>

    <section class="grid">
      ${page.sections.map(renderSection).join("")}
    </section>
  </main>

  <footer class="foot">
    <div class="shell">
      Eki public storefront and support pages. For order-specific help, email <a href="mailto:adminandy@eki.app">adminandy@eki.app</a>.
    </div>
  </footer>
</body>
</html>`;
}

function renderHomeLayout(page: PageDefinition): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="theme-color" content="#164F3F" />
  <title>${escape(page.title)}</title>
  <meta name="description" content="${escape(page.description)}" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" />
  <style>
    *,*::before,*::after{box-sizing:border-box}
    html,body{margin:0;padding:0}
    body{
      background:#F6F8F7;
      color:#111827;
      font-family:'Inter',-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
      -webkit-font-smoothing:antialiased;
      -moz-osx-font-smoothing:grayscale;
    }
    a{color:inherit}
    .hero-wrap{
      background:#164F3F;
      color:#FFFFFF;
      overflow:hidden;
    }
    .shell{width:min(1120px,calc(100% - 40px));margin:0 auto}
    .topbar{
      height:54px;
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:24px;
    }
    .brand{
      display:inline-flex;
      align-items:center;
      justify-content:center;
      min-width:58px;
      height:28px;
      border-radius:6px;
      background:#2E8658;
      color:#FFFFFF;
      text-decoration:none;
      font-weight:800;
      letter-spacing:-0.03em;
      line-height:1;
    }
    .nav{display:flex;align-items:center;gap:28px}
    .nav a{
      color:rgba(255,255,255,0.86);
      font-size:13px;
      font-weight:600;
      text-decoration:none;
    }
    .nav a:hover{color:#FFFFFF}
    .hero{
      min-height:360px;
      display:grid;
      grid-template-columns:minmax(0,1fr) minmax(280px,430px);
      align-items:center;
      gap:48px;
      padding:42px 0 52px;
    }
    .copy{max-width:560px}
    h1{
      margin:0;
      font-size:43px;
      line-height:1.06;
      letter-spacing:-0.045em;
      font-weight:800;
    }
    .intro{
      margin:16px 0 0;
      max-width:520px;
      color:rgba(255,255,255,0.82);
      font-size:16px;
      line-height:1.45;
    }
    .store-buttons{
      display:flex;
      flex-wrap:wrap;
      gap:14px;
      margin-top:34px;
    }
    .store-button{
      min-width:150px;
      height:46px;
      border-radius:8px;
      background:#FFFFFF;
      color:#164F3F;
      text-decoration:none;
      display:flex;
      flex-direction:column;
      justify-content:center;
      padding:0 16px;
      box-shadow:0 14px 30px rgba(0,0,0,0.08);
    }
    .store-button.google{
      background:#2E8658;
      color:#FFFFFF;
    }
    .store-small{font-size:9px;font-weight:600;opacity:.74}
    .store-main{font-size:14px;font-weight:800;margin-top:1px}
    .helper{
      color:rgba(255,255,255,0.72);
      font-size:12px;
      margin:15px 0 0;
    }
    .phone-stage{
      position:relative;
      min-height:320px;
      display:flex;
      align-items:center;
      justify-content:center;
    }
    .phone-stage::before{
      content:"";
      position:absolute;
      inset:auto 5% 7% 18%;
      height:210px;
      border-radius:34px;
      background:#2E8658;
      opacity:.78;
    }
    .phone-stage::after{
      content:"";
      position:absolute;
      width:110px;
      height:110px;
      border-radius:999px;
      border:1px solid rgba(255,255,255,.2);
      right:10px;
      top:18px;
    }
    .phone{
      position:relative;
      z-index:2;
      width:min(84vw,360px);
      max-height:380px;
      object-fit:contain;
      object-position:center;
      filter:drop-shadow(0 28px 36px rgba(0,0,0,.34));
    }
    .features-band{background:#FFFFFF;padding:36px 0 48px}
    .features-title{
      margin:0 0 24px;
      text-align:center;
      font-size:22px;
      line-height:1.2;
      letter-spacing:-0.03em;
      font-weight:800;
    }
    .feature-grid{
      display:grid;
      grid-template-columns:repeat(4,minmax(0,1fr));
      gap:28px;
    }
    .feature-card{
      min-height:124px;
      border-radius:10px;
      background:#ECF7F0;
      padding:24px 22px;
    }
    .feature-icon{
      width:34px;
      height:34px;
      border-radius:999px;
      background:#D7F0DF;
      display:grid;
      place-items:center;
      margin-bottom:18px;
      color:#164F3F;
      font-size:17px;
    }
    .feature-card h2{
      margin:0 0 6px;
      font-size:14px;
      font-weight:800;
      letter-spacing:-0.02em;
    }
    .feature-card p{
      margin:0;
      color:#637069;
      font-size:12px;
      line-height:1.35;
    }
    .order-band{background:#ECF7F0;padding:18px 0}
    .order-row{
      display:flex;
      justify-content:center;
      align-items:center;
      gap:28px;
      color:#6B7280;
      font-size:13px;
    }
    .find-link{
      min-width:180px;
      height:34px;
      border-radius:6px;
      border:1px solid #164F3F;
      color:#164F3F;
      display:inline-flex;
      align-items:center;
      justify-content:center;
      text-decoration:none;
      font-weight:700;
      background:#F8FFFB;
    }
    @media (max-width:860px){
      .shell{width:min(100% - 28px,1120px)}
      .hero{grid-template-columns:1fr;gap:28px;padding-top:30px}
      h1{font-size:36px}
      .phone-stage{min-height:300px}
      .phone{max-height:340px}
      .feature-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
      .order-row{flex-direction:column;gap:12px}
    }
    @media (max-width:520px){
      .topbar{height:50px}
      .nav{gap:18px}
      h1{font-size:32px}
      .intro{font-size:14px}
      .store-buttons{gap:10px}
      .store-button{flex:1;min-width:135px}
      .feature-grid{grid-template-columns:1fr}
    }
  </style>
</head>
<body>
  <div class="hero-wrap">
    <header class="shell topbar">
      <a class="brand" href="/">eki</a>
      <nav class="nav" aria-label="Main navigation">
        <a href="/store/seed-qa-store-001-001">Vendors</a>
      </nav>
    </header>
    <main class="shell hero">
      <section class="copy">
        <h1>${escape(page.heading)}</h1>
        <p class="intro">${escape(page.intro)}</p>
        <div class="store-buttons">
          <a class="store-button" href="https://culinarytales.app" aria-label="Download Eki on the App Store">
            <span class="store-small">Download on the</span>
            <span class="store-main">App Store</span>
          </a>
          <a class="store-button google" href="https://culinarytales.app" aria-label="Get Eki on Google Play">
            <span class="store-small">Get it on</span>
            <span class="store-main">Google Play</span>
          </a>
        </div>
        <p class="helper">Or scan the QR code in the app to get started instantly</p>
      </section>
      <section class="phone-stage" aria-label="Eki app preview">
        <img class="phone" src="/assets/public-site/hero-phone-mockup.jpg" alt="Eki vendor dashboard phone mockup" />
      </section>
    </main>
  </div>

  <section class="features-band">
    <div class="shell">
      <h2 class="features-title">Why thousands love Eki</h2>
      <div class="feature-grid">
        <article class="feature-card">
          <div class="feature-icon">OK</div>
          <h2>Shop from verified vendors</h2>
          <p>Every vendor is reviewed and verified before listing on Eki.</p>
        </article>
        <article class="feature-card">
          <div class="feature-icon">TRK</div>
          <h2>Live order tracking</h2>
          <p>Track your foodstuff order from vendor confirmation to dispatch and delivery.</p>
        </article>
        <article class="feature-card">
          <div class="feature-icon">SEC</div>
          <h2>Secure Eki checkout</h2>
          <p>Your order and payment record are handled securely through Eki.</p>
        </article>
        <article class="feature-card">
          <div class="feature-icon">RE</div>
          <h2>One-tap reorder</h2>
          <p>Saved your favorite vendors? Reorder last basket in a single tap.</p>
        </article>
      </div>
    </div>
  </section>

  <section class="order-band">
    <div class="shell order-row">
      <span>Already have an order?</span>
      <a class="find-link" href="/store/seed-qa-store-001-001">Find your order -></a>
    </div>
  </section>
</body>
</html>`;
}

const homePage: PageDefinition = {
  title: "Eki",
  description: "Eki helps buyers keep favorite African foodstuff vendors close, track orders, and reorder quickly.",
  eyebrow: "Eki",
  heading: "Never lose your vendors again.",
  intro:
    "The Eki app puts your favourite African foodstuff vendors right in your pocket. Track orders live, confirm deliveries with a tap, and reorder in seconds.",
  actions: [
    { href: "/store/mama-chi-foodstuff", label: "Open live store example" },
    { href: "/help", label: "Help and support", variant: "secondary" },
  ],
  variant: "home",
  sections: [
    {
      title: "What Eki handles",
      bullets: [
        "Vendor storefront pages shared by direct link",
        "Secure checkout through connected payment providers",
        "Order tracking, guest order lookup, and buyer notifications",
        "Escrow-style order states, disputes, and refund handling",
      ],
    },
    {
      title: "For buyers",
      body: [
        "You can browse vendor products, add items to cart, pay securely, and track eligible orders after checkout.",
        "If you checked out as a guest, the order lookup flow uses your checkout email address and a one-time code.",
      ],
    },
    {
      title: "For vendors",
      body: [
        "Vendors manage products, storefront links, orders, payouts, messaging, and analytics from the app.",
        "Shared store links point to public storefront pages that can be opened without installing the app first.",
      ],
    },
    {
      title: "Support links",
      bullets: [
        "Help: /help",
        "Privacy: /privacy",
        "Terms: /terms",
        "Email: adminandy@eki.app",
      ],
    },
  ],
};

const helpPage: PageDefinition = {
  title: "Help and support | Eki",
  description: "Public support and order-help information for Eki buyers and vendors.",
  eyebrow: "Support",
  heading: "Get help with orders, payouts, OTP, and disputes.",
  intro:
    "For support, contact adminandy@eki.app. The support team aims to respond within 24 hours, and order-specific issues may require the order number or checkout email used during purchase.",
  actions: [
    { href: "mailto:adminandy@eki.app", label: "Email support" },
    { href: "/terms", label: "Read terms", variant: "secondary" },
  ],
  sections: [
    {
      title: "Response times",
      bullets: [
        "First support response target: within 24 hours",
        "Refund requests are reviewed within 24 hours",
        "Approved refunds are processed within 3 business days",
        "Complex disputes may require admin review before resolution",
      ],
    },
    {
      title: "Order help",
      bullets: [
        "If payment succeeded but your order is still pending, the system may still be waiting on webhook confirmation.",
        "Guest buyers can use the public order lookup flow with their checkout email and one-time code.",
        "If an escrow order was shipped and something is wrong, open a dispute before funds are released.",
      ],
    },
    {
      title: "OTP and account access",
      bullets: [
        "If you do not receive an OTP email, check your spam folder first.",
        "Repeated failed login attempts may temporarily lock the account for security.",
        "For buyer account recovery, contact support from the email used to place the order or register the account.",
      ],
    },
    {
      title: "Vendor support",
      bullets: [
        "Vendors can manage products, public store links, payouts, notifications, and buyer messages in the app.",
        "Payout availability depends on order status, escrow rules, and any active dispute or refund review.",
      ],
    },
  ],
};

const privacyPage: PageDefinition = {
  title: "Privacy policy | Eki",
  description: "How Eki handles account, order, payment, support, and operational data.",
  eyebrow: "Privacy",
  heading: "How Eki handles your data.",
  intro:
    "This page summarizes the operational privacy posture of Eki based on the current product and backend implementation. It explains what data we process, why we process it, and the user controls currently available in the product.",
  actions: [
    { href: "mailto:adminandy@eki.app", label: "Privacy questions" },
    { href: "/help", label: "Support", variant: "secondary" },
  ],
  sections: [
    {
      title: "Data we process",
      bullets: [
        "Account details such as name, email address, phone number, role, and authentication state",
        "Order and delivery details such as products ordered, totals, delivery address, and order status",
        "Payment-related metadata needed to verify and reconcile transactions through Stripe or Paystack",
        "Vendor storefront content such as product listings, descriptions, pricing, and uploaded images",
        "Operational records such as notifications, audit logs, and support messages",
      ],
    },
    {
      title: "Why we process it",
      bullets: [
        "To authenticate users and secure access to buyer, vendor, and admin functions",
        "To process orders, order tracking, escrow states, disputes, refunds, and payouts",
        "To detect abuse, enforce security controls, and investigate platform incidents",
        "To deliver transactional emails, OTP codes, notifications, and operational support",
      ],
    },
    {
      title: "Infrastructure and subprocessors",
      bullets: [
        "Vercel for hosting and server execution",
        "Neon for PostgreSQL database storage",
        "Stripe for international payments",
        "Paystack for supported domestic payments and payout rails",
        "Cloudflare R2 for file storage",
        "Sentry for error monitoring",
        "Resend for transactional email delivery",
      ],
    },
    {
      title: "Your controls",
      bullets: [
        "Authenticated users can export account data through the data-export endpoint",
        "Authenticated users can request account deletion, with financial records retained where legally required",
        "Order and payment records may be retained for compliance, fraud prevention, and accounting obligations",
        "For privacy requests or correction requests, contact adminandy@eki.app",
      ],
    },
  ],
};

const termsPage: PageDefinition = {
  title: "Terms of service | Eki",
  description: "Platform rules for buyers, vendors, payments, disputes, and support on Eki.",
  eyebrow: "Terms",
  heading: "Platform rules for buyers and vendors.",
  intro:
    "These terms summarize how Eki operates as a marketplace platform for vendor storefronts, secure checkout, order tracking, escrow-sensitive flows, and support. By using the platform, buyers and vendors agree to follow these platform rules.",
  actions: [
    { href: "/privacy", label: "Read privacy policy", variant: "secondary" },
    { href: "mailto:adminandy@eki.app", label: "Contact support" },
  ],
  sections: [
    {
      title: "Marketplace role",
      bullets: [
        "Eki provides the software platform, storefront links, checkout flows, messaging, notifications, and support tooling used by buyers and vendors.",
        "Product availability, pricing, fulfillment timing, and listing accuracy remain the vendor's responsibility.",
      ],
    },
    {
      title: "Buyer rules",
      bullets: [
        "Buyers must provide accurate delivery and contact details at checkout.",
        "A guest order lookup requires access to the checkout email address used when the order was placed.",
        "If an OTP-confirmed escrow delivery is completed, the transaction may become final under the platform's escrow rules.",
      ],
    },
    {
      title: "Vendor rules",
      bullets: [
        "Vendors must publish accurate product information, pricing, and stock availability.",
        "Vendors must ship and manage orders through the platform in line with delivery, escrow, and dispute states.",
        "Eki may suspend storefronts or accounts for fraud, prohibited listings, abuse, or repeated operational failures.",
      ],
    },
    {
      title: "Payments, refunds, and disputes",
      bullets: [
        "Payments are processed by connected payment providers such as Stripe and Paystack.",
        "Refund requests are reviewed within 24 hours, and approved refunds are processed within 3 business days.",
        "Disputes may freeze order funds until review is complete.",
        "Partial refunds may require additional admin approval.",
      ],
    },
    {
      title: "Support and policy changes",
      bullets: [
        "Support is available at adminandy@eki.app.",
        "Operational policies may change as the platform matures, including payout, support, and fraud-prevention controls.",
        "If you do not agree with a platform change, stop using the service and contact support for account assistance.",
      ],
    },
  ],
};

function sendPage(response: Response, page: PageDefinition): void {
  response.setHeader("Content-Type", "text/html; charset=utf-8");
  response.setHeader("Cache-Control", "public, max-age=300, s-maxage=900");
  response.status(200).send(renderLayout(page));
}

export async function getPublicHomePage(_request: Request, response: Response): Promise<void> {
  sendPage(response, homePage);
}

export async function getPublicHelpPage(_request: Request, response: Response): Promise<void> {
  sendPage(response, helpPage);
}

export async function getPublicPrivacyPage(_request: Request, response: Response): Promise<void> {
  sendPage(response, privacyPage);
}

export async function getPublicTermsPage(_request: Request, response: Response): Promise<void> {
  sendPage(response, termsPage);
}
