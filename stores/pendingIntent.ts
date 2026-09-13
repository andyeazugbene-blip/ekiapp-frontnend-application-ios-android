/**
 * Transient (non-persisted) carrier for "why did this user start vendor
 * onboarding" — set when Hero's Suppliers card sends a brand-new user into
 * the existing vendor registration/setup-store chain, read once by
 * setup-store.tsx to show supplier-framed copy and skip straight to the
 * real supplier application instead of the full retail onboarding chain.
 *
 * Deliberately NOT part of useAuthStore (which is persisted/serialized) —
 * this is a one-shot signal for the current app session only. If the app
 * is killed mid-registration the flag is simply lost and the user lands on
 * the normal vendor flow, which is a safe fallback, not a broken state.
 */
let pendingIntent: "supplier" | null = null;

export function setPendingIntent(intent: "supplier" | null): void {
  pendingIntent = intent;
}

/** Reads and clears in one step so it only ever fires once. */
export function consumePendingIntent(): "supplier" | null {
  const value = pendingIntent;
  pendingIntent = null;
  return value;
}

/**
 * Read-only peek, does NOT clear. register.tsx uses this to show
 * supplier-framed copy during signup — the flag must survive past
 * registration for setup-store.tsx's own consumePendingIntent() call
 * later in the same chain (registration -> OTP -> setup-store), which is
 * the actual one-shot consumer that skips the retail onboarding steps.
 */
export function peekPendingIntent(): "supplier" | null {
  return pendingIntent;
}
