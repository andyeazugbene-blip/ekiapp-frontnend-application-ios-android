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

// This project persists a native android/ directory in git (real, hand-maintained
// native fixes — FCM Gradle wiring, Hermes path, RN new-arch fallbacks — live there
// and would be lost by a fresh `expo prebuild`). EAS Build silently ignores
// app.json's android.versionCode/version/package whenever that directory exists and
// reads android/app/build.gradle instead — confirmed by a real build (queued, then
// canceled) that used app.json's stale value instead of the one just set. Nothing
// previously caught the two files drifting apart, which is exactly how a duplicate/
// already-used versionCode could ship.
if (fs.existsSync("android/app/build.gradle")) {
  const gradle = fs.readFileSync("android/app/build.gradle", "utf8");
  const gradleVersionCode = Number(gradle.match(/versionCode\s+(\d+)/)?.[1]);
  const gradleVersionName = gradle.match(/versionName\s+"([^"]+)"/)?.[1];
  const gradleApplicationId = gradle.match(/applicationId\s+'([^']+)'/)?.[1];

  if (gradleVersionCode !== app.android?.versionCode) {
    failures.push(`android/app/build.gradle versionCode (${gradleVersionCode}) does not match app.json android.versionCode (${app.android?.versionCode}) — EAS Build will use the gradle value since android/ is a persisted native directory.`);
  }
  if (gradleVersionName !== app.version) {
    failures.push(`android/app/build.gradle versionName ("${gradleVersionName}") does not match app.json version ("${app.version}") — EAS Build will use the gradle value.`);
  }
  if (gradleApplicationId !== app.android?.package) {
    failures.push(`android/app/build.gradle applicationId ("${gradleApplicationId}") does not match app.json android.package ("${app.android?.package}") — EAS Build will use the gradle value.`);
  }
}

for (const warning of warnings) console.warn(`WARN ${warning}`);

if (failures.length > 0) {
  for (const failure of failures) console.error(`FAIL ${failure}`);
  process.exit(1);
}

console.log("Release configuration check passed.");
