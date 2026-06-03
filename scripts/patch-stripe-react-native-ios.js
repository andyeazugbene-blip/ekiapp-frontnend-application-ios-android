const fs = require("fs");
const path = require("path");

const stripeRoot = path.join(__dirname, "..", "node_modules", "@stripe", "stripe-react-native");

function read(file) {
  return fs.readFileSync(file, "utf8");
}

function writeIfChanged(file, next) {
  const current = read(file);
  if (current === next) return false;
  fs.writeFileSync(file, next);
  return true;
}

function patchFile(file, patcher) {
  if (!fs.existsSync(file)) {
    console.warn(`[patch-stripe-react-native-ios] Missing ${path.relative(stripeRoot, file)}; skipping.`);
    return false;
  }
  return writeIfChanged(file, patcher(read(file)));
}

function patchPodspec() {
  const file = path.join(stripeRoot, "stripe-react-native.podspec");
  return patchFile(file, (source) => {
    const lines = source.split(/\r?\n/);
    const next = [];

    for (const line of lines) {
      if (line.trim().startsWith("s.exclude_files =")) {
        next.push("  s.exclude_files = [ 'ios/Tests/', 'ios/NewArch/', 'ios/PushProvisioning/**/*' ]");
        continue;
      }

      next.push(line);

      if (
        line.trim() === 'ss.source_files = "ios/NewArch/**/*.{h,m,mm}"' &&
        !source.includes("AddToWalletButtonComponentView.*")
      ) {
        next.push('      ss.exclude_files = [ "ios/NewArch/AddToWalletButtonComponentView.*" ]');
      }
    }

    return next.join("\n");
  });
}

function patchStripePackageCodegen() {
  const file = path.join(stripeRoot, "package.json");
  return patchFile(file, (source) => {
    const pkg = JSON.parse(source);
    if (pkg.codegenConfig?.ios?.componentProvider?.AddToWalletButton) {
      delete pkg.codegenConfig.ios.componentProvider.AddToWalletButton;
    }
    return `${JSON.stringify(pkg, null, 2)}\n`;
  });
}

function patchSwiftInteropHeader() {
  const file = path.join(stripeRoot, "ios", "StripeSwiftInterop.h");
  const importBlock = `// Eki build patch:
// Import Stripe and PassKit before stripe_react_native-Swift.h. This keeps
// PaymentSheet builds stable when Xcode parses the generated Swift bridge.
#if __has_include(<Stripe/Stripe.h>)
#import <Stripe/Stripe.h>
#endif
#if __has_include(<PassKit/PassKit.h>)
#import <PassKit/PassKit.h>
#endif

`;

  return patchFile(file, (source) => {
    if (source.includes("Eki build patch:")) return source;
    return source.replace("// Import this header", `${importBlock}// Import this header`);
  });
}

function patchStripeSdkImpl() {
  const file = path.join(stripeRoot, "ios", "StripeSdkImpl.swift");
  return patchFile(file, (source) => {
    let next = source;
    next = next.replace(
      /    @objc\(canAddCardToWallet:resolver:rejecter:\)\n[\s\S]*?    @objc\(isCardInWallet:resolver:rejecter:\)/,
      `    @objc(canAddCardToWallet:resolver:rejecter:)
  public func canAddCardToWallet(
        params: NSDictionary,
        resolver resolve: @escaping RCTPromiseResolveBlock,
        rejecter reject: @escaping RCTPromiseRejectBlock
    ) -> Void {
        resolve([
            "canAddCard": false,
            "details": ["status": "UNSUPPORTED_DEVICE"],
        ])
    }

    @objc(isCardInWallet:resolver:rejecter:)`,
    );
    next = next.replace(
      /  public func isCardInWallet\(\n        params: NSDictionary,\n        resolver resolve: @escaping RCTPromiseResolveBlock,\n        rejecter reject: @escaping RCTPromiseRejectBlock\n    \) -> Void \{\n[\s\S]*?        resolve\(\["isInWallet": PushProvisioningUtils\.getPassLocation\(last4: last4\) != nil\]\)\n    \}/,
      `  public func isCardInWallet(
        params: NSDictionary,
        resolver resolve: @escaping RCTPromiseResolveBlock,
        rejecter reject: @escaping RCTPromiseRejectBlock
    ) -> Void {
        resolve(["isInWallet": false])
    }`,
    );
    return next;
  });
}

if (!fs.existsSync(stripeRoot)) {
  console.warn("[patch-stripe-react-native-ios] @stripe/stripe-react-native not installed; skipping.");
  process.exit(0);
}

const changed = [
  patchPodspec(),
  patchStripePackageCodegen(),
  patchSwiftInteropHeader(),
  patchStripeSdkImpl(),
].some(Boolean);

console.log(
  changed
    ? "[patch-stripe-react-native-ios] Patched Stripe iOS PaymentSheet build."
    : "[patch-stripe-react-native-ios] Stripe iOS PaymentSheet patch already applied.",
);
