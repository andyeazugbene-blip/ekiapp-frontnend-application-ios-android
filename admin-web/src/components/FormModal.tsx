"use client";

import { ReactNode, useEffect } from "react";
import { Button, Card } from "@/components/AdminUI";

/** Accessible modal wrapper for create/edit forms (the form state lives in the caller). */
export function FormModal({
  open, title, description, submitLabel = "Save", onSubmit, onClose, canSubmit = true, loading, error, children, wide,
}: {
  open: boolean;
  title: string;
  description?: ReactNode;
  submitLabel?: string;
  onSubmit: () => void | Promise<void>;
  onClose: () => void;
  canSubmit?: boolean;
  loading?: boolean;
  error?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !loading) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, loading, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/40 p-4" role="dialog" aria-modal="true" aria-label={title}>
      <Card className={`my-8 w-full ${wide ? "max-w-3xl" : "max-w-xl"}`}>
        <h3 className="text-xl font-black text-[#101820]">{title}</h3>
        {description ? <div className="mt-1 text-sm text-slate-600">{description}</div> : null}
        <form
          className="mt-4 space-y-4"
          onSubmit={(e) => { e.preventDefault(); if (canSubmit && !loading) void onSubmit(); }}
        >
          {children}
          {error ? <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{error}</div> : null}
          <div className="flex gap-3 pt-1">
            <Button type="submit" className="flex-1" disabled={!canSubmit || loading}>{loading ? "Working…" : submitLabel}</Button>
            <Button type="button" variant="ghost" className="flex-1" disabled={loading} onClick={onClose}>Close</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</span>
      <div className="mt-1">{children}</div>
      {hint ? <span className="mt-1 block text-xs font-semibold text-slate-500">{hint}</span> : null}
    </label>
  );
}

export const inputClass = "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#096B4A]";
export const textareaClass = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#096B4A]";
