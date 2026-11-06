import { useEffect, useState } from "react";

import { apiClient } from "./api";

export interface LaunchSettings {
  ukLaunchMode: boolean;
  launchMarket: string;
  vendorTrialDays: number;
}

/** Used until the server answers, and if it can't. Matches the server defaults. */
const DEFAULTS: LaunchSettings = { ukLaunchMode: true, launchMarket: "GB", vendorTrialDays: 30 };

const CACHE_MS = 5 * 60 * 1000;
let cached: { at: number; value: LaunchSettings } | null = null;

export async function getLaunchSettings(): Promise<LaunchSettings> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.value;
  try {
    const value = await apiClient.get<LaunchSettings>("/api/community-buy/launch-settings", { skipAuth: true });
    cached = { at: Date.now(), value };
    return value;
  } catch {
    return cached?.value ?? DEFAULTS;
  }
}

export function useLaunchSettings(): LaunchSettings {
  const [settings, setSettings] = useState<LaunchSettings>(cached?.value ?? DEFAULTS);
  useEffect(() => {
    let active = true;
    void getLaunchSettings().then((value) => { if (active) setSettings(value); });
    return () => { active = false; };
  }, []);
  return settings;
}
