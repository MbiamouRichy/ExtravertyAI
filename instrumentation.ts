// Suivi des erreurs côté serveur (pages, actions, routes, proxy), vers GlitchTip
// par le SDK Sentry. Sans ERROR_TRACKING_DSN, rien n’est initialisé.
import * as Sentry from "@sentry/nextjs";
import {
  baseErrorTrackingOptions,
  errorTrackingEnvironment,
  errorTrackingRelease,
} from "./lib/error-tracking/options";
import { parseDsn } from "./lib/error-tracking/tunnel";
import { emitPostHogLog } from "./lib/posthog-logs";

export function register() {
  if (process.env.NEXT_RUNTIME === "nodejs")
    emitPostHogLog("server_instrumentation_registered", {
      runtime: "nextjs",
    });

  const dsn = parseDsn(process.env.ERROR_TRACKING_DSN);
  if (!dsn) return;
  Sentry.init(
    baseErrorTrackingOptions({
      dsn: dsn.dsn,
      environment: errorTrackingEnvironment(process.env),
      release: errorTrackingRelease(process.env),
    }),
  );
}

// Erreurs non rattrapées pendant le rendu, une action serveur ou une route.
export const onRequestError = Sentry.captureRequestError;
