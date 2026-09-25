import type { LastDestination } from "../types/auth";

/**
 * Where a signed-in user lands when the app opens (cold start / re-open).
 *
 * The rule is "Home first": a returning Buyer sees Buyer Home, a returning
 * Vendor sees Vendor Home. The remembered destination (`lastDestination`) only
 * picks WHICH home — it never deep-links into a feature screen such as
 * Community Buy, payout setup or a campaign. Those are reached from Home
 * (cards / sidebar) or by explicitly opening a deep link.
 *
 * Supplier is the one exception: the Supplier Centre is the supplier's own
 * dashboard (its own route group, no separate home), so a user who last worked
 * as a supplier returns to it.
 *
 * `lastDestination` is a pure preference, never an authority — Vendor access is
 * gated on `hasVendor` in (vendor)/_layout.tsx — so a stale "sell" preference
 * on an account with no vendor profile falls through to Buyer Home here rather
 * than bouncing through the Vendor layout's redirect.
 */
export type HomeRouteUser = {
  role?: string | null;
  hasVendor?: boolean | null;
} | null | undefined;

export type HomeRoute =
  | "/(admin)"
  | "/(vendor)"
  | "/(buyer)"
  | "/(supplier)/community-buy-supplier";

export function resolveHomeRoute(user: HomeRouteUser, lastDestination: LastDestination | null | undefined): HomeRoute {
  if (user?.role === "admin") return "/(admin)";

  const hasVendor = Boolean(user?.hasVendor);

  switch (lastDestination) {
    case "sell":
      return hasVendor ? "/(vendor)" : "/(buyer)";
    case "supply":
      return "/(supplier)/community-buy-supplier";
    case "buy":
      return "/(buyer)";
    // "community_buy" (and no preference at all) open the account's default
    // Home: Vendor Home if they have a vendor profile, otherwise Buyer Home.
    // Community Buy is a feature reached from Home, not a Home of its own.
    case "community_buy":
    default:
      return hasVendor ? "/(vendor)" : "/(buyer)";
  }
}
