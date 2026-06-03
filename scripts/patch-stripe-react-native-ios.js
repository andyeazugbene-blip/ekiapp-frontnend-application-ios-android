const fs = require("fs");
const path = require("path");

const stripeRoot = path.join(__dirname, "..", "node_modules", "@stripe", "stripe-react-native");
const disabledNewArchComponents = [
  "AddressSheetViewComponentView.*",
  "AddToWalletButtonComponentView.*",
  "ApplePayButtonComponentView.*",
  "AuBECSDebitFormComponentView.*",
  "CardFieldComponentView.*",
  "CardFormComponentView.*",
  "EmbeddedPaymentElementViewComponentView.*",
  "GooglePayButtonComponentView.*",
  "StripeContainerComponentView.*",
];
const disabledCodegenComponents = [
  "AddToWalletButton",
  "AddressSheetView",
  "ApplePayButton",
  "AuBECSDebitForm",
  "CardField",
  "CardForm",
  "EmbeddedPaymentElementView",
  "StripeContainer",
];

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
  const newArchExclude = `      ss.exclude_files = [ ${disabledNewArchComponents
    .map((component) => `"ios/NewArch/${component}"`)
    .join(", ")} ]`;

  return patchFile(file, (source) => {
    const lines = source.split(/\r?\n/);
    const next = [];
    let wroteNewArchExclude = false;

    for (const line of lines) {
      if (line.trim().startsWith("s.exclude_files =")) {
        next.push(
          "  s.exclude_files = [ 'ios/Tests/', 'ios/NewArch/', 'ios/PushProvisioning/**/*', 'ios/AuBECSDebitForm*' ]",
        );
        continue;
      }

      if (line.trim().startsWith("ss.exclude_files =")) {
        if (!wroteNewArchExclude) {
          next.push(newArchExclude);
          wroteNewArchExclude = true;
        }
        continue;
      }

      next.push(line);

      if (
        line.trim() === 'ss.source_files = "ios/NewArch/**/*.{h,m,mm}"' &&
        !source.includes("ss.exclude_files")
      ) {
        next.push(newArchExclude);
        wroteNewArchExclude = true;
      }
    }

    return next.join("\n");
  });
}

function patchStripePackageCodegen() {
  const file = path.join(stripeRoot, "package.json");
  return patchFile(file, (source) => {
    const pkg = JSON.parse(source);
    if (pkg.codegenConfig?.ios?.componentProvider) {
      for (const component of disabledCodegenComponents) {
        delete pkg.codegenConfig.ios.componentProvider[component];
      }
    }
    return `${JSON.stringify(pkg, null, 2)}\n`;
  });
}

function patchUnusedCardViews() {
  const cardFieldView = path.join(stripeRoot, "ios", "CardFieldView.swift");
  const cardFormView = path.join(stripeRoot, "ios", "CardFormView.swift");

  const cardFieldStub = `import Foundation
import UIKit
import Stripe

@objc(CardFieldView)
public class CardFieldView: UIView {
    @objc public var onCardChange: RCTDirectEventBlock?
    @objc public var onFocusChange: RCTDirectEventBlock?
    @objc public var dangerouslyGetFullCardDetails: Bool = false
    @objc public var disabled: Bool = false
    @objc public var postalCodeEnabled: Bool = true
    @objc public var countryCode: String?
    @objc public var onBehalfOf: String?
    @objc public var preferredNetworks: Array<Int>?
    @objc public var placeholders: NSDictionary = NSDictionary()
    @objc public var autofocus: Bool = false
    @objc public var cardStyle: NSDictionary = NSDictionary()

    public var cardParams: STPPaymentMethodParams? = nil
    public var cardPostalCode: String? = nil

    override public init(frame: CGRect) {
        super.init(frame: frame)
        StripeSdkImpl.shared.cardFieldView = self
    }

    @objc public func focus() {}
    @objc public func blur() {}
    @objc public func clear() {}

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
}
`;

  const cardFormStub = `import Foundation
import UIKit
import Stripe

@objc(CardFormView)
public class CardFormView: UIView {
    public var cardForm: STPCardFormView?
    public var cardParams: STPPaymentMethodCardParams? = nil

    @objc public var dangerouslyGetFullCardDetails: Bool = false
    @objc public var onFormComplete: RCTDirectEventBlock?
    @objc public var autofocus: Bool = false
    @objc public var disabled: Bool = false
    @objc public var preferredNetworks: Array<Int>?
    @objc public var cardStyle: NSDictionary = NSDictionary()

    @objc public func didSetProps() {}
    override public func didSetProps(_ changedProps: [String]!) {}
    @objc public func focus() {}
    @objc public func blur() {}

    override public init(frame: CGRect) {
        super.init(frame: frame)
        StripeSdkImpl.shared.cardFormView = self
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
}
`;

  return [patchFile(cardFieldView, () => cardFieldStub), patchFile(cardFormView, () => cardFormStub)].some(Boolean);
}

function patchSwiftInteropHeader() {
  const file = path.join(stripeRoot, "ios", "StripeSwiftInterop.h");
  const header = `// Eki build patch:
// Import this header instead of stripe_react_native-Swift.h. Xcode can parse
// the generated Swift bridge before Stripe's optional protocols are visible.
#if __has_include(<Stripe/Stripe-Swift.h>)
#import <Stripe/Stripe-Swift.h>
#endif
#if __has_include(<Stripe/Stripe.h>)
#import <Stripe/Stripe.h>
#endif
#if __has_include(<StripePayments/StripePayments.h>)
#import <StripePayments/StripePayments.h>
#endif
#if __has_include(<StripePayments/STPAuthenticationContext.h>)
#import <StripePayments/STPAuthenticationContext.h>
#endif
#if __has_include(<StripePaymentsUI/StripePaymentsUI.h>)
#import <StripePaymentsUI/StripePaymentsUI.h>
#endif
#if __has_include(<StripeApplePay/StripeApplePay.h>)
#import <StripeApplePay/StripeApplePay.h>
#endif
#if __has_include(<StripePaymentSheet/StripePaymentSheet.h>)
#import <StripePaymentSheet/StripePaymentSheet.h>
#endif
#if __has_include(<PassKit/PassKit.h>)
#import <PassKit/PassKit.h>
#endif
#import <UIKit/UIKit.h>

@protocol STPAuthenticationContext <NSObject>
- (UIViewController *)authenticationPresentingViewController;
@end
@protocol STPApplePayContextDelegate;
@protocol PKPaymentAuthorizationViewControllerDelegate;
@protocol STPIssuingCardEphemeralKeyProvider;
@protocol PKAddPaymentPassViewControllerDelegate;
@protocol STPAUBECSDebitFormViewDelegate;
@protocol STPPaymentCardTextFieldDelegate;
@protocol STPCardFormViewDelegate;

typedef NS_ENUM(NSUInteger, STPPaymentStatus);

#import <React/RCTBridgeModule.h>
#import <React/RCTViewManager.h>

#if __has_include("stripe_react_native/stripe_react_native-Swift.h")
#import <stripe_react_native/stripe_react_native-Swift.h>
#elif __has_include(<stripe_react_native-Swift.h>)
#import <stripe_react_native-Swift.h>
#endif
`;

  return patchFile(file, () => header);
}

function patchSwiftBridgeImports() {
  const iosRoot = path.join(stripeRoot, "ios");
  const targets = [];

  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.name !== "StripeSwiftInterop.h" && /\.(m|mm|h)$/.test(entry.name)) {
        targets.push(fullPath);
      }
    }
  }

  walk(iosRoot);

  return targets
    .map((file) =>
      patchFile(file, (source) =>
        source
          .replace(/#import\s+["<]stripe_react_native\/stripe_react_native-Swift\.h[">]/g, '#import "StripeSwiftInterop.h"')
          .replace(/#import\s+["<]stripe_react_native-Swift\.h[">]/g, '#import "StripeSwiftInterop.h"'),
      ),
    )
    .some(Boolean);
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
  patchUnusedCardViews(),
  patchSwiftInteropHeader(),
  patchSwiftBridgeImports(),
  patchStripeSdkImpl(),
].some(Boolean);

console.log(
  changed
    ? "[patch-stripe-react-native-ios] Patched Stripe iOS PaymentSheet build."
    : "[patch-stripe-react-native-ios] Stripe iOS PaymentSheet patch already applied.",
);
