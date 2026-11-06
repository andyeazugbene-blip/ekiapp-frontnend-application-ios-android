import { completeHoldBankCheck, presentSetupIntent } from "../services/stripePayment";
import { communityBuyService, type Campaign } from "../services/communityBuyService";

/** Phase 1's approved wording. Only true of campaigns that really place a hold. */
export const HOLD_PAYMENT_LINE =
  "No payment is taken when you join. A temporary hold is placed shortly before the deadline, and you're only charged if the Community Buy goes ahead.";

export function usesHold(campaign: Pick<Campaign, "paymentMode"> | null | undefined): boolean {
  return campaign?.paymentMode === "AUTHORISE_THEN_CAPTURE";
}

/** Saves a different card after a decline or an unfinished bank check. Returns a message if it didn't work. */
export async function changeHoldCard(contributionId: string): Promise<string | null> {
  const { setupIntentClientSecret, stripeAccountId } = await communityBuyService.startHoldCardUpdate(contributionId);
  if (!setupIntentClientSecret) return "We couldn't start saving your card. Please try again.";
  const result = await presentSetupIntent({ clientSecret: setupIntentClientSecret, stripeAccountId });
  if (result.status === "cancelled") return null;
  if (result.status !== "succeeded") return result.message ?? "We couldn't save your card. Please try again.";
  await communityBuyService.confirmHoldSetup(contributionId);
  return null;
}

/** Runs the buyer's bank check for a hold. Returns a message if it didn't work. */
export async function finishHoldBankCheck(contributionId: string): Promise<string | null> {
  const action = await communityBuyService.getHoldAction(contributionId);
  if (!action.clientSecret) return "We couldn't start the bank check. Please try again.";
  const result = await completeHoldBankCheck({
    clientSecret: action.clientSecret,
    stripeAccountId: action.stripeAccountId,
    paymentMethodId: action.paymentMethodId,
    needsConfirmation: action.needsConfirmation,
  });
  if (result.status === "cancelled") return null;
  if (result.status !== "succeeded") return result.message ?? "Your bank didn't approve this. You can try again or use a different card.";
  await communityBuyService.refreshHold(contributionId);
  return null;
}
