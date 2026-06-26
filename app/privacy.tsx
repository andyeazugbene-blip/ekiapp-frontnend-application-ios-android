import React from "react";
import { LegalPage } from "./terms";

export default function PrivacyScreen() {
  return (
    <LegalPage
      title="Privacy Policy"
      subtitle="Ehimare Co respects your privacy and is committed to protecting your personal information. This Privacy Policy explains how we collect, use, store, and protect your information when you use the Eki platform."
      canonicalUrl="https://culinarytales.app/privacy"
      sections={[
        ["1. Who We Are", "Eki is a technology platform that helps African foodstuff and ingredient vendors manage products, customers, orders, payments, and business operations.\n\nThis Privacy Policy applies to all users of the Eki platform, including buyers and vendors.\n\nEhimare Co, 5 Marriott Street, Coundon, Coventry, CV6 1BB, United Kingdom."],
        ["2. Information We Collect", "Account Information: full name, email address, phone number, country of residence, account credentials.\n\nVendor Information: business name, business address, product information, bank or payout information, identity verification information, verification status.\n\nOrder Information: products purchased, order history, delivery information, transaction records.\n\nCommunications: messages sent through the Eki platform, customer support enquiries, feedback and reviews.\n\nDevice Information: device type, operating system, IP address, browser information, app usage data."],
        ["3. Identity Verification", "Where verification is required, Eki may collect and process government-issued identification, selfie or facial verification data, and verification results from third-party verification providers.\n\nVerification data may be processed by trusted third-party identity verification providers."],
        ["4. How We Use Your Information", "We use information to:\n• Create and manage accounts\n• Verify user identities\n• Process orders and transactions\n• Provide customer support\n• Improve platform functionality\n• Detect fraud and suspicious activity\n• Send service notifications\n• Manage subscriptions\n• Enforce our Terms and Conditions\n• Comply with legal obligations"],
        ["5. Vendor Marketing Features", "Eki provides vendors with tools that may allow them to contact customers who have previously interacted with their business, including promotional offers, product announcements, and customer re-engagement campaigns.\n\nVendors are responsible for using these features lawfully and responsibly."],
        ["6. Legal Basis For Processing", "Where UK GDPR applies, Eki processes personal information on one or more of the following bases:\n• Performance of a contract\n• Compliance with legal obligations\n• Legitimate business interests\n• User consent where required"],
        ["7. Sharing Information", "We do not sell personal information.\n\nWe may share information with:\n• Service Providers (cloud hosting, analytics, customer support)\n• Payment Providers (to facilitate payments and subscriptions)\n• Identity Verification Providers (to verify user identities)\n• Legal Authorities (where required by law or to protect our rights, users, or platform)"],
        ["8. Data Retention", "We retain information only as long as reasonably necessary to operate the platform, fulfil contractual obligations, resolve disputes, and meet legal and regulatory requirements.\n\nWhen information is no longer required, it will be securely deleted or anonymised."],
        ["9. Security", "We use reasonable technical and organisational measures to protect information against unauthorised access, loss, misuse, alteration, and disclosure.\n\nHowever, no online service can guarantee absolute security."],
        ["10. International Transfers", "Your information may be processed in countries outside the United Kingdom. Where international transfers occur, Eki will take reasonable steps to ensure appropriate safeguards are in place."],
        ["11. Your Rights", "Depending on applicable law, you may have the right to:\n• Access your information\n• Correct inaccurate information\n• Request deletion of information\n• Restrict processing\n• Object to processing\n• Withdraw consent where applicable\n• Request data portability"],
        ["12. Cookies And Analytics", "Eki may use cookies and similar technologies to improve user experience, understand platform usage, measure performance, and enhance security.\n\nUsers may control cookies through browser settings where applicable."],
        ["13. Children's Privacy", "Eki is intended for users aged 18 years and older. We do not knowingly collect information from individuals under the age of 18."],
        ["14. Changes To This Policy", "We may update this Privacy Policy from time to time. Updated versions will be published within the platform and will become effective when posted."],
        ["15. UK GDPR Rights", "If you are located in the United Kingdom, you may also have the right to lodge a complaint with the Information Commissioner's Office (ICO): https://www.ico.org.uk\n\nWe encourage users to contact us first so we can attempt to resolve concerns directly."],
        ["16. Contact Us", "Ehimare Co, United Kingdom\nEmail: info@culinarytales.app"],
      ]}
    />
  );
}
