#!/usr/bin/env node
/**
 * check-android-native-google-signin
 *
 * Real bug this guards against: Google has removed support for the
 * custom-URI-scheme browser redirect that expo-auth-session's Google
 * provider uses on Android — every Android sign-in attempt failed with
 * "Error 400: invalid_request — Custom URI scheme is not enabled for your
 * Android client", confirmed against Google's own documentation and
 * reproduced independently of any device. See docs/google-sign-in.md.
 *
 * Fix: Android uses @react-native-google-signin/google-signin's native
 * picker instead; iOS keeps expo-auth-session untouched. This check makes
 * sure nothing quietly routes Android back through the broken browser flow,
 * and that the native package stays excluded from iOS (where it would
 * otherwise still get autolinked into the build despite never being called).
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SOCIAL_AUTH_PATH = path.join(ROOT, "components", "auth", "SocialAuthButtons.tsx");
const RN_CONFIG_PATH = path.join(ROOT, "react-native.config.js");

let failures = 0;
const fail = (msg) => {
  failures += 1;
  console.error(`FAIL check-android-native-google-signin: ${msg}`);
};

const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
if (!pkg.dependencies?.["@react-native-google-signin/google-signin"]) {
  fail("@react-native-google-signin/google-signin is no longer a dependency — Android Google Sign-In has nothing to use.");
}

if (!fs.existsSync(SOCIAL_AUTH_PATH)) {
  fail("components/auth/SocialAuthButtons.tsx not found.");
} else {
  const source = fs.readFileSync(SOCIAL_AUTH_PATH, "utf8");

  if (!/from\s+["']@react-native-google-signin\/google-signin["']/.test(source)) {
    fail("SocialAuthButtons.tsx no longer imports from @react-native-google-signin/google-signin.");
  }

  // handleGooglePress must branch Android to the native handler BEFORE it
  // ever reaches promptGoogleAsync() (expo-auth-session's browser flow) —
  // that branch is the entire fix. Find the function body and check order.
  const handlerMatch = source.match(/const handleGooglePress = \(\) => \{([\s\S]*?)\n  \};/);
  if (!handlerMatch) {
    fail("Could not find handleGooglePress() to verify its Android branch.");
  } else {
    const body = handlerMatch[1];
    const androidBranchIdx = body.search(/Platform\.OS === ["']android["']/);
    const promptIdx = body.indexOf("promptGoogleAsync(");
    if (androidBranchIdx === -1) {
      fail("handleGooglePress() no longer branches on Platform.OS === \"android\" — Android would fall through to the broken expo-auth-session browser flow.");
    } else if (promptIdx !== -1 && androidBranchIdx > promptIdx) {
      fail("handleGooglePress() calls promptGoogleAsync() before checking for Android — the Android branch must come first.");
    }
  }

  if (!/GoogleSignin\.configure\(\s*\{\s*webClientId:\s*GOOGLE_WEB_CLIENT_ID/.test(source)) {
    fail("GoogleSignin.configure() no longer uses GOOGLE_WEB_CLIENT_ID — Android must authenticate against the Web client, not the broken Android-type client.");
  }
}

if (!fs.existsSync(RN_CONFIG_PATH)) {
  fail("react-native.config.js is missing — @react-native-google-signin/google-signin would autolink into iOS, which this fix must never touch.");
} else {
  const rnConfig = fs.readFileSync(RN_CONFIG_PATH, "utf8");
  if (!/@react-native-google-signin\/google-signin/.test(rnConfig) || !/ios:\s*null/.test(rnConfig)) {
    fail("react-native.config.js no longer excludes @react-native-google-signin/google-signin from iOS.");
  }
}

if (failures > 0) process.exit(1);
console.log("check-android-native-google-signin passed.");
