"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, ErrorPanel, LoadingPanel } from "@/components/AdminUI";
import { Banner, formatDateTime, useConfirm } from "@/components/AdminKit";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { APIError } from "@/lib/api";
import { platformSettingsAPI, LaunchSetting } from "@/lib/services/security.api";
import HistoryList from "./HistoryList";

function formatValue(setting: LaunchSetting, value: number): string {
  if (setting.kind === "toggle") return value === 1 ? "On" : "Off";
  return setting.unit ? `${value} ${setting.unit}` : String(value);
}

export default function LaunchSettingsTab({ currentAdminId }: { currentAdminId?: string }) {
  const { has } = usePermissions();
  const canEdit = has("settings.mutate");
  const confirm = useConfirm();
  const [settings, setSettings] = useState<LaunchSetting[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [historyKey, setHistoryKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const loaded = await platformSettingsAPI.listLaunchSettings();
      setSettings(loaded);
      setDrafts(Object.fromEntries(loaded.map((s) => [s.key, String(s.value)])));
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Failed to load launch settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const groups = useMemo(() => {
    const map = new Map<string, LaunchSetting[]>();
    for (const setting of settings) map.set(setting.group, [...(map.get(setting.group) ?? []), setting]);
    return [...map.entries()];
  }, [settings]);

  if (loading) return <LoadingPanel label="Loading launch settings..." />;
  if (error) return <ErrorPanel message={error} onRetry={() => void load()} />;

  const save = (setting: LaunchSetting, value: number) =>
    confirm.ask(
      { title: `Change ${setting.label.toLowerCase()} to ${formatValue(setting, value)}?`, confirmLabel: "Save", tone: "primary" },
      async (reason) => {
        await platformSettingsAPI.saveLaunchSetting(setting.key, value, reason);
        setNotice(`${setting.label} updated.`);
        await load();
      },
    );

  return (
    <div className="space-y-5">
      <Banner tone="info" title="Launch decisions">
        Defaults come from the client documents, shown under each setting. A change applies straight away and needs a reason and a 2FA code.
      </Banner>
      {notice ? <Banner tone="success">{notice}</Banner> : null}
      {groups.map(([group, rows]) => (
        <Card key={group}>
          <h2 className="text-xl font-black">{group}</h2>
          <div className="mt-6 divide-y divide-slate-100">
            {rows.map((s) => {
              const value = Number(drafts[s.key]);
              const valid = Number.isInteger(value) && value >= s.min && value <= s.max;
              return (
                <div key={s.key} className="py-6 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-bold">{s.label}</p>
                      <p className="mt-1 max-w-xl text-sm text-slate-500">{s.help}</p>
                      <p className="mt-1 text-xs text-slate-400">Default {formatValue(s, s.defaultValue)}. Source: {s.source}.</p>
                    </div>
                    <Badge tone={s.changedFromDefault ? "amber" : "green"}>{formatValue(s, s.value)}</Badge>
                  </div>
                  <div className="mt-4 flex flex-wrap items-end gap-3">
                    {s.kind === "toggle" ? (
                      canEdit ? <Button onClick={() => save(s, s.value === 1 ? 0 : 1)}>{s.value === 1 ? "Turn off" : "Turn on"}</Button> : null
                    ) : (
                      <>
                        <label className="w-40">
                          <span className="text-xs font-bold capitalize text-slate-500">{s.unit ?? "Value"} ({s.min} to {s.max})</span>
                          <input
                            type="number"
                            min={s.min}
                            max={s.max}
                            step={1}
                            disabled={!canEdit}
                            value={drafts[s.key] ?? ""}
                            onChange={(e) => setDrafts((p) => ({ ...p, [s.key]: e.target.value }))}
                            className="mt-1 h-11 w-full rounded-xl border border-slate-300 px-3 outline-none focus:border-[#096B4A] disabled:bg-slate-50"
                          />
                        </label>
                        {canEdit ? <Button disabled={!valid || value === s.value} onClick={() => save(s, value)}>Save</Button> : null}
                      </>
                    )}
                    <Button variant="ghost" onClick={() => setHistoryKey(historyKey === s.key ? null : s.key)}>{historyKey === s.key ? "Hide history" : "History"}</Button>
                  </div>
                  <p className="mt-3 text-xs text-slate-400">
                    {s.updatedAt ? `Last updated ${formatDateTime(s.updatedAt)} by ${s.updatedById === currentAdminId ? "you" : s.updatedById ?? "unknown"}` : "Using the default."}
                  </p>
                  {historyKey === s.key ? <HistoryList settingKey={s.key} /> : null}
                </div>
              );
            })}
          </div>
        </Card>
      ))}
      {confirm.dialog}
    </div>
  );
}
