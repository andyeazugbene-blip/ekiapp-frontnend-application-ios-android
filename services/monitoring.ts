/**
 * Sentry monitoring — opt-in via EXPO_PUBLIC_SENTRY_DSN.
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
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn) return;

  const enableInDev = process.env.EXPO_PUBLIC_SENTRY_ENABLE_DEV === "true";
  if (__DEV__ && !enableInDev) return;

  const Sentry = loadSentry();
  if (!Sentry) return; // native module unavailable (Expo Go, or not in this build) — stay a no-op, same as before

  initialized = true;

  Sentry.init({
    dsn,
    sendDefaultPii: false,
    tracesSampleRate: 0.2,
    enableNativeFramesTracking: false,
    environment: __DEV__ ? "development" : "production",
    // Shares a Sentry project with the backend (same org, one DSN for
    // both) — this tag is how mobile events stay distinguishable from
    // backend events in that shared Issues list.
    initialScope: { tags: { app: "mobile" } },
  });

  setApiErrorReporter((err, context) => {
    captureException(err, context);
  });
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
  return Sentry.wrap(component);
}
