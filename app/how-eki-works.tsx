import React from "react";
import { LegalPage } from "./terms";

export default function HowEkiWorksScreen() {
  return (
    <LegalPage
      title="How Eki Works"
      subtitle="A simple guide to buying, selling, secure checkout, messaging, and order tracking."
      canonicalUrl="https://culinarytales.app/support"
      sections={[
        ["For buyers", "Browse verified foodstuff stores, add products to cart, pay securely, track every vendor order, and confirm delivery when goods arrive."],
        ["For vendors", "Create a store, upload products, configure delivery, receive orders, message buyers, dispatch goods, and request payouts after eligible payments are available."],
        ["Multi-vendor checkout", "When a buyer orders from multiple stores, the backend creates one isolated order per vendor so each store sees only its own items, messages, and payout records."],
        ["Seller plans", "Vendor plan upgrades are managed on the website. Each plan can unlock tools, limits, commission rates, and withdrawal fees configured by admin."],
        ["Admin oversight", "Admins manage vendor verification, disputes, uploads, communications, seller plans, payouts, roles, and audit history."],
      ]}
    />
  );
}
