"use client";

/**
 * Shared admin primitives required by the Implementation & Acceptance
 * Handbook (§2.1): confirmation WITH a required reason, consistent search /
 * filter / pagination, explicit timezone on dates, honest empty/error states,
 * and drill-down tiles. Pages import from here instead of hand-rolling
 * window.confirm / window.prompt.
 */

import Link from "next/link";
import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { Badge, Button, Card, Icon } from "@/components/AdminUI";

// ─── Dates / money / ids ────────────────────────────────────────────────────

/** Handbook §2.1 L137: dates always show their timezone. */
export function formatDateTime(value?: string | Date | null): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    year: "numeric", month: "short", day: "2-digit",
    hour: "2-digit", minute: "2-digit", timeZoneName: "short",
  });
}

/** Calendar date pinned to UTC (reconciliation periods, day buckets). Callers add a "UTC" label. */
export function formatDateUtc(value?: string | Date | null): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit", timeZone: "UTC" });
}

export function formatDate(value?: string | Date | null): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
}

/** Original-currency money (never silently converted). Minor units in. */
export function formatMinor(amountMinor?: number | null, currency?: string | null): string {
  if (amountMinor == null) return "—";
  const code = (currency || "EUR").toUpperCase();
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: code }).format(amountMinor / 100);
  } catch {
    return `${(amountMinor / 100).toFixed(2)} ${code}`;
  }
}

/** Same as formatMinor but for values already divided into major units by a service normaliser. */
export function formatMajor(amountMajor?: number | null, currency?: string | null): string {
  if (amountMajor == null || !Number.isFinite(amountMajor)) return "—";
  return formatMinor(Math.round(amountMajor * 100), currency);
}

/** Totals per currency, e.g. "GBP 12.00 · EUR 4.00". Never sums across currencies. */
export function sumByCurrency<T>(rows: T[], amountMinor: (r: T) => number, currency: (r: T) => string | null | undefined): Array<{ currency: string; amountMinor: number }> {
  const m = new Map<string, number>();
  for (const r of rows) {
    const c = (currency(r) || "EUR").toUpperCase();
    m.set(c, (m.get(c) ?? 0) + amountMinor(r));
  }
  return [...m.entries()].map(([c, a]) => ({ currency: c, amountMinor: a })).sort((a, b) => a.currency.localeCompare(b.currency));
}

export function formatTotals(totals: Array<{ currency: string; amountMinor: number }>): string {
  return totals.length === 0 ? "—" : totals.map((t) => formatMinor(t.amountMinor, t.currency)).join(" · ");
}

export function timeAgo(value?: string | Date | null): string {
  if (!value) return "—";
  const ms = Date.now() - new Date(value).getTime();
  if (Number.isNaN(ms)) return "—";
  const m = Math.floor(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return formatDate(value);
}

/** Stripe Dashboard deep link; test/live inferred from the object id? No —
 * ids don't encode mode. `livemode` defaults to the env flag. */
export function stripeDashboardUrl(
  kind: "payment" | "account" | "identity" | "dispute" | "transfer",
  id?: string | null,
  livemode = process.env.NEXT_PUBLIC_STRIPE_LIVEMODE === "true",
): string | null {
  if (!id) return null;
  const base = `https://dashboard.stripe.com${livemode ? "" : "/test"}`;
  switch (kind) {
    case "payment": return `${base}/payments/${id}`;
    case "account": return `${base}/connect/accounts/${id}`;
    case "identity": return `${base}/identity/verification-sessions/${id}`;
    case "dispute": return `${base}/disputes/${id}`;
    case "transfer": return `${base}/connect/transfers/${id}`;
  }
}

export function ExternalLink({ href, children }: { href: string | null; children: ReactNode }) {
  if (!href) return null;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-bold text-[#096B4A] hover:underline">
      {children}
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 17 17 7M8 7h9v9" /></svg>
    </a>
  );
}

// ─── Banners ────────────────────────────────────────────────────────────────

export function Banner({
  tone = "info", title, children,
}: { tone?: "info" | "warning" | "danger" | "success"; title?: string; children?: ReactNode }) {
  const tones = {
    info: "border-sky-200 bg-sky-50 text-sky-900",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
    danger: "border-red-200 bg-red-50 text-red-900",
    success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  };
  return (
    <div role="status" className={`rounded-2xl border px-4 py-3 text-sm ${tones[tone]}`}>
      {title ? <p className="font-black">{title}</p> : null}
      {children ? <div className={title ? "mt-1 font-medium" : "font-semibold"}>{children}</div> : null}
    </div>
  );
}

// ─── Confirm dialog with required reason ────────────────────────────────────

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  tone?: "danger" | "primary";
  /** Handbook §2.1 L138: high-impact actions need a reason. Default true. */
  requireReason?: boolean;
  reasonLabel?: string;
  minReasonLength?: number;
  /** Extra form fields rendered under the reason box. */
  children?: ReactNode;
  loading?: boolean;
  error?: string;
  onConfirm: (reason: string) => void | Promise<void>;
  onCancel: () => void;
}

export function ConfirmDialog({
  open, title, description, confirmLabel = "Confirm", tone = "danger",
  requireReason = true, reasonLabel = "Reason (recorded in the audit log)", minReasonLength = 5,
  children, loading, error, onConfirm, onCancel,
}: ConfirmDialogProps) {
  const [reason, setReason] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (open) { setReason(""); setTimeout(() => ref.current?.focus(), 30); }
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !loading) onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, loading, onCancel]);
  if (!open) return null;
  const trimmed = reason.trim();
  const reasonOk = !requireReason || trimmed.length >= minReasonLength;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" role="dialog" aria-modal="true" aria-label={title}>
      <Card className="w-full max-w-lg">
        <div className="flex items-start gap-3">
          <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${tone === "danger" ? "bg-red-50 text-red-600" : "bg-emerald-50 text-[#096B4A]"}`}>
            <Icon name="warning" className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-xl font-black text-[#101820]">{title}</h3>
            {description ? <div className="mt-1 text-sm text-slate-600">{description}</div> : null}
          </div>
        </div>
        {children ? <div className="mt-4 space-y-3">{children}</div> : null}
        {requireReason ? (
          <label className="mt-4 block">
            <span className="text-xs font-black uppercase tracking-wide text-slate-500">{reasonLabel}</span>
            <textarea
              ref={ref}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              maxLength={500}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#096B4A]"
              placeholder={`At least ${minReasonLength} characters`}
            />
          </label>
        ) : null}
        {error ? <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">{error}</div> : null}
        <div className="mt-5 flex gap-3">
          <Button className="flex-1" variant={tone === "danger" ? "danger" : "primary"} disabled={loading || !reasonOk} onClick={() => onConfirm(trimmed)}>
            {loading ? "Working…" : confirmLabel}
          </Button>
          <Button className="flex-1" variant="ghost" disabled={loading} onClick={onCancel}>Cancel</Button>
        </div>
      </Card>
    </div>
  );
}

/**
 * Convenience hook: `const c = useConfirm(); c.ask({...}, (reason) => api(reason))`
 * then render `{c.dialog}` once in the page.
 */
export function useConfirm() {
  const [cfg, setCfg] = useState<(Omit<ConfirmDialogProps, "open" | "onConfirm" | "onCancel" | "loading" | "error"> & { run: (reason: string) => Promise<void> }) | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const ask = useCallback(
    (
      props: Omit<ConfirmDialogProps, "open" | "onConfirm" | "onCancel" | "loading" | "error">,
      run: (reason: string) => Promise<void>,
    ) => { setError(""); setCfg({ ...props, run }); },
    [],
  );

  const dialog = (
    <ConfirmDialog
      {...(cfg ?? { title: "" })}
      open={!!cfg}
      loading={loading}
      error={error}
      onCancel={() => { if (!loading) setCfg(null); }}
      onConfirm={async (reason) => {
        if (!cfg) return;
        setLoading(true); setError("");
        try { await cfg.run(reason); setCfg(null); }
        catch (e) { setError(e instanceof Error ? e.message : "Action failed"); }
        finally { setLoading(false); }
      }}
    />
  );
  return { ask, dialog };
}

// ─── List primitives ────────────────────────────────────────────────────────

export function SearchInput({
  value, onChange, placeholder = "Search…", debounceMs = 300,
}: { value: string; onChange: (v: string) => void; placeholder?: string; debounceMs?: number }) {
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);
  useEffect(() => {
    if (local === value) return;
    const t = setTimeout(() => onChange(local), debounceMs);
    return () => clearTimeout(t);
  }, [local, value, onChange, debounceMs]);
  return (
    <label className="relative block min-w-[220px] flex-1">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><Icon name="search" className="h-4 w-4" /></span>
      <input
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-[#096B4A]"
      />
    </label>
  );
}

export function FilterSelect({
  label, value, onChange, options,
}: { label: string; value: string; onChange: (v: string) => void; options: Array<{ value: string; label: string }> }) {
  return (
    <label className="block">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-[#096B4A]"
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

/** Tab strip with counts; drives a URL/state filter. */
export function StatusTabs({
  tabs, active, onChange,
}: { tabs: Array<{ key: string; label: string; count?: number | null }>; active: string; onChange: (key: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2" role="tablist">
      {tabs.map((t) => {
        const on = t.key === active;
        return (
          <button
            key={t.key}
            role="tab"
            aria-selected={on}
            onClick={() => onChange(t.key)}
            className={`rounded-xl border px-4 py-2 text-sm font-bold transition ${on ? "border-[#096B4A] bg-[#096B4A] text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}
          >
            {t.label}{t.count != null ? <span className={`ml-2 rounded-md px-1.5 py-0.5 text-xs ${on ? "bg-white/20" : "bg-slate-100 text-slate-600"}`}>{t.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

export function Pagination({
  hasPrev, hasNext, onPrev, onNext, shown, total, loading,
}: { hasPrev: boolean; hasNext: boolean; onPrev: () => void; onNext: () => void; shown: number; total?: number | null; loading?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 pt-3 text-sm text-slate-600">
      <span>{total != null ? `Showing ${shown} of ${total}` : `Showing ${shown}`}</span>
      <div className="flex gap-2">
        <Button variant="ghost" className="h-9 px-3" disabled={!hasPrev || loading} onClick={onPrev}>Previous</Button>
        <Button variant="ghost" className="h-9 px-3" disabled={!hasNext || loading} onClick={onNext}>Next</Button>
      </div>
    </div>
  );
}

export interface Column<T> {
  key: string;
  header: string;
  className?: string;
  render: (row: T) => ReactNode;
}

export function DataTable<T>({
  columns, rows, rowKey, onRowClick, emptyTitle = "Nothing to show", loading,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  emptyTitle?: string;
  loading?: boolean;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs font-black uppercase tracking-wide text-slate-500">
          <tr>{columns.map((c) => <th key={c.key} scope="col" className={`px-4 py-3 ${c.className ?? ""}`}>{c.header}</th>)}</tr>
        </thead>
        <tbody className={loading ? "opacity-50" : ""}>
          {rows.length === 0 ? (
            <tr><td colSpan={columns.length} className="px-4 py-12 text-center font-semibold text-slate-500">{emptyTitle}</td></tr>
          ) : rows.map((r) => (
            <tr
              key={rowKey(r)}
              onClick={onRowClick ? () => onRowClick(r) : undefined}
              className={`border-t border-slate-100 ${onRowClick ? "cursor-pointer hover:bg-slate-50" : ""}`}
            >
              {columns.map((c) => <td key={c.key} className={`px-4 py-3 align-middle ${c.className ?? ""}`}>{c.render(r)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Drill-down tile (Action Centre) ────────────────────────────────────────

export function QueueTile({
  label, value, hint, href, tone = "gray", unavailable,
}: {
  label: string; value: ReactNode; hint?: ReactNode; href?: string;
  tone?: "gray" | "red" | "amber" | "green" | "blue"; unavailable?: boolean;
}) {
  const ring = { gray: "border-slate-200", red: "border-red-200", amber: "border-amber-200", green: "border-emerald-200", blue: "border-sky-200" }[tone];
  const body = (
    <div className={`h-full rounded-2xl border bg-white p-4 transition ${ring} ${href ? "hover:shadow-md" : ""}`}>
      <p className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-black text-[#101820]">{unavailable ? "—" : value}</p>
      {hint ? <p className="mt-1 text-xs font-semibold text-slate-500">{unavailable ? "Data unavailable" : hint}</p> : null}
    </div>
  );
  return href && !unavailable ? <Link href={href} className="block">{body}</Link> : body;
}

/** Pill showing provider-owned vs Eki-owned facts side by side. */
export function StatusPill({ label, tone }: { label: string; tone: "green" | "amber" | "red" | "blue" | "gray" }) {
  return <Badge tone={tone}>{label}</Badge>;
}

export function KeyValue({ items }: { items: Array<{ label: string; value: ReactNode }> }) {
  return (
    <dl className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
      {items.map((i) => (
        <div key={i.label}>
          <dt className="text-xs font-black uppercase tracking-wide text-slate-500">{i.label}</dt>
          <dd className="mt-0.5 text-sm font-semibold text-slate-900">{i.value ?? "Not provided"}</dd>
        </div>
      ))}
    </dl>
  );
}
