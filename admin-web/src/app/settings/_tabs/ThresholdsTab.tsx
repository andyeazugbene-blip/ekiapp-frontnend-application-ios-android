"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, ErrorPanel, LoadingPanel } from "@/components/AdminUI";
import { Banner, formatDateTime, useConfirm } from "@/components/AdminKit";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { APIError } from "@/lib/api";
import { adminAPI, OperationalThresholdSetting } from "@/lib/services/admin.api";
import HistoryList from "./HistoryList";

const LABELS: Record<OperationalThresholdSetting["key"], { title: string; description: string }> = {
  PRICE_APPROVAL_TIMEOUT_HOURS: {
    title: "Price approval timeout",
    description: "How many hours a buyer has to approve a Regular Deliveries price change before the renewal expires automatically.",
  },
  FULFILMENT_STALE_THRESHOLD_HOURS: {
    title: "Fulfilment stale threshold",
    description: "How many hours a Community Buy supplier fulfilment with no estimated-ready date can go without progress before it is flagged for review.",
  },
  PAYOUT_STUCK_THRESHOLD_HOURS: {
    title: "Payout stuck threshold",
    description: "How many hours a Community Buy payout can sit in Pending/In Transit before ops is alerted that it may be stuck.",
  },
};

export default function ThresholdsTab({ currentAdminId }: { currentAdminId?: string }) {
  const { has } = usePermissions();
  const canEdit = has("settings.mutate");
  const confirm = useConfirm();
  const [settings, setSettings] = useState<OperationalThresholdSetting[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [historyKey, setHistoryKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const { settings: loaded } = await adminAPI.getOperationalThresholds();
      setSettings(loaded);
      setDrafts(Object.fromEntries(loaded.map((s) => [s.key, s.value != null ? String(s.value) : ""])));
    } catch (err) {
      setError(err instanceof APIError ? err.message : "Failed to load operational thresholds");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <LoadingPanel label="Loading operational thresholds..." />;
  if (error) return <ErrorPanel message={error} onRetry={() => void load()} />;

  return (
    <Card>
      <h2 className="text-xl font-black">Operational thresholds</h2>
      <p className="mt-2 text-slate-500">Admin-managed values. A change takes effect on the next scheduled check, no redeploy. Each change needs a reason and a 2FA code.</p>
      {notice ? <div className="mt-4"><Banner tone="success">{notice}</Banner></div> : null}
      <div className="mt-6 divide-y divide-slate-100">
        {settings.map((s) => {
          const label = LABELS[s.key];
          const value = Number(drafts[s.key]);
          const valid = Number.isFinite(value) && value > 0 && value !== s.value;
          return (
            <div key={s.key} className="py-6 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-bold">{label.title}</p>
                  <p className="mt-1 max-w-xl text-sm text-slate-500">{label.description}</p>
                </div>
                {s.value == null ? <Badge tone="amber">Not configured</Badge> : <Badge tone="green">{s.value} hour{s.value === 1 ? "" : "s"}</Badge>}
              </div>
              <div className="mt-4 flex flex-wrap items-end gap-3">
                <label className="w-40">
                  <span className="text-xs font-bold text-slate-500">Hours</span>
                  <input type="number" min={0} step="any" disabled={!canEdit} value={drafts[s.key] ?? ""} onChange={(e) => setDrafts((p) => ({ ...p, [s.key]: e.target.value }))} className="mt-1 h-11 w-full rounded-xl border border-slate-300 px-3 outline-none focus:border-[#096B4A] disabled:bg-slate-50" />
                </label>
                {canEdit ? (
                  <Button
                    disabled={!valid}
                    onClick={() =>
                      confirm.ask(
                        { title: `Change ${label.title.toLowerCase()} to ${value} hours?`, confirmLabel: "Save", tone: "primary" },
                        async (reason) => {
                          await adminAPI.updateOperationalThreshold(s.key, value, reason);
                          setNotice(`${label.title} updated.`);
                          await load();
                        },
                      )
                    }
                  >
                    Save
                  </Button>
                ) : null}
                <Button variant="ghost" onClick={() => setHistoryKey(historyKey === s.key ? null : s.key)}>{historyKey === s.key ? "Hide history" : "History"}</Button>
              </div>
              <p className="mt-3 text-xs text-slate-400">
                {s.updatedAt ? `Last updated ${formatDateTime(s.updatedAt)} by ${s.updatedById === currentAdminId ? "you" : s.updatedById ?? "unknown"}` : "Never configured."}
              </p>
              {historyKey === s.key ? <HistoryList settingKey={s.key} /> : null}
            </div>
          );
        })}
      </div>
      {confirm.dialog}
    </Card>
  );
}
