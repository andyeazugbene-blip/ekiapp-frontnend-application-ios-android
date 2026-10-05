"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

export const IDLE_TIMEOUT_MINUTES = 30;
export const IDLE_WARNING_SECONDS = 60;

const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = ["mousedown", "keydown", "touchstart", "scroll", "pointerdown"];
const STORAGE_KEY = "admin_last_activity";

function readLast(): number {
  try {
    const v = Number(window.localStorage.getItem(STORAGE_KEY));
    return Number.isFinite(v) && v > 0 ? v : Date.now();
  } catch {
    return Date.now();
  }
}

/**
 * Client-side idle timeout (handbook §13): after IDLE_TIMEOUT_MINUTES with no
 * interaction (in any open tab — the timestamp is shared via localStorage) the
 * admin is signed out. A warning with a countdown appears for the last minute.
 * This is a browser-side control only; the server has no per-device session
 * table, so the token itself still lives until JWT expiry or tokenVersion bump.
 */
export default function IdleSignOut() {
  const { logout } = useAuth();
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const lastRef = useRef<number>(Date.now());

  useEffect(() => {
    lastRef.current = Date.now();
    try {
      window.localStorage.setItem(STORAGE_KEY, String(lastRef.current));
    } catch {
      /* storage unavailable: fall back to in-memory timestamp */
    }
    let lastWrite = 0;
    const touch = () => {
      const now = Date.now();
      lastRef.current = now;
      if (now - lastWrite > 5000) {
        lastWrite = now;
        try {
          window.localStorage.setItem(STORAGE_KEY, String(now));
        } catch {
          /* ignore */
        }
      }
    };
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, touch, { passive: true }));

    const limitMs = IDLE_TIMEOUT_MINUTES * 60 * 1000;
    const timer = window.setInterval(() => {
      const last = Math.max(lastRef.current, readLast());
      const remaining = limitMs - (Date.now() - last);
      if (remaining <= 0) {
        window.clearInterval(timer);
        logout();
      } else if (remaining <= IDLE_WARNING_SECONDS * 1000) {
        setSecondsLeft(Math.ceil(remaining / 1000));
      } else {
        setSecondsLeft(null);
      }
    }, 1000);

    return () => {
      window.clearInterval(timer);
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, touch));
    };
  }, [logout]);

  if (secondsLeft === null) return null;
  return (
    <div role="alertdialog" aria-live="assertive" aria-label="Session about to expire" className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-black text-[#101820]">Still there?</h2>
        <p className="mt-2 text-sm text-slate-600">
          You have been inactive for a while. For security you will be signed out in <strong>{secondsLeft}s</strong>.
        </p>
        <button
          autoFocus
          onClick={() => {
            lastRef.current = Date.now();
            try {
              window.localStorage.setItem(STORAGE_KEY, String(lastRef.current));
            } catch {
              /* ignore */
            }
            setSecondsLeft(null);
          }}
          className="mt-5 inline-flex h-10 w-full items-center justify-center rounded-xl bg-[#096B4A] px-5 text-sm font-bold text-white hover:bg-[#075a3e]"
        >
          Stay signed in
        </button>
      </div>
    </div>
  );
}
