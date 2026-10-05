"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { APIError } from "@/lib/api";
import { dashboardAPI, SearchGroupKey, SearchResponse, SearchResult } from "@/lib/services/dashboard.api";
import TestBadge from "@/components/TestBadge";

const GROUP_ICONS: Record<SearchGroupKey, string> = {
  users: "M20 21a8 8 0 0 0-16 0M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
  vendors: "M3 9l1.5-5h15L21 9M4 9v11h16V9M9 20v-6h6v6",
  orders: "M8 3h8l1.5 3H20v15H4V6h2.5L8 3ZM8 10h8M8 14h8",
  payments: "M2 6h20v12H2zM2 10h20",
  campaigns: "M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M9.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.85",
  subscriptions: "M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5",
};

function GroupIcon({ type }: { type: SearchGroupKey }) {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={GROUP_ICONS[type]} />
    </svg>
  );
}

/** Header trigger + command-palette modal. Open with Ctrl/Cmd+K or "/". */
export default function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [response, setResponse] = useState<SearchResponse | null>(null);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const requestId = useRef(0);
  const [retryTick, setRetryTick] = useState(0);

  const flat: SearchResult[] = useMemo(() => response?.groups.flatMap((g) => g.results) ?? [], [response]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setResponse(null);
    setError("");
    setActive(0);
  }, []);

  // Global shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      if (e.key === "/" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const t = e.target as HTMLElement | null;
        const typing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
        if (!typing) {
          e.preventDefault();
          setOpen(true);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 20);
  }, [open]);

  // Debounced search; stale responses are ignored.
  const trimmed = query.trim();
  useEffect(() => {
    if (!open) return;
    if (trimmed.length < 2) {
      setResponse(null);
      setError("");
      setLoading(false);
      return;
    }
    const id = ++requestId.current;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await dashboardAPI.search(trimmed);
        if (id !== requestId.current) return;
        setResponse(res);
        setError("");
        setActive(0);
      } catch (err) {
        if (id !== requestId.current) return;
        setResponse(null);
        setError(err instanceof APIError ? err.message : "Search failed. Check your connection and try again.");
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [trimmed, open, retryTick]);

  const go = useCallback((r: SearchResult) => {
    close();
    router.push(r.href);
  }, [close, router]);

  const onInputKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { e.preventDefault(); close(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => (flat.length ? (i + 1) % flat.length : 0)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => (flat.length ? (i - 1 + flat.length) % flat.length : 0)); }
    else if (e.key === "Enter" && flat[active]) { e.preventDefault(); go(flat[active]); }
  };

  useEffect(() => {
    document.getElementById(`gs-opt-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  let optionIndex = -1;
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Search (Ctrl+K)"
        className="flex h-9 min-w-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-[13px] text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 sm:w-64"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
        <span className="hidden flex-1 truncate text-left sm:block">Search users, orders, payments…</span>
        <kbd className="hidden rounded border border-slate-200 bg-slate-50 px-1.5 text-[10px] font-bold text-slate-400 sm:block">Ctrl K</kbd>
      </button>

      {open ? (
        <div className="fixed inset-0 z-[70] flex items-start justify-center bg-slate-950/40 p-4 pt-[12vh]" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
          <div role="dialog" aria-modal="true" aria-label="Global search" className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center gap-2 border-b border-slate-100 px-4">
              <svg viewBox="0 0 24 24" className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onInputKey}
                placeholder="Name, email, order number, payment intent, campaign…"
                aria-label="Search"
                role="combobox"
                aria-expanded={flat.length > 0}
                aria-controls="gs-listbox"
                aria-activedescendant={flat.length ? `gs-opt-${active}` : undefined}
                className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
              />
              <kbd className="rounded border border-slate-200 px-1.5 text-[10px] font-bold text-slate-400">Esc</kbd>
            </div>

            <div id="gs-listbox" role="listbox" className="max-h-[55vh] overflow-y-auto p-2">
              {trimmed.length < 2 ? (
                <p className="px-3 py-8 text-center text-sm text-slate-500">Type at least 2 characters. Use ↑ ↓ to move, Enter to open.</p>
              ) : error ? (
                <div className="px-3 py-6 text-center">
                  <p className="text-sm font-semibold text-red-700">{error}</p>
                  <button onClick={() => setRetryTick((n) => n + 1)} className="mt-2 text-sm font-bold text-[#096B4A] underline">Retry</button>
                </div>
              ) : loading && !response ? (
                <div className="space-y-2 p-2" role="status" aria-label="Searching">
                  {[0, 1, 2].map((i) => <div key={i} className="h-10 animate-pulse rounded-lg bg-slate-100" />)}
                </div>
              ) : response && response.groups.length === 0 ? (
                <p className="px-3 py-8 text-center text-sm text-slate-500">
                  No results for “{response.query}”.
                  {response.restricted.length ? ` Your role cannot search: ${response.restricted.join(", ")}.` : ""}
                </p>
              ) : response ? (
                <>
                  {response.groups.map((g) => (
                    <div key={g.key} className="mb-1">
                      <p className="px-3 pb-1 pt-2 text-[10px] font-black uppercase tracking-wider text-slate-400">{g.label}</p>
                      {g.results.map((r) => {
                        optionIndex += 1;
                        const idx = optionIndex;
                        const on = idx === active;
                        return (
                          <button
                            key={`${r.type}-${r.id}`}
                            id={`gs-opt-${idx}`}
                            role="option"
                            aria-selected={on}
                            onMouseEnter={() => setActive(idx)}
                            onClick={() => go(r)}
                            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition ${on ? "bg-emerald-50" : "hover:bg-slate-50"}`}
                          >
                            <span className={on ? "text-[#096B4A]" : "text-slate-400"}><GroupIcon type={r.type} /></span>
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center gap-2 text-sm font-bold text-[#101820]">
                                <span className="truncate">{r.title}</span>
                                <TestBadge show={r.isTest} />
                              </span>
                              <span className="block truncate text-xs text-slate-500">{r.subtitle}</span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ))}
                  {response.errors.length ? (
                    <p className="px-3 py-2 text-xs font-semibold text-amber-700">Some results are unavailable: {response.errors.join(", ")}.</p>
                  ) : null}
                  {loading ? <p className="px-3 py-1 text-xs text-slate-400">Updating…</p> : null}
                </>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
