import React from "react";
import { LegalPage } from "./terms";

export default function PrivacyScreen() {
  return (
    <LegalPage
      title="Privacy Policy"
      subtitle="How Eki collects, protects, and uses data for marketplace accounts, orders, uploads, and support."
      canonicalUrl="https://culinarytales.app/privacy"
      sections={[
        ["Account data", "We collect account details such as name, email, phone number, role, store profile, and login activity to provide marketplace access and prevent abuse."],
        ["Order and payment data", "We store order records, delivery details, checkout references, payment status, payout records, and dispute history. Card data is handled by payment providers and is not stored by Eki."],
        ["Uploads", "Public uploads include product, avatar, cover, and message images. Verification documents are private and reviewed only by authorized admin users using short-lived access URLs."],
        ["Messages and notifications", "Messages are stored so buyers, vendors, and admins can resolve orders and disputes. Push, email, and transactional SMS may be used for order, payment, security, and support updates."],
        ["Deletion", "Users can request account deletion from the app or at the account deletion URL. Some records may be retained where needed for legal, tax, fraud-prevention, payment, or dispute obligations."],
      ]}
    />
  );
}
