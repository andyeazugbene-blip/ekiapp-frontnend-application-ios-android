import type { useRouter } from "expo-router";
import { communityBuyService } from "../services/communityBuyService";

/** Phase 1 launches in the UK only. The market comes from the account, never a picker. */
const V1_MARKET = "GB";

/**
 * Sends an organiser to the flow their market is on. Offers must be seeded
 * before the offer flow opens, so the market setting decides, not the app version.
 */
export async function startCommunityBuy(router: ReturnType<typeof useRouter>): Promise<void> {
  const config = await communityBuyService.getMarketConfig(V1_MARKET).catch(() => null);
  router.push((config?.communityBuyOffersRequired ? "/(buyer)/community-buy-offer-campaign" : "/(buyer)/community-buy-organiser-campaign") as any);
}
