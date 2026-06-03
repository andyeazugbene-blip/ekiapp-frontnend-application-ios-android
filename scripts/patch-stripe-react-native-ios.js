const fs = require("fs");
const path = require("path");

const interopHeader = path.join(
  __dirname,
  "..",
  "node_modules",
  "@stripe",
  "stripe-react-native",
  "ios",
  "StripeSwiftInterop.h",
);

const importBlock = `// Eki build patch:
// Xcode can emit stripe_react_native-Swift.h before Stripe's Swift protocol
// definitions are visible. Import Stripe's Swift bridge first so protocols
// like STPIssuingCardEphemeralKeyProvider are defined when the RN Stripe
// generated Swift header is parsed.
#if __has_include(<Stripe/Stripe-Swift.h>)
#import <Stripe/Stripe-Swift.h>
#endif
#if __has_include(<PassKit/PassKit.h>)
#import <PassKit/PassKit.h>
#endif

`;

if (!fs.existsSync(interopHeader)) {
  console.warn("[patch-stripe-react-native-ios] StripeSwiftInterop.h not found; skipping.");
  process.exit(0);
}

const source = fs.readFileSync(interopHeader, "utf8");
if (source.includes("Eki build patch:")) {
  console.log("[patch-stripe-react-native-ios] Stripe iOS interop patch already applied.");
  process.exit(0);
}

fs.writeFileSync(interopHeader, source.replace("// Import this header", `${importBlock}// Import this header`));
console.log("[patch-stripe-react-native-ios] Applied Stripe iOS interop patch.");
