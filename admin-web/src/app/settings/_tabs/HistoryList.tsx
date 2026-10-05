"use client";

import { useEffect, useState } from "react";
import { formatDateTime } from "@/components/AdminKit";
import { APIError } from "@/lib/api";
import { platformSettingsAPI, SettingHistoryEntry } from "@/lib/services/security.api";

function describe(state: unknown): string {
  if (!state || typeof state !== "object") return "none";
  const s = state as Record<string, unknown>;
  if ("enabled" in s) return s.enabled ? "On" : "Off";
  if ("value" in s) return String(s.value ?? "not set");
  return JSON.stringify(s);
}

/** Change history for one setting, read from the immutable audit log. */
export default function HistoryList({ settingKey }: { settingKey: string }) {
  const [items, setItems] = useState<SettingHistoryEntry[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    platformSettingsAPI
      .history(settingKey)
      .then((h) => alive && setItems(h))
      .catch((err) => alive && setError(err instanceof APIError ? err.message : "Could not load history."));
    return () => {
      alive = false;
    };
  }, [settingKey]);

  if (error) return <p className="mt-3 text-sm font-bold text-red-600">{error}</p>;
  if (!items) return <p className="mt-3 text-sm text-slate-500">Loading history...</p>;
  if (items.length === 0) return <p className="mt-3 text-sm text-slate-500">No recorded changes yet.</p>;
  return (
    <ul className="mt-3 space-y-2 rounded-xl bg-slate-50 p-3 text-sm" aria-label={`History for ${settingKey}`}>
      {items.map((h) => (
        <li key={h.id}>
          <span className="font-bold">{describe(h.beforeState)} to {describe(h.afterState)}</span>{" "}
          <span className="text-slate-500">by {h.actor.name ?? h.actor.email ?? h.actor.id} on {formatDateTime(h.createdAt)}</span>
          {h.reason ? <span className="block text-slate-600">Reason: {h.reason}</span> : null}
        </li>
      ))}
    </ul>
  );
}
