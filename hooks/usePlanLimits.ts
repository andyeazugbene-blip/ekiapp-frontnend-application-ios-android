/**
 * usePlanLimits — fetches the vendor's subscription plan limits and exposes
 * boolean gates that screens can use to allow or block features.
 *
 * The returned flags always reflect the latest backend limits.
 */
import { useCallback, useEffect, useState } from "react";
import { useFocusEffect } from "expo-router";
import { subscriptionService, type SubscriptionLimits } from "../services/subscriptionService";

interface UsePlanLimitsResult {
  limits: SubscriptionLimits | null;
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
  canAddProduct: boolean;
  canReceiveOrders: boolean;
  canSendOffers: boolean;
  canAccessAnalytics: boolean;
}

export function usePlanLimits(options: { refreshOnFocus?: boolean } = {}): UsePlanLimitsResult {
  const [limits, setLimits] = useState<SubscriptionLimits | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await subscriptionService.getLimits();
      setLimits(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load plan limits.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useFocusEffect(
    useCallback(() => {
      if (options.refreshOnFocus) refresh();
    }, [options.refreshOnFocus, refresh])
  );

  return {
    limits,
    loading,
    error,
    refresh,
    canAddProduct:
      limits != null
        ? limits.maxProducts >= Number.MAX_SAFE_INTEGER || limits.currentProducts < limits.maxProducts
        : false,
    canReceiveOrders: limits?.canReceiveOrders ?? false,
    canSendOffers: limits?.canSendOffers ?? false,
    canAccessAnalytics: limits?.canAccessAnalytics ?? false,
  };
}
