import { useFocusEffect } from "expo-router";
import { useCallback, useRef } from "react";

/**
 * Re-fetches a screen's data when it gains focus, but only when the last
 * fetch is actually stale — not on every single return to the screen.
 * Replaces the common `useFocusEffect(useCallback(() => { load(); }, [load]))`
 * pattern, which re-fetches everything on every navigation back to a screen
 * (tap -> loading -> re-fetch -> spinner, even when nothing changed).
 *
 * Manual pull-to-refresh / explicit retry actions are unaffected — call
 * `load` directly for those, same as before. This hook only gates the
 * automatic focus-triggered load.
 *
 * Not for financial/payment/order-status screens where the backend is the
 * only source of truth for a state the user is actively waiting on —
 * those should keep fetching on every focus (or poll), not go stale.
 */
export function useFocusRefresh(load: () => void | Promise<void>, staleMs = 30000): { markStale: () => void } {
  const lastFetchedAt = useRef(0);

  useFocusEffect(
    useCallback(() => {
      const now = Date.now();
      if (now - lastFetchedAt.current > staleMs) {
        lastFetchedAt.current = now;
        void load();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [load, staleMs]),
  );

  const markStale = useCallback(() => {
    lastFetchedAt.current = 0;
  }, []);

  return { markStale };
}
