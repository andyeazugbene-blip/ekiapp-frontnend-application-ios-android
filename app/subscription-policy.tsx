import React from "react";
import { LegalPage } from "./terms";

export default function SubscriptionPolicyScreen() {
  return (
    <LegalPage
      title="Subscription, Billing & Refund Policy"
      subtitle="This Policy governs subscriptions, billing, fees, payments, and refunds relating to the Eki platform."
      canonicalUrl="https://culinarytales.app/subscription-policy"
      sections={[
        ["1. About Eki", "Eki is a business operating platform designed for African foodstuff and ingredient vendors.\n\nEki provides tools that may include product management, customer management, order management, marketing tools, analytics, business automation, and payment facilitation."],
        ["2. Free Vendor Access", "New vendors may receive a limited free access period.\n\nUnder Eki's current model:\n• Vendors may complete up to three (3) successful orders free of charge.\n• A successful order is an order that has been completed and confirmed through the Eki platform.\n• After the free usage limit has been reached, a subscription may be required to continue using certain vendor features.\n\nEki reserves the right to modify or withdraw free access programmes at any time."],
        ["3. Subscription Plans", "Subscription pricing will be displayed within the Eki platform.\n\nCurrent subscription plans may vary depending on country, vendor type, business category, and promotional offers.\n\nAll subscription fees are shown before purchase."],
        ["4. Subscription Billing", "Subscriptions are billed in advance. Depending on the selected plan, billing may occur monthly, quarterly, or annually.\n\nThe subscription renews automatically unless cancelled before the next billing date."],
        ["5. Automatic Renewal", "By purchasing a subscription, you authorise Eki and its payment providers to charge your chosen payment method automatically at each renewal date.\n\nYou may cancel automatic renewal at any time through your account settings.\n\nCancellation prevents future renewals but does not automatically generate refunds for the current billing period."],
        ["6. Transaction Fees", "In addition to subscription fees, Eki may charge transaction-related fees including payment processing fees, platform service fees, marketplace fees, and international transaction fees.\n\nApplicable fees will be displayed before completion of the transaction."],
        ["7. Payment Providers", "Payments may be processed by third-party payment providers including Stripe and other approved payment processors.\n\nUse of payment services may also be subject to the provider's own terms and conditions.\n\nEki does not store full payment card details."],
        ["8. Failed Payments", "If a payment cannot be processed:\n• Eki may retry the payment.\n• Access to premium features may be restricted.\n• The subscription may be suspended until payment is successfully completed.\n\nEki reserves the right to terminate subscriptions for repeated failed payments."],
        ["9. Refund Policy", "Subscription fees are generally non-refundable once charged.\n\nRefunds will only be provided where required by applicable law, where Eki determines a refund is appropriate at its sole discretion, in cases of duplicate billing, or in cases of verified billing errors.\n\nNo partial refunds are provided for unused subscription periods, partial months, reduced platform usage, or failure to use subscribed features."],
        ["10. Vendor Earnings", "Vendor earnings are separate from subscription payments. Subscription fees do not guarantee sales, customers, revenue, or business growth.\n\nEki provides tools and technology only. Business performance remains the responsibility of the vendor."],
        ["11. Africa-Based Vendor Payment Protection", "For eligible Africa-based vendor transactions, Eki may operate a payment protection process.\n\nUnder this process:\n• Buyer payments may be temporarily held.\n• Funds may be released upon successful delivery confirmation.\n• Funds may be released following OTP verification.\n• Funds may be released automatically after applicable review periods.\n\nThe timing of fund releases may vary. Eki does not guarantee specific payout times."],
        ["12. Pricing Changes", "Eki reserves the right to change subscription pricing, introduce new plans, modify plan features, and discontinue plans.\n\nReasonable notice will be provided before material pricing changes take effect."],
        ["13. Promotional Offers", "From time to time Eki may offer discounts, trial periods, promotional pricing, and referral rewards.\n\nPromotional offers may be limited in duration, be withdrawn at any time, and be subject to additional conditions."],
        ["14. Cancellation", "Vendors may cancel their subscription at any time.\n\nUpon cancellation:\n• Access continues until the end of the current billing period.\n• No further subscription charges will be applied.\n• No refund is provided for the unused portion of the current billing period unless required by law."],
        ["15. Suspension And Termination", "Eki may suspend or terminate subscriptions where payments fail repeatedly, fraud is suspected, platform policies are violated, or vendor verification requirements are not met.\n\nSuspension or termination does not automatically create entitlement to a refund."],
        ["16. Limitation Of Liability", "To the maximum extent permitted by law, Eki shall not be liable for loss of sales, loss of customers, loss of profits, business interruption, missed opportunities, or indirect or consequential losses."],
        ["17. Changes To This Policy", "Eki may update this Policy from time to time. Updated versions become effective when published on the platform.\n\nContinued use of Eki constitutes acceptance of the revised Policy."],
        ["18. Governing Law", "This Policy shall be governed by and interpreted in accordance with the laws of England and Wales. Any disputes shall be subject to the exclusive jurisdiction of the courts of England and Wales.\n\nContact: Ehimare Co, United Kingdom\nEmail: info@culinarytales.app"],
      ]}
    />
  );
}
