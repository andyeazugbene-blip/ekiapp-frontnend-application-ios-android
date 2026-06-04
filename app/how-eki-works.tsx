import React from "react";
import { LegalPage } from "./terms";

export default function HowEkiWorksScreen() {
  return (
    <LegalPage
      title="How Eki Works"
      subtitle="A simple guide to buying, selling, protected checkout, messaging, and order tracking."
      canonicalUrl="https://culinarytales.app/support"
      sections={[
        ["For buyers", "Browse verified foodstuff stores, add products to cart, pay securely, track every vendor order, and confirm delivery when goods arrive."],
        ["For vendors", "Create a store, upload products, configure delivery, receive orders, message buyers, dispatch goods, and request payouts after protected funds are released."],
        ["Multi-vendor checkout", "When a buyer orders from multiple stores, the backend creates one isolated order per vendor so each store sees only its own items, messages, and payout records."],
        ["Escrow", "Supported African corridors can use OTP delivery confirmation. Unsupported countries show a clear unavailable reason instead of unsafe checkout."],
        ["Admin oversight", "Admins manage vendor verification, disputes, uploads, communications, subscriptions, payouts, roles, and audit history."],
      ]}
    />
  );
}
