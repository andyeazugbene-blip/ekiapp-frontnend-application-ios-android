#!/usr/bin/env node
/**
 * check-automation-managed-types-viewable
 *
 * Real device QA bug this guards against: automation-detail.tsx's
 * isValidType gate only checked VENDOR_AUTOMATION_TYPES (the 8 vendor-
 * toggleable types), which does not include the 3 Managed-by-Eki types
 * (Regular Delivery Payment Recovery, Renewal Reminders, Price Approval
 * Reminders). Tapping into any of those 3 from Automation Centre hit the
 * "isn't a recognized automation" error path before ever reaching the
 * same file's already-correct isManaged read-only rendering — not a
 * backend issue (listVendorAutomations() already returns all 11 types
 * correctly), a frontend gate excluding valid types.
 *
 * This does not re-implement the check as a full parser — it verifies the
 * specific line/expression that gates automation-detail.tsx's "is this
 * type viewable" decision references BOTH VENDOR_AUTOMATION_TYPES and
 * MANAGED_BY_EKI_TYPES, so a future edit that narrows the gate back down
 * to one list fails this check instead of shipping silently.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const TARGET = path.join(ROOT, "app", "(vendor)", "automation-detail.tsx");

if (!fs.existsSync(TARGET)) {
  console.error(`FAIL check-automation-managed-types-viewable: ${TARGET} not found.`);
  process.exit(1);
}

const source = fs.readFileSync(TARGET, "utf8");
const match = source.match(/const isValidType = ([^;]+);/);

if (!match) {
  console.error("FAIL check-automation-managed-types-viewable: could not find `const isValidType = ...;` in automation-detail.tsx — has this screen been restructured? Update this check to match.");
  process.exit(1);
}

const expression = match[1];
const referencesVendorTypes = expression.includes("VENDOR_AUTOMATION_TYPES");
const referencesManagedTypes = expression.includes("MANAGED_BY_EKI_TYPES");

if (!referencesVendorTypes || !referencesManagedTypes) {
  console.error(
    "FAIL check-automation-managed-types-viewable: automation-detail.tsx's isValidType gate no longer " +
      "references both VENDOR_AUTOMATION_TYPES and MANAGED_BY_EKI_TYPES " +
      `(found: \`${expression.trim()}\`). ` +
      "This will make the 3 Managed-by-Eki automations (PAYMENT_RECOVERY/RENEWAL_REMINDER/PRICE_APPROVAL_REMINDER) " +
      "unviewable again — the exact device QA bug this check exists to catch.",
  );
  process.exit(1);
}

console.log("check-automation-managed-types-viewable passed.");
