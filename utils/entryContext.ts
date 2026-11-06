import AsyncStorage from "@react-native-async-storage/async-storage";
import type { useRouter } from "expo-router";

import { useAuthStore } from "../stores/authStore";
import { resolveHomeRoute } from "./homeRoute";

const KEY = "eki.entryContext";
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export type EntryIntent = "sell" | "supply";

export interface EntryContext {
  intent?: EntryIntent;
  partnerCode?: string;
  savedAt: number;
}

export async function saveEntryContext(context: { intent?: EntryIntent; partnerCode?: string }): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify({ ...context, savedAt: Date.now() })).catch(() => undefined);
}

/** Lost or expired context falls back to no context, never an error. */
export async function loadEntryContext(): Promise<EntryContext | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const context = JSON.parse(raw) as EntryContext;
    if (Date.now() - context.savedAt > MAX_AGE_MS) {
      await AsyncStorage.removeItem(KEY);
      return null;
    }
    return context;
  } catch {
    return null;
  }
}

export async function clearEntryContext(): Promise<void> {
  await AsyncStorage.removeItem(KEY).catch(() => undefined);
}

/** Where someone goes after signing in: what they came to do, else where they last worked. */
export async function routeAfterSignIn(router: ReturnType<typeof useRouter>): Promise<void> {
  const { user, lastDestination } = useAuthStore.getState();
  const context = await loadEntryContext();
  await clearEntryContext();
  if (context?.intent === "sell") {
    router.replace((user?.hasVendor ? "/(vendor)" : "/(vendor-onboarding)/setup-store") as never);
    return;
  }
  if (context?.intent === "supply") {
    router.replace("/(supplier)/community-buy-supplier" as never);
    return;
  }
  router.replace(resolveHomeRoute(user, lastDestination) as never);
}
