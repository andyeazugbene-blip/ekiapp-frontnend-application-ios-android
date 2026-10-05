"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { PERMISSION_DENIED_EVENT, setTwoFactorPrompter } from "@/lib/api";
import { usePermissions } from "@/lib/hooks/usePermissions";
import AdminLayout from "@/components/AdminLayout";
import IdleSignOut from "@/components/IdleSignOut";

/** Shown when the API refuses a page load with ADMIN_PERMISSION_DENIED. */
export function PermissionDeniedPanel({ message }: { message?: string }) {
  return (
    <div role="alert" className="mx-auto mt-16 max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-2xl text-amber-600" aria-hidden="true">
        &#128274;
      </div>
      <h1 className="mt-5 text-xl font-black text-[#101820]">You don&apos;t have access to this module</h1>
      <p className="mt-2 text-sm text-slate-600">
        Your admin role does not include the permission this page needs. Nothing is wrong with your account or session.
      </p>
      {message ? <p className="mt-2 text-xs text-slate-400">{message}</p> : null}
      <p className="mt-2 text-sm text-slate-600">Ask a Super Administrator to review your role in Settings, Team &amp; Roles.</p>
      <Link
        href="/dashboard"
        className="mt-6 inline-flex h-10 items-center justify-center rounded-xl border border-[#096B4A] bg-white px-5 text-sm font-bold text-[#096B4A] hover:bg-emerald-50"
      >
        Back to dashboard
      </Link>
    </div>
  );
}

/** Modal that collects a TOTP/backup code for any 2FA-gated request (see api.ts setTwoFactorPrompter). */
function TwoFactorPromptHost() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | undefined>();
  const [code, setCode] = useState("");
  const resolver = useRef<((code: string | null) => void) | null>(null);

  useEffect(() => {
    setTwoFactorPrompter((msg) => {
      return new Promise<string | null>((resolve) => {
        resolver.current?.(null);
        resolver.current = resolve;
        setMessage(msg);
        setCode("");
        setOpen(true);
      });
    });
    return () => setTwoFactorPrompter(null);
  }, []);

  function finish(value: string | null) {
    resolver.current?.(value);
    resolver.current = null;
    setOpen(false);
    setCode("");
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (code.trim()) finish(code.trim());
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="twofa-title">
      <form onSubmit={onSubmit} className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h2 id="twofa-title" className="text-lg font-black text-[#101820]">Confirm with your authenticator</h2>
        <p className="mt-2 text-sm text-slate-600">
          This action needs a fresh two-factor code. Enter the 6-digit code from your authenticator app, or one of your backup codes.
        </p>
        {message && message !== "2FA code required in x-2fa-code header" ? <p className="mt-1 text-xs text-slate-400">{message}</p> : null}
        <label htmlFor="twofa-code" className="mt-4 block text-sm font-bold text-[#101820]">Authentication code</label>
        <input
          id="twofa-code"
          autoFocus
          autoComplete="one-time-code"
          inputMode="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="mt-1 h-11 w-full rounded-xl border border-slate-300 px-3 text-lg tracking-widest outline-none focus:border-[#096B4A] focus:ring-4 focus:ring-emerald-50"
          placeholder="123456"
        />
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={() => finish(null)} className="h-10 rounded-xl border border-slate-300 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50">
            Cancel
          </button>
          <button type="submit" disabled={!code.trim()} className="h-10 rounded-xl bg-[#096B4A] px-5 text-sm font-bold text-white hover:bg-[#075a3e] disabled:opacity-50">
            Confirm
          </button>
        </div>
      </form>
    </div>
  );
}

export default function ProtectedRoute({
  children,
  allowUnenrolled = false,
}: {
  children: React.ReactNode;
  /** Only the 2FA enrolment page sets this, so it is reachable before 2FA exists. */
  allowUnenrolled?: boolean;
}) {
  const { user, loading, isAdmin, authError, retryAuth } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { access } = usePermissions();
  const [denied, setDenied] = useState<{ message?: string } | null>(null);

  useEffect(() => {
    // Only redirect once we're sure there's genuinely no session — never
    // while a transient authError is pending, since the token (and the
    // session it represents) may still be perfectly valid.
    if (!loading && !authError) {
      if (!user) {
        router.replace("/login");
      } else if (!isAdmin) {
        router.replace("/forbidden");
      }
    }
  }, [user, loading, isAdmin, authError, router]);

  // Mandatory 2FA: force enrolment before any module is usable.
  useEffect(() => {
    if (!allowUnenrolled && access?.twoFactor.setupRequired) {
      router.replace("/security/setup");
    }
  }, [access, allowUnenrolled, router]);

  // A fresh navigation clears a previous permission-denied state.
  useEffect(() => {
    setDenied(null);
  }, [pathname]);

  useEffect(() => {
    const onDenied = (event: Event) => {
      const detail = (event as CustomEvent<{ message?: string; endpoint?: string }>).detail;
      // Multi-widget pages (dashboard) and ambient lookups (search, action centre) must
      // degrade per-widget instead of replacing the whole page.
      const path = window.location.pathname;
      if (path === "/dashboard" || path === "/") return;
      if (/search|action-centre|action_centre|\/me\/permissions/i.test(detail?.endpoint ?? "")) return;
      setDenied({ message: detail?.message });
    };
    window.addEventListener(PERMISSION_DENIED_EVENT, onDenied);
    return () => window.removeEventListener(PERMISSION_DENIED_EVENT, onDenied);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (authError && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <p className="text-sm font-semibold text-red-600">{authError}</p>
          <p className="mt-1 text-sm text-slate-500">Your session couldn&apos;t be confirmed — this doesn&apos;t mean you&apos;re logged out.</p>
          <button
            onClick={retryAuth}
            className="mt-4 inline-flex h-10 items-center justify-center rounded-xl border border-[#096B4A] bg-white px-5 text-sm font-bold text-[#096B4A] hover:bg-emerald-50"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return null;
  }

  return (
    <>
      <TwoFactorPromptHost />
      <IdleSignOut />
      {denied ? (
        <AdminLayout>
          <PermissionDeniedPanel message={denied.message} />
        </AdminLayout>
      ) : (
        children
      )}
    </>
  );
}
