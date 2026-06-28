"use client";

import Link from "next/link";
import { ReactNode } from "react";

export const brandGreen = "#096B4A";

export function EkiMark({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-[#096B4A] text-white shadow-sm">
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 8h12l-1 12H7L6 8Z" fill="currentColor" stroke="none" opacity=".95" />
          <path d="M9 8V6a3 3 0 0 1 6 0v2" />
          <path d="M10 14h4" stroke="#fff" />
        </svg>
      </div>
      <span className="text-3xl font-black tracking-tight text-[#101820]">Eki</span>
    </div>
  );
}

export function Icon({ name, className = "h-5 w-5" }: { name: string; className?: string }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const paths: Record<string, ReactNode> = {
    overview: <><path d="M3 11.5 12 4l9 7.5" /><path d="M5.5 10.5V20h13v-9.5" /><path d="M9 20v-6h6v6" /></>,
    vendors: <><path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" /><path d="M9.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" /><path d="M22 21v-2a4 4 0 0 0-3-3.85" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>,
    orders: <><path d="M8 3h8l1.5 3H20v15H4V6h2.5L8 3Z" /><path d="M8 10h8" /><path d="M8 14h8" /><path d="M8 18h5" /></>,
    disputes: <><path d="m12 3 8 4v6c0 5-3.4 7.5-8 8-4.6-.5-8-3-8-8V7l8-4Z" /><path d="M12 8v5" /><path d="M12 17h.01" /></>,
    verification: <><path d="m12 3 8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7l8-4Z" /><path d="m8.5 12.5 2.3 2.3 4.8-5.2" /></>,
    messages: <><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8Z" /><path d="M8 9h8" /><path d="M8 13h5" /></>,
    communication: <><path d="M4 11v2a3 3 0 0 0 3 3h1l5 4v-4h4a3 3 0 0 0 3-3v-2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /><path d="M3 11h18" /></>,
    analytics: <><path d="M4 19V5" /><path d="M4 19h17" /><path d="M8 16v-5" /><path d="M12 16V8" /><path d="M16 16v-3" /><path d="M20 16V7" /></>,
    settings: <><path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06-2 3.46-.08-.02a1.65 1.65 0 0 0-1.82.33 1.65 1.65 0 0 0-.49 1.18H8.6a1.65 1.65 0 0 0-2.39-1.49l-2-3.46.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1-.75v-4.5a1.65 1.65 0 0 0 1-.75 1.65 1.65 0 0 0-.33-1.82l-.06-.06 2-3.46.08.02A1.65 1.65 0 0 0 8.6 2.17h6.8a1.65 1.65 0 0 0 2.39 1.49l2 3.46-.06.06A1.65 1.65 0 0 0 19.4 9c.2.36.55.63 1 .75v4.5c-.45.12-.8.39-1 .75Z" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
    export: <><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" /></>,
    plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
    calendar: <><path d="M7 3v4" /><path d="M17 3v4" /><path d="M4 9h16" /><path d="M5 5h14v16H5z" /></>,
    arrow: <><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    user: <><path d="M20 21a8 8 0 0 0-16 0" /><circle cx="12" cy="7" r="4" /></>,
    money: <><path d="M12 2v20" /><path d="M17 6.5A4 4 0 0 0 12 5c-2.2 0-4 1-4 2.8s1.6 2.4 4 3.2 4 1.4 4 3.2S14.2 17 12 17a5 5 0 0 1-5-2" /></>,
    trending: <><path d="M22 7l-8.5 8.5-5-5L2 17" /><path d="M16 7h6v6" /></>,
    cash: <><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="3" /><path d="M6 12h.01" /><path d="M18 12h.01" /></>,
    wallet: <><path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4" /><path d="M4 6v12a2 2 0 0 0 2 2h14v-4" /><path d="M18 12a2 2 0 0 0 0 4h4v-4h-4Z" /></>,
    sent: <><path d="M22 2 11 13" /><path d="M22 2 15 22l-4-9-9-4 20-7Z" /></>,
    profit: <><path d="M12 2v20" /><path d="m17 7-5-5-5 5" /><path d="M5 19h14" /></>,
    refresh: <><path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" /><path d="M3 21v-5h5" /></>,
    warning: <><path d="M12 9v4" /><path d="M12 17h.01" /><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" /></>,
    chevronUp: <path d="m18 15-6-6-6 6" />,
    chevronDown: <path d="m6 9 6 6 6-6" />,
    products: <><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><circle cx="7" cy="7" r="1" /></>,
    shield: <><path d="m12 3 8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7l8-4Z" /></>,
    mail: <><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></>,
  };
  return <svg viewBox="0 0 24 24" className={className} {...common}>{paths[name] ?? paths.overview}</svg>;
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
      <div>
        <h1 className="text-4xl font-black tracking-[-0.02em] text-[#101820]">{title}</h1>
        {subtitle ? <p className="mt-3 text-base text-slate-600">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-[20px] border border-slate-200/80 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.04)] ${className}`}>{children}</section>;
}

export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" | "ghost" }) {
  const variants = {
    primary: "border-[#096B4A] bg-[#096B4A] text-white hover:bg-[#07583d]",
    secondary: "border-[#096B4A] bg-white text-[#096B4A] hover:bg-emerald-50",
    danger: "border-red-500 bg-red-500 text-white hover:bg-red-600",
    ghost: "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
  };
  return (
    <button
      {...props}
      className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl border px-5 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-55 ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function Badge({ children, tone = "green" }: { children: ReactNode; tone?: "green" | "amber" | "red" | "blue" | "gray" }) {
  const tones = {
    green: "bg-emerald-50 text-[#096B4A] ring-emerald-100",
    amber: "bg-amber-50 text-amber-700 ring-amber-100",
    red: "bg-red-50 text-red-700 ring-red-100",
    blue: "bg-sky-50 text-sky-700 ring-sky-100",
    gray: "bg-slate-100 text-slate-600 ring-slate-200",
  };
  return <span className={`inline-flex items-center rounded-lg px-3 py-1 text-xs font-bold ring-1 ${tones[tone]}`}>{children}</span>;
}

export function MetricCard({
  icon,
  label,
  value,
  note,
  tone = "green",
}: {
  icon: string;
  label: string;
  value: ReactNode;
  note?: ReactNode;
  tone?: "green" | "amber" | "red" | "blue";
}) {
  const tones = {
    green: "bg-emerald-50 text-[#096B4A]",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-red-50 text-red-700",
    blue: "bg-sky-50 text-sky-700",
  };
  return (
    <Card className="min-h-[160px]">
      <div className={`flex h-16 w-16 items-center justify-center rounded-full ${tones[tone]}`}>
        <Icon name={icon} className="h-8 w-8" />
      </div>
      <p className="mt-6 text-base text-slate-600">{label}</p>
      <p className="mt-3 text-4xl font-black tracking-tight text-[#101820]">{value}</p>
      {note ? <p className="mt-3 text-sm font-semibold text-[#096B4A]">{note}</p> : null}
    </Card>
  );
}

export function EmptyState({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <Card className="py-12 text-center">
      <p className="text-base font-semibold text-slate-700">{title}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </Card>
  );
}

export function LoadingPanel({ label = "Loading live data..." }: { label?: string }) {
  return (
    <Card className="flex h-64 items-center justify-center">
      <div className="text-center">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-[#096B4A]" />
        <p className="mt-4 text-sm font-semibold text-slate-500">{label}</p>
      </div>
    </Card>
  );
}

export function ErrorPanel({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
      {message}
      {onRetry ? <button onClick={onRetry} className="ml-4 underline">Retry</button> : null}
    </div>
  );
}

export function TextLink({ href, children }: { href: string; children: ReactNode }) {
  return <Link href={href} className="inline-flex items-center gap-2 text-sm font-bold text-[#096B4A] hover:underline">{children}</Link>;
}

export function downloadCsv(filename: string, rows: Array<Record<string, unknown>>) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const escapeCell = (value: unknown) => {
    const text = value == null ? "" : String(value);
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const csv = [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => escapeCell(row[header])).join(",")),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
