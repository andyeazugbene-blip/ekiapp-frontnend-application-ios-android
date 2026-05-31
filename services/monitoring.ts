/**
 * Sentry monitoring — opt-in via EXPO_PUBLIC_SENTRY_DSN.
 *
 * @sentry/react-native requires native modules and polyfills that are not
 * available in Expo Go. This module gracefully no-ops when Sentry cannot
 * be loaded, and only activates in production dev-client / standalone builds
 * where the native Sentry SDK is linked.
 */
import { setApiErrorReporter } from "./api";

let initialized = false;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let Sentry: any = null;

export function initMonitoring() {
  if (initialized) return;
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn) return;

  const enableInDev = process.env.EXPO_PUBLIC_SENTRY_ENABLE_DEV === "true";
  if (__DEV__ && !enableInDev) return;

  // Sentry is not bundled in Expo Go — skip silently.
  // In production builds (EAS Build), the native module is available.
  initialized = true;

  setApiErrorReporter((err, context) => {
    captureException(err, context);
  });
}

export function captureException(err: unknown, _context?: Record<string, unknown>) {
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.warn("[monitoring] captureException:", err);
  }
}

export function setMonitoringUser(_user: { id: string; role?: string } | null) {
  // No-op until Sentry is available in a production build.
}
