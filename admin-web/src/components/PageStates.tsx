"use client";

import Link from "next/link";
import { Component, ErrorInfo, ReactNode } from "react";

/** Shared page-level states: skeleton loading, 403 "no access", error boundary with retry. */

export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-xl bg-slate-200/70 ${className}`} />;
}

export function SkeletonTiles({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4" role="status" aria-label="Loading">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-slate-200 bg-white p-4">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-3 h-8 w-16" />
          <Skeleton className="mt-3 h-3 w-32" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonRows({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-2" role="status" aria-label="Loading">
      {Array.from({ length: count }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
    </div>
  );
}

/** 403 state. Pass `what` to name the area the admin cannot open. */
export function NoAccess({ what = "this area" }: { what?: string }) {
  return (
    <div role="alert" className="mx-auto mt-10 max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-700">
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" />
        </svg>
      </div>
      <h2 className="mt-4 text-xl font-black text-[#101820]">No access</h2>
      <p className="mt-2 text-sm text-slate-600">
        Your admin role does not include permission to view {what}. Ask a Super Administrator to update your role if you need it.
      </p>
      <Link href="/dashboard" className="mt-5 inline-flex h-10 items-center rounded-xl border border-[#096B4A] px-4 text-sm font-bold text-[#096B4A] hover:bg-emerald-50">
        Back to Overview
      </Link>
    </div>
  );
}

interface BoundaryProps { children: ReactNode; resetKey?: string }
interface BoundaryState { error: Error | null }

/** Catches render errors in a page; Retry re-mounts the subtree. Resets on route change via resetKey. */
export class PageErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error("Admin page crashed", error, info.componentStack);
  }

  componentDidUpdate(prev: BoundaryProps) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" className="mx-auto mt-10 max-w-lg rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
        <h2 className="text-lg font-black text-red-800">Something went wrong on this page</h2>
        <p className="mt-2 text-sm text-red-700">{this.state.error.message || "An unexpected error occurred."}</p>
        <button
          onClick={() => this.setState({ error: null })}
          className="mt-4 inline-flex h-10 items-center rounded-xl border border-red-300 bg-white px-5 text-sm font-bold text-red-700 hover:bg-red-100"
        >
          Retry
        </button>
      </div>
    );
  }
}
