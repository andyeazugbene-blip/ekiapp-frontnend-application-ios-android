"use client";

import { useEffect, useState } from "react";
import { ConfirmDialog } from "@/components/AdminKit";

export interface SuspendValues {
  reason: string;
  evidence?: string;
  durationDays?: number;
  notifyUser: boolean;
}

/**
 * One suspension / restoration dialog for users and vendors (handbook 4.3,
 * 14.5): reason is REQUIRED, evidence + duration optional, and the admin
 * decides whether the person is notified. Restoring needs a reason too.
 */
export function SuspendDialog({
  open, mode, subject, onSubmit, onCancel,
}: {
  open: boolean;
  mode: "suspend" | "restore";
  /** Human name shown in the title, e.g. the store or person. */
  subject: string;
  onSubmit: (values: SuspendValues) => Promise<void>;
  onCancel: () => void;
}) {
  const [evidence, setEvidence] = useState("");
  const [duration, setDuration] = useState("");
  const [notifyUser, setNotifyUser] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) { setEvidence(""); setDuration(""); setNotifyUser(true); setError(""); setLoading(false); }
  }, [open]);

  const suspend = mode === "suspend";
  return (
    <ConfirmDialog
      open={open}
      title={suspend ? `Suspend ${subject}?` : `Restore ${subject}?`}
      tone={suspend ? "danger" : "primary"}
      confirmLabel={suspend ? "Suspend" : "Restore"}
      description={suspend
        ? "They will be signed out and blocked until restored. The reason is recorded in the audit log and can be sent to them."
        : "Access is restored. Only items switched off by the suspension are switched back on."}
      reasonLabel={suspend ? "Reason for suspension" : "Reason for restoring"}
      loading={loading}
      error={error}
      onCancel={onCancel}
      onConfirm={async (reason) => {
        setLoading(true); setError("");
        try {
          await onSubmit({
            reason,
            evidence: suspend && evidence.trim() ? evidence.trim() : undefined,
            durationDays: suspend && duration ? Number(duration) : undefined,
            notifyUser,
          });
        } catch (e) {
          setError(e instanceof Error ? e.message : "Action failed");
        } finally { setLoading(false); }
      }}
    >
      {suspend ? (
        <>
          <label className="block">
            <span className="text-xs font-black uppercase tracking-wide text-slate-500">Evidence / reference (optional)</span>
            <textarea value={evidence} onChange={(e) => setEvidence(e.target.value)} rows={2} maxLength={2000}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#096B4A]"
              placeholder="Report ID, order number, link…" />
          </label>
          <label className="block">
            <span className="text-xs font-black uppercase tracking-wide text-slate-500">Duration</span>
            <select value={duration} onChange={(e) => setDuration(e.target.value)}
              className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:border-[#096B4A]">
              <option value="">Until I restore it</option>
              <option value="1">1 day</option>
              <option value="7">7 days</option>
              <option value="30">30 days</option>
              <option value="90">90 days</option>
            </select>
            {duration ? <span className="mt-1 block text-xs text-slate-500">Lifted automatically by the daily job (may lag by up to a day).</span> : null}
          </label>
        </>
      ) : null}
      <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
        <input type="checkbox" checked={notifyUser} onChange={(e) => setNotifyUser(e.target.checked)} className="h-4 w-4 accent-[#096B4A]" />
        Notify them (in-app and email)
      </label>
    </ConfirmDialog>
  );
}
