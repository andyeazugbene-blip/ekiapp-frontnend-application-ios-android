"use client";

import { useCallback, useEffect, useState } from "react";
import { apiClient } from "@/lib/api";

export interface AdminAccess {
  permissions: string[];
  roles: { id: string; name: string }[];
  isSuperAdmin: boolean;
  twoFactor: { enabled: boolean; enforced: boolean; setupRequired: boolean };
}

/**
 * Same matching rules as the backend (admin-roles.service.ts permissionMatches):
 * exact string, "admin.*" (everything) or "prefix.*" (everything under prefix).
 */
export function permissionMatches(granted: readonly string[], required: string): boolean {
  for (const g of granted) {
    if (g === required || g === "admin.*") return true;
    if (g.endsWith(".*") && required.startsWith(g.slice(0, -1))) return true;
  }
  return false;
}

// One shared fetch per browser session/token; every component that calls
// usePermissions() reuses it and is notified when it changes.
let cache: { token: string; access: AdminAccess } | null = null;
let inflight: { token: string; promise: Promise<AdminAccess> } | null = null;
const listeners = new Set<() => void>();

function currentToken(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem("admin_token") ?? "";
  } catch {
    return "";
  }
}

function notify() {
  listeners.forEach((fn) => fn());
}

export function clearPermissionsCache(): void {
  cache = null;
  inflight = null;
  notify();
}

async function load(force = false): Promise<AdminAccess> {
  const token = currentToken();
  if (!token) throw new Error("Not signed in");
  if (!force && cache && cache.token === token) return cache.access;
  if (!force && inflight && inflight.token === token) return inflight.promise;
  const promise = apiClient
    .get<AdminAccess>("/admin/me/permissions", { bypassCache: true, suppressUnauthorizedRedirect: true })
    .then((access) => {
      cache = { token, access };
      return access;
    })
    .finally(() => {
      inflight = null;
      notify();
    });
  inflight = { token, promise };
  return promise;
}

export interface UsePermissionsResult {
  permissions: string[];
  /** Wildcard-aware check, e.g. has("orders.read"). While loading it returns false. */
  has: (permission: string) => boolean;
  /** True if the user has at least one of the given permissions. */
  hasAny: (...permissions: string[]) => boolean;
  loading: boolean;
  error: string | null;
  access: AdminAccess | null;
  refresh: () => Promise<void>;
}

export function usePermissions(): UsePermissionsResult {
  const token = currentToken();
  const [access, setAccess] = useState<AdminAccess | null>(cache && cache.token === token ? cache.access : null);
  const [loading, setLoading] = useState<boolean>(!(cache && cache.token === token) && Boolean(token));
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (force: boolean) => {
    try {
      setLoading(true);
      const result = await load(force);
      setAccess(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load permissions");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!currentToken()) {
      setAccess(null);
      setLoading(false);
      return;
    }
    if (cache && cache.token === currentToken()) {
      setAccess(cache.access);
      setLoading(false);
    } else {
      void run(false);
    }
    const onChange = () => {
      if (cache && cache.token === currentToken()) setAccess(cache.access);
      else if (!cache) setAccess(null);
    };
    listeners.add(onChange);
    return () => {
      listeners.delete(onChange);
    };
  }, [run]);

  const permissions = access?.permissions ?? [];
  const has = useCallback((permission: string) => permissionMatches(access?.permissions ?? [], permission), [access]);
  const hasAny = useCallback(
    (...required: string[]) => required.some((p) => permissionMatches(access?.permissions ?? [], p)),
    [access],
  );
  const refresh = useCallback(() => run(true), [run]);

  return { permissions, has, hasAny, loading, error, access, refresh };
}
