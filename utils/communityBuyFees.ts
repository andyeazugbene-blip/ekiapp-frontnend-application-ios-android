// Diaspora escrow reconciliation (final V1 settlement doc) — pure display
// helpers only. The amount a buyer is ever actually charged is always
// computed authoritatively server-side at pledge time
// (calculateBoundedServiceFee() in the backend's shared/pricing.ts); these
// mirror that exact formula for an accurate pre-payment preview and never
// themselves move money or decide a charge.
//
// The £1.20 / £5.00 bounds are the client-confirmed final V1 numbers (also
// the backend's MarketConfiguration defaults) — not a guess. The percentage
// itself comes from the campaign response's live feeBps so an admin rate
// change is reflected without a mobile release.
export const BUYER_SERVICE_FEE_MIN_MINOR = 120;
export const BUYER_SERVICE_FEE_MAX_MINOR = 500;
export const DEFAULT_BUYER_SERVICE_FEE_BPS = 500;

export function calculateBuyerServiceFee(
  productSubtotalMinor: number,
  feeBps: number = DEFAULT_BUYER_SERVICE_FEE_BPS,
  minMinor: number = BUYER_SERVICE_FEE_MIN_MINOR,
  maxMinor: number = BUYER_SERVICE_FEE_MAX_MINOR,
): number {
  if (!Number.isFinite(productSubtotalMinor) || productSubtotalMinor <= 0) return 0;
  const raw = Math.round((productSubtotalMinor * feeBps) / 10000);
  return Math.min(maxMinor, Math.max(minMinor, raw));
}

// Diaspora escrow reconciliation — supplier's wholesale commission preview
// (final V1: 8% of the agreed wholesale amount, shown before invitation
// acceptance). Mirrors calculatePlatformFee() in the backend.
export function calculateSupplierCommission(wholesaleAmountMinor: number, feeBps: number): { commissionAmount: number; netPayable: number } {
  if (!Number.isFinite(wholesaleAmountMinor) || wholesaleAmountMinor <= 0) return { commissionAmount: 0, netPayable: 0 };
  const commissionAmount = Math.round((wholesaleAmountMinor * feeBps) / 10000);
  return { commissionAmount, netPayable: wholesaleAmountMinor - commissionAmount };
}
