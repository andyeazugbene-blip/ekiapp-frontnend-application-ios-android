import React from "react";
import { LegalPage } from "./terms";

export default function CookiePolicyScreen() {
  return (
    <LegalPage
      title="Cookie Policy"
      subtitle="This Cookie Policy explains how Ehimare Co uses cookies and similar technologies when you access or use the Eki website, mobile application, and related services."
      canonicalUrl="https://culinarytales.app/cookie-policy"
      sections={[
        ["1. About Us", "Ehimare Co, 5 Marriott Street, Coundon, Coventry, CV6 1BB, United Kingdom.\n\nEmail: info@culinarytales.app"],
        ["2. What Are Cookies?", "Cookies are small text files stored on your device when you visit a website or use an application.\n\nCookies help websites and applications function properly, remember user preferences, improve security, understand how users interact with services, and deliver a better user experience.\n\nCookies do not usually identify you directly, but they may be linked to information associated with your account."],
        ["3. How Eki Uses Cookies", "Eki uses cookies and similar technologies to:\n• Keep users signed in\n• Remember user preferences\n• Improve platform performance\n• Measure usage and engagement\n• Detect suspicious or fraudulent activity\n• Improve security\n• Support customer experience"],
        ["4. Types Of Cookies We Use", "Essential Cookies: necessary for the operation of Eki, used to authenticate users, maintain secure sessions, protect against fraud, and enable platform functionality.\n\nPerformance And Analytics Cookies: help us understand how users interact with Eki, collecting information such as pages visited, features used, time spent on pages, user journeys, and error reports.\n\nFunctionality Cookies: allow Eki to remember language preferences, device preferences, user settings, and personalisation options.\n\nSecurity Cookies: help protect users and the platform by detecting suspicious activity, preventing unauthorised access, and supporting fraud prevention measures."],
        ["5. Third-Party Cookies", "Eki may use trusted third-party services that place cookies or similar technologies on your device.\n\nThese providers may include services relating to analytics, authentication, payment processing, security, and customer support.\n\nExamples may include Google Analytics, Firebase Analytics, Stripe, and other approved service providers.\n\nThese third parties have their own privacy and cookie policies."],
        ["6. Mobile Application Technologies", "Where Eki is used through a mobile application, similar technologies may be used instead of browser cookies.\n\nThese may include device identifiers, software development kits (SDKs), analytics technologies, and security technologies.\n\nThese technologies help provide app functionality and improve user experience."],
        ["7. Managing Cookies", "Most web browsers allow users to view cookies, delete cookies, block cookies, and control cookie preferences.\n\nYou may choose to disable cookies through your browser settings.\n\nPlease note that disabling certain cookies may affect the functionality of Eki."],
        ["8. Do Not Track", "Some browsers provide \"Do Not Track\" settings.\n\nBecause there is currently no universally accepted standard for responding to such signals, Eki may not respond to Do Not Track requests."],
        ["9. Data Protection", "Information collected through cookies may be processed in accordance with the Eki Privacy Policy.\n\nFor more information about how we handle personal information, please refer to our Privacy Policy."],
        ["10. Changes To This Cookie Policy", "Eki may update this Cookie Policy from time to time. Updated versions will be posted within the platform and on our website.\n\nContinued use of Eki following publication of changes constitutes acceptance of the updated Policy."],
        ["11. Governing Law", "This Cookie Policy shall be governed by and interpreted in accordance with the laws of England and Wales. Any disputes relating to this Policy shall be subject to the exclusive jurisdiction of the courts of England and Wales.\n\nContact: Ehimare Co\nEmail: info@culinarytales.app"],
      ]}
    />
  );
}
