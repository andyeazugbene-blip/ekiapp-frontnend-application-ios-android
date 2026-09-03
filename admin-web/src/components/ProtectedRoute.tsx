"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, isAdmin, authError, retryAuth } = useAuth();
  const router = useRouter();

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

  return <>{children}</>;
}
