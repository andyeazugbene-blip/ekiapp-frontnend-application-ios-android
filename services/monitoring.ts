/**
 * Sentry monitoring.
 *
 * DSN is a hardcoded literal, not routed through process.env.EXPO_PUBLIC_*:
 * found 19 Oct 2026, by diffing a from-scratch `expo export` against its own
 * sourcemap, that this codebase's env-var inlining is unreliable for SOME
 * EXPO_PUBLIC_ vars in a given build (confirmed independent of Sentry —
 * EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY was *also* missing from a fresh export
 * while EXPO_PUBLIC_API_URL was present in the same bundle) — not worth
 * chasing further here since a Sentry DSN is a public client key by design
 * (ingest-only, cannot read data), so there's no reason to route it through
 * an env var at all. Sidesteps the whole class of build-pipeline risk.
 *
 * Lazy-required (same pattern as components/providers/StripeProvider.tsx):
 * @sentry/react-native's native module isn't available in Expo Go, and may
 * not be compiled into an older already-shipped build either. Ships via
 * OTA — JS-level error capture (ReactNativeErrorHandlers, global unhandled-
 * rejection handler) works over plain HTTP regardless of whether the
 * native module is present; only native-crash capture and device-context
 * enrichment need it. The goal this was first wired up for (19 Oct 2026):
 * capturing the actual JS error/stack behind a production crash that a
 * device .ips alone didn't carry (Expo's own native error-recovery
 * re-throws the original JS error and aborts, but the .ips has only
 * stripped native frames — Sentry's JS-level handler catches it BEFORE
 * that re-throw).
 */
import { setApiErrorReporter } from "./api";

// Public client key — safe to hardcode (ingest-only, not a credential that
// grants read access). See module comment above for why this isn't routed
// through EXPO_PUBLIC_SENTRY_DSN.
const SENTRY_DSN = "https://ac20f4553b0f36d871b191d2ff4815b3@o4512283283423232.ingest.de.sentry.io/4512283346010192";

let initialized = false;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let SentryModule: any = null;

function loadSentry(): any {
  if (SentryModule !== null) return SentryModule;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    SentryModule = require("@sentry/react-native");
  } catch {
    SentryModule = false;
  }
  return SentryModule;
}

export function initMonitoring() {
  if (initialized) return;

  const enableInDev = process.env.EXPO_PUBLIC_SENTRY_ENABLE_DEV === "true";
  if (__DEV__ && !enableInDev) return;

  const Sentry = loadSentry();
  if (!Sentry) return; // native module unavailable (Expo Go, or not in this build) — stay a no-op, same as before

  // Sentry.init() itself was never guarded — if it throws (e.g. the
  // native module is only partially linked in this build), that's an
  // UNCAUGHT error at module-init time, which is exactly the "fatal
  // error during early launch" pattern this was wired up to diagnose in
  // the first place. Never let setting up monitoring be what crashes
  // the app it's monitoring.
  try {
    Sentry.init({
      dsn: SENTRY_DSN,
      sendDefaultPii: false,
      tracesSampleRate: 0.2,
      enableNativeFramesTracking: false,
      environment: __DEV__ ? "development" : "production",
      // Shares a Sentry project with the backend (same org, one DSN for
      // both) — this tag is how mobile events stay distinguishable from
      // backend events in that shared Issues list.
      initialScope: { tags: { app: "mobile" } },
    });

    initialized = true;

    setApiErrorReporter((err, context) => {
      captureException(err, context);
    });

    // TEMP sanity check (19 Oct 2026): confirms the SDK is actually
    // connecting at all, independent of whether any specific crash gets
    // captured. Remove once a real event has been confirmed in the
    // dashboard — search Sentry for "sentry_init_check" to find it.
    Sentry.captureMessage("sentry_init_check: mobile monitoring initialized", "info");
  } catch {
    initialized = false;
  }
}

export function captureException(err: unknown, context?: Record<string, unknown>) {
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.warn("[monitoring] captureException:", err);
  }
  const Sentry = loadSentry();
  if (!Sentry || !initialized) return;
  Sentry.captureException(err, context ? { extra: context } : undefined);
}

export function setMonitoringUser(user: { id: string; role?: string } | null) {
  const Sentry = loadSentry();
  if (!Sentry || !initialized) return;
  Sentry.setUser(user ? { id: user.id, role: user.role } : null);
}

/**
 * Wraps the root component so Sentry can capture React render errors and
 * tag the native app-start trace. A no-op passthrough when Sentry isn't
 * initialized (DSN unset, Expo Go, or native module unavailable).
 */
export function wrapRootComponent<T>(component: T): T {
  const Sentry = loadSentry();
  if (!Sentry || !initialized) return component;
  try {
    return Sentry.wrap(component);
  } catch {
    return component;
  }
}
