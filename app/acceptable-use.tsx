import React from "react";
import { LegalPage } from "./terms";

export default function AcceptableUseScreen() {
  return (
    <LegalPage
      title="Acceptable Use Policy"
      subtitle="This Acceptable Use Policy explains the rules and standards that apply when using the Eki platform. Failure to comply may result in suspension, restriction, or termination of your account."
      canonicalUrl="https://culinarytales.app/acceptable-use"
      sections={[
        ["1. Purpose", "Eki is designed to help African foodstuff and ingredient vendors manage products, customers, orders, and business operations.\n\nUsers must use the platform lawfully, honestly, and respectfully."],
        ["2. Prohibited Activities", "You may not use Eki to commit fraud, mislead buyers or vendors, impersonate another person or business, circumvent platform security measures, engage in unlawful activities, or interfere with the operation of the platform."],
        ["3. Fraud And Deceptive Conduct", "Users must not submit false information, use stolen identities, create fake accounts, misrepresent products, manipulate transactions, or attempt to bypass verification requirements.\n\nAny suspected fraud may result in immediate account suspension."],
        ["4. Prohibited Products", "The following products may not be listed, promoted, sold, or distributed through Eki:\n• Illegal products\n• Counterfeit goods\n• Stolen goods\n• Dangerous or hazardous materials\n• Controlled substances\n• Illegal drugs\n• Weapons or weapon components\n• Products prohibited by applicable law\n\nEki reserves the right to remove listings without notice."],
        ["5. Messaging Rules", "Eki currently supports text-based messaging between users.\n\nUsers must not send abusive messages, threats, harassment, hate speech, discriminatory content, fraudulent messages, or misleading information.\n\nUsers must communicate respectfully at all times."],
        ["6. Customer Marketing", "Vendors may use Eki marketing tools to contact previous customers.\n\nVendors must not spam customers, send excessive messages, send misleading promotions, use deceptive advertising, or harass customers.\n\nRepeated misuse may result in permanent removal of marketing privileges."],
        ["7. Circumvention Of The Platform", "Users may not attempt to manipulate platform fees, interfere with payment processes, exploit platform vulnerabilities, or use automated systems to abuse platform functionality.\n\nEki may investigate suspicious behaviour and take appropriate action."],
        ["8. Account Security", "Users are responsible for maintaining account security, protecting passwords, and preventing unauthorised access.\n\nUsers must notify Eki immediately if they suspect unauthorised use of their account."],
        ["9. Intellectual Property", "Users may not copy Eki software, reverse engineer the platform, reproduce Eki branding without permission, or use Eki intellectual property in a misleading manner."],
        ["10. Data Misuse", "Users must not harvest customer data, scrape platform information, collect user information without permission, or use platform data for unlawful purposes."],
        ["11. False Reviews And Manipulation", "Users must not post fake reviews, manipulate ratings, create artificial engagement, or encourage fraudulent reviews."],
        ["12. Enforcement", "Eki may take action including content removal, listing removal, feature restrictions, temporary suspension, or permanent account termination.\n\nAction may be taken with or without prior notice where necessary to protect users or the platform."],
        ["13. Reporting Violations", "Users may report suspected violations through Eki support channels.\n\nEki reserves the right to investigate any report and take appropriate action."],
        ["14. Changes To This Policy", "Eki may update this Policy from time to time. Updated versions become effective upon publication within the platform.\n\nContinued use of Eki constitutes acceptance of the updated Policy.\n\nContact: Ehimare Co, United Kingdom\nEmail: info@culinarytales.app"],
      ]}
    />
  );
}
