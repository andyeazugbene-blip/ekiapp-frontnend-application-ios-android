const fs = require("fs");

const app = JSON.parse(fs.readFileSync("app.json", "utf8")).expo;
const eas = JSON.parse(fs.readFileSync("eas.json", "utf8"));
const failures = [];
const warnings = [];

const production = eas.build?.production ?? {};
const productionEnv = production.env ?? {};
const submitAndroid = eas.submit?.production?.android ?? {};

const productionStripeKey = productionEnv.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY;
if (typeof productionStripeKey === "string" && productionStripeKey.startsWith("pk_test_")) {
  failures.push("Production EAS profile must not embed a Stripe test publishable key.");
}
if (!productionStripeKey) {
  warnings.push("Configure EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY as an EAS production environment secret.");
}

if (production.credentialsSource === "local" && !fs.existsSync("credentials.json")) {
  failures.push("Production credentialsSource is local but credentials.json is missing.");
}

if (submitAndroid.serviceAccountKeyPath && !fs.existsSync(submitAndroid.serviceAccountKeyPath)) {
  failures.push(`Android submit service account file is missing: ${submitAndroid.serviceAccountKeyPath}`);
}

if (!app.ios?.bundleIdentifier) failures.push("iOS bundleIdentifier is missing.");
if (!app.android?.package) failures.push("Android package is missing.");
if (!app.extra?.privacyPolicyUrl) failures.push("Privacy policy URL is missing.");
if (!app.extra?.termsOfServiceUrl) failures.push("Terms of service URL is missing.");

for (const warning of warnings) console.warn(`WARN ${warning}`);

if (failures.length > 0) {
  for (const failure of failures) console.error(`FAIL ${failure}`);
  process.exit(1);
}

console.log("Release configuration check passed.");
