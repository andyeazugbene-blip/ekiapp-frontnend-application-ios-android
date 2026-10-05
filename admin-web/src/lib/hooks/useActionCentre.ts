"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { APIError } from "@/lib/api";
import { ActionCentreData, dashboardAPI } from "@/lib/services/dashboard.api";

/**
 * One shared, 60s-cached Action Centre request. The sidebar badges, header
 * "last refreshed" stamp and the Overview page all read the same cache entry,
 * so the page triggers a single request per minute (handbook §3).
 */

const TTL_MS = 60_000;

interface Entry {
  data: ActionCentreData | null;
  fetchedAt: number;
  error: { message: string; status?: number } | null;
  inflight: Promise<void> | null;
}

const cache = new Map<string, Entry>();
const listeners = new Set<() => void>();

function entryFor(key: string): Entry {
  let e = cache.get(key);
  if (!e) {
    e = { data: null, fetchedAt: 0, error: null, inflight: null };
    cache.set(key, e);
  }
  return e;
}

function notify() {
  listeners.forEach((l) => l());
}

export function loadActionCentre(includeTest: boolean, force = false): Promise<void> {
  const key = includeTest ? "test" : "prod";
  const e = entryFor(key);
  if (e.inflight) return e.inflight;
  if (!force && e.data && Date.now() - e.fetchedAt < TTL_MS) return Promise.resolve();
  e.inflight = dashboardAPI
    .getActionCentre(includeTest)
    .then((data) => {
      e.data = data;
      e.fetchedAt = Date.now();
      e.error = null;
    })
    .catch((err: unknown) => {
      e.error = {
        message: err instanceof APIError ? err.message : "Could not load the Action Centre",
        status: err instanceof APIError ? err.status : undefined,
      };
    })
    .finally(() => {
      e.inflight = null;
      notify();
    });
  notify();
  return e.inflight;
}

export interface UseActionCentre {
  data: ActionCentreData | null;
  /** Epoch ms of the last successful fetch (0 if never). */
  fetchedAt: number;
  loading: boolean;
  error: { message: string; status?: number } | null;
  refresh: () => Promise<void>;
}

export function useActionCentre(includeTest = false, autoRefreshMs = 60_000): UseActionCentre {
  const key = includeTest ? "test" : "prod";
  const [, force] = useState(0);
  const keyRef = useRef(key);
  keyRef.current = key;

  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    void loadActionCentre(includeTest);
    const timer = autoRefreshMs > 0
      ? window.setInterval(() => {
          if (document.visibilityState === "visible") void loadActionCentre(includeTest, true);
        }, autoRefreshMs)
      : undefined;
    return () => {
      listeners.delete(l);
      if (timer) window.clearInterval(timer);
    };
  }, [includeTest, autoRefreshMs]);

  const refresh = useCallback(() => loadActionCentre(keyRef.current === "test", true), []);
  const e = entryFor(key);
  return { data: e.data, fetchedAt: e.fetchedAt, loading: !!e.inflight && !e.data, error: e.error, refresh };
}
