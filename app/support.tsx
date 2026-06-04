import React from "react";
import { LegalPage } from "./terms";

export default function SupportScreen() {
  return (
    <LegalPage
      title="Support"
      subtitle="Where buyers and vendors can get help with orders, escrow, payouts, verification, and accounts."
      canonicalUrl="https://culinarytales.app/support"
      sections={[
        ["Order help", "Open the order screen, use Track Order, and keep messages inside Eki so support can review the full timeline."],
        ["Escrow disputes", "If goods are missing, damaged, or incorrect, open a dispute before the protection window ends. Funds remain frozen while admin reviews the case."],
        ["Vendor help", "Vendors can contact support for verification, payout methods, subscription limits, product uploads, and delivery settings."],
        ["Contact", "Email adminandy@eki.app with your account email, order number, store name, and screenshots if available."],
      ]}
    />
  );
}
