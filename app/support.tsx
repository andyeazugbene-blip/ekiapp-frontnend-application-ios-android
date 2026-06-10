import React from "react";
import { LegalPage } from "./terms";

export default function SupportScreen() {
  return (
    <LegalPage
      title="Support"
      subtitle="Where buyers and vendors can get help with orders, payments, payouts, verification, and accounts."
      canonicalUrl="https://culinarytales.app/support"
      sections={[
        ["Order help", "Open the order screen, use Track Order, and keep messages inside Eki so support can review the full timeline."],
        ["Order disputes", "If goods are missing, damaged, or incorrect, open a dispute from the order screen. Admins review the order timeline, messages, and payment status before deciding next steps."],
        ["Vendor help", "Vendors can contact support for verification, payout methods, subscription limits, product uploads, and delivery settings."],
        ["Contact", "Email adminandy@eki.app with your account email, order number, store name, and screenshots if available."],
      ]}
    />
  );
}
