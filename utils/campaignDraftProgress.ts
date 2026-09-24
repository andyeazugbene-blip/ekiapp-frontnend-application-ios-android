import type { Campaign } from "../services/communityBuyService";

/**
 * How far along a saved Community Buy draft is, computed purely from what the
 * server already returned for it — no separate client-side draft store, so it
 * can never drift from what's actually persisted.
 *
 * The rules mirror the required-field gate in the backend's
 * communityCampaignsService.submit() (the only authority on completeness) but
 * only for the parts an organiser fills in while drafting. It is a *hint* for
 * "where you left off" — never a gate: submit() still validates for real, and
 * an incomplete draft is always fully saveable and reopenable.
 */
export type DraftStepKey = "product" | "quantities" | "delivery" | "fulfilment";

export interface DraftStep {
  key: DraftStepKey;
  label: string;
  done: boolean;
}

export interface DraftProgress {
  steps: DraftStep[];
  /** First step not yet complete, in form order — null when every step is done. */
  next: DraftStep | null;
}

function nonEmpty(value: string | null | undefined): boolean {
  return Boolean(value && value.trim());
}

export function getDraftProgress(campaign: Campaign): DraftProgress {
  const product = nonEmpty(campaign.title) && nonEmpty(campaign.unit) && Boolean(campaign.quantityPerOrder && campaign.quantityPerOrder >= 1);

  const min = campaign.minimumShares ?? 0;
  const goal = campaign.goalShares ?? 0;
  const max = campaign.maximumShares ?? 0;
  const quantities =
    min >= 1 &&
    goal >= min &&
    max >= goal &&
    Boolean(campaign.pricePerShareMinor && campaign.pricePerShareMinor > 0) &&
    Boolean(campaign.deadline && new Date(campaign.deadline).getTime() > Date.now());

  const delivery =
    campaign.deliveryPreference === "DELIVERY"
      ? (campaign.deliveryCoverageAreas ?? []).length > 0 && campaign.deliveryFeeAmountMinor != null && campaign.deliveryFeeAmountMinor >= 0
      : nonEmpty(campaign.collectionAddressLine1) && nonEmpty(campaign.collectionCity) && nonEmpty(campaign.collectionPostcode);

  // SELF needs nothing more; SUPPLIER needs a supplier actually chosen
  // (invitation response is deliberately NOT required — a campaign can be
  // submitted while the supplier hasn't answered yet).
  const fulfilment = campaign.fulfilmentOwner === "SELF" || Boolean(campaign.supplierId || campaign.supplierAccountId);

  const steps: DraftStep[] = [
    { key: "product", label: "Product details", done: product },
    { key: "quantities", label: "Shares, price & deadline", done: quantities },
    { key: "delivery", label: "Delivery", done: delivery },
    { key: "fulfilment", label: "Fulfilment", done: fulfilment },
  ];
  return { steps, next: steps.find((s) => !s.done) ?? null };
}
