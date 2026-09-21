"use client";

import { useState } from "react";
import { API2FARequiredError, APIError } from "@/lib/api";

/**
 * Acceptance audit fix: a 2FA-gated admin mutation (suspend/unsuspend/
 * delete vendor, etc.) needs the same three things everywhere it's called
 * from — catch API2FARequiredError and prompt for a code, retry with that
 * code, and surface any other failure as a real message instead of an
 * unhandled rejection. This used to be hand-written per call site
 * (correctly on vendors/page.tsx's list view, missing entirely on
 * vendors/[id]/page.tsx's detail view and on both pages' own delete-vendor
 * button) — one shared hook so every call site behaves identically.
 */
export function useTwoFactorAction() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [show2FAModal, setShow2FAModal] = useState(false);
  const [code, setCode] = useState("");
  const [pendingAction, setPendingAction] = useState<((code?: string) => Promise<void>) | null>(null);

  /** Run a 2FA-gated (or not) action. `action` must accept an optional
   * twoFactorCode and pass it straight through to the API call. */
  async function run(action: (code?: string) => Promise<void>): Promise<void> {
    setError("");
    try {
      setLoading(true);
      await action();
    } catch (err) {
      if (err instanceof API2FARequiredError) {
        setPendingAction(() => action);
        setShow2FAModal(true);
      } else {
        setError(err instanceof APIError ? err.message : "Action failed");
      }
    } finally {
      setLoading(false);
    }
  }

  async function submit2FA(): Promise<void> {
    if (!pendingAction || !code) return;
    setError("");
    try {
      setLoading(true);
      await pendingAction(code);
      setShow2FAModal(false);
      setCode("");
      setPendingAction(null);
    } catch (err) {
      setError(err instanceof APIError ? err.message : "2FA action failed");
    } finally {
      setLoading(false);
    }
  }

  function cancel2FA(): void {
    setShow2FAModal(false);
    setCode("");
    setPendingAction(null);
  }

  return { loading, error, setError, show2FAModal, code, setCode, run, submit2FA, cancel2FA };
}
