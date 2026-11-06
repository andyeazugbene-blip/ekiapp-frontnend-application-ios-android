"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/AdminUI";

type View = { name: string; query: string };

function read(key: string): View[] {
  try {
    const raw = window.localStorage.getItem(key);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as View[]) : [];
  } catch {
    return [];
  }
}

function write(key: string, views: View[]) {
  try {
    window.localStorage.setItem(key, JSON.stringify(views));
  } catch {
    // Storage is off in this browser. The views still work until the page reloads.
  }
}

/** Handbook 13: an admin keeps the filters they use often. Saved in this browser only. */
export default function SavedViews() {
  const pathname = usePathname();
  const router = useRouter();
  const key = `admin_saved_views:${pathname}`;
  const [views, setViews] = useState<View[]>([]);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");

  useEffect(() => setViews(read(key)), [key]);

  const save = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const next = [...views.filter((view) => view.name !== trimmed), { name: trimmed, query: window.location.search }];
    setViews(next);
    write(key, next);
    setName("");
    setNaming(false);
  };

  const remove = (target: string) => {
    const next = views.filter((view) => view.name !== target);
    setViews(next);
    write(key, next);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {views.map((view) => (
        <span key={view.name} className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-sm font-semibold">
          <button type="button" onClick={() => router.replace(`${pathname}${view.query}`)}>{view.name}</button>
          <button type="button" aria-label={`Delete saved view ${view.name}`} className="text-slate-400 hover:text-slate-700" onClick={() => remove(view.name)}>×</button>
        </span>
      ))}
      {naming ? (
        <>
          <input
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter") save(); }}
            placeholder="Name this view"
            aria-label="Name this view"
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
          />
          <Button variant="secondary" onClick={save}>Save</Button>
          <Button variant="ghost" onClick={() => setNaming(false)}>Cancel</Button>
        </>
      ) : (
        <Button variant="ghost" onClick={() => setNaming(true)}>Save this view</Button>
      )}
    </div>
  );
}
