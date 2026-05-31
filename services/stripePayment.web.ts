export type PaymentResult =
  | { status: "succeeded" }
  | { status: "cancelled"; message?: string }
  | { status: "failed"; message: string }
  | { status: "unsupported"; message: string };

export function isPaymentSheetAvailable(): boolean {
  return false;
}

export async function presentPayment(): Promise<PaymentResult> {
  return {
    status: "unsupported",
    message: "Native Stripe PaymentSheet is not available on web in this mobile checkout flow.",
  };
}
