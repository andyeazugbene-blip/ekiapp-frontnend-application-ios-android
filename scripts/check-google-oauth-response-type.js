#!/usr/bin/env node
/**
 * check-google-oauth-response-type
 *
 * Real production bug this guards against: SocialAuthButtons.tsx once
 * overrode Google.useAuthRequest's responseType to "id_token", which sends
 * response_type=id_token to Google's authorization endpoint. Google's
 * iOS-type OAuth client (registered for the native code+PKCE flow) rejects
 * that implicit response type with "Error 400: unsupported_response_type"
 * — a real TestFlight production error, not a hypothetical.
 *
 * expo-auth-session's own Google provider already defaults installed apps
 * (iOS/Android) to the correct response_type=code flow, auto-exchanging
 * the code for tokens via PKCE (no client secret) and populating
 * result.params.id_token from that exchange — so the fix is simply never
 * overriding responseType to "id_token"/"token" for a Google.useAuthRequest
 * call again.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const APP_DIR = path.join(ROOT, "app");
const COMPONENTS_DIR = path.join(ROOT, "components");

const BAD_RESPONSE_TYPE = /Google\.useAuthRequest\(\{[\s\S]{0,400}?responseType:\s*["'](id_token|token)["']/;

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      walk(full, files);
    } else if (full.endsWith(".tsx") || full.endsWith(".ts")) {
      files.push(full);
    }
  }
  return files;
}

const files = [...walk(APP_DIR), ...walk(COMPONENTS_DIR)];
const failures = [];

for (const file of files) {
  const source = fs.readFileSync(file, "utf8");
  const match = source.match(BAD_RESPONSE_TYPE);
  if (match) {
    failures.push(`${path.relative(ROOT, file)}: Google.useAuthRequest overrides responseType to "${match[1]}" — this sends an implicit-flow response_type Google's iOS/Android OAuth clients reject (Error 400: unsupported_response_type). Leave responseType unset so it defaults to the correct code+PKCE flow.`);
  }
}

if (failures.length > 0) {
  console.error("FAIL check-google-oauth-response-type:");
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log("check-google-oauth-response-type passed.");
