"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, EmptyState, ErrorPanel, LoadingPanel } from "@/components/AdminUI";
import { Banner, formatDateTime, useConfirm } from "@/components/AdminKit";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { APIError } from "@/lib/api";
import { platformSettingsAPI, PlatformFlag } from "@/lib/services/security.api";
import HistoryList from "./HistoryList";

const KEY_RE = /^FLAG_[A-Z0-9_]{1,59}$/;

export default function FlagsTab() {
  const { has } = usePermissions();
  const canEdit = has("settings.mutate");
  const confirm = useConfirm();
  const [flags, setFlags] = useState<PlatformFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [historyKey, setHistoryKey] = useState<string | null>(null);
  const [newKey, setNewKey] = useState("FLAG_");
  const [newDesc, setNewDesc] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      setFlags(await platformSettingsAPI.listFlags());
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Failed to load platform flags");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <LoadingPanel label="Loading platform flags..." />;
  if (error) return <ErrorPanel message={error} onRetry={() => void load()} />;

  return (
    <div className="space-y-5">
      <Banner tone="info" title="How flags work">
        A flag is an on/off switch stored centrally. It only changes behaviour where platform code checks it by key, so create flags together with the feature that reads them. Every change needs a reason and a 2FA code and is kept in history.
      </Banner>
      {notice ? <Banner tone="success">{notice}</Banner> : null}
      <Card>
        <h2 className="text-xl font-black">Platform flags</h2>
        {flags.length === 0 ? <div className="mt-4"><EmptyState title="No flags created yet" /></div> : null}
        <div className="mt-4 divide-y divide-slate-100">
          {flags.map((f) => (
            <div key={f.key} className="py-5 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-mono text-sm font-bold">{f.key}</p>
                  <p className="mt-1 text-sm text-slate-600">{f.description ?? "No description"}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={f.enabled ? "green" : "gray"}>{f.enabled ? "On" : "Off"}</Badge>
                  {canEdit ? (
                    <Button
                      variant="ghost"
                      className="h-9 px-3"
                      onClick={() =>
                        confirm.ask(
                          { title: `Turn ${f.key} ${f.enabled ? "off" : "on"}?`, confirmLabel: f.enabled ? "Turn off" : "Turn on", tone: f.enabled ? "danger" : "primary" },
                          async (reason) => {
                            await platformSettingsAPI.saveFlag(f.key, { enabled: !f.enabled, reason });
                            setNotice(`${f.key} is now ${f.enabled ? "off" : "on"}.`);
                            await load();
                          },
                        )
                      }
                    >
                      Turn {f.enabled ? "off" : "on"}
                    </Button>
                  ) : null}
                  <Button variant="ghost" className="h-9 px-3" onClick={() => setHistoryKey(historyKey === f.key ? null : f.key)}>History</Button>
                </div>
              </div>
              <p className="mt-2 text-xs text-slate-400">
                Last updated {formatDateTime(f.updatedAt)} by {f.updatedBy ? f.updatedBy.name ?? f.updatedBy.email ?? f.updatedBy.id : "unknown"}
              </p>
              {historyKey === f.key ? <HistoryList settingKey={f.key} /> : null}
            </div>
          ))}
        </div>
      </Card>

      {canEdit ? (
        <Card>
          <h3 className="text-lg font-black">Create a flag</h3>
          <div className="mt-3 grid gap-3 md:grid-cols-[260px_1fr_auto] md:items-end">
            <label className="text-sm font-bold">Key
              <input value={newKey} onChange={(e) => setNewKey(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ""))} className="mt-1 h-11 w-full rounded-xl border border-slate-300 px-3 font-mono text-sm outline-none focus:border-[#096B4A]" />
            </label>
            <label className="text-sm font-bold">What it controls
              <input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} maxLength={300} className="mt-1 h-11 w-full rounded-xl border border-slate-300 px-3 text-sm font-normal outline-none focus:border-[#096B4A]" />
            </label>
            <Button
              disabled={!KEY_RE.test(newKey) || newDesc.trim().length < 5}
              onClick={() =>
                confirm.ask({ title: `Create flag ${newKey}?`, description: "It starts switched off.", confirmLabel: "Create", tone: "primary" }, async (reason) => {
                  await platformSettingsAPI.saveFlag(newKey, { enabled: false, description: newDesc.trim(), reason });
                  setNewKey("FLAG_");
                  setNewDesc("");
                  setNotice("Flag created (off).");
                  await load();
                })
              }
            >
              Create
            </Button>
          </div>
        </Card>
      ) : null}
      {confirm.dialog}
    </div>
  );
}
